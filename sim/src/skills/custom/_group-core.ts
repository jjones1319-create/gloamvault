import allAttributesPercent from './all-attributes-percent.ts'
import counterStance from './counter-stance.ts'
import damageTakenPercentVsUndeadShadow from './damage-taken-percent-vs-undead-shadow.ts'
import damageTakenPercent from './damage-taken-percent.ts'
import fearGuardInstead from './fear-guard-instead.ts'
import freezeShatter from './freeze-shatter.ts'
import grabHeld from './grab-held.ts'
import healingReceivedPercent from './healing-received-percent.ts'
import interceptSingleTarget from './intercept-single-target.ts'
import lifestealPercent from './lifesteal-percent.ts'
import noRowSwapNoFlee from './no-row-swap-no-flee.ts'
import partyAmbushModifier from './party-ambush-modifier.ts'
import setSpeed from './set-speed.ts'
import shieldAbsorb from './shield-absorb.ts'
import shockChain from './shock-chain.ts'
import silenceNoSkills from './silence-no-skills.ts'
import tauntMustTarget from './taunt-must-target.ts'
import type { HandlerEntry } from './types.ts'
import veilMissNext from './veil-miss-next.ts'

/** The rulebook's own statuses (03 §3.5, D-050) and the three exemplar hooks the other groups are modelled on. */
export const GROUP: HandlerEntry[] = [
  ['all-attributes-percent', allAttributesPercent],
  ['counter-stance', counterStance],
  ['damage-taken-percent', damageTakenPercent],
  ['damage-taken-percent-vs-undead-shadow', damageTakenPercentVsUndeadShadow],
  ['fear-guard-instead', fearGuardInstead],
  ['freeze-shatter', freezeShatter],
  ['grab-held', grabHeld],
  ['healing-received-percent', healingReceivedPercent],
  ['intercept-single-target', interceptSingleTarget],
  ['lifesteal-percent', lifestealPercent],
  ['no-row-swap-no-flee', noRowSwapNoFlee],
  ['party-ambush-modifier', partyAmbushModifier],
  ['set-speed', setSpeed],
  ['shield-absorb', shieldAbsorb],
  ['shock-chain', shockChain],
  ['silence-no-skills', silenceNoSkills],
  ['taunt-must-target', tauntMustTarget],
  ['veil-miss-next', veilMissNext],
]
