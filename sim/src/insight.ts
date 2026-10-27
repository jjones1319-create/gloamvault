import type { Rng } from './rng.ts'
import { roundHalfUp } from './stats.ts'
import type { Tuning } from './tuning.ts'

/**
 * Insight (03-GAME-DESIGN §7.5, D-011, D-028): after a meaningful use of a school's skill, a roll to learn one
 * tier-adjacent skill of that school. chance = 4% × S(enemyLevel − tier × 6) × (1 + 1% × (Wis − 10)); S is the
 * SaGa spark curve flattened: 1 at 0, 0.5 at ±3, 0.25 at ±6, 0 beyond ±10, linear between. Pity: one guaranteed
 * Insight per 60 qualifying uses. Monster techniques roll a flat 10% per witnessed use instead.
 * Chances are in hundredths of a percent so the roll stays integer.
 */

/** S(delta) in hundredths (10,000 = 1.0). Symmetric in |delta|. */
export function sparkCurve(t: Tuning, delta: number): number {
  const curve = t.skills.insight.curve
  const d = Math.abs(delta)
  const last = curve[curve.length - 1]
  if (!last || d >= last.delta) return 0
  for (let i = 1; i < curve.length; i++) {
    const lo = curve[i - 1]
    const hi = curve[i]
    if (!lo || !hi) continue
    if (d <= hi.delta) {
      const frac = (d - lo.delta) / (hi.delta - lo.delta)
      return roundHalfUp((lo.multiplier + (hi.multiplier - lo.multiplier) * frac) * 10_000)
    }
  }
  return 0
}

/** The Insight chance for a skill of `targetTier` against an enemy of `enemyLevel`, in hundredths of a percent. */
export function insightChanceBp(t: Tuning, enemyLevel: number, targetTier: number, wisdom: number): number {
  const i = t.skills.insight
  const s = sparkCurve(t, enemyLevel - targetTier * i.tierLevelStep)
  const wis = 100 + i.wisdomPercentPerPoint * (wisdom - 10)
  // base% × S × wis% → hundredths of a percent: base × 100 × (S / 10,000) × (wis / 100)
  return roundHalfUp((i.basePercent * 100 * s * wis) / 1_000_000)
}

/** A monster technique while the monster uses the move: a flat 10% per witnessed use (D-028). */
export function techniqueChanceBp(t: Tuning): number {
  return t.skills.insight.monsterTechniquePercentPerUse * 100
}

export interface InsightCounter {
  /** Qualifying uses since the last Insight, for the pity. */
  usesSincePity: number
}

/**
 * Rolls once. `pity` guarantees the Insight on the 60th qualifying use; any Insight resets the counter.
 * Returns true when the hero learns the skill.
 */
export function rollInsight(t: Tuning, rng: Rng, counter: InsightCounter, chanceBp: number): boolean {
  counter.usesSincePity += 1
  const pity = counter.usesSincePity >= t.skills.insight.pityUses
  const hit = pity || (chanceBp > 0 && rng.int(10_000) < chanceBp)
  if (hit) counter.usesSincePity = 0
  return hit
}

/** The sweet spot for a tier: enemy level ≈ tier × 6 (03 §7.5), for the Skill Hall hint. */
export function sweetSpotLevel(t: Tuning, tier: number): number {
  return tier * t.skills.insight.tierLevelStep
}
