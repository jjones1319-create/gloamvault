/**
 * `npm run balance [-- options]` — the batch runner (12 Phase 2 and Phase 7; 10-TECH-PLAN §7; 07 §8.2): party recipes ×
 * seeds × death rules × presets, played by the scripted players (sim/src/policies.ts) through tools/balance/collect.ts,
 * written as JSON to tools/balance/out/<date>-<tag>.json and as a dated report with judgement lines to
 * docs/balance/<date>-<tag>.md. What it plays and what it judges against is data: tuning.json → `runner` (recipes,
 * targets, seeds, the command cap, the careful player's knobs); R comes from the sim (economy.ts `rForFloor`).
 *
 *   --seeds N (runner.seeds)   --seed-start S (1)   --tag T   --date YYYY-MM-DD   --cap N (runner.commandCap)
 *   --zones 1,2,3 (every zone the content has)   --sets main,dive (main)   --recipes id,id   --sizes 1,2,3,4
 *   --floors A-B | --whole   start every recipe on floor A and play to floor B, across zones (default: each recipe's zone)
 *   --death sheltered,mortal,nightmare | all (mortal)   --difficulty normal,hard,dread (normal)   --pacts a,b (none)
 *   --policy textbook,careful,… (runner.policy)   --no-class-damage   --fixture (the Phase 2 fixture content)
 *
 * The report says which floors the content has and which it does not yet (runner.expectedFloors); recipes whose zone or
 * classes are missing are listed and skipped, never fatal.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Content } from '../../sim/src/content.ts'
import type { DelveOptions } from '../../sim/src/delve-types.ts'
import { rForFloor } from '../../sim/src/economy.ts'
import { createHero, heroAtLevel } from '../../sim/src/hero.ts'
import { createItemInstance } from '../../sim/src/items.ts'
import { POLICY_NAMES, type PolicyName } from '../../sim/src/policies.ts'
import { Rng } from '../../sim/src/rng.ts'
import type { DungeonDef, HeroRecord, ItemInstance } from '../../sim/src/types/content.ts'
import type { DeathRule, Difficulty, Grade, Stance, ThreatBand } from '../../sim/src/types/enums.ts'
import { assembleFixtureCorpus } from '../../sim/test/fixtures/assemble.ts'
import { loadContentDir } from '../sim/loadContent.ts'
import { playDelve, type DelveRow, type FightRow, type FloorRow } from './collect.ts'

/* ---------- options ---------- */

const args = process.argv.slice(2)
const flag = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] !== undefined && !args[i + 1]!.startsWith('--') ? args[i + 1]! : fallback
}
const has = (name: string): boolean => args.includes(`--${name}`)
const list = (name: string): string[] => flag(name, '').split(',').map((s) => s.trim()).filter(Boolean)
const started = Date.now()

let root: string | null = null
let content: Content = loadContentDir('content')
let contentNote = 'content/'
if (has('fixture') || content.dungeons.size === 0) {
  root = assembleFixtureCorpus()
  content = loadContentDir(path.join(root, 'content'))
  contentNote = 'the Phase 2 fixture set (sim/test/fixtures/content): one class, two species, seven monsters, one zone'
}
const t = content.tuning

/**
 * What-if runs: `--set monster:hollow-king.multipliers.hp=22,tuning:dungeon.partyScaling.hp.3=1.4` changes the loaded
 * content in memory only (content/ is never written) and the report's header names every override.
 */
const OVERRIDES = list('set')
for (const o of OVERRIDES) {
  const m = /^(monster|tuning|encounter|elite-affix|item):([^=]+)=(.+)$/.exec(o)
  if (!m) throw new Error(`--set ${o}: expected <monster|tuning|encounter|elite-affix|item>:<path>=<value>`)
  const [, kind, pathText, valueText] = m as unknown as [string, string, string, string]
  const parts = pathText.split('.')
  let target: unknown
  if (kind === 'tuning') target = content.tuning
  else {
    const id = parts.shift() ?? ''
    const map = kind === 'monster' ? content.monsters : kind === 'encounter' ? content.encounters : kind === 'elite-affix' ? content.eliteAffixes : content.items
    target = (map as Map<string, unknown>).get(id)
    if (!target) throw new Error(`--set ${o}: no ${kind} '${id}'`)
  }
  const last = parts.pop()
  for (const key of parts) target = (target as Record<string, unknown> | undefined)?.[key]
  if (!last || target === null || typeof target !== 'object' || !(last in (target as object))) throw new Error(`--set ${o}: no such path`)
  let value: unknown
  try {
    value = JSON.parse(valueText)
  } catch {
    value = valueText
  }
  ;(target as Record<string, unknown>)[last] = value
}

/* ---------- the runner's data (tuning.json → runner) ---------- */

type Band = [number, number]
interface RunnerData {
  seeds: number
  commandCap: number
  policy: string
  expectedFloors: Record<string, unknown>
  careful: { turnBackFrom: string; bossCounts: boolean }
  targets: {
    rounds: Record<string, unknown>
    goldPerClearedDelveR: Band
    repairPercentOfR: Band
    mainHandWearPercent: Band
    ambushPercentOfFights: Band
    goldPerFloor: Record<string, unknown>
    goldPerFloorBand: Band
    classDamageSpreadMax: number
  }
  recipes: unknown[]
  /** "repeat": every boss has died before (the steady state R measures); "first": each delve pays the first-kill lines. */
  bossKills?: string
  /** Named plans: each a list of parts { name, sets, death, difficulty, policy, seeds } (`--plan <name>`). */
  plans?: Record<string, unknown>
}
const RUNNER = (t as unknown as { runner?: RunnerData }).runner
if (!RUNNER) throw new Error('tuning.json has no runner section (tools/balance/run.ts reads its recipes and targets there)')
const band = (v: unknown, where: string): Band => {
  if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number') return [v[0], v[1]]
  throw new Error(`tuning.json runner.${where} must be [low, high]`)
}
const TARGETS = {
  rounds: Object.fromEntries(Object.entries(RUNNER.targets.rounds).filter(([k]) => k !== 'note').map(([k, v]) => [k, band(v, `targets.rounds.${k}`)])) as Record<string, Band>,
  goldPerClearedDelveR: band(RUNNER.targets.goldPerClearedDelveR, 'targets.goldPerClearedDelveR'),
  repairPercentOfR: band(RUNNER.targets.repairPercentOfR, 'targets.repairPercentOfR'),
  mainHandWearPercent: band(RUNNER.targets.mainHandWearPercent, 'targets.mainHandWearPercent'),
  ambushPercentOfFights: band(RUNNER.targets.ambushPercentOfFights, 'targets.ambushPercentOfFights'),
  goldPerFloorBand: band(RUNNER.targets.goldPerFloorBand, 'targets.goldPerFloorBand'),
  classDamageSpreadMax: RUNNER.targets.classDamageSpreadMax,
}

