/**
 * Fight loot, treasure rooms and in-dungeon chests (03 §6.2, §8.3; 06 §1, §8.5; 07 §2.7; 08 §10.3, §11).
 * Rates are checked over thousands of seeded fights; every run is deterministic.
 */
import { describe, expect, it } from 'vitest'
import { fightGold, lootTableForFloor, openDungeonChest, pickGearItem, rollFightLoot, rollTreasureRoom, stoneItemFor, type DungeonChest, type FightLootInput, type FightMonster } from '../src/loot.ts'
import { Rng } from '../src/rng.ts'
import type { MonsterDef } from '../src/types/content.ts'
import { gradeIndex, type Grade } from '../src/types/enums.ts'
import { fixtureContent, tuning as t } from './fixtures/loot-fixture.ts'

const content = fixtureContent()
const rat = content.monsters.get('giant-rat') as MonsterDef
const gnaw = content.monsters.get('old-gnaw') as MonsterDef

function mon(def: MonsterDef, over: Partial<FightMonster> = {}): FightMonster {
  return { def, level: 2, champion: false, eliteAffixIds: [], partBroken: false, ...over }
}

function fight(over: Partial<FightLootInput> = {}): FightLootInput {
  return { dungeonId: 'gravehollow-keep', floor: 2, monsters: [mon(rat), mon(rat), mon(rat)], lightBand: 'radiant', luck: 10, ...over }
}

function meanGold(seed: number, input: FightLootInput, n = 3000): number {
  const rng = Rng.fromSeed(seed)
  const table = lootTableForFloor(content, input.dungeonId, input.floor)
  let sum = 0
  for (let i = 0; i < n; i++) sum += fightGold(content, rng, table, input)
  return sum / n
}

describe('loot tables', () => {
  it('finds the band’s table by floor and throws when none covers it', () => {
    expect(lootTableForFloor(content, 'gravehollow-keep', 2).id).toBe('gravehollow-cellars')
    expect(lootTableForFloor(content, 'gravehollow-keep', 5).id).toBe('gravehollow-crypts')
    expect(() => lootTableForFloor(content, 'gravehollow-keep', 11)).toThrow(/no loot table/)
    expect(() => lootTableForFloor(content, 'nowhere', 1)).toThrow(/no loot table/)
  })

  it('stones follow the band: Whetstone at F', () => {
    expect(stoneItemFor(content, t, 'F')?.id).toBe('whetstone')
    expect(stoneItemFor(content, t, 'B')).toBeNull()
  })

  it('pickGearItem steps the grade down to one that exists and never returns God', () => {
    const rng = Rng.fromSeed(5)
    for (let i = 0; i < 50; i++) {
      expect(pickGearItem(content, rng, 'B')?.grade).toBe('C') // no B item: the next grade down (F E D C B A S SS God)
      expect(pickGearItem(content, rng, 'S')?.grade).toBe('A')
      expect(pickGearItem(content, rng, 'God')?.grade).toBe('A')
    }
    expect(pickGearItem(content, rng, 'F', [(d) => d.kind === 'relic'])).toBeNull()
  })
})

describe('gold per fight (06 §8.5)', () => {
  it('three plain monsters earn exactly the table’s roll; one earns a third', () => {
    const rng = Rng.fromSeed(1)
    const table = lootTableForFloor(content, 'gravehollow-keep', 2)
    for (let i = 0; i < 500; i++) {
      const g = fightGold(content, rng, table, fight())
      expect(g).toBeGreaterThanOrEqual(10)
      expect(g).toBeLessThanOrEqual(20)
    }
    expect(Math.abs(meanGold(2, fight({ monsters: [mon(rat)] })) - 5)).toBeLessThan(0.25)
  })

  it('a champion pays its affix’s gold× (3) plus 10% per affix; a Monster room ×1.25; the preset knob scales', () => {
    const plain = meanGold(3, fight())
    expect(Math.abs(plain - 15)).toBeLessThan(0.4)
    const champion = meanGold(3, fight({ monsters: [mon(rat), mon(rat), mon(rat, { champion: true, eliteAffixIds: ['rabid'] })] }))
    expect(Math.abs(champion - 15 * (5 / 3) * 1.1)).toBeLessThan(0.8) // 27.5
    const unlisted = meanGold(3, fight({ monsters: [mon(rat), mon(rat), mon(rat, { champion: true })] }))
    expect(Math.abs(unlisted - 25)).toBeLessThan(0.8)
    expect(Math.abs(meanGold(3, fight({ isMonsterRoom: true })) - 18.75)).toBeLessThan(0.5)
    expect(Math.abs(meanGold(3, fight({ knobs: { goldPercent: 150 } })) - 22.5)).toBeLessThan(0.6)
  })
})

