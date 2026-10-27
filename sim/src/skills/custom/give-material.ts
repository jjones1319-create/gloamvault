import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). Rat-King's Nest (07 §2.4): "3 Rawhide", and with Foraging 3+ "3 Rawhide
 * + a rare part roll at 20%". Gives `amount` units of `itemId` to the party's materials; without an `itemId` the
 * zone's family common material (the first monster of the zone's `parts.common.materialId`), else the first F
 * material. `percent` is an extra rare-part roll at that chance (`roll-rare-part`).
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
