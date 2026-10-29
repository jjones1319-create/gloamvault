import { disarmChance } from '../../../../sim/src/detection.ts'
import type { Tuning } from '../../../../sim/src/tuning.ts'
import type { Attribute, DerivedStat, FieldSkill, Pool } from '../../../../sim/src/types/enums.ts'

/**
 * Every stat in plain words with the hero's own numbers (12 Phase 8: "Speed 120: you act 1.2× as often"; pass B). The
 * words follow 03 §2.1–§2.2 and every number comes from the hero or from tuning, never from here. Pure, so the hero
 * screen, the item cards and the fight HUD say the same thing the same way (StatTip shows the line).
 */

export type StatValues = Readonly<Record<DerivedStat, number>>

/** "1.2×", "0.72×", "2×", "1.25×": how many times as often. */
export function times(x: number): string {
  const r = Math.round(x * 100) / 100
  return `${Number.isInteger(r) ? r.toFixed(0) : String(r)}×`
}

/** About one in N, for a percent chance ("1 time in 5"); null for 0. */
export function oneIn(percent: number): number | null {
  return percent > 0 ? Math.max(1, Math.round(100 / percent)) : null
}

function signedNumber(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : `+${n}`
}

/** The light bands' Detection bonuses (07 §2.3): the best, the middle (0) and the dark ones, from tuning. */
function lightDetection(t: Tuning): { bright: number; dark: number } {
  const bands = t.exploration.light.bands
  const bright = bands.find((b) => b.id === 'radiant')?.detection ?? 0
  const dark = bands.find((b) => b.id === 'dark')?.detection ?? 0
  return { bright, dark }
}

const POOL_WORD: Readonly<Record<Pool, string>> = { stamina: 'Stamina', mana: 'Mana' }

/** An attribute's line (03 §2.1's headline, then what it feeds on the card). */
export function attributeLine(t: Tuning, attr: Attribute, value: number, stats: StatValues, pool: Pool): string {
  const d = t.derived
  switch (attr) {
    case 'strength':
      return `Strength ${value}: +${d.attackPhys.perStrength} Attack a point with weapons and bows (your Attack ${stats.attackPhys}). It also sets how much you carry (${stats.carry} kg) and eases heavy gear's slowness.`
    case 'agility':
      return `Agility ${value}: ${signedNumber(d.speed.perAgility * (value - 10))} Speed from Agility (your Speed ${stats.speed}: you act ${times(stats.speed / d.speed.base)} as often as an ordinary adult). It also raises Dodge (${stats.dodge}%).`
    case 'vitality':
      return `Vitality ${value}: +${d.hp.perVitality} HP a point (your HP ${stats.hp}).`
    case 'endurance':
      return `Endurance ${value}: +${d.defense.perEndurance} Defense${pool === 'stamina' ? ` and +${d.stamina.perEndurance} Stamina` : ''} a point (Defense ${stats.defense}${pool === 'stamina' ? `, Stamina ${stats.stamina}` : ''}).`
    case 'wisdom':
      return `Wisdom ${value}: +${d.attackSpell.perWisdom} spell Attack${pool === 'mana' ? ` and +${d.mana.perWisdom} Mana` : ''} a point (spell Attack ${stats.attackSpell}${pool === 'mana' ? `, Mana ${stats.mana}` : ''}), and +${t.xp.wisdomPercentPerPoint}% to all XP for every point above 10.`
    case 'perception':
      return `Perception ${value}: your Detection (${stats.detection}) finds traps and secret doors. It also cuts the chance of being ambushed and raises Accuracy (${stats.accuracy}%) and crits.`
    case 'willpower':
      return `Willpower ${value}: Resistance ${stats.resistance}% to statuses, and your Momentum fills at ${stats.momentumGain}% speed.`
    case 'luck':
      return `Luck ${value}: crits, better loot, and Fortune ${(stats.fortune / 10).toFixed(1)}% (a skill costs nothing). Luck never grows by use: +1 for each dungeon's final boss you first defeat.`
  }
}

