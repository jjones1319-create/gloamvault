import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). Toll Shrine, "Pay 0.10 R" (07 §2.4): "+10% gold found for the rest of
 * this floor". Adds `percent` to `floor.goldPercentBonus`, which `finishFight` folds into the fight-gold knob with
 * the party's `gold-found-percent` lines; the floor's end clears it.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
