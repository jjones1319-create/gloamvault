import type { CustomHandler } from './types.ts'

/**
 * Quick Hands (Ranger, Trapper I; docs/classes/ranger.md §4.2): adds `amount` to the Trap Disarm rank for checks.
 * Resolved by delve.ts (not yet wired). Nothing a fight would call.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
