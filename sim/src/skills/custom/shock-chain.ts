import type { CustomHandler } from './types.ts'

/** Shock (03 §3.5): half of a hit on the holder chains to one other enemy of the attacker (the line's percent). */
const handler: CustomHandler = {
  afterHit: (ctx, incoming, dealt) => {
    if (incoming.isDot || dealt <= 0) return
    const others = ctx.state.actors.filter((a) => a.side === ctx.holder.side && a !== ctx.holder && !a.gone && !a.downed && !a.fallen && a.hp > 0)
    if (others.length === 0) return
    const target = ctx.rng.pick(others)
    const chained = Math.max(1, Math.floor((dealt * (ctx.line.percent ?? 50)) / 100))
    target.hp = Math.max(0, target.hp - chained)
    target.tally.damageTaken += chained
    ctx.state.log.push({ tick: ctx.state.tick, round: ctx.state.round, kind: 'chain', actorId: ctx.holder.id, targetId: target.id, amount: chained, text: `Shock chains ${chained} to ${target.name}` })
  },
}
export default handler
