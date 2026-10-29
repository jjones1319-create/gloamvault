import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine` → `startFight`). A curio or trap that starts a fight that is not an ambush
 * (07 §2.4: the Sealed Sarcophagus's "a Ghoul rises (fight, not ambush)", the Thrall's Cage's thrall, the Sentinel
 * Plinth's Elite Vault Sentinel, the Leech Jar's Vault Leech; 07 §2.5 the Sentinel Eye's two Sentinels): `amount` of
 * `summonId` (party-scaled like any pack, 03 §11.2) in the current room, the surprise rolled as for any encounter.
 * A hunter (the Vault Leech, 07 §2.9) fights as a hunter does: never surprised either way, never fled (it is loud),
 * at its hunter level (floor + levelOffset), and its kill is recorded in `DelveState.huntersKilled`.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler
