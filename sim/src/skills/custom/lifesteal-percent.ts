import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Vampiric (elite affix, 06 §2): the champion heals `percent` of the damage it deals; halved against a Burned
 * target. Installed on the champion at spawn (explore.ts) as a persistent hook; also usable as a skill buff when
 * a line carries a `duration`.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null })
  },
  onDealtDamage: (ctx, target, dealt) => {
    let pct = ctx.line.percent ?? 0
    if (target.statuses.some((s) => s.id === 'burn')) pct /= 2
    const amount = roundHalfUp((dealt * pct) / 100)
    if (amount <= 0) return
    const healed = ctx.fx.heal(ctx.holder, ctx.holder, amount)
    if (healed > 0) ctx.fx.log('lifesteal', `${ctx.holder.name} drinks ${healed}`, { actorId: ctx.holder.id, targetId: target.id, amount: healed })
  },
}
export default handler
