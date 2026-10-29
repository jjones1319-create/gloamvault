/**
 * gen-items.ts — the re-runnable item content generator (Phase 3, content pass 1; Phase 7, Gravehollow complete).
 *
 * `node tools/content/gen-items.ts` rewrites every file it owns from the tables of docs/08-ITEMS.md held below as
 * data: content/items/<kind>/<id>.json (weapons, armor, shields, foci, rings, talismans, relics, consumables, the
 * pet treat, ammo, materials, stones, keys, eggs; Skill Tomes under items/tome/ are pass A's and never touched),
 * content/affixes/<id>.json (08 §5), content/sets/<id>.json (08 §6: Gravehollow's five sets, their pieces at every
 * grade from the set's lowest to S so promotion keeps membership), the named uniques Gravehollow can drop (08 §7)
 * and content/loot-tables/<id>.json (08 §11: the Cellars, the Crypts, the Vault and the throne).
 * It is idempotent — the same tables give byte-identical files. JSON files in the owned folders that a run did
 * not write are listed as stale; `--prune` deletes them. `--hooks` also prints the sim hooks the content names.
 *
 * Every number is 08's (grades F–S since Phase 7; SS is the chests' and the bosses', God items are Phase 11). Where
 * 08 is silent the reading taken is written beside the table that needs it and repeated in the hand-over
 * (docs/13-DECISIONS.md). Numbers are tuning starting points: edit a table, re-run, `npm run lint`.
 *
 * Run by Node 24 directly (type stripping): no enums, `.ts` imports, erasable syntax only.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CONTENT = path.join(ROOT, 'content')
const PRUNE = process.argv.includes('--prune')
const SHOW_HOOKS = process.argv.includes('--hooks')

// ---------------------------------------------------------------------------------------------------------------
// Grades, ladders, factors (08 preamble, §8.1, §8.5, §9.1; 03 §6.2)
// ---------------------------------------------------------------------------------------------------------------

type Grade = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S'
type AnyGrade = Grade | 'SS' | 'God'

interface GradeRow {
  index: number
  mult: number
  affixSlots: number
  maxPlusN: number
  /** gradeValue = 0.5 × R of the grade's band (08 preamble). */
  value: number
  /** The grade's name (03 §6.2), used where an item has no material word (trinkets). */
  word: string
}

const GRADE_ROWS: Record<AnyGrade, GradeRow> = {
  F: { index: 0, mult: 1.0, affixSlots: 0, maxPlusN: 3, value: 150, word: 'Crude' },
  E: { index: 1, mult: 1.35, affixSlots: 1, maxPlusN: 4, value: 240, word: 'Common' },
  D: { index: 2, mult: 1.8, affixSlots: 1, maxPlusN: 5, value: 380, word: 'Fine' },
  C: { index: 3, mult: 2.45, affixSlots: 2, maxPlusN: 6, value: 600, word: 'Superior' },
  B: { index: 4, mult: 3.3, affixSlots: 2, maxPlusN: 7, value: 1000, word: 'Masterwork' },
  A: { index: 5, mult: 4.45, affixSlots: 3, maxPlusN: 8, value: 1600, word: 'Heroic' },
  S: { index: 6, mult: 6.0, affixSlots: 3, maxPlusN: 9, value: 2500, word: 'Legendary' },
  SS: { index: 7, mult: 8.1, affixSlots: 4, maxPlusN: 10, value: 4000, word: 'Mythic' },
  God: { index: 8, mult: 11.0, affixSlots: 4, maxPlusN: 10, value: 6500, word: 'Divine' },
}

/** The grades shipped on every ladder: F–C since Phase 3, B–S since Phase 7 (12 Phase 7: "items B–A"; a boss gives "one S-grade item"). */
const GRADES: readonly Grade[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S']

type Ladder = 'metal' | 'hide' | 'cloth' | 'wood'

/** Gravehollow uses the first name of each 08 §8.1 pair; the F–S rungs. */
const LADDER: Record<Ladder, readonly string[]> = {
  metal: ['Copper', 'Bronze', 'Iron', 'Steel', 'Blacksteel', 'Skysteel', 'Adamantine'],
  hide: ['Rawhide', 'Leather', 'Boiled Leather', 'Wolf Hide', 'Wyvern Hide', 'Basilisk Scale', 'Drake Scale'],
  cloth: ['Burlap', 'Linen', 'Wool', 'Silk', 'Glyphweave', 'Moonweave', 'Phoenix Weave'],
  wood: ['Pine', 'Ash', 'Oak', 'Yew', 'Ironwood', 'Ebony', 'Elderwood'],
}

/**
 * Value per unit by rung: 08 §8.5's blacksmith prices F–C (10 / 20 / 35 / 60). B and up are never sold (§8.5); their
 * value — what a unit sells for at 40% — continues the shape as a tenth of the grade value (B 100 · A 160 · S 250),
 * a tuning reading (Phase 7, Proposed).
 */
const MATERIAL_PRICE: readonly number[] = [10, 20, 35, 60, 100, 160, 250]

const TINT: Record<string, string> = {
  Copper: '#b87333',
  Bronze: '#cd7f32',
  Iron: '#8a8f98',
  Steel: '#a8b0ba',
  Rawhide: '#a66a48',
  Leather: '#7a4b2a',
  'Boiled Leather': '#5c3a1e',
  'Wolf Hide': '#6e6a60',
  Burlap: '#c2b280',
  Linen: '#e8e0c8',
  Wool: '#9c8f7a',
  Silk: '#d9c9e6',
  Pine: '#a0824a',
  Ash: '#c9b58a',
  Oak: '#8b6b3e',
  Yew: '#7a5a3a',
  Blacksteel: '#2f3136',
  Skysteel: '#9ec5e0',
  Adamantine: '#4f6f7f',
  'Wyvern Hide': '#4d5e3a',
  'Basilisk Scale': '#6b7d4f',
  'Drake Scale': '#8c2f22',
  Glyphweave: '#3b4a8c',
  Moonweave: '#c9d3e6',
  'Phoenix Weave': '#d9541e',
  Ironwood: '#4a3b2f',
  Ebony: '#2a211c',
  Elderwood: '#5e7a4a',
}

/** Slot factors of the value formula (08 preamble: value = gradeValue × slotFactor). */
const SLOT_FACTOR = {
  mainHand: 1,
  twoHanded: 1.5,
  shield: 0.8,
  offHand: 0.6,
  chest: 1,
  helmet: 0.7,
  legs: 0.7,
  boots: 0.5,
  gloves: 0.5,
  ring: 0.6,
  talisman: 0.8,
  relic: 1.2,
} as const

/**
 * Wear constant k by item class and grade (08 §9.1), F–S. Written rounded half up because item.schema.json says
 * `wearK` is 08 §9.1's number (1.33 …; the schema takes a number since D-072). Bows carry the bow row because the
 * sim never passes its `bow` wear option (sim/src/progress.ts calls wearWeapon without it).
 */
const WEAR_K = {
  weapon: [1.33, 1.67, 2.08, 2.6, 3.26, 4.07, 5.09],
  bow: [2.67, 3.33, 4.17, 5.21, 6.51, 8.14, 10.17],
  plate: [1.2, 1.5, 1.88, 2.34, 2.93, 3.66, 4.58],
  mail: [1, 1.25, 1.56, 1.95, 2.44, 3.05, 3.81],
  leather: [0.8, 1, 1.25, 1.56, 1.95, 2.44, 3.05],
  robes: [0.5, 0.63, 0.78, 0.98, 1.22, 1.53, 1.91],
} as const
type WearRow = keyof typeof WEAR_K

/** R at band F (08 R table); consumable prices in R × this = gold. */
const R_F = 300

// ---------------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------------

function need<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`gen-items: missing ${what}`)
  return v
}

/** Round half up to an integer (08 preamble). */
function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5)
}

/** Base × the grade multiplier, rounded half up: the ladder every flat line rides. */
function scaled(base: number, grade: Grade): number {
  return roundHalfUp(base * GRADE_ROWS[grade].mult)
}

function value(grade: AnyGrade, factor: number): number {
  return roundHalfUp(GRADE_ROWS[grade].value * factor)
}

function wearK(row: WearRow, grade: Grade): number {
  // 08 §9.1's k as written (the schema takes a number since D-072).
  return need(WEAR_K[row][GRADE_ROWS[grade].index], `wearK ${row} ${grade}`)
}

