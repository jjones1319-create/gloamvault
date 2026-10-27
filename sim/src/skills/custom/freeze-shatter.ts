import type { CustomHandler } from './types.ts'

/** Freeze (03 §3.5): the next physical hit deals ×1.5 and ends it. */
const handler: CustomHandler = {
  incomingDamagePercent: (_ctx, incoming) => (incoming.physical && !incoming.isDot ? 50 : 0),
  afterHit: (ctx, incoming) => {
    if (incoming.physical && !incoming.isDot) ctx.holder.statuses = ctx.holder.statuses.filter((s) => s !== ctx.status)
  },
}
export default handler
