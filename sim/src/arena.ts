import type { Actor, ArenaProp, ArenaState, ArenaStats, FightRow, FightState, LegalFightAction } from './fight-types.ts'
import { alliesOf, applyLine, enemiesOf, isActive, log, type EffectContext, type LineSource } from './effects.ts'
import { installPassiveAttackHooks } from './explore.ts'
import { installHook } from './hooks.ts'
import { lightBand } from './light.ts'
import { buildMonsterActor, partyScale, scaledCount } from './monsters.ts'
import { applyStatus } from './statuses.ts'
import { clamp, roundHalfUp } from './stats.ts'
import type { ArenaRuleDef, ArenaRuleKind, BossAdd, BossDef, BossPartDef, Effect, ItemDef, MonsterAttack, MonsterDef } from './types/content.ts'
import type { Status } from './types/enums.ts'

/**
 * The boss arenas (07-DUNGEONS §2.8; 06 §3; 03 §4.2, §11.3; D-099): a boss fight's room as rules on the fight. The
 * fight module calls in at the fight's start, at each turn's start and end, at each new round, when a monster's
 * attack resolves, and for the heroes' Arena and Torch actions; this module owns the arena's state on
 * `FightState.arena` and writes every arena event into the fight log as `{ kind: 'arena', data: { what, boss, … } }`
 * and every tell as `{ kind: 'tell', data: { hint, cue, source, ref, first, boss } }` (the shapes the balance runner
 * and the contracts read; content/README.md "Boss arenas").
 *
 * The vocabulary is closed (ArenaRuleKind); each boss's monster file composes it with its own numbers. Telegraphed
 * attacks (06 §8.10: "none lands on the turn its tell shows") wind up here for every monster, arena or not.
 */

/* ---------- setup ---------- */

export interface ArenaSetup {
  /** The boss's actor id in the fight. */
  bossActorId: string
  /** The room template (07 §2.8); null when the room is unknown. */
  templateId: string | null
  /** The light the arena sets (the floor's lightAtArena, 07 §2.3); null keeps the delve's. */
  light: number | null
  /** The hunters the party killed this delve (DelveState.huntersKilled): they do not come back (07 §2.8, §2.9). */
  huntersKilled: readonly string[]
  partySize: number
  /** The difficulty knob on enemy HP (percent of normal). */
  enemyHpPercent: number
}

const EMPTY_STATS: ArenaStats = {
  lightMin: 100,
  lanternsOut: 0,
  candlesOut: 0,
  doorsOpened: false,
  tideMax: 0,
  sluiceTurns: 0,
  braziersLit: 0,
  torchesUsed: 0,
  recalls: 0,
  huntersReturned: 0,
  huntersSkipped: 0,
  pulls: 0,
  tells: 0,
  tellsBroken: 0,
}

function bossDefOf(ctx: EffectContext, arena: ArenaState): MonsterDef | undefined {
  return ctx.content.monsters.get(arena.bossId)
}

function bossBlock(ctx: EffectContext, arena: ArenaState): BossDef | null {
  return bossDefOf(ctx, arena)?.boss ?? null
}

function byId(state: FightState, id: string | null | undefined): Actor | null {
  if (!id) return null
  return state.actors.find((a) => a.id === id) ?? null
}

function bossActor(ctx: EffectContext, arena: ArenaState): Actor | null {
  return byId(ctx.state, arena.bossActorId)
}

function hpPercent(a: Actor): number {
  return Math.floor((a.hp * 100) / Math.max(1, a.maxHp))
}

/** The arena's rules of a kind that run in the current phase. */
function rulesOf(ctx: EffectContext, arena: ArenaState, kind: ArenaRuleKind, phase = arena.phase): ArenaRuleDef[] {
  const rules = bossBlock(ctx, arena)?.arena?.rules ?? []
  return rules.filter((r) => r.kind === kind && (!r.phases || r.phases.includes(phase)))
}

function anyRule(ctx: EffectContext, arena: ArenaState, kind: ArenaRuleKind): ArenaRuleDef | undefined {
  return (bossBlock(ctx, arena)?.arena?.rules ?? []).find((r) => r.kind === kind)
}

function num(r: ArenaRuleDef, key: string, fallback: number): number {
  const v = r.params?.[key]
  return typeof v === 'number' ? v : fallback
}

function str(r: ArenaRuleDef, key: string, fallback: string): string {
  const v = r.params?.[key]
  return typeof v === 'string' ? v : fallback
}

function flag(r: ArenaRuleDef, key: string): boolean {
  return r.params?.[key] === true
}

/** Logs an arena event: `{ kind: 'arena', data: { what, boss, … } }`. */
function logArena(ctx: EffectContext, arena: ArenaState, what: string, text: string, extra: { actorId?: string; targetId?: string; amount?: number; data?: Record<string, number | string | boolean | null> } = {}): void {
  log(ctx, { kind: 'arena', actorId: extra.actorId, targetId: extra.targetId, amount: extra.amount, text, data: { what, boss: arena.bossId, ...(extra.data ?? {}) } })
}

/* ---------- the light (03 §4.2; 07 §2.8) ---------- */

export function lightBandId(ctx: EffectContext, light = ctx.state.light): string {
  return lightBand(ctx.t, light).id
}

function setLight(ctx: EffectContext, arena: ArenaState, to: number, cause: string, actorId: string | null = null, extra: Record<string, number | string | boolean | null> = {}): void {
  const from = ctx.state.light
  const next = clamp(roundHalfUp(to), 0, ctx.t.exploration.light.max)
  ctx.state.light = next
  arena.stats.lightMin = Math.min(arena.stats.lightMin, next)
  const band = lightBandId(ctx, next)
  logArena(ctx, arena, 'light', `The light ${next > from ? 'rises' : next < from ? 'falls' : 'holds'} to ${next} (${band})`, { actorId: actorId ?? undefined, amount: next, data: { from, to: next, band, cause, ...extra } })
}

/* ---------- tells (06 §8.10; 07 §2.8; D-099) ---------- */

/** Shows a tell: logs `{ kind: 'tell' }` with its two-word hint (`first` the first time the hint shows this fight). */
export function showTell(ctx: EffectContext, o: { hint: string; cue: string; source: 'arena' | 'attack'; ref: string; actorId: string | null; targetId: string | null; firesAtRound?: number }): void {
  const arena = ctx.state.arena ?? null
  const first = arena ? !arena.hintsShown.includes(o.hint) : !ctx.state.log.some((e) => e.kind === 'tell' && e.data?.hint === o.hint)
  if (arena) {
    if (first) arena.hintsShown.push(o.hint)
    arena.stats.tells += 1
    if (o.source === 'arena') {
      arena.tells = arena.tells.filter((t) => t.id !== o.ref)
      arena.tells.push({ id: o.ref, hint: o.hint, cue: o.cue, firesAtRound: o.firesAtRound ?? ctx.state.round + 1, actorId: o.actorId, targetId: o.targetId })
    }
  }
  log(ctx, { kind: 'tell', actorId: o.actorId ?? undefined, targetId: o.targetId ?? undefined, text: o.hint, data: { hint: o.hint, cue: o.cue, source: o.source, ref: o.ref, first, boss: arena?.bossId ?? null } })
}

function arenaTell(ctx: EffectContext, arena: ArenaState, tellId: string | undefined, actorId: string | null, targetId: string | null = null, firesAtRound?: number): void {
  if (!tellId) return
  const def = bossBlock(ctx, arena)?.arena?.tells.find((t) => t.id === tellId)
  showTell(ctx, { hint: def?.hint ?? tellId, cue: def?.cue ?? tellId, source: 'arena', ref: tellId, actorId, targetId, firesAtRound })
}

/** The statuses that break a wound-up blow (07 §2.8: "Silence or Daze him to skip it"). */
function breakers(ctx: EffectContext): readonly string[] {
  return ctx.t.arena?.tell.breakers ?? ['daze', 'silence']
}

/** The weight a telegraphed attack's tell turn costs (tuning `arena.tell.windupWeight`). */
export function windupWeight(ctx: EffectContext): number {
  return ctx.t.arena?.tell.windupWeight.value ?? ctx.t.combat.weights.normal
}

/** The two-word hint of a telegraphed attack (its `hint`, else its name). */
export function attackHint(attack: MonsterAttack): string {
  return attack.hint ?? attack.name
}

