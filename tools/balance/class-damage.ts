/**
 * `node tools/balance/class-damage.ts [--fights 12] [--levels 1,5,8,13] [--json <path>]`
 *
 * The class-damage measure (12 Phase 7; docs/balance/2026-10-27-content-pass-1.md §7 found the Arcanist and the Mender
 * out-damaging the Ranger 2–3× at level 1). One hero of each class, alone and with no pet, at levels 1, 5, 8 and 13,
 * meets the standard encounters of every zone of the dungeon with the monsters at the hero's own level, so each class
 * meets every family's resistances (the Crypts halve Pierce, the Vault halves Frost) and the comparison is level for
 * level. The fights are the sim's own (createFight, applyFightCommand); the decisions are scripted:
 *
 * - **Single-target damage per round** (the class-damage pass's measure): one standard monster of the zone at a time at
 *   its own HP, its damage set to 0, the next stepping in when one dies, for twelve hero turns — what a class does to
 *   one target, DoTs and overkill included. A round here is the timeline's: 10 ticks, one normal (1,000) action of a
 *   Speed-100 actor (03 §3.1), so Speed and light or heavy weights count — a Speed-120 Shade with 800-weight stabs acts
 *   1.5× as often as that, a Speed-80 Warden 0.8×.
 * - **Damage per round, rounds, rounds to kill**: the zone's standard encounters (no Monster rooms, no bosses or
 *   hunters) at the solo scaling the delve uses (`partyScale`), to the end. Rounds are the fight's round count as the
 *   balance runner reads it; damage per round is per hero turn (a solo hero's round).
 * - **Damage per pool point**: damage over the Stamina or Mana the hero's skills cost.
 *
 * The loadout is the class's strongest damage actives the hero could hold at that level (Tier ≤ the open tier, gear
 * requirements met by the default kit, no Ultimate, no technique) plus its cheapest setup skill if it has one (Veil for
 * the Shade's strikes from Veil, a Mark for the Ranger's), at a rank by level (1 + ⌊(L − 1) / 2⌋), with gear by level
 * (F at 1, E at 5, D at 8, C at 13 — the kit's meshes at that grade) and no passives. Each turn the hero opens with the
 * setup when its status is missing, else uses the affordable loadout skill with the most damage on its lines, else a
 * basic attack, on the weakest enemy. In the gauntlet the target takes its turns but does nothing. Deterministic.
 *
 * The balance runner (pass F) imports measureClassDamage, classDamageSpread and classDamageMarkdown; the CLI below runs
 * only when this file is the entry point.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Content } from '../../sim/src/content.ts'
import { encountersFor, isMonsterEncounter, spawnEncounter, spawnSingle } from '../../sim/src/explore.ts'
import { applyFightCommand, createFight, legalFightActions, runFight, skillCost } from '../../sim/src/fight.ts'
import type { Actor, FightCommand, FightState } from '../../sim/src/fight-types.ts'
import { buildHeroActor, createHero, heroAtLevel } from '../../sim/src/hero.ts'
import { createItemInstance } from '../../sim/src/items.ts'
import { partyScale } from '../../sim/src/monsters.ts'
import { actorHands, requirementProblemFor } from '../../sim/src/requirements.ts'
import { Rng } from '../../sim/src/rng.ts'
import { isObtainable, isTechnique } from '../../sim/src/tomes.ts'
import type { DungeonDef, EncounterDef, FloorDef, HeroRecord, ItemInstance, MonsterDef, SkillDef, ZoneDef } from '../../sim/src/types/content.ts'
import type { Grade } from '../../sim/src/types/enums.ts'
import { tierOpenAt } from '../../sim/src/xp.ts'

export interface ClassDamageOptions {
  /** Class ids to measure (every class in the content by default). */
  classIds?: readonly string[]
  /** Hero levels (default 1, 5, 8, 13). */
  levels?: readonly number[]
  /** Fights per class × level × zone, for each of the two measures (default 12). */
  fights?: number
  /** The dungeon whose zones and encounters are met (the first by default). */
  dungeonId?: string
  /** First seed (default 1). */
  seed?: number
  /** Also measure each class's other starter kits (D-099: the Warden's spear, the Blade's greatsword); default true. */
  kits?: boolean
}

export type ClassDamageRole = 'damage' | 'tank' | 'support'