const SEEDS = Number(flag('seeds', has('quick') ? '20' : String(RUNNER.seeds)))
const SEED_START = Number(flag('seed-start', '1'))
const TAG = flag('tag', 'gravehollow')
/** The local calendar date (the project's dates are local; toISOString would give UTC's). */
const localDate = (d = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const DATE = flag('date', localDate())
const CAP = Number(flag('cap', String(RUNNER.commandCap)))
const DEATHS: DeathRule[] = (flag('death', 'mortal') === 'all' ? ['sheltered', 'mortal', 'nightmare'] : list('death').length ? list('death') : ['mortal']).filter((d): d is DeathRule => d === 'sheltered' || d === 'mortal' || d === 'nightmare')
const DIFFICULTIES: Difficulty[] = (list('difficulty').length ? list('difficulty') : ['normal']).filter((d): d is Difficulty => d === 'normal' || d === 'hard' || d === 'dread')
const POLICIES: PolicyName[] = (list('policy').length ? list('policy') : [RUNNER.policy]).filter((p): p is PolicyName => (POLICY_NAMES as readonly string[]).includes(p))
const PACTS = list('pacts').filter((p) => p !== 'none')
const DEATH_NAME: Record<DeathRule, string> = { sheltered: 'Sheltered', mortal: 'Mortal', nightmare: 'Nightmare' }
/** The scripted player the targets are written for (D-084's recipes were judged on it); others are reported. */
const MAIN_POLICY = RUNNER.policy as PolicyName
/** D-083/08 §11: whether the delves' bosses die for the first time ("first") or again ("repeat", the default: R is a typical delve's gold). */
const BOSS_KILLS = flag('kills', RUNNER.bossKills ?? 'repeat') === 'first' ? 'first' : 'repeat'

/** One sub-matrix of a run: recipe sets × death rules × presets × scripted players, at its own seed count. A plan lists several. */
interface Part {
  name: string
  sets: string[]
  deaths: DeathRule[]
  difficulties: Difficulty[]
  policies: PolicyName[]
  seeds: number
}
const PLAN = flag('plan', '')
const seedsOverride = has('seeds') || has('quick') ? SEEDS : null
function readPlan(name: string): Part[] {
  const raw = RUNNER!.plans?.[name]
  if (!Array.isArray(raw)) throw new Error(`tuning.json runner.plans has no plan '${name}' (have: ${Object.keys(RUNNER!.plans ?? {}).filter((k) => k !== 'note').join(', ') || 'none'})`)
  return raw.map((p, i) => {
    const o = p as Record<string, unknown>
    const strings = (v: unknown, fallback: string[]): string[] => (Array.isArray(v) ? v.map(String) : fallback)
    return {
      name: typeof o.name === 'string' ? o.name : `part ${i + 1}`,
      sets: strings(o.sets, ['main']),
      deaths: strings(o.death, ['mortal']).filter((d): d is DeathRule => d === 'sheltered' || d === 'mortal' || d === 'nightmare'),
      difficulties: strings(o.difficulty, ['normal']).filter((d): d is Difficulty => d === 'normal' || d === 'hard' || d === 'dread'),
      policies: strings(o.policy, [RUNNER!.policy]).filter((x): x is PolicyName => (POLICY_NAMES as readonly string[]).includes(x)),
      seeds: seedsOverride ?? (typeof o.seeds === 'number' ? o.seeds : RUNNER!.seeds),
    }
  })
}
const PARTS: Part[] = PLAN ? readPlan(PLAN) : [{ name: 'run', sets: list('sets').length ? list('sets') : ['main'], deaths: DEATHS, difficulties: DIFFICULTIES, policies: POLICIES, seeds: SEEDS }]

/* ---------- the dungeon and what it provides ---------- */

const dungeonArg = flag('dungeon', '')
const dungeon: DungeonDef | undefined = dungeonArg ? [...content.dungeons.values()].find((d) => d.id === dungeonArg || d.id.startsWith(dungeonArg)) : [...content.dungeons.values()][0]
if (!dungeon) throw new Error('no dungeon in the content')
const floorsPresent = dungeon.floors.map((f) => f.floor).sort((a, b) => a - b)
const lastPresent = floorsPresent[floorsPresent.length - 1] ?? 0
const expectedRaw = RUNNER.expectedFloors[dungeon.id]
const expectedFloors = typeof expectedRaw === 'number' ? expectedRaw : lastPresent
const missingFloors: number[] = []
for (let n = 1; n <= expectedFloors; n++) if (!floorsPresent.includes(n)) missingFloors.push(n)
const zoneIndex = (z: number) => dungeon.zones[z - 1]
const rangeText = (ns: number[]): string => {
  if (!ns.length) return 'none'
  const parts: string[] = []
  let a = ns[0]!
  let b = a
  for (const n of ns.slice(1)) {
    if (n === b + 1) b = n
    else {
      parts.push(a === b ? `F${a}` : `F${a}–${b}`)
      a = b = n
    }
  }
  parts.push(a === b ? `F${a}` : `F${a}–${b}`)
  return parts.join(', ')
}
const floorsArg = has('whole') ? `1-${lastPresent}` : flag('floors', '')
const floorRange: [number, number] | null = floorsArg ? (floorsArg.split('-').map(Number) as [number, number]) : null
if (floorRange && (!floorsPresent.includes(floorRange[0]) || !floorsPresent.includes(floorRange[1] ?? floorRange[0]))) throw new Error(`--floors ${floorsArg}: the content has ${rangeText(floorsPresent)}`)

/* ---------- recipes ---------- */

interface Recipe {
  id: string
  set: string
  zone: number
  name: string
  classes: string[]
  species: string[]
  level: number
  gear: Grade | null
  petStance: Stance | null
  clearTarget: Band | null
  /** Floors inside the zone (D-083: the next delve may start on the floor below the last one reached): the Vault judged as F7 (Naesa) and a start on F8 (the King). Null: the whole zone. */
  floors: [number, number] | null
}

function readRecipe(raw: unknown, i: number): Recipe {
  const r = raw as Record<string, unknown>
  const where = `runner.recipes[${i}]`
  if (typeof r.id !== 'string' || typeof r.name !== 'string' || typeof r.zone !== 'number' || !Array.isArray(r.classes)) throw new Error(`${where} needs id, name, zone and classes`)
  return {
    id: r.id,
    set: typeof r.set === 'string' ? r.set : 'main',
    zone: r.zone,
    name: r.name,
    classes: r.classes.map(String),
    species: Array.isArray(r.species) ? r.species.map(String) : [],
    level: typeof r.level === 'number' ? r.level : 1,
    gear: typeof r.gear === 'string' ? (r.gear as Grade) : null,
    petStance: typeof r.petStance === 'string' ? (r.petStance as Stance) : null,
    clearTarget: r.clearTarget === null || r.clearTarget === undefined ? null : band(r.clearTarget, `${where}.clearTarget`),
    floors: Array.isArray(r.floors) ? (band(r.floors, `${where}.floors`) as [number, number]) : null,
  }
}

const allRecipes = RUNNER.recipes.map(readRecipe)
const wantSets = [...new Set(PARTS.flatMap((p) => p.sets))]
const wantZones = list('zones').map(Number)
const wantIds = list('recipes')
const wantSizes = list('sizes').map(Number)
const skipped: string[] = []
const RECIPES: Recipe[] = []
for (const r of allRecipes) {
  if (!wantSets.includes(r.set) || (wantIds.length && !wantIds.includes(r.id)) || (wantSizes.length && !wantSizes.includes(r.classes.length))) continue
  // --zones picks recipes by their zone, with or without --floors (which then sets where they start and stop).
  if (wantZones.length && !wantZones.includes(r.zone)) continue
  const missingClasses = r.classes.filter((c) => !content.classes.has(c))
  if (missingClasses.length) {
    skipped.push(`${r.id}: class ${missingClasses.join(', ')} not in the content`)
    continue
  }
  if (!floorRange && !zoneIndex(r.zone)) {
    skipped.push(`${r.id}: zone ${r.zone} not in ${dungeon.id} yet`)
    continue
  }
  if (!floorRange && r.floors && !r.floors.every((n) => floorsPresent.includes(n))) {
    skipped.push(`${r.id}: floors ${r.floors.join("–")} not in ${dungeon.id} yet`)
    continue
  }
  RECIPES.push(r)
}
if (RECIPES.length === 0 && content.classes.size > 0) {
  // A fixture with one class: three of it, at level 1.
  const solo = [...content.classes.keys()][0]!
  RECIPES.push({ id: 'fixture-three', set: 'main', zone: 1, name: `three ${solo}s`, classes: [solo, solo, solo], species: [], level: 1, gear: null, petStance: null, clearTarget: null, floors: null })
}

/* ---------- parties ---------- */

/** The six free points (03 §2.3) go where the class's sheet points: casters to Wisdom and Willpower, skirmishers to Agility and Perception, the rest to the Warden's trio. */
function freePointsFor(classId: string): Record<string, number> {
  const cls = content.classes.get(classId)
  if (cls?.pool === 'mana') return { wisdom: 2, willpower: 2, vitality: 2 }
  if (classId === 'shade' || classId === 'ranger') return { agility: 2, perception: 2, vitality: 2 }
  return { endurance: 2, vitality: 2, strength: 2 }
}

/** A ground hero (D-084): levelled with its class growth (D-082), its pet at the same level, each worn piece swapped for its own type at `gear` (same mesh, 08's ladder). Returns how many pieces reached the grade. */
function ground(h: HeroRecord, recipe: Recipe, seed: number): { hero: HeroRecord; pieces: number; upgraded: number } {
  let out = h
  if (recipe.level > 1) {
    out = heroAtLevel(content, t, out, recipe.level)
    if (out.petInstance) out = { ...out, petInstance: { ...out.petInstance, level: recipe.level } }
  }
  let pieces = 0
  let upgraded = 0
  const grade = recipe.gear
  if (grade) {
    const rng = Rng.fromSeed(seed)
    const up = (inst: ItemInstance | null): ItemInstance | null => {
      if (!inst) return inst
      pieces++
      const mesh = content.items.get(inst.itemId)?.visual.meshId
      const target = [...content.items.values()].find((d) => d.visual.meshId === mesh && d.grade === grade)
      if (!target) return inst
      upgraded++
      return createItemInstance(content, rng, target.id)
    }
    const e = out.equipment
    out = { ...out, equipment: { ...e, mainHand: up(e.mainHand), offHand: up(e.offHand), helmet: up(e.helmet), chest: up(e.chest), legs: up(e.legs), boots: up(e.boots), gloves: up(e.gloves), ring: [up(e.ring[0]), up(e.ring[1])], talisman: up(e.talisman), relic: up(e.relic) } }
  }
  return { hero: out, pieces, upgraded }
}

function partyFor(recipe: Recipe, seed: number): { heroes: HeroRecord[]; pieces: number; upgraded: number } {
  const egg = [...content.pets.values()].find((p) => p.creationChoice)
  let pieces = 0
  let upgraded = 0
  const heroes = recipe.classes.map((classId, i) => {
    const speciesId = recipe.species[i] && content.species.has(recipe.species[i]!) ? recipe.species[i]! : 'human'
    let h = createHero(content, t, Rng.fromSeed(seed * 31 + i), { id: `h${i}`, name: `${classId}-${i + 1}`, speciesId, classId, freePoints: freePointsFor(classId), eggPetId: egg?.id ?? null })
    if (recipe.petStance && h.petInstance) h = { ...h, petInstance: { ...h.petInstance, stance: recipe.petStance }, loadout: { ...h.loadout, stance: recipe.petStance } }
    const g = ground(h, recipe, seed * 131 + i)
    pieces += g.pieces
    upgraded += g.upgraded
    return g.hero
  })
  return { heroes, pieces, upgraded }
}

/* ---------- cells ---------- */

interface Cell {
  key: string
  recipe: Recipe
  death: DeathRule
  difficulty: Difficulty
  policy: PolicyName
  startFloor: number
  lastFloor: number
  zoneName: string
  /** R at the delve's band (economy.ts rForFloor of its first floor); a part-zone delve's share of it (rFor). */
  R: number
  /** The plan part that asked for the cell, and its seed count. */
  part: string
  seeds: number
}

/**
 * R for a delve (economy.ts rForFloor at its first floor). A delve of part of a zone (D-083: the Vault's F7, or a start
 * on F8) yields its floors' share: 07 §2.3's per-floor gold sums to the zone's R (D-104: F7 370 + F8 400 ≈ the D band's 770).
 */
const rFor = (recipe: Recipe, startFloor: number, lastFloor: number): number => {
  const R = rForFloor(startFloor, t)
  const zone = zoneIndex(recipe.zone)
  const perFloor = RUNNER.targets.goldPerFloor[dungeon.id]
  if (!recipe.floors || floorRange || !zone || !Array.isArray(perFloor)) return R
  const sum = (from: number, to: number): number => {
    let total = 0
    for (let n = from; n <= to; n++) total += typeof perFloor[n - 1] === 'number' ? (perFloor[n - 1] as number) : 0
    return total
  }
  const whole = sum(zone.floors.from, zone.floors.to)
  return whole > 0 ? Math.round((R * sum(startFloor, lastFloor)) / whole) : R
}

const CELLS: Cell[] = []
for (const part of PARTS) {
  for (const recipe of RECIPES) {
    if (!part.sets.includes(recipe.set)) continue
    const zone = floorRange ? null : zoneIndex(recipe.zone)
    const startFloor = floorRange ? floorRange[0] : (recipe.floors?.[0] ?? zone!.floors.from)
    const lastFloor = floorRange ? (floorRange[1] ?? floorRange[0]) : Math.min(recipe.floors?.[1] ?? zone!.floors.to, lastPresent)
    const span = startFloor === lastFloor ? `F${startFloor}` : `F${startFloor}–${lastFloor}`
    const zoneName = floorRange ? span : recipe.floors ? `${zone!.name} ${span}` : zone!.name
    for (const difficulty of part.difficulties)
      for (const death of part.deaths)
        for (const policy of part.policies) {
          const key = [recipe.id, death, difficulty, policy, ...(PACTS.length ? [PACTS.join('+')] : [])].join('|')
          if (CELLS.some((c) => c.key === key)) continue
          CELLS.push({ key, recipe, death, difficulty, policy, startFloor, lastFloor, zoneName, R: rFor(recipe, startFloor, lastFloor), part: part.name, seeds: part.seeds })
        }
  }
}
/** What the cells span, for the labels (a column only says what varies). */
const DEATHS_USED = [...new Set(CELLS.map((c) => c.death))]
const DIFFICULTIES_USED = [...new Set(CELLS.map((c) => c.difficulty))]
const POLICIES_USED = [...new Set(CELLS.map((c) => c.policy))]
/** The boss kills a "repeat" delve starts with: every boss of the dungeon once (08 §11: the repeat rows). */
const REPEAT_KILLS: Record<string, number> = Object.fromEntries(dungeon.floors.map((f) => f.bossId).filter((b): b is string => typeof b === 'string').map((b) => [b, 1]))

/* ---------- play ---------- */

interface ClassAcc {
  fights: number
  actions: number
  damage: number
  heal: number
  taken: number
  rounds: number
  shareSum: number
}
interface BossFight {
  boss: string
  floor: number
  size: number
  outcome: string
  rounds: number
}
interface CellResult {
  cell: Cell
  delves: (DelveRow & { seed: number })[]
  floors: (FloorRow & { seed: number })[]
  classes: Map<string, ClassAcc>
  bossFights: BossFight[]
  pieces: number
  upgraded: number
  /** Delves the sim threw on (partial content): "seed N: message". */
  errors: string[]
  ms: number
  /** What brings heroes down: fights and deaths by fight kind, by kind + floor + the monsters met, and status-tick damage by floor. */
  byKind: Map<string, { fights: number; deaths: number; falls: number; withDeath: number }>
  killers: Map<string, { fights: number; deaths: number }>
  dot: Map<number, { dot: number; taken: number }>
  /** Per boss: its fights, the enemies' damage, the back-row adds' share of it, and fights where the back row was never hit. */
  backRow: Map<string, { fights: number; enemyDamage: number; backDamage: number; untouched: number }>
}

function addFights(res: CellResult, fights: readonly FightRow[], size: number): void {
  for (const f of fights) {
    const partyDamage = f.heroes.reduce((s, h) => s + h.damageDealt, 0) + f.petDamage
    for (const h of f.heroes) {
      const acc = res.classes.get(h.classId) ?? { fights: 0, actions: 0, damage: 0, heal: 0, taken: 0, rounds: 0, shareSum: 0 }
      acc.fights += 1
      acc.actions += h.actions
      acc.damage += h.damageDealt
      acc.heal += h.healingDone
      acc.taken += h.damageTaken
      acc.rounds += f.rounds
      acc.shareSum += partyDamage > 0 ? h.damageDealt / partyDamage : 0
      res.classes.set(h.classId, acc)
    }
    if (f.boss) {
      res.bossFights.push({ boss: f.boss, floor: f.floor, size, outcome: f.outcome, rounds: f.rounds })
      const back = f.enemies.filter((e) => !e.boss && e.row === 'back')
      const b = res.backRow.get(f.boss) ?? { fights: 0, enemyDamage: 0, backDamage: 0, untouched: 0 }
      b.fights += 1
      b.enemyDamage += f.enemies.reduce((sum, e) => sum + e.damageDealt, 0)
      b.backDamage += back.reduce((sum, e) => sum + e.damageDealt, 0)
      b.untouched += back.length > 0 && back.every((e) => e.damageTaken === 0) ? 1 : 0
      res.backRow.set(f.boss, b)
    }
    const deaths = f.heroes.filter((h) => h.fallen).length
    const k = res.byKind.get(f.kind) ?? { fights: 0, deaths: 0, falls: 0, withDeath: 0 }
    k.fights += 1
    k.deaths += deaths
    k.withDeath += deaths > 0 ? 1 : 0
    k.falls += f.heroes.filter((h) => h.fell).length
    res.byKind.set(f.kind, k)
    const set = `${f.kind}|F${f.floor}|${[...new Set(f.monsters)].sort().join('+')}`
    const killer = res.killers.get(set) ?? { fights: 0, deaths: 0 }
    killer.fights += 1
    killer.deaths += deaths
    res.killers.set(set, killer)
    const d = res.dot.get(f.floor) ?? { dot: 0, taken: 0 }
    for (const h of f.heroes) {
      d.dot += h.dotTaken
      d.taken += h.damageTaken
    }
    res.dot.set(f.floor, d)
  }
}

const RESULTS: CellResult[] = []
for (const cell of CELLS) {
  const cellStarted = Date.now()
  const res: CellResult = { cell, delves: [], floors: [], classes: new Map(), bossFights: [], pieces: 0, upgraded: 0, errors: [], ms: 0, byKind: new Map(), killers: new Map(), dot: new Map(), backRow: new Map() }
  for (let seed = SEED_START; seed < SEED_START + cell.seeds; seed++) {
    const party = partyFor(cell.recipe, seed)
    res.pieces += party.pieces
    res.upgraded += party.upgraded
    const options: DelveOptions = {
      dungeonId: dungeon.id,
      floor: cell.startFloor,
      lastFloor: cell.lastFloor,
      seed,
      difficulty: cell.difficulty,
      pactIds: PACTS,
      auto: true,
      policy: cell.policy,
      deathRule: cell.death,
      ...(BOSS_KILLS === 'repeat' ? { bossKills: REPEAT_KILLS } : {}),
      ...(cell.death === 'nightmare' ? { leaderId: party.heroes[0]!.id } : {}),
    }
    try {
      const played = playDelve(content, options, party.heroes, CAP)
      res.delves.push({ seed, ...played.delve })
      for (const f of played.floors) res.floors.push({ seed, ...f })
      addFights(res, played.fights, cell.recipe.classes.length)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      res.errors.push(`seed ${seed}: ${message.split('\n')[0]}`)
      console.error(`seed ${seed} ${cell.key}: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`)
    }
  }
  res.ms = Date.now() - cellStarted
  RESULTS.push(res)
  process.stderr.write(`${cell.key}: ${res.delves.length} delves${res.errors.length ? `, ${res.errors.length} errors` : ''} in ${(res.ms / 1000).toFixed(1)} s\n`)
}
const elapsed = Math.round((Date.now() - started) / 1000)

/** The skipped recipes grouped by why: "zone 2 not in gravehollow-keep yet: cry-solo-arriving, …". */
function skippedText(): string {
  const byReason = new Map<string, string[]>()
  for (const line of skipped) {
    const [id, ...why] = line.split(': ')
    const reason = why.join(': ')
    byReason.set(reason, [...(byReason.get(reason) ?? []), id ?? '?'])
  }
  return [...byReason.entries()].map(([reason, ids]) => `${reason} (${ids.length}: ${ids.join(', ')})`).join('; ')
}

/* ---------- arithmetic ---------- */

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const quantile = (xs: readonly number[], q: number) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!
}
const pctOf = (n: number, of: number) => (of > 0 ? (100 * n) / of : NaN)
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '-')
const f0 = (x: number) => (Number.isFinite(x) ? x.toFixed(0) : '-')
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '-')
const pc = (x: number) => (Number.isFinite(x) ? `${x.toFixed(0)}%` : '-')
const signed = (x: number) => (Number.isFinite(x) ? `${x < 0 ? '−' : '+'}${Math.abs(x).toFixed(0)}` : '-')
const label = (c: Cell) => `${c.recipe.name}${DEATHS_USED.length > 1 ? ` · ${DEATH_NAME[c.death]}` : ''}${DIFFICULTIES_USED.length > 1 ? ` · ${c.difficulty}` : ''}${POLICIES_USED.length > 1 ? ` · ${c.policy}` : ''}`

