import { roundHalfUp } from './stats.ts'
import type { Tuning } from './tuning.ts'

/**
 * Everything levels with use (03-GAME-DESIGN §5): the gate, the difficulty curve D, the per-delve use budget and
 * the growth curves for skills, attributes, items and the hero level. Pure integer arithmetic; multipliers are
 * returned in hundredths (100 = ×1.0) so callers never touch floats.
 */

/** A meaningful action: the enemy is at or above the hero's level minus the gate (10). */
export function isGated(t: Tuning, enemyLevel: number, heroLevel: number): boolean {
  return enemyLevel >= heroLevel - t.xp.gate.enemyLevelBelowHero
}

/** D(enemyLevel − heroLevel) in hundredths: 10 at −10 or lower, 100 at 0, 200 at +5, 300 at +10 or higher; linear between. */
export function difficultyMultiplier(t: Tuning, enemyLevel: number, heroLevel: number): number {
  const curve = t.xp.difficultyCurve
  const delta = enemyLevel - heroLevel
  const first = curve[0]
  const last = curve[curve.length - 1]
  if (!first || !last) return 100
  if (delta <= first.delta) return roundHalfUp(first.multiplier * 100)
  if (delta >= last.delta) return roundHalfUp(last.multiplier * 100)
  for (let i = 1; i < curve.length; i++) {
    const lo = curve[i - 1]
    const hi = curve[i]
    if (!lo || !hi) continue
    if (delta <= hi.delta) {
      const span = hi.delta - lo.delta
      const frac = (delta - lo.delta) / span
      return roundHalfUp((lo.multiplier + (hi.multiplier - lo.multiplier) * frac) * 100)
    }
  }
  return 100
}

/** The per-delve use budget (§5.1): uses 1–20 pay 100%, 21–60 pay 50%, later 10%. `usesBefore` is the count already made. */
export function useBudgetPercent(t: Tuning, usesBefore: number): number {
  const b = t.xp.useBudget
  if (usesBefore < b.fullUses) return 100
  if (usesBefore < b.halfUsesUntil) return b.halfPercent
  return b.tailPercent
}

/** XP for one meaningful use: base × D × budget, rounded half up; 0 when not gated. */
export function useXp(t: Tuning, base: number, enemyLevel: number, heroLevel: number, usesBefore: number, extraPercent = 0): number {
  if (!isGated(t, enemyLevel, heroLevel)) return 0
  const d = difficultyMultiplier(t, enemyLevel, heroLevel)
  const budget = useBudgetPercent(t, usesBefore)
  return roundHalfUp((base * d * budget * (100 + extraPercent)) / 1_000_000)
}

/** Total XP a skill needs to be at rank N (§5.2: 100 × 1.5^(N−1); rank 10 ≈ 3,844). Rank 1 is 0. */
export function skillRankThreshold(t: Tuning, rank: number): number {
  if (rank <= 1) return 0
  return roundHalfUp(t.xp.skill.rankBase * Math.pow(t.xp.skill.rankGrowth, rank - 1))
}

/** The rank a skill has reached with `xp` total XP (1–maxRank). */
export function skillRankFor(t: Tuning, xp: number): number {
  let rank = 1
  while (rank < t.xp.skill.maxRank && xp >= skillRankThreshold(t, rank + 1)) rank++
  return rank
}

/** XP needed to gain attribute point N (§5.2: 20 × 1.12^(N−10); point 20 ≈ 62, 30 ≈ 193, 40 ≈ 600). */
export function attributePointCost(t: Tuning, point: number): number {
  const a = t.xp.attribute
  return roundHalfUp(a.pointBase * Math.pow(a.pointGrowth, point - a.pointGrowthFrom))
}

/** The soft cap: creation value + 2 × level; gains above it are divided by 4 (§5.2). */
export function attributeSoftCap(t: Tuning, creationValue: number, level: number): number {
  return creationValue + t.xp.attribute.softCapPerLevel * level
}

export function attributeGainAboveCap(t: Tuning, gain: number): number {
  return Math.floor(gain / t.xp.attribute.aboveCapDivisor)
}

/** XP needed to gain item level N (D-051: 40 × 1.3^(N−1)); level 10 is Awakened. */
export function itemLevelCost(t: Tuning, level: number): number {
  const i = t.xp.item
  return roundHalfUp(i.levelBase * Math.pow(i.levelGrowth, level - 1))
}

/** Hero level from total skill ranks (§2.2: level N needs 8 × N ranks; L2 at 16, L10 at 80). */
export function heroLevelFor(t: Tuning, totalSkillRanks: number): number {
  return Math.max(1, Math.floor(totalSkillRanks / t.derived.level.skillRanksPerLevel))
}

/** Ranks needed for the next level. */
export function ranksForLevel(t: Tuning, level: number): number {
  return level <= 1 ? 0 : level * t.derived.level.skillRanksPerLevel
}

/** Which skill tier a hero level opens (§7.2). */
export function tierOpenAt(t: Tuning, level: number): number {
  const opens = t.skills.tierOpensAtLevel
  let tier = 0
  for (const [tierText, at] of Object.entries(opens)) {
    if (level >= at && Number(tierText) > tier) tier = Number(tierText)
  }
  return tier
}

/**
 * Advances an XP track (skill rank or item level) and returns the new state. `costFor(n)` gives the XP needed to
 * move from n−1 to n when `cumulative` is false, or the total XP at n when true (skills).
 */
export function advanceTrack(current: { level: number; xp: number }, gain: number, maxLevel: number, costFor: (n: number) => number, cumulative: boolean): { level: number; xp: number; gained: number } {
  let { level, xp } = current
  const before = level
  xp += gain
  if (cumulative) {
    while (level < maxLevel && xp >= costFor(level + 1)) level++
  } else {
    while (level < maxLevel && xp >= costFor(level + 1)) {
      xp -= costFor(level + 1)
      level++
    }
  }
  return { level, xp, gained: level - before }
}
