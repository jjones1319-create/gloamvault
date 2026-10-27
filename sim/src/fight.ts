import { decide, decideAll, parseBehavior, parseRule, type Action, type Condition, type TargetSelector } from './ai.ts'
import type { Content } from './content.ts'
import { alliesOf, applyLine, canAct, canFlee, canSwapRow, canUseSkills, enemiesOf, gainMomentum, heal, hookCtx, isActive, log, lowestHpPercent, reachableEnemies, releaseHolds, speedOf, statOf, type EffectContext, type LineSource } from './effects.ts'
import { activeHooks, dropTurnStartHooks } from './hooks.ts'
import type { Actor, FightCommand, FightEvent, FightOptions, FightState, LegalFightAction, PendingAction, Side } from './fight-types.ts'
import { buildMonsterActor } from './monsters.ts'
import { Rng } from './rng.ts'
import { customHandler } from './skills/custom/index.ts'
import { linesAtRank } from './skill-lines.ts'
import { actionSkippedBy, countDownStatuses, pendingTicks } from './statuses.ts'
import { clamp, roundHalfUp } from './stats.ts'
import { advance, beginCharge, finishCharge, initialEnergy, interruptCharge, type TimelineActor } from './timeline.ts'
import type { Tuning } from './tuning.ts'
import type { Effect, MonsterAttack, SkillDef } from './types/content.ts'
import type { Stance, Target } from './types/enums.ts'

/**
 * The fight (03-GAME-DESIGN §3, §9, §12.1): the timeline loop, turns, commands, the AI for monsters, pets and
 * auto heroes, rounds, flee, boss phases and summons. Heroes under a human stop the loop at `pendingActorId`;
 * `applyFightCommand` resumes it. State is mutated in place and the RNG state is written back after every run.
 */
export interface FightSetup {
  heroes: Actor[]
  pets: Actor[]
  monsters: Actor[]
  surprised: Side | null
  light: number
  options: Partial<FightOptions> & { dungeonId: string; floor: number; floorLevel: number }
  rng: Rng
}

export function createFight(content: Content, t: Tuning, setup: FightSetup): FightState {
  const options: FightOptions = {
    jitterPercent: t.combat.jitterPercent,
    roundCap: t.combat.rounds.hardCap,
    enemyDamagePercent: 100,
    enemySpeedPercent: 100,
    autoHeroes: false,
    partyGold: 0,
    ...setup.options,
  }
  const state: FightState = {
    rng: setup.rng.state,
    tick: 0,
    round: 1,
    light: setup.light,
    surprised: setup.surprised,
    actors: [...setup.heroes, ...setup.pets, ...setup.monsters],
    pendingActorId: null,
    over: null,
    log: [],
    counters: { monstersKilled: 0, heroDowns: 0, fleeAttempts: 0, goldStolen: 0, roundsAtEnd: 0 },
    wear: [],
    xp: [],
    options,
    flags: {},
    actingId: null,
  }
  const rng = new Rng(state.rng)
  for (const a of state.actors) {
    a.energy = initialEnergy(t, rng, a.side === 'party' ? 'heroes' : 'monsters', setup.surprised === 'party' ? 'heroes' : setup.surprised === 'enemy' ? 'monsters' : null)
    a.actedThisRound = false
  }
  state.rng = rng.state
  const ctx = makeCtx(content, t, state, rng)
  log(ctx, { kind: 'start', text: `Fight begins${setup.surprised === 'party' ? ' (the party is surprised)' : setup.surprised === 'enemy' ? ' (the party surprises the monsters)' : ''}` })
  // Passives, affixes and traits that act at the fight's start.
  for (const a of state.actors) for (const { status, hook, line } of activeHooks(content, a)) customHandler(line.customId ?? '')?.onFightStart?.(hookCtx(ctx, a, status, line, hook))
  state.rng = rng.state
  return state
}

function makeCtx(content: Content, t: Tuning, state: FightState, rng: Rng): EffectContext {
  return { content, t, state, rng }
}

function onTimeline(a: Actor): boolean {
  return !a.gone && !a.fallen && !a.fled
}

function byId(state: FightState, id: string | null | undefined): Actor | null {
  if (!id) return null
  return state.actors.find((a) => a.id === id) ?? null
}

/* ---------- the loop ---------- */

/** Runs until a human hero must decide (`pendingActorId`) or the fight is over. */
export function runFight(content: Content, t: Tuning, state: FightState): FightState {
  if (state.over) return state
  const rng = new Rng(state.rng)
  const ctx = makeCtx(content, t, state, rng)
  let guard = 0
  while (!state.over && state.pendingActorId === null && guard++ < 10_000) {
    const views: TimelineActor[] = state.actors.filter(onTimeline).map((a) => ({ id: a.id, speed: speedOf(ctx, a), energy: a.energy, alive: true, charging: a.charging ? { weight: a.charging.weight, chargePaid: a.charging.chargePaid } : null }))
    const next = advance(views)
    if (!next) break
    for (const v of views) {
      const a = byId(state, v.id)
      if (a) a.energy = v.energy
    }
    state.tick += next.ticks
    const actor = byId(state, next.actor.id)
    if (!actor) break
    takeTurn(ctx, actor)
    checkOver(ctx)
  }
  state.rng = rng.state
  return state
}

function takeTurn(ctx: EffectContext, actor: Actor): void {
  const { state, t, rng } = ctx
  state.actingId = actor.id
  // A downed hero's turns count toward its revive window (§12.1).
  if (actor.downed) {
    actor.downedTurnsLeft -= 1
    if (actor.downedTurnsLeft <= 0) {
      actor.fallen = true
      actor.downed = false
      releaseHolds(ctx, actor)
      log(ctx, { kind: 'fallen', actorId: actor.id, text: `${actor.name} has fallen` })
    }
    actor.energy -= t.combat.weights.normal
    markActed(ctx, actor)
    return
  }
  // Turn start: DoTs and HoTs, hooks, pool regen.
  turnStart(ctx, actor)
  if (!isActive(actor)) {
    actor.energy -= t.combat.weights.normal
    endTurn(ctx, actor)
    return
  }
  actor.guarding = false
  // A charged cast resolves now.
  if (actor.charging) {
    const pending = actor.charging.action
    finishCharge(t, { ...actor, charging: actor.charging } as never, rng)
    const paid = actor.charging
    actor.charging = null
    actor.energy -= Math.max(0, rng.jitter(paid.weight, state.options.jitterPercent) - paid.chargePaid)
    executePending(ctx, actor, pending)
    endTurn(ctx, actor)
    return
  }
  // Stun, Freeze, Petrify, Fear.
  const skipped = actionSkippedBy(ctx.content, rng, actor)
  if (skipped) {
    let guardedInstead = false
    for (const { status, hook, line } of activeHooks(ctx.content, actor)) {
      const h = customHandler(line.customId ?? '')
      if (h?.lostActionBecomesGuard?.(hookCtx(ctx, actor, status, line, hook))) guardedInstead = true
    }
    if (guardedInstead) doGuard(ctx, actor)
    else {
      log(ctx, { kind: 'skip', actorId: actor.id, text: `${actor.name} loses the turn (${skipped})`, data: { status: skipped } })
      actor.energy -= t.combat.weights.normal
    }
    endTurn(ctx, actor)
    return
  }
  if (!canAct(ctx, actor)) {
    log(ctx, { kind: 'held', actorId: actor.id, text: `${actor.name} is held and cannot act` })
    actor.energy -= t.combat.weights.normal
    endTurn(ctx, actor)
    return
  }
  // Decide.
  if (actor.kind === 'hero' && !state.options.autoHeroes) {
    state.pendingActorId = actor.id
    return
  }
  const resolved = actor.kind === 'hero' ? decideHero(ctx, actor) : actor.kind === 'pet' ? decidePet(ctx, actor) : decideMonster(ctx, actor)
  execute(ctx, actor, resolved)
  endTurn(ctx, actor)
}

