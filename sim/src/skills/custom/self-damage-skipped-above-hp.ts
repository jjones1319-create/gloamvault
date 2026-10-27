import type { CustomHandler } from './types.ts'

/**
 * Reckless Swing, Mastery (Blade, Bloodletter I; docs/classes/blade.md §4.3): the skill's self-damage line is skipped
 * while the holder is above `percent`% HP. Resolved by `damage-percent-max-hp`, which reads this line from the
 * owning skill's Mastery at rank 10 before it bleeds the holder (the Mastery line resolves after the self-damage
 * line, too late to skip it from here). Nothing to do when this line itself resolves.
 */
const handler: CustomHandler = {}
export default handler
