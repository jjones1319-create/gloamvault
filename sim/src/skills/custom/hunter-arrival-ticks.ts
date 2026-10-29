import type { CustomHandler } from './types.ts'

/**
 * Wayfinder (Ranger, Pathfinder IV; docs/classes/ranger.md §4.3): the floor's hunter arrives at `amount` floor-clock
 * ticks instead of the standard 40 (Mastery 60). Read by sim/src/delve.ts (`hunterDelay`): the best hero's line less
 * the standard threshold (`exploration.floorClock.hunterEntersAt`) is added to the floor's own clock — the Twin
 * Hunter's too — so a preset's earlier hunter stays earlier (Hard 32 → 42). Nothing to do inside a fight.
 */
const handler: CustomHandler = {}
export default handler
