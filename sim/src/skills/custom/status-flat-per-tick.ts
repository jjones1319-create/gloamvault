import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). Tar Pot (07 §2.5): "Burn 3 turns (6 + 2F per tick) on both front-row
 * heroes". The status lands at the start of the next fight on this floor (a pending status) on the line's `target`
 * with `duration`, at a fixed per-tick damage of `amount` + `multiplier` × floor. Reading: the status record ticks a
 * share of a hit (`magnitudeOf: hitDamage`, Burn 20%), so the magnitude handed to applyStatus is that flat × 100 /
 * the record's percent and the tick comes out at the docs' number; a `fixed` record takes the flat as is.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
