import type { CustomHandler } from './types.ts'

/**
 * Forager's Instinct (Ranger, Pathfinder II; docs/classes/ranger.md §4.3): each rest room yields `amount` more
 * ingredients.
 * Resolved by delve.ts (not yet wired). Nothing a fight would call.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
