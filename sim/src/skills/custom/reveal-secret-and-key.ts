import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). The Warden's Ledger (07 §2.4): "the floor's secret door and Key are marked
 * on the minimap" — the secret room's door is revealed in its host room and the secret room scouted, and the Key's
 * room scouted; a floor with neither is told so.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
