import type { CustomHandler } from './types.ts'

/**
 * Vault Cracker, corridor use (Shade, Larceny V; docs/classes/shade.md §4.3): open any locked door or chest with no
 * check and no trap. The skill's combat half is `ignore-defense-vs-armored` and its damage line.
 * Stub (Tier V, locked until Segment 3; delve side, not yet wired): the joint is the corridor skill use (pass D's
 * corridor skills) opening the room's locked chests and door (sim/src/delve.ts openChest / the Key-and-Lock door) as a
 * Skeleton Key does, without spending one. In a fight the line does nothing.
 * Logs `hookStub` once per fight so the balance runner counts it.
 */
export const STUB = true
export const DELVE_SIDE = true

const handler: CustomHandler = {
  apply: (ctx) => {
    const key = 'stub:corridor-open-locks'
    if (ctx.state.flags[key]) return
    ctx.state.flags[key] = true
    ctx.fx.log('hookStub', 'corridor-open-locks: waits for a delve joint (any locked door or chest opens with no check and no trap)', { actorId: ctx.holder.id })
  },
}
export default handler
