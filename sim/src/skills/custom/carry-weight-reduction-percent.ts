import type { CustomHandler } from './types.ts'

/**
 * Light (08 §5): "item carry weight −10–15% / 15–25% / 25–40%" on armor, shields and two-handed weapons. Resolved
 * nowhere yet: carry weight per item is not a schema field (the content note says so) and the hero's carry total
 * is not modelled, so there is nothing to lighten. Contract for the day it is: the item's own weight × (100 −
 * `percent`) / 100 in the carry sum (hero.ts / the inventory screen), never a fight rule. The rolled value arrives
 * as `percent`.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
