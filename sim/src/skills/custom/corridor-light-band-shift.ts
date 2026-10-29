import type { CustomHandler } from './types.ts'

/**
 * Nightwalker, corridor use (Ranger, Pathfinder V; docs/classes/ranger.md §4.3): for the rest of the floor (`duration`
 * 1; Mastery 99 = the whole delve) the party reads Light `amount` band brighter and monsters get no Dark-band bonuses.
 * The skill's combat half (Blind 2 on every enemy) is a plain status line.
 * Stub (Tier V, locked until Segment 3; delve side, not yet wired): the joint is the corridor skill use (pass D's
 * corridor skills) setting a floor flag the delve's `lightBand` reads, as a Dwarf's darkvision shift does
 * (`darkvisionShift` in sim/src/delve.ts). In a fight the line does nothing.
 * Logs `hookStub` once per fight so the balance runner counts it.
 */
export const STUB = true
export const DELVE_SIDE = true

const handler: CustomHandler = {
  apply: (ctx) => {
    const key = 'stub:corridor-light-band-shift'
    if (ctx.state.flags[key]) return
    ctx.state.flags[key] = true
    ctx.fx.log('hookStub', 'corridor-light-band-shift: waits for a delve joint (the party reads Light amount band brighter)', { actorId: ctx.holder.id })
  },
}
export default handler
