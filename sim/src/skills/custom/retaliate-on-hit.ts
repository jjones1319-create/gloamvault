import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Saint's Mantle (Mender passive, Sanctity V; docs/classes/mender.md §4.2): when the holder is hit, the attacker takes
 * `multiplier` (0.4; Mastery 0.6) × the holder's spell Attack as `damageType` (Holy) and `status` (Fear) for
 * `duration`, once per enemy per turn. Reading: "per turn" is the attacker's action — the hook keeps, per attacker,
 * the action count it last answered. The answer never misses or crits and never answers back (`isMelee: false`).
 */
const handler: CustomHandler = {
  afterHit: (ctx, incoming) => {
    const a = incoming.attacker
    const hook = ctx.hook
    if (!hook || !a || a.side === ctx.holder.side || incoming.isDot || !ctx.fx.isActive(a)) return
    const key = `last:${a.id}`
    if (hook.data[key] === a.tally.actions) return
    hook.data[key] = a.tally.actions
    const type = ctx.line.damageType ?? 'holy'
    const amount = roundHalfUp(ctx.fx.statOf(ctx.holder, 'attackSpell') * (ctx.line.multiplier ?? 0))
    if (amount > 0) ctx.fx.strike(ctx.holder, a, { amount, damageType: type, label: 'mantle', canMiss: false, canCrit: false, isMelee: false })
    if (ctx.line.status && ctx.fx.isActive(a)) ctx.fx.applyStatus(a, { status: ctx.line.status, duration: ctx.line.duration ?? 1 }, ctx.holder.id)
  },
}
export default handler
