import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). The Warden's Ledger (07 §2.4): "an Insight roll at ×3 for the reader". The
 * reader (the curio's victim) rolls once for a skill of their class at the lowest tier they have not completed, at
 * `multiplier` × the Insight chance against the floor's monster level (insight.ts), their pity counted as for a use;
 * a hit teaches the skill from a fresh Tome bag. Reading: 03 §7.5's Insight follows a meaningful use of a school's
 * skill; the Ledger's roll has no school, so it draws the class's bag.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
