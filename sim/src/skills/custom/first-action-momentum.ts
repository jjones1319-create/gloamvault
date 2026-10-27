import type { CustomHandler } from './types.ts'

/**
 * Steady Draw, Mastery (Ranger, Marksman I; docs/classes/ranger.md §4.1): the first action of each fight also gives
 * `amount` Momentum. Reading: granted in `modifyWeight`, the one joint every action kind passes through as it is
 * spent, once (data.done).
 */
const handler: CustomHandler = {
  modifyWeight: (ctx, weight) => {
    const hook = ctx.hook
    if (hook && ctx.holder.tally.actions === 0 && hook.data.done !== true) {
      hook.data.done = true
      ctx.fx.gainMomentum(ctx.holder, ctx.line.amount ?? 0)
    }
    return weight
  },
}
export default handler
