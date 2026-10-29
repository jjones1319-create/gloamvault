import type { CustomHandler } from './types.ts'

/**
 * Phantom Thief (Shade, Larceny V; docs/classes/shade.md §4.3): locked chests open without a check and their traps are
 * disarmed; in-dungeon chests roll a grade up `percent`% as often (200 = twice) for the holder. (Its Fortune cap is
 * `fortune-cap-raise`.)
 * Stub (Tier V, locked until Segment 3; delve side, not yet wired): the joints are sim/src/delve.ts's openChest
 * (skip the Lockpicking roll and the trap when the opener holds this line) and loot.ts `openDungeonChest`'s grade-up
 * chance (× `percent` / 100), as Light Fingers' `locked-chest-grade-up-chance` would be read.
 * Logs `hookStub` once per fight so the balance runner counts it.
 */
export const STUB = true
export const DELVE_SIDE = true

const handler: CustomHandler = {
  onFightStart: (ctx) => {
    const key = `stub:phantom-thief-chests:${ctx.holder.id}`
    if (ctx.state.flags[key]) return
    ctx.state.flags[key] = true
    ctx.fx.log('hookStub', 'phantom-thief-chests: waits for a delve joint (locked chests open with no check, their traps disarmed; chests roll a grade up twice as often)', { actorId: ctx.holder.id })
  },
}
export default handler
