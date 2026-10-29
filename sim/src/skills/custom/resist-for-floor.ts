import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). A floor-long immunity (07 §2.4: the Priestess's Hymnal's "Silence immunity
 * this floor for the reader", the Bone Reliquary's and the Ossuary Shrine's Fear immunity): a pending entry of kind
 * 'resist' that installs `status-resist-bonus` (`status`, `percent`, default 100) at each fight's start on the
 * line's target (no target: the victim hero; allAllies: every hero). Reading: a 100% resist roll is the immunity
 * statuses.ts can honour (as toll-shrine-cleanse).
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
