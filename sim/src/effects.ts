import type { Content } from './content.ts'
import type { Actor, FightEvent, FightState, HookInstance, Side, StatusInstance } from './fight-types.ts'
import { activeHooks, installHook, removeHook } from './hooks.ts'
import { lightBand, shiftedBand } from './light.ts'
import type { Rng } from './rng.ts'
import { customHandler, type CustomHandler, type HookContext, type HookFx, type IncomingDamage } from './skills/custom/index.ts'
import { applyStatus, cleanse, hasStatus, removeStatus, statusDef, statusStatLines, strip } from './statuses.ts'
import { clamp, hitChance, mitigate, roundHalfUp, type DerivedStats } from './stats.ts'
import type { Tuning } from './tuning.ts'
import type { Effect } from './types/content.ts'
import { ELEMENTS, PHYS_TYPES, type DamageType, type DerivedStat, type Status, type Target } from './types/enums.ts'

/**
 * The effect-DSL interpreter and the damage pipeline (03-GAME-DESIGN §2.2, §3.2–§3.5; content/README.md "The
 * effect DSL"). Every skill, attack, item, trait, affix and status line comes through here. The fight owns turns;
 * this module owns what a line does to whom.
 */
export interface EffectContext {
  content: Content
  t: Tuning
  state: FightState
  rng: Rng
}

export function log(ctx: EffectContext, ev: Omit<FightEvent, 'tick' | 'round'>): void {
  ctx.state.log.push({ tick: ctx.state.tick, round: ctx.state.round, ...ev })
}

export function isActive(a: Actor): boolean {
  return !a.gone && !a.fallen && !a.fled && !a.downed && a.hp > 0
}

export function livingAllies(state: FightState, side: Side): Actor[] {
  return state.actors.filter((a) => a.side === side && isActive(a))
}

export function enemiesOf(state: FightState, actor: Actor): Actor[] {
  return livingAllies(state, actor.side === 'party' ? 'enemy' : 'party')
}

export function alliesOf(state: FightState, actor: Actor): Actor[] {
  return livingAllies(state, actor.side)
}

/* ---------- effective stats ---------- */

/** The context a custom handler sees; `fx` is the fight's verbs so handlers never import this module. */
export function hookCtx(ctx: EffectContext, holder: Actor, status: StatusInstance | null, line: Effect, hook: HookInstance | null = null, sourceId: string | null = null): HookContext {
  return { content: ctx.content, t: ctx.t, state: ctx.state, rng: ctx.rng, holder, status, line, hook, sourceId, fx: fxFor(ctx) }
}

function fxFor(ctx: EffectContext): HookFx {
  return {
    strike: (attacker, target, o) => {
      const r = dealDamage(ctx, attacker, target, { amount: o.amount, damageType: o.damageType, canMiss: o.canMiss ?? false, canCrit: o.canCrit ?? false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: o.isMelee ?? false, ignoresDefense: o.ignoresDefense ?? false, sourceLabel: o.label })
      log(ctx, { kind: r.hit ? 'damage' : 'miss', actorId: attacker?.id, targetId: target.id, amount: r.dealt, text: r.hit ? `${attacker ? attacker.name + ': ' : ''}${o.label} hits ${target.name} for ${r.dealt}` : `${o.label} misses ${target.name}`, data: { killed: r.killed, downed: r.downed } })
      return { hit: r.hit, dealt: r.dealt, killed: r.killed }
    },
    heal: (healer, target, amount) => heal(ctx, healer, target, amount),
    applyStatus: (target, input, sourceId) => {
      const r = applyStatus(ctx.content, ctx.t, ctx.rng, target, { ...input, sourceId, fresh: ctx.state.actingId === target.id })
      if (r.outcome === 'applied') log(ctx, { kind: 'status', targetId: target.id, text: `${target.name} is ${r.status}`, data: { status: r.status } })
      return r.outcome
    },
    attackFor: (actor, type) => attackFor(ctx, actor, type),
    statOf: (actor, stat) => statOf(ctx, actor, stat),
    gainMomentum: (actor, amount) => gainMomentum(ctx, actor, amount),
    log: (kind, text, extra = {}) => log(ctx, { kind, text, ...extra }),
    alliesOf: (actor) => alliesOf(ctx.state, actor),
    enemiesOf: (actor) => enemiesOf(ctx.state, actor),
    isActive,
    installHook: (actor, line, sourceId, opts) => installHook(actor, line, sourceId, opts),
    removeHook: (actor, hook) => removeHook(actor, hook),
    applyLine: (actor, line, baseTarget, chosen, source = {}) => {
      const src: LineSource = { kind: 'trait', id: 'hook', label: 'hook', isUltimate: false, neverMisses: false, effectPercent: 100, reach: true, ranged: false, isMelee: true, ...source }
      const out = applyLine(ctx, actor, line, baseTarget, chosen, src)
      return { targets: out.targets, dealt: out.results.map((r) => r.dealt), applied: out.applied }
    },
    hasStatus: (actor, status) => hasStatus(actor, status),
    removeStatus: (actor, status) => removeStatus(actor, status),
  }
}

/** Σ of a custom-hook percent across the holder's statuses. */
function hookPercent(ctx: EffectContext, actor: Actor, pick: (h: CustomHandler, hc: HookContext) => number | undefined): number {
  let total = 0
  for (const { status, hook, line } of activeHooks(ctx.content, actor)) {
    const h = customHandler(line.customId ?? '')
    if (!h) continue
    total += pick(h, hookCtx(ctx, actor, status, line, hook)) ?? 0
  }
  return total
}