function kebab(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function material(ladder: Ladder, grade: Grade): string {
  return need(LADDER[ladder][GRADE_ROWS[grade].index], `${ladder} rung ${grade}`)
}

function tint(name: string): string {
  return need(TINT[name], `tint for ${name}`)
}

/** The metal rung's name at a grade, lowercase: the trim of every item (08 §1: staves "carry the Metal rung of the same grade as a ferrule or gem cap"). */
function trimMetal(grade: Grade): string {
  return material('metal', grade).toLowerCase()
}

/** Grade word for a trinket's E–C siblings: F keeps the bare name (the kit's "Ring of Vigor"). */
function gradedId(base: string, grade: Grade): string {
  return grade === 'F' ? base : `${GRADE_ROWS[grade].word.toLowerCase()}-${base}`
}
function gradedName(base: string, grade: Grade): string {
  return grade === 'F' ? base : `${GRADE_ROWS[grade].word} ${base}`
}

type Effect = Record<string, unknown>

interface Visual {
  meshId: string
  tintPrimary: string
  tintSecondary: string
  trimMetal: string
}

interface ItemRecord {
  id: string
  name: string
  slot: string | null
  kind: string
  grade: AnyGrade
  materialLadder: Ladder | null
  materialRung: number | null
  weaponType: string | null
  armorFamily: string | null
  hands: number | null
  damageType: string | null
  weight: number | null
  baseStats: Record<string, number>
  requirements: { strength: number; wisdom: number }
  affixSlots: number
  affixes: Effect[]
  plusN: number
  maxPlusN: number
  itemLevel: number
  itemXp: number
  affinities: Effect[]
  durability: number
  maxDurability: number
  wearK: number
  value: number
  classLock: string[]
  setId: string | null
  unique: boolean
  uniquePower: UniquePowerRecord | null
  active: ActiveRecord | null
  consumable: { effects: Effect[]; stackMax: number; target: string; inCombat: boolean; text?: string } | null
  ammo: { stack: number } | null
  visual: Visual
  /** Item tags (Phase 7): `safe-item` + `zone:<zoneId>` (the merchant's stock), `boss-only`, `chest-key:<tier>`, `skeleton-key`. Written only when non-empty. */
  tags?: string[]
}

/** A named unique's signature (08 §7): its lines, plus attribute lines (`attributes`) the effect DSL's stat field cannot name. */
interface UniquePowerRecord {
  text: string
  effects: Effect[]
  attributes?: Record<string, number>
}

/**
 * A relic's active (08 §3): `text` is 08's Effect column for the card; `instant` (no Item action, the hero acts again);
 * `usesPerFloor` for a once-per-floor relic; `timing: 'afterFight'` for one used when a fight is over (the Hollow Coin).
 */
interface ActiveRecord {
  effects: Effect[]
  usesPerFight: number
  target: string
  text?: string
  instant?: boolean
  usesPerFloor?: number
  timing?: 'fight' | 'afterFight'
}

type ItemOverrides = Partial<ItemRecord> & Pick<ItemRecord, 'id' | 'name' | 'kind' | 'grade' | 'visual'>

/** An item record with every field in schema order; the grade sets affixSlots and maxPlusN (rule 19). */
function item(o: ItemOverrides): ItemRecord {
  const g = GRADE_ROWS[o.grade]
  return {
    id: o.id,
    name: o.name,
    slot: o.slot ?? null,
    kind: o.kind,
    grade: o.grade,
    materialLadder: o.materialLadder ?? null,
    materialRung: o.materialLadder ? g.index : null,
    weaponType: o.weaponType ?? null,
    armorFamily: o.armorFamily ?? null,
    hands: o.hands ?? null,
    damageType: o.damageType ?? null,
    weight: o.weight ?? null,
    baseStats: o.baseStats ?? {},
    requirements: o.requirements ?? { strength: 0, wisdom: 0 },
    affixSlots: g.affixSlots,
    affixes: [],
    plusN: 0,
    maxPlusN: g.maxPlusN,
    itemLevel: 1,
    itemXp: 0,
    affinities: [],
    durability: 100,
    maxDurability: 100,
    wearK: o.wearK ?? 1,
    value: o.value ?? 0,
    classLock: o.classLock ?? [],
    setId: o.setId ?? null,
    unique: o.unique ?? false,
    uniquePower: o.uniquePower ?? null,
    active: o.active ?? null,
    consumable: o.consumable ?? null,
    ammo: o.ammo ?? null,
    visual: o.visual,
    ...(o.tags && o.tags.length > 0 ? { tags: [...o.tags] } : {}),
  }
}

const written = new Map<string, ItemRecord | Record<string, unknown>>()
const counts = new Map<string, number>()
const hooks = new Map<string, Set<string>>()

function hook(id: string, from: string): void {
  const set = hooks.get(id) ?? new Set<string>()
  set.add(from)
  hooks.set(id, set)
}

function writeJson(rel: string, data: ItemRecord | Record<string, unknown>): void {
  if (written.has(rel)) throw new Error(`gen-items: ${rel} written twice`)
  const abs = path.join(CONTENT, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  const text = `${JSON.stringify(data, null, 2)}\n`
  const before = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null
  if (before !== text) fs.writeFileSync(abs, text, 'utf8')
  written.set(rel, data)
  const kind = rel.split('/').slice(0, -1).join('/')
  counts.set(kind, (counts.get(kind) ?? 0) + 1)
}

const deferred: string[] = []

/** Writes an item; a class lock is trimmed to the shipped classes, and an item whose lock would empty (a Beast Tamer whip) is deferred rather than written universal. */
function writeItem(it: ItemRecord): void {
  let rec = it
  if (rec.classLock.length > 0) {
    const lock = rec.classLock.filter((c) => SHIPPED_CLASSES.has(c))
    if (lock.length === 0) {
      deferred.push(`${rec.id} (classLock ${rec.classLock.join(', ')})`)
      return
    }
    rec = { ...rec, classLock: lock }
  }
  writeJson(`items/${rec.kind}/${rec.id}.json`, rec)
}

// ---------------------------------------------------------------------------------------------------------------
// Class ids (04-CLASSES.md; the sim's `classLock` compares ids)
// ---------------------------------------------------------------------------------------------------------------

const WARDEN = 'warden'
const BLADE = 'blade'
const RANGER = 'ranger'
const SHADE = 'shade'
const ARCANIST = 'arcanist'
const MENDER = 'mender'
const TAMER = 'beast-tamer'

/**
 * Classes with a content/classes/<id>.json this segment (12 Phase 3: "the six classes"; the Beast Tamer ships in
 * Segment 3). `classLock` ids are resolved by lint rule 2, so Tamer locks are dropped until then and Tamer-only
 * items (whips) are deferred. Add TAMER here when content/classes/beast-tamer.json lands and re-run.
 */
const SHIPPED_CLASSES: ReadonlySet<string> = new Set([WARDEN, BLADE, RANGER, SHADE, ARCANIST, MENDER])

// ---------------------------------------------------------------------------------------------------------------
// §1 Weapons
// ---------------------------------------------------------------------------------------------------------------

interface OnHit {
  status: string
  chance: number
  /** 'crit' lines are written as on-hit lines with a note; the crit gate is a sim hook (the DSL has no trigger). */
  trigger: 'hit' | 'crit'
}

interface WeaponRow {
  /** Type slug: the id is `<material>-<type>`, the mesh `weapon-<type>-01`. */
  type: string
  name: string
  weaponType: string
  ladder: Ladder
  hands: 1 | 2
  damageType: string
  weight: 800 | 1000 | 1400
  /** Base Attack (F): weaponAttack, focusPower, or both for the Censer. */
  attack: number
  attackStat: 'attackPhys' | 'attackSpell' | 'both'
  /** Flat weaponPenalty, written as a negative `speed` line that does not ride the ladder (the sim reads it as the penalty). */
  speedPenalty: number
  req: ['strength' | 'wisdom', number]
  /** Percent specials (Crit Rate, Crit Damage, Accuracy): flat lines that do not ride the ladder (08 preamble). */
  flat?: Record<string, number>
  /** Flat specials that ride the ladder (Mana). */
  rides?: Record<string, number>
  onHit?: OnHit[]
  /** Specials the schema cannot express; reported as hooks. Reach and either-row come from the weapon type in the sim. */
  hooks?: string[]
  /**
   * classLock: 08 §1's Classes column ∩ the class sheet's "Allowed weapons" row (04 wins, 08 §1: "that file wins if
   * it differs"); where the intersection is empty 08's list stands (the Maul). Noted per row where they differ.
   */
  classes: string[]
}

const WEAPONS: readonly WeaponRow[] = [
  // Swords (metal)
  { type: 'shortsword', name: 'Shortsword', weaponType: 'sword', ladder: 'metal', hands: 1, damageType: 'slash', weight: 1000, attack: 10, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 8], flat: { accuracy: 2 }, hooks: ['may be held off-hand by a Blade'], classes: [WARDEN, BLADE, SHADE] }, // 08 also Ranger, Beast Tamer; their sheets do not list swords
  { type: 'longsword', name: 'Longsword', weaponType: 'sword', ladder: 'metal', hands: 1, damageType: 'slash', weight: 1000, attack: 12, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 10], classes: [WARDEN, BLADE] }, // 08 also Beast Tamer
  { type: 'sabre', name: 'Sabre', weaponType: 'sword', ladder: 'metal', hands: 1, damageType: 'slash', weight: 1000, attack: 11, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 9], flat: { critRate: 3 }, classes: [BLADE] }, // 08 also Shade, Beast Tamer
  // Greatswords (metal)
  { type: 'greatsword', name: 'Greatsword', weaponType: 'greatsword', ladder: 'metal', hands: 2, damageType: 'slash', weight: 1400, attack: 20, attackStat: 'attackPhys', speedPenalty: -5, req: ['strength', 14], hooks: ['Cleave: a basic attack also hits a second front-row enemy for 50%'], classes: [BLADE] }, // 08 also Warden; the Warden sheet allows 1h only
  { type: 'zweihander', name: 'Zweihander', weaponType: 'greatsword', ladder: 'metal', hands: 2, damageType: 'slash', weight: 1400, attack: 23, attackStat: 'attackPhys', speedPenalty: -8, req: ['strength', 17], flat: { critDamage: 10 }, hooks: ['Cleave 50%'], classes: [BLADE] },
  // Axes (metal)
  { type: 'hand-axe', name: 'Hand Axe', weaponType: 'axe', ladder: 'metal', hands: 1, damageType: 'slash', weight: 1000, attack: 13, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 11], flat: { critDamage: 15, accuracy: -3 }, classes: [WARDEN, BLADE] }, // 08 also Beast Tamer
  { type: 'bearded-axe', name: 'Bearded Axe', weaponType: 'axe', ladder: 'metal', hands: 1, damageType: 'slash', weight: 1000, attack: 12, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 10], flat: { critDamage: 10 }, onHit: [{ status: 'bleed', chance: 20, trigger: 'crit' }], classes: [BLADE] }, // 08 also Beast Tamer
  { type: 'battleaxe', name: 'Battleaxe', weaponType: 'greataxe', ladder: 'metal', hands: 2, damageType: 'slash', weight: 1400, attack: 22, attackStat: 'attackPhys', speedPenalty: -5, req: ['strength', 16], flat: { critDamage: 25, accuracy: -3 }, classes: [BLADE] }, // 08 also Warden
  // Maces and mauls (metal)
  { type: 'mace', name: 'Mace', weaponType: 'mace', ladder: 'metal', hands: 1, damageType: 'blunt', weight: 1000, attack: 12, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 11], onHit: [{ status: 'daze', chance: 5, trigger: 'hit' }], classes: [WARDEN, MENDER] }, // 08 also Beast Tamer
  { type: 'morningstar', name: 'Morningstar', weaponType: 'mace', ladder: 'metal', hands: 1, damageType: 'blunt', weight: 1000, attack: 13, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 12], flat: { critDamage: 5 }, onHit: [{ status: 'daze', chance: 5, trigger: 'hit' }], classes: [WARDEN] }, // 08 also Beast Tamer
  { type: 'maul', name: 'Maul', weaponType: 'maul', ladder: 'metal', hands: 2, damageType: 'blunt', weight: 1400, attack: 24, attackStat: 'attackPhys', speedPenalty: -10, req: ['strength', 18], onHit: [{ status: 'daze', chance: 15, trigger: 'hit' }, { status: 'stun', chance: 10, trigger: 'crit' }], classes: [WARDEN, BLADE] }, // neither sheet lists mauls; 08's list stands so the type has a wielder
  // Spears (metal)
  { type: 'spear', name: 'Spear', weaponType: 'spear', ladder: 'metal', hands: 2, damageType: 'pierce', weight: 1000, attack: 15, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 11], classes: [WARDEN, RANGER] }, // 08 also Beast Tamer (its sheet has the 1h short spear, not in 08)
  { type: 'pike', name: 'Pike', weaponType: 'spear', ladder: 'metal', hands: 2, damageType: 'pierce', weight: 1000, attack: 16, attackStat: 'attackPhys', speedPenalty: -3, req: ['strength', 13], flat: { accuracy: 5 }, classes: [WARDEN] }, // 08 also Beast Tamer
  { type: 'trident', name: 'Trident', weaponType: 'spear', ladder: 'metal', hands: 2, damageType: 'pierce', weight: 1000, attack: 15, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 12], onHit: [{ status: 'bleed', chance: 10, trigger: 'hit' }], classes: [RANGER] }, // 08 also Beast Tamer
  // Daggers (metal)
  { type: 'dagger', name: 'Dagger', weaponType: 'dagger', ladder: 'metal', hands: 1, damageType: 'pierce', weight: 800, attack: 8, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 6], hooks: ['Dual: may be held off-hand (adds 50% Attack)'], classes: [BLADE, SHADE] }, // 08 also Ranger, Arcanist
  { type: 'stiletto', name: 'Stiletto', weaponType: 'dagger', ladder: 'metal', hands: 1, damageType: 'pierce', weight: 800, attack: 7, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 6], hooks: ['ignores 20% of target Defense', 'dual'], classes: [SHADE] },
  { type: 'kris', name: 'Kris', weaponType: 'dagger', ladder: 'metal', hands: 1, damageType: 'pierce', weight: 800, attack: 8, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 7], onHit: [{ status: 'bleed', chance: 10, trigger: 'hit' }], hooks: ['dual'], classes: [SHADE, BLADE] },
  // Bows (wood; consume arrows)
  { type: 'shortbow', name: 'Shortbow', weaponType: 'shortbow', ladder: 'wood', hands: 2, damageType: 'pierce', weight: 1000, attack: 13, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 9], classes: [RANGER] }, // 08 also Shade
  { type: 'longbow', name: 'Longbow', weaponType: 'longbow', ladder: 'wood', hands: 2, damageType: 'pierce', weight: 1000, attack: 16, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 12], hooks: ['+5% damage to the back row'], classes: [RANGER] },
  { type: 'recurve-bow', name: 'Recurve Bow', weaponType: 'shortbow', ladder: 'wood', hands: 2, damageType: 'pierce', weight: 1000, attack: 14, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 10], flat: { critRate: 4 }, classes: [RANGER] }, // typed shortbow: light draw (Str 10), not the Halfling-locked longbow
  // Crossbows (wood; consume bolts)
  { type: 'hand-crossbow', name: 'Hand Crossbow', weaponType: 'crossbow', ladder: 'wood', hands: 1, damageType: 'pierce', weight: 1000, attack: 11, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 7], hooks: ['may be held off-hand'], classes: [RANGER] }, // 08 also Shade
  { type: 'crossbow', name: 'Crossbow', weaponType: 'crossbow', ladder: 'wood', hands: 2, damageType: 'pierce', weight: 1400, attack: 22, attackStat: 'attackPhys', speedPenalty: -5, req: ['strength', 9], hooks: ['ignores 10% Defense'], classes: [RANGER] }, // 08 also Warden
  { type: 'arbalest', name: 'Arbalest', weaponType: 'crossbow', ladder: 'wood', hands: 2, damageType: 'pierce', weight: 1400, attack: 26, attackStat: 'attackPhys', speedPenalty: -10, req: ['strength', 12], hooks: ['ignores 20% Defense'], classes: [RANGER] },
  // Staves (wood with a metal cap; Base Attack = focusPower). Spell damage type: fire for the Arcanist's, holy for the Mender's — the skill's element decides in play.
  { type: 'staff', name: 'Staff', weaponType: 'staff', ladder: 'wood', hands: 2, damageType: 'fire', weight: 1000, attack: 14, attackStat: 'attackSpell', speedPenalty: 0, req: ['wisdom', 10], rides: { mana: 10 }, classes: [ARCANIST, MENDER] },
  { type: 'greatstaff', name: 'Greatstaff', weaponType: 'staff', ladder: 'wood', hands: 2, damageType: 'fire', weight: 1400, attack: 18, attackStat: 'attackSpell', speedPenalty: -3, req: ['wisdom', 13], rides: { mana: 20 }, hooks: ['+5% Mana regen'], classes: [ARCANIST] },
  { type: 'crook', name: 'Crook', weaponType: 'staff', ladder: 'wood', hands: 2, damageType: 'holy', weight: 1000, attack: 12, attackStat: 'attackSpell', speedPenalty: 0, req: ['wisdom', 9], rides: { mana: 10 }, hooks: ['+10% healing'], classes: [MENDER] },
  // Wands (wood)
  { type: 'wand', name: 'Wand', weaponType: 'wand', ladder: 'wood', hands: 1, damageType: 'fire', weight: 800, attack: 9, attackStat: 'attackSpell', speedPenalty: 0, req: ['wisdom', 8], classes: [ARCANIST] }, // 08 also Mender; its sheet pairs censer/mace + holy symbol
  { type: 'rod', name: 'Rod', weaponType: 'wand', ladder: 'wood', hands: 1, damageType: 'fire', weight: 1000, attack: 11, attackStat: 'attackSpell', speedPenalty: 0, req: ['wisdom', 10], rides: { mana: 5 }, classes: [ARCANIST] },
  // Censers and the Reliquary (metal; Mender)
  { type: 'censer', name: 'Censer', weaponType: 'censer', ladder: 'metal', hands: 1, damageType: 'blunt', weight: 1000, attack: 10, attackStat: 'both', speedPenalty: 0, req: ['wisdom', 9], hooks: ['+10% healing'], classes: [MENDER] },
  { type: 'reliquary', name: 'Reliquary', weaponType: 'staff', ladder: 'metal', hands: 2, damageType: 'holy', weight: 1000, attack: 14, attackStat: 'attackSpell', speedPenalty: 0, req: ['wisdom', 12], rides: { mana: 15 }, hooks: ['+15% healing', 'Smite +10%'], classes: [MENDER] },
  // Whips (hide; Beast Tamer)
  { type: 'whip', name: 'Whip', weaponType: 'whip', ladder: 'hide', hands: 1, damageType: 'slash', weight: 1000, attack: 9, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 7], hooks: ['pet in Fierce +5% Attack'], classes: [TAMER] },
  { type: 'chain-whip', name: 'Chain Whip', weaponType: 'whip', ladder: 'hide', hands: 1, damageType: 'slash', weight: 1000, attack: 11, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 10], onHit: [{ status: 'slow', chance: 10, trigger: 'hit' }], classes: [TAMER] },
  { type: 'bullwhip', name: 'Bullwhip', weaponType: 'whip', ladder: 'hide', hands: 2, damageType: 'slash', weight: 1000, attack: 15, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 10], hooks: ['Lash: basic attack hits one target in each row for 60%'], classes: [TAMER] },
  // Throwing weapons (metal; recovered after the fight, no ammo)
  { type: 'throwing-knives', name: 'Throwing Knives', weaponType: 'throwingKnife', ladder: 'metal', hands: 1, damageType: 'pierce', weight: 800, attack: 7, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 5], hooks: ['may be held off-hand'], classes: [SHADE] },
  { type: 'throwing-axes', name: 'Throwing Axes', weaponType: 'throwingKnife', ladder: 'metal', hands: 1, damageType: 'slash', weight: 1000, attack: 9, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 8], flat: { critDamage: 10 }, classes: [SHADE] }, // 08 also Beast Tamer
  { type: 'needles', name: 'Needles', weaponType: 'throwingKnife', ladder: 'metal', hands: 1, damageType: 'pierce', weight: 800, attack: 5, attackStat: 'attackPhys', speedPenalty: 0, req: ['strength', 4], onHit: [{ status: 'poison', chance: 15, trigger: 'hit' }], classes: [SHADE] },
]

const WEAPON_SECONDARY_TINT = '#4a3626'

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function onHitText(lines: OnHit[]): string {
  return lines.map((l) => `${l.chance}% ${capitalise(l.status)} on ${l.trigger}`).join('; ')
}

function onHitEffects(lines: OnHit[]): Effect[] {
  return lines.map((l) => ({
    kind: 'applyStatus',
    status: l.status,
    chance: l.chance,
    target: 'enemy',
    note: l.trigger === 'crit' ? 'on crit only: the sim applies uniquePower lines on every hit, so the crit gate is a hook' : 'on hit',
  }))
}