export interface ClassDamageRow {
  classId: string
  /** The starter kit the hero carries (a starterKitOptions id), or null for the class's default kit. */
  kitId: string | null
  /** The row's label: the class id, or "<class>/<kit>" for another starter kit (the spread treats each as a dealer). */
  variant: string
  /** 04 §2: the Warden tanks, the Mender supports; both may sit below the damage dealers. */
  role: ClassDamageRole
  /** The hero's level; the zone's monsters fight at the same level. */
  level: number
  zoneId: string
  /** The zone's first floor (the fights' floor) and the monsters' level (= the hero's). */
  floor: number
  monsterLevel: number
  /** The scripted actives used (skill ids). */
  loadout: string[]
  /** Encounter fights. */
  fights: number
  wins: number
  /** Mean rounds, every encounter fight (the round count the balance runner reads). */
  rounds: number
  /** Mean rounds of the won encounter fights (NaN when none was won). */
  roundsToKill: number
  /** Damage the hero dealt per round (10 timeline ticks of its own actions) in encounter fights: every target, DoTs included. */
  damagePerRound: number
  /** Damage per round (10 timeline ticks) against one target at a time (the gauntlet): the class-damage pass's measure. */
  singleTargetPerRound: number
  /** Damage per hero action in encounter fights. */
  damagePerAction: number
  /** Damage per point of Stamina or Mana the hero's skills cost; null when the hero spent none. */
  damagePerPool: number | null
}

export interface ClassDamageSpreadLine {
  level: number
  /** 'all' for the level's line over every zone (each class's mean across the zones); else one zone. */
  zoneId: string
  maxClass: string
  maxValue: number
  minClass: string
  minValue: number
  /** maxValue ÷ minValue among the damage dealers (single-target damage per round). */
  ratio: number
}

const DEFAULT_LEVELS = [1, 5, 8, 13] as const
const ROLES: Readonly<Record<string, ClassDamageRole>> = { warden: 'tank', mender: 'support' }
/** Gear grade by hero level: F at 1, E at 5, D at 8, C at 13 (the zones' drop bands, 08 §11). */
const GEAR_BY_LEVEL: readonly (readonly [number, Grade])[] = [
  [13, 'C'],
  [8, 'D'],
  [5, 'E'],
  [1, 'F'],
]
/** Hero turns in one single-target gauntlet. */
const GAUNTLET_TURNS = 12
/** A round on the timeline: one normal (1,000) action of a Speed-100 actor (03 §3.1). */
const TICKS_PER_ROUND = 10
const FRONT_CLASSES: ReadonlySet<string> = new Set(['warden', 'blade', 'shade', 'beast-tamer'])

export function roleOf(classId: string): ClassDamageRole {
  return ROLES[classId] ?? 'damage'
}

function gradeForLevel(level: number): Grade {
  for (const [at, grade] of GEAR_BY_LEVEL) if (level >= at) return grade
  return 'F'
}

export function rankForLevel(level: number): number {
  return Math.min(10, 1 + Math.floor((level - 1) / 2))
}

/** The runner's free points: casters to Wisdom and Willpower, skirmishers to Agility and Perception, the rest to Strength, Endurance, Vitality. */
function freePointsFor(content: Content, classId: string): Record<string, number> {
  if (content.classes.get(classId)?.pool === 'mana') return { wisdom: 2, willpower: 2, vitality: 2 }
  if (classId === 'shade' || classId === 'ranger') return { agility: 2, perception: 2, vitality: 2 }
  return { endurance: 2, vitality: 2, strength: 2 }
}

/** Each worn piece swapped for the same mesh at `grade` (the runner's "ground" hero, D-084); sets and uniques left out. */
function regrade(content: Content, rng: Rng, hero: HeroRecord, grade: Grade): HeroRecord {
  if (grade === 'F') return hero
  const up = (inst: ItemInstance | null): ItemInstance | null => {
    if (!inst) return inst
    const mesh = content.items.get(inst.itemId)?.visual.meshId
    const target = [...content.items.values()].find((d) => d.visual.meshId === mesh && d.grade === grade && !d.unique && d.setId === null)
    return target ? createItemInstance(content, rng, target.id) : inst
  }
  const e = hero.equipment
  return { ...hero, equipment: { ...e, mainHand: up(e.mainHand), offHand: up(e.offHand), helmet: up(e.helmet), chest: up(e.chest), legs: up(e.legs), boots: up(e.boots), gloves: up(e.gloves), ring: [up(e.ring[0]), up(e.ring[1])], talisman: up(e.talisman), relic: up(e.relic) } }
}

