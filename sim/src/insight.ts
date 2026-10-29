import type { Content } from './content.ts'
import type { Rng } from './rng.ts'
import { roundHalfUp } from './stats.ts'
import type { Tuning } from './tuning.ts'
import type { HeroRecord } from './types/content.ts'

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

/** A monster technique while the monster uses the move: a flat 10% per witnessed use (D-028), guaranteed by the 10th (D-099). */
export function techniqueChanceBp(t: Tuning): number {
  return t.techniques.percentPerWitnessedUse * 100
}

/** One qualifying witnessed use of a technique, the hero's `seen`-th (D-028, D-099): certain from techniques.guaranteedByUse, else the flat chance. */
export function rollTechnique(t: Tuning, rng: Rng, seen: number): boolean {
  if (seen >= t.techniques.guaranteedByUse) return true
  const chance = techniqueChanceBp(t)
  return chance > 0 && rng.int(10_000) < chance
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

/** One floor where a school's next Insight sparks: the dungeon, the floor, its monsters' level and the curve there (hundredths). */
export interface InsightHintFloor {
  dungeonId: string
  floor: number
  monsterLevel: number
  curveBp: number
}

/** Where a school's next Insight is likeliest (09 §2 open question 2, D-099: the Skill Hall's hint, from Phase 7). */
export interface InsightHint {
  schoolId: string
  /** The lowest tier the hero can Insight into in this school now. */
  tier: number
  /** The tier's sweet spot (03 §7.5: enemy level ≈ tier × 6). */
  level: number
  /** The floors whose monsters sit nearest the sweet spot (the curve's best value first), at most three. */
  floors: InsightHintFloor[]
}

/**
 * The hint for one school: the lowest tier among the skills an Insight could teach the hero now (unknown, not the
 * Ultimate, not a technique, not a locked tier, prerequisite known) and the floors of every dungeon in the content
 * whose monster level gives that tier the best spark curve (S > 0 only). Null when the school has nothing left to
 * Insight. Pure: the client and the tests read the same answer.
 */
export function insightHint(content: Content, t: Tuning, hero: HeroRecord, schoolId: string): InsightHint | null {
  const known = new Set(hero.skills.map((k) => k.skillId))
  const candidates = (content.skillsByClass.get(hero.classId) ?? []).filter(
    (s) =>
      s.school === schoolId &&
      !known.has(s.id) &&
      !s.isUltimate &&
      s.monsterTechniqueOf === null &&
      s.monsterTechniqueLater === undefined &&
      s.tier <= t.skills.obtainableTierMax.value &&
      (s.prerequisiteId === null || known.has(s.prerequisiteId)),
  )
  if (candidates.length === 0) return null
  const tier = Math.min(...candidates.map((s) => s.tier))
  const level = sweetSpotLevel(t, tier)
  const floors: InsightHintFloor[] = []
  for (const d of content.dungeons.values()) {
    for (const f of d.floors) {
      const curveBp = sparkCurve(t, f.monsterLevel - level)
      if (curveBp > 0) floors.push({ dungeonId: d.id, floor: f.floor, monsterLevel: f.monsterLevel, curveBp })
    }
  }
  floors.sort((a, b) => b.curveBp - a.curveBp || a.floor - b.floor || (a.dungeonId < b.dungeonId ? -1 : 1))
  return { schoolId, tier, level, floors: floors.slice(0, 3) }
}
