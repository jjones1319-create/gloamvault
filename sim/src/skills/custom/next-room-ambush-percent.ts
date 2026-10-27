import type { CustomHandler } from './types.ts'

/**
 * Trailblaze, corridor use (Ranger, Pathfinder I; docs/classes/ranger.md §4.3): the next room's ambush roll is shifted
 * by `percent` (03 §4.4).
 * Resolved by delve.ts (not yet wired). Nothing a fight would call.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
