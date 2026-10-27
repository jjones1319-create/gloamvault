import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). Mouldering Larder (07 §2.4): "+1 Cooking ingredient". Gives `amount`
 * (default 1) of `itemId` when the line names one, else one ingredient drawn from the consumables whose effects
 * carry a `meal` line (herb, mushroom, meat, fish, salt), to the first hero's bag.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
