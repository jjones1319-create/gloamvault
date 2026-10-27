import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine` → `tickClock`). Tripwire Bell (07 §2.5): "the floor clock +4". Adds
 * `amount` ticks to the floor clock, which may bring the hunter in or move it.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
