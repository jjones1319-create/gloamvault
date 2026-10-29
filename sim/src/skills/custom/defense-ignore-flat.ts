import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Sanctified Weapon (Mender passive, Sanctity IV; docs/classes/mender.md §4.2): the holder's `damageType` (Holy) hits
 * ignore `amount` (20) of the target's Defense. Reading: the pipeline mitigates by k / (k + Defense) (effects.ts, k =
 * derived.defense.mitigationK) and lets an attacker-side hook scale the blow before that, so the hook answers the
 * percent that turns k / (k + D) into k / (k + max(0, D − amount)). DoTs are untouched.
 */
const handler: CustomHandler = {
  outgoingDamagePercent: (ctx, target, incoming) => {
    if (incoming.isDot || incoming.damageType !== (ctx.line.damageType ?? 'holy')) return 0
    const d = ctx.fx.statOf(target, 'defense')
    if (d <= 0) return 0
    const k = ctx.t.derived.defense.mitigationK
    const lowered = Math.max(0, d - (ctx.line.amount ?? 0))
    return roundHalfUp(((k + d) / (k + lowered) - 1) * 100)
  },
}
export default handler
