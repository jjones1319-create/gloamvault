import type { CustomHandler } from './types.ts'

/**
 * Tidebound Flagellant (06 §3.3): "gains +10 % Attack per 10 % HP lost (shown as a rising red bar)". A passive trigger
 * (a zero-weight attack, armed at spawn): the holder's damage is +`percent` per whole tenth of its max HP it has lost.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const who = target ?? ctx.holder
    if (who.side !== ctx.holder.side || !who.monster) return
    ctx.fx.installHook(who, ctx.line, who.id, { sourceSkillId: ctx.sourceId })
  },
  outgoingDamagePercent: (ctx) => {
    const who = ctx.holder
    const tenths = Math.floor(((who.maxHp - who.hp) * 10) / Math.max(1, who.maxHp))
    return Math.max(0, tenths) * (ctx.line.percent ?? 10)
  },
}
export default handler
