import type { CustomHandler } from './types.ts'

/**
 * Every Marksman and Trapper shot (Ranger; docs/classes/ranger.md §4): the action spends `amount` arrows or bolts from
 * the quiver (Volley 3). Ammo is not modelled in fights yet: the delve owns the quiver and the empty-quiver rule.
 * Resolved by delve.ts (not yet wired). Nothing a fight would call.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