function turnStart(ctx: EffectContext, actor: Actor): void {
  const { t, state } = ctx
  for (const tick of pendingTicks(ctx.content, actor)) {
    if (tick.kind === 'dot') {
      const r = dealDot(ctx, actor, tick.amount, tick.damageType ?? 'poison', tick.ignoresDefense, tick.sourceId)
      log(ctx, { kind: 'dot', actorId: actor.id, amount: r, text: `${actor.name} takes ${r} from ${tick.status}`, data: { status: tick.status } })
    } else {
      const healed = heal(ctx, byId(state, tick.sourceId), actor, tick.amount)
      log(ctx, { kind: 'hot', actorId: actor.id, amount: healed, text: `${actor.name} regenerates ${healed}`, data: { status: tick.status } })
    }
  }
  // Stances that last "until your next turn" end now; then every active hook's turn-start rule.
  dropTurnStartHooks(actor)
  for (const { status, hook, line } of activeHooks(ctx.content, actor)) customHandler(line.customId ?? '')?.onTurnStart?.(hookCtx(ctx, actor, status, line, hook))
  // Pool regen at the start of your own turn (§2.2).
  let regenBonus = 0
  for (const { status, hook, line } of activeHooks(ctx.content, actor)) regenBonus += customHandler(line.customId ?? '')?.poolRegenBonus?.(hookCtx(ctx, actor, status, line, hook)) ?? 0
  if (actor.poolKind === 'stamina') actor.pool = clamp(actor.pool + roundHalfUp((actor.poolMax * Math.max(0, t.derived.stamina.regenPercentPerTurn + regenBonus)) / 100), 0, actor.poolMax)
  else if (actor.poolKind === 'mana') actor.pool = clamp(actor.pool + roundHalfUp((actor.poolMax * Math.max(0, t.derived.mana.regenPercentPerTurn + regenBonus)) / 100), 0, actor.poolMax)
  // Grab holds: the grabber's turn counts toward the role cap; enough damage frees the held.
  for (const held of state.actors) {
    if (held.grabbedBy !== actor.id) continue
    const grabStatus = held.statuses.find((s) => s.id === 'grab')
    const grabber = actor
    const enough = held.grabDamage >= roundHalfUp(grabber.maxHp / 10)
    let capped = false
    if (grabStatus) {
      const h = customHandler('grab-held')
      capped = h?.grabberTurn?.(hookCtx(ctx, held, grabStatus, { kind: 'custom', customId: 'grab-held' }), grabber) ?? false
    }
    if (enough || capped) {
      held.grabbedBy = null
      held.statuses = held.statuses.filter((s) => s.id !== 'grab')
      log(ctx, { kind: 'freed', actorId: held.id, text: `${held.name} is free of the hold` })
    }
  }
}

function dealDot(ctx: EffectContext, actor: Actor, amount: number, damageType: Effect['damageType'] & string, ignoresDefense: boolean, sourceId: string | null): number {
  const { state, t } = ctx
  const source = byId(state, sourceId)
  const mitigated = ignoresDefense ? amount : roundHalfUp((amount * t.derived.defense.mitigationK) / (t.derived.defense.mitigationK + statOf(ctx, actor, 'defense')))
  const dealt = Math.max(0, mitigated)
  const before = actor.hp
  actor.hp = Math.max(0, actor.hp - dealt)
  actor.tally.damageTaken += dealt
  if (source) source.tally.damageDealt += dealt
  if (before > 0 && actor.hp <= 0) {
    if (actor.side === 'party') {
      actor.downed = true
      actor.downedTurnsLeft = t.death.reviveWindowTurns
      state.counters.heroDowns += 1
    } else {
      actor.gone = true
      state.counters.monstersKilled += 1
      if (source) source.tally.kills += 1
    }
    releaseHolds(ctx, actor)
  }
  void damageType
  return dealt
}

function markActed(ctx: EffectContext, actor: Actor): void {
  const { state } = ctx
  if (actor.kind !== 'hero') return
  actor.actedThisRound = true
  const heroes = state.actors.filter((a) => a.kind === 'hero' && onTimeline(a))
  if (heroes.length > 0 && heroes.every((h) => h.actedThisRound)) {
    state.round += 1
    for (const h of heroes) h.actedThisRound = false
    log(ctx, { kind: 'round', text: `Round ${state.round}` })
  }
}

function endTurn(ctx: EffectContext, actor: Actor): void {
  const expired = countDownStatuses(actor)
  for (const s of expired) {
    if (s === 'grab') actor.grabbedBy = null
    log(ctx, { kind: 'statusEnd', actorId: actor.id, text: `${actor.name}: ${s} ends`, data: { status: s } })
  }
  actor.tally.actions += 1
  ctx.state.actingId = null
  markActed(ctx, actor)
  bossPhases(ctx)
}

function checkOver(ctx: EffectContext): void {
  const { state } = ctx
  if (state.over) return
  const heroesUp = state.actors.filter((a) => a.side === 'party' && isActive(a))
  // A boss fight ends with the boss: when the last boss falls, the adds still standing break and flee (D-081).
  const bosses = state.actors.filter((a) => a.side === 'enemy' && a.monster?.isBoss)
  if (bosses.length > 0 && bosses.every((b) => b.gone) && heroesUp.length > 0) {
    for (const a of state.actors) {
      if (a.side !== 'enemy' || !onTimeline(a)) continue
      a.gone = true
      a.fled = true
      releaseHolds(ctx, a)
    }
    log(ctx, { kind: 'crewFlees', text: 'With the boss down, the rest of the crew breaks and runs' })
  }
  const enemies = state.actors.filter((a) => a.side === 'enemy' && onTimeline(a))
  if (enemies.length === 0) finish(ctx, 'victory', 'every enemy is down')
  else if (heroesUp.length === 0) finish(ctx, 'defeat', 'every hero is down')
  else if (state.round > state.options.roundCap) finish(ctx, 'cap', `the ${state.options.roundCap}-round cap`)
}

function finish(ctx: EffectContext, outcome: FightState['over'] extends infer O ? (O extends { outcome: infer X } ? X : never) : never, reason: string): void {
  const { state } = ctx
  state.over = { outcome, reason }
  state.counters.roundsAtEnd = state.round
  state.pendingActorId = null
  log(ctx, { kind: 'end', text: `${outcome}: ${reason}`, data: { outcome } })
}

/* ---------- actions ---------- */

