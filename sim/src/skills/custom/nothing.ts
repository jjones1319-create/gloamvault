import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). A curio outcome that does nothing (07 §2.4: Rat-King's Nest, "Burn →
 * 30% nothing"); the result card says so. Exists so the outcome's chance is spent on a line the linter can name.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
