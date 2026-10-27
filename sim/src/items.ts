import type { Content } from './content.ts'
import {
  applyWear,
  durabilityBand,
  fromPercent,
  itemValue,
  plusNCost,
  plusNStatPercent,
  pointsToFull,
  repair,
  repairCost,
  salvageUnits,
  toPercent,
  wearPerEvent,
  type DurabilityBand,
  type Wearable,
} from './durability.ts'
import type { Rng } from './rng.ts'
import { roundHalfUp } from './stats.ts'
import type { Tuning } from './tuning.ts'
import type { AffixDef, AffixLine, Effect, ItemAffinity, ItemDef, ItemInstance, RolledAffix } from './types/content.ts'
import { ARMOR_SLOTS, ATTRIBUTES, DERIVED_STATS, GRADES, gradeIndex, isMember, type ArmorSlot, type Attribute, type DerivedStat, type Grade, type MaterialLadder } from './types/enums.ts'
import { advanceTrack, itemLevelCost } from './xp.ts'

/**
 * Items as instances (03-GAME-DESIGN §5.2, §6.2, §6.4, §6.5; 08-ITEMS §4, §5, §8–§9): a hero's copy of a content
 * item, its affix roll, the lines it contributes through +N and the durability band, wear, care, promotion,
 * salvage, +N and item XP. Every function returns a NEW instance and never mutates its inputs; the arithmetic
 * lives in durability.ts, grades.ts and xp.ts and is reused, not repeated.
 *
 * Durability on an instance is a whole percent (the save's shape, item.schema.json#/$defs/itemInstance); wear is
 * computed in basis points, so the sub-percent remainder of each event is handed back as `carryBp` for the delve
 * state to keep per instance and pass into the next event. Dropping the carry at save time forgives < 1% per item.
 */

// ---------------------------------------------------------------------------------------------------------------
// Instances
// ---------------------------------------------------------------------------------------------------------------

/** A deterministic instance id from the stream: `<prefix>-<8 hex>`. */
export function newInstanceId(rng: Rng, prefix = 'it'): string {
  return `${prefix}-${rng.next().toString(16).padStart(8, '0')}`
}

export function requireItem(content: Content, itemId: string): ItemDef {
  const def = content.items.get(itemId)
  if (def === undefined) throw new Error(`items: unknown item "${itemId}"`)
  return def
}

export interface CreateItemOptions {
  /** Roll `affixSlots` lines from the pool instead of copying the file's pre-rolled lines. */
  rollAffixes?: boolean
  instanceId?: string
  quantity?: number
}

