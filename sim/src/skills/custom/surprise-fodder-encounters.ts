import type { CustomHandler } from './types.ts'

/**
 * Never Lost, Mastery (Ranger, Pathfinder V; docs/classes/ranger.md §4.3): the party always surprises an encounter of
 * fodder only.
 * Stub (Tier V, locked until Segment 3; delve side, not yet wired): the joint is the surprise roll in sim/src/delve.ts's
 * fight start: when a hero holds this line and every monster's role is fodder, `surprised = 'enemy'`.
 * Logs `hookStub` once per fight so the balance runner counts it.
 */
export const STUB = true
export const DELVE_SIDE = true

const handler: CustomHandler = {
  onFightStart: (ctx) => {
    const key = `stub:surprise-fodder-encounters:${ctx.holder.id}`
    if (ctx.state.flags[key]) return
    ctx.state.flags[key] = true
    ctx.fx.log('hookStub', 'surprise-fodder-encounters: waits for a delve joint (the party always surprises fodder-only encounters)', { actorId: ctx.holder.id })
  },
}
export default handler