function genWeapons(): void {
  for (const w of WEAPONS) {
    const heavy = w.weight === 1400
    for (const grade of GRADES) {
      const mat = material(w.ladder, grade)
      const g = GRADE_ROWS[grade].index
      const baseStats: Record<string, number> = {}
      const atk = scaled(w.attack, grade)
      if (w.attackStat === 'attackPhys' || w.attackStat === 'both') baseStats.attackPhys = atk
      if (w.attackStat === 'attackSpell' || w.attackStat === 'both') baseStats.attackSpell = atk
      for (const [k, v] of Object.entries(w.rides ?? {})) baseStats[k] = scaled(v, grade)
      for (const [k, v] of Object.entries(w.flat ?? {})) baseStats[k] = v
      if (w.speedPenalty !== 0) baseStats.speed = w.speedPenalty
      const req = { strength: 0, wisdom: 0 }
      // 08 §1: req(g) = req(F) + g for one-handed weapons and foci, + 2g for heavy two-handers; a two-hander that is
      // not heavy (spears, bows, staves, the bullwhip) is read as + g, the nearer rule.
      req[w.req[0]] = w.req[1] + (heavy ? 2 * g : g)
      for (const h of w.hooks ?? []) hook(`weapon special: ${h}`, `${w.name}`)
      if (w.onHit?.some((l) => l.trigger === 'crit')) hook('weapon special: on-crit gate for uniquePower lines', w.name)
      writeItem(
        item({
          id: `${kebab(mat)}-${w.type}`,
          name: `${mat} ${w.name}`,
          slot: 'mainHand',
          kind: 'weapon',
          grade,
          materialLadder: w.ladder,
          weaponType: w.weaponType,
          hands: w.hands,
          damageType: w.damageType,
          weight: w.weight,
          baseStats,
          requirements: req,
          wearK: wearK(w.weaponType === 'shortbow' || w.weaponType === 'longbow' ? 'bow' : 'weapon', grade),
          value: value(grade, w.hands === 2 ? SLOT_FACTOR.twoHanded : SLOT_FACTOR.mainHand),
          classLock: w.classes,
          uniquePower: w.onHit ? { text: onHitText(w.onHit), effects: onHitEffects(w.onHit) } : null,
          visual: { meshId: `weapon-${w.type}-01`, tintPrimary: tint(mat), tintSecondary: WEAPON_SECONDARY_TINT, trimMetal: trimMetal(grade) },
        }),
      )
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// §1 Off-hand foci (kind focus: no attack of their own; 08 "Off-hand focus (no attack)")
// ---------------------------------------------------------------------------------------------------------------

interface FocusRow {
  type: string
  name: string
  ladder: Ladder
  attackSpell: number
  rides?: Record<string, number>
  flat?: Record<string, number>
  wis: number
  classes: string[]
}

const FOCI: readonly FocusRow[] = [
  { type: 'orb', name: 'Orb', ladder: 'wood', attackSpell: 4, rides: { mana: 5 }, wis: 8, classes: [ARCANIST] }, // 08 also Mender; its sheet names the holy symbol
  { type: 'holy-symbol', name: 'Holy Symbol', ladder: 'metal', attackSpell: 5, flat: { resistance: 3 }, wis: 8, classes: [MENDER] },
]

function genFoci(): void {
  for (const f of FOCI) {
    for (const grade of GRADES) {
      const mat = material(f.ladder, grade)
      const baseStats: Record<string, number> = { attackSpell: scaled(f.attackSpell, grade) }
      for (const [k, v] of Object.entries(f.rides ?? {})) baseStats[k] = scaled(v, grade)
      for (const [k, v] of Object.entries(f.flat ?? {})) baseStats[k] = v
      writeItem(
        item({
          id: `${kebab(mat)}-${f.type}`,
          name: `${mat} ${f.name}`,
          slot: 'offHand',
          kind: 'focus',
          grade,
          materialLadder: f.ladder,
          weaponType: 'focus',
          hands: 1,
          damageType: null,
          weight: null,
          baseStats,
          requirements: { strength: 0, wisdom: f.wis + GRADE_ROWS[grade].index },
          wearK: wearK('weapon', grade),
          value: value(grade, SLOT_FACTOR.offHand),
          classLock: f.classes,
          visual: { meshId: `focus-${f.type}-01`, tintPrimary: tint(mat), tintSecondary: WEAPON_SECONDARY_TINT, trimMetal: trimMetal(grade) },
        }),
      )
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// §2 Armor
// ---------------------------------------------------------------------------------------------------------------

type ArmorSlot = 'helmet' | 'chest' | 'legs' | 'boots' | 'gloves'
type ArmorFamily = 'plate' | 'mail' | 'leather' | 'robes'

interface ArmorPiece {
  slot: ArmorSlot
  type: string
  name: string
  defense: number
  hp: number
  /** The secondary line; `rides` = a flat secondary that rides the ladder (Stamina, Mana, Carry, Speed, Detection); percent secondaries step +1 pp per grade above B (08 §2, `percentSecondary`). */
  secondary: { stat: string; value: number; rides: boolean } | null
  strReq: number
}

interface ArmorFamilyRow {
  family: ArmorFamily
  ladder: Ladder
  classes: string[]
  /** Str requirement step per grade: Plate + 2g, Mail and Leather + g, Robes none. */
  reqStep: number
  wear: WearRow
  pieces: readonly ArmorPiece[]
  secondaryTint: string
}

const MESH_SLOT: Record<ArmorSlot, string> = { helmet: 'helm', chest: 'chest', legs: 'legs', boots: 'boots', gloves: 'gloves' }

const ARMOR: readonly ArmorFamilyRow[] = [
  {
    family: 'plate',
    ladder: 'metal',
    classes: [WARDEN],
    reqStep: 2,
    wear: 'plate',
    secondaryTint: '#4a3626',
    pieces: [
      { slot: 'helmet', type: 'helm', name: 'Helm', defense: 3, hp: 6, secondary: { stat: 'resistance', value: 2, rides: false }, strReq: 10 },
      { slot: 'chest', type: 'breastplate', name: 'Breastplate', defense: 8, hp: 10, secondary: { stat: 'stamina', value: 4, rides: true }, strReq: 12 },
      // 08: "+1 Strength" — an attribute, which baseStats (a derived-stat map) cannot hold; omitted and flagged.
      { slot: 'legs', type: 'greaves', name: 'Greaves', defense: 5, hp: 4, secondary: null, strReq: 11 },
      { slot: 'boots', type: 'sabatons', name: 'Sabatons', defense: 2, hp: 2, secondary: { stat: 'carry', value: 2, rides: true }, strReq: 9 },
      { slot: 'gloves', type: 'gauntlets', name: 'Gauntlets', defense: 2, hp: 2, secondary: { stat: 'accuracy', value: 2, rides: false }, strReq: 9 },
    ],
  },
  {
    family: 'mail',
    ladder: 'metal',
    classes: [BLADE, TAMER],
    reqStep: 1,
    wear: 'mail',
    secondaryTint: '#4a3626',
    pieces: [
      { slot: 'helmet', type: 'coif', name: 'Coif', defense: 2, hp: 5, secondary: { stat: 'resistance', value: 1, rides: false }, strReq: 8 },
      { slot: 'chest', type: 'hauberk', name: 'Hauberk', defense: 6, hp: 8, secondary: { stat: 'stamina', value: 3, rides: true }, strReq: 10 },
      { slot: 'legs', type: 'chausses', name: 'Chausses', defense: 4, hp: 3, secondary: { stat: 'speed', value: 1, rides: true }, strReq: 9 },
      { slot: 'boots', type: 'treads', name: 'Treads', defense: 2, hp: 2, secondary: { stat: 'dodge', value: 1, rides: false }, strReq: 8 },
      { slot: 'gloves', type: 'mitts', name: 'Mitts', defense: 1, hp: 2, secondary: { stat: 'critRate', value: 1, rides: false }, strReq: 8 },
    ],
  },
  {
    family: 'leather',
    ladder: 'hide',
    classes: [RANGER, SHADE],
    reqStep: 1,
    wear: 'leather',
    secondaryTint: '#3b2a1e',
    pieces: [
      { slot: 'helmet', type: 'hood', name: 'Hood', defense: 1, hp: 4, secondary: { stat: 'detection', value: 1, rides: true }, strReq: 6 },
      { slot: 'chest', type: 'jerkin', name: 'Jerkin', defense: 4, hp: 6, secondary: { stat: 'dodge', value: 2, rides: false }, strReq: 8 },
      { slot: 'legs', type: 'breeches', name: 'Breeches', defense: 3, hp: 2, secondary: { stat: 'speed', value: 2, rides: true }, strReq: 7 },
      { slot: 'boots', type: 'boots', name: 'Boots', defense: 1, hp: 2, secondary: { stat: 'dodge', value: 2, rides: false }, strReq: 6 },
      { slot: 'gloves', type: 'gloves', name: 'Gloves', defense: 1, hp: 1, secondary: { stat: 'critRate', value: 2, rides: false }, strReq: 6 },
    ],
  },
  {
    family: 'robes',
    ladder: 'cloth',
    classes: [ARCANIST, MENDER],
    reqStep: 0,
    wear: 'robes',
    secondaryTint: '#3b3b3b',
    pieces: [
      { slot: 'helmet', type: 'cowl', name: 'Cowl', defense: 1, hp: 3, secondary: { stat: 'resistance', value: 2, rides: false }, strReq: 0 },
      { slot: 'chest', type: 'robe', name: 'Robe', defense: 2, hp: 4, secondary: { stat: 'mana', value: 4, rides: true }, strReq: 0 },
      { slot: 'legs', type: 'leggings', name: 'Leggings', defense: 1, hp: 2, secondary: { stat: 'speed', value: 1, rides: true }, strReq: 0 },
      { slot: 'boots', type: 'slippers', name: 'Slippers', defense: 0, hp: 1, secondary: { stat: 'dodge', value: 1, rides: false }, strReq: 0 },
      { slot: 'gloves', type: 'wraps', name: 'Wraps', defense: 0, hp: 1, secondary: { stat: 'accuracy', value: 2, rides: false }, strReq: 0 },
    ],
  },
]

/**
 * 08 §2: "percentage secondaries (Resistance, Dodge, Crit, Accuracy) step +1 pp per grade from B upward (so a God
 * Jerkin gives +6% Dodge)" — the Jerkin's 2 + 4 steps (A, S, SS, God), so B keeps the F line and each grade above B
 * adds one point. tuning.json → items.armorPercentStep holds the same two numbers for the linter (rule 22).
 */
const ARMOR_PERCENT_STEP = { fromGradeIndex: 4, pp: 1 } as const

function percentSecondary(value: number, grade: Grade): number {
  return value + ARMOR_PERCENT_STEP.pp * Math.max(0, GRADE_ROWS[grade].index - ARMOR_PERCENT_STEP.fromGradeIndex)
}

/** One armor piece at a grade; `over` lets the set pieces and the uniques rename and re-tint the family piece. */
function armorItem(fam: ArmorFamilyRow, p: ArmorPiece, grade: Grade, over: Partial<ItemOverrides> = {}): ItemRecord {
  const mat = material(fam.ladder, grade)
  const baseStats: Record<string, number> = { defense: scaled(p.defense, grade), hp: scaled(p.hp, grade) }
  if (p.secondary) baseStats[p.secondary.stat] = p.secondary.rides ? scaled(p.secondary.value, grade) : percentSecondary(p.secondary.value, grade)
  // No speed-penalty line: the family's share table lives in tuning.json → equipment.armorSpeedPenaltyShares (D-057).
  return item({
    id: `${kebab(mat)}-${p.type}`,
    name: `${mat} ${p.name}`,
    slot: p.slot,
    kind: 'armor',
    grade,
    materialLadder: fam.ladder,
    armorFamily: fam.family,
    baseStats,
    requirements: { strength: p.strReq === 0 ? 0 : p.strReq + fam.reqStep * GRADE_ROWS[grade].index, wisdom: 0 },
    wearK: wearK(fam.wear, grade),
    value: value(grade, SLOT_FACTOR[p.slot]),
    classLock: fam.classes,
    visual: { meshId: `armor-${fam.family}-${MESH_SLOT[p.slot]}-01`, tintPrimary: tint(mat), tintSecondary: fam.secondaryTint, trimMetal: trimMetal(grade) },
    ...over,
  })
}

function genArmor(): void {
  for (const fam of ARMOR) for (const p of fam.pieces) for (const grade of GRADES) writeItem(armorItem(fam, p, grade))
  hook('armor secondary: +1 Strength on Greaves (an attribute line; baseStats holds derived stats only)', 'Plate Greaves')
}

// ---------------------------------------------------------------------------------------------------------------
// §2.3 Shields
// ---------------------------------------------------------------------------------------------------------------

interface ShieldRow {
  type: string
  name: string
  weaponType: string
  ladder: Ladder
  block: number
  defense: number
  speedPenalty: number
  strReq: number
  reqStep: number
  classes: string[]
}

const SHIELDS: readonly ShieldRow[] = [
  { type: 'buckler', name: 'Buckler', weaponType: 'shieldBuckler', ladder: 'wood', block: 15, defense: 1, speedPenalty: 0, strReq: 6, reqStep: 1, classes: [WARDEN, BLADE, SHADE, MENDER, TAMER] },
  { type: 'kite-shield', name: 'Kite Shield', weaponType: 'shieldKite', ladder: 'wood', block: 25, defense: 3, speedPenalty: -5, strReq: 11, reqStep: 1, classes: [WARDEN, TAMER] },
  { type: 'tower-shield', name: 'Tower Shield', weaponType: 'shieldTower', ladder: 'metal', block: 35, defense: 5, speedPenalty: -10, strReq: 15, reqStep: 2, classes: [WARDEN] },
]

/** One shield at a grade; `over` lets a named unique rename and re-tint the family shield (08 §7). */
function shieldItem(s: ShieldRow, grade: Grade, over: Partial<ItemOverrides> = {}): ItemRecord {
  const mat = material(s.ladder, grade)
  const g = GRADE_ROWS[grade].index
  // Block steps +2 pp per grade and does not ride the ladder (08 §2.3); Defense rides; the speed penalty is flat.
  const baseStats: Record<string, number> = { block: s.block + 2 * g, defense: scaled(s.defense, grade) }
  if (s.speedPenalty !== 0) baseStats.speed = s.speedPenalty
  return item({
    id: `${kebab(mat)}-${s.type}`,
    name: `${mat} ${s.name}`,
    slot: 'offHand',
    kind: 'shield',
    grade,
    materialLadder: s.ladder,
    weaponType: s.weaponType,
    baseStats,
    requirements: { strength: s.strReq + s.reqStep * g, wisdom: 0 },
    wearK: wearK('mail', grade), // 08 §9.1: "Mail · Shields (per block)" share a row
    value: value(grade, SLOT_FACTOR.shield),
    classLock: s.classes,
    visual: { meshId: `shield-${s.type}-01`, tintPrimary: tint(mat), tintSecondary: '#5b4a2f', trimMetal: trimMetal(grade) },
    ...over,
  })
}

function genShields(): void {
  for (const s of SHIELDS) for (const grade of GRADES) writeItem(shieldItem(s, grade))
}

// ---------------------------------------------------------------------------------------------------------------
// §3 Rings and talismans (no ladder; the main line rides the grade multiplier, 08 §3 "it rides the ladder")
// ---------------------------------------------------------------------------------------------------------------

interface TrinketRow {
  base: string
  name: string
  /** The main line(s) at F. "Pool (Stamina or Mana)" is written as both lines: a hero has one pool, the other line is inert. */
  line: Record<string, number>
  gem: string
}

/** 08 §3's twelve rings less Ring of Fortune (+1 Luck: an attribute line the item schema cannot hold; flagged). */
const RINGS: readonly TrinketRow[] = [
  { base: 'ring-of-vigor', name: 'Ring of Vigor', line: { hp: 6 }, gem: '#7f1d1d' },
  { base: 'ring-of-might', name: 'Ring of Might', line: { attackPhys: 2 }, gem: '#b91c1c' },
  { base: 'ring-of-the-mind', name: 'Ring of the Mind', line: { attackSpell: 2 }, gem: '#3b82f6' },
  { base: 'ring-of-the-ward', name: 'Ring of the Ward', line: { defense: 2 }, gem: '#6b7280' },
  { base: 'ring-of-quickness', name: 'Ring of Quickness', line: { speed: 2 }, gem: '#22c55e' },
  { base: 'ring-of-the-eye', name: 'Ring of the Eye', line: { critRate: 1 }, gem: '#f59e0b' },
  { base: 'ring-of-the-hawk', name: 'Ring of the Hawk', line: { accuracy: 1 }, gem: '#a16207' },
  { base: 'ring-of-shadows', name: 'Ring of Shadows', line: { dodge: 1 }, gem: '#1f2937' },
  { base: 'ring-of-resolve', name: 'Ring of Resolve', line: { resistance: 2 }, gem: '#7c3aed' },
  { base: 'ring-of-finding', name: 'Ring of Finding', line: { detection: 1 }, gem: '#0ea5e9' },
  { base: 'ring-of-the-well', name: 'Ring of the Well', line: { stamina: 5, mana: 5 }, gem: '#0f766e' },
]

/** 08 §3's eight talismans less the Coin (+1 Luck), the Steady Heart (Fear-ward) and Embers (light decay): no stat line can hold them; flagged. */
const TALISMANS: readonly TrinketRow[] = [
  { base: 'talisman-of-warding', name: 'Talisman of Warding', line: { resistance: 3 }, gem: '#7c3aed' },
  { base: 'talisman-of-the-drum', name: 'Talisman of the Drum', line: { momentumGain: 4 }, gem: '#dc2626' },
  { base: 'seekers-talisman', name: "Seeker's Talisman", line: { detection: 2 }, gem: '#0ea5e9' },
  { base: 'talisman-of-the-deep-well', name: 'Talisman of the Deep Well', line: { stamina: 8, mana: 8 }, gem: '#0f766e' },
  { base: 'talisman-of-the-mule', name: 'Talisman of the Mule', line: { carry: 4 }, gem: '#92400e' },
]

function genTrinkets(kind: 'ring' | 'talisman', rows: readonly TrinketRow[]): void {
  for (const r of rows) {
    for (const grade of GRADES) {
      const baseStats: Record<string, number> = {}
      for (const [k, v] of Object.entries(r.line)) baseStats[k] = scaled(v, grade)
      const typeSlug = r.base.replace(/^(ring|talisman)-(of-)?(the-)?/, '').replace(/-talisman$/, '')
      writeItem(
        item({
          id: gradedId(r.base, grade),
          name: gradedName(r.name, grade),
          slot: kind,
          kind,
          grade,
          baseStats,
          wearK: 1, // trinkets do not wear in play (08 §3)
          value: value(grade, SLOT_FACTOR[kind]),
          visual: { meshId: `${kind}-${typeSlug}-01`, tintPrimary: tint(material('metal', grade)), tintSecondary: r.gem, trimMetal: trimMetal(grade) },
        }),
      )
    }
  }
  if (kind === 'ring') hook('trinket main line: +Luck (Ring of Fortune, Talisman of the Coin) — an attribute, not a derived stat', 'Ring of Fortune')
  if (kind === 'talisman') {
    hook('trinket main line: Fear chance −10% (Talisman of the Steady Heart)', 'Talisman of the Steady Heart')
    hook('trinket main line: light falls 1 less per new room (Talisman of Embers)', 'Talisman of Embers')
  }
}

// ---------------------------------------------------------------------------------------------------------------
// §3 Relics — Gravehollow's nine: the Cellars' three (Lantern of the Deep, Moth Charm, the Grinning Mask) and the six
// of the Crypts and the Vault (Phase 7). One record each at its first grade (08 §3 "First grade").
// ---------------------------------------------------------------------------------------------------------------

interface RelicRow {
  id: string
  name: string
  grade: Grade
  /** 08 §3 "(instant)": no Item action — the hero acts again (weight null on the record). */
  instant: boolean
  usesPerFight: number
  /** "once per floor" (the Hollow Coin). */
  usesPerFloor?: number
  /** Used when the fight is over (the Hollow Coin re-rolls the fight's item drop), not in it. */
  afterFight?: boolean
  target: string
  /** 08 §3's Effect column, for the card. */
  text: string
  effects: Effect[]
  mesh: string
  tint: string
  tint2: string
  trim: string
  /** `boss-only`: a boss's own relic (08 §3 Source), never a random drop or a chest's (loot.ts pickGearItem). */
  tags?: string[]
}

const RELICS: readonly RelicRow[] = [
  {
    id: 'lantern-of-the-deep',
    name: 'Lantern of the Deep',
    grade: 'E',
    instant: true,
    usesPerFight: 1,
    target: 'room',
    text: 'Sets the light to Radiant for 3 rounds',
    effects: [{ kind: 'light', amount: 100, target: 'room', duration: 3, note: 'sets light to Radiant for 3 rounds (instant): the sim clamps the dial at 100; the revert after 3 rounds is a hook' }],
    mesh: 'relic-deep-lantern-01',
    tint: '#1e3a5f',
    tint2: '#e8a33c',
    trim: 'bronze',
  },
  {
    id: 'moth-charm',
    name: 'Moth Charm',
    grade: 'E',
    instant: false,
    usesPerFight: 1,
    target: 'allEnemies',
    text: 'Blinds every enemy for 1 round',
    effects: [{ kind: 'applyStatus', status: 'blind', duration: 1, target: 'allEnemies' }],
    mesh: 'relic-moth-charm-01',
    tint: '#c9b58a',
    tint2: '#5b5650',
    trim: 'bronze',
  },
  // The Phase 2 fixture record (sim/test/fixtures/content/items/relic/the-grinning-mask.json) plus its card text and tag.
  {
    id: 'the-grinning-mask',
    name: 'The Grinning Mask',
    grade: 'C',
    instant: false,
    usesPerFight: 1,
    target: 'enemyFront',
    text: 'Fears the enemy front row for 1 round',
    effects: [{ kind: 'applyStatus', status: 'fear', duration: 1, target: 'enemyFront' }],
    mesh: 'relic-grin-mask-01',
    tint: '#f1ece4',
    tint2: '#9b1c1c',
    trim: 'brass',
    tags: ['boss-only'],
  },
  {
    id: 'hourglass-shard',
    name: 'Hourglass Shard',
    grade: 'D',
    instant: true,
    usesPerFight: 1,
    target: 'self',
    text: 'Your next action weighs nothing',
    effects: [{ kind: 'custom', customId: 'next-action-weightless', target: 'self', note: '08 §3: "Your next action weighs 0 (instant)"' }],
    mesh: 'relic-hourglass-shard-01',
    tint: '#d9c38a',
    tint2: '#9ec5e0',
    trim: 'bronze',
  },
  {
    id: 'the-barrow-bell',
    name: 'The Barrow Bell',
    grade: 'D',
    instant: false,
    usesPerFight: 1,
    target: 'allEnemies',
    text: 'Taunts every enemy onto you for 2 rounds; Fortify 1 round',
    effects: [
      { kind: 'taunt', duration: 2, target: 'allEnemies' },
      { kind: 'applyStatus', status: 'fortify', duration: 1, target: 'self' },
    ],
    mesh: 'relic-barrow-bell-01',
    tint: '#6b6f73',
    tint2: '#2f5e4a',
    trim: 'iron',
    tags: ['boss-only'],
  },
  {
    id: 'candle-of-the-crypt',
    name: 'Candle of the Crypt',
    grade: 'D',
    instant: false,
    usesPerFight: 1,
    target: 'allAllies',
    text: 'Regen 5% of max HP per round on the party for 3 rounds',
    effects: [{ kind: 'applyStatus', status: 'regen', percent: 5, duration: 3, target: 'allAllies' }],
    mesh: 'relic-crypt-candle-01',
    tint: '#e8e0c8',
    tint2: '#7fbf6a',
    trim: 'bronze',
  },
  // "Brine Pearl" (08 §3) shares its name with the Tidebound's rare part (08 §8.3, `brine-pearl`); the relic takes the
  // article so the two read apart (Phase 7, Proposed).
  {
    id: 'the-brine-pearl',
    name: 'The Brine Pearl',
    grade: 'C',
    instant: true,
    usesPerFight: 1,
    target: 'allyLowest',
    text: 'Shields the lowest ally for 25% of their max HP',
    effects: [{ kind: 'shield', percent: 25, target: 'allyLowest' }],
    mesh: 'relic-brine-pearl-01',
    tint: '#dfe7ea',
    tint2: '#0f766e',
    trim: 'steel',
  },
  {
    id: 'the-tidebound-idol',
    name: 'The Tidebound Idol',
    grade: 'C',
    instant: false,
    usesPerFight: 1,
    target: 'allAllies',
    text: 'Cleanses every debuff on the party',
    effects: [{ kind: 'dispel', target: 'allAllies', note: 'on allies, dispel cleanses every debuff (sim/src/effects.ts)' }],
    mesh: 'relic-tidebound-idol-01',
    tint: '#1e3a4a',
    tint2: '#9ec5e0',
    trim: 'brass',
    tags: ['boss-only'],
  },
  {
    id: 'the-hollow-coin',
    name: 'The Hollow Coin',
    grade: 'C',
    instant: false,
    usesPerFight: 1,
    usesPerFloor: 1,
    afterFight: true,
    target: 'self',
    text: "Re-rolls this fight's item drop after the fight, once per floor",
    effects: [{ kind: 'custom', customId: 'reroll-fight-drop', target: 'self', note: 'resolved by the delve after a won fight (sim/src/relics.ts)' }],
    mesh: 'relic-hollow-coin-01',
    tint: '#3a3a3a',
    tint2: '#c9a227',
    trim: 'brass',
    tags: ['boss-only'],
  },
]

function genRelics(): void {
  for (const r of RELICS) {
    for (const e of r.effects) if (e.kind === 'custom') hook(`custom ${String(e.customId)}`, r.name)
    const active: ActiveRecord = { effects: r.effects, usesPerFight: r.usesPerFight, target: r.target, text: r.text }
    if (r.instant) active.instant = true
    if (r.usesPerFloor !== undefined) active.usesPerFloor = r.usesPerFloor
    if (r.afterFight) active.timing = 'afterFight'
    writeItem(
      item({
        id: r.id,
        name: r.name,
        slot: 'relic',
        kind: 'relic',
        grade: r.grade,
        // Activating a relic is an Item action (weight 600) unless instant (08 §3); an after-fight relic is no fight action.
        weight: r.instant || r.afterFight ? null : 600,
        value: value(r.grade, SLOT_FACTOR.relic),
        active,
        visual: { meshId: r.mesh, tintPrimary: r.tint, tintSecondary: r.tint2, trimMetal: r.trim },
        tags: r.tags ?? [],
      }),
    )
  }
  hook('relic: Lantern of the Deep reverts to the previous light after 3 rounds', 'Lantern of the Deep')
}

// ---------------------------------------------------------------------------------------------------------------
// §4 Consumables (weight 600; value = town price in R at band F × 300)
// ---------------------------------------------------------------------------------------------------------------

interface ConsumableRow {
  id: string
  name: string
  effects: Effect[]
  stackMax: number
  target: string
  inCombat: boolean
  priceR: number
  mesh: string
  tint: string
  kind?: 'consumable' | 'treat'
  /** What the card says it is for (a safe item's curio, the Torch in a fight). */
  text?: string
  /** `safe-item` + `zone:<zoneId>` on the merchant's safe items (07 §2.7; explore.ts stocks by tag). */
  tags?: string[]
}

const CONSUMABLE_TINT = '#2b2b2b'

/** The zone ids of Gravehollow (content/dungeons/gravehollow-keep/dungeon.json): the merchant stocks "2 of the zone's safe items" (07 §2.7). */
const ZONE = { cellars: 'zone:the-cellars', crypts: 'zone:the-crypts', vault: 'zone:the-drowned-vault' } as const
const SAFE = 'safe-item'

const CONSUMABLES: readonly ConsumableRow[] = [
  { id: 'small-hp-potion', name: 'Small HP Potion', effects: [{ kind: 'heal', percent: 25 }], stackMax: 10, target: 'ally', inCombat: true, priceR: 0.03, mesh: 'consumable-potion-small-01', tint: '#b3261e' },
  { id: 'medium-hp-potion', name: 'Medium HP Potion', effects: [{ kind: 'heal', percent: 40 }], stackMax: 10, target: 'ally', inCombat: true, priceR: 0.05, mesh: 'consumable-potion-medium-01', tint: '#b3261e' },
  { id: 'large-hp-potion', name: 'Large HP Potion', effects: [{ kind: 'heal', percent: 60 }], stackMax: 10, target: 'ally', inCombat: true, priceR: 0.08, mesh: 'consumable-potion-large-01', tint: '#b3261e' },
  // `pool` restores the drinker's pool (stamina or mana by class); the DSL cannot name one pool, so a Stamina draught and a Mana draught act alike — noted.
  { id: 'small-stamina-draught', name: 'Small Stamina Draught', effects: [{ kind: 'pool', percent: 30, note: 'Stamina; the pool line restores the drinker\'s own pool' }], stackMax: 10, target: 'ally', inCombat: true, priceR: 0.03, mesh: 'consumable-draught-small-01', tint: '#d97706' },
  { id: 'medium-stamina-draught', name: 'Medium Stamina Draught', effects: [{ kind: 'pool', percent: 50, note: 'Stamina' }], stackMax: 10, target: 'ally', inCombat: true, priceR: 0.05, mesh: 'consumable-draught-medium-01', tint: '#d97706' },
  { id: 'large-stamina-draught', name: 'Large Stamina Draught', effects: [{ kind: 'pool', percent: 80, note: 'Stamina' }], stackMax: 10, target: 'ally', inCombat: true, priceR: 0.08, mesh: 'consumable-draught-large-01', tint: '#d97706' },
  { id: 'small-mana-draught', name: 'Small Mana Draught', effects: [{ kind: 'pool', percent: 30, note: 'Mana; the pool line restores the drinker\'s own pool' }], stackMax: 10, target: 'ally', inCombat: true, priceR: 0.03, mesh: 'consumable-draught-small-01', tint: '#2563eb' },
  { id: 'medium-mana-draught', name: 'Medium Mana Draught', effects: [{ kind: 'pool', percent: 50, note: 'Mana' }], stackMax: 10, target: 'ally', inCombat: true, priceR: 0.05, mesh: 'consumable-draught-medium-01', tint: '#2563eb' },
  { id: 'large-mana-draught', name: 'Large Mana Draught', effects: [{ kind: 'pool', percent: 80, note: 'Mana' }], stackMax: 10, target: 'ally', inCombat: true, priceR: 0.08, mesh: 'consumable-draught-large-01', tint: '#2563eb' },
  {
    id: 'antidote',
    name: 'Antidote',
    effects: [
      { kind: 'removeStatus', status: 'poison' },
      { kind: 'removeStatus', status: 'bleed' },
      { kind: 'custom', customId: 'status-resist-bonus', status: 'poison', percent: 50, duration: 3, note: '+50% Poison resistance for 3 rounds' },
    ],
    stackMax: 10,
    target: 'ally',
    inCombat: true,
    priceR: 0.02,
    mesh: 'consumable-antidote-01',
    tint: '#5fa83a',
  },
  { id: 'cleansing-salt', name: 'Cleansing Salt', effects: [{ kind: 'dispel', target: 'ally', note: 'on an ally, dispel cleanses every debuff (sim/src/effects.ts)' }], stackMax: 10, target: 'ally', inCombat: true, priceR: 0.06, mesh: 'consumable-cleansing-salt-01', tint: '#f1ece4' },
  { id: 'haste-tonic', name: 'Haste Tonic', effects: [{ kind: 'applyStatus', status: 'haste', duration: 3 }], stackMax: 10, target: 'ally', inCombat: true, priceR: 0.1, mesh: 'consumable-haste-tonic-01', tint: '#eab308' },
  { id: 'fortify-draught', name: 'Fortify Draught', effects: [{ kind: 'applyStatus', status: 'fortify', duration: 3 }], stackMax: 10, target: 'ally', inCombat: true, priceR: 0.08, mesh: 'consumable-fortify-draught-01', tint: '#6b7280' },
  // In a fight the Torch is an Item action (07 §2.8: "An Item action with a Torch relights (+25)"; the Hollow King's braziers): inCombat since Phase 7.
  { id: 'torch', name: 'Torch', effects: [{ kind: 'light', amount: 25, target: 'room' }], stackMax: 10, target: 'room', inCombat: true, priceR: 0.02, mesh: 'consumable-torch-01', tint: '#e8a33c', text: '+25 light; in a fight, an Item action (it relights an arena brazier)' },
  { id: 'repair-kit', name: 'Repair Kit', effects: [{ kind: 'custom', customId: 'repair-durability', percent: 25, note: '+25% durability to one item, out of combat' }], stackMax: 5, target: 'self', inCombat: false, priceR: 0.08, mesh: 'consumable-repair-kit-01', tint: '#6b7280' },
  { id: 'phoenix-feather', name: 'Phoenix Feather', effects: [{ kind: 'revive', percent: 30, target: 'downedAlly' }], stackMax: 2, target: 'downedAlly', inCombat: true, priceR: 0.5, mesh: 'consumable-phoenix-feather-01', tint: '#f97316' },
  { id: 'bandage', name: 'Bandage', effects: [{ kind: 'removeStatus', status: 'bleed' }, { kind: 'heal', percent: 15 }], stackMax: 10, target: 'ally', inCombat: true, priceR: 0.02, mesh: 'consumable-bandage-01', tint: '#f1ece4' },
  { id: 'ration', name: 'Ration', effects: [{ kind: 'heal', percent: 10, target: 'allAllies' }, { kind: 'pool', percent: 10, target: 'allAllies' }], stackMax: 10, target: 'allAllies', inCombat: false, priceR: 0.02, mesh: 'consumable-ration-01', tint: '#a16207' },
  // Cooking ingredients: a meal is cooked at a rest room (field skill Cooking); using one alone is the Cooking hook.
  { id: 'herb', name: 'Herb', effects: [{ kind: 'custom', customId: 'meal', percent: 5, note: 'with Cooking at a rest room: a meal, +5% to one stat for the next floor' }], stackMax: 20, target: 'allAllies', inCombat: false, priceR: 0.01, mesh: 'consumable-herb-01', tint: '#4caf50' },
  { id: 'mushroom', name: 'Mushroom', effects: [{ kind: 'custom', customId: 'meal', percent: 5, note: 'cooking ingredient' }], stackMax: 20, target: 'allAllies', inCombat: false, priceR: 0.01, mesh: 'consumable-mushroom-01', tint: '#9c8f7a' },
  { id: 'meat', name: 'Meat', effects: [{ kind: 'custom', customId: 'meal', percent: 5, note: 'cooking ingredient; monster parts' }], stackMax: 20, target: 'allAllies', inCombat: false, priceR: 0.01, mesh: 'consumable-meat-01', tint: '#9b1c1c' },
  { id: 'fish', name: 'Fish', effects: [{ kind: 'custom', customId: 'meal', percent: 5, note: 'cooking ingredient' }], stackMax: 20, target: 'allAllies', inCombat: false, priceR: 0.01, mesh: 'consumable-fish-01', tint: '#6b7a80' },
  { id: 'salt', name: 'Salt', effects: [{ kind: 'custom', customId: 'meal', percent: 5, note: 'cooking ingredient' }], stackMax: 20, target: 'allAllies', inCombat: false, priceR: 0.01, mesh: 'consumable-salt-01', tint: '#f1ece4' },
  // The safe items (07 §2.4): bought from the merchant, consumed by the curio's `requires` line. Flint & Oil relights (the
  // Lost Lantern line); the others have no use outside their curio, so their effect list is empty and the card says
  // which curio they answer. The merchant's eight (07 §2.7) carry `safe-item` and their zone; Holy Water and the Loaded
  // Dice (a Cutpurse's rare part) are safe items too but never merchant stock, so they carry no tag.
  { id: 'flint-and-oil', name: 'Flint & Oil', effects: [{ kind: 'light', amount: 25, target: 'room' }], stackMax: 5, target: 'room', inCombat: false, priceR: 0.02, mesh: 'consumable-flint-oil-01', tint: '#5b5650', text: 'The Lost Lantern: relight it, +25 light for sure', tags: [SAFE, ZONE.cellars] },
  { id: 'holy-water', name: 'Holy Water', effects: [], stackMax: 5, target: 'room', inCombat: false, priceR: 0.02, mesh: 'consumable-holy-water-01', tint: '#bfdbfe', text: "The Toll Shrine, the Sealed Sarcophagus and the Thrall's Cage: the good outcome, for sure" },
  { id: 'loaded-dice', name: 'Loaded Dice', effects: [], stackMax: 5, target: 'room', inCombat: false, priceR: 0.02, mesh: 'consumable-loaded-dice-01', tint: '#f1ece4', text: "The Company's Dice Table: a sure win" },
  { id: 'grave-salt', name: 'Grave Salt', effects: [], stackMax: 5, target: 'room', inCombat: false, priceR: 0.02, mesh: 'consumable-grave-salt-01', tint: '#9a9a9a', text: 'The Funeral Urns: gold from every urn, for sure', tags: [SAFE, ZONE.crypts] },
  { id: 'candle-of-vigil', name: 'Candle of Vigil', effects: [], stackMax: 5, target: 'room', inCombat: false, priceR: 0.02, mesh: 'consumable-candle-of-vigil-01', tint: '#fde68a', text: 'The Bone Reliquary: the Holy blessing, for sure', tags: [SAFE, ZONE.crypts] },
  // The five Phase 7 adds (07 §2.4's Crypts and Vault curios).
  { id: 'reading-glass', name: 'Reading Glass', effects: [], stackMax: 5, target: 'room', inCombat: false, priceR: 0.02, mesh: 'consumable-reading-glass-01', tint: '#c9a227', text: "The Warden's Ledger: read it safely, the map for sure", tags: [SAFE, ZONE.crypts] },
  { id: 'empty-vial', name: 'Empty Vial', effects: [], stackMax: 5, target: 'room', inCombat: false, priceR: 0.02, mesh: 'consumable-empty-vial-01', tint: '#dfe7ea', text: "The Weeping Statue: bottle the tears, a Mourner's Tear and the heal for sure", tags: [SAFE, ZONE.crypts] },
  { id: 'oilskin-cloak', name: 'Oilskin Cloak', effects: [], stackMax: 5, target: 'room', inCombat: false, priceR: 0.02, mesh: 'consumable-oilskin-cloak-01', tint: '#5c4a2e', text: 'The Brine Pool: wade it dry, the coins for sure', tags: [SAFE, ZONE.vault] },
  { id: 'wax-plugs', name: 'Wax Plugs', effects: [], stackMax: 5, target: 'room', inCombat: false, priceR: 0.02, mesh: 'consumable-wax-plugs-01', tint: '#e8d9a0', text: "The Priestess's Hymnal: read it deaf, Silence immunity this floor for sure", tags: [SAFE, ZONE.vault] },
  { id: 'rope-and-hook', name: 'Rope & Hook', effects: [], stackMax: 5, target: 'room', inCombat: false, priceR: 0.02, mesh: 'consumable-rope-and-hook-01', tint: '#8b6b3e', text: 'The Drowned Chest: haul it out, the Large chest for sure', tags: [SAFE, ZONE.vault] },
  // The pet treat is kind `treat` (content/README.md lists treat/); it carries a consumable block so the bag can use it.
  { id: 'pet-treat', name: 'Pet Treat', kind: 'treat', effects: [{ kind: 'custom', customId: 'pet-treat', percent: 10, target: 'pet', note: '+10% pet XP this delve (once per delve); +5% bond progress' }], stackMax: 5, target: 'pet', inCombat: false, priceR: 0.05, mesh: 'treat-pet-treat-01', tint: '#a16207' },
]

function genConsumables(): void {
  for (const c of CONSUMABLES) {
    for (const e of c.effects) if (e.kind === 'custom') hook(`custom ${String(e.customId)}`, c.name)
    writeItem(
      item({
        id: c.id,
        name: c.name,
        kind: c.kind ?? 'consumable',
        grade: 'F',
        weight: 600,
        value: roundHalfUp(c.priceR * R_F),
        consumable: { effects: c.effects, stackMax: c.stackMax, target: c.target, inCombat: c.inCombat, ...(c.text ? { text: c.text } : {}) },
        visual: { meshId: c.mesh, tintPrimary: c.tint, tintSecondary: CONSUMABLE_TINT, trimMetal: 'none' },
        tags: c.tags ?? [],
      }),
    )
  }
}

// ---------------------------------------------------------------------------------------------------------------
// §4 Ammo, §8 materials, §8.6 stones and the Cellars' rare parts (06 §1, §3.1), keys, §9 eggs
// ---------------------------------------------------------------------------------------------------------------

function genAmmo(): void {
  writeItem(item({ id: 'arrows', name: 'Arrows', kind: 'ammo', grade: 'F', value: roundHalfUp(0.02 * R_F), ammo: { stack: 50 }, visual: { meshId: 'ammo-arrows-01', tintPrimary: '#a0824a', tintSecondary: '#e8e0c8', trimMetal: 'iron' } }))
  writeItem(item({ id: 'bolts', name: 'Bolts', kind: 'ammo', grade: 'F', value: roundHalfUp(0.03 * R_F), ammo: { stack: 50 }, visual: { meshId: 'ammo-bolts-01', tintPrimary: '#8b6b3e', tintSecondary: '#8a8f98', trimMetal: 'iron' } }))
}

const MATERIAL_SHAPE: Record<Ladder, string> = { metal: 'ingot', hide: 'hide', cloth: 'bolt', wood: 'plank' }

function genMaterials(): void {
  for (const ladder of ['metal', 'hide', 'cloth', 'wood'] as const) {
    for (const grade of GRADES) {
      const mat = material(ladder, grade)
      writeItem(
        item({
          id: kebab(mat),
          name: mat,
          kind: 'material',
          grade,
          materialLadder: ladder,
          value: need(MATERIAL_PRICE[GRADE_ROWS[grade].index], 'material price'),
          visual: { meshId: `material-${MATERIAL_SHAPE[ladder]}-${kebab(mat)}-01`, tintPrimary: tint(mat), tintSecondary: CONSUMABLE_TINT, trimMetal: 'none' },
        }),
      )
    }
  }
  // Regional names that count as a rung (06 §1: "Cured Ghoulhide (= Boiled Leather, D)", "Sharkskin (= Wolf Hide, C)";
  // 08 §8.3: "Spidersilk (counts as Silk)"; 08 §8.1: "Promotion accepts either variant of a rung"). Tagged `regional` so
  // a crate, a salvage or a chest dupe always pays the rung's first name (items.ts `rungMaterial`).
  for (const r of REGIONAL) {
    writeItem(
      item({
        id: kebab(r.name),
        name: r.name,
        kind: 'material',
        grade: r.grade,
        materialLadder: r.ladder,
        value: need(MATERIAL_PRICE[GRADE_ROWS[r.grade].index], 'material price'),
        visual: { meshId: `material-${MATERIAL_SHAPE[r.ladder]}-${kebab(r.name)}-01`, tintPrimary: r.tint, tintSecondary: CONSUMABLE_TINT, trimMetal: 'none' },
        tags: ['regional'],
      }),
    )
  }
  // Parts that only sell (06 §3: "Spider Silk thread (sells)", "Bat Wing, sells", "Deep Flesh, sells", "Brine Salt, sells";
  // 08 §8.3: "Bone Shards sell (0.01 R) and feed Field Repair"): materials off every ladder, so a monster's
  // parts.common.materialId can name them (rule 2 wants a material there); they never promote anything. Each sells at
  // 0.01 R of its zone's band (a tuning reading).
  for (const m of SELL_PARTS) writeItem(item({ id: m.id, name: m.name, kind: 'material', grade: m.grade, value: roundHalfUp(0.01 * R_BAND[m.grade]), visual: { meshId: `material-${m.shape}-${m.id}-01`, tintPrimary: m.tint, tintSecondary: CONSUMABLE_TINT, trimMetal: 'none' } }))
  // The Mourner's Tear (07 §2.4, the Weeping Statue: "a rare Mender ingredient"): a material off every ladder that sells
  // like a Crypts rare part; no recipe reads it yet.
  writeItem(item({ id: 'mourners-tear', name: "Mourner's Tear", kind: 'material', grade: 'E', value: roundHalfUp(0.04 * R_BAND.E), visual: { meshId: 'material-vial-mourners-tear-01', tintPrimary: '#bfe3f0', tintSecondary: CONSUMABLE_TINT, trimMetal: 'none' } }))
  // The Divine Shard (08 §4: "10 forge one God item at the blacksmith, or convert 1 → 5 units of any God-rung material
  // · never sold"; chests already put it in profile.materials['divine-shard']). A material off every ladder; its grade
  // is SS because a God-grade record must be a unique God item (rule 23) — the forge is Phase 11.
  writeItem(item({ id: 'divine-shard', name: 'Divine Shard', kind: 'material', grade: 'SS', value: 0, visual: { meshId: 'material-shard-divine-01', tintPrimary: '#fff1c7', tintSecondary: '#f5d76e', trimMetal: 'none' } }))
}

/** R per band (08's R table): the gold a sellable part or a zone's rare part is priced from. */
const R_BAND: Record<'F' | 'E' | 'D' | 'C', number> = { F: 300, E: 480, D: 770, C: 1230 }

const REGIONAL: readonly { name: string; ladder: Ladder; grade: Grade; tint: string }[] = [
  { name: 'Cured Ghoulhide', ladder: 'hide', grade: 'D', tint: '#6b5a44' },
  { name: 'Spidersilk', ladder: 'cloth', grade: 'C', tint: '#e3e0ea' },
  { name: 'Sharkskin', ladder: 'hide', grade: 'C', tint: '#7b8a92' },
]

const SELL_PARTS: readonly { id: string; name: string; grade: 'F' | 'E' | 'D'; shape: string; tint: string }[] = [
  { id: 'spider-silk', name: 'Spider Silk', grade: 'F', shape: 'thread', tint: '#e5e7eb' },
  { id: 'bone-shard', name: 'Bone Shard', grade: 'E', shape: 'shard', tint: '#e7e5e4' },
  { id: 'bat-wing', name: 'Bat Wing', grade: 'E', shape: 'wing', tint: '#3f3f46' },
  { id: 'deep-flesh', name: 'Deep Flesh', grade: 'D', shape: 'lump', tint: '#4a5d6a' },
  { id: 'brine-salt', name: 'Brine Salt', grade: 'D', shape: 'crystal', tint: '#dfe7ea' },
]

interface StoneRow {
  id: string
  name: string
  grade: AnyGrade
  /** Gold. Whetstone 0.04 R, Honing Oil 0.12 R (08 §8.6); Star Grit is never sold: 0.36 R, the ×3 step continued, a tuning reading. Rare-part stones 12 (= a Whetstone); Spider Silk sells like a Bone Shard, 0.01 R. */
  value: number
  tint: string
}

const STONES: readonly StoneRow[] = [
  { id: 'whetstone', name: 'Whetstone', grade: 'F', value: 12, tint: '#9a9a9a' },
  { id: 'honing-oil', name: 'Honing Oil', grade: 'B', value: 36, tint: '#d97706' },
  { id: 'star-grit', name: 'Star Grit', grade: 'S', value: 108, tint: '#fff1c7' },
  { id: 'rat-tail-charm', name: 'Rat-tail Charm', grade: 'F', value: 12, tint: '#e8a0a0' },
  { id: 'plague-gland', name: 'Plague Gland', grade: 'F', value: 12, tint: '#5fa83a' },
  { id: 'alpha-pelt', name: 'Alpha Pelt', grade: 'F', value: 12, tint: '#6e6a60' },
  { id: 'spinneret', name: 'Spinneret', grade: 'F', value: 12, tint: '#9ca3af' },
  { id: 'weavers-gland', name: "Weaver's Gland", grade: 'F', value: 12, tint: '#d1d5db' },
  { id: 'marked-cards', name: 'Marked Cards', grade: 'F', value: 12, tint: '#f1ece4' },
  { id: 'weighted-net', name: 'Weighted Net', grade: 'F', value: 12, tint: '#6b7a80' },
  { id: 'hexers-fetish', name: "Hexer's Fetish", grade: 'F', value: 12, tint: '#4c1d95' },
  { id: 'gnaws-tooth', name: "Gnaw's Tooth", grade: 'F', value: 12, tint: '#f4f1ea' },
  // The Crypts' rare parts (06 §3.2): affix stones at the zone's band, valued like its Whetstone (0.04 R at E).
  { id: 'knights-gorget', name: "Knight's Gorget", grade: 'E', value: 19, tint: '#8a8f98' },
  { id: 'sextons-bell', name: "Sexton's Bell", grade: 'E', value: 19, tint: '#b08d57' },
  { id: 'grave-candle', name: 'Grave Candle', grade: 'E', value: 19, tint: '#d9e8c5' },
  { id: 'ghoul-claw', name: 'Ghoul Claw', grade: 'E', value: 19, tint: '#6b5a44' },
  { id: 'wraith-ash', name: 'Wraith Ash', grade: 'E', value: 19, tint: '#5b5650' },
  { id: 'tomb-spinneret', name: 'Tomb Spinneret', grade: 'E', value: 19, tint: '#d1d5db' },
  { id: 'hounds-collar', name: "Hound's Collar", grade: 'E', value: 19, tint: '#7f1d1d' },
  // The Drowned Vault's rare parts (06 §3.3) at 0.04 R of band D. The Brine Pearl is also the trinket affix stone and
  // the Tide Altar's safe item (08 §8.3, 07 §2.4); the Sentinel Core is 07's Sentinel Plinth "Construct Core" (Phase 7
  // reading); the Maw Pearl is "SS-rated", so it carries SS and a Honing Oil's worth (0.12 R at D).
  { id: 'brine-pearl', name: 'Brine Pearl', grade: 'D', value: 31, tint: '#dfe7ea' },
  { id: 'tide-glass', name: 'Tide Glass', grade: 'D', value: 31, tint: '#7dd3fc' },
  { id: 'penance-chain', name: 'Penance Chain', grade: 'D', value: 31, tint: '#6b7280' },
  { id: 'diving-bell-plate', name: 'Diving Bell Plate', grade: 'D', value: 31, tint: '#8a8f98' },
  { id: 'sentinel-core', name: 'Sentinel Core', grade: 'D', value: 31, tint: '#0ea5e9' },
  { id: 'hags-eye', name: "Hag's Eye", grade: 'D', value: 31, tint: '#a3e635' },
  { id: 'leech-heart', name: 'Leech Heart', grade: 'D', value: 31, tint: '#7f1d1d' },
  { id: 'maw-pearl', name: 'Maw Pearl', grade: 'SS', value: 92, tint: '#c9d3e6' },
]

function genStones(): void {
  for (const s of STONES) {
    writeItem(item({ id: s.id, name: s.name, kind: 'stone', grade: s.grade, value: s.value, visual: { meshId: `stone-${s.id}-01`, tintPrimary: s.tint, tintSecondary: CONSUMABLE_TINT, trimMetal: 'none' } }))
  }
}

function genKeys(): void {
  // Tags say what a key opens (Phase 7): `skeleton-key` a locked chest or door in the dungeon (07 §2.7); `chest-key:<tier>`
  // one Curio Merchant chest of that tier free (07 §7: "A Standard Key opens one Standard chest free; a Grand Key one
  // Grand chest"). Chest keys are counted in profile.materials[<key id>], where reward lines land (town.ts openChestWithKey).
  const keys: { id: string; name: string; value: number; mesh: string; tags: string[] }[] = [
    { id: 'skeleton-key', name: 'Skeleton Key', value: roundHalfUp(0.2 * R_F), mesh: 'key-skeleton-01', tags: ['skeleton-key'] },
    { id: 'bandit-lockpick', name: 'Bandit Lockpick', value: roundHalfUp(0.2 * R_F), mesh: 'key-lockpick-01', tags: ['skeleton-key'] }, // a one-use Skeleton Key (06 §3.1)
    { id: 'standard-chest-key', name: 'Standard Chest Key', value: roundHalfUp(0.5 * R_F), mesh: 'key-chest-standard-01', tags: ['chest-key:standard'] }, // the Standard chest's price (08 §10.1)
    { id: 'grand-chest-key', name: 'Grand Chest Key', value: roundHalfUp(2.5 * R_F), mesh: 'key-chest-grand-01', tags: ['chest-key:grand'] },
  ]
  for (const k of keys) writeItem(item({ id: k.id, name: k.name, kind: 'key', grade: 'F', value: k.value, visual: { meshId: k.mesh, tintPrimary: '#8a8f98', tintSecondary: CONSUMABLE_TINT, trimMetal: 'iron' }, tags: k.tags }))
}

/** The sixteen pet species of 06 §9; an egg record's grade is the bottom of its species' drop band (the chest roll carries the hatched grade). */
const PETS: readonly { id: string; name: string; grade: AnyGrade; tint: string; tint2: string }[] = [
  { id: 'cellar-hound', name: 'Cellar Hound', grade: 'F', tint: '#4b3b2f', tint2: '#c2b280' },
  { id: 'rat-prince', name: 'Rat Prince', grade: 'F', tint: '#6b7280', tint2: '#d4d4d8' },
  { id: 'spiderling', name: 'Spiderling', grade: 'F', tint: '#1f2937', tint2: '#9ca3af' },
  { id: 'crypt-bat', name: 'Crypt Bat', grade: 'E', tint: '#3f3f46', tint2: '#7f1d1d' },
  { id: 'bone-pup', name: 'Bone Pup', grade: 'E', tint: '#e7e5e4', tint2: '#60a5fa' },
  { id: 'wisp', name: 'Wisp', grade: 'D', tint: '#fde68a', tint2: '#f1ece4' },
  { id: 'brine-crab', name: 'Brine Crab', grade: 'D', tint: '#0f766e', tint2: '#e8e0c8' },
  { id: 'vault-imp', name: 'Vault Imp', grade: 'C', tint: '#f1ece4', tint2: '#0ea5e9' },
  { id: 'sporeling', name: 'Sporeling', grade: 'C', tint: '#a3e635', tint2: '#4d7c0f' },
  { id: 'moss-tortoise', name: 'Moss Tortoise', grade: 'C', tint: '#4d7c0f', tint2: '#78716c' },
  { id: 'cave-owl', name: 'Cave Owl', grade: 'C', tint: '#78716c', tint2: '#fbbf24' },
  { id: 'ember-fox', name: 'Ember Fox', grade: 'B', tint: '#c2410c', tint2: '#fbbf24' },
  { id: 'forge-beetle', name: 'Forge Beetle', grade: 'B', tint: '#b45309', tint2: '#1c1917' },
  { id: 'salamander-hatchling', name: 'Salamander Hatchling', grade: 'B', tint: '#dc2626', tint2: '#f97316' },
  { id: 'frost-kit', name: 'Frost Kit', grade: 'A', tint: '#f1f5f9', tint2: '#60a5fa' },
  { id: 'drakeling', name: 'Drakeling', grade: 'S', tint: '#1e3a8a', tint2: '#93c5fd' },
]

function genEggs(): void {
  for (const p of PETS) {
    writeItem(item({ id: `${p.id}-egg`, name: `${p.name} Egg`, kind: 'egg', grade: p.grade, value: 0, visual: { meshId: `egg-${p.id}-01`, tintPrimary: p.tint, tintSecondary: p.tint2, trimMetal: 'none' } }))
  }
}

// ---------------------------------------------------------------------------------------------------------------
// §5 The affix pool
// ---------------------------------------------------------------------------------------------------------------

const SLOT_ORDER: readonly string[] = ['mainHand', 'offHand', 'helmet', 'chest', 'legs', 'boots', 'gloves', 'ring', 'talisman', 'relic']

/** Slot groups of 08 §5's "Slots it can roll on". The schema filters by slot only: "Robes", "Leather", "Censers", "Pierce weapons" are read as their slots (a type/family filter is a sim hook). */
const SG = {
  any: SLOT_ORDER,
  armor: ['helmet', 'chest', 'legs', 'boots', 'gloves'],
  weapons: ['mainHand', 'offHand'],
  foci: ['mainHand', 'offHand'],
  shields: ['offHand'],
} as const

function slots(...groups: (readonly string[])[]): string[] {
  const set = new Set<string>()
  for (const g of groups) for (const s of g) set.add(s)
  return SLOT_ORDER.filter((s) => set.has(s))
}

type Band = [number, number]

interface AffixRow {
  id: string
  name: string
  position: 'prefix' | 'suffix'
  slots: string[]
  weight: number
  tags: string[]
  /** Rolls per band F–D / C–A / S–God (08 §5; the fixture's reading 12). */
  bands: [Band, Band, Band]
  stat?: { stat: string; unit: 'flat' | 'percent' }
  /** An effect template; the roll lands in `chance` for status lines, else `percent` (sim/src/items.ts effectWithMagnitude). */
  effect?: Effect
}

const BANDS: readonly [AnyGrade, AnyGrade][] = [
  ['F', 'D'],
  ['C', 'A'],
  ['S', 'God'],
]

const ATTR_BANDS: [Band, Band, Band] = [[1, 2], [2, 4], [4, 7]]
const STATUS_BANDS: [Band, Band, Band] = [[5, 8], [8, 12], [12, 20]]

const ELEMENTS: readonly { element: string; prefix: string }[] = [
  { element: 'fire', prefix: 'Flaming' },
  { element: 'frost', prefix: 'Freezing' },
  { element: 'lightning', prefix: 'Charged' },
  { element: 'poison', prefix: 'Venomous' },
  { element: 'holy', prefix: 'Hallowed' },
  { element: 'shadow', prefix: 'Shadowed' },
]

const BANE_FAMILIES: readonly string[] = ['Vermin', 'Bandit', 'Undead', 'Cultist', 'Construct', 'Ooze', 'Fungal', 'Troll', 'Beast', 'Elemental', 'Golem', 'Dwarf', 'Giant', 'Wolf', 'Wight', 'Dragon']

/** A custom effect template for an affix: the rolled value is read from `line.percent` by the hook. */
function custom(customId: string, extra: Effect = {}): Effect {
  return { kind: 'custom', customId, ...extra }
}

const AFFIXES: readonly AffixRow[] = [
  // Attributes
  { id: 'of-the-bear', name: 'of the Bear', position: 'suffix', slots: slots(SG.any), weight: 4, tags: ['attribute', 'strength'], bands: ATTR_BANDS, stat: { stat: 'strength', unit: 'flat' } },
  { id: 'of-the-fox', name: 'of the Fox', position: 'suffix', slots: slots(SG.any), weight: 4, tags: ['attribute', 'agility'], bands: ATTR_BANDS, stat: { stat: 'agility', unit: 'flat' } },
  { id: 'of-the-ox', name: 'of the Ox', position: 'suffix', slots: slots(SG.any), weight: 4, tags: ['attribute', 'vitality'], bands: ATTR_BANDS, stat: { stat: 'vitality', unit: 'flat' } },
  { id: 'of-the-oak', name: 'of the Oak', position: 'suffix', slots: slots(SG.any), weight: 4, tags: ['attribute', 'endurance'], bands: ATTR_BANDS, stat: { stat: 'endurance', unit: 'flat' } },
  { id: 'of-the-owl', name: 'of the Owl', position: 'suffix', slots: slots(SG.any), weight: 4, tags: ['attribute', 'wisdom'], bands: ATTR_BANDS, stat: { stat: 'wisdom', unit: 'flat' } },
  { id: 'of-the-hawk', name: 'of the Hawk', position: 'suffix', slots: slots(SG.any), weight: 4, tags: ['attribute', 'perception'], bands: ATTR_BANDS, stat: { stat: 'perception', unit: 'flat' } },
  { id: 'of-the-stone', name: 'of the Stone', position: 'suffix', slots: slots(SG.any), weight: 4, tags: ['attribute', 'willpower'], bands: ATTR_BANDS, stat: { stat: 'willpower', unit: 'flat' } },
  { id: 'of-the-coin', name: 'of the Coin', position: 'suffix', slots: slots(['ring', 'talisman', 'relic', 'helmet']), weight: 2, tags: ['attribute', 'luck'], bands: [[1, 1], [1, 2], [2, 4]], stat: { stat: 'luck', unit: 'flat' } },
  // Derived stats
  { id: 'vigorous', name: 'Vigorous', position: 'prefix', slots: slots(SG.armor, ['ring', 'talisman']), weight: 5, tags: ['defensive', 'hp'], bands: [[3, 5], [5, 8], [8, 12]], stat: { stat: 'hp', unit: 'percent' } },
  { id: 'sharp', name: 'Sharp', position: 'prefix', slots: slots(SG.weapons), weight: 5, tags: ['offensive', 'attack'], bands: [[1, 3], [3, 8], [8, 20]], stat: { stat: 'attackPhys', unit: 'flat' } },
  { id: 'arcane', name: 'Arcane', position: 'prefix', slots: slots(SG.foci, SG.armor), weight: 5, tags: ['offensive', 'spell'], bands: [[1, 3], [3, 8], [8, 20]], stat: { stat: 'attackSpell', unit: 'flat' } }, // "foci, Robes": the family filter is a hook
  { id: 'fierce', name: 'Fierce', position: 'prefix', slots: slots(SG.weapons, SG.foci, ['ring']), weight: 3, tags: ['offensive', 'attack'], bands: [[3, 5], [5, 8], [8, 12]], stat: { stat: 'attackPhys', unit: 'percent' } }, // "+Attack % (phys or spell by item)": one stat per line; written on attackPhys and flagged
  { id: 'sturdy', name: 'Sturdy', position: 'prefix', slots: slots(SG.armor, SG.shields), weight: 5, tags: ['defensive', 'defense'], bands: [[1, 2], [2, 5], [5, 12]], stat: { stat: 'defense', unit: 'flat' } },
  { id: 'swift', name: 'Swift', position: 'prefix', slots: slots(['legs', 'boots', 'ring'], SG.weapons), weight: 3, tags: ['speed'], bands: [[1, 3], [3, 6], [6, 12]], stat: { stat: 'speed', unit: 'flat' } },
  { id: 'keen', name: 'Keen', position: 'prefix', slots: slots(SG.weapons, ['gloves', 'ring']), weight: 3, tags: ['offensive', 'crit'], bands: [[1, 2], [2, 4], [4, 7]], stat: { stat: 'critRate', unit: 'flat' } },
  { id: 'brutal', name: 'Brutal', position: 'prefix', slots: slots(SG.weapons, ['gloves']), weight: 3, tags: ['offensive', 'crit'], bands: [[5, 8], [8, 15], [15, 25]], stat: { stat: 'critDamage', unit: 'flat' } },
  { id: 'precise', name: 'Precise', position: 'prefix', slots: slots(SG.weapons, ['gloves', 'helmet']), weight: 4, tags: ['offensive', 'accuracy'], bands: [[1, 2], [2, 4], [4, 6]], stat: { stat: 'accuracy', unit: 'flat' } },
  { id: 'evasive', name: 'Evasive', position: 'prefix', slots: slots(['boots', 'ring'], SG.armor), weight: 3, tags: ['defensive', 'dodge'], bands: [[1, 2], [2, 4], [4, 6]], stat: { stat: 'dodge', unit: 'flat' } }, // "Boots, Leather, Robes, Ring"
  { id: 'warding', name: 'Warding', position: 'prefix', slots: slots(['helmet', 'talisman'], SG.armor, SG.shields), weight: 4, tags: ['defensive', 'resistance'], bands: [[2, 3], [3, 6], [6, 10]], stat: { stat: 'resistance', unit: 'flat' } }, // "Helmet, Talisman, Robes, shields"
  { id: 'seeking', name: 'Seeking', position: 'prefix', slots: slots(['helmet', 'talisman', 'boots', 'ring']), weight: 3, tags: ['utility', 'detection'], bands: [[1, 1], [1, 2], [2, 4]], stat: { stat: 'detection', unit: 'flat' } },
  { id: 'deep', name: 'Deep', position: 'prefix', slots: slots(['chest', 'ring', 'talisman'], SG.foci), weight: 4, tags: ['pool'], bands: [[3, 5], [5, 10], [10, 20]], effect: custom('max-pool-flat', { target: 'self', note: '+pool: the rolled value is flat points of the wearer\'s own pool (Stamina or Mana)' }) },
  { id: 'driven', name: 'Driven', position: 'prefix', slots: slots(['talisman', 'gloves'], SG.weapons), weight: 3, tags: ['momentum'], bands: [[3, 5], [5, 10], [10, 15]], stat: { stat: 'momentumGain', unit: 'percent' } },
  { id: 'of-renewal', name: 'of Renewal', position: 'suffix', slots: slots(['chest', 'ring', 'talisman']), weight: 2, tags: ['defensive', 'regen'], bands: [[1, 1], [2, 2], [3, 3]], effect: custom('hp-regen-percent', { target: 'self', note: '+HP regen per own turn, percent of max HP' }) },
  { id: 'of-grace', name: 'of Grace', position: 'suffix', slots: slots(['mainHand', 'ring'], SG.armor), weight: 3, tags: ['healing'], bands: [[3, 5], [5, 10], [10, 15]], effect: custom('healing-done-percent', { target: 'self', note: '+healing done; "Censers, Crook, Robes, Ring" read as their slots' }) },
  // Elemental damage prefixes (one element per item: the sim reads the `element` tag)
  ...ELEMENTS.map(
    (e): AffixRow => ({
      id: e.prefix.toLowerCase(),
      name: e.prefix,
      position: 'prefix',
      slots: slots(SG.weapons, SG.foci),
      weight: 3,
      tags: ['offensive', 'element', e.element],
      bands: [[5, 8], [8, 15], [15, 25]],
      effect: { kind: 'damage', multiplier: 1, damageType: e.element, note: `the rolled value is the percent of each hit dealt again as ${capitalise(e.element)}` },
    }),
  ),
  // Elemental resistance suffixes
  ...ELEMENTS.map(
    (e): AffixRow => ({
      id: `of-${e.element}-warding`,
      name: `of ${capitalise(e.element)} Warding`,
      position: 'suffix',
      slots: slots(SG.armor, ['talisman'], SG.shields),
      weight: 3,
      tags: ['defensive', 'resist', e.element],
      bands: [[10, 15], [15, 25], [25, 40]],
      effect: custom('element-resist-percent', { damageType: e.element, target: 'self', note: `+resistance to ${capitalise(e.element)}, percent` }),
    }),
  ),
  // Status-on-hit prefixes (the roll is the chance)
  { id: 'bleeding', name: 'Bleeding', position: 'prefix', slots: slots(SG.weapons), weight: 3, tags: ['offensive', 'status', 'bleed'], bands: STATUS_BANDS, effect: { kind: 'applyStatus', status: 'bleed', target: 'enemy', note: 'Slash and Pierce weapons' } },
  { id: 'venomed', name: 'Venomed', position: 'prefix', slots: slots(SG.weapons, SG.foci), weight: 3, tags: ['offensive', 'status', 'poison'], bands: STATUS_BANDS, effect: { kind: 'applyStatus', status: 'poison', target: 'enemy', note: 'Pierce weapons, Whips, foci' } },
  { id: 'searing', name: 'Searing', position: 'prefix', slots: slots(SG.weapons, SG.foci), weight: 3, tags: ['offensive', 'status', 'burn'], bands: STATUS_BANDS, effect: { kind: 'applyStatus', status: 'burn', target: 'enemy' } },
  { id: 'chilling', name: 'Chilling', position: 'prefix', slots: slots(SG.weapons, SG.foci), weight: 3, tags: ['offensive', 'status', 'chill'], bands: STATUS_BANDS, effect: { kind: 'applyStatus', status: 'chill', target: 'enemy' } },
  { id: 'shocking', name: 'Shocking', position: 'prefix', slots: slots(SG.weapons, SG.foci), weight: 3, tags: ['offensive', 'status', 'shock'], bands: STATUS_BANDS, effect: { kind: 'applyStatus', status: 'shock', target: 'enemy' } },
  { id: 'marking', name: 'Marking', position: 'prefix', slots: slots(SG.weapons), weight: 2, tags: ['offensive', 'status', 'mark'], bands: [[5, 5], [5, 10], [10, 15]], effect: { kind: 'applyStatus', status: 'mark', target: 'enemy', note: 'Bows, Crossbows, Daggers, Whips, Throwing' } },
  // Triggered suffixes (the DSL has no trigger field: the trigger is in the note and the sim hook)
  { id: 'of-riposte', name: 'of Riposte', position: 'suffix', slots: slots(SG.shields), weight: 2, tags: ['defensive', 'block'], bands: [[10, 15], [15, 25], [25, 40]], effect: custom('riposte-on-block', { target: 'enemy', note: 'on block: the rolled value is the chance to counter for 50% Attack' }) },
  { id: 'of-the-bulwark', name: 'of the Bulwark', position: 'suffix', slots: slots(SG.shields, ['chest']), weight: 2, tags: ['defensive', 'block'], bands: [[20, 20], [35, 35], [50, 50]], effect: { kind: 'applyStatus', status: 'fortify', duration: 1, target: 'self', note: 'on block only (shields, Plate Chest): the roll is the chance; the block trigger is a hook' } },
  { id: 'of-rending', name: 'of Rending', position: 'suffix', slots: slots(SG.weapons), weight: 2, tags: ['offensive', 'status', 'weaken'], bands: [[20, 20], [35, 35], [50, 50]], effect: { kind: 'applyStatus', status: 'weaken', duration: 2, target: 'enemy', note: 'on crit only: the roll is the chance; the crit gate is a hook' } },
  { id: 'of-shielding', name: 'of Shielding', position: 'suffix', slots: slots(SG.shields), weight: 3, tags: ['defensive', 'block'], bands: [[2, 3], [3, 5], [5, 8]], stat: { stat: 'block', unit: 'flat' } },
  { id: 'spined', name: 'Spined', position: 'prefix', slots: slots(['chest'], SG.shields), weight: 2, tags: ['defensive', 'reflect'], bands: [[5, 5], [10, 10], [15, 15]], effect: custom('reflect-melee-percent', { damageType: 'pierce', target: 'self', note: 'reflects the rolled percent of melee damage taken (the Thorned elite affix\'s hook)' }) },
  // Loot
  { id: 'of-greed', name: 'of Greed', position: 'suffix', slots: slots(['boots', 'ring', 'talisman', 'relic']), weight: 3, tags: ['loot', 'gold'], bands: [[3, 5], [5, 10], [10, 15]], effect: custom('gold-found-percent', { target: 'self', note: '+gold found, percent' }) },
  { id: 'of-plunder', name: 'of Plunder', position: 'suffix', slots: slots(['ring', 'talisman']), weight: 1, tags: ['loot', 'grade'], bands: [[1, 1], [1, 1], [2, 2]], effect: custom('drop-shape-pp', { target: 'self', note: 'drop shape toward higher grades, pp; 08 writes +0.5 at F–D, rounded half up to 1 (integer lines); stacks with Luck under its cap' }) },
  // Care and utility
  { id: 'enduring', name: 'Enduring', position: 'prefix', slots: slots(SG.weapons, SG.armor, SG.shields), weight: 3, tags: ['durability'], bands: [[10, 15], [15, 25], [25, 40]], effect: custom('wear-k-percent', { target: 'self', note: 'wear k +percent (slower wear) on this item' }) },
  { id: 'of-embers', name: 'of Embers', position: 'suffix', slots: slots(['helmet', 'talisman', 'relic']), weight: 2, tags: ['utility', 'light'], bands: [[1, 1], [2, 2], [3, 3]], effect: custom('light-decay-reduction', { target: 'room', note: 'light falls this many less per new room' }) },
  ...BANE_FAMILIES.map(
    (fam): AffixRow => ({
      id: `${fam.toLowerCase()}bane`,
      name: `${fam}bane`,
      position: 'prefix',
      slots: slots(SG.weapons, SG.foci),
      weight: 2,
      tags: ['offensive', 'bane', `family:${fam.toLowerCase()}`],
      bands: [[8, 10], [10, 15], [15, 25]],
      effect: custom('damage-vs-family-percent', { target: 'enemy', note: `+damage vs the ${fam} family, percent; the family is the affix's family: tag` }),
    }),
  ),
  { id: 'light', name: 'Light', position: 'prefix', slots: slots(SG.armor, SG.shields, ['mainHand']), weight: 3, tags: ['utility', 'carry'], bands: [[10, 15], [15, 25], [25, 40]], effect: custom('carry-weight-reduction-percent', { target: 'self', note: 'item carry weight −percent (armor, shields, two-handed weapons); carry weight per item is not yet a schema field' }) },
  { id: 'steadfast', name: 'Steadfast', position: 'prefix', slots: slots(['helmet', 'talisman']), weight: 2, tags: ['defensive', 'status'], bands: [[10, 10], [20, 20], [35, 35]], effect: custom('fear-stun-resist-percent', { target: 'self', note: '+Fear and Stun resistance, percent' }) },
  { id: 'of-the-pack', name: 'of the Pack', position: 'suffix', slots: slots(['talisman', 'mainHand', 'ring']), weight: 2, tags: ['pet'], bands: [[3, 5], [5, 8], [8, 12]], effect: custom('pet-stats-percent', { target: 'pet', note: '+pet stats, percent; "Whips" read as mainHand' }) },
  { id: 'of-the-mule', name: 'of the Mule', position: 'suffix', slots: slots(['chest', 'boots', 'talisman']), weight: 3, tags: ['utility', 'carry'], bands: [[5, 5], [10, 10], [20, 20]], stat: { stat: 'carry', unit: 'flat' } },
]

function genAffixes(): void {
  for (const a of AFFIXES) {
    if (a.effect?.kind === 'custom') hook(`custom ${String(a.effect.customId)}`, `affix ${a.name}`)
    const lines = a.bands.map(([min, max], i) => {
      const band = need(BANDS[i], 'band')
      return a.stat ? { bandMin: band[0], bandMax: band[1], stat: a.stat.stat, unit: a.stat.unit, min, max } : { bandMin: band[0], bandMax: band[1], effect: need(a.effect, `effect of ${a.id}`), min, max }
    })
    writeJson(`affixes/${a.id}.json`, { id: a.id, name: a.name, position: a.position, lines, slots: a.slots, weight: a.weight, tags: a.tags })
  }
}

// ---------------------------------------------------------------------------------------------------------------
// §6 Gravehollow's sets (08 §6): the Cellars' Grinning Company's Cut and, since Phase 7, the four of the Crypts and the
// Vault. Each piece is the family piece re-named and re-tinted with the setId (08 §6: "Set pieces drop as named family
// pieces"); pieces exist at every grade from the set's lowest up to S, because "A set keeps its membership through
// promotion" (items.ts nextRungItem prefers the next piece of the same set). The set's gradeMin–gradeMax is where the
// pieces drop. Bonuses are effect lines the sim applies (items.ts setBonusLoad, D-071): `buffStat` lines are stat lines,
// `custom` lines persistent hooks on the wearer (or delve-side lines such as gold found and light).
// ---------------------------------------------------------------------------------------------------------------

interface SetRow {
  id: string
  name: string
  /** The piece name prefix: "Barrow Warden's" → "Barrow Warden's Helm". */
  prefix: string
  family: ArmorFamily
  theme: string
  classes: string[]
  gradeMin: Grade
  gradeMax: Grade
  bonuses: { '2': Effect[]; '4': Effect[] }
  bonusText: { '2': string; '4': string }
  tint: string
  tint2: string
  trim: string
}

const SETS: readonly SetRow[] = [
  {
    id: 'grinning-companys-cut',
    name: "Grinning Company's Cut",
    prefix: "Grinning Company's",
    family: 'leather',
    theme: 'the Cellars bandits, Gravehollow F1–3',
    classes: [SHADE, RANGER],
    gradeMin: 'E',
    gradeMax: 'C',
    bonuses: {
      '2': [
        { kind: 'custom', customId: 'gold-found-percent', percent: 5, target: 'self', note: '+5% gold found (the of Greed hook, read by the delve)' },
        { kind: 'buffStat', stat: 'detection', amount: 1 },
      ],
      '4': [
        { kind: 'custom', customId: 'first-attack-each-fight-crits' },
        { kind: 'buffStat', stat: 'dodge', amount: 3 },
      ],
    },
    bonusText: { '2': '+5% gold found; +1 Detection', '4': 'Your first attack each fight is a guaranteed crit; +3% Dodge' },
    tint: '#9b1c1c',
    tint2: '#f1ece4',
    trim: 'brass',
  },
  {
    id: 'barrow-wardens-vigil',
    name: "Barrow Warden's Vigil",
    prefix: "Barrow Warden's",
    family: 'plate',
    theme: 'the Crypts, Gravehollow F4–6',
    classes: [WARDEN],
    gradeMin: 'D',
    gradeMax: 'B',
    bonuses: {
      '2': [
        { kind: 'buffStat', stat: 'defense', amount: 5 },
        { kind: 'custom', customId: 'status-resist-bonus', status: 'fear', percent: 10, target: 'self' },
        { kind: 'custom', customId: 'status-resist-bonus', status: 'curse', percent: 10, target: 'self' },
      ],
      '4': [{ kind: 'custom', customId: 'guard-taunts-and-fortifies', duration: 1, target: 'self', note: 'Guard also Taunts every enemy and grants Fortify 1 round' }],
    },
    bonusText: { '2': '+5 Defense; +10% Resistance to Fear and Curse', '4': 'Guard also Taunts every enemy and grants Fortify 1 round' },
    tint: '#4a5148',
    tint2: '#2f5e4a',
    trim: 'iron',
  },
  {
    id: 'tidebound-reavers-mail',
    name: "Tidebound Reaver's Mail",
    prefix: "Tidebound Reaver's",
    family: 'mail',
    theme: 'the Drowned Vault, Gravehollow F7–8',
    classes: [BLADE, TAMER],
    gradeMin: 'D',
    gradeMax: 'B',
    bonuses: {
      '2': [
        { kind: 'buffStat', stat: 'speed', amount: 2 },
        { kind: 'custom', customId: 'element-resist-percent', damageType: 'poison', percent: 10, target: 'self' },
      ],
      '4': [
        { kind: 'custom', customId: 'basic-attack-pool-restore-percent', percent: 10, target: 'self', note: 'basic attacks restore +10% Stamina' },
        { kind: 'custom', customId: 'haste-on-kill', status: 'haste', duration: 1, target: 'self', note: 'Haste 1 round on a kill' },
      ],
    },
    bonusText: { '2': '+2 Speed; +10% Poison resistance', '4': 'Basic attacks restore +10% Stamina; Haste 1 round on a kill' },
    tint: '#1e3a4a',
    tint2: '#9ec5e0',
    trim: 'steel',
  },
  {
    id: 'drowned-choirs-vestments',
    name: "Drowned Choir's Vestments",
    prefix: "Drowned Choir's",
    family: 'robes',
    theme: 'the Tidebound cult, the Drowned Vault',
    classes: [ARCANIST],
    gradeMin: 'D',
    gradeMax: 'B',
    bonuses: {
      '2': [
        { kind: 'buffStat', stat: 'mana', amount: 10 },
        { kind: 'custom', customId: 'element-damage-percent', damageType: 'frost', percent: 5, target: 'self' },
      ],
      '4': [{ kind: 'custom', customId: 'frost-freezes-chilled', status: 'freeze', target: 'self', note: 'a Chilled target hit by your Frost spell Freezes at once' }],
    },
    bonusText: { '2': '+10 Mana; +5% Frost damage', '4': 'A Chilled target hit by your Frost spell Freezes at once' },
    tint: '#16324a',
    tint2: '#dfe7ea',
    trim: 'steel',
  },
  {
    id: 'lanternkeepers-habit',
    name: "Lanternkeeper's Habit",
    prefix: "Lanternkeeper's",
    family: 'robes',
    theme: 'the Crypts',
    classes: [MENDER],
    gradeMin: 'D',
    gradeMax: 'B',
    bonuses: {
      '2': [
        { kind: 'custom', customId: 'healing-done-percent', percent: 10, target: 'self' },
        { kind: 'custom', customId: 'light-decay-reduction', amount: 1, target: 'room', note: 'light falls 1 less per room (read by the delve)' },
      ],
      '4': [
        { kind: 'custom', customId: 'holy-spells-grant-regen', status: 'regen', percent: 5, duration: 2, target: 'self', note: 'Holy spells grant Regen 2 rounds (5% of max HP, the Candle of the Crypt’s, a Phase 7 reading) to the lowest ally' },
        { kind: 'custom', customId: 'damage-percent-vs-status', status: 'smite', percent: 15, target: 'self', note: 'Smite +15%: your hits on a Smitten target +15%' },
      ],
    },
    bonusText: { '2': '+10% healing; light falls 1 less per room', '4': 'Holy spells grant Regen 2 rounds; Smite +15%' },
    tint: '#e8e0c8',
    tint2: '#c9a227',
    trim: 'brass',
  },
]

/** A set piece's id: the bare name at the set's lowest grade (the Phase 3 Grinning pieces keep theirs), `-<grade>` above it. */
function setPieceId(set: SetRow, type: string, grade: Grade): string {
  const base = `${kebab(set.prefix.replace(/['’]/g, ""))}-${type}`
  return grade === set.gradeMin ? base : `${base}-${grade.toLowerCase()}`
}

function genSets(): void {
  for (const set of SETS) {
    const fam = need(ARMOR.find((f) => f.family === set.family), `${set.family} family`)
    const classes = set.classes.filter((c) => SHIPPED_CLASSES.has(c))
    const pieceIds: string[] = []
    for (const p of fam.pieces) {
      for (const grade of GRADES) {
        if (GRADE_ROWS[grade].index < GRADE_ROWS[set.gradeMin].index) continue
        const id = setPieceId(set, p.type, grade)
        if (grade === set.gradeMin) pieceIds.push(id)
        // The family piece (08 §6), re-named and re-tinted, setId set; the set line spends its one affix slot (affixes stay empty, rule 20).
        writeItem(
          armorItem(fam, p, grade, {
            id,
            name: `${set.prefix} ${p.name}`,
            setId: set.id,
            // The family's class order, narrowed to the set's classes (rule 25 compares them as sets).
            classLock: fam.classes.filter((c) => classes.includes(c)),
            visual: { meshId: `armor-${fam.family}-${MESH_SLOT[p.slot]}-01`, tintPrimary: set.tint, tintSecondary: set.tint2, trimMetal: set.trim },
          }),
        )
      }
    }
    for (const n of ['2', '4'] as const) for (const e of set.bonuses[n]) if (e.kind === 'custom') hook(`custom ${String(e.customId)}`, `set ${set.id} (${n}-piece)`)
    writeJson(`sets/${set.id}.json`, {
      id: set.id,
      name: set.name,
      family: set.family,
      theme: set.theme,
      classIds: classes,
      pieces: pieceIds,
      bonuses: set.bonuses,
      bonusText: set.bonusText,
      gradeMin: set.gradeMin,
      gradeMax: set.gradeMax,
      dropChance: 15,
    })
  }
}

// ---------------------------------------------------------------------------------------------------------------
// §7 Named uniques Gravehollow can drop: the B pair the brief names (the Lamplighter's Hood, the Shieldbrother's Kite)
// and the A and S uniques whose 08 §7 source includes a Grand chest — the ones the Barrow Warden's, Sister Naesa's and
// the Hollow King's "one A/S-grade item" can roll (named uniques are 10% of any roll at a grade that has them, 08
// §10.1). The others are bound to a later dungeon's boss or monster and wait for it. A unique is its family piece at
// its grade (so the mesh's ladder holds, rule 22) with a fixed signature line in one affix slot (08 §7).
// ---------------------------------------------------------------------------------------------------------------

function genUniques(): void {
  const leather = need(ARMOR.find((f) => f.family === 'leather'), 'leather family')
  const hood = need(leather.pieces.find((p) => p.slot === 'helmet'), 'leather hood')
  writeItem(
    armorItem(leather, hood, 'B', {
      id: 'lamplighters-hood',
      name: "Lamplighter's Hood",
      unique: true,
      uniquePower: {
        text: '+3 Detection; light falls 1 less per room',
        effects: [
          { kind: 'buffStat', stat: 'detection', amount: 3 },
          { kind: 'custom', customId: 'light-decay-reduction', amount: 1, target: 'room' },
        ],
      },
      visual: { meshId: 'armor-leather-helm-01', tintPrimary: '#3b2a1e', tintSecondary: '#e8a33c', trimMetal: 'brass' },
    }),
  )
  writeItem(
    shieldItem(need(SHIELDS.find((x) => x.type === 'kite-shield'), 'kite'), 'B', {
      id: 'shieldbrothers-kite',
      name: "Shieldbrother's Kite",
      unique: true,
      uniquePower: { text: 'On block: a Shield of 5% of max HP on the lowest ally', effects: [{ kind: 'custom', customId: 'shield-lowest-ally-on-block', percent: 5, target: 'allyLowest' }] },
      visual: { meshId: 'shield-kite-shield-01', tintPrimary: '#2f4f7f', tintSecondary: '#e8e0c8', trimMetal: 'blacksteel' },
    }),
  )
  writeItem(
    shieldItem(need(SHIELDS.find((x) => x.type === 'buckler'), 'buckler'), 'S', {
      id: 'wyrmward-buckler',
      name: 'Wyrmward Buckler',
      unique: true,
      uniquePower: { text: 'Block also applies to spell and breath damage', effects: [{ kind: 'custom', customId: 'block-applies-to-spells', target: 'self' }] },
      visual: { meshId: 'shield-buckler-01', tintPrimary: '#5e7a4a', tintSecondary: '#c9d3e6', trimMetal: 'adamantine' },
    }),
  )
  const trinket = (o: { id: string; name: string; kind: 'ring' | 'talisman'; grade: Grade; power: UniquePowerRecord; tint: string; gem: string }) =>
    writeItem(
      item({
        id: o.id,
        name: o.name,
        slot: o.kind,
        kind: o.kind,
        grade: o.grade,
        wearK: 1, // trinkets do not wear in play (08 §3)
        value: value(o.grade, SLOT_FACTOR[o.kind]),
        unique: true,
        uniquePower: o.power,
        visual: { meshId: `${o.kind}-${o.id.replace(/^(ring|talisman)-(of-)?(the-)?/, '').replace(/-(ring|talisman)$/, '')}-01`, tintPrimary: o.tint, tintSecondary: o.gem, trimMetal: trimMetal(o.grade) },
      }),
    )
  trinket({
    id: 'cinderborn-talisman',
    name: 'Cinderborn Talisman',
    kind: 'talisman',
    grade: 'A',
    power: {
      text: '+10% Momentum gain; your Ultimate applies Burn',
      effects: [
        { kind: 'buffStat', stat: 'momentumGain', amount: 10 },
        { kind: 'custom', customId: 'ultimate-applies-status', status: 'burn', target: 'enemy' },
      ],
    },
    tint: '#3a2a20',
    gem: '#d9541e',
  })
  trinket({
    id: 'emberheart-ring',
    name: 'Emberheart Ring',
    kind: 'ring',
    grade: 'A',
    power: { text: '+10% Fire damage; +2 Vitality', effects: [{ kind: 'custom', customId: 'element-damage-percent', damageType: 'fire', percent: 10, target: 'self' }], attributes: { vitality: 2 } },
    tint: '#b45309',
    gem: '#dc2626',
  })
  trinket({
    id: 'ring-of-the-long-winter',
    name: 'Ring of the Long Winter',
    kind: 'ring',
    grade: 'S',
    power: { text: '+3 Luck; +10% gold found', effects: [{ kind: 'custom', customId: 'gold-found-percent', percent: 10, target: 'self' }], attributes: { luck: 3 } },
    tint: '#c9d3e6',
    gem: '#60a5fa',
  })
  for (const id of ['shield-lowest-ally-on-block', 'block-applies-to-spells', 'ultimate-applies-status', 'element-damage-percent']) hook(`custom ${id}`, 'a named unique')
}

// ---------------------------------------------------------------------------------------------------------------
// §11 Gravehollow's loot tables, one per floor band (08 §11 at 8 floors, D-104): the Cellars F1–3, the Crypts F4–6,
// the Drowned Vault F7 and the Hollow King's floor F8. The Cellars' record is Phase 3's but for its gold (Phase 8).
// ---------------------------------------------------------------------------------------------------------------

interface LootRow {
  id: string
  name: string
  floors: [number, number]
  levels: [number, number]
  gold: [number, number]
  itemChance: number
  /** 08 §11's grade shape: centre 56 · −1 25 · +1 14 · +2 4 · +3 1, a missing lower grade folded into the centre. */
  shape: { centreGrade: Grade; centre: number; minus1: number; plus1: number; plus2: number; plus3: number }
  consumable: { chance: number; itemIds: string[] }
  treasure: { largeLockedChance: number; trappedChance: number; trapId: string }
  bossFirstKill: string | null
}

const LOOT: readonly LootRow[] = [
  {
    id: 'gravehollow-cellars',
    name: 'Gravehollow Keep — the Cellars (F1–3)',
    floors: [1, 3],
    levels: [1, 4],
    // The Phase 8 balance pass (pass D): 08 §11's 10–20 cut by about a third — with a fight's gold no longer growing with
    // the party (loot.ts), every Cellars party found 1.3–1.6 R and F3 twice its 120 (docs/balance/2026-10-29-segment2.md).
    gold: [7, 14],
    itemChance: 35,
    shape: { centreGrade: 'F', centre: 81, minus1: 0, plus1: 14, plus2: 4, plus3: 1 },
    consumable: { chance: 40, itemIds: ['small-hp-potion', 'torch', 'arrows', 'bandage'] },
    // Phase 3's reading, kept: the Cellars' strongroom locks its Large chest half the time (the Small at half that).
    treasure: { largeLockedChance: 50, trappedChance: 20, trapId: 'spring-spikes' },
    bossFirstKill: 'captain-vexa-marrow',
  },
  {
    id: 'gravehollow-crypts',
    name: 'Gravehollow Keep — the Crypts (F4–6)',
    floors: [4, 6],
    levels: [5, 8],
    // The Phase 7 balance pass (pass F): 08 §11's 16–32, 25–50 and 40–60 cut by a third — fights paid 1.5–2× 08's band
    // from F3 on (a four meets ×1.6 the monsters; the Crypts' and the Vault's packs run 4–6 against a typical 3).
    gold: [11, 21],
    itemChance: 40,
    shape: { centreGrade: 'E', centre: 56, minus1: 25, plus1: 14, plus2: 4, plus3: 1 },
    consumable: { chance: 40, itemIds: ['small-hp-potion', 'cleansing-salt', 'repair-kit'] },
    // 08 §10.3: a Large chest locked 40% (the Small at half), trapped 15–25% (the table holds one number: 20); the
    // Crypts' trapped chest breathes grave dust (07 §2.7: "a Grave Breath puff").
    treasure: { largeLockedChance: 40, trappedChance: 20, trapId: 'grave-breath-vent' },
    bossFirstKill: 'barrow-warden',
  },
  {
    id: 'gravehollow-vault',
    name: 'Gravehollow Keep — the Drowned Vault (F7)',
    floors: [7, 7],
    levels: [11, 11],
    gold: [17, 33],
    itemChance: 45,
    shape: { centreGrade: 'D', centre: 56, minus1: 25, plus1: 14, plus2: 4, plus3: 1 },
    consumable: { chance: 45, itemIds: ['medium-hp-potion', 'fortify-draught', 'bolts'] },
    treasure: { largeLockedChance: 40, trappedChance: 20, trapId: 'hags-snare' },
    bossFirstKill: 'sister-naesa',
  },
  {
    id: 'gravehollow-throne',
    name: "Gravehollow Keep — the Hollow King's floor (F8)",
    floors: [8, 8],
    levels: [13, 13],
    gold: [27, 40],
    itemChance: 50,
    shape: { centreGrade: 'C', centre: 56, minus1: 25, plus1: 14, plus2: 4, plus3: 1 },
    consumable: { chance: 50, itemIds: ['medium-hp-potion', 'haste-tonic'] },
    // The throne floor is four fixed rooms with no strongroom (07 §2.3); the schema still wants a treasure block: the Vault's.
    treasure: { largeLockedChance: 40, trappedChance: 20, trapId: 'hags-snare' },
    bossFirstKill: 'hollow-king',
  },
]

function genLootTables(): void {
  for (const l of LOOT) {
    writeJson(`loot-tables/${l.id}.json`, {
      id: l.id,
      dungeonId: 'gravehollow-keep',
      name: l.name,
      floorBand: { min: l.floors[0], max: l.floors[1] },
      monsterLevels: { min: l.levels[0], max: l.levels[1] },
      goldRange: { min: l.gold[0], max: l.gold[1] },
      itemChance: l.itemChance,
      gradeShape: l.shape,
      partChance: { common: 35, rare: 4 },
      stoneChance: 8,
      consumableDrop: l.consumable,
      treasureRoom: {
        goldPiles: { min: 2, max: 4 },
        goldFightsWorth: 2,
        smallChestChance: 100,
        largeChestChance: 20,
        largeLockedChance: l.treasure.largeLockedChance,
        trappedChance: l.treasure.trappedChance,
        trapId: l.treasure.trapId,
        consumableBundle: 3,
        hiddenFind: { itemAtPlusOneChance: 90, skeletonKeyChance: 10 },
      },
      darknessItemBonus: { radiant: 0, dim: 10, shadowy: 25, dark: 50, pitch: 75 },
      bossFirstKill: l.bossFirstKill,
    })
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------------------------------------------

const OWNED_FOLDERS = ['items', 'affixes', 'sets', 'loot-tables']
/** Folders under the owned ones that another pass writes (Skill Tomes are pass A's, Phase 7): never listed as stale. */
const NOT_OURS = ['items/tome/']

function listJson(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listJson(p))
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(p)
  }
  return out
}

function main(): void {
  genWeapons()
  genFoci()
  genArmor()
  genShields()
  genTrinkets('ring', RINGS)
  genTrinkets('talisman', TALISMANS)
  genRelics()
  genConsumables()
  genAmmo()
  genMaterials()
  genStones()
  genKeys()
  genEggs()
  genAffixes()
  genSets()
  genUniques()
  genLootTables()

  const stale: string[] = []
  for (const folder of OWNED_FOLDERS) {
    for (const abs of listJson(path.join(CONTENT, folder))) {
      const rel = path.relative(CONTENT, abs).replace(/\\/g, '/')
      if (NOT_OURS.some((prefix) => rel.startsWith(prefix))) continue
      if (!written.has(rel)) stale.push(rel)
    }
  }

  const ids = new Map<string, string>()
  for (const [rel, data] of written) {
    const kind = rel.split('/')[0] ?? ''
    const key = `${kind}:${String(data.id)}`
    const dup = ids.get(key)
    if (dup) throw new Error(`gen-items: duplicate id ${key} in ${dup} and ${rel}`)
    ids.set(key, rel)
  }

  for (const [kind, n] of [...counts].sort(([a], [b]) => a.localeCompare(b))) console.log(`${String(n).padStart(4)}  ${kind}`)
  console.log(`${written.size} files written under content/`)
  if (deferred.length > 0) {
    console.log(`${deferred.length} item(s) deferred until their class ships (SHIPPED_CLASSES):`)
    for (const d of deferred) console.log(`  ${d}`)
  }
  if (stale.length > 0) {
    console.log(`${stale.length} stale file(s) not written by this run${PRUNE ? ' — deleted' : ' (pass --prune to delete)'}:`)
    for (const rel of stale) {
      console.log(`  ${rel}`)
      if (PRUNE) fs.unlinkSync(path.join(CONTENT, rel))
    }
  }
  if (SHOW_HOOKS) {
    console.log('\nSim hooks the content names (customIds need sim/src/skills/custom/<id>.ts; the rest are notes):')
    for (const [id, from] of [...hooks].sort(([a], [b]) => a.localeCompare(b))) console.log(`  ${id}  ←  ${[...from].join(', ')}`)
  }
}

main()
