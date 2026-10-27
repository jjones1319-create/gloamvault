import type { CustomHandler } from './types.ts'

/**
 * Keen Eyes (Ranger, Pathfinder I; docs/classes/ranger.md §4.3): the room-entry scouting roll (03 §4.3) +`percent`.
 * Resolved by delve.ts (not yet wired). Nothing a fight would call.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
