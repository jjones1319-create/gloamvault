import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Counter Stance (Warden, Bulwark I; docs/classes/warden.md §4.1): until your next turn, the first `amount` melee
 * attackers that hit you take `multiplier` × your Attack back (your weapon's damage type). Mastery: two counters.
 * The line installs a hook on the stance-taker that drops at its next turn start; the hook's counter is the
 * answers left. A counter never answers a counter (`isMelee: false` on the strike).
 */
const handler: CustomHandler = {
  apply: (ctx, target, scale) => {
    const holder = target ?? ctx.holder
    const counters = Math.max(1, ctx.line.amount ?? 1)
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, untilTurnStart: true, counter: counters, data: { scale } })
    ctx.fx.log('stance', `${holder.name} takes a counter stance`, { actorId: holder.id })
  },
  afterHit: (ctx, incoming) => {
    const hook = ctx.hook
    if (!hook || hook.counter <= 0 || !incoming.isMelee || !incoming.attacker || !ctx.fx.isActive(incoming.attacker)) return
    hook.counter -= 1
    const scale = Number(hook.data.scale ?? 100)
    const type = ctx.holder.hero?.weapon.damageType ?? 'pierce'
    const amount = roundHalfUp((ctx.fx.attackFor(ctx.holder, type) * (ctx.line.multiplier ?? 1) * scale) / 100)
    ctx.fx.strike(ctx.holder, incoming.attacker, { amount, damageType: type, label: 'counter', canMiss: false, canCrit: true, isMelee: false })
    if (hook.counter <= 0) ctx.fx.removeHook(ctx.holder, hook)
  },
}
export default handler