const EXECUTE_HOOKS: ReadonlySet<string> = new Set(['execute-multiplier', 'execute-multiplier-below-hp'])
const DOT_CONSUMERS: ReadonlySet<string> = new Set(['consume-dot-burst', 'consume-dot-remaining'])

/**
 * A skill's damage on one target, as the scripted policy ranks it: the damage lines' multipliers (every hit); an execute
 * at a quarter of what it adds (it holds for the last part of a target's HP); a burst that consumes a DoT only when the
 * loadout applies one; any other custom line that names a damage type at half; a DoT it applies only as a tie-break
 * (its worth depends on the target living through it); a strike from
 * Veil (veil-strike-bonus) or a sure crit on a Marked target when the loadout's setup provides the status.
 */
export function damageScore(skill: SkillDef, setup: 'veil' | 'mark' | null = null, appliesDot = false): number {
  let score = 0
  let base = 0
  let factor = 1
  for (const line of skill.effects) if (line.kind === 'damage') base = Math.max(base, line.multiplier ?? 1)
  for (const line of skill.effects) {
    if (line.kind === 'damage') score += line.multiplier ?? 1
    else if (line.kind === 'custom' && EXECUTE_HOOKS.has(line.customId ?? '')) score += Math.max(0, (line.multiplier ?? base) - base) / 4
    else if (line.kind === 'custom' && DOT_CONSUMERS.has(line.customId ?? '')) score += appliesDot ? (line.multiplier ?? 1) / 2 : 0
    else if (line.kind === 'custom' && line.customId === 'veil-strike-bonus') factor *= setup === 'veil' ? (1 + (line.percent ?? 0) / 100) * 1.15 : 1
    else if (line.kind === 'custom' && line.customId === 'guaranteed-crit-vs-status') factor *= setup !== null && line.status === setup ? 1.5 : 1
    else if (line.kind === 'custom' && line.damageType && line.multiplier !== undefined) score += line.multiplier / 2
    else if (line.kind === 'applyStatus' && (line.status === 'bleed' || line.status === 'poison' || line.status === 'burn')) score += 0.05
  }
  return score * factor
}

function appliesDot(skill: SkillDef): boolean {
  return skill.effects.some((l) => l.kind === 'applyStatus' && (l.status === 'bleed' || l.status === 'poison' || l.status === 'burn'))
}

/**
 * A setup skill the rotation opens with: a self-cast that puts the hero in Veil (the Shade's strikes from Veil) or a
 * damage-free cast that Marks the target (the Ranger's Hunter's Mark: +20% damage taken, Deadeye's sure crit).
 */
export function setupKind(skill: SkillDef): 'veil' | 'mark' | null {
  if (damageScore(skill) > 0) return null
  if (skill.target === 'self' && skill.effects.some((e) => e.kind === 'applyStatus' && e.status === 'veil')) return 'veil'
  if ((skill.target === 'enemy' || skill.target === 'enemyFront') && skill.effects.some((e) => e.kind === 'applyStatus' && e.status === 'mark')) return 'mark'
  return null
}

function byId(a: SkillDef, b: SkillDef): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** The loadout a hero could hold at `level` with the kit in hand: its strongest damage actives, and its cheapest setup skill when it has one. */
function loadoutFor(content: Content, hero: HeroRecord, level: number): string[] {
  const t = content.tuning
  const open = tierOpenAt(t, level)
  const probe = buildHeroActor(content, t, hero, { id: 'probe', row: 'front' })
  const hands = probe.hero ? actorHands(probe.hero) : null
  const usable = (content.skillsByClass.get(hero.classId) ?? []).filter((s) => s.type === 'active' && !s.isUltimate && s.tier <= open && isObtainable(t, s) && !isTechnique(s) && (!hands || requirementProblemFor(s, hands) === null))
  // The setup that pays: Veil only when a strike gains from it, a Mark always (+20% damage taken, 03 §3.5).
  const gains = (kind: 'veil' | 'mark'): boolean => kind === 'mark' || usable.some((s) => damageScore(s, kind) > damageScore(s))
  const setupSkill = usable.filter((s) => setupKind(s) !== null && gains(setupKind(s)!)).sort((a, b) => a.cost - b.cost || byId(a, b))[0]
  const setup = setupSkill ? setupKind(setupSkill) : null
  const dot = usable.some((s) => damageScore(s) > 0 && appliesDot(s))
  const damage = usable
    .filter((s) => damageScore(s, setup, dot) > 0)
    .sort((a, b) => damageScore(b, setup, dot) - damageScore(a, setup, dot) || a.cost - b.cost || byId(a, b))
    .slice(0, setupSkill ? 3 : 4)
  return [...damage, ...(setupSkill ? [setupSkill] : [])].map((s) => s.id)
}