export type ResolvedAction =
  | { kind: 'basic'; target: Actor }
  | { kind: 'skill'; skill: SkillDef; rank: number; target: Actor | null; slot: number }
  | { kind: 'ultimate'; skill: SkillDef; rank: number; target: Actor | null }
  | { kind: 'attack'; attack: MonsterAttack; target: Actor | null }
  | { kind: 'guard' }
  | { kind: 'item'; instanceId: string; target: Actor | null }
  | { kind: 'swapRow' }
  | { kind: 'flee' }
  | { kind: 'freeAlly'; target: Actor }
  | { kind: 'stance'; stance: Stance }
  | { kind: 'pass' }

function spendWeight(ctx: EffectContext, actor: Actor, weight: number): void {
  let w = weight
  for (const { status, hook, line } of activeHooks(ctx.content, actor)) w = customHandler(line.customId ?? '')?.modifyWeight?.(hookCtx(ctx, actor, status, line, hook), w) ?? w
  actor.energy -= ctx.rng.jitter(Math.max(0, w), ctx.state.options.jitterPercent)
}

function heroSkillSource(skill: SkillDef, rank: number, hero: Actor, isUltimate: boolean): LineSource {
  const w = hero.hero?.weapon
  return {
    kind: 'skill',
    id: skill.id,
    label: skill.name,
    isUltimate,
    neverMisses: isUltimate,
    effectPercent: 100 + skill.rankScaling.effectPerRank * (rank - 1),
    reach: (w?.reach ?? false) || skill.tags.includes('reach'),
    ranged: w?.ranged ?? false,
    isMelee: !(w?.ranged ?? false),
  }
}

export function skillCost(_t: Tuning, skill: SkillDef, rank: number): number {
  return Math.max(0, roundHalfUp((skill.cost * (100 + skill.rankScaling.costPerRank * (rank - 1))) / 100))
}

function execute(ctx: EffectContext, actor: Actor, action: ResolvedAction): void {
  const { t, state, rng } = ctx
  switch (action.kind) {
    case 'pass':
      actor.energy -= t.combat.weights.normal
      return
    case 'guard':
      doGuard(ctx, actor)
      return
    case 'basic': {
      doBasic(ctx, actor, action.target)
      return
    }
    case 'skill':
    case 'ultimate': {
      const isUlt = action.kind === 'ultimate'
      let cost = isUlt ? 0 : skillCost(t, action.skill, action.rank)
      if (cost > 0) cost = Math.max(0, roundHalfUp((cost * Math.max(0, 100 + costPercentFor(ctx, actor, action.skill))) / 100))
      if (isUlt) actor.momentum = Math.max(0, actor.momentum - t.derived.momentum.ultimateCost)
      else if (cost > 0) {
        const free = rng.pct(statOf(ctx, actor, 'fortune') / 10)
        if (!free) actor.pool = Math.max(0, actor.pool - cost)
        else log(ctx, { kind: 'fortune', actorId: actor.id, text: `${actor.name}'s ${action.skill.name} costs nothing (Fortune)` })
      }
      const weight = action.skill.weight ?? t.combat.weights.normal
      const pending: PendingAction = { kind: 'skill', skillId: action.skill.id, targetId: action.target?.id ?? null }
      // Heavy casts charge (D-029): declared now, resolved 400 energy later; Ultimates never charge.
      if (!isUlt && weight === t.combat.weights.heavy && actor.poolKind === 'mana') {
        beginCharge(t, actor as never, weight)
        actor.charging = { weight, chargePaid: t.combat.charge.resolveAfterEnergy, action: pending }
        log(ctx, { kind: 'charge', actorId: actor.id, text: `${actor.name} begins to cast ${action.skill.name}` })
        gainMomentum(ctx, actor, t.derived.momentum.onAct)
        return
      }
      resolveSkill(ctx, actor, action.skill, action.rank, action.target, isUlt)
      spendWeight(ctx, actor, weight)
      return
    }
    case 'attack': {
      doMonsterAttack(ctx, actor, action.attack, action.target)
      return
    }
    case 'item': {
      doItem(ctx, actor, action.instanceId, action.target)
      return
    }
    case 'swapRow': {
      actor.row = actor.row === 'front' ? 'back' : 'front'
      log(ctx, { kind: 'swapRow', actorId: actor.id, text: `${actor.name} moves to the ${actor.row} row` })
      spendWeight(ctx, actor, t.combat.weights.rowSwap)
      gainMomentum(ctx, actor, t.derived.momentum.onAct)
      return
    }
    case 'flee': {
      doFlee(ctx, actor)
      return
    }
    case 'freeAlly': {
      action.target.grabbedBy = null
      action.target.statuses = action.target.statuses.filter((s) => s.id !== 'grab')
      log(ctx, { kind: 'freeAlly', actorId: actor.id, targetId: action.target.id, text: `${actor.name} frees ${action.target.name}` })
      spendWeight(ctx, actor, t.combat.weights.freeAlly)
      return
    }
    case 'stance': {
      const pet = state.actors.find((a) => a.pet?.ownerId === actor.id)
      if (pet?.pet) {
        pet.pet.stance = action.stance
        if (actor.hero) actor.hero.stanceChangeUsed = true
        log(ctx, { kind: 'stance', actorId: actor.id, targetId: pet.id, text: `${pet.name} takes the ${action.stance} stance` })
      }
      // Free once per fight: no weight.
      return
    }
  }
}

function executePending(ctx: EffectContext, actor: Actor, pending: PendingAction): void {
  if (pending.kind === 'skill') {
    const skill = ctx.content.skills.get(pending.skillId)
    if (!skill) return
    const rank = actor.hero?.ranks[skill.id] ?? 1
    resolveSkill(ctx, actor, skill, rank, byId(ctx.state, pending.targetId), skill.isUltimate)
  } else {
    const attack = actor.monster?.attacks.find((a) => a.id === pending.attackId)
    if (attack) resolveAttackLines(ctx, actor, attack, byId(ctx.state, pending.targetId))
  }
}

function resolveSkill(ctx: EffectContext, actor: Actor, skill: SkillDef, rank: number, target: Actor | null, isUlt: boolean): void {
  const { t, state } = ctx
  const source = heroSkillSource(skill, rank, actor, isUlt)
  log(ctx, { kind: 'action', actorId: actor.id, targetId: target?.id, text: `${actor.name} uses ${skill.name}${target ? ` on ${target.name}` : ''}` })
  notifyAttacks(ctx, actor)
  let landedHostile = false
  for (const line of linesAtRank(skill, rank)) {
    const out = applyLine(ctx, actor, line, skill.target, target, source)
    if (out.results.some((r) => r.hit) || out.applied.some((a) => !a.startsWith(actor.id))) landedHostile = true
    for (const note of out.notes) if (note.startsWith('summon:')) spawnSummon(ctx, actor, note.slice(7))
  }
  for (const { status, hook, line: hl } of activeHooks(ctx.content, actor)) customHandler(hl.customId ?? '')?.onSkillUsed?.(hookCtx(ctx, actor, status, hl, hook), skill)
  gainMomentum(ctx, actor, t.derived.momentum.onAct)
  for (const ally of alliesOf(state, actor)) if (ally !== actor) gainMomentum(ctx, ally, t.derived.momentum.onAllyAction)
  actor.tally.skillUses[skill.id] = (actor.tally.skillUses[skill.id] ?? 0) + 1
  const enemyLevel = highestEnemyLevel(ctx, actor)
  if (landedHostile || skill.target === 'self' || skill.target === 'ally' || skill.target === 'allAllies' || skill.target === 'allyLowest') {
    state.xp.push({ actorId: actor.id, kind: 'skill', id: skill.id, enemyLevel })
    for (const attr of skill.xpTags) state.xp.push({ actorId: actor.id, kind: 'attribute', id: attr, enemyLevel })
  }
  afterHeroHits(ctx, actor, 'mainHand')
}

