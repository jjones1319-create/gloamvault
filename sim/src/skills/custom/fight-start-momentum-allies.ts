import type { CustomHandler } from './types.ts'

/**
 * Dawn Vigil (Mender passive, Vigil IV; docs/classes/mender.md §4.3): every ally starts each fight with +`amount`
 * Momentum (10; Mastery 15). A passive line, installed as a hook by hero.ts; at the fight's start it gives every hero on
 * its side the Momentum (pets carry none, effects.ts gainMomentum), the Mender included.
 */
const handler: CustomHandler = {
  onFightStart: (ctx) => {
    const amount = ctx.line.amount ?? 0
    if (amount <= 0) return
    for (const ally of ctx.fx.alliesOf(ctx.holder)) if (ally.kind === 'hero') ctx.fx.gainMomentum(ally, amount)
    ctx.fx.log('dawnVigil', `${ctx.holder.name}'s vigil readies the party (+${amount} Momentum)`, { actorId: ctx.holder.id, amount })
  },
}
export default handler
