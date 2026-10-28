/**
 * The cross-file rules of content/README.md ("What the linter checks that the schema cannot"), one function per
 * numbered rule (1–30) plus rule 31 (custom effect handlers). Each returns `{ file, rule, message }[]`.
 *
 * Conventions:
 * - Rules run over the real content corpus (and hero saves with --saves), never the examples.
 * - Rule 2 owns existence: a dangling id is reported once there. Later rules skip targets that do not resolve
 *   and check what the reference means (tier, role, zone, band …).
 * - Completeness rules (3, 9, 14's "exactly 12", 18's "12 launch Pacts") apply only once a file of that kind
 *   exists; an empty kind is the Phase 1 state, not an error. Every other rule applies to whatever exists.
 * - Numbers come from content/tuning.json when it carries them (grades, bands, pet actives …) and fall back
 *   to the README's figures otherwise.
 * - A completeness failure that has no file to blame is reported on the kind's folder (`content/statuses`).
 */
import fs from 'node:fs'
import path from 'node:path'
import type { ContentKind, Corpus } from './corpus.ts'
import { at, bool, defined, isObj, num, obj, objs, str, strs, sum, tnum, walk, type Json, type JsonObject } from './json.ts'

export type Failure = { file: string; rule: number; message: string }

/** A content record with an id. */
export type Rec = { file: string; id: string; json: JsonObject }

type GradeRow = { affixSlots: number; maxPlusN: number; baseMultiplier: number }
type EliteBand = { min: number; max: number; count: number }

export type Tables = {
  /** Ladder order F → God (common.schema.json grade enum). */
  grades: string[]
  gradeRows: Map<string, GradeRow>
  statuses: string[]
  fieldSkills: string[]
  roomKinds: string[]
  attributeBase: number
  classModTotal: number
  speciesModNet: number
  freePoints: number
  skillsPerClass: number
  schoolsPerClass: number
  tiers: number
  perTier: number
  eliteBands: EliteBand[]
  /** 08 §2.3: Block steps this many pp per grade on a shield's ladder (rule 22). */
  blockStepPerGrade: number
  /** D-082: the hero level curve. */
  heroXpBase: number
  heroXpGrowth: number
  heroLevelCap: number
  eliteAffixPool: number
  launchPacts: number
  activesByGrade: Map<string, number>
  activeUnlockLevels: number[]
  ranksPerLevel: number
  defaultLoadoutPresets: number
  triBudget: number
  drawCallBudget: number
  godChanceMax: number
}

export type Ctx = {
  corpus: Corpus
  t: Tables
  classes: Map<string, Rec>
  species: Map<string, Rec>
  skills: Map<string, Rec>
  items: Map<string, Rec>
  affixes: Map<string, Rec>
  sets: Map<string, Rec>
  monsters: Map<string, Rec>
  eliteAffixes: Map<string, Rec>
  dungeons: Map<string, Rec>
  encounters: Map<string, Rec>
  pets: Map<string, Rec>
  chests: Map<string, Rec>
  lootTables: Map<string, Rec>
  contracts: Map<string, Rec>
  statuses: Map<string, Rec>
  wayfarers: Map<string, Rec>
  /** Template files (dungeons/<d>/templates/*.json). */
  templateFiles: { file: string; dungeonFolder: string; json: JsonObject }[]
  /** Hero save records (only with --saves). */
  heroes: { file: string; json: JsonObject }[]
  /** Every content file whose JSON is an object (for tree walks). */
  records: { file: string; json: JsonObject }[]
  families: Set<string>
  /** dungeonId → zoneId → zone object. */
  zones: Map<string, Map<string, JsonObject>>
  allZoneIds: Set<string>
  skillsByClass: Map<string, Rec[]>
  encountersByMonster: Map<string, Rec[]>
  encounterTableIds: Set<string>
  rewardTitles: Set<string>
  warnings: Failure[]
}

const LITERAL_CLASSES: ReadonlySet<string> = new Set(['field', 'pet', 'monster'])
const GEAR_KINDS: ReadonlySet<string> = new Set(['weapon', 'armor', 'shield', 'focus', 'ring', 'talisman', 'relic'])
const ARMOR_SLOTS = ['helmet', 'chest', 'legs', 'boots', 'gloves'] as const
const FIXED_ROOM_KINDS: ReadonlySet<string> = new Set(['entry', 'stairs', 'boss', 'keyRoom', 'lockedDoor', 'secret'])
const FIVE_ROLES = ['fodder', 'elite', 'special', 'monster', 'boss'] as const
const NON_ATTACK_THEN: ReadonlySet<string> = new Set(['flee', 'guard', 'swap row'])
const EQUIPMENT_SINGLE_SLOTS = ['mainHand', 'offHand', 'helmet', 'chest', 'legs', 'boots', 'gloves', 'talisman', 'relic'] as const

const DEFAULT_GRADES = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'God']
const DEFAULT_GRADE_ROWS: Record<string, GradeRow> = {
  F: { affixSlots: 0, maxPlusN: 3, baseMultiplier: 1.0 },
  E: { affixSlots: 1, maxPlusN: 4, baseMultiplier: 1.35 },
  D: { affixSlots: 1, maxPlusN: 5, baseMultiplier: 1.8 },
  C: { affixSlots: 2, maxPlusN: 6, baseMultiplier: 2.45 },
  B: { affixSlots: 2, maxPlusN: 7, baseMultiplier: 3.3 },
  A: { affixSlots: 3, maxPlusN: 8, baseMultiplier: 4.45 },
  S: { affixSlots: 3, maxPlusN: 9, baseMultiplier: 6.0 },
  SS: { affixSlots: 4, maxPlusN: 10, baseMultiplier: 8.1 },
  God: { affixSlots: 4, maxPlusN: 10, baseMultiplier: 11.0 },
}
const DEFAULT_ELITE_BANDS: EliteBand[] = [
  { min: 1, max: 2, count: 1 },
  { min: 3, max: 6, count: 2 },
  { min: 7, max: 9999, count: 3 },
]
const DEFAULT_ACTIVES_BY_GRADE: Record<string, number> = { F: 1, E: 1, D: 1, C: 1, B: 2, A: 2, S: 3, SS: 3, God: 3 }

export function fail(file: string, rule: number, message: string): Failure {
  return { file, rule, message }
}

// ---------------------------------------------------------------------------------------------------------------
// Tables and context

export function buildTables(corpus: Corpus): Tables {
  const common = obj(corpus.schemas.find((s) => s.name === 'common')?.json)
  const enumOf = (name: string): string[] => strs(at(common, '$defs', name, 'enum'))
  const tuning = obj(corpus.byKind.get('tuning')?.[0]?.json)

  const grades = enumOf('grade').length > 0 ? enumOf('grade') : DEFAULT_GRADES
  const gradeRows = new Map<string, GradeRow>()
  for (const g of grades) gradeRows.set(g, DEFAULT_GRADE_ROWS[g] ?? { affixSlots: 0, maxPlusN: 3, baseMultiplier: 1 })
  for (const row of objs(at(tuning, 'equipment', 'grades'))) {
    const id = str(row.id)
    if (id === undefined) continue
    const base = gradeRows.get(id) ?? { affixSlots: 0, maxPlusN: 3, baseMultiplier: 1 }
    gradeRows.set(id, {
      affixSlots: tnum(row.affixSlots) ?? base.affixSlots,
      maxPlusN: tnum(row.maxPlusN) ?? base.maxPlusN,
      baseMultiplier: tnum(row.baseMultiplier) ?? base.baseMultiplier,
    })
  }

  const eliteBands: EliteBand[] = []
  for (const band of objs(at(tuning, 'dungeon', 'eliteAffixCount'))) {
    const min = tnum(at(band, 'floors', 'min'))
    const max = tnum(at(band, 'floors', 'max'))
    const count = tnum(band.count)
    if (min !== undefined && max !== undefined && count !== undefined) eliteBands.push({ min, max, count })
  }

  const activesByGrade = new Map<string, number>()
  for (const g of grades) activesByGrade.set(g, DEFAULT_ACTIVES_BY_GRADE[g] ?? 1)
  const abg = obj(at(tuning, 'pets', 'activesByGrade'))
  if (abg) for (const [g, v] of Object.entries(abg)) if (tnum(v) !== undefined) activesByGrade.set(g, tnum(v) as number)

  const unlock = strsOrNums(at(tuning, 'pets', 'activeUnlockLevels'))

  return {
    grades,
    gradeRows,
    blockStepPerGrade: tnum(at(tuning, 'equipment', 'shields', 'blockStepPerGrade')) ?? 2,
    heroXpBase: tnum(at(tuning, 'xp', 'heroLevel', 'xpToNextBase')) ?? 60,
    heroXpGrowth: tnum(at(tuning, 'xp', 'heroLevel', 'xpToNextGrowth')) ?? 1.28,
    heroLevelCap: tnum(at(tuning, 'xp', 'heroLevel', 'cap')) ?? 99,
    statuses: enumOf('status'),
    fieldSkills: enumOf('fieldSkill'),
    roomKinds: enumOf('roomKind'),
    attributeBase: tnum(at(tuning, 'attributes', 'base')) ?? 10,
    classModTotal: tnum(at(tuning, 'attributes', 'creation', 'classModTotal')) ?? 4,
    speciesModNet: tnum(at(tuning, 'attributes', 'creation', 'speciesModNet')) ?? 2,
    freePoints: tnum(at(tuning, 'attributes', 'creation', 'freePoints')) ?? 6,
    skillsPerClass: tnum(at(tuning, 'skills', 'perClass')) ?? 45,
    schoolsPerClass: tnum(at(tuning, 'skills', 'schools')) ?? 3,
    tiers: tnum(at(tuning, 'skills', 'tiers')) ?? 5,
    perTier: tnum(at(tuning, 'skills', 'perTier')) ?? 3,
    eliteBands: eliteBands.length > 0 ? eliteBands : DEFAULT_ELITE_BANDS,
    eliteAffixPool: tnum(at(tuning, 'dungeon', 'eliteAffixPool')) ?? 12,
    launchPacts: 12,
    activesByGrade,
    activeUnlockLevels: unlock.length > 0 ? unlock : [5, 15],
    ranksPerLevel: tnum(at(tuning, 'derived', 'level', 'skillRanksPerLevel')) ?? 8,
    defaultLoadoutPresets: 2,
    triBudget: 30000,
    drawCallBudget: 60,
    godChanceMax: 4,
  }
}

function strsOrNums(v: Json | undefined): number[] {
  return (Array.isArray(v) ? v : []).map((x) => tnum(x)).filter(defined)
}

function recsOf(corpus: Corpus, kind: ContentKind): Rec[] {
  const out: Rec[] = []
  for (const f of corpus.byKind.get(kind) ?? []) {
    if (!isObj(f.json)) continue
    const id = str(f.json.id)
    if (id === undefined) continue
    out.push({ file: f.path, id, json: f.json })
  }
  return out
}

function indexOf(recs: Rec[]): Map<string, Rec> {
  const m = new Map<string, Rec>()
  for (const r of recs) if (!m.has(r.id)) m.set(r.id, r)
  return m
}

