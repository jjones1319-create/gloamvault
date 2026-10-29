import basicAttackPoolRestorePercent from './basic-attack-pool-restore-percent.ts'
import blockAppliesToSpells from './block-applies-to-spells.ts'
import frostFreezesChilled from './frost-freezes-chilled.ts'
import guardTauntsAndFortifies from './guard-taunts-and-fortifies.ts'
import hasteOnKill from './haste-on-kill.ts'
import holySpellsGrantRegen from './holy-spells-grant-regen.ts'
import nextActionWeightless from './next-action-weightless.ts'
import rerollFightDrop from './reroll-fight-drop.ts'
import shieldLowestAllyOnBlock from './shield-lowest-ally-on-block.ts'
import type { HandlerEntry } from './types.ts'
import ultimateAppliesStatus from './ultimate-applies-status.ts'

/**
 * Pass B (Phase 7): the hooks of Gravehollow's set bonuses, named uniques and relics (08 §3, §6, §7). The Emberheart
 * Ring's and the Drowned Choir's `element-damage-percent` is pass C1's (_group-crypts.ts) and shared.
 */
export const GROUP: HandlerEntry[] = [
  ['basic-attack-pool-restore-percent', basicAttackPoolRestorePercent],
  ['block-applies-to-spells', blockAppliesToSpells],
  ['frost-freezes-chilled', frostFreezesChilled],
  ['guard-taunts-and-fortifies', guardTauntsAndFortifies],
  ['haste-on-kill', hasteOnKill],
  ['holy-spells-grant-regen', holySpellsGrantRegen],
  ['next-action-weightless', nextActionWeightless],
  ['reroll-fight-drop', rerollFightDrop],
  ['shield-lowest-ally-on-block', shieldLowestAllyOnBlock],
  ['ultimate-applies-status', ultimateAppliesStatus],
]
