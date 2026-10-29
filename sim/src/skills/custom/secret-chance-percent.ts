import type { CustomHandler } from './types.ts'

/**
 * Wayfinder (Ranger, Pathfinder IV; docs/classes/ranger.md §4.3): a floor holds a secret room `percent` points more
 * often (+10; Mastery +15). Read by sim/src/delve.ts (`secretChanceFor`) when the floor is generated: the best hero's
 * line is added to the floor's secret chance through the generator's own override; a floor whose chance is 0 keeps
 * none. Nothing to do inside a fight.
 */
const handler: CustomHandler = {}
export default handler
