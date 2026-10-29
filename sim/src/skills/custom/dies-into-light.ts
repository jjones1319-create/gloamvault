import type { CustomHandler } from './types.ts'

/**
 * Vault Lantern (06 §3.3): "dies into +5 light (a reward for killing it)". A passive trigger (a zero-weight attack,
 * armed at spawn): when it dies the fight's light rises by `amount` (FightState.light, the band the monsters' Accuracy
 * and Damage read, 03 §4.2). Reading: the fight's light is the room's for as long as the fight lasts; the delve keeps
 * its own meter (delve.ts), so the reward lights this fight.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const who = target ?? ctx.holder
    if (who.side !== ctx.holder.side || !who.monster) return
    ctx.fx.installHook(who, ctx.line, who.id, { sourceSkillId: ctx.sourceId })
  },
  onDeath: (ctx) => {
    const amount = ctx.line.amount ?? 5
    ctx.state.light = Math.max(0, Math.min(ctx.t.exploration.light.max, ctx.state.light + amount))
    ctx.fx.log('light', `${ctx.holder.name} gutters out in a last bright flare (light ${amount > 0 ? '+' : ''}${amount})`, { actorId: ctx.holder.id, amount })
  },
}
export default handler
