import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { detection, disarmChance, heroAmbushChance, hiddenFindChance, monsterAmbushChance, perceptionAmbushBonus, rollScout, scoutChance, trapRevealed } from '../src/detection.ts'
import { addLight, lightAfterRoom, lightAtEntry, lightBand, shiftedBand } from '../src/light.ts'
import { Rng } from '../src/rng.ts'
import type { Tuning } from '../src/tuning.ts'

const t = JSON.parse(readFileSync('content/tuning.json', 'utf8')) as Tuning

describe('light (03 §4.2)', () => {
  it('bands and their edges', () => {
    expect(lightBand(t, 100).id).toBe('radiant')
    expect(lightBand(t, 76).id).toBe('radiant')
    expect(lightBand(t, 75).id).toBe('dim')
    expect(lightBand(t, 51).id).toBe('dim')
    expect(lightBand(t, 50).id).toBe('shadowy')
    expect(lightBand(t, 26).id).toBe('shadowy')
    expect(lightBand(t, 25).id).toBe('dark')
    expect(lightBand(t, 1).id).toBe('dark')
    expect(lightBand(t, 0).id).toBe('pitch')
    expect(lightBand(t, -5).id).toBe('pitch')
    expect(lightBand(t, 140).id).toBe('radiant')
  })

  it('darkvision reads one band brighter and never past Radiant', () => {
    expect(shiftedBand(t, lightBand(t, 40), -1).id).toBe('dim')
    expect(shiftedBand(t, lightBand(t, 90), -1).id).toBe('radiant')
    expect(shiftedBand(t, lightBand(t, 0), -1).id).toBe('dark')
  })

  it('rooms drain −5 new / −1 revisited; torches +25; lanterns never lower', () => {
    expect(lightAfterRoom(t, 100, false)).toBe(95)
    expect(lightAfterRoom(t, 95, true)).toBe(94)
    expect(lightAfterRoom(t, 3, false)).toBe(0)
    expect(addLight(t, 90, 25)).toBe(100)
    expect(lightAtEntry(t, 40, 85)).toBe(85)
    expect(lightAtEntry(t, 95, 85)).toBe(95)
  })
})

describe('detection, traps, secrets, scouting (03 §4.3)', () => {
  it('Detection adds the light bonus of 07 §2.3 and the darkvision shift', () => {
    expect(detection(t, 10, 100, 0, 0)).toBe(14)
    expect(detection(t, 10, 60, 0, 0)).toBe(12)
    expect(detection(t, 10, 40, 0, 0)).toBe(10)
    expect(detection(t, 10, 10, 0, 0)).toBe(7)
    expect(detection(t, 10, 0, 0, 0)).toBe(4)
    expect(detection(t, 10, 10, -1, 2)).toBe(12)
    expect(trapRevealed(12, 12)).toBe(true)
    expect(trapRevealed(11, 12)).toBe(false)
  })

  it('disarm: 50% + 2% × (rank × 5 − difficulty / 2), clamped 5–95', () => {
    expect(disarmChance(t, 1, 10)).toBe(50)
    expect(disarmChance(t, 3, 10)).toBe(70)
    expect(disarmChance(t, 1, 30)).toBe(30)
    expect(disarmChance(t, 10, 8)).toBe(95)
    expect(disarmChance(t, 1, 60)).toBe(5)
  })

  it('hidden treasure find and scouting', () => {
    expect(hiddenFindChance(t, 10)).toBe(0)
    expect(hiddenFindChance(t, 14)).toBe(5)
    expect(hiddenFindChance(t, 30)).toBe(20)
    expect(scoutChance(t, 100, 0, 0, 0)).toBe(40)
    expect(scoutChance(t, 60, 0, 1, 0)).toBe(35)
    expect(scoutChance(t, 10, 0, 0, 0)).toBe(15)
    expect(scoutChance(t, 0, 0, 0, 0)).toBe(5)
    const rng = Rng.fromSeed(9)
    const counts = { none: 0, scout: 0, critical: 0 }
    for (let i = 0; i < 4000; i++) counts[rollScout(t, rng, 40)]++
    expect(counts.none).toBeGreaterThan(2200)
    expect(Math.abs(counts.scout - counts.critical)).toBeLessThan(200)
  })
})

describe('ambush (03 §4.4)', () => {
  it('the Perception term: Per 10 → 0, 20 → 10, 30 → 15', () => {
    expect(perceptionAmbushBonus(t, 10)).toBe(0)
    expect(perceptionAmbushBonus(t, 20)).toBe(10)
    expect(perceptionAmbushBonus(t, 30)).toBe(15)
    expect(perceptionAmbushBonus(t, 5)).toBe(0)
  })

  it('heroes: base 15 + band + family − Perception, Orcs noisy, Shades quiet', () => {
    const base = { light: 100, darkvisionShift: 0, bestPerception: 10, monsterModifier: 0, orcsInParty: 0, shadesInParty: 0, extra: 0 }
    expect(heroAmbushChance(t, base)).toBe(15)
    expect(heroAmbushChance(t, { ...base, light: 60 })).toBe(20)
    expect(heroAmbushChance(t, { ...base, light: 40, monsterModifier: 15 })).toBe(45)
    expect(heroAmbushChance(t, { ...base, light: 0, monsterModifier: 15, bestPerception: 20 })).toBe(60)
    expect(heroAmbushChance(t, { ...base, orcsInParty: 2 })).toBe(20)
    expect(heroAmbushChance(t, { ...base, shadesInParty: 1 })).toBe(10)
    expect(heroAmbushChance(t, { ...base, light: 40, darkvisionShift: -1 })).toBe(20)
    expect(heroAmbushChance(t, { ...base, bestPerception: 60, shadesInParty: 1 })).toBe(0)
  })

  it('monsters: the band from their side plus the party Perception, less a slow party', () => {
    expect(monsterAmbushChance(t, 100, 10, 100)).toBe(35)
    expect(monsterAmbushChance(t, 60, 20, 100)).toBe(35)
    expect(monsterAmbushChance(t, 40, 10, 100)).toBe(15)
    expect(monsterAmbushChance(t, 100, 10, 80)).toBe(30)
    expect(monsterAmbushChance(t, 100, 10, 160)).toBe(45)
  })
})
