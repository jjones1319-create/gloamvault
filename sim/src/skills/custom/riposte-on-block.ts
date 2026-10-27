import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * of Riposte (08 §5, shields): "on block: 10–15% / 15–25% / 25–40% chance to counter for 50% Attack". The hook sits
 * on the wearer (hero.ts); `onBlock` rolls `percent` and strikes the attacker back for `multiplier` (0.5) of the
 * wearer's Attack in the weapon's damage type. The counter never answers a counter (`isMelee: false`).
 */
const handler: CustomHandler = {
  onBlock: (ctx, incoming) => {
    const attacker = incoming.attacker
    if (!attacker || !ctx.fx.isActive(attacker) || !ctx.rng.pct(ctx.line.percent ?? 0)) return
    const type = ctx.holder.hero?.weapon.damageType ?? 'slash'
    const amount = roundHalfUp(ctx.fx.attackFor(ctx.holder, type) * (ctx.line.multiplier ?? 0.5))
    if (amount <= 0) return
    ctx.fx.strike(ctx.holder, attacker, { amount, damageType: type, label: 'riposte', canMiss: false, canCrit: true, isMelee: false })
  },
}
export default handler