/** A hero's copy of a content item, starting from the file's instance-shaped fields (durability in percent). */
export function createItemInstance(content: Content, rng: Rng, itemId: string, options: CreateItemOptions = {}): ItemInstance {
  const def = requireItem(content, itemId)
  const instanceId = options.instanceId ?? newInstanceId(rng)
  const affixes = options.rollAffixes ? rollAffixes(content, rng, def) : def.affixes.map((a) => ({ ...a }))
  return {
    instanceId,
    itemId: def.id,
    quantity: Math.max(1, options.quantity ?? 1),
    affixes,
    plusN: def.plusN,
    itemLevel: def.itemLevel,
    itemXp: def.itemXp,
    affinities: def.affinities.map((a) => ({ ...a })),
    durability: def.durability,
    maxDurability: def.maxDurability,
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Affixes (08 §5)
// ---------------------------------------------------------------------------------------------------------------

/** Affixes carrying this tag are the elemental prefixes: one per item (08 §5 "an elemental prefix excludes a second element"). */
export const ELEMENT_AFFIX_TAG = 'element'

/** The band line of an affix that covers a grade, or undefined when the affix does not roll at that grade. */
export function affixLineForGrade(affix: AffixDef, grade: Grade): AffixLine | undefined {
  const g = gradeIndex(grade)
  return affix.lines.find((line) => gradeIndex(line.bandMin) <= g && g <= gradeIndex(line.bandMax))
}

/** The pool an item draws from: affixes listing its slot with a line at its grade, in sorted-id order. */
export function affixPoolFor(content: Content, def: ItemDef): AffixDef[] {
  const slot = def.slot
  if (slot === null) return []
  const pool: AffixDef[] = []
  for (const affix of content.affixes.values()) {
    if (affix.slots.includes(slot) && affixLineForGrade(affix, def.grade) !== undefined) pool.push(affix)
  }
  return pool
}

/**
 * Rolls the item's affix lines: `affixSlots` (one fewer for a set piece, README rule 20) weighted picks with no
 * repeats, the prefix/suffix split of 08 §5 (1 → either · 2 → 1 + 1 · 3 → 2 + 1 either way · 4 → 2 + 2, read as
 * "at most ceil(n / 2) per position", relaxed only when the pool cannot fill it), one elemental prefix at most, and
 * each value uniform within the grade band's line.
 */
export function rollAffixes(content: Content, rng: Rng, def: ItemDef): RolledAffix[] {
  const slots = Math.max(0, def.affixSlots - (def.setId !== null ? 1 : 0))
  const pool = affixPoolFor(content, def)
  if (slots === 0 || pool.length === 0) return []
  const positionCap = Math.ceil(slots / 2)
  const counts = { prefix: 0, suffix: 0 }
  const taken = new Set<string>()
  let elementTaken = false
  const out: RolledAffix[] = []
  for (let i = 0; i < slots; i++) {
    const open = pool.filter((a) => !taken.has(a.id) && !(elementTaken && a.tags.includes(ELEMENT_AFFIX_TAG)))
    let candidates = open.filter((a) => counts[a.position] < positionCap)
    if (candidates.length === 0) candidates = open
    if (candidates.length === 0) break
    const affix = rng.weighted(candidates, (a) => a.weight)
    const line = affixLineForGrade(affix, def.grade)
    if (line === undefined) break
    out.push({ affixId: affix.id, value: rng.range(line.min, line.max), locked: false })
    taken.add(affix.id)
    counts[affix.position]++
    if (affix.tags.includes(ELEMENT_AFFIX_TAG)) elementTaken = true
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Effective lines (03 §6.2 +N, §6.4 bands)
// ---------------------------------------------------------------------------------------------------------------

export interface EffectiveItemStats {
  /** Flat derived-stat lines: base × +N × band, plus flat affix lines × band. */
  stats: Partial<Record<DerivedStat, number>>
  /** Percent affix lines (`unit: 'percent'`) × band, for the stats module's percent pass. */
  percentStats: Partial<Record<DerivedStat, number>>
  /** Attribute affix lines ("of the Bear") × band. */
  attributeBonuses: Partial<Record<Attribute, number>>
  /** The worn-band Accuracy loss, weapons and foci only (0 otherwise). */
  accuracyPenalty: number
  band: DurabilityBand
  /** The band's multiplier on every line, 0 when broken. */
  statPercent: number
  /** Affix effect lines with their rolled magnitude, then the unique power's lines. */
  onHit: Effect[]
}

const ATTACKING_KINDS: ReadonlySet<string> = new Set(['weapon', 'focus'])

function scaleLine(value: number, percent: number): number {
  return roundHalfUp((value * percent) / 100)
}

/**
 * The rolled magnitude fills the effect line's open field: `chance` for status lines (applyStatus, removeStatus,
 * dispel, taunt), else `percent` when the template leaves it unset, else `amount` (08 §5: "Bleed on hit 5–8%",
 * "+5–8% of each hit as Fire", "+Carry 5 / 10 / 20 kg").
 */
export function effectWithMagnitude(effect: Effect, value: number): Effect {
  const statusLike = effect.kind === 'applyStatus' || effect.kind === 'removeStatus' || effect.kind === 'dispel' || effect.kind === 'taunt'
  if (statusLike) return effect.chance === undefined ? { ...effect, chance: value } : effect
  if (effect.percent === undefined) return { ...effect, percent: value }
  if (effect.amount === undefined) return { ...effect, amount: value }
  return effect
}

/**
 * What the item contributes right now: baseStats × (100 + 5 × plusN)% × the durability band's statPercent (each
 * step rounded half up per line), every affix stat line × the band (08 §9.2: the falloff is "of the item's lines"),
 * affix effects and the unique power as on-hit lines. A Broken item (0%) contributes nothing at all.
 */
export function effectiveItemStats(content: Content, t: Tuning, def: ItemDef, inst: ItemInstance): EffectiveItemStats {
  const band = durabilityBand(t, fromPercent(inst.durability))
  const out: EffectiveItemStats = {
    stats: {},
    percentStats: {},
    attributeBonuses: {},
    accuracyPenalty: 0,
    band: band.band,
    statPercent: band.statPercent,
    onHit: [],
  }
  if (band.band === 'broken') return out
  const plusPct = plusNStatPercent(t, inst.plusN)
  for (const stat of DERIVED_STATS) {
    const base = def.baseStats[stat]
    if (base === undefined || base === 0) continue
    out.stats[stat] = scaleLine(scaleLine(base, plusPct), band.statPercent)
  }
  for (const rolled of inst.affixes) {
    const affix = content.affixes.get(rolled.affixId)
    if (affix === undefined) continue
    const line = affixLineForGrade(affix, def.grade) ?? affix.lines[0]
    if (line === undefined) continue
    if (line.stat !== undefined) {
      const value = scaleLine(rolled.value, band.statPercent)
      if (isMember(ATTRIBUTES, line.stat)) {
        out.attributeBonuses[line.stat] = (out.attributeBonuses[line.stat] ?? 0) + value
      } else if (line.unit === 'percent') {
        out.percentStats[line.stat] = (out.percentStats[line.stat] ?? 0) + value
      } else {
        out.stats[line.stat] = (out.stats[line.stat] ?? 0) + value
      }
    } else if (line.effect !== undefined) {
      out.onHit.push(effectWithMagnitude(line.effect, rolled.value))
    }
  }
  if (def.uniquePower !== null) out.onHit.push(...def.uniquePower.effects)
  if (ATTACKING_KINDS.has(def.kind)) out.accuracyPenalty = band.accuracyPenalty
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Wear (03 §6.4, 08 §9.1)
// ---------------------------------------------------------------------------------------------------------------

function toWearable(inst: ItemInstance): Wearable {
  return { durabilityBp: fromPercent(inst.durability), maxDurability: inst.maxDurability }
}

function fromWearable(inst: ItemInstance, w: Wearable): ItemInstance {
  return { ...inst, durability: toPercent(w.durabilityBp), maxDurability: w.maxDurability }
}

export interface WearOptions {
  /** A weakness hit (03 §3.4): the event wears double. */
  doubleWear?: boolean
  /** The item is a bow whose `wearK` is the weapon row's: wear at half rate (k / bowWearRate). Content bows that already carry the bow row's k pass false. */
  bow?: boolean
  /** Meaningful events applied at once (a fight's tally); default 1. */
  events?: number
  /** Sub-percent basis points carried from the previous event on this instance; default 0. */
  carryBp?: number
}

export interface WearResult {
  inst: ItemInstance
  /** The basis points of wear this call produced before the whole-percent split. */
  wearBp: number
  /** Sub-percent remainder to pass back in as `carryBp` next time. */
  carryBp: number
  crossedToast: boolean
  neglect: boolean
  destroyed: boolean
}

/** Applies `bp` basis points (plus the carry) as whole percent through durability.ts's applyWear; the remainder is returned. */
export function applyWearBp(t: Tuning, inst: ItemInstance, bp: number, carryBp = 0): WearResult {
  const total = Math.max(0, bp) + Math.max(0, carryBp)
  const whole = Math.floor(total / 100) * 100
  const w = toWearable(inst)
  const events = applyWear(t, w, whole)
  return { inst: fromWearable(inst, w), wearBp: bp, carryBp: total - whole, ...events }
}

function wearEvents(t: Tuning, inst: ItemInstance, k: number, opts: WearOptions): WearResult {
  const events = Math.max(0, opts.events ?? 1)
  const bp = wearPerEvent(k, opts.doubleWear ?? false) * events
  return applyWearBp(t, inst, bp, opts.carryBp ?? 0)
}

/** A weapon or focus wears per meaningful hit landed: 100 / k basis points; bows at half rate; weakness hits double. */
export function wearWeapon(t: Tuning, def: ItemDef, inst: ItemInstance, opts: WearOptions = {}): WearResult {
  const k = opts.bow ? def.wearK / t.equipment.durability.bowWearRate : def.wearK
  return wearEvents(t, inst, k, opts)
}

/** An armor piece wears per hit taken on it (the piece is chosen by `pickArmorPieceHit`). */
export function wearArmorPiece(t: Tuning, def: ItemDef, inst: ItemInstance, opts: WearOptions = {}): WearResult {
  return wearEvents(t, inst, def.wearK, opts)
}

/** A shield wears per block. */
export function wearShield(t: Tuning, def: ItemDef, inst: ItemInstance, opts: WearOptions = {}): WearResult {
  return wearEvents(t, inst, def.wearK, opts)
}

/** Which armor piece a hit lands on: Chest 3 · Helmet 2 · Legs 2 · Boots 1 · Gloves 1 (03 §6.4). */
export function pickArmorPieceHit(rng: Rng, t: Tuning): ArmorSlot {
  const weights = t.equipment.durability.armorHitWeights
  return rng.weighted(ARMOR_SLOTS, (slot) => weights[slot])
}

// ---------------------------------------------------------------------------------------------------------------
// Care: repair, +N, promotion, salvage (03 §6.4–§6.5, 08 §4, §8.2, §8.4, §9.3)
// ---------------------------------------------------------------------------------------------------------------

export interface RepairResult {
  inst: ItemInstance
  /** Points actually restored (never above maxDurability). */
  restored: number
}

/** Repair by points of percent; never raises maxDurability and never passes it. */
export function repairItemPoints(inst: ItemInstance, points: number): RepairResult {
  const w = toWearable(inst)
  const restored = repair(w, Math.max(0, points))
  return { inst: fromWearable(inst, w), restored }
}

/** A Repair Kit: +25 points to one item, out of combat. */
export function repairKit(t: Tuning, inst: ItemInstance): RepairResult {
  return repairItemPoints(inst, t.equipment.durability.repair.kitPercent)
}

/** Field Repair at a rest room: +10 points to one item for one material unit. */
export function fieldRepair(t: Tuning, inst: ItemInstance): RepairResult {
  return repairItemPoints(inst, t.equipment.durability.repair.fieldRepairPercent)
}

type SlotFactorKey = keyof Tuning['equipment']['valuation']['slotFactor']

/** The slot factor an item's value uses (08 top): two-handers 1.5, shields 0.8, off-hand 0.6, the armor slots and trinkets by slot. */
export function slotFactorKeyFor(def: ItemDef): SlotFactorKey {
  if (def.kind === 'shield') return 'shield'
  switch (def.slot) {
    case 'mainHand':
      return def.hands === 2 ? 'twoHanded' : 'mainHand'
    case 'offHand':
      return 'offHand'
    case 'helmet':
    case 'chest':
    case 'legs':
    case 'boots':
    case 'gloves':
    case 'ring':
    case 'talisman':
    case 'relic':
      return def.slot
    default:
      return 'mainHand'
  }
}

/** The item's value: the file's number, or 08's gradeValue × slotFactor when the file leaves it at 0. */
export function itemValueOf(t: Tuning, def: ItemDef): number {
  return def.value > 0 ? def.value : itemValue(t, def.grade, slotFactorKeyFor(def))
}

/** The blacksmith's "Repair all" bill: 0.5% of each item's value per point to its own ceiling. */
export function repairAllCost(content: Content, t: Tuning, items: readonly ItemInstance[]): { gold: number; points: number } {
  let gold = 0
  let points = 0
  for (const inst of items) {
    const def = content.items.get(inst.itemId)
    if (def === undefined) continue
    const need = pointsToFull(toWearable(inst))
    if (need <= 0) continue
    points += need
    gold += repairCost(t, itemValueOf(t, def), need)
  }
  return { gold, points }
}

export type StoneFamily = keyof Tuning['equipment']['plusN']['stonesByGrade']

const STONE_FAMILIES: readonly StoneFamily[] = ['whetstone', 'honingOil', 'starGrit']

/** The +N stone a grade uses: Whetstone F–C · Honing Oil B–A · Star Grit S–God. */
export function stoneFamilyFor(t: Tuning, grade: Grade): StoneFamily {
  for (const family of STONE_FAMILIES) {
    const grades: readonly string[] = t.equipment.plusN.stonesByGrade[family]
    if (grades.includes(grade)) return family
  }
  return 'starGrit'
}

export interface PlusNUpgrade {
  inst: ItemInstance
  gold: number
  stones: number
  stoneFamily: StoneFamily
}

/** One +N step: gold = value × 2% × N, 1 stone to +6 then 2; null at the grade's maxPlusN. */
export function plusNUpgrade(t: Tuning, def: ItemDef, inst: ItemInstance): PlusNUpgrade | null {
  if (inst.plusN >= def.maxPlusN) return null
  const next = inst.plusN + 1
  const cost = plusNCost(t, itemValueOf(t, def), next)
  return { inst: { ...inst, plusN: next }, gold: cost.gold, stones: cost.stones, stoneFamily: stoneFamilyFor(t, def.grade) }
}

/** Stones spent to reach +N from +0 (for the promotion refund). */
export function stonesSpentTo(t: Tuning, plusN: number): number {
  let stones = 0
  for (let n = 1; n <= plusN; n++) stones += plusNCost(t, 0, n).stones
  return stones
}

/** True when two items are the same thing at different grades: the same mesh, or the same type in the same slot. */
export function sameItemType(a: ItemDef, b: ItemDef): boolean {
  if (a.visual.meshId === b.visual.meshId) return true
  if (a.kind !== b.kind || a.slot !== b.slot) return false
  switch (a.kind) {
    case 'weapon':
    case 'focus':
    case 'shield':
      return a.weaponType === b.weaponType && a.hands === b.hands
    case 'armor':
      return a.armorFamily === b.armorFamily
    default:
      return a.id === b.id
  }
}

/**
 * The next rung of an item: the item one grade up with the same `visual.meshId` (a set piece prefers the piece
 * that keeps its `setId`), or failing that the same kind + weapon type / armor family + slot. null at God or when
 * the content has no such item.
 */
export function nextRungItem(content: Content, def: ItemDef): ItemDef | null {
  const next = GRADES[gradeIndex(def.grade) + 1]
  if (next === undefined) return null
  let byMesh: ItemDef | null = null
  let byType: ItemDef | null = null
  for (const candidate of content.items.values()) {
    if (candidate.grade !== next || candidate.kind !== def.kind) continue
    if (candidate.visual.meshId === def.visual.meshId) {
      if (candidate.setId === def.setId) return candidate
      byMesh ??= candidate
    } else if (byType === null && sameItemType(candidate, def)) {
      byType = candidate
    }
  }
  return byMesh ?? byType
}

/** The material items of a ladder at a rung, in sorted-id order (regional variants share a rung). */
export function materialItemsAt(content: Content, ladder: MaterialLadder, rung: number): ItemDef[] {
  const out: ItemDef[] = []
  for (const def of content.itemsByKind.get('material') ?? []) {
    if (def.materialLadder === ladder && def.materialRung === rung) out.push(def)
  }
  return out
}

export interface PromotionQuote {
  ok: boolean
  reason: string | null
  targetItemId: string | null
  /** The target rung's material item ids (08 §8.2: promotion consumes the target rung's material). */
  materialIds: string[]
  units: number
  unitsOwned: number
  /** 25% of the target item's value. */
  gold: number
  /** Stones handed back for the +N that would reset (50% of those spent). */
  stoneRefund: number
}

/** Can this item be promoted with what the player holds? (`materialsOwned`: material item id → units.) */
export function canPromote(content: Content, t: Tuning, def: ItemDef, inst: ItemInstance, materialsOwned: ReadonlyMap<string, number>): PromotionQuote {
  const stoneRefund = Math.floor((stonesSpentTo(t, inst.plusN) * t.equipment.promotion.plusNStoneRefundPercent.value) / 100)
  const quote: PromotionQuote = { ok: false, reason: null, targetItemId: null, materialIds: [], units: 0, unitsOwned: 0, gold: 0, stoneRefund }
  const key = `${def.grade}-${GRADES[gradeIndex(def.grade) + 1] ?? ''}` as keyof Tuning['equipment']['promotion']['units']
  const units: number | undefined = t.equipment.promotion.units[key]
  if (def.grade === 'God' || units === undefined) return { ...quote, reason: 'at the top of the ladder' }
  if (def.materialLadder === null) return { ...quote, reason: 'no material ladder' }
  const target = nextRungItem(content, def)
  if (target === null) return { ...quote, reason: `no ${GRADES[gradeIndex(def.grade) + 1]}-grade item to promote into` }
  const materials = materialItemsAt(content, def.materialLadder, gradeIndex(def.grade) + 1)
  const materialIds = materials.map((m) => m.id)
  let unitsOwned = 0
  for (const id of materialIds) unitsOwned += materialsOwned.get(id) ?? 0
  const gold = roundHalfUp((itemValueOf(t, target) * t.equipment.promotion.goldPercentOfTargetValue) / 100)
  const ok = materialIds.length > 0 && unitsOwned >= units
  return {
    ok,
    reason: ok ? null : materialIds.length === 0 ? 'no material item at the target rung' : 'not enough material',
    targetItemId: target.id,
    materialIds,
    units,
    unitsOwned,
    gold,
    stoneRefund,
  }
}

export interface PromotionResult {
  inst: ItemInstance
  targetItemId: string
  /** The affix line whose number was re-rolled at the new band, if any. */
  rerolledAffixId: string | null
  /** Stones refunded for the +N that reset (50%, 03 §6.5 open question 3). */
  stoneRefund: { family: StoneFamily; stones: number }
}

/**
 * Promotes one grade (03 §6.5, 08 §8.2): the same instance on the next rung's item, item level, XP, affinities and
 * every affix line kept, one unlocked line's number re-rolled at the new band, +N reset to 0 with the stones refunded
 * at 50%. Deterministic: no failure roll. Throws when the content has no next-rung item. Materials and gold are the
 * caller's to deduct (see `canPromote`).
 */
export function promote(content: Content, rng: Rng, t: Tuning, def: ItemDef, inst: ItemInstance): PromotionResult {
  const target = nextRungItem(content, def)
  if (target === null) throw new Error(`items: "${def.id}" has no ${GRADES[gradeIndex(def.grade) + 1] ?? 'higher'}-grade item to promote into`)
  const rerollable = inst.affixes
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => {
      if (a.locked) return false
      const affix = content.affixes.get(a.affixId)
      return affix !== undefined && affixLineForGrade(affix, target.grade) !== undefined
    })
  let affixes = inst.affixes.map((a) => ({ ...a }))
  let rerolledAffixId: string | null = null
  if (rerollable.length > 0) {
    const pick = rng.pick(rerollable)
    const affix = content.affixes.get(pick.a.affixId)
    const line = affix === undefined ? undefined : affixLineForGrade(affix, target.grade)
    if (line !== undefined) {
      affixes = affixes.map((a, i) => (i === pick.i ? { ...a, value: rng.range(line.min, line.max) } : a))
      rerolledAffixId = pick.a.affixId
    }
  }
  const refundPct = t.equipment.promotion.plusNStoneRefundPercent.value
  const stones = Math.floor((stonesSpentTo(t, inst.plusN) * refundPct) / 100)
  return {
    inst: { ...inst, itemId: target.id, affixes, plusN: 0 },
    targetItemId: target.id,
    rerolledAffixId,
    stoneRefund: { family: stoneFamilyFor(t, def.grade), stones },
  }
}

export interface SalvageResult {
  materialLadder: MaterialLadder | null
  /** The item's own rung (its grade's index), where the units land. */
  materialRung: number
  units: number
  /** 60% of an Awakened item's total XP, for a successor of the same type (03 §5.2); 0 otherwise. */
  carriedXp: number
}

/** Total item XP ever earned at this level and progress (the incremental curve summed). */
export function totalItemXp(t: Tuning, inst: ItemInstance): number {
  let total = inst.itemXp
  for (let n = 2; n <= inst.itemLevel; n++) total += itemLevelCost(t, n)
  return total
}

/** Salvage (03 §6.5, 08 §8.4): 25% of the item's own promotion cost in its material; destroyed by neglect 50%. */
export function salvage(t: Tuning, def: ItemDef, inst: ItemInstance, destroyedByNeglect = false): SalvageResult {
  const awakened = inst.itemLevel >= t.xp.item.maxLevel
  return {
    materialLadder: def.materialLadder,
    materialRung: gradeIndex(def.grade),
    units: salvageUnits(t, def.grade, destroyedByNeglect),
    carriedXp: awakened ? roundHalfUp((totalItemXp(t, inst) * t.xp.item.awakenedSalvageXpPercent) / 100) : 0,
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Growth (03 §5.2, D-051)
// ---------------------------------------------------------------------------------------------------------------

export interface ItemXpResult {
  inst: ItemInstance
  levelsGained: number
  /** The affinity line granted or raised by this gain (its total after the grant), or null. */
  newAffinity: ItemAffinity | null
  /** True when this gain reached the top level. */
  awakened: boolean
}

/**
 * Item XP from gated hits landed or absorbed: levels 1–10 on the incremental D-051 curve; at levels 3 / 6 / 9 an
 * affinity line of +5% against `familyId`, read as the family of the hit that crossed the threshold (the instance
 * keeps no family tally; a second grant for the same family raises its line). Level 10 is Awakened. A null
 * `familyId` (no monster behind the XP) grants no line.
 */
export function gainItemXp(t: Tuning, inst: ItemInstance, xp: number, familyId: string | null): ItemXpResult {
  const maxLevel = t.xp.item.maxLevel
  const track = advanceTrack({ level: inst.itemLevel, xp: inst.itemXp }, Math.max(0, xp), maxLevel, (n) => itemLevelCost(t, n), false)
  const affinityLevels: readonly number[] = t.xp.item.affinityLevels
  let affinities = inst.affinities.map((a) => ({ ...a }))
  let newAffinity: ItemAffinity | null = null
  for (let level = inst.itemLevel + 1; level <= track.level; level++) {
    if (!affinityLevels.includes(level) || familyId === null) continue
    const existing = affinities.find((a) => a.familyId === familyId)
    if (existing === undefined) {
      newAffinity = { familyId, percent: t.xp.item.affinityPercent }
      affinities = [...affinities, newAffinity]
    } else {
      newAffinity = { familyId, percent: existing.percent + t.xp.item.affinityPercent }
      affinities = affinities.map((a) => (a.familyId === familyId ? (newAffinity as ItemAffinity) : a))
    }
  }
  return {
    inst: { ...inst, itemLevel: track.level, itemXp: track.xp, affinities },
    levelsGained: track.gained,
    newAffinity,
    awakened: inst.itemLevel < maxLevel && track.level >= maxLevel,
  }
}

/** True at the top item level. */
export function isAwakened(t: Tuning, inst: ItemInstance): boolean {
  return inst.itemLevel >= t.xp.item.maxLevel
}
