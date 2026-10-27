import type { Tuning } from './tuning.ts'
import { DERIVED_STATS, type Attribute, type DerivedStat } from './types/enums.ts'

/**
 * Derived stats (03-GAME-DESIGN §2.2) in integer math. This module is pure arithmetic: it takes the attributes and
 * a flat summary of what the hero wears (built elsewhere from the content) and returns the card's numbers.
 * Percent-shaped stats are whole percentage points except `fortune` (tenths of a point: 50 = 5.0%).
 */
export type { Attribute, DerivedStat } from './types/enums.ts'
export type AttributeValues = Readonly<Record<Attribute, number>>

export type DerivedStats = Record<DerivedStat, number>
export type StatBonuses = Partial<Record<DerivedStat, number>>

/** One worn armor piece's share of the family speed penalty and its Strength requirement (08 §2). */
export interface ArmorPieceLoad {
  penaltyShare: number
  strengthRequirement: number
}

/** Species knobs that bend the formulas (05; species.schema.json `rule`). All optional; absent means human. */
export interface SpeciesStatRules {
  speedBase?: number
  hpMultiplier?: number
  manaMultiplier?: number
  carryMultiplier?: number
  dodgeBonus?: number
  dodgeCap?: number
  fortuneBonus?: number
  detectionBonus?: number
  /** Multiplies the armor family's penalty shares (Elf: plate and mail 2.0). */
  armorPenaltyMultiplier?: number
  /** Extra Strength needed over a heavy two-hander's requirement (Halfling +2, D-032). */
  heavyWeaponStrengthExtra?: number
}

export interface StatInputs {
  attributes: AttributeValues
  level: number
  pool: 'stamina' | 'mana'
  /** Which attribute the offense side of Crit Damage reads: Strength for physical classes, Wisdom for casters. */
  offenseAttribute: 'strength' | 'wisdom'
  weapon: {
    attack: number
    focusPower: number
    speedPenalty: number
    strengthRequirement: number
    wisdomRequirement: number
    /** A 1,400-weight two-hander (for the Halfling rule). */
    heavy: boolean
  }
  armor: {
    defense: number
    pieces: readonly ArmorPieceLoad[]
  }
  shieldBlock: number
  /** Flat lines from gear secondaries, affixes, rings, natural armor, traits: added after the formula. */
  flat: StatBonuses
  /** Percent lines (+10% Attack from a shout): applied last, after flats. */
  percent: StatBonuses
  species: SpeciesStatRules
}

export const ALL_TENS: AttributeValues = {
  strength: 10,
  agility: 10,
  vitality: 10,
  endurance: 10,
  wisdom: 10,
  perception: 10,
  willpower: 10,
  luck: 10,
}

export const EMPTY_KIT: Omit<StatInputs, 'attributes' | 'level' | 'pool' | 'offenseAttribute'> = {
  weapon: { attack: 0, focusPower: 0, speedPenalty: 0, strengthRequirement: 0, wisdomRequirement: 0, heavy: false },
  armor: { defense: 0, pieces: [] },
  shieldBlock: 0,
  flat: {},
  percent: {},
  species: {},
}

/** Round half up to an integer (the rulebook's rounding everywhere). */
export function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5)
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

/** cap × x / (x + k), the rational curve the percentage stats use, rounded half up; x < 0 reads as 0. */
export function rationalCurve(x: number, cap: number, k: number): number {
  if (x <= 0) return 0
  return roundHalfUp((cap * x) / (x + k))
}

function mult(x: number, m: number | undefined): number {
  return m === undefined || m === 1 ? x : roundHalfUp(x * m)
}

/** The Speed line's requirement terms: −5 per missing Strength point per piece, relief up to each piece's share (03 §6.1). */
export function armorSpeedTerms(strength: number, pieces: readonly ArmorPieceLoad[], penaltyMultiplier = 1, speedPerMissing = 5): { penalty: number; relief: number; missingPenalty: number } {
  let penalty = 0
  let relief = 0
  let missingPenalty = 0
  for (const p of pieces) {
    const share = roundHalfUp(p.penaltyShare * penaltyMultiplier)
    penalty += share
    const spare = strength - p.strengthRequirement
    if (spare >= 0) relief += Math.min(share, spare)
    else missingPenalty += -spare * speedPerMissing
  }
  return { penalty, relief, missingPenalty }
}

