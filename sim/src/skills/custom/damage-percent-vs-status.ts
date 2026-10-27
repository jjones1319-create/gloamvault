import type { CustomHandler } from './types.ts'

/** Quarry (Ranger, Marksman II; docs/classes/ranger.md §4.1): the holder's damage to targets holding `status` (Mark) +`percent`. */
const handler: CustomHandler = {
  outgoingDamagePercent: (ctx, target, incoming) => (!incoming.isDot && ctx.line.status && ctx.fx.hasStatus(target, ctx.line.status) ? (ctx.line.percent ?? 0) : 0),
}
export default handler