/** The hero the measure fights with: created, levelled, geared, given its loadout at the level's rank, no passives. */
export function measureHero(content: Content, classId: string, level: number, seed: number, kitId: string | null = null): HeroRecord {
  const t = content.tuning
  let hero = createHero(content, t, Rng.fromSeed(seed), { id: `cd-${classId}`, name: classId, speciesId: 'human', classId, freePoints: freePointsFor(content, classId), eggPetId: null, ...(kitId ? { starterKitId: kitId } : {}) })
  if (level > 1) hero = heroAtLevel(content, t, hero, level)
  hero = regrade(content, Rng.fromSeed(seed + 7), hero, gradeForLevel(level))
  const loadout = loadoutFor(content, hero, level)
  const rank = rankForLevel(level)
  const known = new Map(hero.skills.map((k) => [k.skillId, k]))
  for (const id of loadout) known.set(id, { skillId: id, rank, xp: 0 })
  const skills = [...known.values()].map((k) => ({ ...k, rank: Math.max(k.rank, rank) }))
  return { ...hero, skills, loadout: { ...hero.loadout, actives: [loadout[0] ?? null, loadout[1] ?? null, loadout[2] ?? null, loadout[3] ?? null], passives: [null, null] } }
}

/**
 * The scripted choice: the setup skill when its status is missing (Veil on the hero, Mark on the target) and the target
 * has more than one blow left in it, else the affordable loadout skill with the most damage, else a basic attack — always
 * on the weakest enemy.
 */
function choose(content: Content, state: FightState, hero: Actor): { command: FightCommand; cost: number } {
  const t = content.tuning
  const legal = legalFightActions(content, t, state)
  const weakest = (ids: readonly string[]): string | null => {
    let best: Actor | null = null
    for (const id of ids) {
      const a = state.actors.find((x) => x.id === id)
      if (a && (!best || a.hp < best.hp)) best = a
    }
    return best?.id ?? ids[0] ?? null
  }
  const has = (a: Actor | undefined, status: string): boolean => (a?.statuses ?? []).some((x) => x.id === status)
  for (const l of legal) {
    if (!l.enabled || l.command.kind !== 'skill') continue
    const id = hero.hero?.actives[l.command.slot]
    const skill = id ? content.skills.get(id) : undefined
    const kind = skill ? setupKind(skill) : null
    if (!skill || !kind) continue
    const cost = skillCost(t, skill, hero.hero?.ranks[skill.id] ?? 1)
    if (kind === 'veil' && !has(hero, 'veil')) return { command: { kind: 'skill', slot: l.command.slot, targetId: null }, cost }
    if (kind === 'mark') {
      const targetId = weakest(l.targets)
      const target = state.actors.find((a) => a.id === targetId)
      if (target && !has(target, 'mark') && target.hp * 3 > target.maxHp) return { command: { kind: 'skill', slot: l.command.slot, targetId }, cost }
    }
  }
  const loadout = (hero.hero?.actives ?? []).map((id) => (id ? content.skills.get(id) : undefined)).filter((x): x is SkillDef => x !== undefined)
  const setup = loadout.map((sk) => setupKind(sk)).find((k) => k !== null) ?? null
  const dot = loadout.some((sk) => damageScore(sk) > 0 && appliesDot(sk))
  let pick: { command: FightCommand; cost: number; score: number } | null = null
  for (const l of legal) {
    if (!l.enabled || l.command.kind !== 'skill') continue
    const id = hero.hero?.actives[l.command.slot]
    const skill = id ? content.skills.get(id) : undefined
    if (!skill || setupKind(skill)) continue
    const score = damageScore(skill, setup, dot)
    const cost = skillCost(t, skill, hero.hero?.ranks[skill.id] ?? 1)
    if (!pick || score > pick.score || (score === pick.score && cost < pick.cost)) {
      const target = l.targets.length ? weakest(l.targets) : l.command.targetId
      pick = { command: { kind: 'skill', slot: l.command.slot, targetId: target }, cost, score }
    }
  }
  if (pick) return { command: pick.command, cost: pick.cost }
  const basic = legal.find((l) => l.enabled && l.command.kind === 'basic')
  if (basic) return { command: { kind: 'basic', targetId: weakest(basic.targets) ?? '' }, cost: 0 }
  return { command: { kind: 'guard' }, cost: 0 }
}

