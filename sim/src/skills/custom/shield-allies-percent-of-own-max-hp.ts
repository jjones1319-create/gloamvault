import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Lockstep (Mastery), Phalanx and The Gate Holds (Warden; docs/classes/warden.md §3, §4.2): each target gains a
 * Shield worth `percent` of the WARDEN's max HP (the plain `shield` line reads the holder's) for `duration` turns.
 */
const handler: CustomHandler = {
  apply: (ctx, target, scale) => {
    if (!target) return
    const amount = roundHalfUp((ctx.holder.maxHp * (ctx.line.percent ?? 0) * scale) / 10_000)
    if (amount <= 0) return
    const r = ctx.fx.applyStatus(target, { status: 'shield', duration: ctx.line.duration, magnitude: amount }, ctx.holder.id)
    if (r === 'applied') ctx.fx.log('shield', `${target.name} is shielded for ${amount}`, { actorId: ctx.holder.id, targetId: target.id, amount })
  },
}
export default handler
