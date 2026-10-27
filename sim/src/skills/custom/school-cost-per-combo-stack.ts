import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Thousand Steps (Blade, Iron Dance III; docs/classes/blade.md §4.1): actives of the owner's school cost `amount`
 * (−2) pool per current Blade Rhythm stack. Reading: `costPercent` speaks in percent, so the flat change is turned
 * into the percent of the skill's rank-scaled cost that yields it; the stacks are read from the holder's
 * `school-combo-damage-stacks` hook.
 */
const handler: CustomHandler = {
  costPercent: (ctx, skill) => {
    const school = ctx.content.skills.get(ctx.hook?.sourceSkillId ?? ctx.sourceId ?? '')?.school
    if (!school || skill.school !== school || skill.type !== 'active') return 0
    const stacks = Number(ctx.holder.hooks.find((h) => h.customId === 'school-combo-damage-stacks')?.data.stacks ?? 0)
    if (stacks <= 0) return 0
    const rank = ctx.holder.hero?.ranks[skill.id] ?? 1
    const cost = Math.max(0, roundHalfUp((skill.cost * (100 + skill.rankScaling.costPerRank * (rank - 1))) / 100))
    if (cost <= 0) return 0
    return ((ctx.line.amount ?? 0) * stacks * 100) / cost
  },
}
export default handler
