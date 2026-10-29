import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { heroCardStats } from '../../../../sim/src/hero.ts'
import { addHero, newProfile } from '../../../../sim/src/town.ts'
import { ATTRIBUTES, DERIVED_STATS } from '../../../../sim/src/types/enums.ts'
import { loadContentDir } from '../../../../tools/sim/loadContent.ts'
import { attributeLine, derivedLine, hpLine, itemStatLine, levelLine, momentumLine, oneIn, poolLine, speedCompareLine, times } from './statLines.ts'

const c = loadContentDir(path.resolve('content'))
const t = c.tuning

function hero(classId = 'warden', speciesId = 'dwarf') {
  return addHero(c, newProfile(3), { name: 'Orrin', speciesId, classId, eggPetId: null }).hero
}

describe('the stat lines (12 Phase 8: "Speed 120: you act 1.2× as often")', () => {
  it('say the brief’s three examples in its own words', () => {
    const stats = { ...heroCardStats(c, t, hero()), speed: 120, detection: 14, block: 20 }
    expect(derivedLine(t, 'speed', 120, stats)).toBe('Speed 120: you act 1.2× as often as an ordinary adult (Speed 100).')
    expect(derivedLine(t, 'detection', 14, stats)).toMatch(/^Detection 14: in a bright room you spot traps and secret doors of difficulty 18 or less; in shadow, 14; in the dark, 11\.$/)
    expect(derivedLine(t, 'block', 20, stats)).toBe('Block 20%: a physical hit is halved about 1 time in 5.')
  })

  it('give every attribute and every derived stat a line with the hero’s own number', () => {
    for (const cls of ['warden', 'arcanist']) {
      const h = hero(cls, 'human')
      const stats = heroCardStats(c, t, h)
      const pool = c.classes.get(cls)!.pool === 'mana' ? 'mana' : 'stamina'
      for (const a of ATTRIBUTES) {
        const line = attributeLine(t, a, h.attributes[a], stats, pool)
        expect(line.startsWith(`${a[0]!.toUpperCase()}${a.slice(1)} ${h.attributes[a]}:`), line).toBe(true)
        expect(line).not.toMatch(/undefined|NaN/)
      }
      for (const s of DERIVED_STATS) {
        const line = derivedLine(t, s, stats[s], stats)
        expect(line.length, s).toBeGreaterThan(20)
        expect(line).not.toMatch(/undefined|NaN/)
      }
    }
  })

  it('read the defense curve and the pools from tuning', () => {
    const stats = heroCardStats(c, t, hero())
    expect(derivedLine(t, 'defense', 100, stats)).toBe('Defense 100: you take 50% of each hit’s damage.'.replace('’', "'"))
    expect(poolLine(t, 'stamina', 60)).toBe(`Stamina 60: skills cost it. You get ${t.derived.stamina.regenPercentPerTurn}% (6) back each turn and ${t.derived.stamina.basicAttackRestorePercent}% from a basic attack; Guard gives ${t.combat.guard.poolRestorePercent}%.`)
    expect(poolLine(t, 'mana', 50, 20)).toMatch(/^Mana 20\/50: spells cost it/)
  })

  it('speak the fight’s gauges and speed', () => {
    expect(momentumLine(t, 40, 'Shield Wall')).toMatch(/^Momentum 40\/100: \+20 when you act.*At 100, Shield Wall is ready\.$/)
    expect(momentumLine(t, 100, null)).toMatch(/Your Ultimate is ready\.$/)
    expect(hpLine('Orrin', 30, 140, true)).toMatch(/die for good/)
    expect(hpLine('Orrin', 30, 140, false)).toMatch(/brings them back/)
    expect(speedCompareLine(t, 125, { name: 'Orrin', speed: 72 })).toBe('Speed 125: acts 1.25× as often as Speed 100, 1.74× as often as Orrin (72).')
  })

  it('name an item’s share, then the stat with the hero’s number', () => {
    const stats = heroCardStats(c, t, hero())
    expect(itemStatLine(t, 'attackPhys', 12, stats, 'Crude Sword')).toMatch(new RegExp(`^Crude Sword: \\+12 Attack\\. Attack ${stats.attackPhys}: `))
    expect(itemStatLine(t, 'dodge', -2, stats, 'Plate')).toMatch(/^Plate: −2% Dodge\./)
  })

  it('format ratios and odds simply', () => {
    expect(times(1.2)).toBe('1.2×')
    expect(times(0.72)).toBe('0.72×')
    expect(times(2)).toBe('2×')
    expect(oneIn(20)).toBe(5)
    expect(oneIn(0)).toBeNull()
    expect(levelLine(3, 10, 98, false)).toMatch(/^Level 3: 10 of 98 battle XP to level 4\./)
    expect(levelLine(99, 0, 0, true)).toBe('Level 99: the top level.')
  })
})
