import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`, `enterRoom`). Mourner's Candles lit (07 §2.4): "+20 light and no ambushes for
 * the next 4 rooms" — the light is the outcome's own line; this one sets `FloorRun.quietRooms` to `amount`. Each new
 * room entered while it lasts spends one and its fight cannot surprise the party (the party can still surprise the
 * monsters).
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