export function buildCtx(corpus: Corpus): Ctx {
  const monsters = indexOf(recsOf(corpus, 'monster'))
  const dungeons = indexOf(recsOf(corpus, 'dungeon'))
  const skills = indexOf(recsOf(corpus, 'skill'))
  const encounters = indexOf(recsOf(corpus, 'encounter'))

  const families = new Set<string>()
  for (const m of monsters.values()) {
    const fam = str(m.json.familyId)
    if (fam !== undefined) families.add(fam)
  }

  const zones = new Map<string, Map<string, JsonObject>>()
  const allZoneIds = new Set<string>()
  for (const d of dungeons.values()) {
    const m = new Map<string, JsonObject>()
    for (const z of objs(d.json.zones)) {
      const id = str(z.id)
      if (id === undefined) continue
      if (!m.has(id)) m.set(id, z)
      allZoneIds.add(id)
    }
    zones.set(d.id, m)
  }

  const skillsByClass = new Map<string, Rec[]>()
  for (const s of skills.values()) {
    const c = str(s.json.classId)
    if (c === undefined) continue
    const list = skillsByClass.get(c) ?? []
    list.push(s)
    skillsByClass.set(c, list)
  }

  const encountersByMonster = new Map<string, Rec[]>()
  const encounterTableIds = new Set<string>()
  for (const e of encounters.values()) {
    const tid = str(e.json.tableId)
    if (tid !== undefined) encounterTableIds.add(tid)
    for (const c of objs(e.json.composition)) {
      const mid = str(c.monsterId)
      if (mid === undefined) continue
      const list = encountersByMonster.get(mid) ?? []
      list.push(e)
      encountersByMonster.set(mid, list)
    }
  }

  const records: { file: string; json: JsonObject }[] = []
  for (const f of corpus.content) if (isObj(f.json)) records.push({ file: f.path, json: f.json })

  const rewardTitles = new Set<string>()
  for (const r of records) {
    walk(r.json, (o) => {
      if (o.kind === 'title') {
        const id = str(o.id)
        if (id !== undefined) rewardTitles.add(id)
      }
    })
  }

  const templateFiles: Ctx['templateFiles'] = []
  for (const f of corpus.byKind.get('template') ?? []) {
    if (isObj(f.json)) templateFiles.push({ file: f.path, dungeonFolder: f.segments[1] ?? '', json: f.json })
  }

  const heroes: Ctx['heroes'] = []
  for (const f of corpus.saves) if (isObj(f.json)) heroes.push({ file: f.path, json: f.json })

  return {
    corpus,
    t: buildTables(corpus),
    classes: indexOf(recsOf(corpus, 'class')),
    species: indexOf(recsOf(corpus, 'species')),
    skills,
    items: indexOf(recsOf(corpus, 'item')),
    affixes: indexOf(recsOf(corpus, 'affix')),
    sets: indexOf(recsOf(corpus, 'item-set')),
    monsters,
    eliteAffixes: indexOf(recsOf(corpus, 'elite-affix')),
    dungeons,
    encounters,
    pets: indexOf(recsOf(corpus, 'pet')),
    chests: indexOf(recsOf(corpus, 'chest')),
    lootTables: indexOf(recsOf(corpus, 'loot-table')),
    contracts: indexOf(recsOf(corpus, 'contract')),
    statuses: indexOf(recsOf(corpus, 'status')),
    wayfarers: indexOf(recsOf(corpus, 'wayfarer')),
    templateFiles,
    heroes,
    records,
    families,
    zones,
    allZoneIds,
    skillsByClass,
    encountersByMonster,
    encounterTableIds,
    rewardTitles,
    warnings: [],
  }
}