interface FightTally {
  won: boolean
  /** The fight's length as the balance runner counts it (the round number at the end). */
  rounds: number
  /** The hero's turns, lost ones included: a solo hero's rounds. */
  turns: number
  /** Timeline ticks the fight ran (03 §3.1: Speed per tick, act at 1,000). */
  ticks: number
  /** The hero's actions' time on the timeline, in rounds of 10 ticks (weight ÷ (10 × Speed) each). */
  time: number
  /** Damage the hero dealt, DoT ticks and overkill included (the hit's real size). */
  damage: number
  actions: number
  poolSpent: number
  /** The hero's pool at the end, percent of max (a gauntlet carries it into the next duel). */
  poolPercentAfter: number
}

/** The weight a command pays on the timeline (03 §3.1): the skill's, the weapon's for a basic attack, Guard's 600. */
function commandWeight(content: Content, hero: Actor, command: FightCommand): number {
  const w = content.tuning.combat.weights
  if (command.kind === 'skill') {
    const id = hero.hero?.actives[command.slot]
    return (id ? content.skills.get(id)?.weight : null) ?? w.normal
  }
  if (command.kind === 'basic') return hero.hero?.weapon.weight ?? w.normal
  if (command.kind === 'guard') return w.guard
  return w.normal
}

/**
 * Plays one fight to its end (or `turnLimit` hero turns) with the scripted hero. Its time on the timeline is counted
 * per action — the action's weight at the hero's Speed, in rounds of 10 ticks (a Speed-100 hero's normal action is one
 * round; a lost turn costs a normal one) — so the waits before a fight's first action (initiative) never count.
 */
function playFight(content: Content, state: FightState, heroId: string, turnLimit: number): FightTally {
  const t = content.tuning
  let actions = 0
  let poolSpent = 0
  let guard = 0
  let time = 0
  const lostTurns = (): number => state.log.filter((e) => e.actorId === heroId && (e.kind === 'skip' || e.kind === 'held')).length
  runFight(content, t, state)
  while (!state.over && state.pendingActorId && actions + lostTurns() < turnLimit && guard++ < 2000) {
    const hero = state.actors.find((a) => a.id === heroId)
    if (!hero) break
    const { command, cost } = choose(content, state, hero)
    actions++
    poolSpent += cost
    time += commandWeight(content, hero, command) / (TICKS_PER_ROUND * Math.max(1, hero.base.speed))
    applyFightCommand(content, t, state, command)
  }
  const hero = state.actors.find((a) => a.id === heroId)
  const speed = Math.max(1, hero?.base.speed ?? 100)
  time += (lostTurns() * t.combat.weights.normal) / (TICKS_PER_ROUND * speed)
  const poolPercentAfter = hero && hero.poolMax > 0 ? Math.max(1, Math.floor((hero.pool * 100) / hero.poolMax)) : 100
  return { won: state.over?.outcome === 'victory', rounds: Math.max(1, state.round), turns: Math.max(1, actions + lostTurns()), ticks: Math.max(1, state.tick), time: Math.max(0.01, time), damage: hero?.tally.damageDealt ?? 0, actions, poolSpent, poolPercentAfter }
}

interface ZoneTargets {
  zone: ZoneDef
  floor: FloorDef
  encounters: EncounterDef[]
  monsters: MonsterDef[]
}

