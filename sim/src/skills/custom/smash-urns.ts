import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). Funeral Urns, Smash all (07 §2.4): each of the urns (tuning
 * `floors.funeralUrns`) rolls on its own — gold (`goldR` of R) at `goldChance`, grave dust at `blindChance` (Blind
 * `blindDuration` on the smasher at the next fight), else a Tomb Spider egg hatches: an ambush by `summonId` (at most
 * one ambush, after every urn has been rolled).
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
