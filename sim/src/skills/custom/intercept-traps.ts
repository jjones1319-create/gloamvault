import type { CustomHandler } from './types.ts'

/**
 * Intercept, Mastery (Warden, Bulwark II; docs/classes/warden.md §4.1): for `duration` turns corridor traps that trigger
 * on the covered ally fire on the Warden instead.
 * Resolved by delve.ts (not yet wired). Nothing a fight would call.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
