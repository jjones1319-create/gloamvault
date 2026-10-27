import type { CustomHandler } from './types.ts'

/**
 * Repair Kit (08 §4): "+25% durability to one item, out of combat". Resolved by delve.ts (`useItem` →
 * `resolveDelveLine`): `percent` points of durability through items.ts `repairItemPoints` onto the user's most worn
 * equipped item (never above maxDurability). Reading: the command names no item, so the worst one is chosen.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
