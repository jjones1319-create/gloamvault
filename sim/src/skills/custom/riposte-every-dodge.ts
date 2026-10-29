import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Edge of the Dance (Blade, Iron Dance V passive; docs/classes/blade.md §4.1): every dodge is answered by a free
 * `multiplier` × Attack riposte of `damageType` (0.8×; Mastery 1.2×) — no counter, no limit (Mirror Step's
 * `riposte-on-dodge` is the limited, one-turn version). A riposte cannot miss, can crit and is never answered
 * (`isMelee: false`); `scalesWith` adds as on any line.
 */
const handler: CustomHandler = {
  onDodge: (ctx, attacker) => {
    if (!ctx.fx.isActive(attacker) || !ctx.fx.isActive(ctx.holder)) return
    const type = ctx.line.damageType ?? ctx.holder.hero?.weapon.damageType ?? 'slash'
    const scales = ctx.line.scalesWith ? Math.max(0, (ctx.holder.attributes[ctx.line.scalesWith] ?? 10) - 10) * 2 : 0
    const amount = roundHalfUp((ctx.fx.attackFor(ctx.holder, type) * (ctx.line.multiplier ?? 0.8) * (100 + scales)) / 100)
    if (amount > 0) ctx.fx.strike(ctx.holder, attacker, { amount, damageType: type, label: 'riposte', canMiss: false, canCrit: true, isMelee: false })
  },
}
export default handler
