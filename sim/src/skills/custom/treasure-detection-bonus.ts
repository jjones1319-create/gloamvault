import type { CustomHandler } from './types.ts'

/**
 * Treasure Sense (Shade, Larceny IV; docs/classes/shade.md §4.3): Detection +`amount` (4; Mastery 6) for secrets and
 * hidden treasure only — not for traps. Read by sim/src/delve.ts: the best hero's line is added to the party's best
 * Detection for the secret-door check and the treasure room's hidden find (as a pet's +5 Detection is added). Its other
 * half, +10% gold, is the delve-read `gold-found-percent` line. Nothing to do inside a fight.
 */
const handler: CustomHandler = {}
export default handler