/** A derived stat's line (03 §2.2), with the hero's numbers. */
export function derivedLine(t: Tuning, stat: DerivedStat, value: number, stats: StatValues): string {
  const d = t.derived
  switch (stat) {
    case 'hp':
      return `HP ${value}: at 0 you are down, and a revive in time brings you back. It is ${d.hp.base} + ${d.hp.perVitality} × Vitality + ${d.hp.perLevel} × level.`
    case 'attackPhys':
      return `Attack ${value}: your weapon plus ${d.attackPhys.perStrength} × Strength. A hit deals about Attack × the move's power, less the target's Defense.`
    case 'attackSpell':
      return `Spell attack ${value}: your focus plus ${d.attackSpell.perWisdom} × Wisdom. Spells and heals scale with it.`
    case 'defense': {
      const taken = Math.round((100 * d.defense.mitigationK) / (d.defense.mitigationK + Math.max(0, value)))
      return `Defense ${value}: you take ${taken}% of each hit's damage.`
    }
    case 'speed':
      return `Speed ${value}: you act ${times(value / d.speed.base)} as often as an ordinary adult (Speed ${d.speed.base}).`
    case 'stamina':
      return poolLine(t, 'stamina', value)
    case 'mana':
      return poolLine(t, 'mana', value)
    case 'momentumGain':
      return `Momentum gain ${value}%: Momentum fills at ${value}% speed (+${d.momentum.onAct} when you act, +${d.momentum.onHit} when hit). At ${d.momentum.ultimateCost} your Ultimate is ready.`
    case 'critRate': {
      const n = oneIn(value)
      return n === null ? `Crit chance 0%: Perception and Luck above 10 bring critical hits.` : `Crit chance ${value}%: about 1 hit in ${n} is a critical hit, for ${stats.critDamage}% damage.`
    }
    case 'critDamage':
      return `Crit damage ${value}%: a critical hit deals ${times(value / 100)} damage.`
    case 'accuracy':
      return `Accuracy ${value}%: your chance to hit is ${value}% less the target's Dodge, never below ${d.hit.minChance}%.`
    case 'dodge':
      return value > 0 ? `Dodge ${value}%: attacks aimed at you miss ${value}% more often (it comes off the attacker's Accuracy).` : `Dodge 0%: Agility and Luck above 10 make attacks miss you.`
    case 'resistance':
      return value > 0 ? `Resistance ${value}%: a ${value}% chance to shrug off each poison, bleed, stun or other harmful status.` : `Resistance 0%: Willpower and Endurance above 10 help you shrug off statuses.`
    case 'detection': {
      const { bright, dark } = lightDetection(t)
      return `Detection ${value}: in a bright room you spot traps and secret doors of difficulty ${value + bright} or less; in shadow, ${value}; in the dark, ${value + dark}.`
    }
    case 'variance':
      return `Damage floor ${value}%: your hits land between ${value}% and ${d.variance.ceilingPercent}% of their damage.`
    case 'fortune':
      return `Fortune ${(value / 10).toFixed(1)}%: the chance a skill costs nothing.`
    case 'carry':
      return `Carry ${value} kg: past it, every 10% over costs ${d.carry.speedPenaltyPer10PercentOver}% Speed.`
    case 'block': {
      const n = oneIn(value)
      return n === null ? `Block 0%: a shield blocks physical hits.` : `Block ${value}%: a physical hit is halved about 1 time in ${n}.`
    }
  }
}

/** A pool's line: what it pays for and how it comes back (03 §2.2). */
export function poolLine(t: Tuning, pool: Pool, max: number, now?: number): string {
  const p = pool === 'mana' ? t.derived.mana : t.derived.stamina
  const perTurn = Math.round((max * p.regenPercentPerTurn) / 100)
  const head = now === undefined ? `${POOL_WORD[pool]} ${max}` : `${POOL_WORD[pool]} ${now}/${max}`
  return `${head}: ${pool === 'mana' ? 'spells' : 'skills'} cost it. You get ${p.regenPercentPerTurn}% (${perTurn}) back each turn and ${p.basicAttackRestorePercent}% from a basic attack; Guard gives ${t.combat.guard.poolRestorePercent}%.`
}

/** The Momentum gauge in a fight (03 §2.2): how it fills, and the Ultimate at the top. */
export function momentumLine(t: Tuning, now: number, ultimateName: string | null): string {
  const m = t.derived.momentum
  const ready = now >= m.ultimateCost
  return `Momentum ${now}/${m.ultimateCost}: +${m.onAct} when you act, +${m.onHit} when hit, +${m.onAllyAction} when an ally acts. ${ready ? `${ultimateName ?? 'Your Ultimate'} is ready.` : `At ${m.ultimateCost}, ${ultimateName ?? 'your Ultimate'} is ready.`}`
}

