import allyControlImmunityAboveHp from './ally-control-immunity-above-hp.ts'
import applyIfBoss from './apply-if-boss.ts'
import damageOthersWithStatus from './damage-others-with-status.ts'
import damageToPoolRedirect from './damage-to-pool-redirect.ts'
import defenseIgnoreFlat from './defense-ignore-flat.ts'
import destroyBelowHp from './destroy-below-hp.ts'
import doubleAllyShields from './double-ally-shields.ts'
import fightStartMomentumAllies from './fight-start-momentum-allies.ts'
import freezeDurationBonus from './freeze-duration-bonus.ts'
import freezeIfChilled from './freeze-if-chilled.ts'
import graceNextAction from './grace-next-action.ts'
import healRestoresPool from './heal-restores-pool.ts'
import heavyCastsUninterrupted from './heavy-casts-uninterrupted.ts'
import momentumSplitToAllies from './momentum-split-to-allies.ts'
import partyAmbushLightShift from './party-ambush-light-shift.ts'
import partyBasicExtraHoly from './party-basic-extra-holy.ts'
import partyMomentumOnKill from './party-momentum-on-kill.ts'
import poolOnPartyShatter from './pool-on-party-shatter.ts'
import poolRefillAtZero from './pool-refill-at-zero.ts'
import regenHoldsBelowHp from './regen-holds-below-hp.ts'
import regenTicksTwice from './regen-ticks-twice.ts'
import retaliateOnHit from './retaliate-on-hit.ts'
import reviveFallen from './revive-fallen.ts'
import rewindAlly from './rewind-ally.ts'
import skillOncePerFight from './skill-once-per-fight.ts'
import statusDurationBonus from './status-duration-bonus.ts'
import statusOnMeleeAttacker from './status-on-melee-attacker.ts'
import statusOnOwnAction from './status-on-own-action.ts'
import timelineIfStatus from './timeline-if-status.ts'
import type { HandlerEntry } from './types.ts'

/**
 * Tiers IV–V hooks (Phase 7, pass A) — the Arcanist and Mender share (docs/classes/arcanist.md and mender.md §4, the
 * Tier IV and V rows), merged by _group-tiers45.ts; sim/test/custom-registry.test.ts checks every handler file is
 * registered once. Stubs (Tier V joints, each file says which): rewind-ally, heavy-casts-uninterrupted. The delve reads
 * party-ambush-light-shift (Dawn Vigil) itself.
 */
export const GROUP: readonly HandlerEntry[] = [
  ['ally-control-immunity-above-hp', allyControlImmunityAboveHp],
  ['apply-if-boss', applyIfBoss],
  ['damage-others-with-status', damageOthersWithStatus],
  ['damage-to-pool-redirect', damageToPoolRedirect],
  ['defense-ignore-flat', defenseIgnoreFlat],
  ['destroy-below-hp', destroyBelowHp],
  ['double-ally-shields', doubleAllyShields],
  ['fight-start-momentum-allies', fightStartMomentumAllies],
  ['freeze-duration-bonus', freezeDurationBonus],
  ['freeze-if-chilled', freezeIfChilled],
  ['grace-next-action', graceNextAction],
  ['heal-restores-pool', healRestoresPool],
  ['heavy-casts-uninterrupted', heavyCastsUninterrupted],
  ['momentum-split-to-allies', momentumSplitToAllies],
  ['party-ambush-light-shift', partyAmbushLightShift],
  ['party-basic-extra-holy', partyBasicExtraHoly],
  ['party-momentum-on-kill', partyMomentumOnKill],
  ['pool-on-party-shatter', poolOnPartyShatter],
  ['pool-refill-at-zero', poolRefillAtZero],
  ['regen-holds-below-hp', regenHoldsBelowHp],
  ['regen-ticks-twice', regenTicksTwice],
  ['retaliate-on-hit', retaliateOnHit],
  ['revive-fallen', reviveFallen],
  ['rewind-ally', rewindAlly],
  ['skill-once-per-fight', skillOncePerFight],
  ['status-duration-bonus', statusDurationBonus],
  ['status-on-melee-attacker', statusOnMeleeAttacker],
  ['status-on-own-action', statusOnOwnAction],
  ['timeline-if-status', timelineIfStatus],
]
