import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). The Tidebound Confession read (07 §2.6): "reading it before her chapel
 * (F7) marks Naesa's tell on screen and she opens the fight at −10% HP". Sets the delve's rule flag
 * 'tidebound-confession' for the rest of the delve; Sister Naesa's arena (pass C2, arena.ts) reads it at her fight's
 * start.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
