import type { CustomHandler } from './types.ts'

/**
 * Light Fingers (Shade, Larceny I; docs/classes/shade.md §4.3): a locked chest the holder opens rolls one grade up
 * `percent`% of the time (mastery 20%). Resolved by delve.ts when the opening hero holds the passive: after the
 * chest's grade roll, `percent`% of the time shift the grade one rung up (gradeShift, clamped). Nothing a fight calls.
 */
export const DELVE_SIDE = true
const handler: CustomHandler = {}
export default handler
