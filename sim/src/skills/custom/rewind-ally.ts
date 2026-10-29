import type { CustomHandler } from './types.ts'

/**
 * Rewind (Arcanist, Arcana V; docs/classes/arcanist.md §4.3): the ally's HP, pool and statuses return to what they
 * were at the start of that ally's previous turn (Mastery `amount` 1: Momentum too); it cannot revive.
 * Stub: the fight keeps no history of an actor's turn starts — the joint is a snapshot taken in fight.ts `takeTurn`
 * (HP, pool, statuses, Momentum) that this hook could read and restore; the log cannot rebuild statuses faithfully.
 * Tier V is designed in JSON and locked until Segment 3's endgame (D-099), so nothing can cast it yet. Logs
 * `hookStub` once per fight.
 */
export const STUB = true

const handler: CustomHandler = {
  apply: (ctx) => {
    const key = 'stub:rewind-ally'
    if (ctx.state.flags[key]) return
    ctx.state.flags[key] = true
    ctx.fx.log('hookStub', 'rewind-ally: the fight keeps no turn-start snapshot to rewind to', { actorId: ctx.holder.id })
  },
}
export default handler
