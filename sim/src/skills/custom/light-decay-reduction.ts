import type { CustomHandler } from './types.ts'

/**
 * The party's Light falls `amount` less per new room. Carried by Attune (Arcanist, Arcana I; arcanist.md §4.3),
 * Vigil Lantern (Mender) and the "of Embers" affix (content/affixes/of-embers.json, `target: room`, the rolled affix
 * value is the amount). Resolved by delve.ts where Light falls per room (03 §4.2): sum the amounts over the party's
 * passives and equipped affixes and subtract from the room's Light step, never below 0. Nothing a fight would call.
 */
export const DELVE_SIDE = true
const handler: CustomHandler = {}
export default handler
