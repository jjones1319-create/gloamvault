import type { CustomHandler } from './types.ts'

/**
 * Scout Ahead, corridor use (Ranger, Pathfinder III; docs/classes/ranger.md §4.3): reveals every adjacent room and the
 * room beyond each, as a critical scout does (03 §4.3).
 * Resolved by delve.ts (not yet wired). Nothing a fight would call.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
