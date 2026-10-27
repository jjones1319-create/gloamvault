import type { CustomHandler } from './types.ts'

/**
 * Spring Trap (Ranger, Trapper III; docs/classes/ranger.md §4.2): `status` (Stun) lands only if the target holds
 * Root, Grab, Web or a Net (`net-held`). Reading: needs the skill's hit to have landed on the target this action.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || !ctx.line.status || !ctx.fx.isActive(target)) return
    const held = target.statuses.some((s) => s.id === 'root' || s.id === 'grab' || s.id === 'web') || target.hooks.some((h) => h.customId === 'net-held')
    if (!held) return
    const log = ctx.state.log
    let start = -1
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]
      if (e && e.kind === 'action' && e.actorId === ctx.holder.id) {
        start = i
        break
      }
    }
    if (!log.slice(start + 1).some((e) => e.kind === 'damage' && e.actorId === ctx.holder.id && e.targetId === target.id)) return
    ctx.fx.applyStatus(target, { status: ctx.line.status, duration: ctx.line.duration }, ctx.holder.id)
  },
}
export default handler
