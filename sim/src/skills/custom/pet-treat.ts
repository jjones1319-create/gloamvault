import type { CustomHandler } from './types.ts'

/**
 * Pet Treat (08 §4): "+10% pet XP this delve (once per delve); +5% bond progress". Resolved by delve.ts: using it
 * (`useItem`, or the `rest` command's `treat`) marks the hero's `treatUsed`, which progress.ts reads as
 * `pets.treat.xpPercent` more pet XP for the delve; a second treat in the same delve is refused. Reading: bond
 * progress has no field yet (`PetInstance.bondStars` counts whole stars), so the +5% waits for it.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
