import { bandForFloor, bandRows } from './grades.ts'
import { clamp, roundHalfUp } from './stats.ts'
import type { Tuning } from './tuning.ts'

/**
 * The town economy in R (03-GAME-DESIGN §7.4, §7.6, §8, D-012, D-025): prices are written in R (the median gold of
 * one delve at the band) so they keep their shape when the runner retunes R. Gold is an integer; R × price is
 * rounded half up.
 */

/** R for a band by its centre grade (08's R table, tuning.json → bands.floors; 300 at F, ×1.6 per band rounded by hand). */
export function rForGrade(t: Tuning, grade: string): number {
  const order = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS']
  const i = order.indexOf(grade)
  if (i < 0) return t.economy.R.base
  const band = bandRows(t).find((b) => b.grade === grade)
  return band ? band.r : roundHalfUp(t.economy.R.base * Math.pow(t.economy.R.perBandMultiplier, i))
}

/** R at a global floor's band (08's R table): delve gold, curio stakes, merchant prices. Pass the tuning wherever it is at hand. */
export function rForFloor(globalFloor: number, t?: Tuning): number {
  return bandForFloor(globalFloor, t).r
}

/** Gold for a price written in R. */
export function goldFor(priceR: number, r: number): number {
  return roundHalfUp(priceR * r)
}

/** Skill Hall (§7.4): Tier I 0.1 R · II 0.3 R · III 1.0 R, +20% per purchase within a tier, capped at ×3. */
export function skillHallPriceR(t: Tuning, tier: 1 | 2 | 3, purchasesInTier: number): number {
  const h = t.skills.skillHall
  const base = h.priceR[String(tier) as '1' | '2' | '3']
  const ramp = Math.min(h.rampCap, 1 + (h.rampPercentPerPurchase / 100) * purchasesInTier)
  return base * ramp
}

/** Haggling (§7.6): buy at 130% − 1% per rank, floor 85%; sell at 40% + 0.5% per rank of value. */
export function buyPricePercent(t: Tuning, hagglingRank: number, shopMultiplierPercent = 100): number {
  const h = t.skills.fieldSkills.haggling
  const pct = Math.max(h.floorPercent, h.basePercent - h.perRank * hagglingRank)
  return roundHalfUp((pct * shopMultiplierPercent) / 100)
}

export function sellPricePercent(t: Tuning, hagglingRank: number): number {
  const h = t.skills.fieldSkills.haggling
  return h.sellBasePercent + h.sellPerRank * hagglingRank
}

export function sellPrice(t: Tuning, value: number, hagglingRank: number): number {
  return roundHalfUp((value * sellPricePercent(t, hagglingRank)) / 100)
}

/** A town price in gold after Haggling and a shop multiplier (the dungeon merchant's ×1.5, an Orc's +10%). */
export function townPrice(t: Tuning, priceR: number, r: number, hagglingRank: number, shopMultiplierPercent = 100): number {
  return roundHalfUp((goldFor(priceR, r) * buyPricePercent(t, hagglingRank, shopMultiplierPercent)) / 100)
}

export type ChestFamily = 'gear' | 'petEgg' | 'materialCrate' | 'skillTome' | 'wayfarer'

export function chestPriceR(t: Tuning, family: ChestFamily, grand: boolean): number {
  return grand ? t.economy.chests.grandPriceR[family] : t.economy.chests.standardPriceR[family]
}

/** The retreat toll without a Waystone (§12.3): a share of the delve's unbanked gold. */
export function retreatToll(t: Tuning, unbankedGold: number, tollPercent = t.death.retreatTollPercent): number {
  return roundHalfUp((clamp(tollPercent, 0, 100) * unbankedGold) / 100)
}

/** The chest band: the band of the deepest floor cleared, capped at A (08 §10; tuning bands.chestBandCap). */
export function chestBandGrade(deepestFloorCleared: number, t?: Tuning): string {
  const grade = bandForFloor(Math.max(1, deepestFloorCleared), t).grade
  const order = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS']
  const cap = t?.bands?.chestBandCap.value ?? 'A'
  return order.indexOf(grade) > order.indexOf(cap) ? cap : grade
}