/** Starts a telegraphed attack's wind-up (the tell turn): the tell shows and the blow waits for the monster's next turn. */
export function beginWindup(ctx: EffectContext, actor: Actor, attack: MonsterAttack, target: Actor | null): void {
  const m = actor.monster
  if (!m) return
  m.windup = { attackId: attack.id, targetId: target?.id ?? null, hint: attackHint(attack), sinceLog: ctx.state.log.length }
  showTell(ctx, { hint: attackHint(attack), cue: attack.tell ?? attack.name, source: 'attack', ref: attack.id, actorId: actor.id, targetId: target?.id ?? null })
}

/**
 * The wound-up blow on the monster's next turn: the attack, or 'broken' when a Daze, Stun or Silence landed on it since
 * the tell (or it is Silenced now), or null when nothing is wound up. Clears the wind-up either way.
 */
export function takeWindup(ctx: EffectContext, actor: Actor): { attack: MonsterAttack; targetId: string | null } | 'broken' | null {
  const m = actor.monster
  const w = m?.windup
  if (!m || !w) return null
  m.windup = null
  const attack = m.attacks.find((a) => a.id === w.attackId)
  if (!attack || !m.attackIds.includes(attack.id)) return 'broken'
  const stop = breakers(ctx)
  const hit = ctx.state.log.slice(w.sinceLog).some((e) => e.kind === 'status' && e.targetId === actor.id && stop.includes(String(e.data?.status ?? '')))
  const silenced = actor.statuses.some((s) => stop.includes(s.id))
  if (hit || silenced) {
    if (ctx.state.arena) ctx.state.arena.stats.tellsBroken += 1
    log(ctx, { kind: 'tellBroken', actorId: actor.id, text: `${actor.name}'s ${attack.name} is broken off`, data: { attackId: attack.id, hint: w.hint } })
    return 'broken'
  }
  return { attack, targetId: w.targetId }
}

/* ---------- spawning ---------- */

function groupOf(arena: ArenaState, actorId: string): string {
  const g = arena.flags[`group:${actorId}`]
  return typeof g === 'string' ? g : 'start'
}

interface SpawnOptions {
  group: string
  /** Percent of the add's party-scaled HP (Tidal Call's tentacle 50, the Hound at heel 60). */
  hpPercent?: number
  /** A fixed max HP (Naesa's shade: 1). */
  fixedHp?: number
  name?: string
  level?: number
  /** Scale the count by the party (03 §11.2; 06 §8.1: boss adds use the count rule). */
  scaleCount?: boolean
}

function spawnOne(ctx: EffectContext, arena: ArenaState, def: MonsterDef, row: FightRow, o: SpawnOptions): Actor {
  const boss = bossActor(ctx, arena)
  const partySize = Number(arena.flags.partySize ?? 1)
  const knob = Number(arena.flags.enemyHpPercent ?? 100)
  // D-128: every add of a boss arena scales on the boss row (`partyScaling.boss`).
  const scale = partyScale(ctx.t, partySize, true)
  const id = `${def.id}-a${ctx.state.actors.length}`
  const a = buildMonsterActor(ctx.content, ctx.t, def, { id, level: o.level ?? boss?.level ?? ctx.state.options.floorLevel, row, hpPercent: roundHalfUp((scale.hpPercent * (o.hpPercent ?? 100)) / 100), enemyHpPercent: knob })
  if (o.name) a.name = o.name
  if (o.fixedHp !== undefined) {
    a.maxHp = Math.max(1, o.fixedHp)
    a.hp = a.maxHp
    a.base = { ...a.base, hp: a.maxHp }
  }
  a.energy = 0
  installPassiveAttackHooks(a)
  installActorHooks(ctx, arena, a)
  ctx.state.actors.push(a)
  arena.flags[`group:${id}`] = o.group
  arena.rows[id] = a.row
  log(ctx, { kind: 'summon', actorId: boss?.id ?? arena.bossActorId, targetId: id, text: `${a.name} joins the fight` })
  return a
}

/** Spawns a list of adds, the count scaled by the party unless told not to; logs one `recall` event for the wave. */
function spawnAdds(ctx: EffectContext, arena: ArenaState, adds: readonly BossAdd[], cause: string, o: SpawnOptions): Actor[] {
  const out: Actor[] = []
  const partySize = Number(arena.flags.partySize ?? 1)
  const scale = partyScale(ctx.t, partySize)
  for (const add of adds) {
    const def = ctx.content.monsters.get(add.monsterId)
    if (!def) continue
    const n = o.scaleCount === false ? add.count : scaledCount(add.count, scale.countPercent, def.role)
    for (let i = 0; i < n; i++) out.push(spawnOne(ctx, arena, def, add.row, o))
  }
  if (out.length > 0) {
    arena.stats.recalls += 1
    const ids = out.map((a) => a.monster?.monsterId ?? a.id)
    logArena(ctx, arena, 'recall', `${out.map((a) => a.name).join(', ')} ${out.length > 1 ? 'enter' : 'enters'}`, { actorId: arena.bossActorId, data: { cause, monsters: ids.join(','), count: out.length } })
  }
  return out
}

/** Arena hooks every actor in the room carries (Naesa's lightning chain), the flankers', the boss's. */
function installActorHooks(ctx: EffectContext, arena: ArenaState, a: Actor): void {
  if (anyRule(ctx, arena, 'tide')?.params?.chainAt !== undefined) installHook(a, { kind: 'custom', customId: 'arena-tide-chain' }, a.id)
  const flank = anyRule(ctx, arena, 'flank')
  if (flank && a.monster && (flank.monsters ?? []).includes(a.monster.monsterId)) installHook(a, { kind: 'custom', customId: 'arena-flank' }, a.id)
}

/* ---------- the start ---------- */

/**
 * Builds the arena on a fresh boss fight: the light the room sets, the props, the tide, the candles, phase 1, the
 * Hound at heel, the hooks. Does nothing for a boss without an arena (a plain boss room keeps fight.ts's phases).
 */
export function initArena(ctx: EffectContext, setup: ArenaSetup): void {
  const state = ctx.state
  const boss = byId(state, setup.bossActorId)
  const def = boss?.monster ? ctx.content.monsters.get(boss.monster.monsterId) : undefined
  const block = def?.boss
  if (!boss?.monster || !def || !block?.arena) {
    state.arena = null
    return
  }
  const rules = block.arena.rules
  const ruleOf = (kind: ArenaRuleKind) => rules.find((r) => r.kind === kind)
  const props: ArenaProp[] = []
  const barricade = ruleOf('barricade')
  if (barricade) for (let i = 0; i < (barricade.count ?? 0); i++) props.push({ id: `keg-${i + 1}`, kind: 'keg', name: 'a keg', hitsLeft: barricade.hits ?? 3, done: false })
  const piles = ruleOf('piles')
  if (piles) for (let i = 0; i < (piles.count ?? 0); i++) props.push({ id: `pile-${i + 1}`, kind: 'pile', name: 'a bone pile', hitsLeft: piles.hits ?? 3, done: false })
  const tideRule = ruleOf('tide')
  if (tideRule?.attribute) props.push({ id: 'sluice', kind: 'sluice', name: 'the sluice wheel', hitsLeft: 0, done: false })
  const braziers = ruleOf('braziers')
  if (braziers) for (let i = 0; i < (braziers.count ?? 0); i++) props.push({ id: `brazier-${i + 1}`, kind: 'brazier', name: 'a brazier', hitsLeft: 0, done: false })
  const candles = ruleOf('candles')
  const hasWater = tideRule !== undefined || block.phases.some((p) => p.tide !== undefined)
  const arena: ArenaState = {
    bossId: def.id,
    bossActorId: boss.id,
    templateId: setup.templateId ?? block.arena.room,
    phase: 1,
    phaseStartRound: state.round,
    lightSet: setup.light ?? state.light,
    meleeBlocked: [],
    barricade: barricade !== undefined,
    candles: candles ? { lit: candles.count ?? 12, of: candles.count ?? 12 } : null,
    doorsOpen: false,
    tide: hasWater ? { level: 0, max: tideRule?.max ?? 4, nextRound: tideRule ? state.round + (tideRule.every ?? 3) - 1 : null, stopped: false } : null,
    props,
    tells: [],
    hintsShown: [],
    fallen: [],
    struckBy: [],
    oathHolderId: null,
    hunterWaves: 0,
    partsBroken: [],
    hits: [],
    swapped: [],
    rows: {},
    flags: { partySize: setup.partySize, enemyHpPercent: setup.enemyHpPercent, huntersKilled: setup.huntersKilled.join(',') },
    stats: { ...EMPTY_STATS, lightMin: state.light },
  }
  state.arena = arena
  for (const a of state.actors) {
    arena.rows[a.id] = a.row
    if (a.side === 'enemy' && a.id !== boss.id) arena.flags[`group:${a.id}`] = 'start'
    installActorHooks(ctx, arena, a)
  }
  installHook(boss, { kind: 'custom', customId: 'arena-boss' }, boss.id)
  if (setup.light !== null) setLight(ctx, arena, setup.light, 'arena')
  beginPhase(ctx, arena, boss, 0)
  // The Warden's Hound at heel (07 §2.8): unless the party killed it this delve, at 60% HP.
  for (const heel of rulesOf(ctx, arena, 'heel')) {
    for (const id of heel.monsters ?? []) {
      if (setup.huntersKilled.includes(id)) continue
      const hd = ctx.content.monsters.get(id)
      if (!hd) continue
      const a = spawnOne(ctx, arena, hd, (str(heel, 'row', 'front') as FightRow) ?? 'front', { group: 'heel', level: boss.level + (ctx.t.arena?.hunters.levelOffset.value ?? 0) })
      // 07 §2.8: 'a second actor at 60% HP' — wounded, not smaller.
      a.hp = Math.max(1, roundHalfUp((a.maxHp * num(heel, 'hpPercent', 60)) / 100))
      a.energy = boss.energy
      logArena(ctx, arena, 'recall', `${a.name} stands at heel`, { actorId: boss.id, data: { cause: 'heel', monsters: id, count: 1 } })
    }
  }
  refreshReach(ctx, arena)
}

