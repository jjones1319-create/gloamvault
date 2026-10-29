import applyIfWeb from './apply-if-web.ts'
import boneKnightHelm from './bone-knight-helm.ts'
import burstNow from './burst-now.ts'
import curioFight from './curio-fight.ts'
import elementDamageForFloor from './element-damage-for-floor.ts'
import elementDamagePercent from './element-damage-percent.ts'
import insightRoll from './insight-roll.ts'
import killsSelf from './kills-self.ts'
import largeChestAppears from './large-chest-appears.ts'
import loseStatusRider from './lose-status-rider.ts'
import loseSummonAttacks from './lose-summon-attacks.ts'
import noAmbushRooms from './no-ambush-rooms.ts'
import raiseBonePile from './raise-bone-pile.ts'
import resistForFloor from './resist-for-floor.ts'
import revealSecretAndKey from './reveal-secret-and-key.ts'
import riseAgain from './rise-again.ts'
import smallChestAppears from './small-chest-appears.ts'
import smashUrns from './smash-urns.ts'
import tomeOfTier from './tome-of-tier.ts'
import type { HandlerEntry } from './types.ts'

/**
 * The Crypts (06 §3.2 monsters; 07 §2.4–§2.6 curios, traps, secrets) and the delve-side lines they share with the Vault. Owned by pass C1 (Phase 7). The curio, trap and secret ids are resolved by delve.ts (`resolveDelveLine`); their files hold the contract and `DELVE_SIDE`.
 */
export const GROUP: HandlerEntry[] = [
  ['apply-if-web', applyIfWeb],
  ['bone-knight-helm', boneKnightHelm],
  ['burst-now', burstNow],
  ['curio-fight', curioFight],
  ['element-damage-for-floor', elementDamageForFloor],
  ['element-damage-percent', elementDamagePercent],
  ['insight-roll', insightRoll],
  ['kills-self', killsSelf],
  ['large-chest-appears', largeChestAppears],
  ['lose-status-rider', loseStatusRider],
  ['lose-summon-attacks', loseSummonAttacks],
  ['no-ambush-rooms', noAmbushRooms],
  ['raise-bone-pile', raiseBonePile],
  ['resist-for-floor', resistForFloor],
  ['reveal-secret-and-key', revealSecretAndKey],
  ['rise-again', riseAgain],
  ['small-chest-appears', smallChestAppears],
  ['smash-urns', smashUrns],
  ['tome-of-tier', tomeOfTier],
]
