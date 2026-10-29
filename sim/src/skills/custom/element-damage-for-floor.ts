import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). A floor-long damage blessing (07 §2.4 Bone Reliquary, §2.6 Ossuary
 * Shrine's Vigil: "+15% Holy damage"): a pending entry of kind 'hook' that installs `element-damage-percent`
 * (`damageType`, `percent`) on the line's target heroes at each fight's start until the floor ends.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