/* ---------- phases (06 §3; 07 §2.8) ---------- */

function brokenPartEffects(ctx: EffectContext, arena: ArenaState): BossPartDef[] {
  return (bossBlock(ctx, arena)?.parts ?? []).filter((p) => arena.partsBroken.includes(p.id))
}

/** The attack ids a phase allows once broken parts and the frenzy have taken theirs. */
function phaseAttackIds(ctx: EffectContext, arena: ArenaState, ids: readonly string[]): string[] {
  const removed = new Set<string>()
  for (const p of brokenPartEffects(ctx, arena)) for (const id of p.effect.removeAttacks ?? []) removed.add(id)
  if (arena.flags.frenzy === true) for (const r of rulesOf(ctx, arena, 'frenzy')) for (const id of r.attacks ?? []) removed.add(id)
  const left = ids.filter((id) => !removed.has(id))
  return left.length > 0 ? left : [...ids]
}

/** Applies phase `index` (0-based) to the boss: attacks, speed, row, size, immunities, hooks, light, water, adds, opener. */
function beginPhase(ctx: EffectContext, arena: ArenaState, boss: Actor, index: number): void {
  const m = boss.monster
  const block = bossBlock(ctx, arena)
  const phase = block?.phases[index]
  if (!m || !block || !phase) return
  m.phaseIndex = index
  m.attackIds = phaseAttackIds(ctx, arena, phase.attacks)
  arena.phase = index + 1
  arena.phaseStartRound = ctx.state.round
  // Tells of the last phase's clocks lapse; braziers can be relit once more each (06 §3.4: once per brazier per phase).
  if (index > 0) arena.tells = []
  for (const p of arena.props) if (p.kind === 'brazier') p.done = false
  if (phase.speed !== undefined) boss.base = { ...boss.base, speed: phase.speed }
  if (phase.size !== undefined) m.size = phase.size
  if (phase.row !== undefined && boss.row !== phase.row) boss.row = phase.row
  for (const s of phase.statusImmune ?? []) if (!m.statusImmune.includes(s)) m.statusImmune.push(s)
  for (const line of phase.hooks ?? []) installHook(boss, line, boss.id)
  if (phase.opener && m.attacks.some((a) => a.id === phase.opener)) arena.flags.opener = phase.opener
  logArena(ctx, arena, 'phase', `${boss.name}: ${phase.name ?? `phase ${index + 1}`}`, { actorId: boss.id, amount: index + 1, data: { phase: index + 1, phases: block.phases.length, name: phase.name ?? null, speed: phase.speed ?? null } })
  if (index > 0) {
    if (phase.light) {
      const stopped = brokenPartEffects(ctx, arena).some((p) => p.effect.stopLight)
      if (phase.light.set !== undefined) setLight(ctx, arena, phase.light.set, 'phase', boss.id)
      else if (phase.light.add !== undefined && !(stopped && phase.light.add < 0)) setLight(ctx, arena, ctx.state.light + phase.light.add, 'phase', boss.id)
    }
    if (phase.adds.length > 0) spawnAdds(ctx, arena, phase.adds, 'phase', { group: `phase-${index + 1}` })
  }
  if (phase.tide !== undefined && arena.tide) {
    const from = arena.tide.level
    const to = Math.min(arena.tide.max, Math.max(from, phase.tide))
    const rule = anyRule(ctx, arena, 'tide')
    if (rule) arena.tide.nextRound = ctx.state.round + tideEvery(ctx, arena, rule)
    if (to !== from) setTide(ctx, arena, to, 'phase', boss.id)
  }
  // The Warden's doors open with his phase 2 if the candles have not opened them (07 §2.8).
  for (const c of rulesOf(ctx, arena, 'candles', index + 1)) if (!arena.doorsOpen && index + 1 >= num(c, 'doorsAtPhase', 99)) openDoors(ctx, arena, c)
  if (index > 0) phaseStartTells(ctx, arena, boss)
}

/**
 * A phase begins mid-round, so its first round start never comes: a clock of 2 rounds (the throne's pulls in phase 3)
 * shows its tell now, for the blow at the phase's second round (07 §2.8: the cue one turn before).
 */
function phaseStartTells(ctx: EffectContext, arena: ArenaState, boss: Actor): void {
  const round = ctx.state.round
  const due = (every: number | undefined) => {
    const n = Math.max(1, every ?? 3)
    return n > 1 && 2 % n === 0
  }
  for (const rule of rulesOf(ctx, arena, 'pull')) {
    if (arena.tide?.stopped) continue
    const fast = rule.fastEvery !== undefined && rule.fastFromPhase !== undefined && arena.phase >= rule.fastFromPhase
    if (due(fast ? rule.fastEvery : rule.every)) {
      arena.swapped = []
      arenaTell(ctx, arena, rule.tell, boss.id, null, round + 1)
    }
  }
  for (const rule of [...rulesOf(ctx, arena, 'pulse'), ...rulesOf(ctx, arena, 'lightsOut')]) if (due(rule.every)) arenaTell(ctx, arena, rule.tell, boss.id, null, round + 1)
  for (const rule of rulesOf(ctx, arena, 'hunters')) {
    const id = (rule.monsters ?? [])[arena.hunterWaves]
    if ((rule.rounds ?? [2])[arena.hunterWaves] === 1 && id && !killedThisDelve(arena, id)) arenaTell(ctx, arena, rule.tell, boss.id, null, round + 1)
  }
}

/** Every phase threshold the boss's HP has crossed, in order (06 §3: 100 → 50, 100 → 60 → 25). */
function checkPhases(ctx: EffectContext, arena: ArenaState): void {
  const boss = bossActor(ctx, arena)
  const m = boss?.monster
  const block = bossBlock(ctx, arena)
  if (!boss || !m || !block || boss.gone) return
  let guard = 0
  while (guard++ < 4) {
    const next = block.phases[m.phaseIndex + 1]
    if (!next) return
    if ((boss.hp * 100) / Math.max(1, boss.maxHp) > next.atHpPercent) return
    beginPhase(ctx, arena, boss, m.phaseIndex + 1)
  }
}

/* ---------- parts (06 §3 part-breaks) ---------- */

function breakPartOf(ctx: EffectContext, arena: ArenaState, boss: Actor, part: BossPartDef, attackerId: string | null): void {
  arena.partsBroken.push(part.id)
  logArena(ctx, arena, 'partBreak', `${boss.name}'s ${part.name} breaks`, { actorId: attackerId ?? undefined, targetId: boss.id, data: { part: part.id, name: part.name } })
  const m = boss.monster
  if (!m) return
  const e = part.effect
  if (e.removeAttacks?.length) {
    m.attackIds = m.attackIds.filter((id) => !e.removeAttacks!.includes(id))
    if (m.windup && e.removeAttacks.includes(m.windup.attackId)) m.windup = null
    if (typeof arena.flags.opener === 'string' && e.removeAttacks.includes(arena.flags.opener)) delete arena.flags.opener
  }
  if (e.attackMultiplier) m.attacks = m.attacks.map((a) => (e.attackMultiplier![a.id] !== undefined ? { ...a, multiplier: e.attackMultiplier![a.id]! } : a))
  if (e.removeStatuses) m.attacks = m.attacks.map((a) => (e.removeStatuses![a.id] ? { ...a, effects: a.effects.filter((l) => !(l.kind === 'applyStatus' && l.status && e.removeStatuses![a.id]!.includes(l.status))) } : a))
  if (e.stopTide && arena.tide) {
    arena.tide.stopped = true
    arena.tells = arena.tells.filter((t) => !(anyRule(ctx, arena, 'pull')?.tell === t.id || anyRule(ctx, arena, 'tide')?.tell === t.id))
  }
  if (e.line) {
    const source: LineSource = { kind: 'trait', id: 'part-break', label: `${part.name} breaks`, isUltimate: false, neverMisses: true, effectPercent: 100, reach: false, ranged: false, isMelee: false }
    applyLine(ctx, boss, e.line, 'self', boss, source)
  }
}

