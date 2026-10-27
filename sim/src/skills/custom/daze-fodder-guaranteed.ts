import type { CustomHandler } from './types.ts'

/**
 * The Gate Holds, Mastery (Warden Ultimate; docs/classes/warden.md §3): Daze lands with certainty on fodder-role
 * enemies of the row; the skill's own 50% Daze line still rolls for everyone. A fodder enemy the 50% line already
 * Dazed this action (a `status` event on it) is not Dazed twice.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || target.monster?.role !== 'fodder' || !ctx.fx.isActive(target)) return
    const status = ctx.line.status ?? 'daze'
    const log = ctx.state.log
    let start = -1
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]
      if (e && e.kind === 'action' && e.actorId === ctx.holder.id) {
        start = i
        break
      }
    }
    if (log.slice(start + 1).some((e) => e.kind === 'status' && e.targetId === target.id && e.data?.status === status)) return
    ctx.fx.applyStatus(target, { status, duration: ctx.line.duration }, ctx.holder.id)
  },
}
export default handler
