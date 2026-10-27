import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Mirror Step (Blade, Iron Dance II; docs/classes/blade.md §4.1): for `duration` turn(s) the first `amount` attacks
 * the holder dodges are answered with a `multiplier` × Attack riposte of `damageType`. The hook drops at the holder's
 * next turn start ("1 turn" on a self-buff cast on your own turn); its counter is the ripostes left. A riposte
 * cannot miss, can crit and is never answered (`isMelee: false`).
 */
const handler: CustomHandler = {
  apply: (ctx, target, scale) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, untilTurnStart: true, counter: Math.max(1, ctx.line.amount ?? 1), data: { scale } })
    ctx.fx.log('stance', `${holder.name} reads the next blow`, { actorId: holder.id })
  },
  onDodge: (ctx, attacker) => {
    const hook = ctx.hook
    if (!hook || hook.counter <= 0 || !ctx.fx.isActive(attacker)) return
    hook.counter -= 1
    const type = ctx.line.damageType ?? ctx.holder.hero?.weapon.damageType ?? 'slash'
    const amount = roundHalfUp((ctx.fx.attackFor(ctx.holder, type) * (ctx.line.multiplier ?? 1) * Number(hook.data.scale ?? 100)) / 100)
    if (amount > 0) ctx.fx.strike(ctx.holder, attacker, { amount, damageType: type, label: 'riposte', canMiss: false, canCrit: true, isMelee: false })
    if (hook.counter <= 0) ctx.fx.removeHook(ctx.holder, hook)
  },
}
export default handler
