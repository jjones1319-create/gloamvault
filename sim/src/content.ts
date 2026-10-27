/**
 * The content layer of the sim: where a content file's kind comes from (its path under content/, README "Layout"),
 * and `buildContent`, which turns a list of already-parsed JSON files into one immutable, indexed `Content` bundle.
 *
 * Pure: no fs, no fetch, no validation beyond what the indexing needs. The linter (`npm run lint`) guarantees the
 * corpus; the client (import.meta.glob) and the tools (readFileSync) read the files and hand them in. Every index
 * is built in sorted-id order so iteration is deterministic whatever order the files arrived in.
 */
import type { Tuning } from './tuning.ts'
import type {
  AffixDef,
  ChestDef,
  ClassDef,
  ContentId,
  ContractDef,
  DungeonDef,
  EliteAffixDef,
  EncounterDef,
  ItemDef,
  ItemSetDef,
  LootTableDef,
  MonsterDef,
  PetDef,
  SkillDef,
  SpeciesDef,
  StatusDef,
  TemplateDef,
  WayfarerDef,
} from './types/content.ts'
import type { ItemKind, Status } from './types/enums.ts'

/** Every content kind. Each is a schema name except `template` (dungeon.schema.json#/$defs/template). */
export const CONTENT_KINDS = [
  'class',
  'species',
  'skill',
  'item',
  'affix',
  'item-set',
  'monster',
  'elite-affix',
  'dungeon',
  'template',
  'encounter',
  'pet',
  'chest',
  'loot-table',
  'contract',
  'status',
  'wayfarer',
  'tuning',
] as const
export type ContentKind = (typeof CONTENT_KINDS)[number]

/** A content file before indexing: its kind (from the path), the path for messages, the parsed JSON. */
export interface RawContentFile {
  readonly kind: ContentKind
  /** Where it came from, for error messages; conventionally the path under content/ with forward slashes. */
  readonly path: string
  readonly json: unknown
  /** For a `template` (and a `dungeon`): the <dungeon> folder it sits under. */
  readonly dungeonId?: string
}

/** What `kindForContentPath` found. */
export interface ContentPathKind {
  readonly kind: ContentKind
  readonly dungeonId?: string
}

/** The whole corpus, indexed by id and by the lookups the sim needs most. */
export interface Content {
  readonly tuning: Tuning
  readonly classes: ReadonlyMap<ContentId, ClassDef>
  readonly species: ReadonlyMap<ContentId, SpeciesDef>
  readonly skills: ReadonlyMap<ContentId, SkillDef>
  readonly items: ReadonlyMap<ContentId, ItemDef>
  readonly affixes: ReadonlyMap<ContentId, AffixDef>
  readonly sets: ReadonlyMap<ContentId, ItemSetDef>
  readonly monsters: ReadonlyMap<ContentId, MonsterDef>
  readonly eliteAffixes: ReadonlyMap<ContentId, EliteAffixDef>
  /** Each dungeon with its templates/<id>.json files merged into `templates`. */
  readonly dungeons: ReadonlyMap<ContentId, DungeonDef>
  readonly encounters: ReadonlyMap<ContentId, EncounterDef>
  readonly pets: ReadonlyMap<ContentId, PetDef>
  readonly chests: ReadonlyMap<ContentId, ChestDef>
  readonly lootTables: ReadonlyMap<ContentId, LootTableDef>
  readonly contracts: ReadonlyMap<ContentId, ContractDef>
  readonly statuses: ReadonlyMap<Status, StatusDef>
  /** The Wayfarer Chest's cast (D-091). */
  readonly wayfarers: ReadonlyMap<ContentId, WayfarerDef>
  /** classId (or 'field' / 'pet' / 'monster') → its skills sorted by tier, then id. */
  readonly skillsByClass: ReadonlyMap<ContentId, readonly SkillDef[]>
  /** familyId → monsters sorted by id. */
  readonly monstersByFamily: ReadonlyMap<ContentId, readonly MonsterDef[]>
  /** zoneId → monsters sorted by id. */
  readonly monstersByZone: ReadonlyMap<ContentId, readonly MonsterDef[]>
  /** tableId → encounters sorted by id. */
  readonly encountersByTable: ReadonlyMap<ContentId, readonly EncounterDef[]>
  /** item kind → items sorted by id. */
  readonly itemsByKind: ReadonlyMap<ItemKind, readonly ItemDef[]>
}

// ---------------------------------------------------------------------------------------------------------------
// Paths → kinds
// ---------------------------------------------------------------------------------------------------------------

/** Top-level folders whose files are one record each: content/<folder>/<id>.json. */
const FOLDER_KINDS: ReadonlyMap<string, ContentKind> = new Map<string, ContentKind>([
  ['classes', 'class'],
  ['species', 'species'],
  ['affixes', 'affix'],
  ['sets', 'item-set'],
  ['monsters', 'monster'],
  ['elite-affixes', 'elite-affix'],
  ['encounters', 'encounter'],
  ['pets', 'pet'],
  ['chests', 'chest'],
  ['loot-tables', 'loot-table'],
  ['contracts', 'contract'],
  ['statuses', 'status'],
  ['wayfarers', 'wayfarer'],
])

