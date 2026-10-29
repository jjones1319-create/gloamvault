import type { CustomHandler } from './types.ts'

/**
 * Undying Rage, Mastery (Blade, Bloodletter IV; docs/classes/blade.md §4.3): "Works outside Berserk too". A marker:
 * `undying-rage` looks for this hook on the holder when a blow would down it and then does not ask for Berserk (the
 * `beforeDowned` loop stops at the first hook that answers, so this one never fires on its own).
 */
const handler: CustomHandler = {}
export default handler
