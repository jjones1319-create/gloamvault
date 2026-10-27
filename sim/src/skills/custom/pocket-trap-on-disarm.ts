import type { CustomHandler } from './types.ts'

/**
 * Saboteur (Shade, Larceny III; docs/classes/shade.md §4.3): every successful disarm by the holder pockets the trap
 * (Trap Trick's pocket, up to its hold). Resolved by delve.ts after a successful disarm check: add one to the
 * hero's pocket, capped at Trap Trick's `amount`; the pocket is seeded into each fight as
 * `flags['pocketedTraps:<heroId>']` and read back after it. Nothing a fight would call.
 */
export const DELVE_SIDE = true
const handler: CustomHandler = {}
export default handler
