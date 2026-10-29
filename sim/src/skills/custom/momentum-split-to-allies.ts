import { clamp, roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Martyrdom (Mender, Vigil V; docs/classes/mender.md §4.3): the caster's Momentum drops to 0 and `percent`% of what it
 * lost (100; Mastery 150) is split evenly among the other heroes of its side, rounded down. A gift, so it is added as
 * it stands (no Momentum-gain scaling) and capped at the Momentum maximum. With no other hero the Momentum is simply
 * spent.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const h = ctx.holder
    const lost = h.momentum
    h.momentum = 0
    const others = ctx.fx.alliesOf(h).filter((a) => a !== h && a.kind === 'hero')
    if (lost <= 0 || others.length === 0) {
      ctx.fx.log('martyrdom', `${h.name} gives up ${lost} Momentum`, { actorId: h.id, amount: lost })
      return
    }
    const share = Math.floor(roundHalfUp((lost * (ctx.line.percent ?? 100)) / 100) / others.length)
    for (const a of others) a.momentum = clamp(a.momentum + share, 0, ctx.t.derived.momentum.max)
    ctx.fx.log('martyrdom', `${h.name} gives up ${lost} Momentum: +${share} to each ally`, { actorId: h.id, amount: share })
  },
}
export default handler