/** A derived stat with every temporary modifier: status stat lines, timed modifiers, Curse on the attributes. */
export function statOf(ctx: EffectContext, actor: Actor, stat: DerivedStat): number {
  let flat = 0
  let pct = 0
  for (const { line, stacks } of statusStatLines(ctx.content, actor)) {
    if (line.stat !== stat) continue
    flat += (line.amount ?? 0) * stacks
    pct += (line.percent ?? 0) * stacks
  }
  for (const m of actor.modifiers) {
    if (m.stat !== stat) continue
    flat += m.amount
    pct += m.percent
  }
  // Auras: a percent an ally grants while it stands (a Commander's fodder aura).
  for (const ally of ctx.state.actors) {
    if (ally === actor || ally.side !== actor.side || ally.hooks.length === 0 || !isActive(ally)) continue
    for (const hook of ally.hooks) {
      const h = customHandler(hook.customId)
      if (h?.auraStatPercent) pct += h.auraStatPercent(hookCtx(ctx, ally, null, hook.line, hook), actor, stat)
    }
  }
  // Curse: all attributes −10% reads as −10% on the attribute-driven stats.
  const attrPct = hookPercent(ctx, actor, (h, hc) => h.attributePercent?.(hc))
  if (attrPct && (stat === 'attackPhys' || stat === 'attackSpell' || stat === 'defense' || stat === 'hp' || stat === 'speed')) pct += attrPct
  const base = actor.base[stat] + flat
  const value = roundHalfUp((base * (100 + pct)) / 100)
  if (stat === 'speed') return clamp(value, ctx.t.derived.speed.floor, ctx.t.derived.speed.cap)
  if (stat === 'accuracy') return clamp(value, ctx.t.derived.accuracy.min, ctx.t.derived.accuracy.max)
  if (stat === 'dodge') return clamp(value, 0, 95)
  if (stat === 'critRate') return clamp(value, 0, 100)
  return Math.max(0, value)
}

/** Speed for the timeline, with the difficulty knob on monsters. */
export function speedOf(ctx: EffectContext, actor: Actor): number {
  let s = statOf(ctx, actor, 'speed')
  if (actor.side === 'enemy' && ctx.state.options.enemySpeedPercent !== 100) s = roundHalfUp((s * ctx.state.options.enemySpeedPercent) / 100)
  return clamp(s, ctx.t.derived.speed.floor, ctx.t.derived.speed.cap)
}

export function canAct(ctx: EffectContext, actor: Actor): boolean {
  for (const { status, hook, line } of activeHooks(ctx.content, actor)) {
    const h = customHandler(line.customId ?? '')
    if (h?.canAct && !h.canAct(hookCtx(ctx, actor, status, line, hook))) return false
  }
  return true
}

export function canUseSkills(ctx: EffectContext, actor: Actor): boolean {
  for (const { status, hook, line } of activeHooks(ctx.content, actor)) {
    const h = customHandler(line.customId ?? '')
    if (h?.canUseSkills && !h.canUseSkills(hookCtx(ctx, actor, status, line, hook))) return false
  }
  return true
}

export function canSwapRow(ctx: EffectContext, actor: Actor): boolean {
  if (actor.hero?.species.forcedRowMoveImmune === false) {
    /* voluntary swaps are always the hero's choice; the immunity is against forced moves */
  }
  for (const { status, hook, line } of activeHooks(ctx.content, actor)) {
    const h = customHandler(line.customId ?? '')
    if (h?.canSwapRow && !h.canSwapRow(hookCtx(ctx, actor, status, line, hook))) return false
  }
  return true
}

export function canFlee(ctx: EffectContext, actor: Actor): boolean {
  for (const { status, hook, line } of activeHooks(ctx.content, actor)) {
    const h = customHandler(line.customId ?? '')
    if (h?.canFlee && !h.canFlee(hookCtx(ctx, actor, status, line, hook))) return false
  }
  return true
}

/** The actor this one must target (Taunt), when it is still a legal target. */
export function forcedTarget(ctx: EffectContext, actor: Actor): Actor | null {
  for (const { status, hook, line } of activeHooks(ctx.content, actor)) {
    const h = customHandler(line.customId ?? '')
    const id = h?.mustTarget?.(hookCtx(ctx, actor, status, line, hook))
    if (id) {
      const target = ctx.state.actors.find((a) => a.id === id)
      if (target && isActive(target)) return target
    }
  }
  return null
}

/** Whether `attacker` may target `target` (a Grabbed hero is targetable only by the grabber). */
export function canBeTargetedBy(ctx: EffectContext, target: Actor, attacker: Actor): boolean {
  for (const { status, hook, line } of activeHooks(ctx.content, target)) {
    const h = customHandler(line.customId ?? '')
    const only = h?.onlyTargetableBy?.(hookCtx(ctx, target, status, line, hook))
    if (only && only !== attacker.id) return false
    if (h?.untargetable?.(hookCtx(ctx, target, status, line, hook))) return false
  }
  return true
}

/* ---------- targeting ---------- */

function rowOf(actors: Actor[], row: 'front' | 'back'): Actor[] {
  return actors.filter((a) => a.row === row)
}

/** The enemies a melee attacker can reach: the front row, or the back row when the front is empty (§3.3). */
export function reachableEnemies(ctx: EffectContext, actor: Actor, reach: boolean): Actor[] {
  const enemies = enemiesOf(ctx.state, actor).filter((e) => canBeTargetedBy(ctx, e, actor))
  if (reach) return enemies
  // Huge monsters occupy both rows: reachable from anywhere (06 §7).
  const front = enemies.filter((e) => e.row === 'front' || e.monster?.size === 'huge')
  return front.length > 0 ? front : enemies
}

