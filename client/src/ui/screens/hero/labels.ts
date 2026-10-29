import type { GearSlot } from '../../../../../sim/src/armory.ts'
import type { Content } from '../../../../../sim/src/content.ts'
import type { EffectiveItemStats } from '../../../../../sim/src/items.ts'
import type { Tuning } from '../../../../../sim/src/tuning.ts'
import type { Effect, ItemDef, SkillDef } from '../../../../../sim/src/types/content.ts'
import { DERIVED_STATS, type ArmorFamily, type Attribute, type DerivedStat, type FieldSkill, type Pool, type Stance, type Target } from '../../../../../sim/src/types/enums.ts'

/**
 * The words the hero screens show for the sim's ids (our own wording; 03 §2.1, §2.2, §6.1, §7.6, §9). Pure, so the
 * new-hero and hero screens say the same thing the same way.
 */

export const ATTRIBUTE_NAME: Readonly<Record<Attribute, string>> = {
  strength: 'Strength',
  agility: 'Agility',
  vitality: 'Vitality',
  endurance: 'Endurance',
  wisdom: 'Wisdom',
  perception: 'Perception',
  willpower: 'Willpower',
  luck: 'Luck',
}

export const ATTRIBUTE_SHORT: Readonly<Record<Attribute, string>> = {
  strength: 'Str',
  agility: 'Agi',
  vitality: 'Vit',
  endurance: 'End',
  wisdom: 'Wis',
  perception: 'Per',
  willpower: 'Wil',
  luck: 'Lck',
}

/** What each attribute does that you can feel (03 §2.1's headline column, in our own short words). */
export const ATTRIBUTE_HINT: Readonly<Record<Attribute, string>> = {
  strength: 'Weapon and bow Attack',
  agility: 'Speed: more turns',
  vitality: 'HP',
  endurance: 'Defense and Stamina',
  wisdom: 'Spells, heals, Mana',
  perception: 'Fewer ambushes, finds traps',
  willpower: 'Shrugs off statuses',
  luck: 'Crits and better loot',
}

export const STAT_NAME: Readonly<Record<DerivedStat, string>> = {
  hp: 'HP',
  attackPhys: 'Attack',
  attackSpell: 'Spell attack',
  defense: 'Defense',
  speed: 'Speed',
  stamina: 'Stamina',
  mana: 'Mana',
  momentumGain: 'Momentum gain',
  critRate: 'Crit chance',
  critDamage: 'Crit damage',
  accuracy: 'Accuracy',
  dodge: 'Dodge',
  resistance: 'Resistance',
  detection: 'Detection',
  variance: 'Damage floor',
  fortune: 'Fortune',
  carry: 'Carry',
  block: 'Block',
}

const PERCENT_STATS: ReadonlySet<DerivedStat> = new Set(['critRate', 'critDamage', 'accuracy', 'dodge', 'resistance', 'block', 'momentumGain', 'variance'])

/** A derived stat's total as the card shows it (Fortune is kept in tenths of a percent by the sim). */
export function formatStat(stat: DerivedStat, value: number): string {
  if (stat === 'fortune') return `${(value / 10).toFixed(1)}%`
  if (stat === 'carry') return `${value} kg`
  return PERCENT_STATS.has(stat) ? `${value}%` : String(value)
}

/** A signed line on an item or a comparison: "+4", "−2", "+3%". */
export function signed(stat: DerivedStat, value: number): string {
  const sign = value < 0 ? '−' : '+'
  const abs = Math.abs(value)
  if (stat === 'fortune') return `${sign}${(abs / 10).toFixed(1)}%`
  const unit = stat === 'carry' ? ' kg' : PERCENT_STATS.has(stat) ? '%' : ''
  return `${sign}${abs}${unit}`
}

export const FIELD_SKILL_NAME: Readonly<Record<FieldSkill, string>> = {
  lockpicking: 'Lockpicking',
  trapDisarm: 'Trap disarm',
  foraging: 'Foraging',
  fieldRepair: 'Field repair',
  firstAid: 'First aid',
  haggling: 'Haggling',
  cooking: 'Cooking',
  cartography: 'Cartography',
}

