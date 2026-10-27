import armorWearMultiplier from './armor-wear-multiplier.ts'
import basicAttackLifestealPercent from './basic-attack-lifesteal-percent.ts'
import blockFirstPhysicalHits from './block-first-physical-hits.ts'
import cannotGuard from './cannot-guard.ts'
import consumeAmmo from './consume-ammo.ts'
import consumeDotRemaining from './consume-dot-remaining.ts'
import corridorRoomsPerTick from './corridor-rooms-per-tick.ts'
import counterHitAppliesStatus from './counter-hit-applies-status.ts'
import counterHitDamagePercent from './counter-hit-damage-percent.ts'
import critRateVsLowHp from './crit-rate-vs-low-hp.ts'
import critRateVsStatus from './crit-rate-vs-status.ts'
import criticalScout from './critical-scout.ts'
import damageLastAttackerOfTarget from './damage-last-attacker-of-target.ts'
import damageMultiplierVsStatus from './damage-multiplier-vs-status.ts'
import damageOtherEnemies from './damage-other-enemies.ts'
import damagePerStatusTurnRemaining from './damage-per-status-turn-remaining.ts'
import damagePercentMaxHp from './damage-percent-max-hp.ts'
import damagePercentVsStatus from './damage-percent-vs-status.ts'
import damagePlusBlockedSinceLastTurn from './damage-plus-blocked-since-last-turn.ts'
import dazeFodderGuaranteed from './daze-fodder-guaranteed.ts'
import dazeSwappedInEnemy from './daze-swapped-in-enemy.ts'
import dodgeStackOnLightAction from './dodge-stack-on-light-action.ts'
import executeMultiplierBelowHp from './execute-multiplier-below-hp.ts'
import fieldSkillBonusForaging from './field-skill-bonus-foraging.ts'
import fieldSkillBonusTrapDisarm from './field-skill-bonus-trap-disarm.ts'
import fieldTrapOnMovement from './field-trap-on-movement.ts'
import fieldTrapRowDot from './field-trap-row-dot.ts'
import fieldTrapTickStatus from './field-trap-tick-status.ts'
import firstActionDamagePercent from './first-action-damage-percent.ts'
import firstActionMomentum from './first-action-momentum.ts'
import firstActionWeight from './first-action-weight.ts'
import forceCheckBonus from './force-check-bonus.ts'
import guaranteedCritVsStatus from './guaranteed-crit-vs-status.ts'
import healPercentOfDamageDealt from './heal-percent-of-damage-dealt.ts'
import heavySkillsUndodgeableVsHeld from './heavy-skills-undodgeable-vs-held.ts'
import hitEnemyEnteringFrontRow from './hit-enemy-entering-front-row.ts'
import interceptTraps from './intercept-traps.ts'
import killMarkedRefundAndMomentum from './kill-marked-refund-and-momentum.ts'
import markDamagePercent from './mark-damage-percent.ts'
import momentumNextFightOnDisarm from './momentum-next-fight-on-disarm.ts'
import momentumOnDodge from './momentum-on-dodge.ts'
import momentumOnShout from './momentum-on-shout.ts'
import momentumOnSurprise from './momentum-on-surprise.ts'
import momentumPerHitLanded from './momentum-per-hit-landed.ts'
import negateDarkBandBonuses from './negate-dark-band-bonuses.ts'
import netHeld from './net-held.ts'
import nextActionWeight from './next-action-weight.ts'
import nextRoomAmbushPercent from './next-room-ambush-percent.ts'
import nextSchoolSkillDamagePercent from './next-school-skill-damage-percent.ts'
import nextSkillUninterruptible from './next-skill-uninterruptible.ts'
import partBreak from './part-break.ts'
import partyDamagePercentVsHeld from './party-damage-percent-vs-held.ts'
import partyRowSwapWeight from './party-row-swap-weight.ts'
import patienceStacks from './patience-stacks.ts'
import poolOnBlock from './pool-on-block.ts'
import recoverAmmoPercent from './recover-ammo-percent.ts'
import reflectOnBlockPercent from './reflect-on-block-percent.ts'
import regenAlliesBelowHpOnShout from './regen-allies-below-hp-on-shout.ts'
import restRoomExtraIngredients from './rest-room-extra-ingredients.ts'
import riposteOnDodge from './riposte-on-dodge.ts'
import schoolComboDamageStacks from './school-combo-damage-stacks.ts'
import schoolCostMultiplier from './school-cost-multiplier.ts'
import schoolCostPerComboStack from './school-cost-per-combo-stack.ts'
import schoolIgnoresSilence from './school-ignores-silence.ts'
import schoolKillRefundAndMomentum from './school-kill-refund-and-momentum.ts'
import scoutingChancePercent from './scouting-chance-percent.ts'
import selfDamageSkippedAboveHp from './self-damage-skipped-above-hp.ts'
import shieldAlliesPercentOfOwnMaxHp from './shield-allies-percent-of-own-max-hp.ts'
import shotAccuracyBonus from './shot-accuracy-bonus.ts'
import shotCritBonus from './shot-crit-bonus.ts'
import statAmountBelowHp from './stat-amount-below-hp.ts'
import statPercentBelowHp from './stat-percent-below-hp.ts'
import statusBelowHp from './status-below-hp.ts'
import statusIfHeld from './status-if-held.ts'
import statusImmunity from './status-immunity.ts'
import statusOnCrit from './status-on-crit.ts'
import statusOnElites from './status-on-elites.ts'
import statusOnFodder from './status-on-fodder.ts'
import surviveLethalCleansesDebuffs from './survive-lethal-cleanses-debuffs.ts'
import surviveLethalOncePerFight from './survive-lethal-once-per-fight.ts'
import swapRowsWithAlly from './swap-rows-with-ally.ts'
import tauntDurationBonus from './taunt-duration-bonus.ts'
import tauntedEnemiesDamageToYouPercent from './taunted-enemies-damage-to-you-percent.ts'
import ultimateMomentumFloorOnKill from './ultimate-momentum-floor-on-kill.ts'
import type { HandlerEntry } from './types.ts'