function highestEnemyLevel(ctx: EffectContext, actor: Actor): number {
  let best = 0
  for (const e of enemiesOf(ctx.state, actor)) best = Math.max(best, e.level)
  return best || ctx.state.options.floorLevel
}

/** Wear and item XP for a hero's weapon after a skill or basic attack that landed. */
function afterHeroHits(ctx: EffectContext, actor: Actor, slot: 'mainHand' | 'offHand'): void {
  const h = actor.hero
  if (!h) return
  const landed = ctx.state.log.slice(-6).some((e) => e.kind === 'damage' && e.actorId === actor.id)
  if (!landed) return
  if (h.equipment[slot]) {
    ctx.state.wear.push({ actorId: actor.id, kind: 'weapon', slot, double: false })
    ctx.state.xp.push({ actorId: actor.id, kind: 'item', id: slot, enemyLevel: highestEnemyLevel(ctx, actor) })
  }
}

function notifyAttacks(ctx: EffectContext, actor: Actor): void {
  for (const { status, hook, line } of activeHooks(ctx.content, actor)) customHandler(line.customId ?? '')?.onHolderAttacks?.(hookCtx(ctx, actor, status, line, hook))
}

function doBasic(ctx: EffectContext, actor: Actor, target: Actor): void {
  const { t, state } = ctx
  const w = actor.hero?.weapon
  const weight = w?.weight ?? t.combat.weights.normal
  const source: LineSource = { kind: 'basic', id: 'basic', label: 'basic attack', isUltimate: false, neverMisses: false, effectPercent: 100, reach: w?.reach ?? false, ranged: w?.ranged ?? false, isMelee: !(w?.ranged ?? false) }
  log(ctx, { kind: 'action', actorId: actor.id, targetId: target.id, text: `${actor.name} attacks ${target.name}` })
  notifyAttacks(ctx, actor)
  const type = w?.damageType ?? 'pierce'
  if (w?.dual) {
    // Paired light weapons: two strikes at 0.5× (08 §1, D-041).
    applyLine(ctx, actor, { kind: 'damage', multiplier: 0.5, damageType: type }, 'enemy', target, source)
    applyLine(ctx, actor, { kind: 'damage', multiplier: 0.5, damageType: type }, 'enemy', target, source)
  } else {
    applyLine(ctx, actor, { kind: 'damage', multiplier: 1 + (w?.offHandAttackPercent ?? 0) / 100, damageType: type }, 'enemy', target, source)
  }
  for (const line of w?.onHit ?? []) applyLine(ctx, actor, line, 'enemy', target, source)
  // A basic attack restores 15% Stamina or 10% Mana (§2.2) and gains Momentum.
  if (actor.poolKind === 'stamina') actor.pool = clamp(actor.pool + roundHalfUp((actor.poolMax * t.derived.stamina.basicAttackRestorePercent) / 100), 0, actor.poolMax)
  else if (actor.poolKind === 'mana') actor.pool = clamp(actor.pool + roundHalfUp((actor.poolMax * t.derived.mana.basicAttackRestorePercent) / 100), 0, actor.poolMax)
  gainMomentum(ctx, actor, t.derived.momentum.onAct)
  for (const ally of alliesOf(state, actor)) if (ally !== actor) gainMomentum(ctx, ally, t.derived.momentum.onAllyAction)
  if (actor.hero) {
    const enemyLevel = highestEnemyLevel(ctx, actor)
    const hit = state.log.slice(-3).some((e) => e.kind === 'damage' && e.actorId === actor.id)
    if (hit) {
      state.xp.push({ actorId: actor.id, kind: 'attribute', id: w?.ranged ? 'perception' : 'strength', enemyLevel })
      state.xp.push({ actorId: actor.id, kind: 'attribute', id: 'agility', enemyLevel })
    }
    afterHeroHits(ctx, actor, 'mainHand')
  }
  spendWeight(ctx, actor, weight)
}

function doGuard(ctx: EffectContext, actor: Actor): void {
  const { t } = ctx
  actor.guarding = true
  gainMomentum(ctx, actor, t.combat.guard.momentum)
  if (actor.poolKind) actor.pool = clamp(actor.pool + roundHalfUp((actor.poolMax * t.combat.guard.poolRestorePercent) / 100), 0, actor.poolMax)
  log(ctx, { kind: 'guard', actorId: actor.id, text: `${actor.name} guards` })
  spendWeight(ctx, actor, t.combat.weights.guard)
}

function doItem(ctx: EffectContext, actor: Actor, instanceId: string, target: Actor | null): void {
  const { t } = ctx
  const h = actor.hero
  if (!h) return
  const inst = h.bag.find((i) => i.instanceId === instanceId)
  const def = inst ? ctx.content.items.get(inst.itemId) : undefined
  if (!inst || !def?.consumable) {
    actor.energy -= t.combat.weights.item
    return
  }
  log(ctx, { kind: 'action', actorId: actor.id, targetId: target?.id, text: `${actor.name} uses ${def.name}` })
  const source: LineSource = { kind: 'item', id: def.id, label: def.name, isUltimate: false, neverMisses: true, effectPercent: 100, reach: false, ranged: true, isMelee: false }
  for (const line of def.consumable.effects) applyLine(ctx, actor, line, def.consumable.target, target, source)
  // Spend one.
  if (inst.quantity > 1) h.bag = h.bag.map((i) => (i.instanceId === instanceId ? { ...i, quantity: i.quantity - 1 } : i))
  else h.bag = h.bag.filter((i) => i.instanceId !== instanceId)
  gainMomentum(ctx, actor, t.derived.momentum.onAct)
  spendWeight(ctx, actor, t.combat.weights.item)
}

function doFlee(ctx: EffectContext, actor: Actor): void {
  const { t, state, rng } = ctx
  state.counters.fleeAttempts += 1
  const heroes = state.actors.filter((a) => a.side === 'party' && isActive(a))
  const enemies = enemiesOf(state, actor)
  const avg = (list: Actor[]) => (list.length ? roundHalfUp(list.reduce((s, a) => s + speedOf(ctx, a), 0) / list.length) : 100)
  // A Smoke Pellet (flee-chance-bonus hooks on the party): the best single bonus counts.
  let bonus = 0
  for (const h of heroes) for (const hk of h.hooks) if (hk.customId === 'flee-chance-bonus') bonus = Math.max(bonus, hk.line.amount ?? 0)
  const chance = clamp(t.death.flee.basePercent + avg(heroes) - avg(enemies) + bonus, 5, 95)
  if (rng.pct(chance)) {
    for (const h of state.actors.filter((a) => a.side === 'party')) h.fled = true
    log(ctx, { kind: 'flee', actorId: actor.id, text: `The party flees (${chance}%)` })
    finish(ctx, 'fled', 'the party fled')
    return
  }
  log(ctx, { kind: 'fleeFail', actorId: actor.id, text: `The party fails to flee (${chance}%)` })
  if (t.death.flee.failureCostsTurn) for (const h of heroes) h.energy -= t.combat.weights.normal
  spendWeight(ctx, actor, t.combat.weights.normal)
}