/** A zone's standard encounters (no Monster rooms) over all its floors, and the regular monsters in them (no bosses, hunters or Monsters). */
function zoneTargets(content: Content, dungeon: DungeonDef, zone: ZoneDef): ZoneTargets | null {
  const floors = dungeon.floors.filter((f) => f.floor >= zone.floors.from && f.floor <= zone.floors.to).sort((a, b) => a.floor - b.floor)
  const first = floors[0]
  if (!first) return null
  const byId = new Map<string, EncounterDef>()
  for (const f of floors) for (const e of encountersFor(content, f, dungeon.id)) if (!isMonsterEncounter(content, e)) byId.set(e.id, e)
  const encounters = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const ids = new Set<string>()
  for (const e of encounters) for (const slot of e.composition) ids.add(slot.monsterId)
  const monsters = [...ids]
    .sort()
    .map((id) => content.monsters.get(id))
    .filter((m): m is MonsterDef => m !== undefined && m.role !== 'boss' && m.role !== 'hunter' && m.role !== 'monster')
  return encounters.length > 0 && monsters.length > 0 ? { zone, floor: first, encounters, monsters } : null
}

/**
 * The single-target measure: one standard monster at a time at its own HP (its damage set to 0), the next stepping in
 * when one dies, for `turns` hero turns; the pool carries from one duel to the next as it would in a pack fought one
 * at a time. Overkill counts (it is the hit's size), %-of-max-HP effects meet real HP, executes meet real thresholds.
 */
function gauntlet(content: Content, hero: HeroRecord, row: 'front' | 'back', where: ZoneTargets, level: number, dungeonId: string, seed: number, turns: number): FightTally {
  const t = content.tuning
  const total: FightTally = { won: true, rounds: 0, turns: 0, ticks: 0, time: 0, damage: 0, actions: 0, poolSpent: 0, poolPercentAfter: 100 }
  const monsters = where.monsters
  let k = 0
  while (total.turns < turns && k < 64) {
    const def = monsters[(seed + k) % monsters.length]!
    const rng = Rng.fromSeed(seed * 31 + k)
    const dummy = spawnSingle(content, t, def, { id: `${def.id}-${k}`, level, partySize: 1, enemyHpPercent: 100, row: def.rows.includes('front') ? 'front' : 'back' })
    // The target takes its turns (its DoTs tick at its turn start, 03 §3.5) but does nothing: no attacks, no flight.
    if (dummy.monster) {
      dummy.monster.attacks = []
      dummy.monster.attackIds = []
      dummy.monster.behavior = []
      dummy.monster.fleesAtPercent = 0
    }
    const heroActor = buildHeroActor(content, t, hero, { id: 'hero-0', row, poolPercent: total.poolPercentAfter })
    const state = createFight(content, t, { heroes: [heroActor], pets: [], monsters: [dummy], surprised: null, light: t.exploration.light.start, options: { dungeonId, floor: where.floor.floor, floorLevel: level, enemyDamagePercent: 0, autoHeroes: false }, rng: rng.fork('duel') })
    const f = playFight(content, state, 'hero-0', turns - total.turns)
    total.turns += f.turns
    total.ticks += f.ticks
    total.time += f.time
    total.rounds += f.rounds
    total.damage += f.damage
    total.actions += f.actions
    total.poolSpent += f.poolSpent
    total.poolPercentAfter = f.poolPercentAfter
    k++
  }
  return total
}

function mean(xs: readonly number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Number.NaN
}