export function lowestHpPercent(actors: Actor[]): Actor | null {
  let best: Actor | null = null
  let bestPct = Infinity
  for (const a of actors) {
    const pct = (a.hp * 100) / Math.max(1, a.maxHp)
    if (pct < bestPct) {
      best = a
      bestPct = pct
    }
  }
  return best
}

/** Resolves a target word into actors, honouring rows, reach and Taunt. `chosen` is the tapped target when the word needs one. */
export function resolveTargets(ctx: EffectContext, actor: Actor, target: Target, chosen: Actor | null, opts: { reach?: boolean; ranged?: boolean } = {}): Actor[] {
  const state = ctx.state
  const allies = alliesOf(state, actor)
  const enemies = enemiesOf(state, actor).filter((e) => canBeTargetedBy(ctx, e, actor))
  const forced = forcedTarget(ctx, actor)
  const pickEnemy = (): Actor | null => {
    if (forced && enemies.includes(forced)) return forced
    const reach = reachableEnemies(ctx, actor, opts.reach === true || opts.ranged === true)
    if (chosen && reach.includes(chosen)) return chosen
    return reach[0] ?? null
  }
  switch (target) {
    case 'self':
      return [actor]
    case 'ally':
      return chosen && allies.includes(chosen) ? [chosen] : [actor]
    case 'allyLowest': {
      const low = lowestHpPercent(allies)
      return low ? [low] : []
    }
    case 'allAllies':
      return allies
    case 'allyRow': {
      const row = chosen && allies.includes(chosen) ? chosen.row : actor.row
      return rowOf(allies, row)
    }
    case 'partyFront':
      return rowOf(allies, 'front')
    case 'partyBack':
      return rowOf(allies, 'back')
    case 'enemy': {
      const e = pickEnemy()
      return e ? [e] : []
    }
    case 'enemyFront': {
      const front = rowOf(enemies, 'front')
      const pool = front.length ? front : enemies
      if (forced && pool.includes(forced)) return [forced]
      if (chosen && pool.includes(chosen)) return [chosen]
      return pool[0] ? [pool[0]] : []
    }
    case 'enemyBack': {
      const back = rowOf(enemies, 'back')
      const pool = back.length ? back : enemies
      if (chosen && pool.includes(chosen)) return [chosen]
      return pool[0] ? [pool[0]] : []
    }
    case 'enemyRandom':
      return enemies.length ? [ctx.rng.pick(enemies)] : []
    case 'allEnemies':
      return enemies
    case 'enemyRow': {
      const e = pickEnemy()
      return e ? rowOf(enemies, e.row) : []
    }
    case 'enemyRowBack': {
      const e = pickEnemy()
      return e ? rowOf(enemies, e.row === 'front' ? 'back' : 'front') : []
    }
    case 'pet': {
      const pet = state.actors.find((a) => a.pet?.ownerId === actor.id && isActive(a))
      return pet ? [pet] : []
    }
    case 'summon':
      return state.actors.filter((a) => a.kind === 'summon' && a.side === actor.side && isActive(a))
    case 'downedAlly': {
      const d = state.actors.filter((a) => a.side === actor.side && a.downed && !a.fallen)
      if (chosen && d.includes(chosen)) return [chosen]
      return d[0] ? [d[0]] : []
    }
    case 'allDowned':
      return state.actors.filter((a) => a.side === actor.side && a.downed && !a.fallen)
    case 'fallenAlly': {
      const f = state.actors.filter((a) => a.side === actor.side && a.fallen)
      if (chosen && f.includes(chosen)) return [chosen]
      return f[0] ? [f[0]] : []
    }
    case 'room':
      return []
  }
}

/* ---------- damage ---------- */

export interface DamageInput {
  /** Attack × multiplier before mitigation. */
  amount: number
  damageType: DamageType
  canMiss: boolean
  canCrit: boolean
  isDot: boolean
  isUltimate: boolean
  isSingleTarget: boolean
  isMelee: boolean
  ignoresDefense: boolean
  /** Fraction of Defense ignored (Stiletto 20). */
  ignoreDefensePercent?: number
  sourceLabel: string
}

export interface DamageResult {
  hit: boolean
  crit: boolean
  blocked: boolean
  guarded: boolean
  absorbed: number
  dealt: number
  killed: boolean
  downed: boolean
  /** The hero armor piece that took the hit (for wear). */
  weaknessHit: boolean
}

const MISS: DamageResult = { hit: false, crit: false, blocked: false, guarded: false, absorbed: 0, dealt: 0, killed: false, downed: false, weaknessHit: false }

export function isPhysical(type: DamageType): boolean {
  return (PHYS_TYPES as readonly string[]).includes(type)
}

export function isElement(type: DamageType): boolean {
  return (ELEMENTS as readonly string[]).includes(type)
}

/** Armor family weak types (03 §3.4, 08 §2): Plate → Pierce, Mail → Blunt, Leather → Slash. */
const FAMILY_WEAKNESS: Record<string, DamageType> = { plate: 'pierce', mail: 'blunt', leather: 'slash' }

/** Element and physical-type multiplier in percent for `target` taking `type`. */
export function typeMultiplierPercent(ctx: EffectContext, target: Actor, type: DamageType): { percent: number; weakness: boolean } {
  const e = ctx.t.combat.elements
  const m = target.monster
  if (m) {
    if (m.immune.includes(type)) return { percent: e.immuneMultiplier * 100, weakness: false }
    if (m.weak.includes(type)) return { percent: e.weakMultiplier * 100, weakness: true }
    if (m.resist.includes(type)) return { percent: e.resistMultiplier * 100, weakness: false }
    return { percent: 100, weakness: false }
  }
  const h = target.hero
  if (h) {
    let pct = 100
    const r = h.species.resist[type]
    const w = h.species.weak[type]
    if (r !== undefined) pct = roundHalfUp(pct * r)
    if (w !== undefined) pct = roundHalfUp(pct * w)
    const weakness = h.armorFamily !== null && FAMILY_WEAKNESS[h.armorFamily] === type
    if (weakness) pct = roundHalfUp(pct * 1.25)
    return { percent: pct, weakness }
  }
  return { percent: 100, weakness: false }
}

