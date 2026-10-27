import type { CustomHandler } from './types.ts'

/**
 * Forager's Instinct (Ranger, Pathfinder II; docs/classes/ranger.md §4.3): `percent` of the arrows spent in a fight return
 * to the quiver after it.
 * Resolved by delve.ts (not yet wired). Nothing a fight would call.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
