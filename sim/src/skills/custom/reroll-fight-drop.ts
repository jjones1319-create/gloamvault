import type { CustomHandler } from './types.ts'

/**
 * The Hollow Coin (08 §3): "Re-roll this fight's item drop (after the fight) · once per floor". Resolved by the delve,
 * not the fight: after a won fight that dropped a gear item, the hero wearing the Coin may re-roll it once per floor
 * (sim/src/relics.ts `hollowCoinOffer` / `rerollFightDrop`, the delve command `relic`). Nothing a fight would call.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