/** The blows effects.ts queued on the boss: the Warden's Oath and the boss's parts. */
function processHits(ctx: EffectContext, arena: ArenaState): void {
  if (arena.hits.length === 0) return
  const hits = arena.hits
  arena.hits = []
  const boss = bossActor(ctx, arena)
  if (!boss) return
  const oath = rulesOf(ctx, arena, 'oath')[0]
  for (const hit of hits) {
    const attacker = byId(ctx.state, hit.attackerId)
    if (oath && attacker?.side === 'party' && attacker.kind === 'hero') {
      if (!arena.struckBy.includes(attacker.id)) arena.struckBy.push(attacker.id)
      const holder = byId(ctx.state, arena.oathHolderId)
      const held = holder !== null && isActive(holder) && holder.statuses.some((s) => s.id === (oath.status ?? 'mark') && s.sourceId === boss.id)
      if (!held || holder?.id === attacker.id) {
        if (arena.oathHolderId !== attacker.id) logArena(ctx, arena, 'oath', `${attacker.name} holds the Warden's attention`, { actorId: boss.id, targetId: attacker.id, data: { holder: attacker.id } })
        arena.oathHolderId = attacker.id
        applyStatus(ctx.content, ctx.t, ctx.rng, attacker, { status: oath.status ?? 'mark', duration: oath.duration ?? 3, sourceId: boss.id, fresh: ctx.state.actingId === attacker.id })
      }
    }
    for (const part of bossBlock(ctx, arena)?.parts ?? []) {
      if (arena.partsBroken.includes(part.id) || (part.fromPhase ?? 1) > arena.phase) continue
      if (hit.dealt * 100 < boss.maxHp * part.hpPercent) continue
      if (part.damageTypes.length > 0 && !part.damageTypes.includes(hit.damageType as never)) continue
      if (part.crit && !hit.crit) continue
      breakPartOf(ctx, arena, boss, part, hit.attackerId)
    }
  }
}

/* ---------- the water (07 §2.8: Naesa's tide; the throne) ---------- */

function tideEvery(ctx: EffectContext, arena: ArenaState, rule: ArenaRuleDef): number {
  const boss = bossActor(ctx, arena)
  const fast = rule.fastEvery !== undefined && rule.fastBelowHpPercent !== undefined && boss !== null && hpPercent(boss) < rule.fastBelowHpPercent
  return Math.max(1, fast ? rule.fastEvery! : (rule.every ?? 3))
}

function setTide(ctx: EffectContext, arena: ArenaState, to: number, cause: string, actorId: string | null): void {
  const tide = arena.tide
  if (!tide) return
  const from = tide.level
  tide.level = clamp(to, 0, tide.max)
  arena.stats.tideMax = Math.max(arena.stats.tideMax, tide.level)
  logArena(ctx, arena, 'tide', tide.level > from ? `The water rises to step ${tide.level}` : tide.level < from ? `The water drops to step ${tide.level}` : `The water holds at step ${tide.level}`, { actorId: actorId ?? undefined, amount: tide.level, data: { from, to: tide.level, cause } })
  const rule = anyRule(ctx, arena, 'tide')
  if (rule && tide.level > from && tide.level >= num(rule, 'deepAt', 99)) deepRise(ctx, arena, rule)
}

/** Step 4 (07 §2.8): the Deep Tentacles rise and Grab a front-row hero each until freed. */
function deepRise(ctx: EffectContext, arena: ArenaState, rule: ArenaRuleDef): void {
  const adds = rule.adds ?? []
  const want = adds.reduce((s, a) => s + a.count, 0)
  const living = ctx.state.actors.filter((a) => a.side === 'enemy' && isActive(a) && groupOf(arena, a.id) === 'deep').length
  const room = Math.max(0, want - living)
  if (room === 0 || adds.length === 0) return
  const first = adds[0]!
  const spawned = spawnAdds(ctx, arena, [{ ...first, count: room }], 'deep', { group: 'deep', scaleCount: false })
  const free = ctx.state.actors.filter((h) => h.side === 'party' && h.kind === 'hero' && isActive(h) && h.row === 'front' && !h.grabbedBy)
  spawned.forEach((t, i) => {
    const hero = free[i]
    if (hero) grab(ctx, t, hero)
  })
}

function grab(ctx: EffectContext, grabber: Actor, hero: Actor): void {
  const r = applyStatus(ctx.content, ctx.t, ctx.rng, hero, { status: 'grab', sourceId: grabber.id, fresh: ctx.state.actingId === hero.id }, grabber.monster?.size)
  if (r.outcome !== 'applied') return
  hero.grabbedBy = grabber.id
  hero.grabDamage = 0
  log(ctx, { kind: 'status', actorId: grabber.id, targetId: hero.id, text: `${hero.name} is grab`, data: { status: 'grab' } })
}

/** The wade (07 §2.8: from step 2 the back row wades, Slowed). */
function wade(ctx: EffectContext, arena: ArenaState, rule: ArenaRuleDef): void {
  if (!arena.tide || arena.tide.level < num(rule, 'wadeAt', 99)) return
  const status = rule.status ?? 'slow'
  for (const h of ctx.state.actors) {
    if (h.side !== 'party' || !isActive(h) || h.row !== 'back') continue
    const r = applyStatus(ctx.content, ctx.t, ctx.rng, h, { status, duration: rule.duration ?? 1, sourceId: arena.bossActorId })
    if (r.outcome === 'applied') log(ctx, { kind: 'status', targetId: h.id, text: `${h.name} wades (${status})`, data: { status } })
  }
}

/* ---------- the Warden's candles and doors ---------- */

function openDoors(ctx: EffectContext, arena: ArenaState, rule: ArenaRuleDef): void {
  if (arena.doorsOpen) return
  arena.doorsOpen = true
  arena.stats.doorsOpened = true
  logArena(ctx, arena, 'doors', 'The secret doors grind open', { actorId: arena.bossActorId })
  if (rule.adds?.length) spawnAdds(ctx, arena, rule.adds, 'doors', { group: 'doors' })
}

/* ---------- each new round ---------- */

