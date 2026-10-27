import type { Content } from './content.ts'
import { createItemInstance, salvage, sameItemType } from './items.ts'
import { pickGearItem, type ItemFilter } from './loot.ts'
import type { Rng } from './rng.ts'
import { roundHalfUp } from './stats.ts'
import type { Tuning } from './tuning.ts'
import { drawWayfarer } from './wayfarers.ts'
import type { ChestDef, ChestOdds, IntRange, ItemDef, ItemInstance, LootTableDef } from './types/content.ts'
import { ARMOR_SLOTS, GRADES, gradeIndex, type ChestSubtype, type Grade, type MaterialLadder, type WeaponType } from './types/enums.ts'

/**
 * The Curio Merchant's chests (03-GAME-DESIGN §8.3; 08-ITEMS §10): band-relative odds with the Luck shift, the
 * God → SS fold and the Grand chest's Divine Shard line; the two-layer pity per chest family; sub-type targeting;
 * dupes to salvage; Pet Egg, Material Crate and the Skill Tome bag without replacement. Gold only, no timers.
 */

/** Prose constants of 08 §8.5 and §10.2 not yet in content/tuning.json. Tuning starting points. */
export const CHEST_RULES = {
  /** A Grand chest advances the pity counters by this much (08 §10.1). */
  grandPityAdvance: 3,
  /** Material Crate units: Standard 6, Grand 20 (08 §8.5). */
  crateUnits: { standard: 6, grand: 20 },
  /** Tome tier odds by position in the chest's `tomeTiers` range: Standard I 50 / II 35 / III 15 · Grand II 40 / III 40 / IV 20 (08 §10.2). */
  tomeTierWeights: { standard: [50, 35, 15], grand: [40, 40, 20] },
  /** The Divine Shard line replaces the Grand chest's top line from this band up (08 §10 "Shard rule"). */
  shardFromBand: 'D',
} as const

// ---------------------------------------------------------------------------------------------------------------
// State the save keeps
// ---------------------------------------------------------------------------------------------------------------

/** Per chest family (gear, pet egg): chests opened since the last ≥ +1 and ≥ +2 result. */
export interface ChestPityState {
  plusOneCounter: number
  plusTwoCounter: number
}

export const EMPTY_PITY: ChestPityState = { plusOneCounter: 0, plusTwoCounter: 0 }

/** The Tome bag per class: tier (as a string key) → the skill ids still in the bag. */
export type TomeBagState = Readonly<Record<string, readonly string[]>>

// ---------------------------------------------------------------------------------------------------------------
// Odds
// ---------------------------------------------------------------------------------------------------------------

export interface ChestOddsLine {
  grade: Grade | 'shard'
  /** Whole-or-fractional percent (hundredths exact). */
  percent: number
}

/** The band's row: an exact `centreGrade`, else the nearest lower row, else the lowest row. */
export function chestOddsRow(chest: ChestDef, bandGrade: Grade): ChestOdds {
  const band = gradeIndex(bandGrade)
  let best: ChestOdds | null = null
  let lowest: ChestOdds | null = null
  for (const row of chest.oddsByBand) {
    const c = gradeIndex(row.centreGrade)
    if (c === band) return row
    if (c < band && (best === null || c > gradeIndex(best.centreGrade))) best = row
    if (lowest === null || c < gradeIndex(lowest.centreGrade)) lowest = row
  }
  const row = best ?? lowest
  if (row === null) throw new Error(`chests: "${chest.id}" has no oddsByBand row`)
  return row
}

interface ChestWeights {
  /** Hundredths of a point per grade index (F = 0 … God = 8). */
  weights: number[]
  /** Hundredths of a point on the Divine Shard line. */
  shard: number
}

/**
 * The odds in hundredths: the row's lines moved to the band (a row written for another band keeps its offsets),
 * lines above SS folded into SS (God never rolls), Luck's +0.5 pp per point above 10 (cap 15) taken from the
 * row's lowest line (the Standard's centre, the Grand's +1) and spread over the lines above it in proportion, and
 * on a Grand from band D the chest's `divineShardChance` taken from the top line (08 §10: "C 45 · B 35 · A 15 ·
 * Divine Shard 5" at band D; "A 45 · S 35 · SS 15 · Shard 5" at band B).
 */
