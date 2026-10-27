import type { CustomHandler } from './types.ts'

/**
 * Saboteur (Shade, Larceny III; docs/classes/shade.md §4.3): +`amount` Trap Disarm rank for checks. Resolved by
 * delve.ts where disarm checks run (03 §7.6): add the amount to the hero's effective rank for the check only, not to
 * the trained rank. Nothing a fight would call.
 */
export const DELVE_SIDE = true
const handler: CustomHandler = {}
export default handler
