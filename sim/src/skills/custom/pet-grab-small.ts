import type { CustomHandler } from './types.ts'

/**
 * Brine Crab's Pinch (pet active, 06 §9): Grab (`status`, `duration`; 06 §7 rules) a Small enemy; no effect on a
 * bigger one. The grab's bookkeeping (grabbedBy, the damage-to-free counter) is the same as a monster's net.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || target === ctx.holder) return
    if (target.monster?.size !== 'small') {
      ctx.fx.log('noEffect', `${target.name} is too big for ${ctx.holder.name} to pinch`, { actorId: ctx.holder.id, targetId: target.id })
      return
    }
    const status = ctx.line.status ?? 'grab'
    const r = ctx.fx.applyStatus(target, { status, duration: ctx.line.duration ?? 1 }, ctx.holder.id)
    if (r === 'applied' && status === 'grab') {
      target.grabbedBy = ctx.holder.id
      target.grabDamage = 0
    }
  },
}
export default handler
