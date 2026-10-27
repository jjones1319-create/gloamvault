import type { CustomHandler } from './types.ts'

/**
 * Breaker's Arc, corridor use (Blade, Executioner III; docs/classes/blade.md §4.2): +`amount` to the Strength check when
 * forcing a door or chest.
 * Resolved by delve.ts (not yet wired). Nothing a fight would call.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
