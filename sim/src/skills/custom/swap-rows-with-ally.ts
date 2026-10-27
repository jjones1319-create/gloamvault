import type { CustomHandler } from './types.ts'

/** Lockstep (Warden, Vanguard II; docs/classes/warden.md §4.2): the holder and the chosen ally trade rows as part of the action. */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const me = ctx.holder
    if (!target || target === me || target.side !== me.side) return
    const mine = me.row
    me.row = target.row
    target.row = mine
    ctx.fx.log('swapRow', `${me.name} and ${target.name} trade places (${me.name} ${me.row}, ${target.name} ${target.row})`, { actorId: me.id, targetId: target.id })
  },
}
export default handler