/** The HP bar in a fight: what 0 means under the save's rule (D-088). */
export function hpLine(name: string, hp: number, max: number, mortal: boolean): string {
  return `${name}: HP ${hp}/${max}. At 0 they are down; ${mortal ? 'revive them in time or they die for good' : 'a revive in time brings them back'}.`
}

/** Speed against another actor: "Speed 125: acts 1.74× as often as Orrin (72)". */
export function speedCompareLine(t: Tuning, speed: number, other?: { name: string; speed: number }): string {
  const base = `Speed ${speed}: acts ${times(speed / t.derived.speed.base)} as often as Speed ${t.derived.speed.base}`
  if (!other || other.speed <= 0) return `${base}.`
  return `${base}, ${times(speed / other.speed)} as often as ${other.name} (${other.speed}).`
}

/** An item's stat line on an item card: what the piece gives, then the stat in a sentence with the hero's number. */
export function itemStatLine(t: Tuning, stat: DerivedStat, amount: number, stats: StatValues, itemName: string): string {
  const unit = stat === 'carry' ? ' kg' : PERCENT_LIKE.has(stat) ? '%' : ''
  const shown = stat === 'fortune' ? `${signedNumber(amount / 10)}%` : `${signedNumber(amount)}${unit}`
  return `${itemName}: ${shown} ${STAT_WORD[stat]}. ${derivedLine(t, stat, stats[stat], stats)}`
}

const PERCENT_LIKE: ReadonlySet<DerivedStat> = new Set(['critRate', 'critDamage', 'accuracy', 'dodge', 'resistance', 'block', 'momentumGain', 'variance'])

const STAT_WORD: Readonly<Record<DerivedStat, string>> = {
  hp: 'HP',
  attackPhys: 'Attack',
  attackSpell: 'spell Attack',
  defense: 'Defense',
  speed: 'Speed',
  stamina: 'Stamina',
  mana: 'Mana',
  momentumGain: 'Momentum gain',
  critRate: 'crit chance',
  critDamage: 'crit damage',
  accuracy: 'Accuracy',
  dodge: 'Dodge',
  resistance: 'Resistance',
  detection: 'Detection',
  variance: 'damage floor',
  fortune: 'Fortune',
  carry: 'carry',
  block: 'Block',
}

/** A field skill's line at its rank (03 §7.6; the numbers from tuning where it keeps them). */
export function fieldSkillLine(t: Tuning, skill: FieldSkill, rank: number): string {
  const f = t.skills.fieldSkills
  switch (skill) {
    case 'lockpicking':
      return `Lockpicking ${rank}: opens locked chests and doors without a key; a higher rank picks more often.`
    case 'trapDisarm':
      return `Trap disarm ${rank}: disarms a trap you have spotted, for its reward; a fumble sets it off. Against a difficulty-10 trap you succeed ${disarmChance(t, rank, 10)}% of the time.`
    case 'foraging':
      return `Foraging ${rank}: finds torches, herbs and cooking ingredients in rest rooms.`
    case 'fieldRepair':
      return `Field repair ${rank}: mends worn gear in the dungeon, before it breaks.`
    case 'firstAid':
      return `First aid ${rank}: gets a downed ally back up out of a fight and bandages Bleed${rank >= f.firstAid.inCombatFromRank ? '; at your rank, in a fight too' : `; from rank ${f.firstAid.inCombatFromRank}, in a fight too`}.`
    case 'haggling':
      return `Haggling ${rank}: shops charge you ${Math.max(f.haggling.floorPercent, f.haggling.basePercent - f.haggling.perRank * rank)}% and buy at ${f.haggling.sellBasePercent + f.haggling.sellPerRank * rank}%.`
    case 'cooking':
      return `Cooking ${rank}: a meal at a rest gives +${f.cooking.statPercent}% to a stat for the next floor.`
    case 'cartography': {
      const rings = Math.floor(rank / f.cartography.ringPerRanks)
      return `Cartography ${rank}: the map shows ${rings === 0 ? 'no extra ring' : rings === 1 ? 'one extra ring' : `${rings} extra rings`} of rooms around you (one more every ${f.cartography.ringPerRanks} ranks).`
    }
  }
}

/** The hero's level and XP bar (D-082, D-097). */
export function levelLine(level: number, into: number, need: number, atCap: boolean): string {
  if (atCap) return `Level ${level}: the top level.`
  return `Level ${level}: ${into} of ${need} battle XP to level ${level + 1}. Won fights give it, more against stronger foes; each level costs more than the one before and adds to the class's attributes.`
}
