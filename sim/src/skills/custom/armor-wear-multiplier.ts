import type { CustomHandler } from './types.ts'

/**
 * Wall Stance (Warden, Bulwark I; docs/classes/warden.md §4.1): the holder's armor wears `percent` (−20) slower.
 * A passive hook: fight.ts asks `wearPercent` for every armor wear event the holder takes and scales it.
 */
const handler: CustomHandler = {
  wearPercent: (ctx, kind) => (kind === 'armor' ? (ctx.line.percent ?? 0) : 0),
}
export default handler
