import type { CustomHandler } from './types.ts'

/**
 * Coin Flip (Captain Vexa Marrow, 06 §3.1): "her next attack is a guaranteed crit; tell: the flip, and a star on
 * her strip icon — Guard it". The line installs a hook on the holder; `forceCrit` answers once on the next damage
 * roll that can crit and removes the hook. The log event carries `data.tell` for the HUD's star.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const who = target ?? ctx.holder
    ctx.fx.installHook(who, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId })
    ctx.fx.log('tell', `${who.name} flips a coin: the next blow lands true`, { actorId: who.id, data: { tell: 'crit' } })
  },
  forceCrit: (ctx) => {
    const hook = ctx.hook
    if (!hook) return false
    ctx.fx.removeHook(ctx.holder, hook)
    return true
  },
}
export default handler