/** Runs the arena's clocks when a new round begins (03 §3.6: a round = every living hero has acted once). */
export function arenaRoundStart(ctx: EffectContext): void {
  const arena = ctx.state.arena
  if (!arena) return
  const boss = bossActor(ctx, arena)
  if (!boss || boss.gone) return
  const round = ctx.state.round
  const k = round - arena.phaseStartRound + 1
  arena.tells = arena.tells.filter((t) => t.firesAtRound >= round)
  const clock = (every: number | undefined): { fires: boolean; tells: boolean } => {
    const n = Math.max(1, every ?? 3)
    return { fires: k >= n && k % n === 0, tells: n > 1 && (k + 1) % n === 0 }
  }

  // The Warden's candles: one goes out each round; at the sixth his lantern greens, and the doors open next round.
  for (const rule of rulesOf(ctx, arena, 'candles')) {
    const c = arena.candles
    if (!c) continue
    const doorsAt = num(rule, 'doorsAt', 6)
    if (arena.flags.doorsDue === round) openDoors(ctx, arena, rule)
    if (c.lit > 0) {
      c.lit -= 1
      const out = c.of - c.lit
      arena.stats.candlesOut = out
      logArena(ctx, arena, 'candle', `A candle gutters out (${out} of ${c.of})`, { amount: out, data: { out, of: c.of } })
      if (out === doorsAt && !arena.doorsOpen) {
        arenaTell(ctx, arena, rule.tell, boss.id, null, round + 1)
        arena.flags.doorsDue = round + 1
      }
    }
  }

  // Vexa's crew shoots out a lantern every 3rd round (07 §2.8 "Lights out"); "Lantern targeted" the round before.
  for (const rule of rulesOf(ctx, arena, 'lightsOut')) {
    const crew = ctx.state.actors.some((a) => a.side === 'enemy' && a.id !== boss.id && isActive(a))
    const stopped = brokenPartEffects(ctx, arena).some((p) => p.effect.stopLight)
    if (stopped || (flag(rule, 'requiresCrew') && !crew)) continue
    const c = clock(rule.every)
    if (c.fires && ctx.state.light > 0) {
      arena.stats.lanternsOut += 1
      setLight(ctx, arena, ctx.state.light + (rule.amount ?? -10), 'lantern', null, { lanternsOut: arena.stats.lanternsOut })
    }
    if (c.tells && ctx.state.light > 0) arenaTell(ctx, arena, rule.tell, boss.id, null, round + 1)
  }

  // Naesa's tide (07 §2.8): a step every 3 rounds, every 2 under 20%; the boom the round before; the back row wades.
  for (const rule of rulesOf(ctx, arena, 'tide')) {
    const tide = arena.tide
    if (!tide || tide.stopped) continue
    // Under 20% the clock quickens at once.
    const every = tideEvery(ctx, arena, rule)
    if (tide.nextRound !== null && tide.nextRound > round + every) tide.nextRound = round + every
    if (tide.nextRound !== null && round >= tide.nextRound) {
      if (tide.level < tide.max) setTide(ctx, arena, tide.level + 1, 'rise', boss.id)
      tide.nextRound = round + every
    }
    if (tide.nextRound !== null && tide.nextRound === round + 1 && tide.level < tide.max) arenaTell(ctx, arena, rule.tell, boss.id, null, round + 1)
    wade(ctx, arena, rule)
  }

  // Re-entries (07 §2.8): Vexa's crew rallies every 4 rounds (once each); Naesa's adds return 4 rounds after they fall.
  for (const rule of rulesOf(ctx, arena, 'reenter')) {
    const groups = str(rule, 'groups', 'start').split(',')
    const waiting = arena.fallen.filter((f) => !f.returned && groups.includes(f.group))
    if (rule.afterRounds !== undefined) {
      const due = waiting.filter((f) => round >= f.fellAtRound + rule.afterRounds!)
      if (due.length > 0) reenter(ctx, arena, due, 'return')
      continue
    }
    const c = clock(rule.every)
    if (c.fires && waiting.length > 0) reenter(ctx, arena, waiting, 'rally')
    if (c.tells && waiting.length > 0) arenaTell(ctx, arena, rule.tell, boss.id, null, round + 1)
  }

  // The throne's tide pulls the rows (06 §3.4): every 3 rounds, every 2 from phase 3; "Tide pulling" the round before.
  for (const rule of rulesOf(ctx, arena, 'pull')) {
    if (arena.tide?.stopped) continue
    const fast = rule.fastEvery !== undefined && rule.fastFromPhase !== undefined && arena.phase >= rule.fastFromPhase
    const c = clock(fast ? rule.fastEvery : rule.every)
    if (c.fires) pull(ctx, arena, rule)
    if (c.tells) {
      arena.swapped = []
      arenaTell(ctx, arena, rule.tell, boss.id, null, round + 1)
    }
  }

  // The gallery lamps flare and a Silence pulse hits every caster (06 §3.4 phase 2).
  for (const rule of rulesOf(ctx, arena, 'pulse')) {
    const c = clock(rule.every)
    if (c.fires) {
      const status = rule.status ?? 'silence'
      let n = 0
      for (const h of ctx.state.actors) {
        if (h.side !== 'party' || h.kind !== 'hero' || !isActive(h) || h.poolKind !== 'mana') continue
        const r = applyStatus(ctx.content, ctx.t, ctx.rng, h, { status, duration: rule.duration ?? 1, sourceId: boss.id })
        if (r.outcome === 'applied') {
          n += 1
          log(ctx, { kind: 'status', actorId: boss.id, targetId: h.id, text: `${h.name} is ${status}`, data: { status } })
        }
      }
      logArena(ctx, arena, 'pulse', `The gallery lamps flare: ${n} silenced`, { actorId: boss.id, amount: n, data: { status, count: n } })
    }
    if (c.tells) arenaTell(ctx, arena, rule.tell, boss.id, null, round + 1)
  }

  // The dungeon's hunters return at phase rounds +2, +4, +6 (07 §2.8), never one the party killed this delve.
  for (const rule of rulesOf(ctx, arena, 'hunters')) {
    const since = round - arena.phaseStartRound
    const rounds = rule.rounds ?? [2, 4, 6]
    const wave = rounds.indexOf(since)
    if (wave >= 0 && wave === arena.hunterWaves) hunterReturns(ctx, arena, rule, wave)
    const next = rounds[arena.hunterWaves]
    if (next !== undefined && since + 1 === next) {
      const id = (rule.monsters ?? [])[arena.hunterWaves]
      if (id && !killedThisDelve(arena, id)) arenaTell(ctx, arena, rule.tell, boss.id, null, round + 1)
    }
  }

  // In Radiant light his adds Fear (06 §3.4).
  for (const rule of rulesOf(ctx, arena, 'lightBand')) {
    const status = typeof rule.params?.addsStatus === 'string' ? (rule.params.addsStatus as Status) : null
    if (!status || !(rule.bands ?? []).includes(lightBandId(ctx) as never)) continue
    for (const a of ctx.state.actors) {
      if (a.side !== 'enemy' || a.id === boss.id || !isActive(a)) continue
      const r = applyStatus(ctx.content, ctx.t, ctx.rng, a, { status, duration: 1, sourceId: boss.id })
      if (r.outcome === 'applied') log(ctx, { kind: 'status', targetId: a.id, text: `${a.name} shrinks from the light (${status})`, data: { status } })
    }
  }
}

function killedThisDelve(arena: ArenaState, monsterId: string): boolean {
  return String(arena.flags.huntersKilled ?? '')
    .split(',')
    .includes(monsterId)
}

function hunterReturns(ctx: EffectContext, arena: ArenaState, rule: ArenaRuleDef, wave: number): void {
  arena.hunterWaves = wave + 1
  const id = (rule.monsters ?? [])[wave]
  if (!id) return
  const boss = bossActor(ctx, arena)
  if (killedThisDelve(arena, id)) {
    arena.stats.huntersSkipped += 1
    logArena(ctx, arena, 'hunterReturns', `The ${ctx.content.monsters.get(id)?.name ?? id} does not answer: the party killed it this delve`, { actorId: boss?.id, data: { hunter: id, wave: wave + 1, skipped: true } })
    return
  }
  const def = ctx.content.monsters.get(id)
  if (!def) return
  const level = (boss?.level ?? ctx.state.options.floorLevel) + (ctx.t.arena?.hunters.levelOffset.value ?? 0)
  const a = spawnOne(ctx, arena, def, def.rows[0] ?? 'front', { group: 'hunter', hpPercent: ctx.t.arena?.hunters.hpPercent ?? 100, level })
  arena.stats.huntersReturned += 1
  logArena(ctx, arena, 'hunterReturns', `${a.name} answers the King`, { actorId: boss?.id, targetId: a.id, data: { hunter: id, wave: wave + 1, skipped: false } })
}

function reenter(ctx: EffectContext, arena: ArenaState, list: ArenaState['fallen'], cause: string): void {
  const adds: BossAdd[] = []
  for (const f of list) {
    f.returned = true
    adds.push({ monsterId: f.monsterId, count: 1, row: f.row })
  }
  const hpPct = ctx.t.arena?.adds.reenterHpPercent ?? 100
  spawnAdds(ctx, arena, adds, cause, { group: 'return', hpPercent: hpPct, scaleCount: false })
}

/** The pull (06 §3.4): heroes who swapped rows on the tell are spared; the front is Slowed (his next Blade ×1.5), the back Chilled. */
function pull(ctx: EffectContext, arena: ArenaState, rule: ArenaRuleDef): void {
  let slowed = 0
  let chilled = 0
  let spared = 0
  for (const h of ctx.state.actors) {
    if (h.side !== 'party' || h.kind !== 'hero' || !isActive(h)) continue
    if (arena.swapped.includes(h.id)) {
      spared += 1
      continue
    }
    const front = h.row === 'front'
    const status = (front ? str(rule, 'frontStatus', 'slow') : str(rule, 'backStatus', 'chill')) as Status
    const duration = front ? num(rule, 'frontDuration', 1) : num(rule, 'backDuration', 2)
    const r = applyStatus(ctx.content, ctx.t, ctx.rng, h, { status, duration, sourceId: arena.bossActorId })
    if (r.outcome === 'applied') {
      log(ctx, { kind: 'status', actorId: arena.bossActorId, targetId: h.id, text: `${h.name} is ${status}`, data: { status } })
      if (front) slowed += 1
      else chilled += 1
    }
    if (front) arena.flags[`pulled:${h.id}`] = true
  }
  arena.swapped = []
  arena.stats.pulls += 1
  logArena(ctx, arena, 'pull', `The tide pulls at the rows`, { actorId: arena.bossActorId, data: { slowed, chilled, spared } })
}

