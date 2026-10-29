import type { CustomHandler } from './types.ts'

/**
 * Never Lost (Ranger, Pathfinder V; docs/classes/ranger.md §4.3): room entries tick the floor clock once per
 * `amount` entries (2 = half as often).
 * Stub (Tier V, locked until Segment 3; delve side, not yet wired): the joint is the room-entry clock tick in
 * sim/src/delve.ts (the move command): tick only on every `partyHookBest(…, 'floor-clock-per-rooms')`-th entry.
 * Logs `hookStub` once per fight so the balance runner counts it.
 */
export const STUB = true
export const DELVE_SIDE = true

const handler: CustomHandler = {
  onFightStart: (ctx) => {
    const key = `stub:floor-clock-per-rooms:${ctx.holder.id}`
    if (ctx.state.flags[key]) return
    ctx.state.flags[key] = true
    ctx.fx.log('hookStub', 'floor-clock-per-rooms: waits for a delve joint (room entries tick the floor clock once per amount rooms)', { actorId: ctx.holder.id })
  },
}
export default handler
