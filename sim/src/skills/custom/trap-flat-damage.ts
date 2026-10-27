import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine` → `hurtHero`). Spring Spikes (07 §2.5): "Pierce 12 + 4F to the opener".
 * `amount` + `multiplier` × the floor number, scaled by the firing percent (a fumbled disarm fires at 50), taken
 * from the victim's HP out of combat; the damage type is for the card. A Skeleton Key opens the chest safely.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
