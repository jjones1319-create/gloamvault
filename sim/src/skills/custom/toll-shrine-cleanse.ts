import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). Toll Shrine cleansed with Holy Water (07 §2.4): "+10 light and Fear
 * immunity this floor" — a composite: `amount` light now, and a floor-long pending entry of kind 'resist' that
 * installs a `status-resist-bonus` hook (`status` = fear, 100%) on every hero at the start of each fight this
 * floor. Reading: the sim has no immunity joint; a 100% resist roll is the immunity statuses.ts can honour.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
