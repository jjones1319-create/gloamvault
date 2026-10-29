import apexMarkPercent from './apex-mark-percent.ts'
import corridorLightBandShift from './corridor-light-band-shift.ts'
import corridorOpenLocks from './corridor-open-locks.ts'
import critCapRaise from './crit-cap-raise.ts'
import decoyEachTurn from './decoy-each-turn.ts'
import dismantleParts from './dismantle-parts.ts'
import fearOthersOnVeilCrit from './fear-others-on-veil-crit.ts'
import fieldSkillBonusCartography from './field-skill-bonus-cartography.ts'
import fieldTrapBothRows from './field-trap-both-rows.ts'
import fieldTrapFrontAction from './field-trap-front-action.ts'
import floorClockPerRooms from './floor-clock-per-rooms.ts'
import fortuneCapRaise from './fortune-cap-raise.ts'
import guaranteedCritBelowHp from './guaranteed-crit-below-hp.ts'
import guaranteedCritFromStatus from './guaranteed-crit-from-status.ts'
import hunterArrivalTicks from './hunter-arrival-ticks.ts'
import huntersCage from './hunters-cage.ts'
import ignoreDefensePercent from './ignore-defense-percent.ts'
import ignoreDefenseVsArmored from './ignore-defense-vs-armored.ts'
import keysNeverConsumed from './keys-never-consumed.ts'
import momentumOnKill from './momentum-on-kill.ts'
import nightshadeVeins from './nightshade-veins.ts'
import oneShotFodder from './one-shot-fodder.ts'
import petrifyPoisonedStunBoss from './petrify-poisoned-stun-boss.ts'
import phantomThiefChests from './phantom-thief-chests.ts'
import poisonSpreadsOnDeath from './poison-spreads-on-death.ts'
import secretChancePercent from './secret-chance-percent.ts'
import singleTargetMissesTurns from './single-target-misses-turns.ts'
import stealBanditItem from './steal-bandit-item.ts'
import stealBossRarePart from './steal-boss-rare-part.ts'
import stripAllBuffs from './strip-all-buffs.ts'
import stripBuffsShieldAllies from './strip-buffs-shield-allies.ts'
import surpriseFodderEncounters from './surprise-fodder-encounters.ts'
import toxicologist from './toxicologist.ts'
import trapmaster from './trapmaster.ts'
import treasureDetectionBonus from './treasure-detection-bonus.ts'
import veilOnEvade from './veil-on-evade.ts'
import veilOnKill from './veil-on-kill.ts'
import type { HandlerEntry } from './types.ts'

/**
 * Tiers IV–V hooks (Phase 7, pass A) — the Ranger and Shade share (docs/classes/ranger.md, shade.md §4 Tier IV–V rows),
 * merged by _group-tiers45.ts. sim/test/custom-registry.test.ts checks every handler file is registered once.
 */
export const GROUP: readonly HandlerEntry[] = [
  ['apex-mark-percent', apexMarkPercent],
  ['corridor-light-band-shift', corridorLightBandShift],
  ['corridor-open-locks', corridorOpenLocks],
  ['crit-cap-raise', critCapRaise],
  ['decoy-each-turn', decoyEachTurn],
  ['dismantle-parts', dismantleParts],
  ['fear-others-on-veil-crit', fearOthersOnVeilCrit],
  ['field-skill-bonus-cartography', fieldSkillBonusCartography],
  ['field-trap-both-rows', fieldTrapBothRows],
  ['field-trap-front-action', fieldTrapFrontAction],
  ['floor-clock-per-rooms', floorClockPerRooms],
  ['fortune-cap-raise', fortuneCapRaise],
  ['guaranteed-crit-below-hp', guaranteedCritBelowHp],
  ['guaranteed-crit-from-status', guaranteedCritFromStatus],
  ['hunter-arrival-ticks', hunterArrivalTicks],
  ['hunters-cage', huntersCage],
  ['ignore-defense-percent', ignoreDefensePercent],
  ['ignore-defense-vs-armored', ignoreDefenseVsArmored],
  ['keys-never-consumed', keysNeverConsumed],
  ['momentum-on-kill', momentumOnKill],
  ['nightshade-veins', nightshadeVeins],
  ['one-shot-fodder', oneShotFodder],
  ['petrify-poisoned-stun-boss', petrifyPoisonedStunBoss],
  ['phantom-thief-chests', phantomThiefChests],
  ['poison-spreads-on-death', poisonSpreadsOnDeath],
  ['secret-chance-percent', secretChancePercent],
  ['single-target-misses-turns', singleTargetMissesTurns],
  ['steal-bandit-item', stealBanditItem],
  ['steal-boss-rare-part', stealBossRarePart],
  ['strip-all-buffs', stripAllBuffs],
  ['strip-buffs-shield-allies', stripBuffsShieldAllies],
  ['surprise-fodder-encounters', surpriseFodderEncounters],
  ['toxicologist', toxicologist],
  ['trapmaster', trapmaster],
  ['treasure-detection-bonus', treasureDetectionBonus],
  ['veil-on-evade', veilOnEvade],
  ['veil-on-kill', veilOnKill],
]
