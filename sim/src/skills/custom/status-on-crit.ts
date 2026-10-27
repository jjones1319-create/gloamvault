import type { CustomHandler } from './types.ts'

/**
 * Skull Splitter (Blade, Executioner III; docs/classes/blade.md §4.2): `status` (Stun) lands only if this skill
 * crits. Reading: the line resolves after the hit, so it reads the holder's damage events on the target this action
 * and applies the status when one of them carries `data.crit`.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || !ctx.line.status || !ctx.fx.isActive(target)) return
    const log = ctx.state.log
    let start = -1
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]
      if (e && e.kind === 'action' && e.actorId === ctx.holder.id) {
        start = i
        break
      }
    }
    const crit = log.slice(start + 1).some((e) => e.kind === 'damage' && e.actorId === ctx.holder.id && e.targetId === target.id && e.data?.crit === true)
    if (!crit) return
    ctx.fx.applyStatus(target, { status: ctx.line.status, duration: ctx.line.duration }, ctx.holder.id)
  },
}
export default handler
