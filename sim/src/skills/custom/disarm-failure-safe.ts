import type { CustomHandler } from './types.ts'

/**
 * Saboteur mastery (Shade, Larceny III; docs/classes/shade.md §4.3): a failed disarm by the holder never triggers
 * the trap on the holder. Resolved by delve.ts (trap disarm checks are out of combat): when the disarming hero
 * holds this passive, a failed check costs the roll but fires no trap effect on that hero. Nothing a fight would call.
 */
export const DELVE_SIDE = true
const handler: CustomHandler = {}
export default handler
