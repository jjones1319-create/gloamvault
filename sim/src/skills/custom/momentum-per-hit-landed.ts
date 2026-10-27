import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Flurry (Blade, Iron Dance II; docs/classes/blade.md §4.1): `amount` Momentum for every hit of this skill that
 * landed. Reading: counts the holder's `damage` events since its `action` entry; the amount rank-scales like a
 * `momentum` line.
 */
const handler: CustomHandler = {
  apply: (ctx, _target, scale) => {
    const holder = ctx.holder
    const log = ctx.state.log
    let start = -1
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]
      if (e && e.kind === 'action' && e.actorId === holder.id) {
        start = i
        break
      }
    }
    let hits = 0
    for (const e of log.slice(start + 1)) if (e.kind === 'damage' && e.actorId === holder.id) hits += 1
    if (hits > 0) ctx.fx.gainMomentum(holder, roundHalfUp((hits * (ctx.line.amount ?? 0) * scale) / 100))
  },
}
export default handler
