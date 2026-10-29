import type { CustomHandler } from './types.ts'

/**
 * Phantom Thief, Mastery (Shade, Larceny V; docs/classes/shade.md §4.3): the holder's Skeleton Keys are never used up.
 * Stub (Tier V, locked until Segment 3; delve side, not yet wired): the joint is sim/src/delve.ts's openChest with
 * `useKey`: keep the key when the opener holds this line.
 * Logs `hookStub` once per fight so the balance runner counts it.
 */
export const STUB = true
export const DELVE_SIDE = true

const handler: CustomHandler = {
  onFightStart: (ctx) => {
    const key = `stub:keys-never-consumed:${ctx.holder.id}`
    if (ctx.state.flags[key]) return
    ctx.state.flags[key] = true
    ctx.fx.log('hookStub', 'keys-never-consumed: waits for a delve joint (Skeleton Keys are never used up)', { actorId: ctx.holder.id })
  },
}
export default handler