/** Runs the measure; one row per class × level × zone. */
export function measureClassDamage(content: Content, opts: ClassDamageOptions = {}): ClassDamageRow[] {
  const t = content.tuning
  const dungeon = opts.dungeonId ? content.dungeons.get(opts.dungeonId) : [...content.dungeons.values()][0]
  if (!dungeon) throw new Error('class-damage: no dungeon')
  const classIds = opts.classIds ?? [...content.classes.keys()].sort()
  const levels = opts.levels ?? DEFAULT_LEVELS
  const fights = Math.max(1, opts.fights ?? 12)
  const seed0 = opts.seed ?? 1
  const zones = dungeon.zones.map((z) => zoneTargets(content, dungeon, z)).filter((z): z is ZoneTargets => z !== null)
  const solo = partyScale(t, 1)
  const rows: ClassDamageRow[] = []
  const variants: { classId: string; kitId: string | null }[] = []
  for (const classId of classIds) {
    variants.push({ classId, kitId: null })
    if (opts.kits ?? true) for (const k of content.classes.get(classId)?.starterKitOptions ?? []) variants.push({ classId, kitId: k.id })
  }
  for (const [ci, { classId, kitId }] of variants.entries()) {
    for (const level of levels) {
      const hero = measureHero(content, classId, level, seed0 * 1009 + ci * 31 + level, kitId)
      const row = FRONT_CLASSES.has(classId) ? 'front' : 'back'
      for (const [zi, where] of zones.entries()) {
        const enc: FightTally[] = []
        const duel: FightTally[] = []
        for (let i = 0; i < fights; i++) {
          const seed = seed0 * 7919 + ci * 104_729 + level * 1_000 + zi * 100 + i
          // Encounter fights: the zone's standard packs at the hero's level and the solo scaling, to the end.
          const e = where.encounters[i % where.encounters.length]!
          const rng = Rng.fromSeed(seed)
          const monsters = spawnEncounter(content, t, rng, e, { level, partySize: 1, enemyHpPercent: 100, enemyCountPercent: 100, championAffixIds: [] })
          const heroActor = buildHeroActor(content, t, hero, { id: 'hero-0', row })
          const state = createFight(content, t, { heroes: [heroActor], pets: [], monsters, surprised: null, light: t.exploration.light.start, options: { dungeonId: dungeon.id, floor: where.floor.floor, floorLevel: level, enemyDamagePercent: solo.damagePercent, autoHeroes: false }, rng: rng.fork('fight') })
          enc.push(playFight(content, state, 'hero-0', t.combat.rounds.hardCap * 2))
          // The single-target gauntlet.
          duel.push(gauntlet(content, hero, row, where, level, dungeon.id, seed + 500_000, GAUNTLET_TURNS))
        }
        const won = enc.filter((f) => f.won)
        const damage = enc.reduce((s, f) => s + f.damage, 0)
        const time = enc.reduce((s, f) => s + f.time, 0)
        const actions = enc.reduce((s, f) => s + f.actions, 0)
        const pool = enc.reduce((s, f) => s + f.poolSpent, 0)
        const duelDamage = duel.reduce((s, f) => s + f.damage, 0)
        const duelTime = duel.reduce((s, f) => s + f.time, 0)
        rows.push({
          classId,
          kitId,
          variant: kitId ? `${classId}/${kitId}` : classId,
          role: roleOf(classId),
          level,
          zoneId: where.zone.id,
          floor: where.floor.floor,
          monsterLevel: level,
          loadout: [...hero.loadout.actives].filter((x): x is string => x !== null),
          fights: enc.length,
          wins: won.length,
          rounds: mean(enc.map((f) => f.rounds)),
          roundsToKill: mean(won.map((f) => f.rounds)),
          damagePerRound: time > 0 ? damage / time : 0,
          singleTargetPerRound: duelTime > 0 ? duelDamage / duelTime : 0,
          damagePerAction: actions > 0 ? damage / actions : 0,
          damagePerPool: pool > 0 ? damage / pool : null,
        })
      }
    }
  }
  return rows
}

/** Each class's (and each other starter kit's) single-target damage per round at `level`, averaged over the zones measured; classId is the row's variant. */
export function classDamageByLevel(rows: readonly ClassDamageRow[], level: number): { classId: string; role: ClassDamageRole; value: number }[] {
  const byClass = new Map<string, ClassDamageRow[]>()
  for (const r of rows) if (r.level === level) byClass.set(r.variant, [...(byClass.get(r.variant) ?? []), r])
  return [...byClass.entries()].map(([classId, rs]) => ({ classId, role: rs[0]!.role, value: mean(rs.map((r) => r.singleTargetPerRound)) }))
}

function spreadOf(level: number, zoneId: string, values: { classId: string; role: ClassDamageRole; value: number }[]): ClassDamageSpreadLine | null {
  const dealers = values.filter((v) => v.role === 'damage' && v.value > 0)
  if (dealers.length < 2) return null
  const max = dealers.reduce((a, b) => (b.value > a.value ? b : a))
  const min = dealers.reduce((a, b) => (b.value < a.value ? b : a))
  return { level, zoneId, maxClass: max.classId, maxValue: max.value, minClass: min.classId, minValue: min.value, ratio: max.value / min.value }
}

/**
 * Per level: the damage dealers' best and worst single-target damage per round and their ratio (the ≤ 1.5× check) —
 * first the level's line over every zone (zoneId 'all': each class's mean across the zones), then one line per zone.
 */
