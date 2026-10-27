import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). A curio pays "a Fine (D) item" or "Boots (E grade)" (07 §2.4): `amount`
 * is the grade's rung (F 0 · E 1 · D 2 · …), the item a gear piece of that grade through loot.ts `pickGearItem`
 * with affixes rolled, onto the shared pile. Reading: when the designer's note names a slot ("Boots") the pick is
 * filtered to it first and relaxed only when nothing fits — the schema has no slot field for this line.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