/** Accuracy with the light band (03 §4.2): monsters gain in the dark; heroes lose unless their species is dark-steady. */
export function accuracyOf(ctx: EffectContext, actor: Actor): number {
  let acc = statOf(ctx, actor, 'accuracy')
  const band = lightBand(ctx.t, ctx.state.light)
  if (actor.side === 'enemy') acc += band.monsterAccuracy
  else if (actor.hero && !actor.hero.species.darkAccuracyImmune) acc += shiftedBand(ctx.t, band, actor.hero.species.lightBandShift).heroAccuracy
  return clamp(acc, ctx.t.derived.accuracy.min, ctx.t.derived.accuracy.max)
}

/**
 * Deals damage through the whole §2.2 pipeline: hit roll, Veil, crit, variance, type multipliers, Mark/Smite/Freeze
 * hooks, Guard, Block, Defense, Shield absorb; then HP, downed/killed, Momentum on the target, Grab tracking and the
 * after-hit hooks. The caller logs the event and applies wear.
 */
export function dealDamage(ctx: EffectContext, attacker: Actor | null, target: Actor, input: DamageInput): DamageResult {
  const { t, rng, state } = ctx
  const physical = isPhysical(input.damageType)
  const incoming: IncomingDamage = {
    amount: input.amount,
    damageType: input.damageType,
    attacker,
    isSingleTarget: input.isSingleTarget,
    isDot: input.isDot,
    isUltimate: input.isUltimate,
    isMelee: input.isMelee,
    physical,
  }
  // Hit roll.
  if (input.canMiss && attacker && !input.isDot) {
    let accBonus = 0
    for (const { status, hook, line } of activeHooks(ctx.content, attacker)) accBonus += customHandler(line.customId ?? '')?.accuracyBonus?.(hookCtx(ctx, attacker, status, line, hook), target) ?? 0
    let chance = hitChance(t, accuracyOf(ctx, attacker) + accBonus, statOf(ctx, target, 'dodge'))
    // A Halfling's Small trait: big single-target melee attackers miss more (05).
    const sizePenalty = attacker.monster && target.hero && input.isSingleTarget && input.isMelee ? (target.hero.species.enemyAccuracyBySize[attacker.monster.size] ?? 0) : 0
    chance = clamp(chance + sizePenalty, t.derived.hit.minChance, 100)
    if (!rng.pct(chance)) {
      for (const { status, hook, line } of activeHooks(ctx.content, target)) customHandler(line.customId ?? '')?.onDodge?.(hookCtx(ctx, target, status, line, hook), attacker, incoming)
      return MISS
    }
    for (const { status, hook, line } of activeHooks(ctx.content, target)) {
      const h = customHandler(line.customId ?? '')
      if (h?.beforeHit?.(hookCtx(ctx, target, status, line, hook), incoming) === 'miss') return MISS
    }
  }
  // Attacker-side hooks: a guaranteed crit (consumed), a scaled blow (a broken bolt arm −20%).
  let forcedCrit = false
  let outPct = 0
  let critBonus = 0
  if (attacker && !input.isDot) {
    for (const { status, hook, line } of activeHooks(ctx.content, attacker)) {
      const h = customHandler(line.customId ?? '')
      if (!h) continue
      const hc = hookCtx(ctx, attacker, status, line, hook)
      if (input.canCrit && h.forceCrit?.(hc, target)) forcedCrit = true
      outPct += h.outgoingDamagePercent?.(hc, target, incoming) ?? 0
      critBonus += h.critRateBonus?.(hc, target, incoming) ?? 0
    }
  }
  let amount = input.amount
  let crit = false
  if (input.canCrit && attacker && !input.isDot) {
    crit = forcedCrit ? true : rng.pct(clamp(statOf(ctx, attacker, 'critRate') + critBonus, 0, 100))
    if (crit) amount = roundHalfUp((amount * statOf(ctx, attacker, 'critDamage')) / 100)
  }
  // Variance: × U(floor, 1.05).
  if (attacker && !input.isDot) {
    const floor = statOf(ctx, attacker, 'variance')
    amount = roundHalfUp((amount * rng.range(floor, t.derived.variance.ceilingPercent)) / 100)
  }
  if (outPct) amount = roundHalfUp((amount * Math.max(0, 100 + outPct)) / 100)
  // Attacker-side multipliers: a species' below-half-HP rage, the difficulty knob on monster damage.
  if (attacker?.hero?.species.damageMultiplierBelowHpPercent) {
    const rage = attacker.hero.species.damageMultiplierBelowHpPercent
    if ((attacker.hp * 100) / Math.max(1, attacker.maxHp) < rage.hpPercent) amount = roundHalfUp(amount * rage.multiplier)
  }
  if (attacker?.side === 'enemy' && !input.isDot && state.options.enemyDamagePercent !== 100) amount = roundHalfUp((amount * state.options.enemyDamagePercent) / 100)
  // Type multiplier.
  const typeMult = typeMultiplierPercent(ctx, target, input.damageType)
  amount = roundHalfUp((amount * typeMult.percent) / 100)
  // Target-side percent hooks (Mark, Smite, Freeze).
  const takenPct = hookPercent(ctx, target, (h, hc) => h.incomingDamagePercent?.(hc, incoming))
  if (takenPct) amount = roundHalfUp((amount * (100 + takenPct)) / 100)
  // Guard halves; Block halves physical hits.
  let guarded = false
  let blocked = false
  if (!input.isDot && !input.isUltimate && target.guarding) {
    guarded = true
    amount = roundHalfUp(amount * t.combat.guard.damageMultiplier)
  }
  if (!input.isDot && physical && !input.isUltimate) {
    const block = statOf(ctx, target, 'block')
    if (block > 0 && rng.pct(block)) {
      blocked = true
      amount = roundHalfUp(amount / 2)
      for (const { status, hook, line } of activeHooks(ctx.content, target)) customHandler(line.customId ?? '')?.onBlock?.(hookCtx(ctx, target, status, line, hook), incoming)
    }
  }
  // Defense.
  if (!input.ignoresDefense) {
    let def = statOf(ctx, target, 'defense')
    if (input.ignoreDefensePercent) def = roundHalfUp((def * (100 - input.ignoreDefensePercent)) / 100)
    amount = mitigate(amount, def, t.derived.defense.mitigationK)
  }
  amount = Math.max(0, amount)
  // Shields absorb.
  let absorbed = 0
  for (const { status, hook, line } of activeHooks(ctx.content, target)) {
    const h = customHandler(line.customId ?? '')
    if (!h?.absorb) continue
    const left = h.absorb(hookCtx(ctx, target, status, line, hook), { ...incoming, amount })
    absorbed += amount - left
    amount = left
    if (amount <= 0) break
  }
  let dealt = Math.max(0, amount)
  const before = target.hp
  if (attacker) attacker.lastTargetId = target.id
  let newHp = Math.max(0, before - dealt)
  // A Last Stand (beforeDowned): the holder stays at 1 HP once.
  if (before > 0 && newHp <= 0) {
    for (const { status, hook, line } of activeHooks(ctx.content, target)) {
      if (customHandler(line.customId ?? '')?.beforeDowned?.(hookCtx(ctx, target, status, line, hook), incoming)) {
        newHp = 1
        dealt = Math.max(0, before - 1)
        break
      }
    }
  }
  target.hp = newHp
  target.tally.damageTaken += dealt
  if (attacker) {
    attacker.tally.damageDealt += dealt
    if (dealt > 0 || absorbed > 0) attacker.tally.hitsLanded += 1
  }
  if (dealt > 0) target.tally.hitsTaken += 1
  if (blocked) target.tally.blocks += 1
  if (attacker && dealt > 0) for (const { status, hook, line } of activeHooks(ctx.content, attacker)) customHandler(line.customId ?? '')?.onDealtDamage?.(hookCtx(ctx, attacker, status, line, hook), target, dealt, incoming)
  if (dealt > 0) breakPart(ctx, attacker, target, dealt, input.damageType, crit)
  // Momentum on being hit (§2.2).
  if (!input.isDot && dealt > 0) gainMomentum(ctx, target, t.derived.momentum.onHit)
  // Grab tracking: damage to the grabber frees the held.
  if (dealt > 0) for (const a of state.actors) if (a.grabbedBy === target.id) a.grabDamage += dealt
  // After-hit hooks on the target.
  if (dealt > 0) {
    for (const { status, hook, line } of activeHooks(ctx.content, target)) {
      const h = customHandler(line.customId ?? '')
      h?.afterHit?.(hookCtx(ctx, target, status, line, hook), incoming, dealt)
    }
  }
  let killed = false
  let downed = false
  if (before > 0 && target.hp <= 0) {
    if (target.side === 'party') {
      target.downed = true
      target.downedTurnsLeft = t.death.reviveWindowTurns
      target.guarding = false
      state.counters.heroDowns += 1
      downed = true
    } else {
      target.gone = true
      killed = true
      state.counters.monstersKilled += 1
      if (attacker) attacker.tally.kills += 1
      for (const { status, hook, line } of activeHooks(ctx.content, target)) customHandler(line.customId ?? '')?.onDeath?.(hookCtx(ctx, target, status, line, hook), attacker)
      if (attacker) for (const { status, hook, line } of activeHooks(ctx.content, attacker)) customHandler(line.customId ?? '')?.onKill?.(hookCtx(ctx, attacker, status, line, hook), target)
    }
    releaseHolds(ctx, target)
  }
  return { hit: true, crit, blocked, guarded, absorbed, dealt, killed, downed, weaknessHit: typeMult.weakness }
}