function doMonsterAttack(ctx: EffectContext, actor: Actor, attack: MonsterAttack, target: Actor | null): void {
  resolveAttackLines(ctx, actor, attack, target)
  spendWeight(ctx, actor, attack.weight)
}

function resolveAttackLines(ctx: EffectContext, actor: Actor, attack: MonsterAttack, target: Actor | null): void {
  const { state } = ctx
  const source: LineSource = { kind: 'attack', id: attack.id, label: attack.name, isUltimate: false, neverMisses: attack.multiplier === 0, effectPercent: 100, reach: attack.target === 'enemyBack' || attack.target === 'enemyRandom' || attack.target === 'allEnemies' || attack.target === 'enemyRow', ranged: actor.row === 'back', isMelee: actor.row === 'front' }
  log(ctx, { kind: 'action', actorId: actor.id, targetId: target?.id, text: `${actor.name} uses ${attack.name}${target ? ` on ${target.name}` : ''}` })
  notifyAttacks(ctx, actor)
  // Hitting a charging caster: the Grandia push (§3.1).
  if (attack.multiplier > 0) {
    const out = applyLine(ctx, actor, { kind: 'damage', multiplier: attack.multiplier, damageType: attack.damageType }, attack.target, target, source)
    for (const [i, r] of out.results.entries()) {
      const tgt = byId(state, out.targets[i] ?? null)
      if (!tgt || !r.hit || r.dealt <= 0) continue
      if (tgt.charging) {
        const result = interruptCharge(ctx.t, tgt as never, tgt.attributes.willpower, ctx.rng)
        if (result === 'pushed') log(ctx, { kind: 'interrupt', actorId: actor.id, targetId: tgt.id, text: `${tgt.name}'s cast is pushed back` })
        else if (result === 'held') state.xp.push({ actorId: tgt.id, kind: 'attribute', id: 'willpower', enemyLevel: actor.level })
      }
      if (tgt.hero) {
        state.xp.push({ actorId: tgt.id, kind: 'attribute', id: 'endurance', enemyLevel: actor.level })
        if (r.blocked) {
          state.wear.push({ actorId: tgt.id, kind: 'shield', slot: 'offHand', double: false })
          state.xp.push({ actorId: tgt.id, kind: 'item', id: 'offHand', enemyLevel: actor.level })
        } else {
          const piece = pickArmorPiece(ctx)
          const wp = wearPercentFor(ctx, tgt, 'armor')
          state.wear.push({ actorId: tgt.id, kind: 'armor', slot: piece, double: r.weaknessHit, ...(wp !== 100 ? { percent: wp } : {}) })
          state.xp.push({ actorId: tgt.id, kind: 'item', id: piece, enemyLevel: actor.level })
        }
        // Vitality trains per 10% of max HP taken (§5.2).
        const tenths = Math.floor(r.dealt / Math.max(1, roundHalfUp(tgt.maxHp / 10)))
        for (let k = 0; k < tenths; k++) state.xp.push({ actorId: tgt.id, kind: 'attribute', id: 'vitality', enemyLevel: actor.level })
      }
    }
  }
  for (const line of attack.effects) {
    const out = applyLine(ctx, actor, line, attack.target, target, source)
    for (const note of out.notes) if (note.startsWith('summon:')) spawnSummon(ctx, actor, note.slice(7))
    if (line.kind === 'applyStatus' && out.notes.some((n) => n.endsWith(':resisted'))) {
      for (const n of out.notes) {
        const id = n.split(':')[0]
        const tgt = byId(state, id ?? null)
        if (tgt?.hero && n.endsWith(':resisted')) state.xp.push({ actorId: tgt.id, kind: 'attribute', id: 'willpower', enemyLevel: actor.level })
      }
    }
  }
}

function pickArmorPiece(ctx: EffectContext): string {
  const w = ctx.t.equipment.durability.armorHitWeights
  const entries = Object.entries(w)
  const picked = ctx.rng.weighted(entries, ([, weight]) => weight)
  return picked[0]
}

function spawnSummon(ctx: EffectContext, actor: Actor, monsterId: string): void {
  const def = ctx.content.monsters.get(monsterId)
  if (!def) return
  const id = `${monsterId}-s${ctx.state.actors.length}`
  const summon = buildMonsterActor(ctx.content, ctx.t, def, { id, level: actor.level, row: def.rows[0] ?? 'front', hpPercent: 100, summonedBy: actor.id })
  summon.side = actor.side
  summon.energy = 0
  ctx.state.actors.push(summon)
  log(ctx, { kind: 'summon', actorId: actor.id, targetId: id, text: `${actor.name} summons ${summon.name}` })
}

/** Boss phases (03 §11.3, 06): when HP crosses the next threshold, switch attacks and bring the adds. */
function bossPhases(ctx: EffectContext): void {
  for (const boss of ctx.state.actors) {
    const m = boss.monster
    if (!m?.isBoss || boss.gone) continue
    const def = ctx.content.monsters.get(m.monsterId)
    const phases = def?.boss?.phases
    if (!phases) continue
    const next = phases[m.phaseIndex + 1]
    if (!next) continue
    const pct = (boss.hp * 100) / Math.max(1, boss.maxHp)
    if (pct > next.atHpPercent) continue
    m.phaseIndex += 1
    m.attackIds = [...next.attacks]
    log(ctx, { kind: 'phase', actorId: boss.id, text: `${boss.name} enters phase ${m.phaseIndex + 1}`, data: { phase: m.phaseIndex + 1 } })
    for (const add of next.adds) {
      const addDef = ctx.content.monsters.get(add.monsterId)
      if (!addDef) continue
      for (let i = 0; i < add.count; i++) {
        const id = `${add.monsterId}-p${m.phaseIndex}-${i}`
        const a = buildMonsterActor(ctx.content, ctx.t, addDef, { id, level: boss.level, row: add.row, hpPercent: 100 })
        a.energy = 0
        ctx.state.actors.push(a)
        log(ctx, { kind: 'summon', actorId: boss.id, targetId: id, text: `${a.name} joins the fight` })
      }
    }
  }
}

/* ---------- hook sums ---------- */

/** Percent added to a skill's cost by the actor's hooks (Loud Voice −20 on its school). */
function costPercentFor(ctx: EffectContext, actor: Actor, skill: SkillDef): number {
  let pct = 0
  for (const { status, hook, line } of activeHooks(ctx.content, actor)) pct += customHandler(line.customId ?? '')?.costPercent?.(hookCtx(ctx, actor, status, line, hook), skill) ?? 0
  return pct
}

