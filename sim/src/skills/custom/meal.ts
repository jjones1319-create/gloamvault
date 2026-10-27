import type { CustomHandler } from './types.ts'

/**
 * Cooking ingredient (08 §4; 09 §5 Cooking): "with Cooking at a rest room: a meal, +5% to one stat for the next
 * floor". Resolved by delve.ts: the `rest` command's `cookAttribute` consumes one ingredient (an item whose
 * consumable effects carry this line) from any bag and sets every hero's `cooked` to that attribute; without an
 * ingredient nothing is cooked. Using the ingredient as an item outside a rest room is refused. Reading: the +5%
 * (`percent`) is the meal's size, read by whoever applies `cooked` to the next floor's stats (hero.ts, not yet).
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
