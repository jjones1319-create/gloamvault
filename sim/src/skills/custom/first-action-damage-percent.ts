import type { CustomHandler } from './types.ts'

/** Steady Draw (Ranger, Marksman I; docs/classes/ranger.md §4.1): the holder's first action of each fight deals +`percent` (its action count is still 0 while it resolves). */
const handler: CustomHandler = {
  outgoingDamagePercent: (ctx, _target, incoming) => (!incoming.isDot && ctx.holder.tally.actions === 0 ? (ctx.line.percent ?? 0) : 0),
}
export default handler
