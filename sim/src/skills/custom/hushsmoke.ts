import type { CustomHandler } from './types.ts'

/**
 * Hushsmoke (D-142, Phase 17): a consumable whose `amount` is minutes of walking without random encounters on a
 * laid-out floor, burning twice as fast in the Dark and Pitch bands. Resolved by delve.ts's `useItem` directly
 * (the walk clock, `FloorRun.walk.smoke`), so the handler has nothing to do in a fight.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
