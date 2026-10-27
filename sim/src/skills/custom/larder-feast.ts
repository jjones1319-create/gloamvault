import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). Mouldering Larder with Cooking 2+ (07 §2.4): "100% Regen + 1
 * ingredient" — a composite: Regen on every hero at the start of the next 2 fights on this floor (a pending status,
 * as `status-next-fights` with amount 2) and one Cooking ingredient (as `cooking-ingredient`).
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