const judgements: string[] = []
const judge = (text: string, value: number, lo: number, hi: number, unit = ''): void => {
  const verdict = !Number.isFinite(value) ? 'n/a' : value < lo ? 'LOW' : value > hi ? 'HIGH' : 'OK'
  judgements.push(`- **${verdict}** ${text}: ${f1(value)}${unit} (target ${lo}–${hi}${unit})`)
}
const check = (text: string, ok: boolean, detail: string): void => {
  judgements.push(`- **${ok ? 'OK' : 'OFF'}** ${text}: ${detail}`)
}
/** Judged cells: Normal, no Pacts (the targets are Normal's; Hard and Dread are reported, not judged). */
const judged = (c: Cell) => c.difficulty === 'normal' && PACTS.length === 0 && c.policy === MAIN_POLICY
const count = (rs: readonly { outcome: string }[], o: string) => rs.filter((r) => r.outcome === o).length

/* ---------- the report ---------- */

const lines: string[] = []
const table = (head: string[], rows: string[][]): void => {
  lines.push(`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`))
}
const zonesCovered = [...new Set(CELLS.map((c) => c.zoneName))]
lines.push(
  `# Balance report — ${DATE} — ${TAG}`,
  '',
  `*Written by \`npm run balance\`${PLAN ? ` (plan \`${PLAN}\`)` : ''} on ${contentNote}: ${CELLS.length} cells, ${RESULTS.reduce((s, r) => s + r.delves.length, 0)} delves (seeds from ${SEED_START}) — ${PARTS.map((p) => `**${p.name}**: ${p.sets.join('+')} recipes × ${p.deaths.map((d) => DEATH_NAME[d]).join('/')} × ${p.difficulties.join('/')} × ${p.policies.join('/')}, ${p.seeds} seeds`).join(' · ')}; **${dungeon.name}**, ${zonesCovered.join(' · ')}; Pacts ${PACTS.length ? PACTS.join(', ') : 'none'}; bosses die ${BOSS_KILLS === 'repeat' ? 'again (repeat kills, no first-kill drops; `--kills first` pays them)' : 'for the first time (first-kill drops in every delve)'}; command cap ${CAP}; ${elapsed} s. Judged: the ${MAIN_POLICY} player on Normal without Pacts.*`,
  ...(OVERRIDES.length ? ['', `**What-if run** — the content was changed in memory for this report only: ${OVERRIDES.map((o) => `\`${o}\``).join(', ')}.`] : []),
  '',
  '## 0. What the content provides',
  '',
  `- **Floors present:** ${rangeText(floorsPresent)} of the ${expectedFloors} the dungeon should hold (tuning \`runner.expectedFloors\`); **missing:** ${rangeText(missingFloors)}${missingFloors.length ? ' — the runner plays what exists and skips the rest' : ''}.`,
  `- **Zones:** ${dungeon.zones.map((z, i) => `${i + 1}. ${z.name} (F${z.floors.from}–${z.floors.to})`).join(' · ')}.`,
  `- **Recipes played:** ${RECIPES.map((r) => r.id).join(', ')}.`,
  ...(skipped.length ? [`- **Recipes skipped:** ${skippedText()}.`] : []),
  ...(RESULTS.some((r) => r.errors.length) ? [`- **Delves the sim could not play** (the rows below leave them out): ${RESULTS.filter((r) => r.errors.length).map((r) => `${r.cell.key}: ${r.errors.length} of ${SEEDS} (${[...new Set(r.errors.map((e) => e.replace(/^seed \d+: /, '')))].slice(0, 2).join('; ')})`).join(' · ')}.`] : []),
  ...(RESULTS.some((r) => r.pieces > r.upgraded) ? [`- **Gear the content lacks:** ${RESULTS.filter((r) => r.pieces > r.upgraded && r.cell.recipe.gear).map((r) => `${r.cell.recipe.id} ${f0(pctOf(r.upgraded, r.pieces))}% of pieces at ${r.cell.recipe.gear}`).filter((x, i, a) => a.indexOf(x) === i).join('; ')} (the rest keep their starter piece: no item of that mesh at that grade yet).`] : []),
  '',
)

// 1. Outcomes.
lines.push('## 1. Outcomes per recipe', '')
{
  const rows: string[][] = []
  for (const r of RESULTS) {
    const rs = r.delves
    const n = rs.length
    rows.push([label(r.cell), r.cell.zoneName, pc(pctOf(count(rs, 'cleared'), n)), pc(pctOf(count(rs, 'retreated'), n)), pc(pctOf(count(rs, 'wiped'), n)), pc(pctOf(count(rs, 'chosenDied'), n)), pc(pctOf(count(rs, 'stuck') + count(rs, 'capped'), n)), f1(mean(rs.map((x) => x.deepestCompleted))), `${f1(mean(rs.map((x) => x.partyLevelStart)))} → ${f1(mean(rs.map((x) => x.partyLevelEnd)))}`, f1(mean(rs.map((x) => x.rooms))), f1(mean(rs.map((x) => x.fights))), f1(mean(rs.map((x) => x.downs))), `${f0(mean(rs.map((x) => x.commands)))} (max ${f0(Math.max(0, ...rs.map((x) => x.commands)))})`])
    if (r.cell.recipe.clearTarget && judged(r.cell)) judge(`${label(r.cell)}: ${r.cell.zoneName} cleared, % of delves`, pctOf(count(rs, 'cleared'), n), r.cell.recipe.clearTarget[0], r.cell.recipe.clearTarget[1], '%')
  }
  table(['Recipe', 'Floors', 'Cleared', 'Retreated', 'Wiped', 'Chosen hero died (Nightmare)', 'Stuck or capped', 'Deepest floor done (mean)', 'Party level start → end', 'Rooms', 'Fights', 'Downs / delve', 'Commands'], rows)
  const stuck = RESULTS.flatMap((r) => r.delves.filter((d) => d.outcome === 'stuck' || d.outcome === 'capped').map((d) => `${r.cell.key} seed ${d.seed}: ${d.summary}`))
  check('delves that ended stuck or at the command cap', stuck.length === 0, stuck.length ? `${stuck.length} — ${stuck.slice(0, 5).join('; ')}` : `none of ${RESULTS.reduce((s, r) => s + r.delves.length, 0)} (target 0)`)
}

// 1b. Deaths.
lines.push('', '## 2. Deaths per delve (D-088, D-095; reported, not judged until James sets targets)', '')
{
  const rows = RESULTS.map((r) => {
    const rs = r.delves
    return [label(r.cell), f2(mean(rs.map((x) => x.falls))), pc(pctOf(rs.filter((x) => x.falls > 0).length, rs.length)), f2(mean(rs.map((x) => x.raises))), f2(mean(rs.map((x) => x.carriedHome))), f2(mean(rs.map((x) => x.lostForGood))), pc(pctOf(rs.filter((x) => x.lostForGood > 0).length, rs.length)), r.cell.death === 'nightmare' ? pc(pctOf(rs.filter((x) => x.ended).length, rs.length)) : '-']
  })
  table(['Recipe', 'Deaths / delve', 'Delves with a death', 'Raised in the dungeon / delve', 'Carried home dead / delve', 'Lost for good / delve', 'Delves losing a hero for good', 'Nightmare: the save ends'], rows)
  if (DEATHS_USED.includes('sheltered')) lines.push('', '*Under Sheltered nobody dies: its "deaths" are the falls Mortal would turn into deaths.*')
}

// 2. Per floor (07 §8.2).
const floorTarget = (n: number): number | null => {
  const tgt = RUNNER.targets.goldPerFloor[dungeon.id]
  return Array.isArray(tgt) && typeof tgt[n - 1] === 'number' ? (tgt[n - 1] as number) : null
}
lines.push('', '## 3. Per floor (07 §8.2)', '', '*Every arrival on a floor by every recipe of that party size, all death rules pooled; "arrivals" counts the delves that stood on the floor. The band is the floor\'s threat chip for the party on arrival (D-092). Gold is what was found on the floor; its target is `07` §2.3\'s.*', '')
const groups = [...new Set(RESULTS.map((r) => `${r.cell.difficulty}|${r.cell.policy}`))]
for (const g of groups) {
  const [difficulty, policy] = g.split('|')
  const inGroup = RESULTS.filter((r) => r.cell.difficulty === difficulty && r.cell.policy === policy)
  if (groups.length > 1) lines.push(`### ${difficulty} · ${policy}`, '')
  const floors = [...new Set(inGroup.flatMap((r) => r.floors.map((f) => f.floor)))].sort((a, b) => a - b)
  const sizes = [...new Set(inGroup.map((r) => r.cell.recipe.classes.length))].sort((a, b) => a - b)
  const rowsA: string[][] = []
  const rowsB: string[][] = []
  const curioRows: string[][] = []
  for (const n of floors) {
    for (const size of sizes) {
      const fs = inGroup.filter((r) => r.cell.recipe.classes.length === size).flatMap((r) => r.floors.filter((f) => f.floor === n))
      if (!fs.length) continue
      const fights = fs.reduce((s, f) => s + f.fights, 0)
      const bands = (['easy', 'even', 'dangerous', 'deadly'] as ThreatBand[]).map((b) => f0(pctOf(fs.filter((f) => f.band === b).length, fs.length))).join(' / ')
      const done = fs.filter((f) => f.end === 'down')
      const hunters = fs.filter((f) => f.hunterArrived)
      const lit = fs.filter((f) => f.lightAtStairs !== null)
      const dark = lit.filter((f) => f.lightBandAtStairs === 'dark' || f.lightBandAtStairs === 'pitch')
      const gold = fs.map((f) => f.goldFound)
      const tgt = floorTarget(n)
      const items: Record<string, number> = {}
      for (const f of fs) for (const [k, v] of Object.entries(f.itemsByGrade)) items[k] = (items[k] ?? 0) + v
      const itemTotal = Object.values(items).reduce((a, b) => a + b, 0)
      const itemMix = Object.entries(items).sort().map(([k, v]) => `${k} ${f0(pctOf(v, itemTotal))}`).join(' · ') || '-'
      const kl = fs.filter((f) => f.keyLock)
      rowsA.push([`F${n}`, String(size), String(fs.length), f1(mean(fs.map((f) => f.partyLevel))), bands, `${f1(mean(fs.map((f) => f.roomsGenerated)))} (${Math.min(...fs.map((f) => f.roomsGenerated))}–${Math.max(...fs.map((f) => f.roomsGenerated))})`, f1(mean(fs.map((f) => f.roomsVisited))), f1(mean(fs.map((f) => f.straightHops))), `${f1(mean(fs.map((f) => f.fights)))} (${f1(mean(fs.map((f) => f.elites)))})`, f0(mean(done.map((f) => f.ticksToStairs ?? NaN).filter(Number.isFinite))), `${pc(pctOf(hunters.length, fs.length))}${hunters.length ? ` (room ${f1(mean(hunters.map((f) => f.hunterRoom ?? NaN).filter(Number.isFinite)))})` : ''}`, `${pc(pctOf(fs.reduce((s, f) => s + f.ambushedParty, 0), fights))} / ${pc(pctOf(fs.reduce((s, f) => s + f.ambushedMonsters, 0), fights))}`, `${f1(mean(fs.map((f) => f.traps[0])))} / ${f1(mean(fs.map((f) => f.traps[1])))} / ${f1(mean(fs.map((f) => f.traps[2])))}`, `${pc(pctOf(kl.length, fs.length))}${kl.length && done.some((f) => !f.keyLock) ? ` (${signed(mean(done.filter((f) => f.keyLock).map((f) => f.ticksToStairs ?? NaN).filter(Number.isFinite)) - mean(done.filter((f) => !f.keyLock).map((f) => f.ticksToStairs ?? NaN).filter(Number.isFinite)))} ticks)` : ''}`])
      const bossGold = fs.filter((f) => f.bossGold > 0).map((f) => f.bossGold)
      rowsB.push([`F${n}`, String(size), `${f0(mean(gold))} (${f0(quantile(gold, 0.1))}–${f0(quantile(gold, 0.9))})`, bossGold.length ? f0(mean(bossGold)) : '-', tgt === null ? '-' : String(tgt), f0(mean(fs.flatMap((f) => f.damageTakenPct))), f2(mean(fs.map((f) => f.downs))), f2(mean(fs.map((f) => f.falls))), f1(pctOf(fs.reduce((s, f) => s + f.wipes, 0), fs.length)), f2(mean(fs.map((f) => f.torches))), `${f0(mean(lit.map((f) => f.lightAtStairs ?? NaN)))} (${pc(pctOf(dark.length, lit.length))})`, itemMix, pc(pctOf(done.length, fs.length))])
      const outs: Record<string, number> = {}
      for (const f of fs) for (const o of f.curioOutcomes) outs[o.split(':')[1] ?? o] = (outs[o.split(':')[1] ?? o] ?? 0) + 1
      const oTotal = Object.values(outs).reduce((a, b) => a + b, 0)
      if (oTotal) curioRows.push([`F${n}`, String(size), f2(mean(fs.map((f) => f.curios))), Object.entries(outs).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${f0(pctOf(v, oTotal))}%`).join(' · ')])
    }
    // 07 §2.3: gold found per completed floor, every party size pooled (Normal, no Pacts).
    const tgt = floorTarget(n)
    const doneAll = inGroup.filter((r) => judged(r.cell)).flatMap((r) => r.floors.filter((f) => f.floor === n && f.end === 'down'))
    if (tgt !== null && doneAll.length && difficulty === 'normal' && policy === MAIN_POLICY) judge(`F${n} gold found per completed floor vs 07 §2.3's ${tgt}`, mean(doneAll.map((f) => f.goldFound)), Math.round(tgt * TARGETS.goldPerFloorBand[0]), Math.round(tgt * TARGETS.goldPerFloorBand[1]), ' gold')
  }
  lines.push('**3a. Exploration**', '')
  table(['Floor', 'Party size', 'Arrivals', 'Party level', 'Band on arrival (easy / even / dangerous / deadly %)', 'Rooms (min–max)', 'Visited', 'Straight-line hops', 'Fights (elites)', 'Ticks to the stairs', 'Hunter (% of arrivals, room)', 'Ambushed: party / monsters (% of fights)', 'Traps revealed / triggered / disarmed', 'Key and Lock (extra ticks)'], rowsA)
  lines.push('', '**3b. Danger and reward**', '')
  table(['Floor', 'Party size', 'Gold found (p10–p90)', 'Of it, the boss fight', 'Target', 'Damage taken per hero (% max HP)', 'Downs / arrival', 'Deaths / arrival', 'Wipes / 100 arrivals', 'Torches', 'Light at the stairs (% Dark or Pitch)', 'Items found by grade (%)', 'Floor completed'], rowsB)
  if (curioRows.length) {
    lines.push('', '**3c. Curio outcomes**', '')
    table(['Floor', 'Party size', 'Curios used / arrival', 'Outcome mix'], curioRows)
  }
  lines.push('')
}

// 3. Boss floors and arenas.
lines.push('## 4. Boss floors: rounds to kill and the arena (07 §8.2)', '', '*From the delve\'s `stats.bossArenas` (arena.ts writes one row per boss fight); "won" is the party\'s victory. Lanterns out = Vexa\'s crew shot at least one; six candles = the Warden\'s doors opened; tide step 4 = Naesa\'s water reached step 4; third Throne hunter = the third returning hunter entered.*', '')
{
  type ArenaPool = { rows: DelveRow['bossArenas']; fights: BossFight[] }
  const byBoss = new Map<string, ArenaPool>()
  for (const r of RESULTS) {
    if (r.cell.difficulty !== 'normal' || r.cell.policy !== MAIN_POLICY) continue
    const size = r.cell.recipe.classes.length
    for (const d of r.delves)
      for (const a of d.bossArenas) {
        const key = `${a.boss}|${size}`
        const pool = byBoss.get(key) ?? { rows: [], fights: [] }
        pool.rows.push(a)
        byBoss.set(key, pool)
      }
    for (const b of r.bossFights) {
      const key = `${b.boss}|${b.size}`
      const pool = byBoss.get(key) ?? { rows: [], fights: [] }
      pool.fights.push(b)
      byBoss.set(key, pool)
    }
  }
  const rows: string[][] = []
  for (const [key, pool] of [...byBoss.entries()].sort()) {
    const [boss, size] = key.split('|')
    const name = content.monsters.get(boss!)?.name ?? boss!
    const a = pool.rows
    const won = pool.fights.filter((f) => f.outcome === 'victory')
    const rate = (pred: (x: (typeof a)[number]) => boolean) => (a.length ? pc(pctOf(a.filter(pred).length, a.length)) : '-')
    rows.push([name, `F${pool.fights[0]?.floor ?? a[0]?.floor ?? '?'}`, size!, String(pool.fights.length), pc(pctOf(won.length, pool.fights.length)), f1(mean(won.map((f) => f.rounds))), a.length ? f1(mean(a.map((x) => x.phase))) : '-', rate((x) => x.lanternsOut > 0), rate((x) => x.doorsOpened), rate((x) => x.tideMax >= 4), rate((x) => x.huntersReturned >= 3), a.length ? f1(mean(a.map((x) => x.braziersLit))) : '-', a.length ? f1(mean(a.map((x) => x.recalls))) : '-', a.length ? f1(mean(a.map((x) => x.huntersReturned))) : '-', a.length ? f1(mean(a.map((x) => x.partsBroken.split(',').filter(Boolean).length))) : '-', a.length ? f1(mean(a.map((x) => x.tells))) : '-', a.length ? f0(mean(a.map((x) => x.lightMin))) : '-'])
  }
  const back = new Map<string, { fights: number; enemyDamage: number; backDamage: number; untouched: number }>()
  for (const r of RESULTS) {
    if (r.cell.difficulty !== 'normal' || r.cell.policy !== MAIN_POLICY) continue
    for (const [k, v] of r.backRow) {
      const a = back.get(k) ?? { fights: 0, enemyDamage: 0, backDamage: 0, untouched: 0 }
      a.fights += v.fights
      a.enemyDamage += v.enemyDamage
      a.backDamage += v.backDamage
      a.untouched += v.untouched
      back.set(k, a)
    }
  }
  if (rows.length) table(['Boss', 'Floor', 'Party size', 'Fights', 'Won', 'Rounds to kill', 'Phase reached', 'Lanterns out', 'Six candles', 'Tide step 4', 'Third Throne hunter', 'Braziers lit', 'Re-calls', 'Hunters returned', 'Parts broken', 'Tells shown', 'Lowest light'], rows)
  else lines.push('- no boss fights in these delves')
  if (back.size) {
    lines.push('', "**The back row** (07 §2.8: behind Vexa's barricade and around the throne only bows, spells and reach weapons hit it): the back-row adds' share of the damage the enemy side dealt, and the fights in which nobody ever hit them.", '')
    table(['Boss', 'Fights', "Back-row adds' share of the enemies' damage", 'Fights with the back row never hit'], [...back.entries()].sort().map(([k, v]) => [content.monsters.get(k)?.name ?? k, String(v.fights), pc(pctOf(v.backDamage, v.enemyDamage)), pc(pctOf(v.untouched, v.fights))]))
  }
}

// 4b. What brings heroes down.
lines.push('', '## 4b. What brings heroes down', '', '*Judged cells only (the ' + MAIN_POLICY + ' player on Normal, every death rule): a death is a hero past the revive window when a fight ends (D-088). "Status ticks" is the share of the damage heroes took that came from Poison, Bleed, Burn and the other damage-over-time statuses.*', '')
{
  const judgedResults = RESULTS.filter((r) => judged(r.cell))
  const byKind = new Map<string, { fights: number; deaths: number; falls: number; withDeath: number }>()
  const killers = new Map<string, { fights: number; deaths: number }>()
  const dot = new Map<number, { dot: number; taken: number }>()
  for (const r of judgedResults) {
    for (const [k, v] of r.byKind) {
      const a = byKind.get(k) ?? { fights: 0, deaths: 0, falls: 0, withDeath: 0 }
      a.fights += v.fights
      a.deaths += v.deaths
      a.falls += v.falls
      a.withDeath += v.withDeath
      byKind.set(k, a)
    }
    for (const [k, v] of r.killers) {
      const a = killers.get(k) ?? { fights: 0, deaths: 0 }
      a.fights += v.fights
      a.deaths += v.deaths
      killers.set(k, a)
    }
    for (const [k, v] of r.dot) {
      const a = dot.get(k) ?? { dot: 0, taken: 0 }
      a.dot += v.dot
      a.taken += v.taken
      dot.set(k, a)
    }
  }
  const totalDeaths = [...byKind.values()].reduce((s, v) => s + v.deaths, 0)
  table(['Fight kind', 'Fights', 'Fights with a death', 'Deaths', 'Share of all deaths'], [...byKind.entries()].sort((a, b) => b[1].deaths - a[1].deaths).map(([k, v]) => [k, String(v.fights), pc(pctOf(v.withDeath, v.fights)), String(v.deaths), pc(pctOf(v.deaths, totalDeaths))]))
  lines.push('', '**The deadliest fights** (kind, floor and the monsters met; ten with the most deaths):', '')
  table(['Fight', 'Floor', 'Monsters', 'Fights', 'Deaths', 'Deaths / fight'], [...killers.entries()].filter(([, v]) => v.deaths > 0).sort((a, b) => b[1].deaths - a[1].deaths).slice(0, 10).map(([k, v]) => {
    const [kind, floor, monsters] = k.split('|')
    return [kind ?? '?', floor ?? '?', (monsters ?? '').split('+').map((id) => content.monsters.get(id)?.name ?? id).join(', '), String(v.fights), String(v.deaths), f2(v.deaths / Math.max(1, v.fights))]
  }))
  lines.push('', '**Status ticks** (share of the damage heroes took, by floor): ' + [...dot.entries()].sort((a, b) => a[0] - b[0]).map(([floor, v]) => `F${floor} ${pc(pctOf(v.dot, v.taken))}`).join(' · '))
}

// 4. Fight length.
lines.push('', '## 5. Fight length (rounds) by fight kind', '')
{
  const rows: string[][] = []
  for (const r of RESULTS) {
    const by = (k: string) => r.delves.flatMap((d) => d.rounds[k] ?? [])
    rows.push([label(r.cell), ...['fight', 'elite', 'boss', 'hunter'].map((k) => `${f1(mean(by(k)))} (n=${by(k).length})`), f1(mean([...by('trap'), ...by('curio')]))])
    if (judged(r.cell)) for (const [k, [lo, hi]] of Object.entries(TARGETS.rounds)) if (by(k).length) judge(`${label(r.cell)}: ${k} rounds`, mean(by(k)), lo, hi)
  }
  table(['Recipe', 'fight', 'elite', 'boss', 'hunter', 'trap/curio'], rows)
}

// 5. Economy and wear.
lines.push('', '## 6. Economy and wear (R from the sim: economy.ts rForFloor at the delve\'s first floor)', '')
{
  const rows: string[][] = []
  for (const r of RESULTS) {
    const rs = r.delves
    const gold = rs.map((x) => x.gold)
    const R = r.cell.R
    rows.push([label(r.cell), String(R), f0(mean(gold)), f0(quantile(gold, 0.1)), f0(quantile(gold, 0.9)), f0(mean(rs.map((x) => x.goldFound))), f0(mean(rs.map((x) => x.repairGold))), `${f1(pctOf(mean(rs.map((x) => x.repairGold)), R))}%`, f1(mean(rs.map((x) => x.mainHandWearMax))), f1(mean(rs.map((x) => x.wearPct.chest ?? 0))), f1(mean(rs.map((x) => x.chests))), f1(mean(rs.map((x) => x.torches))), f0(mean(rs.flatMap((x) => x.light)))])
    const cleared = rs.filter((x) => x.outcome === 'cleared')
    if (cleared.length && judged(r.cell)) {
      judge(`${label(r.cell)}: gold per cleared delve vs R ${R}`, mean(cleared.map((x) => x.gold)), Math.round(R * TARGETS.goldPerClearedDelveR[0]), Math.round(R * TARGETS.goldPerClearedDelveR[1]), ' gold')
      judge(`${label(r.cell)}: repair bill as % of R`, pctOf(mean(cleared.map((x) => x.repairGold)), R), TARGETS.repairPercentOfR[0], TARGETS.repairPercentOfR[1], '%')
      // 08 §9.4: a fully used F weapon (the party's most-worn main hand) loses 25–35% a delve: judged on starter-kit parties.
      if (r.cell.recipe.gear === null) judge(`${label(r.cell)}: most-worn main hand, wear per delve`, mean(cleared.map((x) => x.mainHandWearMax)), TARGETS.mainHandWearPercent[0], TARGETS.mainHandWearPercent[1], '%')
    }
  }
  table(['Recipe', 'R', 'Gold banked (mean)', 'p10', 'p90', 'Gold found', 'Repair bill (gold)', 'Repair % of R', 'Most-worn main hand %', 'Wear chest % (mean)', 'Chests', 'Torches', 'Light at the stairs'], rows)
}

// 6. Exploration.
lines.push('', '## 7. Exploration', '')
{
  const rows: string[][] = []
  for (const r of RESULTS) {
    const rs = r.delves
    const fights = rs.reduce((s, x) => s + x.fights, 0)
    rows.push([label(r.cell), `${f1(mean(rs.map((x) => x.ambushedParty)))} (${pc(pctOf(rs.reduce((s, x) => s + x.ambushedParty, 0), fights))} of fights)`, f1(mean(rs.map((x) => x.ambushedMonsters))), pc(pctOf(rs.filter((x) => x.hunter > 0).length, rs.length)), `${f1(mean(rs.map((x) => x.traps[0])))} / ${f1(mean(rs.map((x) => x.traps[1])))} / ${f1(mean(rs.map((x) => x.traps[2])))}`, f1(mean(rs.map((x) => x.curios))), f2(mean(rs.map((x) => x.insights))), f0(mean(rs.flatMap((x) => x.ticks)))])
    if (fights && judged(r.cell)) judge(`${label(r.cell)}: party ambushed, % of fights`, pctOf(rs.reduce((s, x) => s + x.ambushedParty, 0), fights), TARGETS.ambushPercentOfFights[0], TARGETS.ambushPercentOfFights[1], '%')
  }
  table(['Recipe', 'Ambushed (party) / delve', 'Ambushed (monsters) / delve', 'Hunter arrivals', 'Traps revealed / triggered / disarmed', 'Curios', 'Insights / delve', 'Ticks to the stairs (mean)'], rows)
}

// 7. Per-class damage.
lines.push('', '## 8. Per-class damage', '', '**8a. In these delves** (the party AI\'s own play, every preset and death rule pooled; a hero\'s damage includes the DoTs it applied):', '')
{
  const pooled = new Map<string, ClassAcc>()
  for (const r of RESULTS)
    for (const [k, v] of r.classes) {
      const acc = pooled.get(k) ?? { fights: 0, actions: 0, damage: 0, heal: 0, taken: 0, rounds: 0, shareSum: 0 }
      for (const key of Object.keys(acc) as (keyof ClassAcc)[]) acc[key] += v[key]
      pooled.set(k, acc)
    }
  const rows = [...pooled.entries()].sort((a, b) => b[1].damage / Math.max(1, b[1].actions) - a[1].damage / Math.max(1, a[1].actions)).map(([k, v]) => [k, String(v.fights), f1(v.actions / Math.max(1, v.fights)), f1(v.damage / Math.max(1, v.actions)), f1(v.damage / Math.max(1, v.rounds)), pc(100 * (v.shareSum / Math.max(1, v.fights))), f1(v.heal / Math.max(1, v.actions)), f1(v.taken / Math.max(1, v.fights))])
  if (rows.length) table(['Class', 'Fights', 'Actions / fight', 'Damage / action', 'Damage / fight round', 'Share of its party\'s damage', 'Healing / action', 'Damage taken / fight'], rows)
}
let classDamageNote = '- not measured (`--no-class-damage`, or tools/balance/class-damage.ts not present yet: pass A writes it)'
let classDamageRows: unknown = null
if (!has('no-class-damage') && existsSync(path.join('tools', 'balance', 'class-damage.ts'))) {
  try {
    // A variable specifier: the module is pass A's and may not exist yet, so the type checker must not resolve it.
    const specifier = './class-damage.ts'
    const cd = (await import(specifier)) as {
      measureClassDamage: (c: Content, o?: { dungeonId?: string }) => unknown[]
      classDamageSpread: (rows: readonly unknown[]) => { level: number; zoneId: string; maxClass: string; minClass: string; ratio: number }[]
      classDamageMarkdown: (rows: readonly unknown[], spreadMax?: number) => string
    }
    const rows = cd.measureClassDamage(content, { dungeonId: dungeon.id })
    classDamageRows = rows
    classDamageNote = cd.classDamageMarkdown(rows, TARGETS.classDamageSpreadMax)
    // Each level's 'all' line (every zone) is judged; the per-zone lines are in the table above.
    for (const s of cd.classDamageSpread(rows)) if (s.zoneId === 'all') judge(`class damage spread at L${s.level} (${s.maxClass} ÷ ${s.minClass}, single-target damage per round, damage dealers)`, s.ratio, 1, TARGETS.classDamageSpreadMax, '×')
  } catch (e) {
    classDamageNote = `- tools/balance/class-damage.ts failed: ${e instanceof Error ? e.message : String(e)}`
  }
}
lines.push('', '**8b. The class-damage measure** (pass A\'s `tools/balance/class-damage.ts`: a solo hero, no pet, against each zone\'s standard encounters; the spread is judged against `runner.targets.classDamageSpreadMax`):', '', classDamageNote)

// 8. Danger you can read.
lines.push('', '## 9. Danger you can read (D-092)', '', '*Every floor arrival pooled by the band its chip showed the party on arrival (Normal). "Too far" should be deadly: deaths per arrival should climb from Even to Dangerous to Deadly.*', '')
{
  // Every scripted player on Normal without Pacts: §9 compares them.
  const normal = RESULTS.filter((r) => r.cell.difficulty === 'normal' && PACTS.length === 0)
  const rows: string[][] = []
  const perBand = new Map<ThreatBand, number>()
  for (const policy of POLICIES_USED) {
    for (const b of ['easy', 'even', 'dangerous', 'deadly'] as ThreatBand[]) {
      const fs = normal.filter((r) => r.cell.policy === policy).flatMap((r) => r.floors.filter((f) => f.band === b))
      if (!fs.length) continue
      const deaths = mean(fs.map((f) => f.falls))
      if (policy === MAIN_POLICY) perBand.set(b, deaths)
      rows.push([policy, b, String(fs.length), f2(deaths), f1(pctOf(fs.reduce((s, f) => s + f.wipes, 0), fs.length)), pc(pctOf(fs.filter((f) => f.end === 'down').length, fs.length)), pc(pctOf(fs.filter((f) => f.end === 'retreated').length, fs.length))])
    }
  }
  if (rows.length) table(['Scripted player', 'Band on arrival', 'Arrivals', 'Deaths / arrival', 'Wipes / 100 arrivals', 'Went down', 'Turned back here'], rows)
  const order = (['even', 'dangerous', 'deadly'] as ThreatBand[]).filter((b) => perBand.has(b))
  if (order.length >= 2) {
    const climbs = order.every((b, i) => i === 0 || perBand.get(b)! >= perBand.get(order[i - 1]!)!)
    check('deaths per floor arrival climb with the threat band (D-092)', climbs, order.map((b) => `${b} ${f2(perBand.get(b)!)}`).join(' → '))
  }
  if (POLICIES_USED.includes('careful') && POLICIES_USED.length > 1) {
    lines.push('')
    const crow: string[][] = []
    for (const policy of POLICIES_USED) {
      const ds = normal.filter((r) => r.cell.policy === policy).flatMap((r) => r.delves)
      crow.push([policy, String(ds.length), f2(mean(ds.map((d) => d.falls))), pc(pctOf(count(ds, 'cleared'), ds.length)), pc(pctOf(count(ds, 'retreated'), ds.length)), pc(pctOf(count(ds, 'wiped'), ds.length)), f1(mean(ds.map((d) => d.deepestCompleted)))])
    }
    table(['Scripted player', 'Delves', 'Deaths / delve', 'Cleared', 'Retreated', 'Wiped', 'Deepest floor done'], crow)
    const careful = normal.filter((r) => r.cell.policy === 'careful').flatMap((r) => r.delves)
    const other = normal.filter((r) => r.cell.policy !== 'careful').flatMap((r) => r.delves)
    if (careful.length && other.length) check('the careful player dies less than the others (it turns back from Deadly floors)', mean(careful.map((d) => d.falls)) <= mean(other.map((d) => d.falls)), `${f2(mean(careful.map((d) => d.falls)))} vs ${f2(mean(other.map((d) => d.falls)))} deaths / delve`)
  }
}

// 9. Stub hooks.
{
  const stubTotals: Record<string, number> = {}
  for (const r of RESULTS) for (const d of r.delves) for (const [k, v] of Object.entries(d.hookStubs ?? {})) stubTotals[k] = (stubTotals[k] ?? 0) + v
  const entries = Object.entries(stubTotals).sort((a, b) => b[1] - a[1])
  lines.push('', '## 10. Stub hooks that fired', '', entries.length ? entries.map(([k, v]) => `- \`${k}\`: ${v} fight(s)`).join('\n') : '- none')
}

lines.push(
  '',
  '## 11. Judgement lines',
  '',
  ...judgements,
  '',
  '## 12. Reading the report',
  '',
  `- Targets are data: tuning.json → \`runner.targets\` and each recipe's \`clearTarget\` (D-084's for the Cellars; the Crypts' and the Vault's carried over, Proposed). Only Normal without Pacts is judged; Hard, Dread and Pacts are reported.`,
  `- A **fight** is ${TARGETS.rounds.fight?.join('–') ?? '3–6'} rounds for ordinary packs (03 §3.6), elites ${TARGETS.rounds.elite?.join('–') ?? '6–8'}, bosses ${TARGETS.rounds.boss?.join('–') ?? '10–15'}, hunters ${TARGETS.rounds.hunter?.join('–') ?? '6–8'}.`,
  `- Gold per cleared delve should land near **R** at the delve's band (03 §8.1; ${TARGETS.goldPerClearedDelveR.join('–')} R), with the full repair bill ${TARGETS.repairPercentOfR.join('–')}% of R; a fully used weapon should lose ${TARGETS.mainHandWearPercent.join('–')}% per delve (08 §9.4); the party should be surprised in ${TARGETS.ambushPercentOfFights.join('–')}% of fights (03 §4.4).`,
  '- **Deaths** are falls past the revive window: under Mortal and Nightmare each is a dead hero (D-088); they are reported until James sets targets.',
  '- **Stuck** means the scripted player found no legal way on (sim/src/policies.ts never wanders); with **capped** (the command cap) it should never happen.',
  '- A hook the sim has no joint for logs `hookStub` (sim/src/skills/custom/README.md) and §10 lists the ones that fired.',
  '',
)

mkdirSync(path.join('tools', 'balance', 'out'), { recursive: true })
mkdirSync(path.join('docs', 'balance'), { recursive: true })
const jsonPath = path.join('tools', 'balance', 'out', `${DATE}-${TAG}.json`)
const mdPath = path.join('docs', 'balance', `${DATE}-${TAG}.md`)
writeFileSync(
  jsonPath,
  JSON.stringify({
    date: DATE,
    tag: TAG,
    seeds: SEEDS,
    seedStart: SEED_START,
    args,
    content: contentNote,
    coverage: { dungeon: dungeon.id, floorsPresent, expectedFloors, missingFloors, skipped },
    cells: RESULTS.map((r) => ({ key: r.cell.key, recipe: r.cell.recipe, death: r.cell.death, difficulty: r.cell.difficulty, policy: r.cell.policy, pacts: PACTS, startFloor: r.cell.startFloor, lastFloor: r.cell.lastFloor, R: r.cell.R, classes: Object.fromEntries(r.classes), bossFights: r.bossFights })),
    delves: RESULTS.flatMap((r) => r.delves.map((d) => ({ cell: r.cell.key, ...d }))),
    floors: RESULTS.flatMap((r) => r.floors.map((f) => ({ cell: r.cell.key, ...f }))),
    classDamage: classDamageRows,
  }),
)
writeFileSync(mdPath, lines.join('\n'))
console.log(lines.slice(lines.indexOf('## 11. Judgement lines')).join('\n'))
console.log(`\nwrote ${mdPath} and ${jsonPath} (${RESULTS.reduce((s, r) => s + r.delves.length, 0)} delves in ${elapsed} s)`)
if (root) rmSync(root, { recursive: true, force: true })
