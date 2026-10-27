import type { CustomHandler } from './types.ts'

/**
 * Double Time, corridor use (Ranger, Pathfinder II; docs/classes/ranger.md §4.3): the next `amount` room entries cost
 * one floor-clock tick in all.
 * Resolved by delve.ts (not yet wired). Nothing a fight would call.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
