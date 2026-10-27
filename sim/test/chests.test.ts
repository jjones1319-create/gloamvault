/**
 * The Curio Merchant (03 §8.3, 08 §10): band odds with the fold, the Luck shift and the Shard line; the two-layer
 * pity; sub-type targeting; dupes; eggs; crates; the Tome bag.
 */
import { describe, expect, it } from 'vitest'
import { EMPTY_PITY, buildTomeBag, chestOddsTable, isDupe, openTownChest, type ChestPityState, type ChestResult, type TomeBagState, type TownChestInput } from '../src/chests.ts'
import { Rng } from '../src/rng.ts'
import type { Grade } from '../src/types/enums.ts'
import { chest, fixtureContent, item, tuning as t } from './fixtures/loot-fixture.ts'

const content = fixtureContent()
const standard = chest(content, 'standard-gear-chest')
const grand = chest(content, 'grand-gear-chest')

/** Opens with a fresh seed, or on a shared stream when a loop needs independent draws (the first draw of every small seed is the same number). */
function open(over: Partial<TownChestInput> & Pick<TownChestInput, 'chest'>, rng: Rng | number = 1, pity: ChestPityState = EMPTY_PITY) {
  return openTownChest(content, t, typeof rng === 'number' ? Rng.fromSeed(rng) : rng, { bandGrade: 'F', luck: 10, pity, ...over })
}

describe('odds (08 §10.1)', () => {
  it('Standard at bands F, B and A: the rulebook’s rows, God folded into SS', () => {
    expect(chestOddsTable(t, standard, 'F', 10)).toEqual([
      { grade: 'F', percent: 56 },
      { grade: 'E', percent: 25 },
      { grade: 'D', percent: 14 },
      { grade: 'C', percent: 4 },
      { grade: 'B', percent: 1 },
    ])
    expect(chestOddsTable(t, standard, 'B', 10)).toEqual([
      { grade: 'B', percent: 56 },
      { grade: 'A', percent: 25 },
      { grade: 'S', percent: 14 },
      { grade: 'SS', percent: 5 },
    ])
    expect(chestOddsTable(t, standard, 'A', 10)).toEqual([
      { grade: 'A', percent: 56 },
      { grade: 'S', percent: 25 },
      { grade: 'SS', percent: 19 },
    ])
  })

  it('Luck 14 moves 2 points from the centre to the upper lines (the Odds button’s example); cap 15', () => {
    const lucky = chestOddsTable(t, standard, 'B', 14)
    expect(lucky[0]).toEqual({ grade: 'B', percent: 54 })
    expect(lucky.slice(1).reduce((a, b) => a + b.percent, 0)).toBeCloseTo(46, 5)
    expect(chestOddsTable(t, standard, 'B', 60)[0]).toEqual({ grade: 'B', percent: 41 })
    expect(chestOddsTable(t, standard, 'B', 5)[0]).toEqual({ grade: 'B', percent: 56 })
  })

  it('Grand: one grade up, the top line a Divine Shard 5% from band D (an item below it)', () => {
    expect(chestOddsTable(t, grand, 'F', 10)).toEqual([
      { grade: 'E', percent: 45 },
      { grade: 'D', percent: 35 },
      { grade: 'C', percent: 15 },
      { grade: 'B', percent: 5 },
    ])
    expect(chestOddsTable(t, grand, 'D', 10)).toEqual([
      { grade: 'C', percent: 45 },
      { grade: 'B', percent: 35 },
      { grade: 'A', percent: 15 },
      { grade: 'shard', percent: 5 },
    ])
    expect(chestOddsTable(t, grand, 'B', 10)).toEqual([
      { grade: 'A', percent: 45 },
      { grade: 'S', percent: 35 },
      { grade: 'SS', percent: 15 },
      { grade: 'shard', percent: 5 },
    ])
    expect(chestOddsTable(t, grand, 'A', 10)).toEqual([
      { grade: 'S', percent: 45 },
      { grade: 'SS', percent: 50 },
      { grade: 'shard', percent: 5 },
    ])
    // Luck on a Grand moves from its lowest line.
    expect(chestOddsTable(t, grand, 'B', 14)[0]).toEqual({ grade: 'A', percent: 43 })
  })

  it('a chest with rows only at D and B serves band F from the D row shifted down', () => {
    const rows = chest(content, 'rows-d-b-chest')
    expect(chestOddsTable(t, rows, 'F', 10)).toEqual([
      { grade: 'F', percent: 56 },
      { grade: 'E', percent: 25 },
      { grade: 'D', percent: 14 },
      { grade: 'C', percent: 5 },
    ])
    expect(chestOddsTable(t, rows, 'C', 10)[0]).toEqual({ grade: 'C', percent: 56 }) // the D row, nearest lower
    expect(chestOddsTable(t, rows, 'B', 10)[3]).toEqual({ grade: 'SS', percent: 5 })
  })
})

