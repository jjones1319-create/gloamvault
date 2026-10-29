import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine` → `giveTome`). A curio's Tome (07 §2.4: the Embalmer's Table's "a Tier II
 * Tome", the Priestess's Hymnal's "a Tier II–III Tome"): one hero of the party learns a Tier `amount` skill of
 * their class from a fresh Tome bag; a duplicate is rank XP (03 §8). The Hymnal's two tiers are two outcomes.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
