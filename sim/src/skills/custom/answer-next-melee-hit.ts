import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Riposte (Captain Vexa Marrow, 06 §3.1, phase 2): the attack's own blow is its DSL damage line; this rider arms
 * her to "answer the next melee hit on her, once per 2 turns". The line installs a hook on the holder whose
 * `counter` is the cooldown: `afterHit` on a melee hit strikes the attacker back for the owning attack's multiplier
 * of her Attack (its damage type), sets the counter to 2, and the counter falls by one at each of her turn starts.
 * The answer never answers an answer (`isMelee: false`), and a broken grin-mask (`state.flags['noRiposte:<id>']`)
 * silences it.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const who = ctx.holder
    if (ctx.state.flags[`noRiposte:${who.id}`]) {
      ctx.fx.log('riposte', `${who.name} tries to set a riposte, but the mask is gone`, { actorId: who.id })
      return
    }
    ctx.fx.installHook(who, ctx.line, who.id, { sourceSkillId: ctx.sourceId, counter: 0 })
    ctx.fx.log('riposte', `${who.name} sets her blade to answer`, { actorId: who.id })
  },
  afterHit: (ctx, incoming) => {
    const hook = ctx.hook
    const attacker = incoming.attacker
    if (!hook || hook.counter > 0 || !incoming.isMelee || !attacker || !ctx.fx.isActive(attacker)) return
    if (ctx.state.flags[`noRiposte:${ctx.holder.id}`]) return
    const attack = ctx.holder.monster?.attacks.find((a) => a.id === hook.sourceSkillId)
    const type = attack?.damageType ?? ctx.line.damageType ?? 'slash'
    const amount = roundHalfUp(ctx.fx.attackFor(ctx.holder, type) * (ctx.line.multiplier ?? attack?.multiplier ?? 1))
    ctx.fx.strike(ctx.holder, attacker, { amount, damageType: type, label: attack?.name ?? 'riposte', canMiss: false, canCrit: true, isMelee: false })
    hook.counter = 2
  },
  onTurnStart: (ctx) => {
    const hook = ctx.hook
    if (hook && hook.counter > 0) hook.counter -= 1
  },
}
export default handler
