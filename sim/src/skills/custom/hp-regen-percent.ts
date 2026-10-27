import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * of Renewal (08 §5): "+HP regen per own turn 1% / 2% / 3%" of max HP. The hook sits on the wearer (hero.ts) and
 * heals `percent` of max HP at each of the wearer's turn starts, through the healing pipeline (Wither applies).
 */
const handler: CustomHandler = {
  onTurnStart: (ctx) => {
    const who = ctx.holder
    if (!ctx.fx.isActive(who)) return
    const amount = roundHalfUp((who.maxHp * (ctx.line.percent ?? 0)) / 100)
    if (amount <= 0) return
    const healed = ctx.fx.heal(who, who, amount)
    if (healed > 0) ctx.fx.log('regen', `${who.name} renews ${healed}`, { actorId: who.id, amount: healed })
  },
}
export default handler
