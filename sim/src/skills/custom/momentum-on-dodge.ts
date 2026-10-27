import type { CustomHandler } from './types.ts'

/** Thousand Steps (Blade, Iron Dance III; docs/classes/blade.md §4.1): dodging an attack gives the holder `amount` Momentum. */
const handler: CustomHandler = {
  onDodge: (ctx) => ctx.fx.gainMomentum(ctx.holder, ctx.line.amount ?? 0),
}
export default handler
