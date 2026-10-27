import type { CustomHandler } from './types.ts'

/**
 * Attune (Arcanist, Arcana I; docs/classes/arcanist.md §4.3): items the party picks up are identified at once.
 * Resolved by delve.ts (loot and pickup are out of combat): while any hero in the party holds this passive, an item
 * entering the bag is marked identified. Nothing a fight would call.
 */
export const DELVE_SIDE = true
const handler: CustomHandler = {}
export default handler
