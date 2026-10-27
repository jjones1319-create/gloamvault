import type { CustomHandler } from './types.ts'

/** Steady Draw (Ranger, Marksman I; docs/classes/ranger.md §4.1): the holder's first action of each fight resolves at weight `amount` (800); an action already lighter keeps its own weight. */
const handler: CustomHandler = {
  modifyWeight: (ctx, weight) => (ctx.holder.tally.actions === 0 ? Math.min(weight, ctx.line.amount ?? weight) : weight),
}
export default handler