function chestWeights(t: Tuning, chest: ChestDef, bandGrade: Grade, luck: number): ChestWeights {
  const row = chestOddsRow(chest, bandGrade)
  const ssIndex = gradeIndex('SS')
  const shift = gradeIndex(bandGrade) - gradeIndex(row.centreGrade)
  const weights = new Array<number>(GRADES.length).fill(0)
  for (const grade of GRADES) {
    const pct = row.table[grade] ?? 0
    if (pct <= 0) continue
    const index = Math.max(0, Math.min(ssIndex, gradeIndex(grade) + shift))
    weights[index] = (weights[index] ?? 0) + Math.round(pct * 100)
  }
  const total = weights.reduce((a, b) => a + b, 0)
  if (total !== 10_000) throw new Error(`chests: "${chest.id}" band ${row.centreGrade} odds sum to ${total / 100}, not 100`)

  // Luck: from the lowest line with weight to the lines above it.
  const s = t.equipment.dropShape
  const shiftPp = Math.min(s.luckCapPp, Math.max(0, (luck - 10) * s.luckPpPerPoint))
  const lowest = weights.findIndex((w) => w > 0)
  if (shiftPp > 0 && lowest >= 0) {
    const upperTotal = weights.slice(lowest + 1).reduce((a, b) => a + b, 0)
    const lowestWeight = weights[lowest] ?? 0
    if (upperTotal > 0) {
      const move = Math.min(lowestWeight, roundHalfUp(shiftPp * 100))
      let given = 0
      let firstUpper = -1
      for (let i = lowest + 1; i < weights.length; i++) {
        const w = weights[i] ?? 0
        if (w === 0) continue
        if (firstUpper < 0) firstUpper = i
        const part = roundHalfUp((move * w) / upperTotal)
        weights[i] = w + part
        given += part
      }
      if (firstUpper >= 0) weights[firstUpper] = (weights[firstUpper] ?? 0) + (move - given)
      weights[lowest] = lowestWeight - move
    }
  }

  let shard = 0
  if (chest.tier === 'grand' && chest.divineShardChance > 0 && gradeIndex(bandGrade) >= gradeIndex(CHEST_RULES.shardFromBand)) {
    for (let i = weights.length - 1; i >= 0; i--) {
      const w = weights[i] ?? 0
      if (w === 0) continue
      shard = Math.min(w, Math.round(chest.divineShardChance * 100))
      weights[i] = w - shard
      break
    }
  }
  return { weights, shard }
}

/** The Odds button's table: grade lines ascending (zero lines omitted) and the Divine Shard line last when it exists. */
export function chestOddsTable(t: Tuning, chest: ChestDef, bandGrade: Grade, luck: number): ChestOddsLine[] {
  const { weights, shard } = chestWeights(t, chest, bandGrade, luck)
  const out: ChestOddsLine[] = []
  weights.forEach((w, i) => {
    if (w > 0) out.push({ grade: GRADES[i] as Grade, percent: w / 100 })
  })
  if (shard > 0) out.push({ grade: 'shard', percent: shard / 100 })
  return out
}

function rollChestLine(rng: Rng, w: ChestWeights): Grade | 'shard' {
  let roll = rng.int(10_000)
  for (let i = 0; i < w.weights.length; i++) {
    const weight = w.weights[i] ?? 0
    if (roll < weight) return GRADES[i] as Grade
    roll -= weight
  }
  if (roll < w.shard) return 'shard'
  const last = w.weights.findLastIndex((x) => x > 0)
  return GRADES[Math.max(0, last)] as Grade
}

// ---------------------------------------------------------------------------------------------------------------
// Pity (03 §8.3, 08 §10.1)
// ---------------------------------------------------------------------------------------------------------------

export interface PityOutcome {
  grade: Grade | 'shard'
  /** The grade was forced by a pity layer. */
  pityGrade: boolean
  pity: ChestPityState
}

