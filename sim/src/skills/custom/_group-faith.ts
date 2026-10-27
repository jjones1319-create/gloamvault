import absorbFirstHits from './absorb-first-hits.ts'
import applyIfLiving from './apply-if-living.ts'
import applyIfSmite from './apply-if-smite.ts'
import applyIfUndeadOrShadow from './apply-if-undead-or-shadow.ts'
import basicAttackExtraSpellDamage from './basic-attack-extra-spell-damage.ts'
import bonusPerMissingHp from './bonus-per-missing-hp.ts'
import deathBurst from './death-burst.ts'
import decoys from './decoys.ts'
import elementImmunityRandom from './element-immunity-random.ts'
import fearFodderOnDeath from './fear-fodder-on-death.ts'
import fodderAttackSpeedAura from './fodder-attack-speed-aura.ts'
import fortifyDurationBonus from './fortify-duration-bonus.ts'
import hallowedGround from './hallowed-ground.ts'
import healCostHalfBelowHp from './heal-cost-half-below-hp.ts'
import healingDonePercent from './healing-done-percent.ts'
import immuneToDebuffs from './immune-to-debuffs.ts'
import overhealToShield from './overheal-to-shield.ts'
import petExtraPartRoll from './pet-extra-part-roll.ts'
import petGrabSmall from './pet-grab-small.ts'
import petIntercept from './pet-intercept.ts'
import petInterceptBonus from './pet-intercept-bonus.ts'
import petLightBandShift from './pet-light-band-shift.ts'
import petLockpickingBonus from './pet-lockpicking-bonus.ts'
import petRegenPercent from './pet-regen-percent.ts'
import petRepairItemPercent from './pet-repair-item-percent.ts'
import petResist from './pet-resist.ts'
import petRevealAdjacentRooms from './pet-reveal-adjacent-rooms.ts'
import petScoutingBonus from './pet-scouting-bonus.ts'
import petStatusImmune from './pet-status-immune.ts'
import petStealBuff from './pet-steal-buff.ts'
import petStealGoldBack from './pet-steal-gold-back.ts'
import petWearMultiplier from './pet-wear-multiplier.ts'
import poolDrainHeal from './pool-drain-heal.ts'
import reflectMeleePercent from './reflect-melee-percent.ts'
import regenPercentMaxHp from './regen-percent-max-hp.ts'
import resistanceBonusWhileFortified from './resistance-bonus-while-fortified.ts'
import sanctuaryShieldImmunities from './sanctuary-shield-immunities.ts'
import silenceAura from './silence-aura.ts'
import speciesBreath from './species-breath.ts'
import surviveLethalOnce from './survive-lethal-once.ts'
import type { HandlerEntry } from './types.ts'
import warcryDurationPercent from './warcry-duration-percent.ts'

/** Mender, species, pet and elite-affix hooks (docs/classes/mender.md, 05, 06 §2, 06 §9). Owned by the faith handler pass. */
export const GROUP: HandlerEntry[] = [
  ['absorb-first-hits', absorbFirstHits],
  ['apply-if-living', applyIfLiving],
  ['apply-if-smite', applyIfSmite],
  ['apply-if-undead-or-shadow', applyIfUndeadOrShadow],
  ['basic-attack-extra-spell-damage', basicAttackExtraSpellDamage],
  ['bonus-per-missing-hp', bonusPerMissingHp],
  ['death-burst', deathBurst],
  ['decoys', decoys],
  ['element-immunity-random', elementImmunityRandom],
  ['fear-fodder-on-death', fearFodderOnDeath],
  ['fodder-attack-speed-aura', fodderAttackSpeedAura],
  ['fortify-duration-bonus', fortifyDurationBonus],
  ['hallowed-ground', hallowedGround],
  ['heal-cost-half-below-hp', healCostHalfBelowHp],
  ['healing-done-percent', healingDonePercent],
  ['immune-to-debuffs', immuneToDebuffs],
  ['overheal-to-shield', overhealToShield],
  ['pet-extra-part-roll', petExtraPartRoll],
  ['pet-grab-small', petGrabSmall],
  ['pet-intercept', petIntercept],
  ['pet-intercept-bonus', petInterceptBonus],
  ['pet-light-band-shift', petLightBandShift],
  ['pet-lockpicking-bonus', petLockpickingBonus],
  ['pet-regen-percent', petRegenPercent],
  ['pet-repair-item-percent', petRepairItemPercent],
  ['pet-resist', petResist],
  ['pet-reveal-adjacent-rooms', petRevealAdjacentRooms],
  ['pet-scouting-bonus', petScoutingBonus],
  ['pet-status-immune', petStatusImmune],
  ['pet-steal-buff', petStealBuff],
  ['pet-steal-gold-back', petStealGoldBack],
  ['pet-wear-multiplier', petWearMultiplier],
  ['pool-drain-heal', poolDrainHeal],
  ['reflect-melee-percent', reflectMeleePercent],
  ['regen-percent-max-hp', regenPercentMaxHp],
  ['resistance-bonus-while-fortified', resistanceBonusWhileFortified],
  ['sanctuary-shield-immunities', sanctuaryShieldImmunities],
  ['silence-aura', silenceAura],
  ['species-breath', speciesBreath],
  ['survive-lethal-once', surviveLethalOnce],
  ['warcry-duration-percent', warcryDurationPercent],
]
