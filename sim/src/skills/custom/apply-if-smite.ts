import type { CustomHandler } from './types.ts'

/**
 * Holy Lance (Mender, Sanctity II; docs/classes/mender.md §4.2): the rider applies `status` (Stun) for `duration`
 * only to a target holding the Smite mark. Bosses take Daze instead through the status conversion (06 §7).
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const status = ctx.line.status
    if (!target || !status || !ctx.fx.hasStatus(target, 'smite')) return
    ctx.fx.applyStatus(target, { status, duration: ctx.line.duration }, ctx.holder.id)
  },
}
export default handler
