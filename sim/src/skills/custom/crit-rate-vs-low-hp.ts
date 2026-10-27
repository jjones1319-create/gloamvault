import type { CustomHandler } from './types.ts'

/** Headsman's Eye (Blade, Executioner I; docs/classes/blade.md §4.2): +`amount` Crit Rate points against targets under `percent`% HP. */
const handler: CustomHandler = {
  critRateBonus: (ctx, target) => (target.hp * 100 < target.maxHp * (ctx.line.percent ?? 0) ? (ctx.line.amount ?? 0) : 0),
}
export default handler
