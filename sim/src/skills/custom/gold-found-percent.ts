import type { CustomHandler } from './types.ts'

/**
 * of Greed (08 §5): "+gold found 3–5% / 5–10% / 10–15%". Resolved by delve.ts: `finishFight` sums the worn
 * `gold-found-percent` lines of every active hero (items.ts `effectiveItemStats`, so a broken item gives nothing)
 * with the floor's `goldPercentBonus` and folds the sum into the fight-gold knob. Reading: "gold found" is fight
 * gold; piles, chests and curio purses are flat amounts the docs write in R and are left alone. The rolled value
 * arrives as `percent`.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
