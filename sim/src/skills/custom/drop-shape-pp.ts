import type { CustomHandler } from './types.ts'

/**
 * of Plunder (08 §5): "drop shape +0.5 / +1 / +2 pp toward higher grades (stacks with Luck, same cap)". Resolved by
 * delve.ts: every grade roll the delve makes (fight drops, strongrooms, in-dungeon chests) uses the party's best
 * Luck plus the worn Plunder lines, each pp read as pp / `equipment.dropShape.luckPpPerPoint` Luck points, so
 * grades.ts applies the one Luck cap (`luckCapPp`) to both. The rolled value arrives as `percent` (pp); a broken
 * item contributes nothing (items.ts `effectiveItemStats`).
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
