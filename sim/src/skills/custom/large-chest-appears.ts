import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). A chest is set in the room (07 §2.4: the Grave Bell's "a Large chest
 * appears here", the Drowned Chest hauled out): a Large chest, unlocked and untrapped, opened like any other; with
 * `amount` the floor clock runs on that many ticks first (the Grave Bell: +20, "the Hound hears").
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
