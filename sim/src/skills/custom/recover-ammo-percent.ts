import type { CustomHandler } from './types.ts'

/**
 * Forager's Instinct (Ranger, Pathfinder II; docs/classes/ranger.md §4.3): `percent` of the arrows spent in a fight return
 * to the quiver after it. The passive rides on the hero as a hook; the delve reads it when it folds the fight's count
 * back into the quiver (sim/src/ammo.ts `quiverAfterFight`). Nothing a fight would call.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
