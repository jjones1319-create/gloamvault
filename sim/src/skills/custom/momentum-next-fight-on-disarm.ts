import type { CustomHandler } from './types.ts'

/**
 * Quick Hands (Ranger, Trapper I; docs/classes/ranger.md §4.2): a corridor disarm banks `amount` Momentum for the start
 * of the next fight (the delve grants it when it builds the fight).
 * Resolved by delve.ts (not yet wired). Nothing a fight would call.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
