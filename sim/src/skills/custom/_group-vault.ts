import applyIfChill from './apply-if-chill.ts'
import applyIfCurse from './apply-if-curse.ts'
import diesIntoLight from './dies-into-light.ts'
import drainSluice from './drain-sluice.ts'
import drownerHelm from './drowner-helm.ts'
import fleeCountdown from './flee-countdown.ts'
import floodRoom from './flood-room.ts'
import holdRider from './hold-rider.ts'
import latchDrain from './latch-drain.ts'
import loseStatusAttacks from './lose-status-attacks.ts'
import naesaConfession from './naesa-confession.ts'
import oozeSplit from './ooze-split.ts'
import pullToFront from './pull-to-front.ts'
import ragePerMissingHp from './rage-per-missing-hp.ts'
import shortHold from './short-hold.ts'
import type { HandlerEntry } from './types.ts'

/**
 * The Drowned Vault (06 §3.3 monsters and the Vault Leech; 07 §2.4–§2.6 curios, traps, secrets). Owned by pass C1 (Phase 7). The curio, trap and secret ids are resolved by delve.ts (`resolveDelveLine`); their files hold the contract and `DELVE_SIDE`.
 */
export const GROUP: HandlerEntry[] = [
  ['apply-if-chill', applyIfChill],
  ['apply-if-curse', applyIfCurse],
  ['dies-into-light', diesIntoLight],
  ['drain-sluice', drainSluice],
  ['drowner-helm', drownerHelm],
  ['flee-countdown', fleeCountdown],
  ['flood-room', floodRoom],
  ['hold-rider', holdRider],
  ['latch-drain', latchDrain],
  ['lose-status-attacks', loseStatusAttacks],
  ['naesa-confession', naesaConfession],
  ['ooze-split', oozeSplit],
  ['pull-to-front', pullToFront],
  ['rage-per-missing-hp', ragePerMissingHp],
  ['short-hold', shortHold],
]
