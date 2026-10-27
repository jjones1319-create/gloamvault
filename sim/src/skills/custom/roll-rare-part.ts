import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). Rat-King's Nest, "Burn" (07 §2.4): "one rare part of the family". With
 * `percent` chance (default 100) one rare part drawn from the current zone's family — the `parts.rare.itemId` of its
 * monsters, deduplicated, in id order — goes to the party's materials, as fight parts do.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
