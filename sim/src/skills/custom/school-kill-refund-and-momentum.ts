import { clamp, roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Grim Harvest (Blade, Executioner III; docs/classes/blade.md §4.2): a kill by an active of the owner's school
 * refunds `percent` of its cost and gives `amount` Momentum. Reading: `onKill` fires inside the skill's lines before
 * the skill is known, so kills are counted from the action's start (`onHolderAttacks`) and settled once in
 * `onSkillUsed`: the refund is the rank-scaled cost before other discounts, the Momentum is granted once per skill
 * use that killed (not per kill).
 */
const handler: CustomHandler = {
  onHolderAttacks: (ctx) => {
    if (ctx.hook) ctx.hook.data.kills = 0
  },
  onKill: (ctx) => {
    if (ctx.hook) ctx.hook.data.kills = Number(ctx.hook.data.kills ?? 0) + 1
  },
  onSkillUsed: (ctx, skill) => {
    const hook = ctx.hook
    if (!hook) return
    const kills = Number(hook.data.kills ?? 0)
    hook.data.kills = 0
    const school = ctx.content.skills.get(hook.sourceSkillId ?? '')?.school
    if (kills <= 0 || skill.type !== 'active' || skill.isUltimate || !school || skill.school !== school) return
    const holder = ctx.holder
    const rank = holder.hero?.ranks[skill.id] ?? 1
    const cost = Math.max(0, roundHalfUp((skill.cost * (100 + skill.rankScaling.costPerRank * (rank - 1))) / 100))
    const refund = roundHalfUp((cost * (ctx.line.percent ?? 100)) / 100)
    if (refund > 0 && holder.poolKind) holder.pool = clamp(holder.pool + refund, 0, holder.poolMax)
    ctx.fx.gainMomentum(holder, ctx.line.amount ?? 0)
    ctx.fx.log('harvest', `${holder.name} reaps the kill (+${refund} pool)`, { actorId: holder.id, amount: refund })
  },
}
export default handler