describe('pity (03 §8.3, 08 §10.1)', () => {
  it('forces a ≥ +1 on the 10th chest without one, a ≥ +2 on the 40th, and resets the counters', () => {
    const only = chest(content, 'centre-only-chest')
    let pity = EMPTY_PITY
    const grades: string[] = []
    const forced: number[] = []
    const rng = Rng.fromSeed(40)
    for (let i = 1; i <= 40; i++) {
      const out = open({ chest: only, subtype: 'weapon', weaponTypesAllowed: ['sword'] }, rng, pity)
      pity = out.pity
      const r = out.result
      expect(r.kind).toBe('item')
      if (r.kind === 'item') {
        grades.push(r.grade)
        if (r.pityGrade) forced.push(i)
      }
      if (i === 9) expect(pity).toEqual({ plusOneCounter: 9, plusTwoCounter: 9 })
      if (i === 10) expect(pity).toEqual({ plusOneCounter: 0, plusTwoCounter: 10 })
    }
    expect(forced).toEqual([10, 20, 30, 40])
    expect(grades[9]).toBe('E')
    expect(grades[19]).toBe('E')
    expect(grades[29]).toBe('E')
    expect(grades[39]).toBe('D')
    expect(grades.filter((g) => g === 'F')).toHaveLength(36)
    expect(pity).toEqual({ plusOneCounter: 0, plusTwoCounter: 0 })
  })

  it('a natural ≥ +1 resets the first layer; a Grand advances both counters by 3', () => {
    const natural = open({ chest: chest(content, 'plus-one-only-chest'), subtype: 'weapon' }, 2, { plusOneCounter: 7, plusTwoCounter: 12 })
    expect(natural.result).toMatchObject({ kind: 'item', grade: 'E', pityGrade: false })
    expect(natural.pity).toEqual({ plusOneCounter: 0, plusTwoCounter: 13 })
    const grandOut = open({ chest: chest(content, 'grand-plus-one-only-chest'), subtype: 'weapon' }, 2, { plusOneCounter: 7, plusTwoCounter: 12 })
    expect(grandOut.result).toMatchObject({ kind: 'item', grade: 'E', pityGrade: false })
    expect(grandOut.pity).toEqual({ plusOneCounter: 0, plusTwoCounter: 15 })
    const forcedTwo = open({ chest: chest(content, 'grand-plus-one-only-chest'), subtype: 'weapon' }, 2, { plusOneCounter: 0, plusTwoCounter: 38 })
    expect(forcedTwo.result).toMatchObject({ kind: 'item', grade: 'D', pityGrade: true })
    expect(forcedTwo.pity).toEqual({ plusOneCounter: 0, plusTwoCounter: 0 })
  })
})

