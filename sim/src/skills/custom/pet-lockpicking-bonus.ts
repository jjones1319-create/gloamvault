import type { CustomHandler } from './types.ts'

/**
 * Vault Imp's trait (06 §9), second line: the party's best Lockpicking effective rank +`amount` (may exceed 10).
 * Resolved by delve.ts when a lock is tried; nothing to do inside a fight.
 */
export const DELVE_SIDE = true
const handler: CustomHandler = {}
export default handler
