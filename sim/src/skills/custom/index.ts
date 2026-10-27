import allAttributesPercent from './all-attributes-percent.ts'
import damageTakenPercentVsUndeadShadow from './damage-taken-percent-vs-undead-shadow.ts'
import damageTakenPercent from './damage-taken-percent.ts'
import fearGuardInstead from './fear-guard-instead.ts'
import freezeShatter from './freeze-shatter.ts'
import grabHeld from './grab-held.ts'
import healingReceivedPercent from './healing-received-percent.ts'
import noRowSwapNoFlee from './no-row-swap-no-flee.ts'
import partyAmbushModifier from './party-ambush-modifier.ts'
import setSpeed from './set-speed.ts'
import shieldAbsorb from './shield-absorb.ts'
import shockChain from './shock-chain.ts'
import silenceNoSkills from './silence-no-skills.ts'
import tauntMustTarget from './taunt-must-target.ts'
import type { CustomHandler } from './types.ts'
import veilMissNext from './veil-miss-next.ts'

/** Every custom hook by its customId; content/README.md rule 31 checks each id has a file here. */
export const CUSTOM_HANDLERS: ReadonlyMap<string, CustomHandler> = new Map<string, CustomHandler>([
  ['all-attributes-percent', allAttributesPercent],
  ['damage-taken-percent', damageTakenPercent],
  ['damage-taken-percent-vs-undead-shadow', damageTakenPercentVsUndeadShadow],
  ['fear-guard-instead', fearGuardInstead],
  ['freeze-shatter', freezeShatter],
  ['grab-held', grabHeld],
  ['healing-received-percent', healingReceivedPercent],
  ['no-row-swap-no-flee', noRowSwapNoFlee],
  ['party-ambush-modifier', partyAmbushModifier],
  ['set-speed', setSpeed],
  ['shield-absorb', shieldAbsorb],
  ['shock-chain', shockChain],
  ['silence-no-skills', silenceNoSkills],
  ['taunt-must-target', tauntMustTarget],
  ['veil-miss-next', veilMissNext],
])

export function customHandler(id: string): CustomHandler | null {
  return CUSTOM_HANDLERS.get(id) ?? null
}

export type { CustomHandler, HookContext, IncomingDamage } from './types.ts'
