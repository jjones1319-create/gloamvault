import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). "Regen at the start of the next 2 fights" (Mouldering Larder), "Fortify
 * in the next fight" (Toll Shrine), "Slowed for the first 2 turns of the next floor's first fight" (Greased Stairs;
 * 07 §2.4–§2.5). Pushes `{status, target, duration, fightsLeft: amount}` onto `state.pendingStatuses`; `startFight`
 * applies it to the party actors the `target` word names right after `createFight`, counts a fight off, and drops
 * it at 0. A counted entry survives the stairs (the Greased Stairs land on the next floor); floor-long ones do not.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