describe('rollFightLoot (08 §11, 06 §1)', () => {
  it('is deterministic from the seed and rolls the gear item’s affixes by grade', () => {
    const a = rollFightLoot(content, t, Rng.fromSeed(42), fight({ lightBand: 'pitch' }))
    const b = rollFightLoot(content, t, Rng.fromSeed(42), fight({ lightBand: 'pitch' }))
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    const rng = Rng.fromSeed(8)
    let seen = 0
    for (let i = 0; i < 400; i++) {
      for (const inst of rollFightLoot(content, t, rng, fight({ lightBand: 'pitch' })).items) {
        const def = content.items.get(inst.itemId)
        expect(def).toBeDefined()
        expect(inst.affixes).toHaveLength((def?.affixSlots ?? 0) - (def?.setId ? 1 : 0))
        seen++
      }
    }
    expect(seen).toBeGreaterThan(100)
  })

  it('an elite room always drops one gear item; otherwise 35% in radiant light, ×1.75 in pitch dark', () => {
    const rng = Rng.fromSeed(9)
    for (let i = 0; i < 300; i++) {
      const loot = rollFightLoot(content, t, rng, fight({ monsters: [mon(rat), mon(rat, { champion: true, eliteAffixIds: ['rabid'] })] }))
      expect(loot.items).toHaveLength(1)
    }
    const rate = (band: FightLootInput['lightBand']): number => {
      let drops = 0
      for (let i = 0; i < 3000; i++) drops += rollFightLoot(content, t, rng, fight({ lightBand: band })).items.length
      return drops / 30
    }
    expect(Math.abs(rate('radiant') - 35)).toBeLessThan(2.5)
    expect(Math.abs(rate('pitch') - 61.25)).toBeLessThan(2.5)
    expect(Math.abs(rate('shadowy') - 43.75)).toBeLessThan(2.5)
  })

  it('parts: common 35% and rare 4% per monster over 2,000 fights; a break doubles the rare roll; a champion rolls twice', () => {
    const rng = Rng.fromSeed(10)
    const tally = (over: Partial<FightMonster>, fights = 2000): { common: number; rare: number } => {
      let common = 0
      let rare = 0
      for (let i = 0; i < fights; i++) {
        const loot = rollFightLoot(content, t, rng, fight({ monsters: [mon(rat, over), mon(rat, over), mon(rat, over)] }))
        for (const p of loot.parts) {
          expect(p.itemId).toBe(p.rare ? 'rat-tail-charm' : 'rawhide')
          if (p.rare) rare += p.quantity
          else common += p.quantity
        }
      }
      return { common: (common / (fights * 3)) * 100, rare: (rare / (fights * 3)) * 100 }
    }
    const plain = tally({})
    expect(Math.abs(plain.common - 35)).toBeLessThan(2)
    expect(Math.abs(plain.rare - 4)).toBeLessThan(0.8)
    const broken = tally({ partBroken: true })
    expect(Math.abs(broken.rare - 8)).toBeLessThan(1.2)
    const champion = tally({ champion: true, eliteAffixIds: ['rabid'] })
    expect(Math.abs(champion.common - 70)).toBeLessThan(3)
    expect(Math.abs(champion.rare - 8)).toBeLessThan(1.2)
  })

  it('a hunter’s kill guarantees its rare part, its stack and a Large chest', () => {
    const loot = rollFightLoot(content, t, Rng.fromSeed(3), fight({ monsters: [mon(gnaw, { level: 5 })] }))
    expect(loot.parts).toEqual([
      { itemId: 'leather', quantity: 3, rare: false },
      { itemId: 'gnaws-tooth', quantity: 1, rare: true },
    ])
    expect(loot.hunterChest).toEqual({ size: 'large', locked: false, trapped: false, trapId: null, opened: false })
    expect(rollFightLoot(content, t, Rng.fromSeed(3), fight()).hunterChest).toBeNull()
  })

  it('consumables 40% from the band’s list and stones 8% (a Whetstone at F)', () => {
    const rng = Rng.fromSeed(12)
    let consumables = 0
    let stones = 0
    const ids = new Set<string>()
    for (let i = 0; i < 3000; i++) {
      const loot = rollFightLoot(content, t, rng, fight())
      consumables += loot.consumables.length
      stones += loot.stones.length
      for (const c of loot.consumables) ids.add(c.itemId)
      for (const s of loot.stones) expect(s.itemId).toBe('whetstone')
    }
    expect(Math.abs(consumables / 30 - 40)).toBeLessThan(2.5)
    expect(Math.abs(stones / 30 - 8)).toBeLessThan(1.5)
    expect([...ids].sort()).toEqual(['arrows', 'bandage', 'small-hp-potion', 'torch'])
  })
})

