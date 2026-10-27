import { clamp, roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Quarry (Ranger, Marksman II; docs/classes/ranger.md §4.1): a kill on a target holding `status` (Mark) refunds
 * Hunter's Mark's cost and gives `amount` Momentum. Reading: "Hunter's Mark" is found as the lowest-tier active of
 * the holder's class and the owner's school whose lines apply the status; its rank-scaled cost is refunded.
 */
const handler: CustomHandler = {
  onKill: (ctx, target) => {
    const status = ctx.line.status
    if (!status || !target.statuses.some((s) => s.id === status)) return
    const holder = ctx.holder
    ctx.fx.gainMomentum(holder, ctx.line.amount ?? 0)
    const school = ctx.content.skills.get(ctx.hook?.sourceSkillId ?? ctx.sourceId ?? '')?.school
    const classId = holder.hero?.classId
    if (!school || !classId || !holder.poolKind) return
    const mark = (ctx.content.skillsByClass.get(classId) ?? []).find((s) => s.school === school && s.type === 'active' && s.effects.some((e) => e.kind === 'applyStatus' && e.status === status))
    if (!mark) return
    const rank = holder.hero?.ranks[mark.id] ?? 1
    const cost = Math.max(0, roundHalfUp((mark.cost * (100 + mark.rankScaling.costPerRank * (rank - 1))) / 100))
    if (cost <= 0) return
    holder.pool = clamp(holder.pool + cost, 0, holder.poolMax)
    ctx.fx.log('quarry', `${holder.name} claims the quarry (+${cost} ${holder.poolKind})`, { actorId: holder.id, targetId: target.id, amount: cost })
  },
}
export default handler
