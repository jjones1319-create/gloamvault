import type { CustomHandler } from './types.ts'

/**
 * Crypt Bat's and the Wisp's traits (06 §9): the pet's own rolls (Crypt Bat, target self) or the party's scouting
 * roll (Wisp, target allAllies) read the light band `amount` steps brighter (−1 = one band brighter, as the species
 * `lightBandShift`); ambush, aim and loot stay at the true band. Resolved by explore.ts from the trait line when it
 * rolls scouting; inside a fight pets take no light penalty to begin with (effects.ts accuracyOf), so nothing to do.
 */
export const DELVE_SIDE = true
const handler: CustomHandler = {}
export default handler