function capAtSS(index: number): Grade {
  return GRADES[Math.max(0, Math.min(gradeIndex('SS'), index))] as Grade
}

/**
 * Two layers: a ≥ +1-grade result is forced on the `plusOneWithin`-th chest without one, a ≥ +2 on the
 * `plusTwoWithin`-th; a Grand advances both counters by 3; each counter resets when the result (natural or forced)
 * clears its bar. A Divine Shard counts as the top line and clears both.
 */
export function applyPity(chest: ChestDef, bandGrade: Grade, rolled: Grade | 'shard', pity: ChestPityState): PityOutcome {
  const advance = chest.tier === 'grand' ? CHEST_RULES.grandPityAdvance : 1
  const plusOne = pity.plusOneCounter + advance
  const plusTwo = pity.plusTwoCounter + advance
  const band = gradeIndex(bandGrade)
  let grade = rolled
  let offset = rolled === 'shard' ? 4 : gradeIndex(rolled) - band
  let pityGrade = false
  if (offset < 1 && plusOne >= chest.pity.plusOneWithin) {
    grade = capAtSS(band + 1)
    offset = 1
    pityGrade = true
  }
  if (offset < 2 && plusTwo >= chest.pity.plusTwoWithin) {
    grade = capAtSS(band + 2)
    offset = 2
    pityGrade = true
  }
  return { grade, pityGrade, pity: { plusOneCounter: offset >= 1 ? 0 : plusOne, plusTwoCounter: offset >= 2 ? 0 : plusTwo } }
}

// ---------------------------------------------------------------------------------------------------------------
// Opening a town chest
// ---------------------------------------------------------------------------------------------------------------

export type ChestResult =
  | { kind: 'item'; inst: ItemInstance; grade: Grade; pityGrade: boolean; dupe: boolean }
  | { kind: 'salvage'; itemId: string; grade: Grade; materialLadder: MaterialLadder | null; materialRung: number; units: number; pityGrade: boolean }
  | { kind: 'egg'; petId: string; grade: Grade; pityGrade: boolean }
  | { kind: 'bondStar'; petId: string; grade: Grade }
  | { kind: 'materials'; materialId: string; units: number; rarePart: ItemInstance | null; rarePartWon: boolean }
  | { kind: 'shard'; amount: number }
  | { kind: 'tome'; skillId: string; tier: number }
  | { kind: 'tomeOfPractice' }
  /** A Wayfarer Chest's writ (D-091); `heroId` is filled in by the town when the hero joins the roster. */
  | { kind: 'wayfarer'; wayfarerId: string; grade: Grade; pityGrade: boolean; heroId: string }
  /** A Wayfarer Chest when every wayfarer of the cast is already with the player (the town refuses the sale first). */
  | { kind: 'nobodyLeft' }

export interface TownChestInput {
  chest: ChestDef
  /** The player's chest band (economy.ts `chestBandGrade`): the deepest floor cleared, capped at A. */
  bandGrade: Grade
  luck: number
  /** This chest family's counters. */
  pity: ChestPityState
  /** The sub-type the player chose; a random one of the chest's `subtypes` when omitted. */
  subtype?: ChestSubtype
  /** For a Weapon chest: the class's weapon types (any weapon when omitted). */
  weaponTypesAllowed?: readonly WeaponType[]
  /** For an Armor chest's family and the class locks. */
  classId?: string
  /** Gear item ids in the armory (dupe check) or pet ids owned (bond star). */
  ownedItemIds?: ReadonlySet<string>
  /** The client offers Keep in the reveal: a dupe comes back as an item flagged `dupe` instead of salvage. */
  keepOffered?: boolean
  /** The class's Tome bag so far; built fresh when omitted. */
  tomeBag?: TomeBagState
  /** Skills the hero already knows (never drawn). */
  heroSkillIds?: ReadonlySet<string>
  /** Material Crate: the ladder of choice (metal when omitted). */
  materialLadder?: MaterialLadder
  /** Wayfarer Chest: the wayfarers already with the player (never drawn, D-091). */
  ownedWayfarerIds?: ReadonlySet<string>
}

