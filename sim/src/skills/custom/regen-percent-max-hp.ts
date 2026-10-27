import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Regenerating (elite affix, 06 §2): the champion heals `percent` of its max HP at the start of each of its turns;
 * Burn or Bleed suppress the regen for `duration` turns. Installed on the champion at spawn (explore.ts); the
 * hook's counter is the suppressed turns left. Reading: the sim has no "status was applied to the holder" joint and
 * an attack's status lines land after its damage line, so the suppression is detected at the champion's turn start:
 * a turn it begins Burning or Bleeding costs that turn's regen and the next `duration` − 1 turns' too, and a later
 * turn that still finds it Burning or Bleeding arms the suppression again.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null })
  },
  onTurnStart: (ctx) => {
    const hook = ctx.hook
    const holder = ctx.holder
    if (!hook || holder.hp <= 0) return
    if (hook.counter > 0) {
      hook.counter -= 1
      ctx.fx.log('regenSuppressed', `${holder.name}'s wounds refuse to close`, { actorId: holder.id, data: { left: hook.counter } })
      return
    }
    if (ctx.fx.hasStatus(holder, 'burn') || ctx.fx.hasStatus(holder, 'bleed')) {
      hook.counter = Math.max(0, (ctx.line.duration ?? 2) - 1)
      ctx.fx.log('regenSuppressed', `${holder.name}'s wounds refuse to close`, { actorId: holder.id, data: { left: hook.counter } })
      return
    }
    const amount = roundHalfUp((holder.maxHp * (ctx.line.percent ?? 0)) / 100)
    if (amount <= 0) return
    const healed = ctx.fx.heal(holder, holder, amount)
    if (healed > 0) ctx.fx.log('regen', `${holder.name} knits ${healed} HP back together`, { actorId: holder.id, amount: healed })
  },
}
export default handler
