import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). Tripwire Bell (07 §2.5): "the next fight on this floor is an ambush
 * (+30% surprise)". Raises the `ruleFlags` 'next-fight-ambush' flag and records `percent` on the floor
 * (`floor.ambushPercent`); `startFight` adds it to the party's surprise roll once and clears both.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