describe('treasure rooms (07 §2.7, 08 §11)', () => {
  const table = lootTableForFloor(content, 'gravehollow-keep', 2)

  it('2–4 piles worth two fights, a guaranteed Small chest, a Large chest 20%, a bundle of 3, and the Detection find', () => {
    const rng = Rng.fromSeed(14)
    let large = 0
    let smallLocked = 0
    let trapped = 0
    let found = 0
    let keys = 0
    const n = 2000
    for (let i = 0; i < n; i++) {
      const room = rollTreasureRoom(content, t, rng, table, { luck: 10, bestDetection: 60 })
      expect(room.goldPiles.length).toBeGreaterThanOrEqual(2)
      expect(room.goldPiles.length).toBeLessThanOrEqual(4)
      const sum = room.goldPiles.reduce((a, b) => a + b, 0)
      expect(sum).toBeGreaterThanOrEqual(20)
      expect(sum).toBeLessThanOrEqual(40)
      expect(room.smallChest?.size).toBe('small')
      if (room.smallChest?.locked) smallLocked++
      if (room.smallChest?.trapped) {
        trapped++
        expect(room.smallChest.trapId).toBe('spring-spikes')
      }
      if (room.largeChest !== null) {
        large++
        expect(room.largeChest.size).toBe('large')
      }
      expect(room.bundle).toHaveLength(3)
      for (const c of room.bundle) expect(table.consumableDrop.itemIds).toContain(c.itemId)
      if (room.hidden.kind !== 'none') {
        found++
        if (room.hidden.kind === 'skeletonKey') {
          keys++
          expect(room.hidden.item.itemId).toBe('skeleton-key')
        } else {
          const def = content.items.get(room.hidden.item.itemId)
          expect(gradeIndex(def?.grade as Grade)).toBeGreaterThanOrEqual(gradeIndex('E'))
        }
      }
    }
    expect(Math.abs((large / n) * 100 - 20)).toBeLessThan(2.5)
    expect(Math.abs((smallLocked / n) * 100 - 25)).toBeLessThan(3) // half the Large rate of 50
    expect(Math.abs((trapped / n) * 100 - 20)).toBeLessThan(2.5)
    expect(Math.abs((found / n) * 100 - 33)).toBeLessThan(3) // 60 × 50 / 90
    expect(Math.abs((keys / found) * 100 - 10)).toBeLessThan(4)
    const blind = rollTreasureRoom(content, t, Rng.fromSeed(1), table, { luck: 10, bestDetection: 10 })
    expect(blind.hidden).toEqual({ kind: 'none' })
  })
})

describe('in-dungeon chests (03 §8.3, 08 §10.3)', () => {
  const table = lootTableForFloor(content, 'gravehollow-keep', 2)
  const small: DungeonChest = { size: 'small', locked: false, trapped: true, trapId: 'spring-spikes', opened: false }
  const large: DungeonChest = { size: 'large', locked: true, trapped: false, trapId: null, opened: false }
  const open = (chest: DungeonChest, withKey: boolean, rng: Rng) =>
    openDungeonChest(content, t, rng, chest, { table, centreGrade: 'F', luck: 10, fightGold: 15, withKey })

  it('Small: one item (centre 75 / +1 25), one fight’s gold, one consumable, no stone', () => {
    const counts: Record<string, number> = {}
    const rng = Rng.fromSeed(100)
    for (let i = 0; i < 2000; i++) {
      const loot = open(small, false, rng)
      expect(loot).toMatchObject({ size: 'small', gold: 15, stone: null, chest: { opened: true, trapped: true, locked: false } })
      expect(loot.items).toHaveLength(1)
      expect(loot.consumables).toHaveLength(1)
      const grade = content.items.get((loot.items[0] as { itemId: string }).itemId)?.grade ?? '?'
      counts[grade] = (counts[grade] ?? 0) + 1
    }
    expect(Math.abs((counts.F ?? 0) / 20 - 75)).toBeLessThan(3)
    expect(Math.abs((counts.E ?? 0) / 20 - 25)).toBeLessThan(3)
  })

  it('Large: one item (+1 75 / +2 25), two fights’ gold, two consumables and a stone; a key adds a second item', () => {
    const counts: Record<string, number> = {}
    const rng = Rng.fromSeed(500)
    for (let i = 0; i < 2000; i++) {
      const loot = open(large, false, rng)
      expect(loot).toMatchObject({ size: 'large', gold: 30, chest: { opened: true, locked: false } })
      expect(loot.items).toHaveLength(1)
      expect(loot.consumables).toHaveLength(2)
      expect(loot.stone?.itemId).toBe('whetstone')
      const grade = content.items.get((loot.items[0] as { itemId: string }).itemId)?.grade ?? '?'
      counts[grade] = (counts[grade] ?? 0) + 1
    }
    expect(counts.F).toBeUndefined()
    expect(Math.abs((counts.E ?? 0) / 20 - 75)).toBeLessThan(3)
    expect(Math.abs((counts.D ?? 0) / 20 - 25)).toBeLessThan(3)
    const keyed = open(large, true, Rng.fromSeed(7))
    expect(keyed.items).toHaveLength(2)
    expect(keyed.size).toBe('large')
  })

  it('a Skeleton Key makes a Small chest safe and opens it as a Large', () => {
    const keyed = open(small, true, Rng.fromSeed(9))
    expect(keyed).toMatchObject({ size: 'large', gold: 30, chest: { opened: true, trapped: false, locked: false } })
    expect(keyed.items).toHaveLength(1)
    expect(keyed.consumables).toHaveLength(2)
    expect(keyed.stone?.itemId).toBe('whetstone')
    expect(small.opened).toBe(false)
  })
})
