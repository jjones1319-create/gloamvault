import type { CustomHandler } from './types.ts'

/** Quarry (Ranger, Marksman II; docs/classes/ranger.md §4.1): +`amount` Crit Rate points against targets holding `status` (Mark). */
const handler: CustomHandler = {
  critRateBonus: (ctx, target) => (ctx.line.status && ctx.fx.hasStatus(target, ctx.line.status) ? (ctx.line.amount ?? 0) : 0),
}
export default handler
