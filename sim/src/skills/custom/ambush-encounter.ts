import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine` → `startFight` with an ambush spec). A curio outcome or a trap that says
 * "ambush" (07 §2.4: "a fight that begins with the party surprised"): the party is surprised for certain. With
 * `summonId` and `amount`, that monster × amount (the count party-scaled like any pack, 03 §11.2); with `summonId`
 * alone, an encounter of the floor's tables that contains the monster, else the monster × 3 (an ordinary pack);
 * with neither, the floor's table. Fired as a trap (Rat Cage Drop) or a curio (Sealed Cask, Dice Table, Nest,
 * Hanging Cage, Gallows Beam) in the current room; the Dice Table's stake is its `gold` requirement.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
