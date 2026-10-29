import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). The Tide Gate (07 §2.5): "the room floods over 3 ticks: the fight here (if any)
 * is fought wading at −10 Speed and −10 Accuracy for everyone, both sides". A pending entry of kind 'modifier' for
 * the next fight (the trap stands only in fight rooms, `placement`): `amount` Speed and Accuracy on every actor of
 * both sides. A drained sluice (`drain-sluice`) spends itself instead.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
