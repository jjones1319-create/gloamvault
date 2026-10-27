import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { questBoard, type DelveSummaryRecord, type MemorialRecord } from '../../../../../sim/src/town.ts'
import { loadContentDir } from '../../../../../tools/sim/loadContent.ts'
import {
  bossName,
  contractChips,
  contractReward,
  daysToNextBoard,
  deathRuleLine,
  delveGrowth,
  delveLosses,
  delveSummaryParts,
  fellWhere,
  isPerilous,
  levelAfterRaise,
  memorialLine,
  namesList,
  outcomeTitle,
  saveFileName,
  THREAT_NAMES,
  WEEK_MS,
  weekIndexAt,
  withGold,
} from './text.ts'

const content = loadContentDir(path.resolve('content'))

describe('names in plain words', () => {
  it('names a boss by its short name, and one the content lacks from its id', () => {
    expect(bossName(content, 'captain-vexa-marrow')).toBe('Captain Vexa Marrow')
    expect(bossName(content, 'no-such-boss')).toBe('the No Such Boss')
  })

  it('joins names the way a person would', () => {
    expect(namesList([])).toBe('')
    expect(namesList(['Varra'])).toBe('Varra')
    expect(namesList(['Varra', 'Pip'])).toBe('Varra and Pip')
    expect(namesList(['Varra', 'Pip', 'Orrin'])).toBe('Varra, Pip and Orrin')
  })
})

describe('the Quest Board (07 §7)', () => {
  it('turns R into gold at the band', () => {
    expect(withGold('Return to town with at least 1.5 R of unbanked gold from one delve.', 300)).toBe('Return to town with at least 450 unbanked gold from one delve.')
    expect(withGold('Pays 0.2 R.', 300)).toBe('Pays 60 gold.')
    expect(withGold('Reach the stairs with light ≥ 50.', 300)).toBe('Reach the stairs with light ≥ 50.')
  })

  it('every contract the board can draw reads as chips and a reward', () => {
    for (let week = 2900; week < 2910; week++) {
      for (const id of questBoard(content, week)) {
        const k = content.contracts.get(id)!
        const reward = contractReward(content, k, 300)
        expect(reward[0]).toMatch(/^\d+ gold$/)
        expect(reward.join(' ')).not.toMatch(/\bR\b/)
        expect(contractChips(content, k, 300).every((x) => x.length > 0)).toBe(true)
      }
    }
    const captain = content.contracts.get('the-grinning-captain')!
    expect(contractChips(content, captain, 300)).toEqual(['Captain Vexa Marrow', 'The Cellars', 'Hard or harder', 'Party of 2+'])
    expect(contractReward(content, captain, 300)).toEqual(['300 gold', '1 Grand Key', 'Standard Material Crate'])
  })

  it('counts the days to the next board', () => {
    const start = 2913 * WEEK_MS
    expect(weekIndexAt(start)).toBe(2913)
    expect(daysToNextBoard(start)).toBe(7)
    expect(daysToNextBoard(start + WEEK_MS - 1000)).toBe(1)
  })
})

describe('the last delve card', () => {
  const summary: DelveSummaryRecord = {
    outcome: 'retreated',
    dungeonId: 'gravehollow-keep',
    floorFrom: 1,
    floorTo: 2,
    gold: 86,
    goldLost: 0,
    items: 3,
    parts: 2,
    fights: 4,
    levelsGained: { 'hero-1': 1 },
    battleXp: { 'hero-1': 75 },
    died: [],
    lost: [],
    raises: 0,
  }
  const heroes = [{ id: 'hero-1', name: 'Orrin' }]

  it('says where, what came home and who grew', () => {
    expect(outcomeTitle('retreated')).toBe('Home safe')
    expect(delveSummaryParts(summary)).toEqual(['Floors 1–2', '+86 gold', '3 items found', '4 fights'])
    expect(delveGrowth(heroes, summary)).toEqual(['Orrin +1 level'])
    expect(delveGrowth(heroes, { ...summary, levelsGained: { 'hero-1': 0 } })).toEqual(['Orrin +75 XP'])
    expect(delveGrowth([], summary)).toEqual([])
  })

  it('a wipe shows the gold lost', () => {
    expect(outcomeTitle('wiped')).toBe('The party fell')
    expect(delveSummaryParts({ ...summary, outcome: 'wiped', gold: 0, goldLost: 120, floorTo: 1, items: 0, fights: 1 })).toEqual(['Floor 1', '120 gold lost', '1 fight'])
  })

  it('names the dead carried home, the lost and the raises (D-088, D-089)', () => {
    expect(delveLosses(summary)).toEqual([])
    expect(delveLosses({ died: ['Varra'] })).toEqual(['Varra died; the party carried the body to the Shrine'])
    expect(delveLosses({ died: ['Varra', 'Pip'], lost: ['Orrin'], raises: 1 })).toEqual([
      'Varra and Pip died; the party carried them to the Shrine',
      'Orrin was lost for good',
      '1 hero raised in the tower',
    ])
    expect(delveLosses({ lost: ['Orrin', 'Pip'], raises: 2 })).toEqual(['Orrin and Pip were lost for good', '2 heroes raised in the tower'])
    // A summary saved before the fields existed reads as none.
    expect(delveLosses({})).toEqual([])
  })
})

describe('the Shrine and the Memorial (D-089, D-090)', () => {
  it('says where a hero fell', () => {
    expect(fellWhere(content, 'gravehollow-keep', 1)).toBe('floor 1 of Gravehollow Keep')
    expect(fellWhere(content, null, null)).toBe('somewhere in the tower')
  })

  it('a raise never goes below level 1', () => {
    expect(levelAfterRaise(5, 2)).toBe(3)
    expect(levelAfterRaise(2, 2)).toBe(1)
    expect(levelAfterRaise(1, 2)).toBe(1)
  })

  it('writes a Memorial line for a hero laid to rest and one lost in a wipe', () => {
    const m: MemorialRecord = { name: 'Bram Ostler', speciesId: 'human', classId: 'warden', level: 2, chosen: false, wayfarerId: 'bram-ostler', dungeonId: 'gravehollow-keep', floor: 1, delve: 2, how: 'laidToRest' }
    expect(memorialLine(content, m)).toBe('Human Warden · level 2 · laid to rest after falling on floor 1 of Gravehollow Keep')
    expect(memorialLine(content, { ...m, how: 'wipe', floor: 3 })).toBe('Human Warden · level 2 · lost with the party on floor 3 of Gravehollow Keep')
  })

  it('puts each death rule in one line', () => {
    expect(deathRuleLine('mortal')).toMatch(/^Mortal: /)
    expect(deathRuleLine('sheltered')).toMatch(/^Sheltered: /)
  })
})

describe('threat bands (D-092)', () => {
  it('names the four bands and flags the two that kill', () => {
    expect(Object.values(THREAT_NAMES)).toEqual(['Easy', 'Even', 'Dangerous', 'Deadly'])
    expect(isPerilous('easy')).toBe(false)
    expect(isPerilous('even')).toBe(false)
    expect(isPerilous('dangerous')).toBe(true)
    expect(isPerilous('deadly')).toBe(true)
  })
})

describe('the save file name', () => {
  it('uses the local date', () => {
    expect(saveFileName(new Date(2026, 9, 27, 23, 59))).toBe('gloamvault-save-2026-10-27.json')
    expect(saveFileName(new Date(2027, 0, 5))).toBe('gloamvault-save-2027-01-05.json')
  })
})
