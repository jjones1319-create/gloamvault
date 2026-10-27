import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ALL_TENS, EMPTY_KIT, armorSpeedTerms, deriveStats, hitChance, mitigate, rationalCurve, roundHalfUp, type StatInputs } from '../src/stats.ts'
import type { Tuning } from '../src/tuning.ts'

const tuning = JSON.parse(readFileSync('content/tuning.json', 'utf8')) as Tuning

const base = (over: Partial<StatInputs> = {}): StatInputs => ({
  attributes: ALL_TENS,
  level: 1,
  pool: 'stamina',
  offenseAttribute: 'strength',
  ...EMPTY_KIT,
  ...over,
})

describe('derived stats (03 §2.2)', () => {
  it('matches the table at all 10s with no gear', () => {
    const s = deriveStats(tuning, base())
    expect(s.hp).toBe(103)
    expect(s.attackPhys).toBe(20)
    expect(s.defense).toBe(10)
    expect(s.speed).toBe(100)
    expect(s.stamina).toBe(60)
    expect(s.momentumGain).toBe(100)
    expect(s.critRate).toBe(5)
    expect(s.critDamage).toBe(150)
    expect(s.accuracy).toBe(90)
    expect(s.dodge).toBe(0)
    expect(s.resistance).toBe(0)
    expect(s.detection).toBe(10)
    expect(s.variance).toBe(90)
    expect(s.fortune).toBe(50)
    expect(s.carry).toBe(50)
    const caster = deriveStats(tuning, base({ pool: 'mana', offenseAttribute: 'wisdom' }))
    expect(caster.mana).toBe(60)
    expect(caster.attackSpell).toBe(20)
  })

  it("reproduces the Warden's creation card (warden.md §2) with per-piece Plate requirements (08 §2)", () => {
    // +1 Str, +2 End, +1 Vit; Copper Shortsword (Attack 10, req 8); Crude Plate Def 20 with 08 §2's shares and
    // requirements; Pine Buckler Block 15; Ring of Vigor +6 HP.
    const s = deriveStats(
      tuning,
      base({
        attributes: { ...ALL_TENS, strength: 11, endurance: 12, vitality: 11 },
        weapon: { attack: 10, focusPower: 0, speedPenalty: 0, strengthRequirement: 8, wisdomRequirement: 0, heavy: false },
        armor: {
          defense: 20,
          pieces: [
            { penaltyShare: 3, strengthRequirement: 10 },
            { penaltyShare: 8, strengthRequirement: 12 },
            { penaltyShare: 5, strengthRequirement: 11 },
            { penaltyShare: 2, strengthRequirement: 9 },
            { penaltyShare: 2, strengthRequirement: 9 },
          ],
        },
        shieldBlock: 15,
        flat: { hp: 6 },
      }),
    )
    expect(s.hp).toBe(116)
    expect(s.attackPhys).toBe(38)
    expect(s.defense).toBe(32)
    expect(s.stamina).toBe(66)
    expect(s.critDamage).toBe(152)
    expect(s.resistance).toBe(1)
    expect(s.carry).toBe(53)
    expect(s.block).toBe(15)
    // The sheet says Speed 81 assuming a set-wide requirement of 10; per piece (08 §2: Breastplate needs Str 12,
    // Greaves 11) the Str-11 Warden gets relief 1 + 2 + 2 = 5 and −5 for the Breastplate: 100 − 20 + 5 − 5 = 80 (D-057).
    expect(s.speed).toBe(80)
  })

  it('relief never exceeds a piece share and missing Strength costs 5 per point', () => {
    expect(armorSpeedTerms(30, [{ penaltyShare: 8, strengthRequirement: 12 }])).toEqual({ penalty: 8, relief: 8, missingPenalty: 0 })
    expect(armorSpeedTerms(10, [{ penaltyShare: 8, strengthRequirement: 12 }])).toEqual({ penalty: 8, relief: 0, missingPenalty: 10 })
    expect(armorSpeedTerms(12, [{ penaltyShare: 8, strengthRequirement: 12 }], 2)).toEqual({ penalty: 16, relief: 0, missingPenalty: 0 })
  })

  it('applies the species knobs and the caps', () => {
    const dwarf = deriveStats(tuning, base({ attributes: { ...ALL_TENS, agility: 8, endurance: 12, vitality: 11, strength: 11 }, species: { speedBase: 95, manaMultiplier: 0.9 }, pool: 'mana', offenseAttribute: 'wisdom' }))
    expect(dwarf.speed).toBe(85)
    expect(dwarf.mana).toBe(54)
    const elf = deriveStats(tuning, base({ attributes: { ...ALL_TENS, vitality: 8 }, species: { hpMultiplier: 0.9, detectionBonus: 2 } }))
    expect(elf.hp).toBe(roundHalfUp(0.9 * (30 + 56 + 3)))
    expect(elf.detection).toBe(12)
    // Agi 60, Luck 12: y = 51 → 30 × 51 / 111 = 14; +30 flat → 44 → the Halfling cap 35 → +5 after the cap = 40.
    const halfling = deriveStats(tuning, base({ attributes: { ...ALL_TENS, agility: 60, luck: 12 }, flat: { dodge: 30 }, species: { dodgeBonus: 5, dodgeCap: 35, fortuneBonus: 5, carryMultiplier: 0.7 } }))
    expect(halfling.dodge).toBe(40)
    expect(halfling.fortune).toBe(110)
    expect(halfling.carry).toBe(35)
    // The rational curves approach their caps slowly: x = 100 → crit 5 + 22; z = 75 → resistance 24. Flat lines hit the caps.
    const legend = deriveStats(tuning, base({ attributes: { ...ALL_TENS, agility: 60, perception: 60, luck: 60, willpower: 60, endurance: 60 }, flat: { critRate: 30, resistance: 30 } }))
    expect(legend.speed).toBe(300)
    expect(legend.critRate).toBe(45)
    expect(legend.accuracy).toBe(100)
    expect(legend.resistance).toBe(40)
    expect(legend.variance).toBe(100)
    const plain = deriveStats(tuning, base({ attributes: { ...ALL_TENS, perception: 60, luck: 60, willpower: 60, endurance: 60 } }))
    expect(plain.critRate).toBe(27)
    expect(plain.resistance).toBe(24)
    const slow = deriveStats(tuning, base({ attributes: { ...ALL_TENS, agility: 1 } }))
    expect(slow.speed).toBe(55)
    const plodding = deriveStats(tuning, base({ weapon: { ...EMPTY_KIT.weapon, speedPenalty: 80 } }))
    expect(plodding.speed).toBe(40)
  })

  it('the rational curves hit the rulebook points', () => {
    expect(rationalCurve(0, 40, 80)).toBe(0)
    expect(rationalCurve(80, 40, 80)).toBe(20)
    const per20 = deriveStats(tuning, base({ attributes: { ...ALL_TENS, perception: 20 } }))
    expect(per20.accuracy).toBe(100)
    expect(per20.critRate).toBe(5 + roundHalfUp((40 * 10) / 90))
  })

  it('percent lines apply last and hit/mitigation helpers follow §2.2', () => {
    const shouted = deriveStats(tuning, base({ percent: { attackPhys: 10 } }))
    expect(shouted.attackPhys).toBe(22)
    expect(hitChance(tuning, 90, 10)).toBe(80)
    expect(hitChance(tuning, 60, 30)).toBe(50)
    expect(mitigate(100, 34)).toBe(75)
    expect(mitigate(18, 34)).toBe(13)
    expect(mitigate(50, 0)).toBe(50)
  })
})