/** A downed or dead actor lets go of everything it held (Grab) and stops taunting. */
export function releaseHolds(ctx: EffectContext, actor: Actor): void {
  for (const a of ctx.state.actors) {
    if (a.grabbedBy === actor.id) {
      a.grabbedBy = null
      a.statuses = a.statuses.filter((s) => s.id !== 'grab')
    }
    a.statuses = a.statuses.filter((s) => !(s.id === 'taunt' && s.sourceId === actor.id))
  }
}

export function gainMomentum(ctx: EffectContext, actor: Actor, amount: number): void {
  if (actor.kind !== 'hero') return
  const gain = roundHalfUp((amount * statOf(ctx, actor, 'momentumGain')) / 100)
  actor.momentum = clamp(actor.momentum + gain, 0, ctx.t.derived.momentum.max)
}

/** Healing with Wither and the max HP cap; returns the HP restored. */
export function heal(ctx: EffectContext, healer: Actor | null, target: Actor, amount: number): number {
  if (target.gone || target.fallen) return 0
  let pct = hookPercent(ctx, target, (h, hc) => h.incomingHealingPercent?.(hc))
  if (healer) pct += hookPercent(ctx, healer, (h, hc) => h.outgoingHealingPercent?.(hc, target))
  const scaled = Math.max(0, roundHalfUp((amount * Math.max(0, 100 + pct)) / 100))
  const restored = Math.min(scaled, target.maxHp - target.hp)
  target.hp += restored
  if (healer) healer.tally.healingDone += restored
  return restored
}

