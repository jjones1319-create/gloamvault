import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). Toll Shrine, "Deface" (07 §2.4): "Curse for the rest of the floor". A
 * pending status with no fight count: applied to the line's `target` at the start of every fight on this floor
 * (`duration` when given, else the record's default) and dropped when the next floor begins. A secret's blessing
 * (Hearth Shrine: Regen every fight this floor) uses the same entry.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
