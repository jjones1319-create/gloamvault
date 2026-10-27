import type { CustomHandler } from './types.ts'

/**
 * Cave Owl's trait (06 §9): `amount` percentage points added to the party's scouting chance. Resolved by explore.ts
 * from the trait line when it rolls scouting; nothing to do inside a fight.
 */
export const DELVE_SIDE = true
const handler: CustomHandler = {}
export default handler
