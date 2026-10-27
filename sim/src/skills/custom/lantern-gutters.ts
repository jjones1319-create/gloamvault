import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine` → `startFight` with an ambush spec). Lost Lantern (07 §2.4): "it gutters:
 * −10 light and a Cellar Spider ambush". Adds `amount` (−10) light, then an ambush of `summonId` × `amount`-less
 * default (an encounter of the floor holding the monster, else three of it) with the party surprised.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