export function deriveStats(t: Tuning, input: StatInputs): DerivedStats {
  const d = t.derived
  const a = input.attributes
  const sp = input.species
  const flat = input.flat
  const out: DerivedStats = {
    hp: 0,
    attackPhys: 0,
    attackSpell: 0,
    defense: 0,
    speed: 0,
    stamina: 0,
    mana: 0,
    momentumGain: 0,
    critRate: 0,
    critDamage: 0,
    accuracy: 0,
    dodge: 0,
    resistance: 0,
    detection: 0,
    variance: 0,
    fortune: 0,
    carry: 0,
    block: 0,
  }

  // HP = 30 + 7 × Vit + 3 × Level, species multiplier on the whole, then flat lines.
  out.hp = mult(d.hp.base + d.hp.perVitality * a.vitality + d.hp.perLevel * input.level, sp.hpMultiplier) + (flat.hp ?? 0)

  // Attack: weapon + 2 × Str, and Strength above the weapon's requirement counts double (an extra 2 × spare).
  // A weapon with no requirement (or no weapon) gives no surplus: the table reads "weapon + 20" at all 10s.
  const spareStr = input.weapon.strengthRequirement > 0 ? Math.max(0, a.strength - input.weapon.strengthRequirement) : 0
  out.attackPhys = input.weapon.attack + d.attackPhys.perStrength * a.strength + (d.attackPhys.surplusStrengthCountsDouble ? d.attackPhys.perStrength * spareStr : 0) + (flat.attackPhys ?? 0)
  out.attackSpell = input.weapon.focusPower + d.attackSpell.perWisdom * a.wisdom + (flat.attackSpell ?? 0)

  out.defense = input.armor.defense + d.defense.perEndurance * a.endurance + (flat.defense ?? 0)

  // Speed = base + 5 × (Agi − 10) − armor penalty − weapon penalty + Str relief − missing-requirement penalty.
  const terms = armorSpeedTerms(a.strength, input.armor.pieces, sp.armorPenaltyMultiplier ?? 1, t.equipment.requirements.speedPerMissingStrength)
  const weaponReq = input.weapon.strengthRequirement + (input.weapon.heavy ? (sp.heavyWeaponStrengthExtra ?? 0) : 0)
  const weaponMissing = Math.max(0, weaponReq - a.strength) * t.equipment.requirements.speedPerMissingStrength
  const speedBase = sp.speedBase ?? d.speed.base
  out.speed = speedBase + d.speed.perAgility * (a.agility - 10) - terms.penalty + terms.relief - terms.missingPenalty - input.weapon.speedPenalty - weaponMissing + (flat.speed ?? 0)

  out.stamina = d.stamina.base + d.stamina.perEndurance * a.endurance + (flat.stamina ?? 0)
  out.mana = mult(d.mana.base + d.mana.perWisdom * a.wisdom, sp.manaMultiplier) + (flat.mana ?? 0)
  if (input.pool === 'stamina') out.mana = 0
  else out.stamina = 0

  out.momentumGain = 100 + d.momentum.percentPerWillpower * (a.willpower - 10) + (flat.momentumGain ?? 0)

  const critX = a.perception - 10 + (a.luck - 10)
  out.critRate = d.critRate.base + rationalCurve(critX, d.critRate.curveMax, d.critRate.curveK) + (flat.critRate ?? 0)
  const offense = input.offenseAttribute === 'strength' ? a.strength : a.wisdom
  out.critDamage = d.critDamage.base + d.critDamage.perPerception * (a.perception - 10) + d.critDamage.perOffenseAttribute * (offense - 10) + (flat.critDamage ?? 0)

  out.accuracy = d.accuracy.base + d.accuracy.perPerception * (a.perception - 10) + (flat.accuracy ?? 0)

  // Dodge: y = (Agi − 10) + 0.5 × (Luck − 10), kept in halves so the integer math stays exact.
  const dodgeY2 = 2 * (a.agility - 10) + (a.luck - 10)
  const dodgeCurve = dodgeY2 <= 0 ? 0 : roundHalfUp((d.dodge.curveMax * dodgeY2) / (dodgeY2 + 2 * d.dodge.curveK))
  out.dodge = dodgeCurve + (flat.dodge ?? 0)

  const resZ2 = 2 * (a.willpower - 10) + (a.endurance - 10)
  out.resistance = (resZ2 <= 0 ? 0 : roundHalfUp((d.resistance.curveMax * resZ2) / (resZ2 + 2 * d.resistance.curveK))) + (flat.resistance ?? 0)

  out.detection = a.perception + (sp.detectionBonus ?? 0) + (flat.detection ?? 0)

  out.variance = d.variance.floorBasePercent + d.variance.floorPerLuck * (a.luck - 10) + (flat.variance ?? 0)

  // Fortune in tenths of a percent: 0.5% per Luck point → 5 tenths per point.
  out.fortune = roundHalfUp(d.fortune.percentPerLuck * 10 * a.luck) + (sp.fortuneBonus ?? 0) * 10 + (flat.fortune ?? 0)

  out.carry = mult(d.carry.baseKg + d.carry.kgPerStrength * a.strength, sp.carryMultiplier) + (flat.carry ?? 0)

  out.block = input.shieldBlock + (flat.block ?? 0)

  // Percent lines last.
  for (const key of DERIVED_STATS) {
    const pct = input.percent[key]
    if (pct) out[key] = roundHalfUp((out[key] * (100 + pct)) / 100)
  }

  // Bounds.
  out.speed = clamp(out.speed, d.speed.floor, d.speed.cap)
  out.critRate = clamp(out.critRate, 0, d.critRate.cap)
  out.accuracy = clamp(out.accuracy, d.accuracy.min, d.accuracy.max)
  out.dodge = Math.min(out.dodge, sp.dodgeCap ?? d.dodge.cap) + (sp.dodgeBonus ?? 0)
  out.resistance = clamp(out.resistance, 0, d.resistance.cap)
  out.variance = Math.min(out.variance, d.variance.floorCapPercent)
  out.fortune = Math.min(out.fortune, d.fortune.cap * 10)
  out.hp = Math.max(1, out.hp)
  out.stamina = Math.max(0, out.stamina)
  out.mana = Math.max(0, out.mana)
  out.carry = Math.max(0, out.carry)
  out.block = clamp(out.block, 0, 100)
  return out
}

/** Hit chance in whole points: Accuracy − target Dodge, never below the floor (03 §2.2: 50). */
export function hitChance(t: Tuning, accuracy: number, targetDodge: number): number {
  return Math.max(t.derived.hit.minChance, accuracy - targetDodge)
}

/** Damage mitigation: damage × 100 / (100 + Defense), rounded half up. */
export function mitigate(damage: number, defense: number, k = 100): number {
  if (defense <= 0) return damage
  return roundHalfUp((damage * k) / (k + defense))
}
