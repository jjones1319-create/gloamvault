import type { CustomHandler } from './types.ts'

/**
 * A pet trait's ambush modifier (06 §9 Cellar Hound: ambushes −15%). Read by the explore module from the trait line
 * when it rolls surprise (03 §4.4); nothing to do inside a fight.
 */
const handler: CustomHandler = {}
export default handler