/* ---------- each turn ---------- */

/** Whether any living hero can reach past a barricade or a throne: a reach or ranged weapon, spells, a reach skill. */
function partyCanReach(ctx: EffectContext): boolean {
  return ctx.state.actors.some((a) => {
    const h = a.hero
    if (a.side !== 'party' || !h || !isActive(a)) return false
    if (h.weapon.reach || h.weapon.ranged || a.poolKind === 'mana') return true
    return h.actives.some((id) => id !== null && (ctx.content.skills.get(id)?.tags.includes('reach') ?? false))
  })
}

/** Who a non-reach melee blow cannot reach now (07 §2.8): never anyone when nobody in the party could reach past. */
function refreshReach(ctx: EffectContext, arena: ArenaState): void {
  const blocked: string[] = []
  if (partyCanReach(ctx)) {
    const boss = bossActor(ctx, arena)
    if (arena.barricade) for (const a of ctx.state.actors) if (a.side === 'enemy' && a.row === 'back' && isActive(a)) blocked.push(a.id)
    if (boss && rulesOf(ctx, arena, 'outOfReach').length > 0 && !blocked.includes(boss.id)) blocked.push(boss.id)
  }
  arena.meleeBlocked = blocked
}

/** Why a melee blow finds nothing in reach in this arena (the HUD's line), or null when the arena blocks no one. */
export function arenaReachReason(ctx: EffectContext): string | null {
  const arena = ctx.state.arena
  if (!arena || arena.meleeBlocked.length === 0) return null
  if (arena.meleeBlocked.includes(arena.bossActorId) && rulesOf(ctx, arena, 'outOfReach').length > 0) return 'out of melee reach: the throne'
  if (arena.barricade) return 'out of melee reach: the barricade'
  return 'out of melee reach'
}

/** At any actor's turn start: who can be reached, and the frenzy. */
export function arenaTurnStart(ctx: EffectContext, actor: Actor): void {
  const arena = ctx.state.arena
  if (!arena) return
  refreshReach(ctx, arena)
  void actor
}

/**
 * At any actor's turn end (fight.ts endTurn): the queued blows (the Oath, the parts), the phases, the at-HP adds, the
 * frenzy, the fallen adds, the slick floor, the reach.
 */
export function arenaAfterTurn(ctx: EffectContext, actor: Actor): void {
  const arena = ctx.state.arena
  if (!arena) return
  processHits(ctx, arena)
  checkPhases(ctx, arena)
  const boss = bossActor(ctx, arena)
  if (boss && !boss.gone) {
    // At-HP adds (06 §3.4): the King's re-call at 40%, Naesa's shade at 10%.
    for (const [i, rule] of (bossBlock(ctx, arena)?.arena?.rules ?? []).entries()) {
      if (rule.kind !== 'addAt' || arena.flags[`addAt:${i}`] === true) continue
      if (rule.phases && !rule.phases.includes(arena.phase)) continue
      if (hpPercent(boss) > (rule.atHpPercent ?? 0)) continue
      arena.flags[`addAt:${i}`] = true
      const group = str(rule, 'group', `at-${i}`)
      let adds = rule.adds ?? []
      if (flag(rule, 'missingOnly')) {
        const scale = partyScale(ctx.t, Number(arena.flags.partySize ?? 1))
        adds = adds
          .map((a) => {
            const def = ctx.content.monsters.get(a.monsterId)
            const want = def ? scaledCount(a.count, scale.countPercent, def.role) : a.count
            const have = ctx.state.actors.filter((x) => x.side === 'enemy' && isActive(x) && x.monster?.monsterId === a.monsterId && groupOf(arena, x.id) === group).length
            return { ...a, count: Math.max(0, want - have) }
          })
          .filter((a) => a.count > 0)
      }
      const fixed = rule.params?.hp
      spawnAdds(ctx, arena, adds, str(rule, 'cause', 'recall'), { group, scaleCount: !flag(rule, 'missingOnly'), ...(typeof fixed === 'number' ? { fixedHp: fixed } : {}), ...(typeof rule.params?.name === 'string' ? { name: rule.params.name } : {}) })
    }
    // Vexa's last stand (06 §3.1): under 20% she stops flipping and attacks twice per turn.
    for (const rule of rulesOf(ctx, arena, 'frenzy')) {
      if (arena.flags.frenzy === true || hpPercent(boss) >= num(rule, 'belowHpPercent', 20)) continue
      arena.flags.frenzy = true
      const m = boss.monster
      if (m) m.attackIds = phaseAttackIds(ctx, arena, m.attackIds)
      logArena(ctx, arena, 'frenzy', `${boss.name} throws the coin away and attacks twice a turn`, { actorId: boss.id })
    }
  }
  // The fallen adds, for the re-entries.
  for (const a of ctx.state.actors) {
    if (a.side !== 'enemy' || a.id === arena.bossActorId || !a.gone || a.fled || !a.monster) continue
    if (arena.flags[`fell:${a.id}`] === true) continue
    arena.flags[`fell:${a.id}`] = true
    arena.fallen.push({ monsterId: a.monster.monsterId, row: a.row, fellAtRound: ctx.state.round, returned: false, group: groupOf(arena, a.id) })
  }
  // The slick floor (07 §2.8): with a keg spilled, a monster that changes rows slips (Slow 1).
  const slick = arena.props.some((p) => p.kind === 'keg' && p.done)
  const kegRule = anyRule(ctx, arena, 'barricade')
  for (const a of ctx.state.actors) {
    const before = arena.rows[a.id]
    arena.rows[a.id] = a.row
    if (!slick || !kegRule || a.side !== 'enemy' || before === undefined || before === a.row || !isActive(a)) continue
    const status = kegRule.status ?? 'slow'
    const r = applyStatus(ctx.content, ctx.t, ctx.rng, a, { status, duration: kegRule.duration ?? 1, sourceId: null })
    if (r.outcome === 'applied') logArena(ctx, arena, 'slick', `${a.name} slips on the spilled wine`, { targetId: a.id, data: { status } })
  }
  refreshReach(ctx, arena)
  void actor
}

/** A hero's voluntary Swap row (the throne's pull spares those who swap on the tell). */
export function arenaNoteSwap(ctx: EffectContext, actor: Actor): void {
  const arena = ctx.state.arena
  if (!arena || actor.kind !== 'hero' || arena.swapped.includes(actor.id)) return
  arena.swapped.push(actor.id)
}

/** Extra attacks the monster makes this turn (Vexa's frenzy: twice per turn). */
export function arenaExtraActions(ctx: EffectContext, actor: Actor): number {
  const arena = ctx.state.arena
  if (!arena || actor.id !== arena.bossActorId || arena.flags.frenzy !== true) return 0
  const rule = rulesOf(ctx, arena, 'frenzy')[0] ?? anyRule(ctx, arena, 'frenzy')
  return rule ? Math.max(0, num(rule, 'actions', 2) - 1) : 0
}

/** A phase's opener the boss must use now (Vexa's kick), consumed. */
export function takeOpener(ctx: EffectContext, actor: Actor): MonsterAttack | null {
  const arena = ctx.state.arena
  if (!arena || actor.id !== arena.bossActorId || typeof arena.flags.opener !== 'string') return null
  const id = arena.flags.opener
  delete arena.flags.opener
  return actor.monster?.attacks.find((a) => a.id === id) ?? null
}