export interface TownChestOutcome {
  result: ChestResult
  pity: ChestPityState
  /** The bag after the draw (Skill Tome chests), else null. */
  tomeBag: TomeBagState | null
  /** The odds the player was shown (gear and egg chests), else empty. */
  odds: ChestOddsLine[]
}

const WEAPON_KINDS: ReadonlySet<string> = new Set(['weapon', 'focus', 'shield'])
const TRINKET_KINDS: ReadonlySet<string> = new Set(['ring', 'talisman', 'relic'])

/** The filters a sub-type means, strictest first (an Armor chest: the rolled slot in the class's family, then any slot of the family, then any armor). */
function subtypeFilters(content: Content, rng: Rng, subtype: ChestSubtype, input: TownChestInput): ItemFilter[] {
  switch (subtype) {
    case 'weapon': {
      const allowed = input.weaponTypesAllowed
      const typed: ItemFilter = (d) => WEAPON_KINDS.has(d.kind) && (allowed === undefined || (d.weaponType !== null && allowed.includes(d.weaponType)))
      return [typed, (d) => WEAPON_KINDS.has(d.kind)]
    }
    case 'armor': {
      const slot = rng.pick(ARMOR_SLOTS)
      const family = input.classId === undefined ? null : (content.classes.get(input.classId)?.armorFamily ?? null)
      const strict: ItemFilter = (d) => d.kind === 'armor' && d.slot === slot && (family === null || d.armorFamily === family)
      return [strict, (d) => d.kind === 'armor' && (family === null || d.armorFamily === family), (d) => d.kind === 'armor']
    }
    case 'trinket':
      return [(d) => TRINKET_KINDS.has(d.kind)]
  }
}

/** A dupe: the armory already holds the same thing at the same or a higher grade (08 §10.1). */
export function isDupe(content: Content, owned: ReadonlySet<string> | undefined, def: ItemDef): boolean {
  if (owned === undefined) return false
  for (const id of [...owned].sort()) {
    const have = content.items.get(id)
    if (have !== undefined && sameItemType(have, def) && gradeIndex(have.grade) >= gradeIndex(def.grade)) return true
  }
  return false
}

function openGear(content: Content, t: Tuning, rng: Rng, input: TownChestInput, weights: ChestWeights): { result: ChestResult; pity: ChestPityState } {
  const chest = input.chest
  const outcome = applyPity(chest, input.bandGrade, rollChestLine(rng, weights), input.pity)
  if (outcome.grade === 'shard') return { result: { kind: 'shard', amount: 1 }, pity: outcome.pity }
  const subtype = input.subtype ?? (chest.subtypes.length > 0 ? rng.pick(chest.subtypes) : undefined)
  const filters = subtype === undefined ? [] : subtypeFilters(content, rng, subtype, input)
  const def = pickGearItem(content, rng, outcome.grade, filters, input.classId)
  if (def === null) throw new Error(`chests: no gear item at or below grade ${outcome.grade} for "${chest.id}"`)
  const inst = createItemInstance(content, rng, def.id, { rollAffixes: true })
  const dupe = isDupe(content, input.ownedItemIds, def)
  if (dupe && chest.dupeRule === 'salvage' && !input.keepOffered) {
    const s = salvage(t, def, inst)
    return {
      result: { kind: 'salvage', itemId: def.id, grade: def.grade, materialLadder: s.materialLadder, materialRung: s.materialRung, units: s.units, pityGrade: outcome.pityGrade },
      pity: outcome.pity,
    }
  }
  return { result: { kind: 'item', inst, grade: def.grade, pityGrade: outcome.pityGrade, dupe }, pity: outcome.pity }
}

function coversGrade(range: { readonly min: Grade; readonly max: Grade }, grade: Grade): boolean {
  const g = gradeIndex(grade)
  return gradeIndex(range.min) <= g && g <= gradeIndex(range.max)
}

