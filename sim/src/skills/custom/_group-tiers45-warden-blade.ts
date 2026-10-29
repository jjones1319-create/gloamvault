import allyMomentumOnShout from './ally-momentum-on-shout.ts'
import blockNextPhysicalHits from './block-next-physical-hits.ts'
import counterHitMultiplier from './counter-hit-multiplier.ts'
import counterStanceAtFightStart from './counter-stance-at-fight-start.ts'
import damageBonusPerStatusTurn from './damage-bonus-per-status-turn.ts'
import damageTakenPercentTimed from './damage-taken-percent-timed.ts'
import deathless from './deathless.ts'
import dodgeCap from './dodge-cap.ts'
import elementalBlockAndMomentum from './elemental-block-and-momentum.ts'
import executeThresholdBonus from './execute-threshold-bonus.ts'
import guardPrimesHeavy from './guard-primes-heavy.ts'
import immovable from './immovable.ts'
import interceptRowAndCounter from './intercept-row-and-counter.ts'
import oathOfTheVault from './oath-of-the-vault.ts'
import onKillHasteAllyDamage from './on-kill-haste-ally-damage.ts'
import partyLifestealPercent from './party-lifesteal-percent.ts'
import partyMomentumGainPercent from './party-momentum-gain-percent.ts'
import redirectAllyDamagePercent from './redirect-ally-damage-percent.ts'
import riposteEveryDodge from './riposte-every-dodge.ts'
import schoolActionWeight from './school-action-weight.ts'
import schoolComboCap from './school-combo-cap.ts'
import schoolEveryNthFree from './school-every-nth-free.ts'
import spendHpPercent from './spend-hp-percent.ts'
import statusBelowHpOrBossDaze from './status-below-hp-or-boss-daze.ts'
import statusIfRecentlyDazed from './status-if-recently-dazed.ts'
import sureHitVsStatus from './sure-hit-vs-status.ts'
import tauntingDefenseAndMomentum from './taunting-defense-and-momentum.ts'
import thisActionWeight from './this-action-weight.ts'
import timelineRefundPerFight from './timeline-refund-per-fight.ts'
import ultimateStatusAllEnemies from './ultimate-status-all-enemies.ts'
import undyingRage from './undying-rage.ts'
import undyingRageUnbound from './undying-rage-unbound.ts'
import type { HandlerEntry } from './types.ts'

/**
 * Tiers IV–V hooks (Phase 7, pass A) — the Warden's and the Blade's share (docs/classes/warden.md, blade.md §4, the
 * Tier IV and V rows), merged by _group-tiers45.ts. sim/test/custom-registry.test.ts checks every handler file is
 * registered once under its own file name.
 */
export const GROUP: readonly HandlerEntry[] = [
  ['ally-momentum-on-shout', allyMomentumOnShout],
  ['block-next-physical-hits', blockNextPhysicalHits],
  ['counter-hit-multiplier', counterHitMultiplier],
  ['counter-stance-at-fight-start', counterStanceAtFightStart],
  ['damage-bonus-per-status-turn', damageBonusPerStatusTurn],
  ['damage-taken-percent-timed', damageTakenPercentTimed],
  ['deathless', deathless],
  ['dodge-cap', dodgeCap],
  ['elemental-block-and-momentum', elementalBlockAndMomentum],
  ['execute-threshold-bonus', executeThresholdBonus],
  ['guard-primes-heavy', guardPrimesHeavy],
  ['immovable', immovable],
  ['intercept-row-and-counter', interceptRowAndCounter],
  ['oath-of-the-vault', oathOfTheVault],
  ['on-kill-haste-ally-damage', onKillHasteAllyDamage],
  ['party-lifesteal-percent', partyLifestealPercent],
  ['party-momentum-gain-percent', partyMomentumGainPercent],
  ['redirect-ally-damage-percent', redirectAllyDamagePercent],
  ['riposte-every-dodge', riposteEveryDodge],
  ['school-action-weight', schoolActionWeight],
  ['school-combo-cap', schoolComboCap],
  ['school-every-nth-free', schoolEveryNthFree],
  ['spend-hp-percent', spendHpPercent],
  ['status-below-hp-or-boss-daze', statusBelowHpOrBossDaze],
  ['status-if-recently-dazed', statusIfRecentlyDazed],
  ['sure-hit-vs-status', sureHitVsStatus],
  ['taunting-defense-and-momentum', tauntingDefenseAndMomentum],
  ['this-action-weight', thisActionWeight],
  ['timeline-refund-per-fight', timelineRefundPerFight],
  ['ultimate-status-all-enemies', ultimateStatusAllEnemies],
  ['undying-rage', undyingRage],
  ['undying-rage-unbound', undyingRageUnbound],
]
