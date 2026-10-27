import type { CustomHandler } from './types.ts'

/** Ambush Sense (Ranger, Pathfinder III; docs/classes/ranger.md §4.3): when the party surprises the monsters, every ally gains `amount` Momentum at the fight's start. */
const handler: CustomHandler = {
  onFightStart: (ctx) => {
    if (ctx.state.surprised !== 'enemy') return
    for (const ally of ctx.fx.alliesOf(ctx.holder)) ctx.fx.gainMomentum(ally, ctx.line.amount ?? 0)
    ctx.fx.log('momentum', `${ctx.holder.name}'s party strikes from ambush`, { actorId: ctx.holder.id, amount: ctx.line.amount ?? 0 })
  },
}
export default handler
