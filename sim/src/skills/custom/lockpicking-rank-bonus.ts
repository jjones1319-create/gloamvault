import type { CustomHandler } from './types.ts'

/**
 * Light Fingers (Shade, Larceny I; docs/classes/shade.md §4.3): +`amount` Lockpicking rank for checks, on top of the
 * class affinity (mastery +4). Resolved by delve.ts where lockpicking checks run (03 §7.6): add the amount to the
 * hero's effective rank for the check only, not to the trained rank. Nothing a fight would call.
 */
export const DELVE_SIDE = true
const handler: CustomHandler = {}
export default handler