/**
 * The kind of a content file from its path under content/ (README "Layout"): `tuning.json`; `<folder>/<id>.json`;
 * `skills/<class>/<id>.json`; `items/<kind>/<id>.json`; `dungeons/<d>/dungeon.json`; `dungeons/<d>/templates/<id>.json`.
 * Forward or back slashes; an optional leading `content/` or `./`. `schemas/`, `examples/`, `saves/`, README.md and
 * anything else → null.
 */
export function kindForContentPath(relativePath: string): ContentPathKind | null {
  const segments = relativePath
    .replace(/\\/g, '/')
    .split('/')
    .filter((s) => s.length > 0 && s !== '.')
  if (segments[0] === 'content') segments.shift()
  const last = segments[segments.length - 1]
  if (last === undefined || !last.endsWith('.json')) return null
  const [first, second, third] = segments
  if (first === undefined) return null
  switch (segments.length) {
    case 1:
      return first === 'tuning.json' ? { kind: 'tuning' } : null
    case 2: {
      const kind = FOLDER_KINDS.get(first)
      return kind === undefined ? null : { kind }
    }
    case 3:
      if (first === 'skills') return { kind: 'skill' }
      if (first === 'items') return { kind: 'item' }
      if (first === 'dungeons' && third === 'dungeon.json' && second !== undefined) return { kind: 'dungeon', dungeonId: second }
      return null
    case 4:
      if (first === 'dungeons' && third === 'templates' && second !== undefined) return { kind: 'template', dungeonId: second }
      return null
    default:
      return null
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Building the bundle
// ---------------------------------------------------------------------------------------------------------------

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function idOf(file: RawContentFile): string {
  const json = file.json
  if (typeof json === 'object' && json !== null) {
    const id = (json as { id?: unknown }).id
    if (typeof id === 'string' && id.length > 0) return id
  }
  throw new Error(`${file.path}: ${file.kind} record has no string "id"`)
}

interface Indexed<T, K extends string = string> {
  readonly map: ReadonlyMap<K, T>
  /** id → path, for messages. */
  readonly paths: ReadonlyMap<K, string>
}

/** Indexes one kind by id in sorted order; throws (naming the path) on a duplicate id. */
function indexById<T, K extends string = string>(kind: ContentKind, files: readonly RawContentFile[]): Indexed<T, K> {
  const paths = new Map<K, string>()
  const entries: Array<[K, T]> = []
  for (const file of files) {
    const id = idOf(file) as K
    const first = paths.get(id)
    if (first !== undefined) throw new Error(`${file.path}: duplicate ${kind} id "${id}" (already defined in ${first})`)
    paths.set(id, file.path)
    entries.push([id, file.json as T])
  }
  entries.sort((a, b) => compareIds(a[0], b[0]))
  return { map: new Map(entries), paths }
}

/** Groups records by a key; groups are inserted in sorted-key order and each group is sorted by `compare`. */
function groupBy<T, K extends string>(
  records: Iterable<T>,
  key: (record: T) => K,
  compare: (a: T, b: T) => number,
): ReadonlyMap<K, readonly T[]> {
  const groups = new Map<K, T[]>()
  for (const record of records) {
    const k = key(record)
    const list = groups.get(k)
    if (list === undefined) groups.set(k, [record])
    else list.push(record)
  }
  const keys = [...groups.keys()].sort(compareIds)
  const out = new Map<K, readonly T[]>()
  for (const k of keys) {
    const list = groups.get(k) ?? []
    out.set(k, [...list].sort(compare))
  }
  return out
}

const byId = <T extends { readonly id: string }>(a: T, b: T): number => compareIds(a.id, b.id)

/** Merges each dungeon's split template files into a cloned dungeon; the raw dungeon objects are never mutated. */
function mergeTemplates(dungeons: Indexed<DungeonDef>, templateFiles: readonly RawContentFile[]): ReadonlyMap<ContentId, DungeonDef> {
  const templateWhere = new Map<string, string>()
  for (const [dungeonId, dungeon] of dungeons.map) {
    const where = dungeons.paths.get(dungeonId) ?? `dungeons/${dungeonId}/dungeon.json`
    for (const template of dungeon.templates) {
      const first = templateWhere.get(template.id)
      if (first !== undefined) throw new Error(`${where}: duplicate template id "${template.id}" (already defined in ${first})`)
      templateWhere.set(template.id, where)
    }
  }

  const extra = new Map<ContentId, TemplateDef[]>()
  for (const file of templateFiles) {
    const dungeonId = file.dungeonId
    if (dungeonId === undefined) {
      throw new Error(`${file.path}: template file has no dungeonId (expected dungeons/<dungeon>/templates/<id>.json)`)
    }
    if (!dungeons.map.has(dungeonId)) {
      throw new Error(`${file.path}: template belongs to dungeon "${dungeonId}" but dungeons/${dungeonId}/dungeon.json is missing`)
    }
    const id = idOf(file)
    const first = templateWhere.get(id)
    if (first !== undefined) throw new Error(`${file.path}: duplicate template id "${id}" (already defined in ${first})`)
    templateWhere.set(id, file.path)
    const list = extra.get(dungeonId)
    const template = file.json as TemplateDef
    if (list === undefined) extra.set(dungeonId, [template])
    else list.push(template)
  }

  const merged = new Map<ContentId, DungeonDef>()
  for (const [dungeonId, dungeon] of dungeons.map) {
    const list = extra.get(dungeonId)
    if (list === undefined) {
      merged.set(dungeonId, dungeon)
      continue
    }
    merged.set(dungeonId, { ...dungeon, templates: [...dungeon.templates, ...list.sort(byId)] })
  }
  return merged
}

/**
 * Builds the `Content` bundle from parsed files. Throws an Error naming the offending path on a duplicate id within
 * a kind, a template whose dungeon file is missing, a record with no `id`, or a missing or duplicate `tuning`.
 */
export function buildContent(files: readonly RawContentFile[]): Content {
  const byKind = new Map<ContentKind, RawContentFile[]>()
  for (const file of files) {
    const list = byKind.get(file.kind)
    if (list === undefined) byKind.set(file.kind, [file])
    else list.push(file)
  }
  const of = (kind: ContentKind): readonly RawContentFile[] => byKind.get(kind) ?? []

  const [firstTuning, secondTuning] = of('tuning')
  if (firstTuning === undefined) throw new Error('content: tuning.json is missing (exactly one tuning file is required)')
  if (secondTuning !== undefined) throw new Error(`${secondTuning.path}: duplicate tuning (already loaded from ${firstTuning.path})`)
  const tuning = firstTuning.json as Tuning

  const classes = indexById<ClassDef>('class', of('class')).map
  const species = indexById<SpeciesDef>('species', of('species')).map
  const skills = indexById<SkillDef>('skill', of('skill')).map
  const items = indexById<ItemDef>('item', of('item')).map
  const affixes = indexById<AffixDef>('affix', of('affix')).map
  const sets = indexById<ItemSetDef>('item-set', of('item-set')).map
  const monsters = indexById<MonsterDef>('monster', of('monster')).map
  const eliteAffixes = indexById<EliteAffixDef>('elite-affix', of('elite-affix')).map
  const dungeons = mergeTemplates(indexById<DungeonDef>('dungeon', of('dungeon')), of('template'))
  const encounters = indexById<EncounterDef>('encounter', of('encounter')).map
  const pets = indexById<PetDef>('pet', of('pet')).map
  const chests = indexById<ChestDef>('chest', of('chest')).map
  const lootTables = indexById<LootTableDef>('loot-table', of('loot-table')).map
  const contracts = indexById<ContractDef>('contract', of('contract')).map
  const statuses = indexById<StatusDef, Status>('status', of('status')).map
  const wayfarers = indexById<WayfarerDef>('wayfarer', of('wayfarer')).map

  return {
    tuning,
    classes,
    species,
    skills,
    items,
    affixes,
    sets,
    monsters,
    eliteAffixes,
    dungeons,
    encounters,
    pets,
    chests,
    lootTables,
    contracts,
    statuses,
    wayfarers,
    skillsByClass: groupBy(skills.values(), (s) => s.classId, (a, b) => a.tier - b.tier || compareIds(a.id, b.id)),
    monstersByFamily: groupBy(monsters.values(), (m) => m.familyId, byId),
    monstersByZone: groupBy(monsters.values(), (m) => m.zoneId, byId),
    encountersByTable: groupBy(encounters.values(), (e) => e.tableId, byId),
    itemsByKind: groupBy(items.values(), (i) => i.kind, byId),
  }
}

/** Record counts per kind, for logs (`template` counts every template across dungeons, inline and merged). */
export function contentSummary(c: Content): Record<ContentKind, number> {
  let templates = 0
  for (const dungeon of c.dungeons.values()) templates += dungeon.templates.length
  return {
    class: c.classes.size,
    species: c.species.size,
    skill: c.skills.size,
    item: c.items.size,
    affix: c.affixes.size,
    'item-set': c.sets.size,
    monster: c.monsters.size,
    'elite-affix': c.eliteAffixes.size,
    dungeon: c.dungeons.size,
    template: templates,
    encounter: c.encounters.size,
    pet: c.pets.size,
    chest: c.chests.size,
    'loot-table': c.lootTables.size,
    contract: c.contracts.size,
    status: c.statuses.size,
    wayfarer: c.wayfarers.size,
    tuning: 1,
  }
}