export const SLOT_NAME: Readonly<Record<GearSlot, string>> = {
  mainHand: 'Main hand',
  offHand: 'Off hand',
  helmet: 'Helmet',
  chest: 'Chest',
  legs: 'Legs',
  boots: 'Boots',
  gloves: 'Gloves',
  ring0: 'Ring 1',
  ring1: 'Ring 2',
  talisman: 'Talisman',
  relic: 'Relic',
}

export const POOL_NAME: Readonly<Record<Pool, string>> = { stamina: 'Stamina', mana: 'Mana' }

export const ARMOR_NAME: Readonly<Record<ArmorFamily, string>> = { plate: 'Plate', mail: 'Mail', leather: 'Leather', robes: 'Robes' }

export const STANCE_NAME: Readonly<Record<Stance, string>> = { fierce: 'Fierce', guard: 'Guard', mend: 'Mend', forage: 'Forage' }

/** One plain line per pet stance (03 §9), with the numbers from tuning. */
export function stanceLine(t: Tuning, stance: Stance): string {
  switch (stance) {
    case 'fierce':
      return 'Attacks whatever you attack.'
    case 'guard':
      return `Takes ${t.pets.stances.guardInterceptPercent}% of the hits meant for you.`
    case 'mend':
      return 'Heals and cleanses the most hurt ally.'
    case 'forage':
      return `Doesn't fight; finds more, +${t.pets.stances.forageGoldPercent}% gold.`
  }
}

/** "Light 800" / "Normal 1000" / "Heavy 1400" (03 §3.1 weights). */
export function weightText(t: Tuning, weight: number | null): string {
  if (weight === null) return 'Passive'
  const w = t.combat.weights
  const name = weight <= w.light ? 'Light' : weight >= w.heavy ? 'Heavy' : 'Normal'
  return `${name} ${weight.toLocaleString('en-US')}`
}