/** After a monster's attack resolved: the arena's call rules (Toll, Tidal Call, Court Call) and the barricade's kick. */
export function arenaAttackResolved(ctx: EffectContext, actor: Actor, attack: MonsterAttack): void {
  const arena = ctx.state.arena
  if (!arena || actor.id !== arena.bossActorId) return
  const barricade = anyRule(ctx, arena, 'barricade')
  if (barricade && arena.barricade && str(barricade, 'endsWithAttack', '') === attack.id) {
    arena.barricade = false
    logArena(ctx, arena, 'barricade', `${actor.name} kicks the barricade over`, { actorId: actor.id, data: { standing: false } })
    refreshReach(ctx, arena)
  }
  for (const rule of rulesOf(ctx, arena, 'call')) {
    if (rule.attack !== attack.id) continue
    let adds = rule.adds ?? []
    const group = str(rule, 'group', 'call')
    const refill = flag(rule, 'refill')
    // `refill`: the call tops its adds up to the listed count, never past it (a Court Call does not flood the throne).
    if (refill) {
      const scale = partyScale(ctx.t, Number(arena.flags.partySize ?? 1))
      adds = adds
        .map((a) => {
          const def = ctx.content.monsters.get(a.monsterId)
          const want = flag(rule, 'fromPiles') || !def ? a.count : scaledCount(a.count, scale.countPercent, def.role)
          const have = ctx.state.actors.filter((x) => x.side === 'enemy' && isActive(x) && x.monster?.monsterId === a.monsterId && groupOf(arena, x.id) === group).length
          return { ...a, count: Math.max(0, want - have) }
        })
        .filter((a) => a.count > 0)
    }
    if (flag(rule, 'fromPiles')) {
      const live = arena.props.filter((p) => p.kind === 'pile' && !p.done).length
      let left = live
      adds = adds.map((a) => {
        const n = Math.min(a.count, left)
        left -= n
        return { ...a, count: n }
      }).filter((a) => a.count > 0)
      if (live === 0) {
        logArena(ctx, arena, 'recall', `${actor.name} tolls, but every bone pile is ash`, { actorId: actor.id, data: { cause: 'call', monsters: '', count: 0 } })
        continue
      }
    }
    if (adds.length === 0) continue
    const spawned = spawnAdds(ctx, arena, adds, 'call', { group, hpPercent: num(rule, 'hpPercent', 100), scaleCount: !refill && !flag(rule, 'fromPiles') })
    const grabWho = str(rule, 'grab', '')
    if (grabWho && spawned[0]) {
      const heroes = ctx.state.actors.filter((h) => h.side === 'party' && h.kind === 'hero' && isActive(h) && !h.grabbedBy)
      let target: Actor | null = null
      for (const h of heroes) if (!target || h.attributes.strength < target.attributes.strength) target = h
      // 06 §3.3: "Guard that hero" — a hero on guard is not taken.
      if (target && !target.guarding) grab(ctx, spawned[0], target)
    }
  }
}

/* ---------- targeting (the Oath, the light, the flank, the pull) ---------- */

/**
 * The boss's target among `candidates` under the arena's rules, or undefined to leave the choice alone. The Warden's
 * Oath (07 §2.8): he never strikes a hero who has not struck him; the hero whose blow holds his attention is his
 * target, and a Warden-class Taunt is honoured absolutely; with nobody to strike, null (he picks a move that strikes no one).
 */
export function oathTarget(ctx: EffectContext, actor: Actor, candidates: Actor[], preferred: Actor | null): Actor | null | undefined {
  const arena = ctx.state.arena
  if (!arena || actor.id !== arena.bossActorId) return undefined
  const oath = rulesOf(ctx, arena, 'oath')[0]
  if (!oath) return undefined
  const tauntClass = str(oath, 'tauntClass', 'warden')
  const taunter = actor.statuses.find((s) => s.id === 'taunt')
  const t = taunter ? byId(ctx.state, taunter.sourceId) : null
  if (t && isActive(t) && t.hero?.classId === tauntClass) return t
  const struck = candidates.filter((c) => arena.struckBy.includes(c.id))
  if (struck.length === 0) return null
  const holder = struck.find((c) => c.id === arena.oathHolderId)
  if (preferred && struck.includes(preferred)) return preferred
  return holder ?? struck[0]!
}

/** Does this monster's attack reach the back row in the arena now (the King's Gaze in the dark, Vexa's flankers)? */
export function arenaAttackReach(ctx: EffectContext, actor: Actor, attack: MonsterAttack): boolean {
  const arena = ctx.state.arena
  if (!arena || !actor.monster) return false
  const band = lightBandId(ctx)
  for (const rule of rulesOf(ctx, arena, 'lightBand')) {
    if (actor.id !== arena.bossActorId || !flag(rule, 'reachBackRow') || !(rule.bands ?? []).includes(band as never)) continue
    if (!rule.attacks || rule.attacks.includes(attack.id)) return true
  }
  for (const rule of rulesOf(ctx, arena, 'flank')) {
    if ((rule.monsters ?? []).includes(actor.monster.monsterId) && (rule.bands ?? []).includes(band as never)) return true
  }
  return false
}

/** Whether the arena's light sends this attack at the back row by preference (the King's Gaze in Shadowy or darker, the flank). */
export function arenaPrefersBackRow(ctx: EffectContext, actor: Actor, attack: MonsterAttack): boolean {
  return arenaAttackReach(ctx, actor, attack)
}

/* ---------- the heroes' arena actions (07 §2.8) ---------- */

function weaponOrSkillDealsAny(ctx: EffectContext, hero: Actor, types: readonly string[]): boolean {
  const h = hero.hero
  if (!h) return false
  if (types.includes(h.weapon.damageType)) return true
  return h.actives.some((id) => {
    const s = id ? ctx.content.skills.get(id) : undefined
    return s?.effects.some((l) => l.kind === 'damage' && l.damageType !== undefined && types.includes(l.damageType)) ?? false
  })
}

/** Why a hero cannot work a prop now, or null when they can. */
function propBlocker(ctx: EffectContext, arena: ArenaState, hero: Actor, prop: ArenaProp): string | null {
  const h = hero.hero
  if (!h) return 'not a hero'
  switch (prop.kind) {
    case 'keg':
      if (prop.done) return 'already spilled'
      if (!arena.barricade) return 'the barricade is down'
      if (!(h.weapon.ranged || hero.poolKind === 'mana')) return 'needs a bow, a thrown weapon or a spell'
      return null
    case 'pile': {
      if (prop.done) return 'already ash'
      const rule = anyRule(ctx, arena, 'piles')
      const types = rule?.damageTypes ?? ['holy', 'fire']
      if (!weaponOrSkillDealsAny(ctx, hero, types)) return `needs ${types.join(' or ')}`
      return null
    }
    case 'sluice': {
      const rule = anyRule(ctx, arena, 'tide')
      const attr = rule?.attribute ?? 'strength'
      const min = rule?.min ?? 12
      if (!arena.tide || arena.tide.level <= 0) return 'the water is low'
      if (arena.tide.stopped) return 'the tide has stopped'
      if (hero.attributes[attr] < min) return `needs ${attr} ${min}`
      return null
    }
    case 'brazier':
      return 'light it with a Torch (Item)'
  }
}

/** The pending hero's Arena actions for the HUD (07 §2.8): one per kind, its prop the first that can be worked. */
export function arenaLegalActions(ctx: EffectContext, hero: Actor): LegalFightAction[] {
  const arena = ctx.state.arena
  if (!arena || !hero.hero) return []
  const out: LegalFightAction[] = []
  for (const kind of ['keg', 'pile', 'sluice'] as const) {
    const props = arena.props.filter((p) => p.kind === kind)
    if (props.length === 0) continue
    const open = props.find((p) => propBlocker(ctx, arena, hero, p) === null)
    const shown = open ?? props.find((p) => !p.done) ?? props[0]!
    const left = props.filter((p) => !p.done).length
    const label = kind === 'keg' ? `Shoot a keg (${left} left)` : kind === 'pile' ? `Burn a bone pile (${left} left)` : `Turn the sluice wheel (water ${arena.tide?.level ?? 0}/${arena.tide?.max ?? 4})`
    const reason = open ? undefined : (propBlocker(ctx, arena, hero, shown) ?? undefined)
    out.push({ command: { kind: 'arena', propId: shown.id }, label, targets: [], enabled: open !== undefined, ...(reason ? { reason } : {}) })
  }
  return out
}

/** The weight an Arena action costs: an attack's for a keg (the weapon's) or a pile, an Item action's for the wheel. */
export function arenaActionWeight(ctx: EffectContext, hero: Actor, propId: string): number {
  const prop = ctx.state.arena?.props.find((p) => p.id === propId)
  if (prop?.kind === 'sluice') return ctx.t.combat.weights.item
  if (prop?.kind === 'keg') return hero.hero?.weapon.weight ?? ctx.t.combat.weights.normal
  return ctx.t.combat.weights.normal
}

