import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). Hanging Cage (07 §2.4): "he draws the floor map (all rooms revealed)".
 * Marks every room of the floor `scouted`, so the map shows its kind; secret doors stay hidden (a map is not
 * Detection). A secret's `revealsFloor` does the same.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
