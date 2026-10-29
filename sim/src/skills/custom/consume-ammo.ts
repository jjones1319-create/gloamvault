import { spendAmmo } from '../../ammo.ts'
import type { CustomHandler } from './types.ts'

/**
 * Every Marksman and Trapper shot (Ranger; docs/classes/ranger.md §4): the action spends `amount` arrows or bolts from
 * the quiver (Volley 3). The fight counts the quiver the delve handed it (sim/src/ammo.ts, 08 §4, D-099): the skill is
 * greyed out when the quiver holds fewer than it needs, and this line spends them as it resolves. A fight that does
 * not count ammo (no `hero.ammo`) spends nothing.
 */
const handler: CustomHandler = {
  apply(ctx) {
    spendAmmo(ctx.holder, Math.max(0, ctx.line.amount ?? 1))
  },
}
export default handler