/** Can the hero work this prop now (resolveCommand's check)? */
export function arenaActionProblem(ctx: EffectContext, hero: Actor, propId: string): string | null {
  const arena = ctx.state.arena
  const prop = arena?.props.find((p) => p.id === propId)
  if (!arena || !prop) return 'no such thing here'
  return propBlocker(ctx, arena, hero, prop)
}

/** Works a prop (the caller spends the weight): a keg takes a hit and spills, a pile burns, the wheel lowers the water. */
export function doArenaAction(ctx: EffectContext, hero: Actor, propId: string): void {
  const arena = ctx.state.arena
  const prop = arena?.props.find((p) => p.id === propId)
  if (!arena || !prop) return
  log(ctx, { kind: 'action', actorId: hero.id, text: `${hero.name} works ${prop.name}`, data: { prop: prop.id } })
  switch (prop.kind) {
    case 'keg':
    case 'pile': {
      prop.hitsLeft = Math.max(0, prop.hitsLeft - 1)
      if (prop.hitsLeft === 0) prop.done = true
      const live = arena.props.filter((p) => p.kind === prop.kind && !p.done).length
      const what = prop.kind
      const text = prop.kind === 'keg' ? (prop.done ? `${hero.name} spills a keg: the front floor runs slick` : `${hero.name} holes a keg (${prop.hitsLeft} more)`) : prop.done ? `${hero.name} burns a bone pile to ash (${live} left)` : `${hero.name} scorches a bone pile (${prop.hitsLeft} more)`
      logArena(ctx, arena, what, text, { actorId: hero.id, data: { prop: prop.id, hitsLeft: prop.hitsLeft, done: prop.done, left: live } })
      break
    }
    case 'sluice': {
      if (!arena.tide) break
      arena.stats.sluiceTurns += 1
      arena.flags.sluiceRound = ctx.state.round
      logArena(ctx, arena, 'sluice', `${hero.name} hauls the sluice wheel round`, { actorId: hero.id, data: { from: arena.tide.level, to: Math.max(0, arena.tide.level - 1) } })
      setTide(ctx, arena, arena.tide.level - 1, 'sluice', hero.id)
      break
    }
    case 'brazier':
      break
  }
}

/** True for a consumable that carries light (a Torch: 08 §4, `{ kind: 'light', amount: 25 }`). */
export function isTorch(def: ItemDef | undefined): boolean {
  return def?.consumable?.effects.some((e) => e.kind === 'light') ?? false
}

/** In an arena with braziers: the first not yet lit this phase, or null (06 §3.4: once per brazier per phase). */
export function freeBrazier(ctx: EffectContext): ArenaProp | null {
  return ctx.state.arena?.props.find((p) => p.kind === 'brazier' && !p.done) ?? null
}

/** Whether the arena has braziers (the throne: a Torch works only through one). */
export function hasBraziers(ctx: EffectContext): boolean {
  return ctx.state.arena?.props.some((p) => p.kind === 'brazier') ?? false
}

/**
 * A Torch used as an Item action in an arena (06 §3.4, 07 §2.8): in the throne it relights a brazier (+25, once per
 * brazier per phase) and returns true — the caller skips the Torch's own light line; elsewhere it returns false
 * after noting the Torch, and the caller applies the line (Vexa: "an Item action with a Torch relights (+25)").
 */
export function arenaTorch(ctx: EffectContext, hero: Actor, def: ItemDef): boolean {
  const arena = ctx.state.arena
  if (!arena || !isTorch(def)) return false
  arena.stats.torchesUsed += 1
  if (!hasBraziers(ctx)) {
    arena.flags.torchFrom = ctx.state.light
    return false
  }
  const brazier = freeBrazier(ctx)
  if (!brazier) return true
  const rule = anyRule(ctx, arena, 'braziers')
  brazier.done = true
  arena.stats.braziersLit += 1
  const lit = arena.props.filter((p) => p.kind === 'brazier' && p.done).length
  const of = arena.props.filter((p) => p.kind === 'brazier').length
  // A brazier takes a Torch's worth (07 §6.1's torchValue: Dread +20, the Candle Pact +15), else the rule's +25.
  const to = ctx.state.light + (ctx.state.options.torchValue ?? rule?.amount ?? ctx.t.exploration.light.torch)
  logArena(ctx, arena, 'brazier', `${hero.name} relights a brazier (${lit} of ${of})`, { actorId: hero.id, data: { index: Number(brazier.id.split('-')[1] ?? 1) - 1, lit, of, light: clamp(to, 0, ctx.t.exploration.light.max) } })
  setLight(ctx, arena, to, 'brazier', hero.id)
  return true
}

/** After a Torch's own light line resolved outside the throne: the light event (cause 'torch'). */
export function arenaTorchDone(ctx: EffectContext, hero: Actor): void {
  const arena = ctx.state.arena
  if (!arena || typeof arena.flags.torchFrom !== 'number') return
  const from = arena.flags.torchFrom
  delete arena.flags.torchFrom
  const to = ctx.state.light
  ctx.state.light = from
  setLight(ctx, arena, to, 'torch', hero.id)
}

/* ---------- the scripted heroes' arena habits (03 §3.6) ---------- */

export type ArenaHeroPick = { kind: 'arena'; propId: string } | { kind: 'torch'; instanceId: string } | { kind: 'swapRow' } | null

/** What an auto hero does in the arena before its own rule (tuning `arena.auto`), or null. */
export function arenaHeroAuto(ctx: EffectContext, hero: Actor): ArenaHeroPick {
  const arena = ctx.state.arena
  const h = hero.hero
  if (!arena || !h) return null
  const auto = ctx.t.arena?.auto
  // Swap on the tide (tuning arena.auto.swapOnPull, off: a party that swaps every pull turns its rows inside out): the
  // throne's pull spares a hero who swaps rows on its tell.
  const pullTell = anyRule(ctx, arena, 'pull')?.tell
  if (auto?.swapOnPull.value === true && pullTell && arena.tells.some((t) => t.id === pullTell) && !arena.swapped.includes(hero.id) && !hero.statuses.some((s) => s.id === 'root' || s.id === 'web')) return { kind: 'swapRow' }
  // Relight on the snuff: a Torch into a free brazier unless the throne is Radiant; elsewhere (Vexa's lanterns) a Torch
  // when the light falls below tuning arena.auto.torchBelowLight.
  const torch = h.bag.find((i) => isTorch(ctx.content.items.get(i.itemId)))
  if (torch) {
    if (hasBraziers(ctx)) {
      if (freeBrazier(ctx) && ctx.state.light < (auto?.brazierBelowLight ?? 76)) return { kind: 'torch', instanceId: torch.instanceId }
    } else if (ctx.state.light < (auto?.torchBelowLight ?? 51)) return { kind: 'torch', instanceId: torch.instanceId }
  }
  // The sluice wheel from step 2, once a round.
  const wheel = arena.props.find((p) => p.kind === 'sluice')
  if (wheel && arena.tide && arena.tide.level >= (auto?.sluiceFromTide ?? 2) && arena.flags.sluiceRound !== ctx.state.round && propBlocker(ctx, arena, hero, wheel) === null) return { kind: 'arena', propId: wheel.id }
  // Burn a bone pile while the bell is lifted (the counter to Toll).
  const boss = bossActor(ctx, arena)
  const tolling = boss?.monster?.windup && rulesOf(ctx, arena, 'call').some((r) => r.attack === boss.monster!.windup!.attackId && flag(r, 'fromPiles'))
  if (tolling) {
    const pile = arena.props.find((p) => p.kind === 'pile' && propBlocker(ctx, arena, hero, p) === null)
    if (pile) return { kind: 'arena', propId: pile.id }
  }
  return null
}

/* ---------- the record ---------- */

/** The arena's tally at the fight's end, for DelveState.stats.bossArenas (07 §8.2). */
export function arenaSummary(state: FightState): (ArenaStats & { boss: string; phase: number; lightEnd: number; partsBroken: string }) | null {
  const arena = state.arena
  if (!arena) return null
  return { ...arena.stats, boss: arena.bossId, phase: arena.phase, lightEnd: state.light, partsBroken: arena.partsBroken.join(',') }
}

/** Every ally of the boss still standing (for the HUD and tests). */
export function arenaAdds(state: FightState): Actor[] {
  const arena = state.arena
  if (!arena) return []
  return state.actors.filter((a) => a.side === 'enemy' && a.id !== arena.bossActorId && isActive(a))
}

/** Allies of an actor (re-exported for the hooks' tests). */
export { alliesOf, enemiesOf }
export type { Effect }