/** Percent of a normal wear event for the actor's gear of a kind (Wall Stance: armor 80). */
function wearPercentFor(ctx: EffectContext, actor: Actor, kind: 'weapon' | 'armor' | 'shield'): number {
  let pct = 100
  for (const { status, hook, line } of activeHooks(ctx.content, actor)) pct += customHandler(line.customId ?? '')?.wearPercent?.(hookCtx(ctx, actor, status, line, hook), kind) ?? 0
  return Math.max(0, pct)
}

/** The enemy a monster's hooks prefer when its behaviour names no target (every bandit on the Marked or netted hero). */
function preferredEnemy(ctx: EffectContext, actor: Actor, candidates: Actor[]): Actor | null {
  for (const { status, hook, line } of activeHooks(ctx.content, actor)) {
    const pick = customHandler(line.customId ?? '')?.preferredTarget?.(hookCtx(ctx, actor, status, line, hook), candidates)
    if (pick && candidates.includes(pick)) return pick
  }
  return null
}

/* ---------- decisions ---------- */

function selectTarget(ctx: EffectContext, actor: Actor, sel: TargetSelector | undefined, reach: boolean): Actor | null {
  const { state, rng } = ctx
  const enemies = reachableEnemies(ctx, actor, reach)
  const allies = alliesOf(state, actor)
  switch (sel) {
    case undefined:
    case 'nearest':
      return preferredEnemy(ctx, actor, enemies) ?? enemies[0] ?? null
    case 'self':
      return actor
    case 'lowest ally':
    case 'lowest hp ally':
    case 'weakest ally': {
      // The party's heroes, the actor included (D-079); a party of pets alone falls back to every ally.
      const heroes = allies.filter((a) => a.kind === 'hero')
      return lowestHpPercent(heroes.length ? heroes : allies)
    }
    case 'random ally':
      return allies.length ? rng.pick(allies) : null
    case 'front enemy':
      return enemies.find((e) => e.row === 'front') ?? enemies[0] ?? null
    case 'back enemy':
      return enemies.find((e) => e.row === 'back') ?? enemies[0] ?? null
    case 'random enemy':
      return enemies.length ? rng.pick(enemies) : null
    case 'weakest enemy':
    case 'lowest enemy':
      return lowestHpPercent(enemies)
    case 'strongest enemy':
      return enemies.reduce<Actor | null>((best, e) => (best === null || e.hp > best.hp ? e : best), null)
    case 'fastest enemy':
      return enemies.reduce<Actor | null>((best, e) => (best === null || speedOf(ctx, e) > speedOf(ctx, best) ? e : best), null)
    case 'marked enemy':
      return enemies.find((e) => e.statuses.some((s) => s.id === 'mark')) ?? enemies[0] ?? null
    case 'taunter':
      return enemies.find((e) => actor.statuses.some((s) => s.id === 'taunt' && s.sourceId === e.id)) ?? enemies[0] ?? null
    case 'pet':
      return state.actors.find((a) => a.pet?.ownerId === actor.id && isActive(a)) ?? null
    case 'all':
      return null
  }
}

function conditionValue(ctx: EffectContext, actor: Actor, c: Condition): number | null {
  const { state } = ctx
  // "ally" in a gambit is a party hero, the actor included (a Mender heals herself); pets answer to "pet" (D-079).
  const partyHeroes = alliesOf(state, actor).filter((a) => a.kind === 'hero')
  const allies = actor.kind === 'hero' ? partyHeroes : alliesOf(state, actor).filter((a) => a !== actor)
  const enemies = enemiesOf(state, actor)
  const pct = (a: Actor) => Math.floor((a.hp * 100) / Math.max(1, a.maxHp))
  const metricOf = (a: Actor): number | null => {
    switch (c.metric) {
      case 'hp':
        return c.percent ? pct(a) : a.hp
      case 'pool':
      case 'stamina':
      case 'mana':
        return c.percent ? (a.poolMax ? Math.floor((a.pool * 100) / a.poolMax) : 0) : a.pool
      case 'momentum':
        return a.momentum
      case 'level':
        return a.level
      case 'status':
        return a.statuses.some((s) => s.id === c.statusId) ? 1 : 0
      case 'count':
      case 'value':
        return null
    }
  }
  switch (c.subject) {
    case 'self':
      return metricOf(actor)
    case 'pet': {
      const pet = state.actors.find((a) => a.pet?.ownerId === actor.id && isActive(a))
      return pet ? metricOf(pet) : null
    }
    case 'ally':
    case 'lowest ally': {
      if (c.metric === 'count') return allies.length
      // "ally status X": some ally holds it (D-079), not only the lowest one.
      if (c.metric === 'status' && c.subject === 'ally') return allies.some((a) => metricOf(a) === 1) ? 1 : 0
      const low = lowestHpPercent(allies)
      return low ? metricOf(low) : null
    }
    case 'allies':
    case 'party': {
      const all = actor.kind === 'hero' ? partyHeroes : [actor, ...allies]
      if (c.metric === 'count') return all.length
      if (c.metric === 'hp') return Math.floor(all.reduce((s, a) => s + pct(a), 0) / all.length)
      return null
    }
    case 'enemy':
    case 'enemies': {
      if (c.metric === 'count') return enemies.length
      // "enemy status mark": some enemy holds it (D-079) — the Ranger shoots the Marked one, wherever it stands.
      if (c.metric === 'status') return enemies.some((a) => metricOf(a) === 1) ? 1 : 0
      const low = lowestHpPercent(enemies)
      return low ? metricOf(low) : null
    }
    case 'light':
      return state.light
    case 'round':
      return state.round
    case 'fight':
      return state.round
  }
}

function matchesName(id: string, name: string, ref: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const r = norm(ref)
  return id === r || norm(name) === r || id.endsWith(`-${r}`)
}