/** Warden, Blade and Ranger hooks (docs/classes/warden.md, blade.md, ranger.md). Owned by the martial handler pass. */
export const GROUP: HandlerEntry[] = [
  ['armor-wear-multiplier', armorWearMultiplier],
  ['basic-attack-lifesteal-percent', basicAttackLifestealPercent],
  ['block-first-physical-hits', blockFirstPhysicalHits],
  ['cannot-guard', cannotGuard],
  ['consume-ammo', consumeAmmo],
  ['consume-dot-remaining', consumeDotRemaining],
  ['corridor-rooms-per-tick', corridorRoomsPerTick],
  ['counter-hit-applies-status', counterHitAppliesStatus],
  ['counter-hit-damage-percent', counterHitDamagePercent],
  ['crit-rate-vs-low-hp', critRateVsLowHp],
  ['crit-rate-vs-status', critRateVsStatus],
  ['critical-scout', criticalScout],
  ['damage-last-attacker-of-target', damageLastAttackerOfTarget],
  ['damage-multiplier-vs-status', damageMultiplierVsStatus],
  ['damage-other-enemies', damageOtherEnemies],
  ['damage-per-status-turn-remaining', damagePerStatusTurnRemaining],
  ['damage-percent-max-hp', damagePercentMaxHp],
  ['damage-percent-vs-status', damagePercentVsStatus],
  ['damage-plus-blocked-since-last-turn', damagePlusBlockedSinceLastTurn],
  ['daze-fodder-guaranteed', dazeFodderGuaranteed],
  ['daze-swapped-in-enemy', dazeSwappedInEnemy],
  ['dodge-stack-on-light-action', dodgeStackOnLightAction],
  ['execute-multiplier-below-hp', executeMultiplierBelowHp],
  ['field-skill-bonus-foraging', fieldSkillBonusForaging],
  ['field-skill-bonus-trap-disarm', fieldSkillBonusTrapDisarm],
  ['field-trap-on-movement', fieldTrapOnMovement],
  ['field-trap-row-dot', fieldTrapRowDot],
  ['field-trap-tick-status', fieldTrapTickStatus],
  ['first-action-damage-percent', firstActionDamagePercent],
  ['first-action-momentum', firstActionMomentum],
  ['first-action-weight', firstActionWeight],
  ['force-check-bonus', forceCheckBonus],
  ['guaranteed-crit-vs-status', guaranteedCritVsStatus],
  ['heal-percent-of-damage-dealt', healPercentOfDamageDealt],
  ['heavy-skills-undodgeable-vs-held', heavySkillsUndodgeableVsHeld],
  ['hit-enemy-entering-front-row', hitEnemyEnteringFrontRow],
  ['intercept-traps', interceptTraps],
  ['kill-marked-refund-and-momentum', killMarkedRefundAndMomentum],
  ['mark-damage-percent', markDamagePercent],
  ['momentum-next-fight-on-disarm', momentumNextFightOnDisarm],
  ['momentum-on-dodge', momentumOnDodge],
  ['momentum-on-shout', momentumOnShout],
  ['momentum-on-surprise', momentumOnSurprise],
  ['momentum-per-hit-landed', momentumPerHitLanded],
  ['negate-dark-band-bonuses', negateDarkBandBonuses],
  ['net-held', netHeld],
  ['next-action-weight', nextActionWeight],
  ['next-room-ambush-percent', nextRoomAmbushPercent],
  ['next-school-skill-damage-percent', nextSchoolSkillDamagePercent],
  ['next-skill-uninterruptible', nextSkillUninterruptible],
  ['part-break', partBreak],
  ['party-damage-percent-vs-held', partyDamagePercentVsHeld],
  ['party-row-swap-weight', partyRowSwapWeight],
  ['patience-stacks', patienceStacks],
  ['pool-on-block', poolOnBlock],
  ['recover-ammo-percent', recoverAmmoPercent],
  ['reflect-on-block-percent', reflectOnBlockPercent],
  ['regen-allies-below-hp-on-shout', regenAlliesBelowHpOnShout],
  ['rest-room-extra-ingredients', restRoomExtraIngredients],
  ['riposte-on-dodge', riposteOnDodge],
  ['school-combo-damage-stacks', schoolComboDamageStacks],
  ['school-cost-multiplier', schoolCostMultiplier],
  ['school-cost-per-combo-stack', schoolCostPerComboStack],
  ['school-ignores-silence', schoolIgnoresSilence],
  ['school-kill-refund-and-momentum', schoolKillRefundAndMomentum],
  ['scouting-chance-percent', scoutingChancePercent],
  ['self-damage-skipped-above-hp', selfDamageSkippedAboveHp],
  ['shield-allies-percent-of-own-max-hp', shieldAlliesPercentOfOwnMaxHp],
  ['shot-accuracy-bonus', shotAccuracyBonus],
  ['shot-crit-bonus', shotCritBonus],
  ['stat-amount-below-hp', statAmountBelowHp],
  ['stat-percent-below-hp', statPercentBelowHp],
  ['status-below-hp', statusBelowHp],
  ['status-if-held', statusIfHeld],
  ['status-immunity', statusImmunity],
  ['status-on-crit', statusOnCrit],
  ['status-on-elites', statusOnElites],
  ['status-on-fodder', statusOnFodder],
  ['survive-lethal-cleanses-debuffs', surviveLethalCleansesDebuffs],
  ['survive-lethal-once-per-fight', surviveLethalOncePerFight],
  ['swap-rows-with-ally', swapRowsWithAlly],
  ['taunt-duration-bonus', tauntDurationBonus],
  ['taunted-enemies-damage-to-you-percent', tauntedEnemiesDamageToYouPercent],
  ['ultimate-momentum-floor-on-kill', ultimateMomentumFloorOnKill],
]