/** One egg of the band's species pool: pets whose `eggSource.chestBand` is at or below the band, preferring those whose `gradeBand` covers the rolled grade. */
function openEgg(content: Content, rng: Rng, input: TownChestInput, weights: ChestWeights): { result: ChestResult; pity: ChestPityState } {
  const outcome = applyPity(input.chest, input.bandGrade, rollChestLine(rng, weights), input.pity)
  if (outcome.grade === 'shard') return { result: { kind: 'shard', amount: 1 }, pity: outcome.pity }
  const grade = outcome.grade
  const band = gradeIndex(input.bandGrade)
  const fromChests = [...content.pets.values()].filter((p) => p.eggSource.chestBand !== null)
  const inBand = fromChests.filter((p) => gradeIndex(p.eggSource.chestBand as Grade) <= band)
  let pool = inBand.filter((p) => coversGrade(p.gradeBand, grade))
  if (pool.length === 0) pool = inBand
  if (pool.length === 0) pool = fromChests
  if (pool.length === 0) throw new Error('chests: no pet species comes from a chest')
  const pet = rng.pick(pool)
  if (input.ownedItemIds?.has(pet.id)) return { result: { kind: 'bondStar', petId: pet.id, grade }, pity: outcome.pity }
  return { result: { kind: 'egg', petId: pet.id, grade, pityGrade: outcome.pityGrade }, pity: outcome.pity }
}

function overlaps(a: IntRange, b: IntRange): boolean {
  return a.min <= b.max && b.min <= a.max
}

/** The rare parts a band can give: the rare `itemId`s of monsters whose level band meets a loot table centred on the band; every monster's when none match. */
export function rarePartPool(content: Content, bandGrade: Grade): string[] {
  const tables: LootTableDef[] = [...content.lootTables.values()].filter((tb) => tb.gradeShape.centreGrade === bandGrade)
  const ids = new Set<string>()
  const all = new Set<string>()
  for (const m of content.monsters.values()) {
    const id = m.parts.rare.itemId
    if (id === undefined || !content.items.has(id)) continue
    all.add(id)
    if (tables.some((tb) => tb.dungeonId === m.dungeonId && overlaps(m.levelBand, tb.monsterLevels))) ids.add(id)
  }
  return [...(ids.size > 0 ? ids : all)].sort()
}

/** 6 / 20 units of the band rung in the ladder of choice; a rare part 10% (Standard) or guaranteed (Grand). No pity. */
function openCrate(content: Content, t: Tuning, rng: Rng, input: TownChestInput): ChestResult {
  const ladder = input.materialLadder ?? 'metal'
  const rung = gradeIndex(input.bandGrade)
  const material = (content.itemsByKind.get('material') ?? []).find((m) => m.materialLadder === ladder && m.materialRung === rung)
  if (material === undefined) throw new Error(`chests: no ${ladder} material item at rung ${rung} (band ${input.bandGrade})`)
  const grand = input.chest.tier === 'grand'
  const units = grand ? CHEST_RULES.crateUnits.grand : CHEST_RULES.crateUnits.standard
  const rarePartWon = grand || rng.pct(t.economy.chests.materialCrateRarePartChance)
  let rarePart: ItemInstance | null = null
  if (rarePartWon) {
    const pool = rarePartPool(content, input.bandGrade)
    if (pool.length > 0) rarePart = createItemInstance(content, rng, rng.pick(pool))
  }
  return { kind: 'materials', materialId: material.id, units, rarePart, rarePartWon }
}

/** A fresh bag per tier: every skill of the class at that tier the hero does not own, in id order. */
export function buildTomeBag(content: Content, classId: string, tiers: IntRange, heroSkillIds: ReadonlySet<string> | undefined): TomeBagState {
  const bag: Record<string, string[]> = {}
  const skills = content.skillsByClass.get(classId) ?? []
  for (let tier = tiers.min; tier <= tiers.max; tier++) {
    bag[String(tier)] = skills.filter((s) => s.tier === tier && !(heroSkillIds?.has(s.id) ?? false)).map((s) => s.id)
  }
  return bag
}

