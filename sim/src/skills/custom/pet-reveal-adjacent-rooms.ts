import type { CustomHandler } from './types.ts'

/**
 * Cave Owl's Far Sight (pet active, 06 §9): out of combat, on entering a room, reveals every room adjacent to it on
 * the floor map; `amount` uses per floor. Resolved by delve.ts (the skill's target is `room`); nothing to do inside
 * a fight.
 */
export const DELVE_SIDE = true
const handler: CustomHandler = {}
export default handler
