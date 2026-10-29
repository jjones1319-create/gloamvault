import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). A Small chest is set in the room (07 §2.4: the Grave Bell muffled with a
 * Cloth unit, "a Small chest, no clock cost"), unlocked and untrapped; with `amount` the floor clock runs on that
 * many ticks first.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
