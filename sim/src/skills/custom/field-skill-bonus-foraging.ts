import type { CustomHandler } from './types.ts'

/**
 * Forager's Instinct (Ranger, Pathfinder II; docs/classes/ranger.md §4.3): adds `amount` to the Foraging rank for
 * checks.
 * Resolved by delve.ts (not yet wired). Nothing a fight would call.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
