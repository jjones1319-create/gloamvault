import additionalTargets from './additional-targets.ts'
import allyModeEncase from './ally-mode-encase.ts'
import applyIfBurn from './apply-if-burn.ts'
import applyIfCaster from './apply-if-caster.ts'
import applyIfPoison from './apply-if-poison.ts'
import applyIfShock from './apply-if-shock.ts'
import attacksBecomeElement from './attacks-become-element.ts'
import burnJumpsOnDeath from './burn-jumps-on-death.ts'
import cancelCharge from './cancel-charge.ts'
import chainDamage from './chain-damage.ts'
import chainIfShocked from './chain-if-shocked.ts'
import chillAccuracyPenalty from './chill-accuracy-penalty.ts'
import chillDurationBonus from './chill-duration-bonus.ts'
import chillSpeedPercentBonus from './chill-speed-percent-bonus.ts'
import consumeDotBurst from './consume-dot-burst.ts'
import damageBonusVsStatus from './damage-bonus-vs-status.ts'
import damageWeakestOfFireFrostLightning from './damage-weakest-of-fire-frost-lightning.ts'
import dazeOnCritVsStatus from './daze-on-crit-vs-status.ts'
import disarmFailureSafe from './disarm-failure-safe.ts'
import executeMultiplier from './execute-multiplier.ts'
import fightStartApplyStatus from './fight-start-apply-status.ts'
import firstSchoolCastFree from './first-school-cast-free.ts'
import fleeChanceBonus from './flee-chance-bonus.ts'
import freeOnFirstAction from './free-on-first-action.ts'
import guaranteedCrits from './guaranteed-crits.ts'
import iceWall from './ice-wall.ts'
import identifyOnPickup from './identify-on-pickup.ts'
import immuneToStatus from './immune-to-status.ts'
import lightDecayReduction from './light-decay-reduction.ts'
import lockedChestGradeUpChance from './locked-chest-grade-up-chance.ts'
import lockpickingRankBonus from './lockpicking-rank-bonus.ts'
import momentumOnCrit from './momentum-on-crit.ts'
import momentumOnFirstCrit from './momentum-on-first-crit.ts'
import moveToBackRow from './move-to-back-row.ts'
import nextAttacksElement from './next-attacks-element.ts'
import nextHitsApplyStatus from './next-hits-apply-status.ts'
import nextSchoolSkillFree from './next-school-skill-free.ts'
import partyShatterBonus from './party-shatter-bonus.ts'
import pocketTrap from './pocket-trap.ts'
import pocketTrapOnDisarm from './pocket-trap-on-disarm.ts'
import pocketedTrapDamagePercent from './pocketed-trap-damage-percent.ts'
import poisonDurationBonus from './poison-duration-bonus.ts'
import poisonTickPercent from './poison-tick-percent.ts'
import poolRegenPercentBonus from './pool-regen-percent-bonus.ts'
import rowSwapIgnoresRoot from './row-swap-ignores-root.ts'
import schoolCritDamageBonus from './school-crit-damage-bonus.ts'
import schoolCritRefundPercent from './school-crit-refund-percent.ts'
import schoolDamagePercent from './school-damage-percent.ts'
import shatterFrozen from './shatter-frozen.ts'
import shieldReflectPercent from './shield-reflect-percent.ts'
import stealBossPart from './steal-boss-part.ts'
import stealBuff from './steal-buff.ts'
import stealGoldPerLevel from './steal-gold-per-level.ts'
import stealPart from './steal-part.ts'
import trapDisarmRankBonus from './trap-disarm-rank-bonus.ts'
import type { HandlerEntry } from './types.ts'
import veilStrikeBonus from './veil-strike-bonus.ts'
import veilSurvivesOwnDots from './veil-survives-own-dots.ts'
import vulnerableIfShadow from './vulnerable-if-shadow.ts'

/** Shade and Arcanist hooks (docs/classes/shade.md, arcanist.md). Owned by the arcane handler pass. */
export const GROUP: HandlerEntry[] = [
  ['additional-targets', additionalTargets],
  ['ally-mode-encase', allyModeEncase],
  ['apply-if-burn', applyIfBurn],
  ['apply-if-caster', applyIfCaster],
  ['apply-if-poison', applyIfPoison],
  ['apply-if-shock', applyIfShock],
  ['attacks-become-element', attacksBecomeElement],
  ['burn-jumps-on-death', burnJumpsOnDeath],
  ['cancel-charge', cancelCharge],
  ['chain-damage', chainDamage],
  ['chain-if-shocked', chainIfShocked],
  ['chill-accuracy-penalty', chillAccuracyPenalty],
  ['chill-duration-bonus', chillDurationBonus],
  ['chill-speed-percent-bonus', chillSpeedPercentBonus],
  ['consume-dot-burst', consumeDotBurst],
  ['damage-bonus-vs-status', damageBonusVsStatus],
  ['damage-weakest-of-fire-frost-lightning', damageWeakestOfFireFrostLightning],
  ['daze-on-crit-vs-status', dazeOnCritVsStatus],
  ['disarm-failure-safe', disarmFailureSafe],
  ['execute-multiplier', executeMultiplier],
  ['fight-start-apply-status', fightStartApplyStatus],
  ['first-school-cast-free', firstSchoolCastFree],
  ['flee-chance-bonus', fleeChanceBonus],
  ['free-on-first-action', freeOnFirstAction],
  ['guaranteed-crits', guaranteedCrits],
  ['ice-wall', iceWall],
  ['identify-on-pickup', identifyOnPickup],
  ['immune-to-status', immuneToStatus],
  ['light-decay-reduction', lightDecayReduction],
  ['locked-chest-grade-up-chance', lockedChestGradeUpChance],
  ['lockpicking-rank-bonus', lockpickingRankBonus],
  ['momentum-on-crit', momentumOnCrit],
  ['momentum-on-first-crit', momentumOnFirstCrit],
  ['move-to-back-row', moveToBackRow],
  ['next-attacks-element', nextAttacksElement],
  ['next-hits-apply-status', nextHitsApplyStatus],
  ['next-school-skill-free', nextSchoolSkillFree],
  ['party-shatter-bonus', partyShatterBonus],
  ['pocket-trap', pocketTrap],
  ['pocket-trap-on-disarm', pocketTrapOnDisarm],
  ['pocketed-trap-damage-percent', pocketedTrapDamagePercent],
  ['poison-duration-bonus', poisonDurationBonus],
  ['poison-tick-percent', poisonTickPercent],
  ['pool-regen-percent-bonus', poolRegenPercentBonus],
  ['row-swap-ignores-root', rowSwapIgnoresRoot],
  ['school-crit-damage-bonus', schoolCritDamageBonus],
  ['school-crit-refund-percent', schoolCritRefundPercent],
  ['school-damage-percent', schoolDamagePercent],
  ['shatter-frozen', shatterFrozen],
  ['shield-reflect-percent', shieldReflectPercent],
  ['steal-boss-part', stealBossPart],
  ['steal-buff', stealBuff],
  ['steal-gold-per-level', stealGoldPerLevel],
  ['steal-part', stealPart],
  ['trap-disarm-rank-bonus', trapDisarmRankBonus],
  ['veil-strike-bonus', veilStrikeBonus],
  ['veil-survives-own-dots', veilSurvivesOwnDots],
  ['vulnerable-if-shadow', vulnerableIfShadow],
]
