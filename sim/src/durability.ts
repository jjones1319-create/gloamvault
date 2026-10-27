import { clamp, roundHalfUp } from './stats.ts'
import type { Tuning } from './tuning.ts'
import { GRADES, gradeIndex as gradeIndexOf, type Grade } from './types/enums.ts'

/**
 * Care for your things (03-GAME-DESIGN §6.2, §6.4, §6.5; the constants of 08 §8–§9, D-009, D-031). Durability is
 * kept in basis points (0–10,000) so wear per event is an integer; the card shows percent. These are pure functions
 * over an item's numbers; the items module applies them to instances.
 */
export const BASIS = 10_000

export type DurabilityBand = 'full' | 'worn' | 'damaged' | 'broken'

export function toPercent(bp: number): number {
  return Math.floor(bp / 100)
}

export function fromPercent(pct: number): number {
  return clamp(pct, 0, 100) * 100
}

/** Wear per meaningful event in basis points: 100 / k, rounded half up (08 §9.1); doubled on a weakness hit. */
export function wearPerEvent(wearK: number, double = false): number {
  const bp = roundHalfUp(100 / Math.max(0.01, wearK))
  return double ? bp * 2 : bp
}

/**
 * The stat bands (03 §6.4, 08 §9.2): 100–60% full · 60–20% linear falloff to −30% (weapons also −10% Accuracy) ·
 * 20–1% Damaged −50% · 0% Broken, 0 stats, never destroyed by wear.
 */
export function durabilityBand(t: Tuning, durabilityBp: number): { band: DurabilityBand; statPercent: number; accuracyPenalty: number } {
  const d = t.equipment.durability
  const pct = durabilityBp / 100
  if (durabilityBp <= 0) return { band: 'broken', statPercent: 0, accuracyPenalty: 0 }
  if (pct < d.bands.damagedBelow) return { band: 'damaged', statPercent: 100 - d.damagedPercent, accuracyPenalty: d.falloffWeaponAccuracyPenalty }
  if (pct >= d.bands.fullAbove) return { band: 'full', statPercent: 100, accuracyPenalty: 0 }
  // Linear from 0 at the top of the band to the full falloff at its bottom.
  const span = d.bands.fullAbove - d.bands.damagedBelow
  const depth = (d.bands.fullAbove - pct) / span
  return {
    band: 'worn',
    statPercent: 100 - roundHalfUp(d.falloffPercentAtBottom * depth),
    accuracyPenalty: roundHalfUp(d.falloffWeaponAccuracyPenalty * depth),
  }
}

export interface Wearable {
  durabilityBp: number
  maxDurability: number
}

/**
 * Applies wear. Reaching 0 from above is a neglect cycle: maxDurability −5, permanently; at maxDurability 0 the
 * item is destroyed (08 §9.5). Returns what happened so the UI can toast at 20% and warn at max 20 / 10.
 */
export function applyWear(t: Tuning, item: Wearable, bp: number): { crossedToast: boolean; neglect: boolean; destroyed: boolean } {
  const d = t.equipment.durability
  const before = item.durabilityBp
  const after = Math.max(0, before - bp)
  item.durabilityBp = after
  const toastAt = d.toastAtPercent * 100
  const crossedToast = before > toastAt && after <= toastAt
  let neglect = false
  let destroyed = false
  if (before > 0 && after === 0) {
    neglect = true
    item.maxDurability = Math.max(0, item.maxDurability - d.neglectErosion)
    if (item.maxDurability <= 0) destroyed = true
  }
  return { crossedToast, neglect, destroyed }
}

/** The ceiling in basis points: an item never repairs above its maxDurability. */
export function maxBp(item: Wearable): number {
  return item.maxDurability * 100
}

/** Repair by points (percent); never lowers maxDurability and never exceeds it. Returns the points actually restored. */
export function repair(item: Wearable, points: number): number {
  const target = Math.min(maxBp(item), item.durabilityBp + points * 100)
  const restored = Math.max(0, target - item.durabilityBp)
  item.durabilityBp = target
  return Math.floor(restored / 100)
}

/** The blacksmith's price for `points` of repair: 0.5% of value per point, rounded half up (08 §9.3). */
export function repairCost(t: Tuning, value: number, points: number): number {
  return roundHalfUp((value * t.equipment.durability.repair.percentOfValuePerPoint * points) / 100)
}

/** Points "Repair all" needs on this item (to its own ceiling). */
export function pointsToFull(item: Wearable): number {
  return Math.max(0, Math.floor((maxBp(item) - item.durabilityBp) / 100))
}

/** The wipe penalty: −10% on every equipped item (03 §12.2); a neglect cycle can fire. */
export function wipePenalty(t: Tuning, item: Wearable): ReturnType<typeof applyWear> {
  return applyWear(t, item, t.equipment.durability.wipePenalty * 100)
}

/** +N (08 §4): gold = value × 2% × N; stones 1 up to +6, 2 from +7; each level adds 5% of the item's own base. */
export function plusNCost(t: Tuning, value: number, nextLevel: number): { gold: number; stones: number } {
  const p = t.equipment.plusN
  return {
    gold: roundHalfUp((value * p.goldPercentOfValuePerLevel * nextLevel) / 100),
    stones: nextLevel <= p.stonesPerLevel.upToLevel6 * 6 ? p.stonesPerLevel.upToLevel6 : p.stonesPerLevel.fromLevel7,
  }
}

export function plusNStatPercent(t: Tuning, plusN: number): number {
  return 100 + t.equipment.plusN.percentOfBasePerLevel * plusN
}

export const GRADE_ORDER = GRADES

/** Grade index 0–8 from any string; throws on an unknown grade. */
export function gradeIndex(grade: string): number {
  if (!(GRADES as readonly string[]).includes(grade)) throw new Error(`unknown grade ${grade}`)
  return gradeIndexOf(grade as Grade)
}

/** Material units to promote from a grade to the next (D-031): F→E 6 · E→D 8 · … · SS→God 50. null at God. */
export function promotionUnits(t: Tuning, fromGrade: string): number | null {
  const i = gradeIndex(fromGrade)
  const to = GRADE_ORDER[i + 1]
  if (!to) return null
  const key = `${fromGrade}-${to}` as keyof Tuning['equipment']['promotion']['units']
  return t.equipment.promotion.units[key]
}

/** Gold for a promotion: 25% of the target grade's value. */
export function promotionGold(t: Tuning, targetValue: number): number {
  return roundHalfUp((targetValue * t.equipment.promotion.goldPercentOfTargetValue) / 100)
}

/** Salvage (03 §6.5): 25% of the item's own promotion cost in its material (an F piece: 25% of the 4-unit forge); destroyed by neglect: 50%. */
export function salvageUnits(t: Tuning, grade: string, destroyedByNeglect = false): number {
  const i = gradeIndex(grade)
  const cost = i === 0 ? t.equipment.promotion.forgeFUnits : (promotionUnits(t, GRADE_ORDER[i - 1] as string) ?? 0)
  const pct = destroyedByNeglect ? t.equipment.salvage.destroyedByNeglectPercent : t.equipment.salvage.percentOfPromotionCost
  return Math.max(1, roundHalfUp((cost * pct) / 100))
}

/** Item value = grade value × slot factor (08 top). */
export function itemValue(t: Tuning, grade: string, slotFactorKey: keyof Tuning["equipment"]["valuation"]['slotFactor']): number {
  const v = t.equipment.valuation
  return roundHalfUp(v.gradeValue[grade as keyof typeof v.gradeValue] * v.slotFactor[slotFactorKey])
}