/* ---------- lines ---------- */

export interface LineSource {
  kind: 'skill' | 'basic' | 'attack' | 'item' | 'trait' | 'affix' | 'status' | 'curio' | 'trap' | 'relic'
  id: string
  label: string
  isUltimate: boolean
  neverMisses: boolean
  /** Rank scaling for skills: percent of the rank-1 value (100 = rank 1). */
  effectPercent: number
  /** Melee reach for the weapon in hand. */
  reach: boolean
  ranged: boolean
  isMelee: boolean
}

export interface LineOutcome {
  line: Effect
  targets: string[]
  results: DamageResult[]
  healed: number
  applied: string[]
  notes: string[]
}

/** A Guard-stance pet intercepts 30% of single-target hits aimed at its owner (03 §9). */
export function interceptingPet(ctx: EffectContext, target: Actor): Actor | null {
  if (target.kind !== 'hero') return null
  const pet = ctx.state.actors.find((a) => a.pet?.ownerId === target.id && a.pet.stance === 'guard' && isActive(a))
  if (!pet) return null
  if (!ctx.rng.pct(ctx.t.pets.stances.guardInterceptPercent)) return null
  log(ctx, { kind: 'intercept', actorId: pet.id, targetId: target.id, text: `${pet.name} takes the hit meant for ${target.name}` })
  return pet
}

/** Who takes a single-target hit aimed at `target`: an Intercepting ally or a Guard Dog (hooks on the target), else a Guard-stance pet. */
export function interceptorFor(ctx: EffectContext, target: Actor, attacker: Actor | null, incoming: IncomingDamage): { actor: Actor; percent: number } | null {
  for (const { status, hook, line } of activeHooks(ctx.content, target)) {
    const h = customHandler(line.customId ?? '')
    const r = h?.intercept?.(hookCtx(ctx, target, status, line, hook), attacker, incoming)
    if (!r) continue
    const who = ctx.state.actors.find((a) => a.id === r.interceptorId)
    if (who && who !== target && isActive(who)) {
      log(ctx, { kind: 'intercept', actorId: who.id, targetId: target.id, text: `${who.name} takes the hit meant for ${target.name}` })
      return { actor: who, percent: r.percent }
    }
  }
  const pet = interceptingPet(ctx, target)
  return pet ? { actor: pet, percent: 0 } : null
}

/** Attack for a damage line: physical uses attackPhys, elements use attackSpell (03 §2.2: Attack (phys) / Attack (spell)). */
export function attackFor(ctx: EffectContext, actor: Actor, type: DamageType): number {
  if (actor.monster) return statOf(ctx, actor, 'attackPhys')
  return isPhysical(type) ? statOf(ctx, actor, 'attackPhys') : statOf(ctx, actor, 'attackSpell')
}

/** `scalesWith`: +2% per attribute point above 10 (a reading; 03 §2.2 says the sim owns the curve). */
export function scalesWithPercent(actor: Actor, line: Effect): number {
  if (!line.scalesWith) return 0
  return Math.max(0, (actor.attributes[line.scalesWith] ?? 10) - 10) * 2
}

