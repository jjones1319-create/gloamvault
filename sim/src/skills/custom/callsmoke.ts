import type { CustomHandler } from './types.ts'

/**
 * Callsmoke (D-148, Phase 17): a consumable whose `amount` is minutes of walking with random encounters twice as
 * often and no grace after a fight, on a laid-out floor. Resolved by delve.ts's `useItem` (the walk clock).
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
