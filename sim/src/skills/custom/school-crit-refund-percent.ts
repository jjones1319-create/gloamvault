import { clamp, roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

const STARTS = new Set(['action', 'guard', 'swapRow', 'flee', 'fleeFail', 'freeAlly', 'charge', 'stance'])

function schoolOf(ctx: HookContext): string | null {
  return ctx.content.skills.get(ctx.hook?.sourceSkillId ?? ctx.sourceId ?? '')?.school ?? null
}

function critThisAction(ctx: HookContext): boolean {
  const log = ctx.state.log
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]
    if (!e) continue
    if (e.actorId === ctx.holder.id && STARTS.has(e.kind)) return false
    if (e.kind === 'damage' && e.actorId === ctx.holder.id && e.data?.crit === true) return true
  }
  return false
}

/**
 * Overcharge (Arcanist, Evocation III; docs/classes/arcanist.md §4.1): a crit by a skill of this skill's school
 * refunds `percent`% of its pool cost (mastery 20%). Reading: settled when the skill finishes by reading this
 * action's crit events in the log; the cost is the skill's rank-scaled cost before other cost hooks. One refund per
 * cast however many hits crit.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, holder.id, { sourceSkillId: ctx.sourceId })
  },
  onSkillUsed: (ctx, skill) => {
    const holder = ctx.holder
    const school = schoolOf(ctx)
    if (!school || skill.school !== school || skill.isUltimate || holder.poolKind === null || !critThisAction(ctx)) return
    const rank = holder.hero?.ranks[skill.id] ?? 1
    const cost = Math.max(0, roundHalfUp((skill.cost * (100 + skill.rankScaling.costPerRank * (rank - 1))) / 100))
    const refund = roundHalfUp((cost * (ctx.line.percent ?? 0)) / 100)
    if (refund <= 0) return
    holder.pool = clamp(holder.pool + refund, 0, holder.poolMax)
    ctx.fx.log('poolRefund', `${holder.name}'s crit returns ${refund} ${holder.poolKind}`, { actorId: holder.id, amount: refund })
  },
}
export default handler