function mapFor(ctx: Ctx, kind: ContentKind): Map<string, Rec> | undefined {
  switch (kind) {
    case 'class':
      return ctx.classes
    case 'species':
      return ctx.species
    case 'skill':
      return ctx.skills
    case 'item':
      return ctx.items
    case 'affix':
      return ctx.affixes
    case 'item-set':
      return ctx.sets
    case 'monster':
      return ctx.monsters
    case 'elite-affix':
      return ctx.eliteAffixes
    case 'dungeon':
      return ctx.dungeons
    case 'encounter':
      return ctx.encounters
    case 'pet':
      return ctx.pets
    case 'chest':
      return ctx.chests
    case 'loot-table':
      return ctx.lootTables
    case 'contract':
      return ctx.contracts
    case 'status':
      return ctx.statuses
    case 'wayfarer':
      return ctx.wayfarers
    default:
      return undefined
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Small shared helpers

function gradeIdx(ctx: Ctx, g: unknown): number {
  const s = str(g)
  return s === undefined ? -1 : ctx.t.grades.indexOf(s)
}

function floorsOf(d: Rec): { f: JsonObject; n: number }[] {
  return objs(d.json.floors)
    .map((f) => ({ f, n: num(f.floor) }))
    .filter((x): x is { f: JsonObject; n: number } => x.n !== undefined)
}

function maxFloor(d: Rec): number | undefined {
  const ns = floorsOf(d).map((x) => x.n)
  return ns.length > 0 ? Math.max(...ns) : undefined
}

function zoneRange(z: JsonObject): { from: number; to: number } | undefined {
  const from = num(at(z, 'floors', 'from'))
  const to = num(at(z, 'floors', 'to'))
  return from !== undefined && to !== undefined ? { from, to } : undefined
}

/** The zone of a dungeon by id; undefined when the dungeon or zone does not resolve. */
function zoneOf(ctx: Ctx, dungeonId: unknown, zoneId: unknown): JsonObject | undefined {
  const d = str(dungeonId)
  const z = str(zoneId)
  if (d === undefined || z === undefined) return undefined
  return ctx.zones.get(d)?.get(z)
}

function inRange(n: number, range: JsonObject | undefined): boolean {
  const min = num(range?.min)
  const max = num(range?.max)
  return min !== undefined && max !== undefined && n >= min && n <= max
}

/** The dungeon floors a monster can appear on: via its encounters' floorBands, else its zone's floors. */
function monsterFloors(ctx: Ctx, m: Rec): number[] {
  const out = new Set<number>()
  for (const e of ctx.encountersByMonster.get(m.id) ?? []) {
    const band = obj(e.json.floorBand)
    const min = num(band?.min)
    const max = num(band?.max)
    if (min === undefined || max === undefined || max - min > 200) continue
    for (let n = min; n <= max; n++) out.add(n)
  }
  if (out.size === 0) {
    const z = zoneOf(ctx, m.json.dungeonId, m.json.zoneId)
    const r = z ? zoneRange(z) : undefined
    if (r && r.to - r.from <= 200) for (let n = r.from; n <= r.to; n++) out.add(n)
  }
  return [...out].sort((a, b) => a - b)
}

function sameSet(a: string[], b: string[]): boolean {
  const sa = [...new Set(a)].sort()
  const sb = [...new Set(b)].sort()
  return sa.length === sb.length && sa.every((x, i) => x === sb[i])
}

function kebab(camel: string): string {
  return camel.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/** Item instances on a hero: equipment slots, the ring pair and the bag. */
function heroItemInstances(h: JsonObject): { where: string; inst: JsonObject }[] {
  const out: { where: string; inst: JsonObject }[] = []
  const eq = obj(h.equipment)
  for (const slot of EQUIPMENT_SINGLE_SLOTS) {
    const inst = obj(eq?.[slot])
    if (inst) out.push({ where: `equipment.${slot}`, inst })
  }
  objs(eq?.ring).forEach((inst, i) => out.push({ where: `equipment.ring[${i}]`, inst }))
  objs(h.bag).forEach((inst, i) => out.push({ where: `bag[${i}]`, inst }))
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 1: file name = id, unique ids within a kind, skills/items/templates in the right folder

function rule1(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const seen = new Map<string, Map<string, string>>()
  const register = (scope: string, id: string, file: string): void => {
    let m = seen.get(scope)
    if (!m) {
      m = new Map()
      seen.set(scope, m)
    }
    const first = m.get(id)
    if (first !== undefined && first !== file) out.push(fail(file, 1, `id '${id}' is also used by ${first}`))
    else m.set(id, file)
  }
  // Inline templates take part in the per-dungeon template id space.
  for (const d of ctx.dungeons.values()) {
    for (const tpl of objs(d.json.templates)) {
      const id = str(tpl.id)
      if (id !== undefined) register(`template:${d.id}`, id, d.file)
    }
  }
  for (const f of ctx.corpus.content) {
    if (f.kind === null || f.kind === 'tuning' || !isObj(f.json)) continue
    const segs = f.segments
    const last = segs[segs.length - 1] ?? ''
    const base = last.endsWith('.json') ? last.slice(0, -5) : last
    const id = str(f.json.id)
    if (id === undefined) {
      out.push(fail(f.path, 1, 'record has no string id'))
      continue
    }
    if (f.kind === 'dungeon') {
      if (segs[1] !== id) out.push(fail(f.path, 1, `dungeon folder '${segs[1] ?? ''}' differs from id '${id}'`))
    } else if (base !== id) {
      out.push(fail(f.path, 1, `file name '${base}' differs from id '${id}'`))
    }
    register(f.kind === 'template' ? `template:${segs[1] ?? ''}` : f.kind, id, f.path)
    if (f.kind === 'skill') {
      const c = str(f.json.classId)
      if (c !== undefined && segs[1] !== c) out.push(fail(f.path, 1, `skill of class '${c}' sits in folder skills/${segs[1] ?? ''}/, expected skills/${c}/`))
    }
    if (f.kind === 'item') {
      const k = str(f.json.kind)
      if (k !== undefined && segs[1] !== k) out.push(fail(f.path, 1, `item of kind '${k}' sits in folder items/${segs[1] ?? ''}/, expected items/${k}/`))
    }
    if (f.kind === 'template') {
      const folder = segs[1] ?? ''
      const d = ctx.dungeons.get(folder)
      if (!d || d.file !== `content/dungeons/${folder}/dungeon.json`) {
        out.push(fail(f.path, 1, `template folder dungeons/${folder}/ has no dungeon.json with id '${folder}'`))
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 2: every reference resolves

function rule2(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const R = 2
  const need = (file: string, label: string, id: unknown, kind: ContentKind | 'family'): Rec | undefined => {
    const s = str(id)
    if (s === undefined) return undefined
    if (kind === 'family') {
      if (!ctx.families.has(s)) out.push(fail(file, R, `${label} '${s}' does not resolve: no monster carries that familyId`))
      return undefined
    }
    const rec = mapFor(ctx, kind)?.get(s)
    if (!rec) out.push(fail(file, R, `${label} '${s}' does not resolve to a ${kind}`))
    return rec
  }
  const needMaterial = (file: string, label: string, id: unknown): void => {
    const rec = need(file, label, id, 'item')
    if (rec && str(rec.json.kind) !== 'material') out.push(fail(file, R, `${label} '${rec.id}' is an item of kind '${str(rec.json.kind) ?? '?'}', not a material`))
  }
  const needZone = (file: string, label: string, dungeonId: unknown, zoneId: unknown): void => {
    const d = str(dungeonId)
    const z = str(zoneId)
    if (d === undefined || z === undefined) return
    const zones = ctx.zones.get(d)
    if (!zones) return // the dungeon itself is reported where it is referenced
    if (!zones.has(z)) out.push(fail(file, R, `${label} '${z}' is not a zone of dungeon '${d}'`))
  }
  const needReward = (file: string, label: string, line: JsonObject): void => {
    const kind = str(line.kind)
    const id = str(line.id)
    if (id === undefined) return
    switch (kind) {
      case 'item':
        need(file, `${label} item`, id, 'item')
        break
      case 'material':
        needMaterial(file, `${label} material`, id)
        break
      case 'tome':
        need(file, `${label} tome`, id, 'skill')
        break
      case 'waystone':
        if (!ctx.allZoneIds.has(id)) out.push(fail(file, R, `${label} waystone '${id}' is not a zone of any dungeon`))
        break
      default:
        break // title resolves by being carried; shard/gold/luck carry no id
    }
  }
  const needRewards = (file: string, label: string, v: unknown): void => {
    objs(v).forEach((line, i) => needReward(file, `${label}[${i}]`, line))
  }
  const needRequirement = (file: string, label: string, line: JsonObject): void => {
    switch (str(line.kind)) {
      case 'item':
        need(file, `${label} item`, line.id, 'item')
        break
      case 'classId':
        need(file, `${label} classId`, line.id, 'class')
        break
      case 'speciesId':
        need(file, `${label} speciesId`, line.id, 'species')
        break
      default:
        break // fieldSkillRank and attribute names are schema enums
    }
  }
  const needTableId = (file: string, label: string, id: unknown): void => {
    const s = str(id)
    if (s !== undefined && !ctx.encounterTableIds.has(s)) out.push(fail(file, R, `${label} '${s}' is carried by no encounter's tableId`))
  }

  // Secret rooms (07 §2.6): the zone and every reward id must resolve.
  for (const d of ctx.dungeons.values()) {
    for (const s of objs(d.json.secrets)) {
      const sid = str(s.id) ?? '?'
      if (s.zoneId !== null && s.zoneId !== undefined) needZone(d.file, `secret '${sid}' zoneId`, d.id, s.zoneId)
      needRewards(d.file, `secret '${sid}' rewards`, s.rewards)
    }
  }

  // Summon lines anywhere in the content.
  for (const r of ctx.records) {
    walk(r.json, (o, where) => {
      if (o.kind === 'summon') need(r.file, `${where} summonId`, o.summonId, 'monster')
    })
  }

  for (const c of ctx.classes.values()) {
    need(c.file, 'ultimateSkillId', c.json.ultimateSkillId, 'skill')
    for (const id of strs(c.json.starterKit)) need(c.file, 'starterKit', id, 'item')
    for (const id of strs(c.json.starterSkillIds)) need(c.file, 'starterSkillIds', id, 'skill')
    for (const id of strs(c.json.monsterTechniqueIds)) need(c.file, 'monsterTechniqueIds', id, 'skill')
  }

  for (const s of ctx.species.values()) {
    for (const t of objs(s.json.traits)) need(s.file, `trait '${str(t.id) ?? '?'}' innateSkillId`, at(t, 'rule', 'innateSkillId'), 'skill')
  }

  for (const k of ctx.skills.values()) {
    const classId = str(k.json.classId)
    const school = str(k.json.school)
    if (classId !== undefined) {
      if (LITERAL_CLASSES.has(classId)) {
        if (school !== undefined && school !== classId) out.push(fail(k.file, R, `school '${school}' of a '${classId}' skill must be the literal '${classId}'`))
      } else {
        const c = need(k.file, 'classId', classId, 'class')
        if (c && school !== undefined) {
          const schools = objs(c.json.schools).map((x) => str(x.id)).filter(defined)
          if (!schools.includes(school)) out.push(fail(k.file, R, `school '${school}' is not one of class '${classId}' schools (${schools.join(', ')})`))
        }
      }
    }
    need(k.file, 'prerequisiteId', k.json.prerequisiteId, 'skill')
    need(k.file, 'monsterTechniqueOf', k.json.monsterTechniqueOf, 'monster')
  }

  for (const it of ctx.items.values()) {
    for (const a of objs(it.json.affixes)) need(it.file, 'affixes[].affixId', a.affixId, 'affix')
    need(it.file, 'setId', it.json.setId, 'item-set')
    for (const id of strs(it.json.classLock)) need(it.file, 'classLock', id, 'class')
    for (const a of objs(it.json.affinities)) need(it.file, 'affinities[].familyId', a.familyId, 'family')
  }

  for (const s of ctx.sets.values()) {
    for (const id of strs(s.json.pieces)) need(s.file, 'pieces', id, 'item')
    for (const id of strs(s.json.classIds)) need(s.file, 'classIds', id, 'class')
  }

  for (const m of ctx.monsters.values()) {
    need(m.file, 'dungeonId', m.json.dungeonId, 'dungeon')
    needZone(m.file, 'zoneId', m.json.dungeonId, m.json.zoneId)
    for (const part of ['common', 'rare'] as const) {
      const drop = obj(at(m.json, 'parts', part))
      if (!drop) continue
      needMaterial(m.file, `parts.${part}.materialId`, drop.materialId)
      need(m.file, `parts.${part}.itemId`, drop.itemId, 'item')
    }
    for (const id of strs(m.json.monsterTechniqueSkillIds)) need(m.file, 'monsterTechniqueSkillIds', id, 'skill')
    for (const id of strs(m.json.elitePool)) need(m.file, 'elitePool', id, 'elite-affix')
    const boss = obj(m.json.boss)
    if (boss) {
      needRewards(m.file, 'boss.everyKill', boss.everyKill)
      needRewards(m.file, 'boss.firstKill', boss.firstKill)
    }
  }

  for (const d of ctx.dungeons.values()) {
    need(d.file, 'unlockedBy', d.json.unlockedBy, 'dungeon')
    for (const z of objs(d.json.zones)) {
      const zid = str(z.id) ?? '?'
      need(d.file, `zone '${zid}' familyId`, z.familyId, 'family')
      need(d.file, `zone '${zid}' hunterId`, z.hunterId, 'monster')
      for (const b of strs(z.bossIds)) need(d.file, `zone '${zid}' bossIds`, b, 'monster')
    }
    for (const { f, n } of floorsOf(d)) {
      needZone(d.file, `floor ${n} zoneId`, d.id, f.zoneId)
      need(d.file, `floor ${n} bossId`, f.bossId, 'monster')
      for (const tid of strs(f.encounterTableIds)) needTableId(d.file, `floor ${n} encounterTableIds`, tid)
    }
    for (const c of objs(d.json.curios)) {
      const cid = str(c.id) ?? '?'
      needZone(d.file, `curio '${cid}' zoneId`, d.id, c.zoneId)
      need(d.file, `curio '${cid}' safeItemId`, c.safeItemId, 'item')
      objs(c.choices).forEach((choice, i) => {
        for (const req of objs(choice.requires)) needRequirement(d.file, `curio '${cid}' choices[${i}].requires`, req)
      })
    }
    for (const tr of objs(d.json.traps)) {
      const tid = str(tr.id) ?? '?'
      needZone(d.file, `trap '${tid}' zoneId`, d.id, tr.zoneId)
      need(d.file, `trap '${tid}' revealedBy.classId`, at(tr, 'revealedBy', 'classId'), 'class')
      need(d.file, `trap '${tid}' revealedBy.petId`, at(tr, 'revealedBy', 'petId'), 'pet')
      needRewards(d.file, `trap '${tid}' disarmReward`, tr.disarmReward)
    }
    for (const tpl of objs(d.json.templates)) needZone(d.file, `template '${str(tpl.id) ?? '?'}' zoneId`, d.id, tpl.zoneId)
  }

  for (const tpl of ctx.templateFiles) {
    if (ctx.dungeons.has(tpl.dungeonFolder)) needZone(tpl.file, 'zoneId', tpl.dungeonFolder, tpl.json.zoneId)
  }

  for (const e of ctx.encounters.values()) {
    need(e.file, 'dungeonId', e.json.dungeonId, 'dungeon')
    for (const c of objs(e.json.composition)) need(e.file, 'composition[].monsterId', c.monsterId, 'monster')
  }

  for (const p of ctx.pets.values()) {
    // 06 §9 lists all sixteen pets while Phase 3 ships one zone: a family no monster carries yet warns (the egg cannot drop until it does; D-074).
    for (const [label, value] of [
      ['speciesFamilyId', p.json.speciesFamilyId],
      ['eggSource.familyId', at(p.json, 'eggSource', 'familyId')],
    ] as const) {
      const s = str(value)
      if (s !== undefined && !ctx.families.has(s)) ctx.warnings.push(fail(p.file, R, `${label} '${s}' is carried by no monster yet (the egg cannot drop until its family exists)`))
    }
    for (const a of objs(p.json.actives)) need(p.file, 'actives[].skillId', a.skillId, 'skill')
  }

  for (const lt of ctx.lootTables.values()) {
    const d = need(lt.file, 'dungeonId', lt.json.dungeonId, 'dungeon')
    for (const id of strs(at(lt.json, 'consumableDrop', 'itemIds'))) need(lt.file, 'consumableDrop.itemIds', id, 'item')
    const trapId = str(at(lt.json, 'treasureRoom', 'trapId'))
    if (d && trapId !== undefined) {
      const traps = objs(d.json.traps).map((x) => str(x.id))
      if (!traps.includes(trapId)) out.push(fail(lt.file, R, `treasureRoom.trapId '${trapId}' is not a trap of dungeon '${d.id}'`))
    }
    need(lt.file, 'bossFirstKill', lt.json.bossFirstKill, 'monster')
  }

  for (const c of ctx.contracts.values()) {
    const target = obj(c.json.target)
    if (target) {
      need(c.file, 'target.familyId', target.familyId, 'family')
      need(c.file, 'target.monsterId', target.monsterId, 'monster')
      need(c.file, 'target.dungeonId', target.dungeonId, 'dungeon')
      const zid = str(target.zoneId)
      if (zid !== undefined) {
        const did = str(target.dungeonId)
        if (did !== undefined) needZone(c.file, 'target.zoneId', did, zid)
        else if (!ctx.allZoneIds.has(zid)) out.push(fail(c.file, R, `target.zoneId '${zid}' is not a zone of any dungeon`))
      }
    }
    need(c.file, 'reward.chestId', at(c.json, 'reward', 'chestId'), 'chest')
    for (const line of objs(at(c.json, 'reward', 'items'))) need(c.file, 'reward.items[].itemId', line.itemId, 'item')
  }

  for (const h of ctx.heroes) {
    need(h.file, 'speciesId', h.json.speciesId, 'species')
    need(h.file, 'classId', h.json.classId, 'class')
    for (const s of objs(h.json.skills)) need(h.file, 'skills[].skillId', s.skillId, 'skill')
    const loadoutIds = (lo: unknown): string[] => [...strs(at(lo, 'actives')), ...strs(at(lo, 'passives'))]
    for (const id of loadoutIds(h.json.loadout)) need(h.file, 'loadout', id, 'skill')
    objs(h.json.loadoutPresets).forEach((p, i) => {
      for (const id of loadoutIds(p.loadout)) need(h.file, `loadoutPresets[${i}]`, id, 'skill')
    })
    for (const { where, inst } of heroItemInstances(h.json)) {
      need(h.file, `${where} itemId`, inst.itemId, 'item')
      for (const a of objs(inst.affixes)) need(h.file, `${where} affixId`, a.affixId, 'affix')
      for (const a of objs(inst.affinities)) need(h.file, `${where} familyId`, a.familyId, 'family')
    }
    need(h.file, 'petInstance.petId', at(h.json, 'petInstance', 'petId'), 'pet')
    for (const a of objs(at(h.json, 'naturalArmor', 'affinities'))) need(h.file, 'naturalArmor.affinities[].familyId', a.familyId, 'family')
  }

  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 3: status ids are enum values and every enum value has a file (gated on the first status file)

function rule3(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const files = ctx.corpus.byKind.get('status') ?? []
  const present = new Set<string>()
  for (const f of files) {
    const id = str(at(f.json, 'id'))
    if (id === undefined) continue
    if (!ctx.t.statuses.includes(id)) out.push(fail(f.path, 3, `id '${id}' is not one of the status enum (${ctx.t.statuses.length} values in common.schema.json)`))
    else present.add(id)
  }
  if (files.length > 0) {
    for (const v of ctx.t.statuses) {
      if (!present.has(v)) out.push(fail('content/statuses', 3, `no file for status '${v}' (${present.size} of ${ctx.t.statuses.length} present)`))
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 4: 45 skills per class, 3 schools × 5 tiers × 3

function rule4(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const { tiers, perTier, schoolsPerClass } = ctx.t
  for (const c of ctx.classes.values()) {
    const all = ctx.skillsByClass.get(c.id) ?? []
    // The Ultimate is the class's extra skill beside the 3 × 5 × 3 (03 §7.1 "also has one Ultimate"; D-070).
    const skills = all.filter((s) => s.json.isUltimate !== true)
    if (skills.length === 0) continue
    const schools = objs(c.json.schools).map((s) => str(s.id)).filter(defined)
    const present = new Set(skills.map((s) => num(s.json.tier)).filter((n): n is number => n !== undefined))
    for (let tier = 1; tier <= 3; tier++) if (!present.has(tier)) out.push(fail(c.file, 4, `class has no Tier ${tier} skills; Tiers I–III ship first (12 Phase 3)`))
    for (let tier = 4; tier <= tiers; tier++) if (!present.has(tier)) ctx.warnings.push(fail(c.file, 4, `class has no Tier ${tier} skills yet (Phase 7 adds IV–V)`))
    for (const school of schools) {
      for (const tier of [...present].sort((a, b) => a - b)) {
        const n = skills.filter((s) => str(s.json.school) === school && num(s.json.tier) === tier).length
        if (n !== perTier) out.push(fail(c.file, 4, `school '${school}' tier ${tier} has ${n} skills, expected ${perTier} (${schoolsPerClass} schools × ${perTier} per tier, the Ultimate aside)`))
      }
    }
    const expected = schools.length * present.size * perTier
    if (skills.length !== expected) out.push(fail(c.file, 4, `class has ${skills.length} non-Ultimate skills across ${present.size} tier(s), expected ${expected}`))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 5: prerequisites are the Tier N−1 skill of the same class and school; Tier I has null

function rule5(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const k of ctx.skills.values()) {
    const tier = num(k.json.tier)
    const pre = k.json.prerequisiteId
    const classId = str(k.json.classId)
    if (classId !== undefined && LITERAL_CLASSES.has(classId)) {
      if (tier !== undefined && tier !== 1) out.push(fail(k.file, 5, `a '${classId}' skill is Tier ${tier}; field, pet and monster skills are Tier I`))
      if (pre !== null && pre !== undefined) out.push(fail(k.file, 5, `a '${classId}' skill has prerequisiteId '${String(pre)}'; expected null`))
      continue
    }
    if (tier === undefined) continue
    if (tier === 1) {
      if (pre !== null && pre !== undefined) out.push(fail(k.file, 5, `Tier I skill has prerequisiteId '${String(pre)}'; expected null`))
      continue
    }
    if (pre === null || pre === undefined) {
      out.push(fail(k.file, 5, `Tier ${tier} skill has no prerequisiteId; expected a Tier ${tier - 1} skill of the same school`))
      continue
    }
    const p = ctx.skills.get(str(pre) ?? '')
    if (!p) continue // rule 2
    const pTier = num(p.json.tier)
    if (pTier !== tier - 1) out.push(fail(k.file, 5, `prerequisite '${p.id}' is Tier ${pTier ?? '?'}, expected Tier ${tier - 1}`))
    if (str(p.json.classId) !== classId) out.push(fail(k.file, 5, `prerequisite '${p.id}' belongs to class '${str(p.json.classId) ?? '?'}', expected '${classId ?? '?'}'`))
    if (str(p.json.school) !== str(k.json.school)) out.push(fail(k.file, 5, `prerequisite '${p.id}' is of school '${str(p.json.school) ?? '?'}', expected '${str(k.json.school) ?? '?'}'`))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 6: exactly one Ultimate per class, at Tier III, and it is the class's ultimateSkillId

function rule6(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const k of ctx.skills.values()) {
    if (bool(k.json.isUltimate) !== true) continue
    const tier = num(k.json.tier)
    if (tier !== 3) out.push(fail(k.file, 6, `Ultimate is Tier ${tier ?? '?'}, expected Tier III`))
    const classId = str(k.json.classId)
    const c = classId !== undefined ? ctx.classes.get(classId) : undefined
    if (c && str(c.json.ultimateSkillId) !== k.id) out.push(fail(k.file, 6, `isUltimate but class '${c.id}' names '${str(c.json.ultimateSkillId) ?? '?'}' as its ultimateSkillId`))
    if (classId !== undefined && LITERAL_CLASSES.has(classId)) out.push(fail(k.file, 6, `a '${classId}' skill cannot be an Ultimate`))
  }
  for (const c of ctx.classes.values()) {
    const ults = (ctx.skillsByClass.get(c.id) ?? []).filter((s) => bool(s.json.isUltimate) === true)
    if (ults.length !== 1) out.push(fail(c.file, 6, `${ults.length} skills of class '${c.id}' have isUltimate: true, expected exactly 1`))
    const target = ctx.skills.get(str(c.json.ultimateSkillId) ?? '')
    if (target && bool(target.json.isUltimate) !== true) out.push(fail(c.file, 6, `ultimateSkillId '${target.id}' does not have isUltimate: true`))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 7: starters are three Tier I skills; monster techniques point both ways (warning: ≥ 2 per dungeon)

function rule7(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const c of ctx.classes.values()) {
    for (const id of strs(c.json.starterSkillIds)) {
      const s = ctx.skills.get(id)
      if (!s) continue
      if (str(s.json.classId) !== c.id) out.push(fail(c.file, 7, `starter skill '${id}' belongs to class '${str(s.json.classId) ?? '?'}'`))
      if (num(s.json.tier) !== 1) out.push(fail(c.file, 7, `starter skill '${id}' is Tier ${num(s.json.tier) ?? '?'}, expected Tier I`))
    }
    for (const id of strs(c.json.monsterTechniqueIds)) {
      const s = ctx.skills.get(id)
      if (!s) continue
      if (str(s.json.classId) !== c.id) out.push(fail(c.file, 7, `monster technique '${id}' belongs to class '${str(s.json.classId) ?? '?'}'`))
      const tier = num(s.json.tier)
      if (tier !== 3 && tier !== 4) out.push(fail(c.file, 7, `monster technique '${id}' is Tier ${tier ?? '?'}, expected Tier III or IV`))
      const mid = str(s.json.monsterTechniqueOf)
      if (mid === undefined) {
        out.push(fail(c.file, 7, `monster technique '${id}' has monsterTechniqueOf: null`))
        continue
      }
      const m = ctx.monsters.get(mid)
      if (m && !strs(m.json.monsterTechniqueSkillIds).includes(id)) out.push(fail(c.file, 7, `monster technique '${id}' is not in monster '${mid}' monsterTechniqueSkillIds`))
    }
  }
  for (const m of ctx.monsters.values()) {
    for (const id of strs(m.json.monsterTechniqueSkillIds)) {
      const s = ctx.skills.get(id)
      if (!s) continue
      if (str(s.json.monsterTechniqueOf) !== m.id) out.push(fail(m.file, 7, `monsterTechniqueSkillIds '${id}' has monsterTechniqueOf '${str(s.json.monsterTechniqueOf) ?? 'null'}', expected '${m.id}'`))
      const tier = num(s.json.tier)
      if (tier !== 3 && tier !== 4) out.push(fail(m.file, 7, `monsterTechniqueSkillIds '${id}' is Tier ${tier ?? '?'}, expected Tier III or IV`))
      const c = ctx.classes.get(str(s.json.classId) ?? '')
      if (c && !strs(c.json.monsterTechniqueIds).includes(id)) out.push(fail(m.file, 7, `monsterTechniqueSkillIds '${id}' is not in class '${c.id}' monsterTechniqueIds`))
    }
  }
  // Warning, not failure: a class should meet two or more techniques per dungeon (06 §8.8).
  const dungeonsWithMonsters = new Set<string>()
  for (const m of ctx.monsters.values()) {
    const d = str(m.json.dungeonId)
    if (d !== undefined && ctx.dungeons.has(d)) dungeonsWithMonsters.add(d)
  }
  for (const c of ctx.classes.values()) {
    for (const d of dungeonsWithMonsters) {
      const n = strs(c.json.monsterTechniqueIds).filter((id) => {
        const m = ctx.monsters.get(str(ctx.skills.get(id)?.json.monsterTechniqueOf) ?? '')
        return m !== undefined && str(m.json.dungeonId) === d
      }).length
      if (n < 2) ctx.warnings.push(fail(c.file, 7, `class '${c.id}' meets ${n} monster technique(s) in dungeon '${d}'; 06 §8.8 wants two or more`))
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 8: class attributeMods sum to +4, species net to +2

function rule8(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const c of ctx.classes.values()) {
    const s = sum(Object.values(obj(c.json.attributeMods) ?? {}))
    if (s !== ctx.t.classModTotal) out.push(fail(c.file, 8, `attributeMods sum to ${s >= 0 ? '+' : ''}${s}, expected +${ctx.t.classModTotal}`))
  }
  for (const sp of ctx.species.values()) {
    const s = sum(Object.values(obj(sp.json.attributeMods) ?? {}))
    if (s !== ctx.t.speciesModNet) out.push(fail(sp.file, 8, `attributeMods net ${s >= 0 ? '+' : ''}${s}, expected +${ctx.t.speciesModNet}`))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 9: field skills exist for all eight values (gated); pet actives are only referenced from pet.actives

function rule9(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const fieldSkills = ctx.skillsByClass.get('field') ?? []
  if (fieldSkills.length > 0) {
    const matched = new Map<string, string[]>()
    for (const v of ctx.t.fieldSkills) matched.set(v, [])
    for (const s of fieldSkills) {
      const v = ctx.t.fieldSkills.find((x) => s.id === kebab(x) || s.id === `field-${kebab(x)}`)
      if (v === undefined) out.push(fail(s.file, 9, `field skill id '${s.id}' matches no fieldSkill value (expected <value> or field-<value> in kebab-case)`))
      else matched.get(v)?.push(s.file)
    }
    for (const [v, files] of matched) {
      if (files.length === 0) out.push(fail('content/skills/field', 9, `no field skill for '${v}'`))
      for (const f of files.slice(1)) out.push(fail(f, 9, `a second field skill for '${v}'`))
    }
  }
  const petSkills = new Set((ctx.skillsByClass.get('pet') ?? []).map((s) => s.id))
  if (petSkills.size > 0) {
    const check = (file: string, label: string, id: unknown): void => {
      const s = str(id)
      if (s !== undefined && petSkills.has(s)) out.push(fail(file, 9, `${label} names pet active '${s}'; pet actives are only referenced from pet.actives`))
    }
    for (const c of ctx.classes.values()) {
      check(c.file, 'ultimateSkillId', c.json.ultimateSkillId)
      for (const id of strs(c.json.starterSkillIds)) check(c.file, 'starterSkillIds', id)
      for (const id of strs(c.json.monsterTechniqueIds)) check(c.file, 'monsterTechniqueIds', id)
    }
    for (const k of ctx.skills.values()) check(k.file, 'prerequisiteId', k.json.prerequisiteId)
    for (const sp of ctx.species.values()) for (const t of objs(sp.json.traits)) check(sp.file, `trait '${str(t.id) ?? '?'}' innateSkillId`, at(t, 'rule', 'innateSkillId'))
    for (const m of ctx.monsters.values()) for (const id of strs(m.json.monsterTechniqueSkillIds)) check(m.file, 'monsterTechniqueSkillIds', id)
    for (const r of ctx.records) {
      walk(r.json, (o, where) => {
        if (o.kind === 'tome') check(r.file, `${where} tome`, o.id)
      })
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 10: every family has all five roles; hunters are hunters; bossIds are bosses of that zone

function rule10(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const roles = new Map<string, Set<string>>()
  for (const m of ctx.monsters.values()) {
    const fam = str(m.json.familyId)
    if (fam === undefined) continue
    const set = roles.get(fam) ?? new Set<string>()
    const role = str(m.json.role)
    if (role !== undefined) set.add(role)
    roles.set(fam, set)
  }
  for (const [fam, set] of roles) {
    const missing = FIVE_ROLES.filter((r) => !set.has(r))
    if (missing.length > 0) out.push(fail('content/monsters', 10, `family '${fam}' has no monster with role ${missing.join(', ')}`))
  }
  for (const d of ctx.dungeons.values()) {
    for (const z of objs(d.json.zones)) {
      const zid = str(z.id) ?? '?'
      const h = str(z.hunterId)
      if (h !== undefined) {
        const m = ctx.monsters.get(h)
        if (m && str(m.json.role) !== 'hunter') out.push(fail(d.file, 10, `zone '${zid}' hunterId '${h}' has role '${str(m.json.role) ?? '?'}', expected hunter`))
      }
      for (const b of strs(z.bossIds)) {
        const m = ctx.monsters.get(b)
        if (!m) continue
        if (str(m.json.role) !== 'boss') out.push(fail(d.file, 10, `zone '${zid}' boss '${b}' has role '${str(m.json.role) ?? '?'}', expected boss`))
        if (str(m.json.zoneId) !== zid || str(m.json.dungeonId) !== d.id) {
          out.push(fail(d.file, 10, `zone '${zid}' boss '${b}' is placed in '${str(m.json.dungeonId) ?? '?'}' / '${str(m.json.zoneId) ?? '?'}', expected '${d.id}' / '${zid}'`))
        }
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 11: boss phases, attack ids, behavior targets, adds, God items as chance lines ≤ 4

function rule11(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const m of ctx.monsters.values()) {
    const attackIds = new Set(objs(m.json.attacks).map((a) => str(a.id)).filter(defined))
    objs(at(m.json, 'behavior', 'rules')).forEach((rule, i) => {
      const then = str(rule.then)
      if (then !== undefined && !NON_ATTACK_THEN.has(then) && !attackIds.has(then)) {
        out.push(fail(m.file, 11, `behavior.rules[${i}].then '${then}' is neither an attack id nor flee/guard/swap row`))
      }
    })
    const boss = obj(m.json.boss)
    if (!boss) continue
    const phases = objs(boss.phases)
    let prev: number | undefined
    phases.forEach((p, i) => {
      const hp = num(p.atHpPercent)
      if (i === 0 && hp !== 100) out.push(fail(m.file, 11, `boss.phases[0].atHpPercent is ${hp ?? '?'}, expected 100`))
      if (hp !== undefined && prev !== undefined && hp >= prev) out.push(fail(m.file, 11, `boss.phases[${i}].atHpPercent ${hp} is not below the previous phase's ${prev}`))
      if (hp !== undefined) prev = hp
      for (const id of strs(p.attacks)) if (!attackIds.has(id)) out.push(fail(m.file, 11, `boss.phases[${i}] attack '${id}' is not one of the monster's attacks`))
      for (const add of objs(p.adds)) {
        const id = str(add.monsterId)
        if (id !== undefined && !ctx.monsters.has(id)) out.push(fail(m.file, 11, `boss.phases[${i}] adds monsterId '${id}' does not exist`))
      }
    })
    // Zone boss 2 phases, final boss 3: final = sits on the dungeon's last floor.
    const d = ctx.dungeons.get(str(m.json.dungeonId) ?? '')
    if (d) {
      const placed = floorsOf(d).filter((x) => str(x.f.bossId) === m.id)
      if (placed.length > 0) {
        const last = maxFloor(d)
        const onLast = placed.some((x) => x.n === last)
        // A dungeon has three zones (03 §11); a file with fewer is a partial dungeon whose last boss is a zone boss until the third zone lands (D-072).
        const complete = objs(d.json.zones).length >= 3
        const isFinal = onLast && complete
        const expected = isFinal ? 3 : 2
        if (phases.length !== expected) out.push(fail(m.file, 11, `${isFinal ? 'final' : 'zone'} boss has ${phases.length} phases, expected ${expected}`))
        if (onLast && !complete) ctx.warnings.push(fail(m.file, 11, `sits on the last written floor of a ${objs(d.json.zones).length}-zone dungeon; the final-boss check (3 phases, an arena rule) waits for the third zone`))
      }
    }
    for (const list of ['everyKill', 'firstKill'] as const) {
      objs(boss[list]).forEach((line, i) => {
        if (str(line.kind) !== 'item') return
        const id = str(line.id)
        const chance = num(line.chance)
        const isGod = id !== undefined ? str(ctx.items.get(id)?.json.grade) === 'God' : str(line.grade) === 'God'
        if (!isGod) return
        if (id === undefined) out.push(fail(m.file, 11, `boss.${list}[${i}] rolls a random God item; God items are named, never rolled`))
        else if (chance === undefined || chance > ctx.t.godChanceMax) {
          out.push(fail(m.file, 11, `boss.${list}[${i}] God item '${id}' needs a chance ≤ ${ctx.t.godChanceMax} (has ${chance ?? 'none'})`))
        }
      })
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 12: roomWeights sum to 100, bossFarthest, room counts

function rule12(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const d of ctx.dungeons.values()) {
    const g = obj(d.json.generator)
    if (!g) continue
    const weights = obj(g.roomWeights) ?? {}
    let rolled = 0
    for (const [k, v] of Object.entries(weights)) {
      if (FIXED_ROOM_KINDS.has(k)) {
        if ((num(v) ?? 0) > 0) out.push(fail(d.file, 12, `generator.roomWeights.${k} is ${String(v)}; '${k}' is placed by the grammar and must be 0 or absent`))
      } else rolled += num(v) ?? 0
    }
    if (rolled !== 100) out.push(fail(d.file, 12, `generator.roomWeights sum to ${rolled} over the rolled kinds, expected 100`))
    if (bool(g.bossFarthest) !== true) out.push(fail(d.file, 12, 'generator.bossFarthest must be true'))
    const minR = num(g.minRooms)
    const maxR = num(g.maxRooms)
    if (minR !== undefined && maxR !== undefined && minR > maxR) out.push(fail(d.file, 12, `generator.minRooms ${minR} > maxRooms ${maxR}`))
    for (const { f, n } of floorsOf(d)) {
      const a = num(f.roomsMin)
      const b = num(f.roomsMax)
      if (a !== undefined && b !== undefined && a > b) out.push(fail(d.file, 12, `floor ${n} roomsMin ${a} > roomsMax ${b}`))
      if (a !== undefined && minR !== undefined && a < minR) out.push(fail(d.file, 12, `floor ${n} roomsMin ${a} is below generator.minRooms ${minR}`))
      if (b !== undefined && maxR !== undefined && b > maxR) out.push(fail(d.file, 12, `floor ${n} roomsMax ${b} is above generator.maxRooms ${maxR}`))
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 13: floors 1..n, zones tile, bosses placed in order on the zone's last floor, hunter clocks

function rule13(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const d of ctx.dungeons.values()) {
    const floors = floorsOf(d).sort((a, b) => a.n - b.n)
    const numbers = floors.map((x) => x.n)
    if (numbers.some((n, i) => n !== i + 1)) out.push(fail(d.file, 13, `floors are numbered ${numbers.join(', ')}; expected 1..${numbers.length} without gaps`))
    const nFloors = numbers.length
    const zones = objs(d.json.zones)
    const zoneById = new Map<string, JsonObject>()
    for (const z of zones) {
      const id = str(z.id)
      if (id !== undefined) zoneById.set(id, z)
    }
    for (const { f, n } of floors) {
      const z = zoneById.get(str(f.zoneId) ?? '')
      const r = z ? zoneRange(z) : undefined
      if (r && (n < r.from || n > r.to)) out.push(fail(d.file, 13, `floor ${n} is in zone '${str(f.zoneId) ?? '?'}' whose floors are ${r.from}–${r.to}`))
    }
    const ranged = zones
      .map((z) => ({ z, id: str(z.id) ?? '?', r: zoneRange(z) }))
      .filter((x): x is { z: JsonObject; id: string; r: { from: number; to: number } } => x.r !== undefined)
      .sort((a, b) => a.r.from - b.r.from)
    ranged.forEach((x, i) => {
      if (x.r.from > x.r.to) out.push(fail(d.file, 13, `zone '${x.id}' floors.from ${x.r.from} > floors.to ${x.r.to}`))
      if (i === 0 && x.r.from !== 1) out.push(fail(d.file, 13, `the first zone '${x.id}' starts at floor ${x.r.from}, expected 1`))
      const prev = ranged[i - 1]
      if (prev && x.r.from !== prev.r.to + 1) out.push(fail(d.file, 13, `zone '${x.id}' starts at floor ${x.r.from} but zone '${prev.id}' ends at ${prev.r.to}; zones must tile the floors`))
      if (i === ranged.length - 1 && nFloors > 0 && x.r.to !== nFloors) out.push(fail(d.file, 13, `the last zone '${x.id}' ends at floor ${x.r.to}, expected the dungeon's last floor ${nFloors}`))
    })
    for (const { z, id: zid, r } of ranged) {
      const zoneFloors = floors.filter((x) => str(x.f.zoneId) === zid)
      const bossIds = strs(z.bossIds)
      let prevFloor = 0
      bossIds.forEach((b, i) => {
        const placed = zoneFloors.filter((x) => str(x.f.bossId) === b).map((x) => x.n)
        if (placed.length !== 1) {
          out.push(fail(d.file, 13, `boss '${b}' of zone '${zid}' is the bossId of ${placed.length} floors in the zone, expected exactly 1`))
          return
        }
        const fn = placed[0] as number
        if (fn <= prevFloor) out.push(fail(d.file, 13, `boss '${b}' sits on floor ${fn}, out of the order of zone '${zid}' bossIds`))
        prevFloor = fn
        if (i === bossIds.length - 1 && fn !== r.to) out.push(fail(d.file, 13, `the last boss '${b}' of zone '${zid}' sits on floor ${fn}, expected the zone's last floor ${r.to}`))
      })
      if (z.hunterId === null) {
        for (const x of zoneFloors) if (x.f.hunterClock !== null) out.push(fail(d.file, 13, `floor ${x.n} has hunterClock ${String(x.f.hunterClock)} in hunter-less zone '${zid}'`))
      }
    }
    for (const { f, n } of floors) {
      const b = str(f.bossId)
      if (b === undefined) continue
      if (f.hunterClock !== null) out.push(fail(d.file, 13, `boss floor ${n} has hunterClock ${String(f.hunterClock)}, expected null`))
      const z = zoneById.get(str(f.zoneId) ?? '')
      if (z && !strs(z.bossIds).includes(b)) out.push(fail(d.file, 13, `floor ${n} bossId '${b}' is not in zone '${str(f.zoneId) ?? '?'}' bossIds`))
      const before = floors.find((x) => x.n === n - 1)
      if (before && bool(before.f.merchant) !== true) out.push(fail(d.file, 13, `floor ${n - 1} must have merchant: true, the floor before boss floor ${n}`))
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 14: eliteAffixCount by band, elitePool floorMin and composition, exactly 12 affixes (gated)

function rule14(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const bandCount = (floor: number): number | undefined => ctx.t.eliteBands.find((b) => floor >= b.min && floor <= b.max)?.count
  for (const d of ctx.dungeons.values()) {
    const offset = d.json.unlockedBy === null || d.json.unlockedBy === undefined ? 0 : 1
    for (const { f, n } of floorsOf(d)) {
      const base = bandCount(n)
      const actual = num(f.eliteAffixCount)
      if (base === undefined || actual === undefined) continue
      if (actual !== base + offset) out.push(fail(d.file, 14, `floor ${n} eliteAffixCount is ${actual}, expected ${base + offset}${offset ? ' (one higher in dungeons 2–4)' : ''}`))
    }
  }
  for (const m of ctx.monsters.values()) {
    const pool = strs(m.json.elitePool)
    const role = str(m.json.role)
    if (role !== undefined && ['boss', 'hunter', 'monster'].includes(role)) {
      if (pool.length > 0) out.push(fail(m.file, 14, `a ${role} must have an empty elitePool (has ${pool.length})`))
      continue
    }
    if (pool.length === 0) continue
    const floors = monsterFloors(ctx, m)
    const lowest = floors[0]
    const classes = { offensive: 0, defensive: 0, control: 0 }
    for (const id of pool) {
      const ea = ctx.eliteAffixes.get(id)
      if (!ea) continue
      const floorMin = num(ea.json.floorMin)
      if (lowest !== undefined && floorMin !== undefined && floorMin > lowest) out.push(fail(m.file, 14, `elitePool '${id}' has floorMin ${floorMin}, above the monster's lowest floor ${lowest}`))
      const ac = str(ea.json.affixClass)
      if (ac === 'offensive' || ac === 'defensive' || ac === 'control') classes[ac]++
    }
    const d = ctx.dungeons.get(str(m.json.dungeonId) ?? '')
    if (d && floors.length > 0) {
      const draws = Math.max(0, ...floorsOf(d).filter((x) => floors.includes(x.n)).map((x) => num(x.f.eliteAffixCount) ?? 0))
      const drawable = classes.offensive + Math.min(1, classes.defensive) + Math.min(1, classes.control)
      const resolved = classes.offensive + classes.defensive + classes.control
      if (resolved === pool.length && drawable < draws) {
        out.push(fail(m.file, 14, `elitePool can supply ${drawable} affixes under "at most one defensive and one control" but floor ${floors[floors.length - 1] ?? '?'} draws ${draws}`))
      }
    }
  }
  if (ctx.eliteAffixes.size > 0 && ctx.eliteAffixes.size !== ctx.t.eliteAffixPool) {
    out.push(fail('content/elite-affixes', 14, `${ctx.eliteAffixes.size} elite affixes exist, expected exactly ${ctx.t.eliteAffixPool}`))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 15: encounter tables cover their floors; compositions total 2–6 with ≤ 2 Specials and ≤ 1 Monster

function rule15(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const encounters = [...ctx.encounters.values()]
  for (const d of ctx.dungeons.values()) {
    for (const { f, n } of floorsOf(d)) {
      for (const tid of strs(f.encounterTableIds)) {
        if (!ctx.encounterTableIds.has(tid)) continue // rule 2
        const covered = encounters.some((e) => str(e.json.tableId) === tid && str(e.json.dungeonId) === d.id && inRange(n, obj(e.json.floorBand)))
        if (!covered) out.push(fail(d.file, 15, `floor ${n} table '${tid}' has no encounter of dungeon '${d.id}' whose floorBand covers floor ${n}`))
      }
    }
  }
  for (const e of encounters) {
    let total = 0
    let specials = 0
    let monsters = 0
    objs(e.json.composition).forEach((c, i) => {
      const count = num(c.count) ?? 0
      total += count
      const m = ctx.monsters.get(str(c.monsterId) ?? '')
      if (!m) return
      const role = str(m.json.role)
      if (role === 'special') specials += count
      if (role === 'monster') monsters += count
      const row = str(c.row)
      if (row !== undefined && !strs(m.json.rows).includes(row)) out.push(fail(e.file, 15, `composition[${i}] places '${m.id}' in row '${row}' but its rows are ${strs(m.json.rows).join('/') || 'none'}`))
    })
    if (total < 2 || total > 6) out.push(fail(e.file, 15, `composition totals ${total} monsters, expected 2–6`))
    if (specials > 2) out.push(fail(e.file, 15, `composition has ${specials} Specials, at most 2`))
    if (monsters > 1) out.push(fail(e.file, 15, `composition has ${monsters} Monster-role monsters, at most 1`))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 16: curio outcomes sum to 100, the safe-item purchase choice, trap difficulty and detection

function rule16(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const d of ctx.dungeons.values()) {
    const floors = floorsOf(d)
    for (const c of objs(d.json.curios)) {
      const cid = str(c.id) ?? '?'
      const choices = objs(c.choices)
      choices.forEach((choice, i) => {
        const outcomes = objs(choice.outcomes)
        if (outcomes.length === 0) return
        const s = sum(outcomes.map((o) => o.chance))
        if (s !== 100) out.push(fail(d.file, 16, `curio '${cid}' choices[${i}] '${str(choice.label) ?? ''}' outcomes sum to ${s}, expected 100`))
      })
      const safe = str(c.safeItemId)
      if (safe !== undefined) {
        const purchases = choices.filter((choice) => {
          const reqs = objs(choice.requires)
          return reqs.length === 1 && str(reqs[0]?.kind) === 'item' && str(reqs[0]?.id) === safe
        })
        if (purchases.length !== 1) out.push(fail(d.file, 16, `curio '${cid}' has safeItemId '${safe}' but ${purchases.length} choices require exactly that one item, expected 1`))
      }
    }
    for (const tr of objs(d.json.traps)) {
      const tid = str(tr.id) ?? '?'
      const difficulty = num(tr.difficulty)
      if (difficulty === undefined) continue
      const zid = str(tr.zoneId)
      const candidates = zid !== undefined ? floors.filter((x) => str(x.f.zoneId) === zid) : floors
      if (candidates.length > 0 && !candidates.some((x) => inRange(difficulty, obj(x.f.trapBand)))) {
        out.push(fail(d.file, 16, `trap '${tid}' difficulty ${difficulty} lies in no floor's trapBand${zid !== undefined ? ` of zone '${zid}'` : ''}`))
      }
      const detection = num(at(tr, 'revealedBy', 'detection'))
      if (detection !== undefined && detection > difficulty) out.push(fail(d.file, 16, `trap '${tid}' revealedBy.detection ${detection} is above its difficulty ${difficulty}`))
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 17: template doors, kinds and budgets; loot tables tile the floors; bossFirstKill on the band's last floor

function rule17(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const checkTemplate = (file: string, tpl: JsonObject, label: string): void => {
    const w = num(at(tpl, 'footprint', 'w'))
    const h = num(at(tpl, 'footprint', 'h'))
    objs(tpl.doors).forEach((door, i) => {
      const side = str(door.side)
      const offset = num(door.offset)
      if (side === undefined || offset === undefined) return
      const extent = side === 'north' || side === 'south' ? w : h
      if (extent !== undefined && (offset < 0 || offset >= extent)) out.push(fail(file, 17, `${label} doors[${i}] offset ${offset} is outside the ${side} side (footprint ${w ?? '?'}×${h ?? '?'})`))
    })
    if (strs(tpl.kinds).length === 0) out.push(fail(file, 17, `${label} kinds is empty; it needs at least one room kind`))
    const tri = num(tpl.triBudget)
    if (tri !== undefined && tri > ctx.t.triBudget) out.push(fail(file, 17, `${label} triBudget ${tri} is above ${ctx.t.triBudget}`))
    const calls = num(tpl.drawCallBudget)
    if (calls !== undefined && calls > ctx.t.drawCallBudget) out.push(fail(file, 17, `${label} drawCallBudget ${calls} is above ${ctx.t.drawCallBudget}`))
  }
  for (const d of ctx.dungeons.values()) for (const tpl of objs(d.json.templates)) checkTemplate(d.file, tpl, `template '${str(tpl.id) ?? '?'}'`)
  for (const tpl of ctx.templateFiles) checkTemplate(tpl.file, tpl.json, 'template')

  for (const d of ctx.dungeons.values()) {
    const tables = [...ctx.lootTables.values()]
      .filter((lt) => str(lt.json.dungeonId) === d.id)
      .map((lt) => ({ lt, min: num(at(lt.json, 'floorBand', 'min')), max: num(at(lt.json, 'floorBand', 'max')) }))
      .filter((x): x is { lt: Rec; min: number; max: number } => x.min !== undefined && x.max !== undefined)
      .sort((a, b) => a.min - b.min)
    const nFloors = maxFloor(d)
    tables.forEach((x, i) => {
      if (x.min > x.max) out.push(fail(x.lt.file, 17, `floorBand min ${x.min} > max ${x.max}`))
      if (i === 0 && x.min !== 1) out.push(fail(x.lt.file, 17, `the first loot table of dungeon '${d.id}' starts at floor ${x.min}, expected 1`))
      const prev = tables[i - 1]
      if (prev && x.min !== prev.max + 1) out.push(fail(x.lt.file, 17, `floorBand starts at ${x.min} but '${prev.lt.id}' ends at ${prev.max}; a dungeon's loot tables tile its floors`))
      if (i === tables.length - 1 && nFloors !== undefined && x.max !== nFloors) out.push(fail(x.lt.file, 17, `the last loot table of dungeon '${d.id}' ends at floor ${x.max}, expected ${nFloors}`))
      const lastFloor = floorsOf(d).find((fl) => fl.n === x.max)
      if (lastFloor) {
        const bossOnFloor = str(lastFloor.f.bossId) ?? null
        const named = str(x.lt.json.bossFirstKill) ?? null
        if (bossOnFloor !== named) out.push(fail(x.lt.file, 17, `bossFirstKill is ${named === null ? 'null' : `'${named}'`} but floor ${x.max} of '${d.id}' has bossId ${bossOnFloor === null ? 'null' : `'${bossOnFloor}'`}`))
      }
    })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 18: presets set the same knobs; Pact weights 1–3; the 12 launch Pacts on the first dungeon (gated)

function rule18(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const d of ctx.dungeons.values()) {
    const presets = obj(d.json.presets)
    const normalKeys = Object.keys(obj(presets?.normal) ?? {})
    for (const name of ['hard', 'dread'] as const) {
      const keys = new Set(Object.keys(obj(presets?.[name]) ?? {}))
      const missing = normalKeys.filter((k) => !keys.has(k))
      if (missing.length > 0) out.push(fail(d.file, 18, `presets.${name} does not set ${missing.join(', ')}, which normal sets`))
    }
    const pacts = objs(d.json.pacts)
    for (const p of pacts) {
      const w = num(p.weight)
      if (w !== undefined && (w < 1 || w > 3)) out.push(fail(d.file, 18, `pact '${str(p.id) ?? '?'}' weight ${w} is outside 1–3`))
    }
    const isFirst = d.json.unlockedBy === null
    if (isFirst && pacts.length > 0 && pacts.length !== ctx.t.launchPacts) out.push(fail(d.file, 18, `the first dungeon has ${pacts.length} Pacts, expected the ${ctx.t.launchPacts} launch Pacts`))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 19: affixSlots and maxPlusN match the grade (gear kinds)

function rule19(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const it of ctx.items.values()) {
    if (!GEAR_KINDS.has(str(it.json.kind) ?? '')) continue
    const grade = str(it.json.grade)
    const row = grade !== undefined ? ctx.t.gradeRows.get(grade) : undefined
    if (!row) continue
    const slots = num(it.json.affixSlots)
    if (slots !== undefined && slots !== row.affixSlots) out.push(fail(it.file, 19, `affixSlots is ${slots}, grade ${grade} has ${row.affixSlots}`))
    const plus = num(it.json.maxPlusN)
    if (plus !== undefined && plus !== row.maxPlusN) out.push(fail(it.file, 19, `maxPlusN is ${plus}, grade ${grade} caps at +${row.maxPlusN}`))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 20: rolled affixes fit the slots, the band and the item's slot; a set line spends one slot

function rule20(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const it of ctx.items.values()) {
    const slots = num(it.json.affixSlots)
    const affixes = objs(it.json.affixes)
    if (slots !== undefined && affixes.length > slots) out.push(fail(it.file, 20, `${affixes.length} affixes rolled with affixSlots ${slots}`))
    const setId = str(it.json.setId)
    if (setId !== undefined && slots !== undefined && affixes.length > slots - 1) out.push(fail(it.file, 20, `set piece of '${setId}' spends one slot on its set line: ${affixes.length} affixes with affixSlots ${slots}`))
    const gi = gradeIdx(ctx, it.json.grade)
    const slot = str(it.json.slot)
    affixes.forEach((a, i) => {
      const af = ctx.affixes.get(str(a.affixId) ?? '')
      if (!af) return
      if (slot === undefined) out.push(fail(it.file, 20, `affixes[${i}] '${af.id}' on an item with no slot`))
      else if (!strs(af.json.slots).includes(slot)) out.push(fail(it.file, 20, `affixes[${i}] '${af.id}' does not roll on slot '${slot}'`))
      const line = objs(af.json.lines).find((l) => gradeIdx(ctx, l.bandMin) <= gi && gi <= gradeIdx(ctx, l.bandMax))
      if (!line) {
        out.push(fail(it.file, 20, `affixes[${i}] '${af.id}' has no band covering grade ${str(it.json.grade) ?? '?'}`))
        return
      }
      const value = num(a.value)
      const min = num(line.min)
      const max = num(line.max)
      if (value !== undefined && min !== undefined && max !== undefined && (value < min || value > max)) {
        out.push(fail(it.file, 20, `affixes[${i}] '${af.id}' value ${value} is outside ${min}–${max} for grade ${str(it.json.grade) ?? '?'}`))
      }
    })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 21: durability ≤ maxDurability (items and hero item instances)

function rule21(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const check = (file: string, label: string, o: JsonObject): void => {
    const d = num(o.durability)
    const m = num(o.maxDurability)
    if (d !== undefined && m !== undefined && d > m) out.push(fail(file, 21, `${label}durability ${d} is above maxDurability ${m}`))
  }
  for (const it of ctx.items.values()) check(it.file, '', it.json)
  for (const h of ctx.heroes) for (const { where, inst } of heroItemInstances(h.json)) check(h.file, `${where} `, inst)
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 22: materialRung = grade index (null with null ladder); baseStats scale by grade across a shared mesh

function rule22(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const byMesh = new Map<string, Rec[]>()
  for (const it of ctx.items.values()) {
    const gi = gradeIdx(ctx, it.json.grade)
    const ladder = it.json.materialLadder
    const rung = it.json.materialRung
    if (ladder === null) {
      if (rung !== null && rung !== undefined) out.push(fail(it.file, 22, `materialRung is ${String(rung)} with materialLadder null; expected null`))
    } else if (typeof ladder === 'string') {
      if (rung === null) out.push(fail(it.file, 22, `materialRung is null with materialLadder '${ladder}'; expected ${gi}`))
      else if (num(rung) !== gi && gi >= 0) out.push(fail(it.file, 22, `materialRung ${String(rung)} differs from grade ${str(it.json.grade) ?? '?'} index ${gi} on the ladder`))
    }
    const mesh = str(at(it.json, 'visual', 'meshId'))
    if (mesh !== undefined) {
      const list = byMesh.get(mesh) ?? []
      list.push(it)
      byMesh.set(mesh, list)
    }
  }
  const fGrade = ctx.t.grades[0] ?? 'F'
  for (const [mesh, items] of byMesh) {
    const base = items.find((it) => str(it.json.grade) === fGrade)
    if (!base) continue
    const baseStats = obj(base.json.baseStats) ?? {}
    for (const it of items) {
      if (it === base) continue
      const grade = str(it.json.grade)
      const mult = grade !== undefined ? ctx.t.gradeRows.get(grade)?.baseMultiplier : undefined
      if (mult === undefined) continue
      const stats = obj(it.json.baseStats) ?? {}
      for (const k of new Set([...Object.keys(baseStats), ...Object.keys(stats)])) {
        const fv = num(baseStats[k])
        const v = num(stats[k])
        if (fv === undefined || v === undefined) {
          out.push(fail(it.file, 22, `baseStats.${k} is on only one of '${it.id}' and the F piece '${base.id}' (shared mesh '${mesh}')`))
          continue
        }
        // 08 preamble, §2, §2.3: percentages, Block and penalties "do not ride the ladder" — a line equal to the F piece's is flat (D-072).
        if (v === fv) continue
        // 08 §2.3: a shield's Block steps +2 pp per grade instead of riding the multiplier.
        if (k === 'block' && v === fv + ctx.t.blockStepPerGrade * gradeIdx(ctx, grade)) continue
        const expected = fv * mult
        if (Math.abs(v - expected) >= 1) out.push(fail(it.file, 22, `baseStats.${k} is ${v}; the F piece '${base.id}' has ${fv} × ${mult} (grade ${grade}) = ${expected.toFixed(2)} (shared mesh '${mesh}')`))
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 23: God items are unique with a power, one per slot, never in a random table

function rule23(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const god = ctx.t.grades[ctx.t.grades.length - 1] ?? 'God'
  const godIdx = ctx.t.grades.length - 1
  const bySlot = new Map<string, Rec[]>()
  const isGodItem = (id: unknown): boolean => str(ctx.items.get(str(id) ?? '')?.json.grade) === god
  for (const it of ctx.items.values()) {
    if (str(it.json.grade) !== god) continue
    if (bool(it.json.unique) !== true) out.push(fail(it.file, 23, 'a God item must have unique: true'))
    if (!isObj(it.json.uniquePower)) out.push(fail(it.file, 23, 'a God item must carry a uniquePower'))
    const slot = str(it.json.slot) ?? 'none'
    const list = bySlot.get(slot) ?? []
    list.push(it)
    bySlot.set(slot, list)
  }
  for (const [slot, items] of bySlot) {
    if (items.length > 1) for (const it of items.slice(1)) out.push(fail(it.file, 23, `a second God item in slot '${slot}' (with '${items[0]?.id ?? '?'}'); one per slot`))
  }
  for (const c of ctx.chests.values()) {
    objs(c.json.oddsByBand).forEach((entry, i) => {
      const v = num(at(entry, 'table', god))
      if (v !== undefined && v > 0) out.push(fail(c.file, 23, `oddsByBand[${i}] gives God ${v}%; a chest never gives God above 0`))
    })
  }
  for (const lt of ctx.lootTables.values()) {
    const gs = obj(lt.json.gradeShape)
    if (gs) {
      const ci = gradeIdx(ctx, gs.centreGrade)
      if (ci === godIdx) out.push(fail(lt.file, 23, 'gradeShape.centreGrade is God; a loot table never reaches God'))
      for (const [key, step] of [
        ['plus1', 1],
        ['plus2', 2],
        ['plus3', 3],
      ] as const) {
        if ((num(gs[key]) ?? 0) > 0 && ci >= 0 && ci + step >= godIdx) out.push(fail(lt.file, 23, `gradeShape.${key} ${String(gs[key])}% reaches God from centre ${str(gs.centreGrade) ?? '?'}`))
      }
    }
    for (const id of strs(at(lt.json, 'consumableDrop', 'itemIds'))) if (isGodItem(id)) out.push(fail(lt.file, 23, `consumableDrop names God item '${id}'`))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 24: affix line bands do not overlap and run in ladder order

function rule24(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const af of ctx.affixes.values()) {
    let prevMax = -1
    objs(af.json.lines).forEach((line, i) => {
      const a = gradeIdx(ctx, line.bandMin)
      const b = gradeIdx(ctx, line.bandMax)
      if (a < 0 || b < 0) return
      if (a > b) out.push(fail(af.file, 24, `lines[${i}] bandMin ${str(line.bandMin) ?? ''} is above bandMax ${str(line.bandMax) ?? ''}`))
      if (a <= prevMax) out.push(fail(af.file, 24, `lines[${i}] band ${str(line.bandMin) ?? ''}–${str(line.bandMax) ?? ''} overlaps or is out of ladder order with the previous line`))
      prevMax = Math.max(prevMax, b)
    })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 25: set pieces carry the setId, fill the family's five slots or the ring pair, share the class lock

function rule25(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const s of ctx.sets.values()) {
    const family = str(s.json.family)
    const classIds = strs(s.json.classIds)
    const slots: string[] = []
    for (const id of strs(s.json.pieces)) {
      const it = ctx.items.get(id)
      if (!it) continue
      if (str(it.json.setId) !== s.id) out.push(fail(s.file, 25, `piece '${id}' has setId ${JSON.stringify(it.json.setId ?? null)}, expected '${s.id}'`))
      const slot = str(it.json.slot)
      if (slot !== undefined) slots.push(slot)
      if (family === 'ringPair') {
        if (str(it.json.kind) !== 'ring' || slot !== 'ring') out.push(fail(s.file, 25, `piece '${id}' of a ring pair is a ${str(it.json.kind) ?? '?'} in slot '${slot ?? '?'}', expected a ring`))
      } else if (family !== undefined) {
        if (str(it.json.kind) !== 'armor' || str(it.json.armorFamily) !== family) out.push(fail(s.file, 25, `piece '${id}' is ${str(it.json.kind) ?? '?'}/${str(it.json.armorFamily) ?? 'no family'}, expected ${family} armor`))
      }
      if (!sameSet(strs(it.json.classLock), classIds)) out.push(fail(s.file, 25, `piece '${id}' classLock [${strs(it.json.classLock).join(', ')}] differs from the set's classIds [${classIds.join(', ')}]`))
    }
    if (slots.length === strs(s.json.pieces).length) {
      if (family === 'ringPair') {
        if (slots.length !== 2) out.push(fail(s.file, 25, `a ring pair has ${slots.length} pieces, expected 2`))
      } else if (family !== undefined && !sameSet(slots, [...ARMOR_SLOTS])) {
        out.push(fail(s.file, 25, `pieces fill slots [${slots.sort().join(', ')}], expected each of ${ARMOR_SLOTS.join(', ')} once`))
      }
    }
    const gmin = gradeIdx(ctx, s.json.gradeMin)
    const gmax = gradeIdx(ctx, s.json.gradeMax)
    if (gmin >= 0 && gmax >= 0 && gmin > gmax) out.push(fail(s.file, 25, `gradeMin ${str(s.json.gradeMin) ?? ''} is above gradeMax ${str(s.json.gradeMax) ?? ''}`))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 26: chest tables sum to 100 with nothing below the centre; Grand = Standard shifted up; pity order

function rule26(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const grades = ctx.t.grades
  const shiftUp = (table: JsonObject): Map<string, number> => {
    const expected = new Map<string, number>()
    for (const [g, v] of Object.entries(table)) {
      const gi = grades.indexOf(g)
      if (gi < 0) continue
      // A share that would land on God folds into SS (08 §10.1).
      const target = gi + 1 >= grades.length - 1 ? grades[grades.length - 2] ?? g : grades[gi + 1] ?? g
      expected.set(target, (expected.get(target) ?? 0) + (num(v) ?? 0))
    }
    return expected
  }
  const matches = (expected: Map<string, number>, table: JsonObject): boolean =>
    [...new Set([...expected.keys(), ...Object.keys(table)])].every((g) => (expected.get(g) ?? 0) === (num(table[g]) ?? 0))

  const chests = [...ctx.chests.values()]
  for (const c of chests) {
    objs(c.json.oddsByBand).forEach((entry, i) => {
      const table = obj(entry.table) ?? {}
      const s = sum(Object.values(table))
      const centre = str(entry.centreGrade) ?? '?'
      if (s !== 100) out.push(fail(c.file, 26, `oddsByBand[${i}] (centre ${centre}) sums to ${s}, expected 100`))
      const ci = gradeIdx(ctx, entry.centreGrade)
      for (const g of Object.keys(table)) {
        const gi = grades.indexOf(g)
        if (gi >= 0 && ci >= 0 && gi < ci) out.push(fail(c.file, 26, `oddsByBand[${i}] lists grade ${g}, below the centre ${centre}`))
      }
    })
    // 08 §10 (the owner of chest odds, D-072): a Grand gear or egg chest's table is +1 45 · +2 35 · +3 15 · +4 5 with any
    // God share folded into SS (the sim turns the +4 line into the Divine Shard from band D, D-067). Crates and tomes
    // carry a table for the schema's sake only (08 §8.5: a Grand crate is 20 units of the same rung + a rare part).
    const kind = str(c.json.kind)
    if (str(c.json.tier) === 'grand' && (kind === 'gear' || kind === 'petEgg')) {
      objs(c.json.oddsByBand).forEach((entry, i) => {
        const centre = str(entry.centreGrade)
        const ci = gradeIdx(ctx, centre)
        if (ci < 0) return
        const expected = new Map<string, number>()
        for (const [step, share] of [
          [1, 45],
          [2, 35],
          [3, 15],
          [4, 5],
        ] as const) {
          const gi = Math.min(ci + step, grades.length - 2) // God folds into SS
          const g = grades[gi] ?? centre ?? '?'
          expected.set(g, (expected.get(g) ?? 0) + share)
        }
        const table = obj(entry.table) ?? {}
        if (!matches(expected, table)) out.push(fail(c.file, 26, `oddsByBand[${i}] (centre ${centre ?? '?'}) is not 08 §10's Grand shape ${[...expected].map(([g, v]) => `${g} ${v}`).join(' · ')}`))
      })
    }
    void shiftUp
    const p1 = num(at(c.json, 'pity', 'plusOneWithin'))
    const p2 = num(at(c.json, 'pity', 'plusTwoWithin'))
    if (p1 !== undefined && p2 !== undefined && p1 >= p2) out.push(fail(c.file, 26, `pity.plusOneWithin ${p1} must be below plusTwoWithin ${p2}`))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 27: gradeShape sums to 100; minus1 is 0 at centre F

function rule27(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const lt of ctx.lootTables.values()) {
    const gs = obj(lt.json.gradeShape)
    if (!gs) continue
    const s = sum([gs.centre, gs.minus1, gs.plus1, gs.plus2, gs.plus3])
    if (s !== 100) out.push(fail(lt.file, 27, `gradeShape sums to ${s} (centre + minus1 + plus1 + plus2 + plus3), expected 100`))
    if (gradeIdx(ctx, gs.centreGrade) === 0 && (num(gs.minus1) ?? 0) !== 0) out.push(fail(lt.file, 27, `gradeShape.minus1 is ${String(gs.minus1)} with centre ${str(gs.centreGrade) ?? ''}; the fold goes into centre`))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 28: pet actives by grade band, unlock order and levels, classId pet; creation pets ≤ A

function rule28(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const aIdx = ctx.t.grades.indexOf('A')
  for (const p of ctx.pets.values()) {
    const actives = objs(p.json.actives)
    const gmin = gradeIdx(ctx, at(p.json, 'gradeBand', 'min'))
    const gmax = gradeIdx(ctx, at(p.json, 'gradeBand', 'max'))
    const maxGrade = str(at(p.json, 'gradeBand', 'max'))
    if (gmin >= 0 && gmax >= 0 && gmin > gmax) out.push(fail(p.file, 28, `gradeBand.min ${str(at(p.json, 'gradeBand', 'min')) ?? ''} is above gradeBand.max ${maxGrade ?? ''}`))
    if (bool(p.json.creationChoice) === true && aIdx >= 0 && (gmin > aIdx || gmax > aIdx)) out.push(fail(p.file, 28, `a creationChoice pet's gradeBand must stay ≤ A (has ${str(at(p.json, 'gradeBand', 'min')) ?? '?'}–${maxGrade ?? '?'})`))
    const allowed = maxGrade !== undefined ? ctx.t.activesByGrade.get(maxGrade) : undefined
    if (allowed !== undefined && actives.length < allowed) out.push(fail(p.file, 28, `lists ${actives.length} actives but gradeBand.max ${maxGrade ?? ''} allows ${allowed}`))
    if (actives.length > 3) out.push(fail(p.file, 28, `lists ${actives.length} actives, never more than 3`))
    actives.forEach((a, i) => {
      const level = num(a.unlockLevel)
      const prev = num(actives[i - 1]?.unlockLevel)
      if (level !== undefined && prev !== undefined && level <= prev) out.push(fail(p.file, 28, `actives[${i}] unlocks at ${level}, not after actives[${i - 1}] at ${prev}; list them in unlock order`))
      const expected = ctx.t.activeUnlockLevels[i]
      if (level !== undefined && expected !== undefined && level !== expected) out.push(fail(p.file, 28, `actives[${i}] unlocks at ${level}, expected ${expected}`))
      const sk = ctx.skills.get(str(a.skillId) ?? '')
      if (sk && str(sk.json.classId) !== 'pet') out.push(fail(p.file, 28, `actives[${i}] '${sk.id}' has classId '${str(sk.json.classId) ?? '?'}', expected 'pet'`))
    })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 29: hero presets by species, naturalArmor, free points, creation values (saves only)

function rule29(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const h of ctx.heroes) {
    const sp = ctx.species.get(str(h.json.speciesId) ?? '')
    const cl = ctx.classes.get(str(h.json.classId) ?? '')
    const presets = objs(h.json.loadoutPresets)
    if (sp) {
      const traits = objs(sp.json.traits)
      let allowed = ctx.t.defaultLoadoutPresets
      let hasNaturalArmor = false
      for (const t of traits) {
        const lp = num(at(t, 'rule', 'loadoutPresets'))
        if (lp !== undefined) allowed = Math.max(allowed, lp)
        if (num(at(t, 'rule', 'naturalArmorBase')) !== undefined) hasNaturalArmor = true
      }
      if (presets.length > allowed) out.push(fail(h.file, 29, `${presets.length} loadoutPresets; species '${sp.id}' allows ${allowed}`))
      const na = isObj(h.json.naturalArmor)
      if (na !== hasNaturalArmor) out.push(fail(h.file, 29, `naturalArmor is ${na ? 'set' : 'null'} but species '${sp.id}' ${hasNaturalArmor ? 'sets' : 'does not set'} naturalArmorBase`))
    }
    const fps = num(h.json.freePointsSpent)
    if (fps !== undefined && fps > ctx.t.freePoints) out.push(fail(h.file, 29, `freePointsSpent ${fps} is above ${ctx.t.freePoints}`))
    if (sp && cl && fps !== undefined) {
      const cv = obj(h.json.creationValues) ?? {}
      const spMods = obj(sp.json.attributeMods) ?? {}
      const clMods = obj(cl.json.attributeMods) ?? {}
      const total = sum(Object.values(cv))
      const expected = ctx.t.attributeBase * Object.keys(cv).length + sum(Object.values(spMods)) + sum(Object.values(clMods)) + fps
      if (total !== expected) out.push(fail(h.file, 29, `creationValues sum to ${total}; ${ctx.t.attributeBase} × ${Object.keys(cv).length} + species ${sum(Object.values(spMods))} + class ${sum(Object.values(clMods))} + ${fps} free points = ${expected}`))
      for (const [attr, v] of Object.entries(cv)) {
        const floor = ctx.t.attributeBase + (num(spMods[attr]) ?? 0) + (num(clMods[attr]) ?? 0)
        if ((num(v) ?? floor) < floor) out.push(fail(h.file, 29, `creationValues.${attr} is ${String(v)}, below ${ctx.t.attributeBase} + species + class = ${floor}`))
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 30: hero skills, loadouts, equipment, level and titles (saves only)

function rule30(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const h of ctx.heroes) {
    const classId = str(h.json.classId) ?? '?'
    const sp = ctx.species.get(str(h.json.speciesId) ?? '')
    const innate = new Set(objs(sp?.json.traits).map((t) => str(at(t, 'rule', 'innateSkillId'))).filter(defined))
    const known = new Map<string, Rec>()
    let ranks = 0
    for (const s of objs(h.json.skills)) {
      ranks += num(s.rank) ?? 0
      const id = str(s.skillId)
      if (id === undefined) continue
      const sk = ctx.skills.get(id)
      if (!sk) continue
      known.set(id, sk)
      const c = str(sk.json.classId)
      if (c !== classId && c !== 'field' && !innate.has(id)) out.push(fail(h.file, 30, `skill '${id}' belongs to class '${c ?? '?'}'; the hero is a '${classId}'`))
    }
    const knownIds = new Set(objs(h.json.skills).map((s) => str(s.skillId)).filter(defined))
    const checkLoadout = (lo: unknown, label: string): void => {
      for (const [key, type] of [
        ['actives', 'active'],
        ['passives', 'passive'],
      ] as const) {
        for (const id of strs(at(lo, key))) {
          if (!knownIds.has(id)) {
            out.push(fail(h.file, 30, `${label}.${key} '${id}' is not among the hero's known skills`))
            continue
          }
          const sk = known.get(id)
          if (sk && str(sk.json.type) !== type) out.push(fail(h.file, 30, `${label}.${key} '${id}' is a ${str(sk.json.type) ?? '?'} skill`))
        }
      }
    }
    checkLoadout(h.json.loadout, 'loadout')
    objs(h.json.loadoutPresets).forEach((p, i) => checkLoadout(p.loadout, `loadoutPresets[${i}]`))

    const eq = obj(h.json.equipment)
    const checkItem = (where: string, inst: JsonObject, slot: string): void => {
      const it = ctx.items.get(str(inst.itemId) ?? '')
      if (!it) return
      if (str(it.json.slot) !== slot) out.push(fail(h.file, 30, `${where} holds '${it.id}' whose slot is '${str(it.json.slot) ?? 'null'}'`))
      if (slot === 'ring' && str(it.json.kind) !== 'ring') out.push(fail(h.file, 30, `${where} holds '${it.id}', a ${str(it.json.kind) ?? '?'}, not a ring`))
      const lock = strs(it.json.classLock)
      if (lock.length > 0 && !lock.includes(classId)) out.push(fail(h.file, 30, `${where} '${it.id}' is locked to [${lock.join(', ')}]; the hero is a '${classId}'`))
    }
    for (const slot of EQUIPMENT_SINGLE_SLOTS) {
      const inst = obj(eq?.[slot])
      if (inst) checkItem(`equipment.${slot}`, inst, slot)
    }
    objs(eq?.ring).forEach((inst, i) => checkItem(`equipment.ring[${i}]`, inst, 'ring'))

    const level = num(h.json.level)
    // D-082 (Final Fantasy-style levels): the level is the one battleXp reaches on the tuning curve.
    const xp = num(h.json.battleXp)
    if (level !== undefined && xp !== undefined) {
      let lv = 1
      let left = xp
      const cost = (n: number) => Math.round(ctx.t.heroXpBase * Math.pow(ctx.t.heroXpGrowth, n - 2))
      while (lv < ctx.t.heroLevelCap && left >= cost(lv + 1)) {
        left -= cost(lv + 1)
        lv++
      }
      if (level !== lv) out.push(fail(h.file, 30, `level ${level} but battleXp ${xp} reaches level ${lv}`))
    }
    void ranks

    for (const title of strs(h.json.titles)) if (!ctx.rewardTitles.has(title)) out.push(fail(h.file, 30, `title '${title}' is granted by no reward line`))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 31: every customId has a handler sim/src/skills/custom/<customId>.ts (gated on the folder existing)

function rule31(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const dir = path.join(ctx.corpus.rootDir, 'sim', 'src', 'skills', 'custom')
  if (!fs.existsSync(dir)) return out
  const handlers = new Set(
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => f.slice(0, -3)),
  )
  for (const r of ctx.records) {
    walk(r.json, (o, where) => {
      if (o.kind !== 'custom') return
      const id = str(o.customId)
      if (id !== undefined && !handlers.has(id)) out.push(fail(r.file, 31, `custom effect '${id}' at ${where} has no handler sim/src/skills/custom/${id}.ts`))
    })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 32: a tuning leaf written as { value } carries a non-empty note and nothing else.
// tuning.schema.json cannot see this: its nested-table branch of $defs/node accepts any object whose keys match
// the name pattern, so { "value": 3 } passes as a table with a key called value. (A schema fix is proposed in
// the linter's hand-over; this rule stays as belt and braces.)

function rule32(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const f of ctx.corpus.byKind.get('tuning') ?? []) {
    walk(f.json, (o, where) => {
      if (!('value' in o)) return
      const label = where || '/'
      const note = str(o.note)
      if (note === undefined || note.length === 0) out.push(fail(f.path, 32, `${label} is a { value } leaf without a note; write the bare number or { value, note }`))
      const extra = Object.keys(o).filter((k) => k !== 'value' && k !== 'note')
      if (extra.length > 0) out.push(fail(f.path, 32, `${label} mixes a { value } leaf with other keys (${extra.join(', ')})`))
    })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 33: secret rooms (07 §2.6) — unique ids per dungeon; each grants something (rewards, a chest, a blessing, a
// shortcut, a reveal or light); a blessing carries effect lines; secrets reward, never gate.

function rule33(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const d of ctx.dungeons.values()) {
    const seen = new Set<string>()
    for (const s of objs(d.json.secrets)) {
      const sid = str(s.id) ?? '?'
      if (seen.has(sid)) out.push(fail(d.file, 33, `secret id '${sid}' is used twice`))
      seen.add(sid)
      const rewards = objs(s.rewards)
      const blessing = obj(s.blessing)
      const grants = rewards.length > 0 || (s.chest !== null && s.chest !== undefined) || blessing !== undefined || s.shortcutToExit === true || s.revealsFloor === true || (num(s.lightBonus) ?? 0) !== 0 || (s.fieldSkillXp !== null && s.fieldSkillXp !== undefined)
      if (!grants) out.push(fail(d.file, 33, `secret '${sid}' grants nothing (07 §2.6: secrets reward)`))
      if (blessing !== undefined && objs(blessing.effects).length === 0) out.push(fail(d.file, 33, `secret '${sid}' blessing '${str(blessing.name) ?? '?'}' has no effect lines`))
      for (const [i, r] of rewards.entries()) {
        const chance = num(r.chance)
        if (chance !== undefined && (chance <= 0 || chance > 100)) out.push(fail(d.file, 33, `secret '${sid}' rewards[${i}] chance ${chance} is outside 1–100`))
        if (str(r.kind) === 'item' && r.id === undefined && r.grade === undefined) out.push(fail(d.file, 33, `secret '${sid}' rewards[${i}] is an item line with neither id nor grade`))
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 34: the Wayfarer Chest's cast (D-091) — each wayfarer's species, class and three Tier I skills resolve (at
// least one active, at most two passives); creation points are 6 + 1 per grade above D; names are unique; and every
// grade a wayfarer chest's table names has someone in the cast.

const WAYFARER_GRADE_ORDER = ['D', 'C', 'B', 'A'] as const

function rule34(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const names = new Map<string, string>()
  const byGrade = new Map<string, number>()
  for (const w of ctx.wayfarers.values()) {
    const species = str(w.json.speciesId)
    const classId = str(w.json.classId)
    if (species !== undefined && !ctx.species.has(species)) out.push(fail(w.file, 34, `species '${species}' does not exist`))
    if (classId !== undefined && !ctx.classes.has(classId)) out.push(fail(w.file, 34, `class '${classId}' does not exist`))
    let actives = 0
    let passives = 0
    for (const id of strs(w.json.starterSkillIds)) {
      const sk = ctx.skills.get(id)
      if (!sk) {
        out.push(fail(w.file, 34, `starter skill '${id}' does not exist`))
        continue
      }
      if (str(sk.json.classId) !== classId) out.push(fail(w.file, 34, `starter skill '${id}' belongs to ${str(sk.json.classId) ?? '?'}, not ${classId ?? '?'}`))
      if (num(sk.json.tier) !== 1) out.push(fail(w.file, 34, `starter skill '${id}' is Tier ${num(sk.json.tier) ?? '?'}, expected Tier I`))
      if (sk.json.isUltimate === true) out.push(fail(w.file, 34, `starter skill '${id}' is an Ultimate`))
      if (str(sk.json.type) === 'passive') passives++
      else actives++
    }
    if (actives < 1) out.push(fail(w.file, 34, 'needs at least one active starter skill'))
    if (passives > 2) out.push(fail(w.file, 34, `has ${passives} passive starters; the loadout holds two`))
    const grade = str(w.json.grade) ?? 'D'
    byGrade.set(grade, (byGrade.get(grade) ?? 0) + 1)
    const expected = ctx.t.freePoints + Math.max(0, WAYFARER_GRADE_ORDER.indexOf(grade as (typeof WAYFARER_GRADE_ORDER)[number]))
    const spent = sum(Object.values(obj(w.json.freePoints) ?? {}))
    if (spent !== expected) out.push(fail(w.file, 34, `spends ${spent} creation points; a grade ${grade} wayfarer has ${expected} (6 + 1 per grade above D)`))
    const name = (str(w.json.name) ?? '').toLowerCase()
    const first = names.get(name)
    if (first !== undefined) out.push(fail(w.file, 34, `name '${str(w.json.name) ?? ''}' is also used by ${first}`))
    else names.set(name, w.file)
  }
  for (const c of ctx.chests.values()) {
    if (str(c.json.kind) !== 'wayfarer') continue
    objs(c.json.oddsByBand).forEach((entry, i) => {
      for (const [g, v] of Object.entries(obj(entry.table) ?? {})) {
        if ((num(v) ?? 0) <= 0) continue
        if (!(WAYFARER_GRADE_ORDER as readonly string[]).includes(g)) out.push(fail(c.file, 34, `oddsByBand[${i}] lists grade ${g}; wayfarers are graded D–A`))
        else if (ctx.wayfarers.size > 0 && (byGrade.get(g) ?? 0) === 0) out.push(fail(c.file, 34, `oddsByBand[${i}] gives grade ${g} ${num(v) ?? 0}% but no wayfarer of the cast is grade ${g}`))
      }
    })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------

export const RULES: ReadonlyArray<{ n: number; run: (ctx: Ctx) => Failure[] }> = [
  { n: 1, run: rule1 },
  { n: 2, run: rule2 },
  { n: 3, run: rule3 },
  { n: 4, run: rule4 },
  { n: 5, run: rule5 },
  { n: 6, run: rule6 },
  { n: 7, run: rule7 },
  { n: 8, run: rule8 },
  { n: 9, run: rule9 },
  { n: 10, run: rule10 },
  { n: 11, run: rule11 },
  { n: 12, run: rule12 },
  { n: 13, run: rule13 },
  { n: 14, run: rule14 },
  { n: 15, run: rule15 },
  { n: 16, run: rule16 },
  { n: 17, run: rule17 },
  { n: 18, run: rule18 },
  { n: 19, run: rule19 },
  { n: 20, run: rule20 },
  { n: 21, run: rule21 },
  { n: 22, run: rule22 },
  { n: 23, run: rule23 },
  { n: 24, run: rule24 },
  { n: 25, run: rule25 },
  { n: 26, run: rule26 },
  { n: 27, run: rule27 },
  { n: 28, run: rule28 },
  { n: 29, run: rule29 },
  { n: 30, run: rule30 },
  { n: 31, run: rule31 },
  { n: 32, run: rule32 },
  { n: 33, run: rule33 },
  { n: 34, run: rule34 },
]

/** Runs every rule over the corpus. A rule that throws becomes a failure, never a silent pass. */
export function runRules(corpus: Corpus, skipRules: ReadonlySet<number> = new Set()): { failures: Failure[]; warnings: Failure[] } {
  const ctx = buildCtx(corpus)
  const failures: Failure[] = []
  for (const rule of RULES) {
    if (skipRules.has(rule.n)) continue
    try {
      failures.push(...rule.run(ctx))
    } catch (e) {
      failures.push(fail('tools/lint/rules.ts', rule.n, `rule crashed: ${e instanceof Error ? e.message : String(e)}`))
    }
  }
  return { failures, warnings: ctx.warnings }
}