/** Resolves one effect line of a skill, attack or item for the actor. */
export function applyLine(ctx: EffectContext, actor: Actor, line0: Effect, baseTarget: Target, chosen: Actor | null, source: LineSource): LineOutcome {
  // The actor's hooks may rewrite or skip the line first (an element swap, an execute multiplier, a conditional rider).
  let line = line0
  for (const { status, hook, line: hl } of activeHooks(ctx.content, actor)) {
    const mod = customHandler(hl.customId ?? '')?.modifyLine?.(hookCtx(ctx, actor, status, hl, hook), line, source, chosen)
    if (mod === 'skip') return { line, targets: [], results: [], healed: 0, applied: [], notes: ['skipped'] }
    if (mod) line = mod
  }
  const target = line.target ?? baseTarget
  const targets = resolveTargets(ctx, actor, target, chosen, { reach: source.reach, ranged: source.ranged })
  const out: LineOutcome = { line, targets: targets.map((a) => a.id), results: [], healed: 0, applied: [], notes: [] }
  const chance = line.chance ?? 100
  const scale = source.effectPercent + scalesWithPercent(actor, line)
  const aoe = targets.length > 1 || target === 'allEnemies' || target === 'enemyRow' || target === 'allAllies'
  switch (line.kind) {
    case 'damage': {
      for (const [index, original] of targets.entries()) {
        if (chance < 100 && !ctx.rng.pct(chance)) continue
        const type = line.damageType ?? 'slash'
        const base0 = roundHalfUp((attackFor(ctx, actor, type) * (line.multiplier ?? 1) * scale) / 100)
        const picked = aoe ? null : interceptorFor(ctx, original, actor, { amount: base0, damageType: type, attacker: actor, isSingleTarget: true, isDot: false, isUltimate: source.isUltimate, isMelee: source.isMelee, physical: isPhysical(type) })
        const tgt = picked?.actor ?? original
        if (picked) out.targets[index] = tgt.id
        const base = picked?.percent ? roundHalfUp((base0 * Math.max(0, 100 + picked.percent)) / 100) : base0
        const r = dealDamage(ctx, actor, tgt, {
          amount: base,
          damageType: type,
          canMiss: !source.neverMisses && !aoe,
          canCrit: true,
          isDot: false,
          isUltimate: source.isUltimate,
          isSingleTarget: !aoe,
          isMelee: source.isMelee,
          ignoresDefense: false,
          sourceLabel: source.label,
        })
        out.results.push(r)
        log(ctx, { kind: r.hit ? 'damage' : 'miss', actorId: actor.id, targetId: tgt.id, amount: r.dealt, text: r.hit ? `${actor.name}: ${source.label} hits ${tgt.name} for ${r.dealt}${r.crit ? ' (crit)' : ''}${r.blocked ? ' (blocked)' : ''}${r.guarded ? ' (guarded)' : ''}` : `${actor.name}: ${source.label} misses ${tgt.name}`, data: { crit: r.crit, blocked: r.blocked, killed: r.killed, downed: r.downed } })
      }
      break
    }
    case 'heal': {
      for (const tgt of targets) {
        if (chance < 100 && !ctx.rng.pct(chance)) continue
        let amount = 0
        if (line.multiplier !== undefined) amount = roundHalfUp((attackFor(ctx, actor, 'holy') * line.multiplier * scale) / 100)
        else if (line.percent !== undefined) amount = roundHalfUp((tgt.maxHp * line.percent * scale) / 10_000)
        else amount = roundHalfUp(((line.amount ?? 0) * scale) / 100)
        const healed = heal(ctx, actor, tgt, amount)
        out.healed += healed
        log(ctx, { kind: 'heal', actorId: actor.id, targetId: tgt.id, amount: healed, text: `${actor.name}: ${source.label} heals ${tgt.name} for ${healed}` })
      }
      break
    }
    case 'shield': {
      for (const tgt of targets) {
        let amount = 0
        if (line.multiplier !== undefined) amount = roundHalfUp((attackFor(ctx, actor, 'holy') * line.multiplier * scale) / 100)
        // 03 §3.5: a Shield absorbs a percent of the HOLDER's max HP (the Gate Holds' "of the Warden's" is its own hook).
        else if (line.percent !== undefined) amount = roundHalfUp((tgt.maxHp * line.percent * scale) / 10_000)
        else amount = roundHalfUp(((line.amount ?? 0) * scale) / 100)
        const r = applyStatus(ctx.content, ctx.t, ctx.rng, tgt, { status: 'shield', duration: durationWithBonus(ctx, actor, 'shield', tgt, line.duration), magnitude: amount, sourceId: actor.id, chance, fresh: ctx.state.actingId === tgt.id })
        if (r.outcome === 'applied') out.applied.push(`${tgt.id}:shield:${amount}`)
      }
      break
    }
    case 'applyStatus': {
      if (!line.status) break
      for (const tgt of targets) {
        const sdef = statusDef(ctx.content, line.status)
        // Burn and Bleed tick a share of "the applying hit's damage" (03 §3.5): this action's last hit on the target, else
        // a hit's worth of the applier's Attack of the status's damage type when the line lands without a hit (D-077).
        const magnitude =
          line.status === 'regen'
            ? roundHalfUp(((line.percent ?? 0) * scale) / 100) || undefined
            : sdef.magnitudeOf === 'hitDamage'
              ? applyingHitDamage(ctx, actor, tgt) ?? roundHalfUp((attackFor(ctx, actor, sdef.tickDamageType ?? 'slash') * (line.multiplier ?? 1) * scale) / 100)
              : undefined
        const r = applyStatus(ctx.content, ctx.t, ctx.rng, tgt, { status: line.status, chance, duration: durationWithBonus(ctx, actor, line.status, tgt, line.duration), magnitude, sourceId: actor.id, applierDurationMultiplier: actor.hero?.species.appliedDurationMultiplier[line.status], fresh: ctx.state.actingId === tgt.id }, actor.monster?.size)
        if (r.outcome === 'applied') {
          out.applied.push(`${tgt.id}:${r.status}`)
          if (r.status === 'grab') {
            tgt.grabbedBy = actor.id
            tgt.grabDamage = 0
          }
          log(ctx, { kind: 'status', actorId: actor.id, targetId: tgt.id, text: `${tgt.name} is ${r.status}${r.upgraded ? ' (upgraded)' : ''}`, data: { status: r.status } })
        } else if (r.outcome === 'resisted' || r.outcome === 'immune') out.notes.push(`${tgt.id}:${line.status}:${r.outcome}`)
      }
      break
    }
    case 'removeStatus': {
      if (!line.status) break
      for (const tgt of targets) {
        tgt.statuses = tgt.statuses.filter((s) => s.id !== line.status)
        if (line.status === 'grab') tgt.grabbedBy = null
      }
      break
    }
    case 'buffStat':
    case 'debuffStat': {
      if (!line.stat) break
      for (const tgt of targets) {
        if (chance < 100 && !ctx.rng.pct(chance)) continue
        tgt.modifiers.push({ stat: line.stat, amount: roundHalfUp(((line.amount ?? 0) * scale) / 100), percent: roundHalfUp(((line.percent ?? 0) * scale) / 100), turnsLeft: line.duration ?? 3, sourceId: source.id, ...(ctx.state.actingId === tgt.id ? { fresh: true } : {}) })
        out.applied.push(`${tgt.id}:${line.kind}:${line.stat}`)
      }
      break
    }
    case 'momentum':
      for (const tgt of targets) gainMomentum(ctx, tgt, roundHalfUp(((line.amount ?? 0) * scale) / 100))
      break
    case 'pool':
      for (const tgt of targets) {
        if (tgt.poolKind === null) continue
        const delta = line.percent !== undefined ? roundHalfUp((tgt.poolMax * line.percent) / 100) : (line.amount ?? 0)
        tgt.pool = clamp(tgt.pool + delta, 0, tgt.poolMax)
      }
      break
    case 'timeline':
      for (const tgt of targets) tgt.energy += line.energy ?? 0
      break
    case 'rowSwap':
      for (const tgt of targets) {
        if (tgt.side !== actor.side && tgt.hero?.species.forcedRowMoveImmune) continue
        if (tgt.monster && (tgt.monster.size === 'large' || tgt.monster.size === 'huge')) continue
        tgt.row = tgt.row === 'front' ? 'back' : 'front'
      }
      break
    case 'taunt':
      for (const tgt of targets) {
        const r = applyStatus(ctx.content, ctx.t, ctx.rng, tgt, { status: 'taunt', chance, duration: durationWithBonus(ctx, actor, 'taunt', tgt, line.duration), sourceId: actor.id, fresh: ctx.state.actingId === tgt.id })
        if (r.outcome === 'applied') out.applied.push(`${tgt.id}:taunt`)
      }
      break
    case 'dispel':
      for (const tgt of targets) {
        // On an ally `amount` caps the debuffs removed ("Remove 1"); on an enemy it caps the buffs stripped.
        const removed = tgt.side === actor.side ? cleanse(ctx.content, tgt, ['cleanse'], line.amount ?? Infinity) : strip(ctx.content, tgt, line.amount ?? Infinity)
        out.applied.push(...removed.map((s) => `${tgt.id}:-${s}`))
      }
      break
    case 'revive':
      for (const tgt of targets) {
        if (!tgt.downed && !tgt.fallen) continue
        tgt.downed = false
        tgt.fallen = false
        tgt.hp = Math.max(1, roundHalfUp((tgt.maxHp * (line.percent ?? 30)) / 100))
        tgt.energy = 0
        out.applied.push(`${tgt.id}:revived`)
        log(ctx, { kind: 'revive', actorId: actor.id, targetId: tgt.id, amount: tgt.hp, text: `${actor.name} revives ${tgt.name} at ${tgt.hp} HP` })
      }
      break
    case 'light':
      ctx.state.light = clamp(ctx.state.light + (line.amount ?? 0), 0, ctx.t.exploration.light.max)
      break
    case 'summon':
      // The fight module spawns summons (it owns actor creation); it reads this note.
      out.notes.push(`summon:${line.summonId ?? ''}`)
      break
    case 'loot':
      out.notes.push(`loot:${line.amount ?? line.percent ?? 0}`)
      break
    case 'custom': {
      const h = customHandler(line.customId ?? '')
      if (h?.apply) {
        if (targets.length === 0) h.apply(hookCtx(ctx, actor, null, line, null, source.id), null, scale)
        for (const tgt of targets) h.apply(hookCtx(ctx, actor, null, line, null, source.id), tgt, scale)
      } else out.notes.push(`custom:${line.customId ?? ''}`)
      break
    }
  }
  return out
}