function heroActionFrom(ctx: EffectContext, actor: Actor, action: Action, strict: true): ResolvedAction | null
function heroActionFrom(ctx: EffectContext, actor: Actor, action: Action, strict?: false): ResolvedAction
function heroActionFrom(ctx: EffectContext, actor: Actor, action: Action, strict = false): ResolvedAction | null {
  const h = actor.hero
  if (!h) return { kind: 'pass' }
  const reach = h.weapon.reach || h.weapon.ranged
  const skillAt = (slot: number): SkillDef | null => {
    const id = h.actives[slot] ?? null
    return id ? (ctx.content.skills.get(id) ?? null) : null
  }
  const usable = (skill: SkillDef): boolean => {
    if (!canUseSkills(ctx, actor)) return false
    if (skill.type !== 'active') return false
    const cost = skillCost(ctx.t, skill, h.ranks[skill.id] ?? 1)
    return actor.pool >= cost
  }
  const withSkill = (skill: SkillDef, slot: number): ResolvedAction | null => {
    if (!usable(skill)) return null
    const target = skill.target === 'self' || skill.target === 'allAllies' || skill.target === 'partyFront' || skill.target === 'partyBack' ? null : selectTarget(ctx, actor, action.target, reach || skill.tags.includes('reach'))
    return { kind: 'skill', skill, rank: h.ranks[skill.id] ?? 1, target, slot }
  }
  switch (action.verb) {
    case 'skill': {
      const slot = Number(action.ref ?? '1') - 1
      const skill = skillAt(slot)
      const r = skill ? withSkill(skill, slot) : null
      if (r) return r
      break
    }
    case 'named': {
      for (let i = 0; i < h.actives.length; i++) {
        const skill = skillAt(i)
        if (skill && action.ref && matchesName(skill.id, skill.name, action.ref)) {
          const r = withSkill(skill, i)
          if (r) return r
        }
      }
      break
    }
    case 'ultimate': {
      if (h.ultimateId && actor.momentum >= ctx.t.derived.momentum.ultimateCost && canUseSkills(ctx, actor)) {
        const skill = ctx.content.skills.get(h.ultimateId)
        if (skill) return { kind: 'ultimate', skill, rank: h.ranks[skill.id] ?? 1, target: selectTarget(ctx, actor, action.target, true) }
      }
      break
    }
    case 'guard':
      return { kind: 'guard' }
    case 'item': {
      const inst = h.bag.find((i) => {
        const def = ctx.content.items.get(i.itemId)
        return def?.consumable?.inCombat && action.ref && matchesName(def.id, def.name, action.ref)
      })
      if (inst) return { kind: 'item', instanceId: inst.instanceId, target: selectTarget(ctx, actor, action.target ?? 'self', true) }
      break
    }
    case 'swapRow':
      if (canSwapRow(ctx, actor)) return { kind: 'swapRow' }
      break
    case 'flee':
      if (fleeAllowed(ctx, actor)) return { kind: 'flee' }
      break
    case 'freeAlly': {
      const held = alliesOf(ctx.state, actor).find((a) => a.grabbedBy)
      if (held) return { kind: 'freeAlly', target: held }
      break
    }
    case 'stance':
      if (!h.stanceChangeUsed && action.ref) return { kind: 'stance', stance: action.ref as Stance }
      break
    case 'basic':
      break
  }
  // A strict caller (rule fall-through) hears "cannot" for anything but an explicit basic attack.
  if (strict && action.verb !== 'basic') return null
  const target = selectTarget(ctx, actor, action.verb === 'basic' ? action.target : undefined, reach)
  return target ? { kind: 'basic', target } : { kind: 'guard' }
}

function fleeAllowed(ctx: EffectContext, actor: Actor): boolean {
  if (!canFlee(ctx, actor)) return false
  return !enemiesOf(ctx.state, actor).some((e) => e.monster?.cannotFlee)
}

export function decideHero(ctx: EffectContext, actor: Actor): ResolvedAction {
  const rule = parseRule(actor.hero?.aiRule ?? '')
  // The first matching clause whose action can be carried out now wins (no potion left, no pool: the next clause);
  // a basic attack on the nearest enemy is the last resort (D-060, D-079).
  const actions = decideAll(rule, { value: (c) => conditionValue(ctx, actor, c) })
  for (const action of actions.slice(0, -1)) {
    const r = heroActionFrom(ctx, actor, action, true)
    if (r) return r
  }
  return heroActionFrom(ctx, actor, actions[actions.length - 1]!, false) ?? { kind: 'guard' }
}

function decideMonster(ctx: EffectContext, actor: Actor): ResolvedAction {
  const m = actor.monster
  if (!m) return { kind: 'pass' }
  const pct = Math.floor((actor.hp * 100) / Math.max(1, actor.maxHp))
  if (m.fleesAtPercent > 0 && pct <= m.fleesAtPercent && !m.isBoss && !m.isHunter) {
    actor.gone = true
    actor.fled = true
    releaseHolds(ctx, actor)
    log(ctx, { kind: 'monsterFlee', actorId: actor.id, text: `${actor.name} flees` })
    return { kind: 'pass' }
  }
  const available = m.attacks.filter((a) => m.attackIds.includes(a.id))
  const rule = parseBehavior(m.behavior)
  const action = decide(rule, { value: (c) => conditionValue(ctx, actor, c) })
  let attack: MonsterAttack | null = null
  if (action.verb === 'named' && action.ref) attack = available.find((a) => matchesName(a.id, a.name, action.ref ?? '')) ?? null
  if (action.verb === 'guard') return { kind: 'guard' }
  if (action.verb === 'swapRow') return { kind: 'swapRow' }
  if (action.verb === 'flee') {
    actor.gone = true
    actor.fled = true
    releaseHolds(ctx, actor)
    log(ctx, { kind: 'monsterFlee', actorId: actor.id, text: `${actor.name} flees` })
    return { kind: 'pass' }
  }
  if (!attack) {
    if (available.length === 0) return { kind: 'pass' }
    // A 0-weight attack is a trigger or a rule-only move (The Swarm Turns, a Bruiser's bellow): never a random pick while a weighted one exists.
    const weighted = available.filter((a) => a.aiWeight > 0)
    attack = ctx.rng.weighted(weighted.length ? weighted : available, (a) => Math.max(0, a.aiWeight) || 1)
  }
  const reach = attack.target !== 'enemyFront' && attack.target !== 'enemy' ? true : actor.row === 'back'
  const target = selectTarget(ctx, actor, action.verb === 'named' ? action.target : undefined, reach)
  return { kind: 'attack', attack, target }
}

function decidePet(ctx: EffectContext, actor: Actor): ResolvedAction {
  const p = actor.pet
  if (!p) return { kind: 'pass' }
  const owner = byId(ctx.state, p.ownerId)
  const enemies = reachableEnemies(ctx, actor, false)
  switch (p.stance) {
    case 'mend': {
      const allies = alliesOf(ctx.state, actor)
      const low = lowestHpPercent(allies)
      if (low && low.hp * 100 < low.maxHp * 70) {
        const amount = roundHalfUp(low.maxHp / 10)
        const healed = heal(ctx, actor, low, amount)
        log(ctx, { kind: 'heal', actorId: actor.id, targetId: low.id, amount: healed, text: `${actor.name} tends ${low.name} for ${healed}` })
        actor.energy -= ctx.t.combat.weights.normal
        return { kind: 'pass' }
      }
      break
    }
    case 'forage':
      return { kind: 'guard' }
    case 'guard':
    case 'fierce':
      break
  }
  const followed = owner?.lastTargetId ? byId(ctx.state, owner.lastTargetId) : null
  const target = p.stance === 'fierce' && followed && enemies.includes(followed) ? followed : (enemies[0] ?? null)
  return target ? { kind: 'basic', target } : { kind: 'guard' }
}

/* ---------- commands ---------- */

