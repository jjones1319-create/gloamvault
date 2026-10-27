import type { CustomHandler } from './types.ts'

/**
 * Unbreakable, Mastery (Warden, Bulwark III; docs/classes/warden.md §4.1): the Last Stand trigger also removes
 * every debuff. A marker: `survive-lethal-once-per-fight` looks for this hook on the holder when it triggers and
 * does the cleanse there (the `beforeDowned` loop stops at the first hook that answers, so this one never fires
 * on its own).
 */
const handler: CustomHandler = {}
export default handler
