import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Pickpocket and Mug (Shade, Larceny I / III; docs/classes/shade.md §4.3): steals gold = `amount` × the target's
 * level, once per enemy per fight; a steal over the room's gold cap pays the cap. Reading: the party's gold and the
 * room's cap live in the delve, and `counters.goldStolen` is the Cutpurse's take *from* the party, so the steal is a
 * `goldStolenByHero` log event (amount) plus a running total in `flags['goldStolenByHeroes']`; delve.ts adds the
 * total to the fight's gold, capped at the room's cap. The cast's rank scaling applies to the amount.
 */
const handler: CustomHandler = {
  apply: (ctx, target, scale) => {
    if (!target || target.side === ctx.holder.side) return
    const key = `goldStolen:${target.id}`
    if (ctx.state.flags[key]) return
    const gold = roundHalfUp(((ctx.line.amount ?? 0) * Math.max(1, target.level) * scale) / 100)
    if (gold <= 0) return
    ctx.state.flags[key] = true
    ctx.state.flags['goldStolenByHeroes'] = Number(ctx.state.flags['goldStolenByHeroes'] ?? 0) + gold
    ctx.fx.log('goldStolenByHero', `${ctx.holder.name} lifts ${gold} gold from ${target.name}`, { actorId: ctx.holder.id, targetId: target.id, amount: gold })
  },
}
export default handler