describe('gear chests: sub-types, dupes, the Shard', () => {
  it('targets the sub-type: a sword for a sword list, a buckler for a shield list, plate for a Warden, a trinket for Trinket', () => {
    const only = chest(content, 'centre-only-chest')
    const rng = Rng.fromSeed(50)
    for (let i = 0; i < 50; i++) {
      expect(open({ chest: only, subtype: 'weapon', weaponTypesAllowed: ['sword'] }, rng).result).toMatchObject({ kind: 'item', inst: { itemId: 'copper-longsword' } })
      expect(open({ chest: only, subtype: 'weapon', weaponTypesAllowed: ['shieldBuckler'] }, rng).result).toMatchObject({ kind: 'item', inst: { itemId: 'pine-buckler' } })
      const armor = open({ chest: standard, subtype: 'armor', classId: 'warden' }, rng).result
      expect(armor.kind).toBe('item')
      if (armor.kind === 'item') expect(content.items.get(armor.inst.itemId)?.armorFamily).toBe('plate')
      const trinket = open({ chest: standard, subtype: 'trinket' }, rng).result
      if (trinket.kind === 'item') expect(['ring', 'talisman']).toContain(content.items.get(trinket.inst.itemId)?.kind)
    }
    expect(open({ chest: standard }, 3).odds).toEqual(chestOddsTable(t, standard, 'F', 10))
  })

  it('dupes salvage at 25% unless Keep is offered; the dupe check reads the same thing at the same or a higher grade', () => {
    const only = chest(content, 'centre-only-chest')
    const salvaged = open({ chest: only, subtype: 'weapon', weaponTypesAllowed: ['sword'], ownedItemIds: new Set(['iron-longsword']) }, 4).result
    expect(salvaged).toEqual({ kind: 'salvage', itemId: 'copper-longsword', grade: 'F', materialLadder: 'metal', materialRung: 0, units: 1, pityGrade: false })
    const kept = open({ chest: only, subtype: 'weapon', weaponTypesAllowed: ['sword'], ownedItemIds: new Set(['copper-longsword']), keepOffered: true }, 4).result
    expect(kept).toMatchObject({ kind: 'item', dupe: true, inst: { itemId: 'copper-longsword' } })
    expect(open({ chest: only, subtype: 'weapon', weaponTypesAllowed: ['sword'], ownedItemIds: new Set(['pine-buckler']) }, 4).result).toMatchObject({ kind: 'item', dupe: false })
    expect(isDupe(content, new Set(['bronze-breastplate']), item(content, 'copper-breastplate'))).toBe(true)
    expect(isDupe(content, new Set(['bronze-breastplate']), item(content, 'copper-helm'))).toBe(false)
    expect(isDupe(content, new Set(['copper-longsword']), item(content, 'iron-longsword'))).toBe(false)
    expect(isDupe(content, undefined, item(content, 'iron-longsword'))).toBe(false)
  })

  it('a Grand at band D gives a Divine Shard 5% of the time and never the folded S line; none below band D', () => {
    let shards = 0
    const grades = new Set<string>()
    const rng = Rng.fromSeed(4000)
    for (let i = 0; i < 4000; i++) {
      const r = open({ chest: grand, bandGrade: 'D', subtype: 'weapon' }, rng).result
      if (r.kind === 'shard') shards++
      else if (r.kind === 'item') grades.add(r.grade)
    }
    expect(Math.abs(shards / 40 - 5)).toBeLessThan(1)
    expect(grades.has('S')).toBe(false)
    expect(grades.has('C')).toBe(true)
    for (let i = 0; i < 300; i++) expect(open({ chest: grand, bandGrade: 'F', subtype: 'weapon' }, rng).result.kind).not.toBe('shard')
  })

  it('is deterministic from the seed', () => {
    const a = open({ chest: standard, subtype: 'weapon', classId: 'warden' }, 77)
    const b = open({ chest: standard, subtype: 'weapon', classId: 'warden' }, 77)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('Pet Egg, Material Crate (08 §10.2, §8.5)', () => {
  it('an egg comes from the band’s species pool; a species already owned becomes a bond star', () => {
    const egg = chest(content, 'pet-egg-chest')
    const grades = new Set<Grade>()
    const rng = Rng.fromSeed(300)
    for (let i = 0; i < 300; i++) {
      const r = open({ chest: egg }, rng).result
      expect(r).toMatchObject({ kind: 'egg', petId: 'cellar-hound' })
      if (r.kind === 'egg') grades.add(r.grade)
    }
    expect(grades.has('F')).toBe(true)
    expect(grades.has('E')).toBe(true)
    const species = new Set<string>()
    for (let i = 0; i < 300; i++) {
      const r = open({ chest: egg, bandGrade: 'E' }, rng).result
      if (r.kind === 'egg') species.add(r.petId)
    }
    expect([...species].sort()).toEqual(['cellar-hound', 'crypt-bat'])
    expect(open({ chest: egg, ownedItemIds: new Set(['cellar-hound']) }, 1).result).toMatchObject({ kind: 'bondStar', petId: 'cellar-hound' })
    // The counters count chests since the last +1 / +2 result: a natural higher grade resets them.
    const once = open({ chest: egg }, 1)
    const grade = once.result.kind === 'egg' ? once.result.grade : 'F'
    expect(once.pity.plusOneCounter).toBe(grade === 'F' ? 1 : 0)
    expect(once.pity.plusTwoCounter).toBe(grade === 'F' || grade === 'E' ? 1 : 0)
  })

  it('a crate gives 6 units of the band rung in the ladder of choice and a rare part 10%; a Grand 20 units and the part guaranteed', () => {
    let rare = 0
    const rng = Rng.fromSeed(2000)
    for (let i = 0; i < 2000; i++) {
      const r = open({ chest: chest(content, 'material-crate') }, rng).result
      expect(r).toMatchObject({ kind: 'materials', materialId: 'copper', units: 6 })
      if (r.kind === 'materials' && r.rarePartWon) {
        rare++
        expect(['rat-tail-charm', 'gnaws-tooth']).toContain(r.rarePart?.itemId)
      }
    }
    expect(Math.abs(rare / 20 - 10)).toBeLessThan(2)
    expect(open({ chest: chest(content, 'material-crate'), materialLadder: 'hide' }, 1).result).toMatchObject({ kind: 'materials', materialId: 'rawhide' })
    expect(open({ chest: chest(content, 'material-crate'), bandGrade: 'E' }, 1).result).toMatchObject({ kind: 'materials', materialId: 'bronze' })
    const big = open({ chest: chest(content, 'grand-material-crate') }, 2)
    expect(big.result).toMatchObject({ kind: 'materials', materialId: 'copper', units: 20, rarePartWon: true })
    if (big.result.kind === 'materials') expect(big.result.rarePart).not.toBeNull()
    expect(big.pity).toEqual(EMPTY_PITY)
    expect(() => open({ chest: chest(content, 'material-crate'), materialLadder: 'cloth' }, 1)).toThrow(/no cloth material/)
  })
})

describe('the Tome bag (08 §10.2)', () => {
  const tome = chest(content, 'skill-tome-chest')
  const grandTome = chest(content, 'grand-skill-tome-chest')

  it('builds a bag per tier of what the hero does not own', () => {
    expect(buildTomeBag(content, 'warden', { min: 1, max: 3 }, new Set(['warden-a']))).toEqual({
      '1': ['warden-b', 'warden-c'],
      '2': ['warden-d', 'warden-e'],
      '3': ['warden-f'],
    })
  })

  it('draws without replacement until every bag is empty, then gives a Tome of Practice', () => {
    let bag: TomeBagState | undefined
    const drawn: string[] = []
    const rng = Rng.fromSeed(10)
    for (let i = 0; i < 5; i++) {
      const out = open({ chest: tome, classId: 'warden', heroSkillIds: new Set(['warden-a']), ...(bag === undefined ? {} : { tomeBag: bag }) }, rng)
      expect(out.result.kind).toBe('tome')
      if (out.result.kind === 'tome') {
        drawn.push(out.result.skillId)
        expect(content.skills.get(out.result.skillId)?.tier).toBe(out.result.tier)
      }
      bag = out.tomeBag ?? undefined
    }
    expect([...drawn].sort()).toEqual(['warden-b', 'warden-c', 'warden-d', 'warden-e', 'warden-f'])
    expect(bag).toEqual({ '1': [], '2': [], '3': [] })
    const empty = open({ chest: tome, classId: 'warden', heroSkillIds: new Set(['warden-a']), tomeBag: bag as TomeBagState }, 99)
    expect(empty.result).toEqual({ kind: 'tomeOfPractice' })
  })

  it('an empty bag passes its weight up; the top tier’s leftover goes to the highest bag still holding something', () => {
    const up = open({ chest: tome, classId: 'warden', tomeBag: { '1': [], '2': [], '3': ['warden-f'] } }, 3)
    expect(up.result).toEqual({ kind: 'tome', skillId: 'warden-f', tier: 3 })
    expect(up.tomeBag).toEqual({ '1': [], '2': [], '3': [] })
    const g = open({ chest: grandTome, classId: 'warden', heroSkillIds: new Set(['warden-d', 'warden-e', 'warden-f']) }, 3)
    expect(g.result).toEqual({ kind: 'tome', skillId: 'warden-g', tier: 4 })
    const down = open({ chest: grandTome, classId: 'warden', heroSkillIds: new Set(['warden-g', 'warden-d', 'warden-e']) }, 3)
    expect(down.result).toEqual({ kind: 'tome', skillId: 'warden-f', tier: 3 })
    // Skills learned elsewhere leave a carried bag; a carried bag never refills.
    const learned = open({ chest: tome, classId: 'warden', heroSkillIds: new Set(['warden-b']), tomeBag: { '1': ['warden-a', 'warden-b'], '2': [], '3': [] } }, 3)
    expect(learned.result).toEqual({ kind: 'tome', skillId: 'warden-a', tier: 1 })
    expect(learned.tomeBag).toEqual({ '1': [], '2': [], '3': [] })
    const spent = open({ chest: tome, classId: 'warden', tomeBag: { '1': [], '2': [], '3': [] } }, 3)
    expect(spent.result).toEqual({ kind: 'tomeOfPractice' })
    expect(() => open({ chest: tome }, 1)).toThrow(/classId/)
  })

  it('Standard picks the tier at I 50 / II 35 / III 15 over fresh bags', () => {
    const tiers: Record<number, number> = {}
    const rng = Rng.fromSeed(3000)
    for (let i = 0; i < 3000; i++) {
      const r: ChestResult = open({ chest: tome, classId: 'warden' }, rng).result
      if (r.kind === 'tome') tiers[r.tier] = (tiers[r.tier] ?? 0) + 1
    }
    expect(Math.abs((tiers[1] ?? 0) / 30 - 50)).toBeLessThan(3)
    expect(Math.abs((tiers[2] ?? 0) / 30 - 35)).toBeLessThan(3)
    expect(Math.abs((tiers[3] ?? 0) / 30 - 15)).toBeLessThan(3)
  })
})