export function classDamageSpread(rows: readonly ClassDamageRow[]): ClassDamageSpreadLine[] {
  const out: ClassDamageSpreadLine[] = []
  const levels = [...new Set(rows.map((r) => r.level))].sort((a, b) => a - b)
  const zones = [...new Set(rows.map((r) => r.zoneId))]
  for (const level of levels) {
    const all = spreadOf(level, 'all', classDamageByLevel(rows, level))
    if (all) out.push(all)
    for (const zoneId of zones) {
      const line = spreadOf(
        level,
        zoneId,
        rows.filter((r) => r.level === level && r.zoneId === zoneId).map((r) => ({ classId: r.variant, role: r.role, value: r.singleTargetPerRound })),
      )
      if (line) out.push(line)
    }
  }
  return out
}

const f1 = (x: number | null): string => (x === null || !Number.isFinite(x) ? '–' : x.toFixed(1))

/** The summary (class × level, mean over the zones), the spread lines and the full table, as Markdown. */
export function classDamageMarkdown(rows: readonly ClassDamageRow[], spreadMax = 1.5): string {
  const lines: string[] = []
  const levels = [...new Set(rows.map((r) => r.level))].sort((a, b) => a - b)
  const classes = [...new Set(rows.map((r) => r.variant))]
  const zones = [...new Set(rows.map((r) => r.zoneId))]
  lines.push(`Single-target damage per round (a solo hero, monsters at the hero's level; the mean over ${zones.join(', ')}):`)
  lines.push('')
  lines.push(`| Class | Role | ${levels.map((l) => `L${l}`).join(' | ')} |`)
  lines.push(`|---|---|${levels.map(() => '---').join('|')}|`)
  for (const c of classes) {
    const cells = levels.map((l) => {
      const v = classDamageByLevel(rows, l).find((x) => x.classId === c)?.value ?? Number.NaN
      const perZone = rows.filter((r) => r.variant === c && r.level === l).map((r) => f1(r.singleTargetPerRound))
      return `**${f1(v)}** (${perZone.join(' · ')})`
    })
    lines.push(`| ${c} | ${roleOf(c.split('/')[0] ?? c)} | ${cells.join(' | ')} |`)
  }
  lines.push('')
  for (const s of classDamageSpread(rows)) {
    if (s.zoneId !== 'all') continue
    const ok = s.ratio <= spreadMax
    lines.push(`- Level ${s.level}: the damage dealers run ${f1(s.minValue)} (${s.minClass}) to ${f1(s.maxValue)} (${s.maxClass}) — **${s.ratio.toFixed(2)}×** ${ok ? `✓ within ${spreadMax}×` : `✗ over ${spreadMax}×`}`)
  }
  lines.push('')
  lines.push('| Class | Level | Zone | Single-target / round | Damage / round | Damage / action | Damage / pool | Rounds | Rounds to kill | Won | Loadout |')
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|')
  for (const r of rows) {
    lines.push(`| ${r.variant} | ${r.level} | ${r.zoneId} | ${f1(r.singleTargetPerRound)} | ${f1(r.damagePerRound)} | ${f1(r.damagePerAction)} | ${f1(r.damagePerPool)} | ${f1(r.rounds)} | ${f1(r.roundsToKill)} | ${r.wins}/${r.fights} | ${r.loadout.map((id) => id.replace(`${r.classId}-`, '')).join(', ')} |`)
  }
  return lines.join('\n')
}

if (import.meta.main) {
  const { loadContentDir } = await import('../sim/loadContent.ts')
  const args = process.argv.slice(2)
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(`--${name}`)
    return i >= 0 ? args[i + 1] : undefined
  }
  const content = loadContentDir('content')
  const levels = flag('levels')
    ?.split(',')
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
  const fights = Number(flag('fights') ?? '12')
  const started = Date.now()
  const rows = measureClassDamage(content, { ...(levels?.length ? { levels } : {}), fights })
  process.stdout.write(`${classDamageMarkdown(rows)}\n\n(${rows.length} rows, ${fights} fights per measure per row, ${Math.round((Date.now() - started) / 100) / 10} s)\n`)
  const json = flag('json')
  if (json) {
    mkdirSync(path.dirname(json), { recursive: true })
    writeFileSync(json, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
  }
}
