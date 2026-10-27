import type { Effect, SkillDef } from './types/content.ts'

/**
 * A skill's effect lines at a rank (03-GAME-DESIGN §7.3): rank 10's Mastery lines replace a line of the same kind
 * and status/stat/customId/target, i-th for i-th, and otherwise add (D-062, D-071). Shared by the fight (actives) and
 * the hero builder (loadout passives).
 */
export function linesAtRank(skill: SkillDef, rank: number): Effect[] {
  if (rank < 10 || skill.mastery.effects.length === 0) return [...skill.effects]
  // The i-th Mastery line of a signature replaces the i-th skill line of that signature (a three-hit Mastery restates
  // all three hits); a Mastery line with no partner is added (D-071).
  const lines = [...skill.effects]
  const used = new Set<number>()
  const sig = (l: Effect): string => `${l.kind}|${l.status ?? ''}|${l.stat ?? ''}|${l.customId ?? ''}|${l.target ?? ''}`
  for (const m of skill.mastery.effects) {
    const i = lines.findIndex((l, idx) => !used.has(idx) && sig(l) === sig(m))
    if (i >= 0) {
      lines[i] = m
      used.add(i)
    } else lines.push(m)
  }
  return lines
}

/** Percent of the rank-1 value a line is worth at this rank (`rankScaling.effectPerRank`, signed). */
export function rankEffectPercent(skill: SkillDef, rank: number): number {
  return 100 + skill.rankScaling.effectPerRank * (Math.max(1, rank) - 1)
}
