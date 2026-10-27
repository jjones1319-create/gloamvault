import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Crimson Crescendo (Blade Ultimate; docs/classes/blade.md §3): `multiplier` × Attack of `damageType` to every
 * enemy except the main target. Reading: the main target is the target of the first hit this action (the first
 * damage or miss event after the holder's `action` entry); each other enemy takes one melee strike that cannot miss
 * (an Ultimate never misses) and can crit. Guard and Block still apply to these strikes.
 */
const handler: CustomHandler = {
  apply: (ctx, target, scale) => {
    if (!target || !ctx.fx.isActive(target)) return
    const log = ctx.state.log
    let start = -1
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]
      if (e && e.kind === 'action' && e.actorId === ctx.holder.id) {
        start = i
        break
      }
    }
    const first = log.slice(start + 1).find((e) => e.actorId === ctx.holder.id && (e.kind === 'damage' || e.kind === 'miss'))
    const mainId = first?.targetId ?? ctx.holder.lastTargetId
    if (target.id === mainId) return
    const type = ctx.line.damageType ?? 'slash'
    const amount = roundHalfUp((ctx.fx.attackFor(ctx.holder, type) * (ctx.line.multiplier ?? 1) * scale) / 100)
    if (amount <= 0) return
    const label = ctx.content.skills.get(ctx.sourceId ?? '')?.name ?? 'crescendo'
    ctx.fx.strike(ctx.holder, target, { amount, damageType: type, label, canMiss: false, canCrit: true, isMelee: !(ctx.holder.hero?.weapon.ranged ?? false) })
  },
}
export default handler