/** "10 Stamina · Light 800", "Passive", "Ultimate · 100 Momentum". */
export function skillMeta(t: Tuning, skill: SkillDef, pool: Pool): string {
  if (skill.isUltimate) return `Ultimate · 100 Momentum · ${weightText(t, skill.weight)}`
  if (skill.type === 'passive') return 'Passive · always on'
  return `${skill.cost > 0 ? `${skill.cost} ${POOL_NAME[pool]}` : 'Free'} · ${weightText(t, skill.weight)}`
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V']
export function tierName(tier: number): string {
  return ROMAN[tier] ?? String(tier)
}

/** The skill's equipment need in words, or null (09: shield, weapon types, two hands, two weapons). */
export function requirementText(skill: SkillDef): string | null {
  const r = skill.requirements
  if (!r) return null
  const parts: string[] = []
  if (r.shield) parts.push('a shield')
  if (r.weaponTypes && r.weaponTypes.length > 0) {
    const names = r.weaponTypes.map(weaponTypeName)
    const article = /^[aeiou]/.test(names[0] ?? '') ? 'an' : 'a'
    parts.push(r.weaponTypes.some((w) => w.includes('bow')) ? 'a bow or crossbow' : `${article} ${names.join(' or ')}`)
  }
  if (r.twoHanded) parts.push('a two-handed weapon')
  if (r.dualWield) parts.push('two weapons')
  return parts.length ? `Needs ${parts.join(' and ')}` : null
}

export function weaponTypeName(type: string): string {
  const special: Record<string, string> = {
    greatsword: 'greatsword',
    greataxe: 'great axe',
    shortSpear: 'short spear',
    throwingKnife: 'throwing knives',
    shieldBuckler: 'buckler',
    shieldKite: 'kite shield',
    shieldTower: 'tower shield',
  }
  return special[type] ?? type.replace(/([A-Z])/g, ' $1').toLowerCase()
}

/** The item's kind in a word or two: "Sword · one hand", "Plate", "Buckler", "Ring". */
export function itemKindText(def: ItemDef): string {
  if (def.kind === 'weapon') return `${cap(weaponTypeName(def.weaponType ?? 'weapon'))} · ${def.hands === 2 ? 'two hands' : 'one hand'}`
  if (def.kind === 'armor') return def.armorFamily ? ARMOR_NAME[def.armorFamily] : 'Armor'
  if (def.kind === 'shield') return cap(weaponTypeName(def.weaponType ?? 'shield'))
  if (def.kind === 'focus') return 'Focus · off hand'
  return cap(def.kind)
}

export function cap(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s
}

/** The lines an item gives right now, main line first: [stat, value] pairs (effective: wear and +N count). */
export function itemLines(s: EffectiveItemStats, main: readonly DerivedStat[] = []): [DerivedStat, number][] {
  const out: [DerivedStat, number][] = []
  for (const stat of main) {
    const v = s.stats[stat]
    if (v) out.push([stat, v])
  }
  for (const stat of DERIVED_STATS) {
    if (main.includes(stat)) continue
    const v = s.stats[stat]
    if (v) out.push([stat, v])
  }
  return out
}

/** The stats a slot is mostly for, so they come first on its row (03 §6.1 "Main stat"). */
export function mainStatsFor(def: ItemDef, pool: Pool): DerivedStat[] {
  if (def.slot === 'mainHand') return pool === 'mana' ? ['attackSpell', 'attackPhys'] : ['attackPhys', 'attackSpell']
  if (def.kind === 'shield') return ['block', 'defense']
  if (def.kind === 'focus') return ['attackSpell', 'mana']
  if (def.kind === 'armor') return ['defense', 'hp']
  return []
}

const TARGET_WORDS: Partial<Record<Target, string>> = {
  self: 'you',
  ally: 'an ally',
  allyLowest: 'the most hurt ally',
  allAllies: 'every ally',
  enemy: 'an enemy',
  enemyFront: 'the enemy front row',
  enemyBack: 'the enemy back row',
  allEnemies: 'every enemy',
  enemyRow: 'an enemy row',
  room: 'the room',
}

/** A relic's active (or any simple effect line) in a few words, for the gear row. */
export function effectText(content: Content, e: Effect): string {
  const who = e.target ? (TARGET_WORDS[e.target] ?? e.target) : ''
  const turns = e.duration ? `, ${e.duration} turn${e.duration === 1 ? '' : 's'}` : ''
  switch (e.kind) {
    case 'applyStatus':
      return `${content.statuses.get(e.status!)?.name ?? e.status} on ${who}${turns}`
    case 'light':
      return `Light +${e.amount ?? 0}${turns}`
    case 'heal':
      return `Heal ${who}${e.percent ? ` ${e.percent}%` : ''}`
    case 'shield':
      return `Shield ${who}`
    case 'damage':
      return `${e.multiplier ?? 1}× ${e.damageType ?? ''} to ${who}`
    default:
      return cap(e.kind)
  }
}

/** A relic's active as the card says it (08 §3): "Once per fight: Taunts every enemy … (instant)". */
export function relicActiveText(content: Content, def: ItemDef): string {
  const a = def.active
  if (!a) return ''
  const when = a.timing === 'afterFight' ? 'After a fight, once per floor' : a.usesPerFloor ? 'Once per floor' : a.usesPerFight > 1 ? `${a.usesPerFight} times a fight` : 'Once per fight'
  const what = a.text ?? a.effects.map((e) => effectText(content, e)).join('; ')
  return `${when}: ${what}${a.instant ? ' (instant: no turn spent)' : ''}`
}

/** The short lines a gear row shows for an item: its stat lines, or a relic's once-per-fight active. */
export function itemSummary(content: Content, def: ItemDef, s: EffectiveItemStats, pool: Pool, max = 3): string {
  if (s.band === 'broken') return 'Broken: gives nothing until repaired'
  const lines = itemLines(s, mainStatsFor(def, pool))
    .slice(0, max)
    .map(([stat, v], i) => `${STAT_NAME[stat]} ${i === 0 && v > 0 ? formatStat(stat, v) : signed(stat, v)}`)
  if (def.active) lines.push(relicActiveText(content, def))
  return lines.length ? lines.join(' · ') : '—'
}