/**
 * The Tome bag (08 §10.2): pick a tier by the chest's weights, an empty bag passing its weight up (the top of the
 * range hands any leftover to the highest tier that still holds something), draw one skill without replacement.
 * Tiers the given bag does not list start fresh; skills the hero has since learned leave the bag.
 */
function openTome(content: Content, t: Tuning, rng: Rng, input: TownChestInput): { result: ChestResult; tomeBag: TomeBagState } {
  const chest = input.chest
  const tiers: IntRange = chest.tomeTiers ?? t.economy.chests.tomeTiers[chest.tier]
  const classId = input.classId
  if (classId === undefined) throw new Error(`chests: a Skill Tome chest needs the hero's classId`)
  const fresh = buildTomeBag(content, classId, tiers, input.heroSkillIds)
  const bag: Record<string, string[]> = {}
  for (let tier = tiers.min; tier <= tiers.max; tier++) {
    const key = String(tier)
    const given = input.tomeBag?.[key]
    const freshIds = fresh[key] ?? []
    bag[key] = given === undefined ? [...freshIds] : given.filter((id) => freshIds.includes(id))
  }
  const weightsByTier = CHEST_RULES.tomeTierWeights[chest.tier]
  const order: string[] = []
  for (let tier = tiers.min; tier <= tiers.max; tier++) order.push(String(tier))
  const effective = new Map<string, number>()
  let carry = 0
  for (let i = 0; i < order.length; i++) {
    const key = order[i] as string
    const w = (weightsByTier[i] ?? 0) + carry
    if ((bag[key]?.length ?? 0) === 0) {
      carry = w
      effective.set(key, 0)
    } else {
      carry = 0
      effective.set(key, w)
    }
  }
  if (carry > 0) {
    const top = [...order].reverse().find((key) => (bag[key]?.length ?? 0) > 0)
    if (top !== undefined) effective.set(top, (effective.get(top) ?? 0) + carry)
  }
  const drawable = order.filter((key) => (effective.get(key) ?? 0) > 0)
  if (drawable.length === 0) return { result: { kind: 'tomeOfPractice' }, tomeBag: bag }
  const key = rng.weighted(drawable, (k) => effective.get(k) ?? 0)
  const ids = bag[key] ?? []
  const skillId = rng.pick(ids)
  bag[key] = ids.filter((id) => id !== skillId)
  return { result: { kind: 'tome', skillId, tier: Number(key) }, tomeBag: bag }
}

/** Opens one town chest. Deterministic from the stream; the save keeps the returned pity and bag. */
export function openTownChest(content: Content, t: Tuning, rng: Rng, input: TownChestInput): TownChestOutcome {
  const chest = input.chest
  switch (chest.kind) {
    case 'gear': {
      const weights = chestWeights(t, chest, input.bandGrade, input.luck)
      const { result, pity } = openGear(content, t, rng, input, weights)
      return { result, pity, tomeBag: null, odds: chestOddsTable(t, chest, input.bandGrade, input.luck) }
    }
    case 'petEgg': {
      const weights = chestWeights(t, chest, input.bandGrade, input.luck)
      const { result, pity } = openEgg(content, rng, input, weights)
      return { result, pity, tomeBag: null, odds: chestOddsTable(t, chest, input.bandGrade, input.luck) }
    }
    case 'materialCrate':
      return { result: openCrate(content, t, rng, input), pity: input.pity, tomeBag: null, odds: [] }
    case 'skillTome': {
      const { result, tomeBag } = openTome(content, t, rng, input)
      return { result, pity: input.pity, tomeBag, odds: [] }
    }
    case 'wayfarer': {
      const draw = drawWayfarer(content, rng, chest, input.bandGrade, input.pity, input.ownedWayfarerIds ?? new Set())
      if (!draw) return { result: { kind: 'nobodyLeft' }, pity: input.pity, tomeBag: null, odds: [] }
      return { result: { kind: 'wayfarer', wayfarerId: draw.wayfarerId, grade: draw.grade, pityGrade: draw.pityGrade, heroId: '' }, pity: draw.pity, tomeBag: null, odds: [] }
    }
  }
}
