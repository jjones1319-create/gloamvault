import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). Hanging Cage (07 §2.4): "he gives a Tier I Tome" — "a Tier I Tome of a
 * party class, bag draw". One active hero is drawn; the Tier I bag of their class (chests.ts `buildTomeBag`: the
 * skills of that tier they do not know) gives one skill, learned at rank 1. An empty bag is a duplicate Tome
 * (03 §8: "Tome → rank XP"): one known skill of the hero gains 10 XP. Reading: the bag is built fresh, not kept.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