export function legalFightActions(content: Content, t: Tuning, state: FightState, actorId = state.pendingActorId): LegalFightAction[] {
  const actor = byId(state, actorId)
  if (!actor?.hero || state.over) return []
  const rng = new Rng(state.rng)
  const ctx = makeCtx(content, t, state, rng)
  const h = actor.hero
  const reach = h.weapon.reach || h.weapon.ranged
  const enemies = reachableEnemies(ctx, actor, reach)
  const out: LegalFightAction[] = []
  out.push({ command: { kind: 'basic', targetId: enemies[0]?.id ?? '' }, label: 'Attack', targets: enemies.map((e) => e.id), enabled: enemies.length > 0, reason: enemies.length ? undefined : 'nothing in reach' })
  const silenced = !canUseSkills(ctx, actor)
  h.actives.forEach((id, slot) => {
    const skill = id ? content.skills.get(id) : undefined
    if (!skill || skill.type !== 'active') return
    const cost = skillCost(t, skill, h.ranks[skill.id] ?? 1)
    const needsEnemy = skill.target.startsWith('enemy') || skill.target === 'allEnemies'
    const targets = needsEnemy ? reachableEnemies(ctx, actor, reach || skill.tags.includes('reach')).map((e) => e.id) : skill.target === 'ally' || skill.target === 'allyLowest' ? alliesOf(state, actor).map((a) => a.id) : skill.target === 'downedAlly' ? state.actors.filter((a) => a.side === actor.side && a.downed).map((a) => a.id) : []
    let reason: string | undefined
    if (silenced) reason = 'silenced'
    else if (actor.pool < cost) reason = `needs ${cost} ${actor.poolKind}`
    else if (needsEnemy && targets.length === 0) reason = 'nothing in reach'
    out.push({ command: { kind: 'skill', slot, targetId: targets[0] ?? null }, label: `${skill.name} (${cost})`, targets, enabled: !reason, reason })
  })
  if (h.ultimateId) {
    const ult = content.skills.get(h.ultimateId)
    if (ult) out.push({ command: { kind: 'ultimate', targetId: enemies[0]?.id ?? null }, label: `${ult.name} (Ultimate)`, targets: enemies.map((e) => e.id), enabled: actor.momentum >= t.derived.momentum.ultimateCost && !silenced, reason: silenced ? 'silenced' : actor.momentum < t.derived.momentum.ultimateCost ? `needs ${t.derived.momentum.ultimateCost} Momentum` : undefined })
  }
  out.push({ command: { kind: 'guard' }, label: 'Guard', targets: [], enabled: true })
  for (const inst of h.bag) {
    const def = content.items.get(inst.itemId)
    if (!def?.consumable?.inCombat) continue
    const allies = alliesOf(state, actor).map((a) => a.id)
    out.push({ command: { kind: 'item', instanceId: inst.instanceId, targetId: actor.id }, label: `${def.name} ×${inst.quantity}`, targets: def.consumable.target === 'self' ? [actor.id] : allies, enabled: true })
  }
  out.push({ command: { kind: 'swapRow' }, label: 'Swap row', targets: [], enabled: canSwapRow(ctx, actor), reason: canSwapRow(ctx, actor) ? undefined : 'rooted' })
  const held = alliesOf(state, actor).filter((a) => a.grabbedBy)
  if (held.length) out.push({ command: { kind: 'freeAlly', targetId: held[0]!.id }, label: 'Free ally', targets: held.map((a) => a.id), enabled: true })
  const pet = state.actors.find((a) => a.pet?.ownerId === actor.id && isActive(a))
  if (pet && !h.stanceChangeUsed) out.push({ command: { kind: 'stance', stance: pet.pet?.stance === 'fierce' ? 'guard' : 'fierce' }, label: 'Pet stance', targets: [], enabled: true })
  const flee = fleeAllowed(ctx, actor)
  out.push({ command: { kind: 'flee' }, label: 'Flee', targets: [], enabled: flee, reason: flee ? undefined : 'cannot flee this fight' })
  out.push({ command: { kind: 'auto' }, label: 'Auto', targets: [], enabled: true })
  return out
}

/** Resolves a command for the pending hero and runs the fight on. Throws on an illegal command. */
export function applyFightCommand(content: Content, t: Tuning, state: FightState, command: FightCommand): FightState {
  const actor = byId(state, state.pendingActorId)
  if (!actor?.hero) throw new Error('no hero is waiting for a command')
  const rng = new Rng(state.rng)
  const ctx = makeCtx(content, t, state, rng)
  const resolved = resolveCommand(ctx, actor, command)
  state.pendingActorId = null
  execute(ctx, actor, resolved)
  endTurn(ctx, actor)
  checkOver(ctx)
  state.rng = rng.state
  return runFight(content, t, state)
}

function resolveCommand(ctx: EffectContext, actor: Actor, command: FightCommand): ResolvedAction {
  const h = actor.hero
  if (!h) throw new Error('not a hero')
  const reach = h.weapon.reach || h.weapon.ranged
  const need = (id: string | null, allowNull: boolean): Actor | null => {
    const a = byId(ctx.state, id)
    if (!a && !allowNull) throw new Error(`unknown target ${id}`)
    return a
  }
  switch (command.kind) {
    case 'auto':
      return decideHero(ctx, actor)
    case 'basic': {
      const target = need(command.targetId, false)
      if (!target || !reachableEnemies(ctx, actor, reach).includes(target)) throw new Error('target out of reach')
      return { kind: 'basic', target }
    }
    case 'skill': {
      const id = h.actives[command.slot] ?? null
      const skill = id ? ctx.content.skills.get(id) : undefined
      if (!skill || skill.type !== 'active') throw new Error('no skill in that slot')
      if (!canUseSkills(ctx, actor)) throw new Error('silenced')
      const rank = h.ranks[skill.id] ?? 1
      if (actor.pool < skillCost(ctx.t, skill, rank)) throw new Error('not enough pool')
      return { kind: 'skill', skill, rank, target: need(command.targetId, true), slot: command.slot }
    }
    case 'ultimate': {
      const skill = h.ultimateId ? ctx.content.skills.get(h.ultimateId) : undefined
      if (!skill) throw new Error('no ultimate')
      if (actor.momentum < ctx.t.derived.momentum.ultimateCost) throw new Error('not enough Momentum')
      return { kind: 'ultimate', skill, rank: h.ranks[skill.id] ?? 1, target: need(command.targetId, true) }
    }
    case 'guard':
      return { kind: 'guard' }
    case 'item':
      return { kind: 'item', instanceId: command.instanceId, target: need(command.targetId, true) }
    case 'swapRow':
      if (!canSwapRow(ctx, actor)) throw new Error('rooted')
      return { kind: 'swapRow' }
    case 'flee':
      if (!fleeAllowed(ctx, actor)) throw new Error('cannot flee')
      return { kind: 'flee' }
    case 'freeAlly': {
      const target = need(command.targetId, false)
      if (!target?.grabbedBy) throw new Error('that ally is not held')
      return { kind: 'freeAlly', target }
    }
    case 'stance':
      if (h.stanceChangeUsed) throw new Error('stance already changed this fight')
      return { kind: 'stance', stance: command.stance }
  }
}

/** Runs a whole fight on auto (the balance runner, replays). */
export function runFightAuto(content: Content, t: Tuning, state: FightState): FightState {
  state.options.autoHeroes = true
  while (!state.over) {
    runFight(content, t, state)
    if (state.pendingActorId) applyFightCommand(content, t, state, { kind: 'auto' })
  }
  return state
}

export function fightSummary(state: FightState): { outcome: string; rounds: number; ticks: number; heroDowns: number; monstersKilled: number; events: number } {
  return { outcome: state.over?.outcome ?? 'running', rounds: state.round, ticks: state.tick, heroDowns: state.counters.heroDowns, monstersKilled: state.counters.monstersKilled, events: state.log.length }
}

export type { FightEvent, Target }
