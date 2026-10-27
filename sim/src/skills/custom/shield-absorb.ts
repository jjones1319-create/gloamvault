import type { CustomHandler } from './types.ts'

/** Shield (03 §3.5): absorbs damage up to its magnitude; breaks at 0. */
const handler: CustomHandler = {
  absorb: (ctx, incoming) => {
    const s = ctx.status
    if (!s || s.magnitude <= 0) return incoming.amount
    const absorbed = Math.min(s.magnitude, incoming.amount)
    s.magnitude -= absorbed
    if (s.magnitude <= 0) ctx.holder.statuses = ctx.holder.statuses.filter((x) => x !== s)
    return incoming.amount - absorbed
  },
}
export default handler