/** The damage `actor` dealt to `target` with its last hit of the current action (the log since its last `action` entry), or null. */
function applyingHitDamage(ctx: EffectContext, actor: Actor, target: Actor): number | null {
  const log = ctx.state.log
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]!
    if (e.kind === 'action' && e.actorId === actor.id) break
    if (e.kind === 'damage' && e.actorId === actor.id && e.targetId === target.id && (e.amount ?? 0) > 0) return e.amount ?? null
  }
  return null
}

/** A status duration with the applier's bonus hooks (Loud Voice: Taunts +1 turn); the default duration when the line names none. */
function durationWithBonus(ctx: EffectContext, applier: Actor, status: Status, target: Actor, lineDuration: number | undefined): number | undefined {
  let bonus = 0
  for (const { status: st, hook, line } of activeHooks(ctx.content, applier)) bonus += customHandler(line.customId ?? '')?.statusDurationBonus?.(hookCtx(ctx, applier, st, line, hook), status, target) ?? 0
  if (!bonus) return lineDuration
  return Math.max(1, (lineDuration ?? statusDef(ctx.content, status).durationDefault ?? 0) + bonus)
}

/**
 * Part break (03 §6.3, 06 §1 "hit the marked limb"): one blow of at least `combat.partBreak.hpPercentOfMaxInOneHit`
 * of the monster's max HP breaks its marked limb once per fight — the limb's effect applies to the monster and the
 * rare-part roll doubles (loot.ts). A limb whose effect names a damage type breaks only to that type ("Blunt, 6 % HP");
 * an untyped limb breaks only on a critical hit, the sim's reading of "aimed at the limb" (D-071, D-078).
 */
function breakPart(ctx: EffectContext, attacker: Actor | null, target: Actor, dealt: number, damageType: DamageType, crit: boolean): void {
  const m = target.monster
  if (!m || m.partBroken) return
  const limb = ctx.content.monsters.get(m.monsterId)?.parts.breakLimb
  if (!limb) return
  if (dealt * 100 < target.maxHp * ctx.t.combat.partBreak.hpPercentOfMaxInOneHit.value) return
  if (limb.effect.damageType ? limb.effect.damageType !== damageType : !crit) return
  m.partBroken = true
  log(ctx, { kind: 'partBreak', actorId: attacker?.id, targetId: target.id, text: `${target.name}'s ${limb.name} breaks`, data: { limb: limb.name } })
  if (limb.effect.kind === 'custom') {
    const h = customHandler(limb.effect.customId ?? '')
    h?.apply?.(hookCtx(ctx, target, null, limb.effect, null, 'part-break'), target, 100)
  } else {
    const source: LineSource = { kind: 'trait', id: 'part-break', label: `${limb.name} breaks`, isUltimate: false, neverMisses: true, effectPercent: 100, reach: false, ranged: false, isMelee: false }
    applyLine(ctx, target, limb.effect, 'self', target, source)
  }
}

export function statsSnapshot(ctx: EffectContext, actor: Actor): DerivedStats {
  const out = { ...actor.base }
  for (const key of Object.keys(out) as DerivedStat[]) out[key] = statOf(ctx, actor, key)
  return out
}

export { hasStatus }
