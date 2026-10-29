import type { CustomHandler } from './types.ts'

/**
 * Severance (Shade, Shadow V; docs/classes/shade.md §4.1): if this action killed, the holder re-enters Veil for
 * `duration` turns at no cost. The line follows the damage lines (target self) and reads the holder's damage events
 * since the action's marker for `data.killed`.
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
    if (!killed || !ctx.fx.isActive(ctx.holder)) return
    ctx.fx.applyStatus(ctx.holder, { status: 'veil', duration: Math.max(1, ctx.line.duration ?? 2) }, ctx.holder.id)
  },
}
export default handler
