import alliesFocusGrabbed from './allies-focus-grabbed.ts'
import alliesFocusMarked from './allies-focus-marked.ts'
import ambushEncounter from './ambush-encounter.ts'
import answerNextMeleeHit from './answer-next-melee-hit.ts'
import broodCall from './brood-call.ts'
import cannotNet from './cannot-net.ts'
import cannotWeb from './cannot-web.ts'
import carryWeightReductionPercent from './carry-weight-reduction-percent.ts'
import cookingIngredient from './cooking-ingredient.ts'
import damageVsFamilyPercent from './damage-vs-family-percent.ts'
import dropFromBackRow from './drop-from-back-row.ts'
import dropItemOfGrade from './drop-item-of-grade.ts'
import dropShapePp from './drop-shape-pp.ts'
import dropStolenGold from './drop-stolen-gold.ts'
import elementResistPercent from './element-resist-percent.ts'
import fearStunResistPercent from './fear-stun-resist-percent.ts'
import firstAttackEachFightCrits from './first-attack-each-fight-crits.ts'
import floorClockAdd from './floor-clock-add.ts'
import floorGoldPercent from './floor-gold-percent.ts'
import giveMaterial from './give-material.ts'
import goldFoundPercent from './gold-found-percent.ts'
import handlerDog from './handler-dog.ts'
import hpRegenPercent from './hp-regen-percent.ts'
import lanternGutters from './lantern-gutters.ts'
import larderFeast from './larder-feast.ts'
import loseFearImmunityAndRiposte from './lose-fear-immunity-and-riposte.ts'
import loseResist from './lose-resist.ts'
import maxPoolFlat from './max-pool-flat.ts'
import meal from './meal.ts'
import nextAttackGuaranteedCrit from './next-attack-guaranteed-crit.ts'
import nextFightAmbush from './next-fight-ambush.ts'
import noBroodCall from './no-brood-call.ts'
import noCurse from './no-curse.ts'
import noDeathCloud from './no-death-cloud.ts'
import nothing from './nothing.ts'
import petStatsPercent from './pet-stats-percent.ts'
import petTreat from './pet-treat.ts'
import reelWebbedHeroForward from './reel-webbed-hero-forward.ts'
import repairDurability from './repair-durability.ts'
import revealFloor from './reveal-floor.ts'
import riposteOnBlock from './riposte-on-block.ts'
import rollRarePart from './roll-rare-part.ts'
import statusFlatPerTick from './status-flat-per-tick.ts'
import statusForFloor from './status-for-floor.ts'
import statusNextFights from './status-next-fights.ts'
import statusResistBonus from './status-resist-bonus.ts'
import stealPartyGold from './steal-party-gold.ts'
import swarmHasteOnDeath from './swarm-haste-on-death.ts'
import tollShrineCleanse from './toll-shrine-cleanse.ts'
import tomeTier1 from './tome-tier-1.ts'
import trapFlatDamage from './trap-flat-damage.ts'
import type { HandlerEntry } from './types.ts'
import vanishOneTurn from './vanish-one-turn.ts'
import weakenBolt from './weaken-bolt.ts'
import wearKPercent from './wear-k-percent.ts'

/**
 * Monster, curio, trap, secret and consumable hooks (06 §3.1, 07 §2.4–§2.6, 08 §4–§6). Owned by the Cellars handler
 * pass. The curio, trap and consumable ids are resolved by delve.ts (`resolveDelveLine`); their files hold the
 * contract and `DELVE_SIDE`.
 */
export const GROUP: HandlerEntry[] = [
  ['allies-focus-grabbed', alliesFocusGrabbed],
  ['allies-focus-marked', alliesFocusMarked],
  ['ambush-encounter', ambushEncounter],
  ['answer-next-melee-hit', answerNextMeleeHit],
  ['brood-call', broodCall],
  ['cannot-net', cannotNet],
  ['cannot-web', cannotWeb],
  ['carry-weight-reduction-percent', carryWeightReductionPercent],
  ['cooking-ingredient', cookingIngredient],
  ['damage-vs-family-percent', damageVsFamilyPercent],
  ['drop-from-back-row', dropFromBackRow],
  ['drop-item-of-grade', dropItemOfGrade],
  ['drop-shape-pp', dropShapePp],
  ['drop-stolen-gold', dropStolenGold],
  ['element-resist-percent', elementResistPercent],
  ['fear-stun-resist-percent', fearStunResistPercent],
  ['first-attack-each-fight-crits', firstAttackEachFightCrits],
  ['floor-clock-add', floorClockAdd],
  ['floor-gold-percent', floorGoldPercent],
  ['give-material', giveMaterial],
  ['gold-found-percent', goldFoundPercent],
  ['handler-dog', handlerDog],
  ['hp-regen-percent', hpRegenPercent],
  ['lantern-gutters', lanternGutters],
  ['larder-feast', larderFeast],
  ['lose-fear-immunity-and-riposte', loseFearImmunityAndRiposte],
  ['lose-resist', loseResist],
  ['max-pool-flat', maxPoolFlat],
  ['meal', meal],
  ['next-attack-guaranteed-crit', nextAttackGuaranteedCrit],
  ['next-fight-ambush', nextFightAmbush],
  ['no-brood-call', noBroodCall],
  ['no-curse', noCurse],
  ['no-death-cloud', noDeathCloud],
  ['nothing', nothing],
  ['pet-stats-percent', petStatsPercent],
  ['pet-treat', petTreat],
  ['reel-webbed-hero-forward', reelWebbedHeroForward],
  ['repair-durability', repairDurability],
  ['reveal-floor', revealFloor],
  ['riposte-on-block', riposteOnBlock],
  ['roll-rare-part', rollRarePart],
  ['status-flat-per-tick', statusFlatPerTick],
  ['status-for-floor', statusForFloor],
  ['status-next-fights', statusNextFights],
  ['status-resist-bonus', statusResistBonus],
  ['steal-party-gold', stealPartyGold],
  ['swarm-haste-on-death', swarmHasteOnDeath],
  ['toll-shrine-cleanse', tollShrineCleanse],
  ['tome-tier-1', tomeTier1],
  ['trap-flat-damage', trapFlatDamage],
  ['vanish-one-turn', vanishOneTurn],
  ['weaken-bolt', weakenBolt],
  ['wear-k-percent', wearKPercent],
]
