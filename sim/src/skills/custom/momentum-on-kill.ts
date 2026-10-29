import type { CustomHandler } from './types.ts'

/**
 * Comet Shot (Ranger, Marksman V; docs/classes/ranger.md §4.1): if this action killed, the holder gains `amount`
 * Momentum. The line follows the damage line (target self), so it reads the holder's damage events since the action's
 * marker and pays once when one of them carries `data.killed`.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const log = ctx.state.log
    let start = -1
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]
      if (e && e.kind === 'action' && e.actorId === ctx.holder.id) {
        start = i
        break
      }
    }
    const killed = log.slice(start + 1).some((e) => e.kind === 'damage' && e.actorId === ctx.holder.id && e.data?.killed === true)
    if (!killed) return
    ctx.fx.gainMomentum(ctx.holder, ctx.line.amount ?? 0)
    ctx.fx.log('momentum', `${ctx.holder.name} feeds on the kill`, { actorId: ctx.holder.id, amount: ctx.line.amount ?? 0 })
  },
}
export default handler
