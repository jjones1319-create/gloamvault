import type { CustomHandler } from './types.ts'

/** Veil (03 §3.5, Shade): the next single-target attack misses; ends when the Shade attacks. Ultimates, AoE and DoTs ignore it. */
const handler: CustomHandler = {
  beforeHit: (ctx, incoming) => {
    if (!incoming.isSingleTarget || incoming.isDot || incoming.isUltimate) return null
    ctx.holder.statuses = ctx.holder.statuses.filter((s) => s !== ctx.status)
    return 'miss'
  },
  onHolderAttacks: (ctx) => {
    ctx.holder.statuses = ctx.holder.statuses.filter((s) => s !== ctx.status)
  },
}
export default handler
