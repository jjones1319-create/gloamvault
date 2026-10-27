import type { CustomHandler } from './types.ts'

/**
 * Forge Beetle's Rivet (pet active, 06 §9): out of combat, rest rooms only — restores `percent` of maxDurability on
 * one item the owner chooses; once per rest room. Resolved by delve.ts at the rest room; nothing to do inside a fight.
 */
export const DELVE_SIDE = true
const handler: CustomHandler = {}
export default handler
