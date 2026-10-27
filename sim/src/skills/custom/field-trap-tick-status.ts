import type { CustomHandler } from './types.ts'

/**
 * Caltrop Toss, Mastery (Ranger, Trapper I; docs/classes/ranger.md §4.2): each tick of this skill's field trap also
 * applies `status` (Slow) for `duration` turn(s). Writes `data.tickStatus` / `data.tickStatusDuration` on the
 * holder's `field-trap-row-dot` hooks (installed by the line before it); that handler applies the status on each
 * tick.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    if (!ctx.line.status) return
    for (const a of ctx.state.actors) {
      for (const h of a.hooks) {
        if (h.customId !== 'field-trap-row-dot' || h.sourceId !== ctx.holder.id) continue
        h.data.tickStatus = ctx.line.status
        h.data.tickStatusDuration = ctx.line.duration ?? 1
      }
    }
  },
}
export default handler
