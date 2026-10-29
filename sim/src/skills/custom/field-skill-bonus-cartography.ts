import type { CustomHandler } from './types.ts'

/**
 * Wayfinder (Ranger, Pathfinder IV; docs/classes/ranger.md §4.3): adds `amount` to the holder's Cartography rank for
 * its checks. Read by sim/src/delve.ts (`fieldRankOf`): the minimap's reveal (`cartographyReveal`, 09 §5: one ring of
 * rooms per 3 ranks; the stairs at rank 10) and the traps a Cartography rank reveals (07 §2.5: Greased Stairs 2+,
 * Coffin Catapult 3+). Nothing to do inside a fight.
 */
const handler: CustomHandler = {}
export default handler
