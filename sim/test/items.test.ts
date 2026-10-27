/**
 * Items as instances (03 §5.2, §6.2, §6.4, §6.5; 08 §4, §5, §8–§9): creation and the affix roll, effective lines
 * through +N and the durability bands, wear with the basis-point carry, care, promotion, salvage and item XP.
 */
import { describe, expect, it } from 'vitest'
import {
  affixLineForGrade,
  canPromote,
  createItemInstance,
  effectiveItemStats,
  fieldRepair,
  gainItemXp,
  isAwakened,
  newInstanceId,
  nextRungItem,
  pickArmorPieceHit,
  plusNUpgrade,
  promote,
  repairAllCost,
  repairItemPoints,
  repairKit,
  rollAffixes,
  salvage,
  stoneFamilyFor,
  totalItemXp,
  wearArmorPiece,
  wearShield,
  wearWeapon,
} from '../src/items.ts'
import { Rng } from '../src/rng.ts'
import { roundHalfUp } from '../src/stats.ts'
import type { AffixDef, ItemInstance } from '../src/types/content.ts'
import { fixtureContent, item, tuning as t } from './fixtures/loot-fixture.ts'

const content = fixtureContent()

function inst(itemId: string, over: Partial<ItemInstance> = {}): ItemInstance {
  return { ...createItemInstance(content, Rng.fromSeed(99), itemId), ...over }
}

describe('instances and the affix roll (08 §5)', () => {
  it('copies the file’s starting values, makes a deterministic id and throws on an unknown item', () => {
    const rng = Rng.fromSeed(1)
    const a = createItemInstance(content, rng, 'iron-longsword')
    expect(a).toMatchObject({ itemId: 'iron-longsword', quantity: 1, plusN: 0, itemLevel: 1, itemXp: 0, durability: 100, maxDurability: 100, affixes: [], affinities: [] })
    expect(a.instanceId).toMatch(/^it-[0-9a-f]{8}$/)
    expect(createItemInstance(content, Rng.fromSeed(1), 'iron-longsword').instanceId).toBe(a.instanceId)
    expect(newInstanceId(Rng.fromSeed(5), 'pet')).toMatch(/^pet-[0-9a-f]{8}$/)
    expect(createItemInstance(content, rng, 'arrows', { quantity: 50, instanceId: 'it-fixed' })).toMatchObject({ quantity: 50, instanceId: 'it-fixed' })
    expect(() => createItemInstance(content, rng, 'nope')).toThrow(/unknown item "nope"/)
  })

  it('rolls one line on a one-slot item from affixes that list its slot and cover its grade, within the line', () => {
    const rng = Rng.fromSeed(7)
    const def = item(content, 'bronze-longsword')
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) {
      const rolled = rollAffixes(content, rng, def)
      expect(rolled).toHaveLength(1)
      const line = rolled[0] as { affixId: string; value: number; locked: boolean }
      const affix = content.affixes.get(line.affixId)
      expect(affix).toBeDefined()
      expect(affix?.slots).toContain('mainHand')
      expect(affixLineForGrade(affix as AffixDef, 'E')).toBeDefined()
      expect(line.locked).toBe(false)
      seen.add(line.affixId)
      // of Vigor's E–C line is 8–20; every F–D line in the fixture is at most 8.
      if (line.affixId === 'of-vigor') expect(line.value).toBeGreaterThanOrEqual(8)
      else expect(line.value).toBeLessThanOrEqual(8)
      expect(line.value).toBeGreaterThanOrEqual(1)
    }
    expect(seen.has('sturdy')).toBe(false)
    expect(seen.has('sharp')).toBe(true)
    expect(seen.has('of-vigor')).toBe(true)
    // createItemInstance with rollAffixes uses the same roll.
    expect(createItemInstance(content, Rng.fromSeed(3), 'bronze-longsword', { rollAffixes: true }).affixes).toHaveLength(1)
    expect(createItemInstance(content, Rng.fromSeed(3), 'bronze-longsword').affixes).toHaveLength(0)
  })

  it('never repeats an affix, splits prefix/suffix (2 → 1 + 1, 3 → at most 2 per side) and allows one element', () => {
    const rng = Rng.fromSeed(11)
    const two = item(content, 'steel-greataxe')
    const three = item(content, 'skysteel-greataxe')
    for (let i = 0; i < 400; i++) {
      const a = rollAffixes(content, rng, two)
      expect(a).toHaveLength(2)
      expect(new Set(a.map((x) => x.affixId)).size).toBe(2)
      const positions = a.map((x) => content.affixes.get(x.affixId)?.position).sort()
      expect(positions).toEqual(['prefix', 'suffix'])

      const b = rollAffixes(content, rng, three)
      expect(b).toHaveLength(3)
      expect(new Set(b.map((x) => x.affixId)).size).toBe(3)
      const prefixes = b.filter((x) => content.affixes.get(x.affixId)?.position === 'prefix').length
      expect(prefixes).toBeGreaterThanOrEqual(1)
      expect(prefixes).toBeLessThanOrEqual(2)
      const ids = b.map((x) => x.affixId)
      expect(ids.includes('flaming') && ids.includes('freezing')).toBe(false)
    }
  })

  it('a set piece spends one slot on its set; an F item has none', () => {
    const rng = Rng.fromSeed(2)
    expect(rollAffixes(content, rng, item(content, 'grinning-companys-hood'))).toEqual([])
    expect(rollAffixes(content, rng, item(content, 'copper-longsword'))).toEqual([])
  })
})

describe('effective lines (03 §6.2 +N, §6.4 bands)', () => {
  const iron = item(content, 'iron-longsword')

  it('base × (100 + 5 × N)% × the band, rounded half up per line; weapons lose Accuracy when worn', () => {
    expect(effectiveItemStats(content, t, iron, inst('iron-longsword'))).toMatchObject({ stats: { attackPhys: 22 }, band: 'full', statPercent: 100, accuracyPenalty: 0, onHit: [] })
    expect(effectiveItemStats(content, t, iron, inst('iron-longsword', { plusN: 3 })).stats.attackPhys).toBe(25) // 25.3
    const worn = effectiveItemStats(content, t, iron, inst('iron-longsword', { durability: 40 }))
    expect(worn).toMatchObject({ stats: { attackPhys: 19 }, band: 'worn', statPercent: 85, accuracyPenalty: 5 }) // 18.7
    expect(effectiveItemStats(content, t, iron, inst('iron-longsword', { plusN: 3, durability: 40 })).stats.attackPhys).toBe(21) // 25 × 0.85 = 21.25
    const damaged = effectiveItemStats(content, t, iron, inst('iron-longsword', { durability: 10 }))
    expect(damaged).toMatchObject({ stats: { attackPhys: 11 }, band: 'damaged', statPercent: 50, accuracyPenalty: 10 })
    const plate = effectiveItemStats(content, t, item(content, 'copper-breastplate'), inst('copper-breastplate', { durability: 40 }))
    expect(plate).toMatchObject({ stats: { defense: 7 }, accuracyPenalty: 0 }) // 6.8
  })

  it('a Broken item contributes nothing', () => {
    const broken = effectiveItemStats(content, t, iron, inst('iron-longsword', { durability: 0, plusN: 5, affixes: [{ affixId: 'of-vigor', value: 14, locked: false }] }))
    expect(broken).toEqual({ stats: {}, percentStats: {}, attributeBonuses: {}, accuracyPenalty: 0, band: 'broken', statPercent: 0, onHit: [] })
  })

  it('affix lines: flat to stats, percent to percentStats, attributes to attributeBonuses, effects to onHit with the rolled magnitude; the band scales the stat lines', () => {
    const affixes = [
      { affixId: 'of-vigor', value: 14, locked: false },
      { affixId: 'of-the-bear', value: 2, locked: false },
      { affixId: 'fierce', value: 4, locked: false },
      { affixId: 'bleeding', value: 6, locked: false },
    ]
    const full = effectiveItemStats(content, t, iron, inst('iron-longsword', { affixes }))
    expect(full.stats).toEqual({ attackPhys: 22, hp: 14 })
    expect(full.percentStats).toEqual({ attackPhys: 4 })
    expect(full.attributeBonuses).toEqual({ strength: 2 })
    expect(full.onHit).toEqual([{ kind: 'applyStatus', status: 'bleed', chance: 6 }])
    const worn = effectiveItemStats(content, t, iron, inst('iron-longsword', { affixes, durability: 40 }))
    expect(worn.stats).toEqual({ attackPhys: 19, hp: 12 }) // 11.9
    expect(worn.percentStats).toEqual({ attackPhys: 3 }) // 3.4
    expect(worn.attributeBonuses).toEqual({ strength: 2 }) // 1.7
    expect(worn.onHit).toEqual([{ kind: 'applyStatus', status: 'bleed', chance: 6 }])
    const flaming = effectiveItemStats(content, t, iron, inst('iron-longsword', { affixes: [{ affixId: 'flaming', value: 7, locked: false }] }))
    expect(flaming.onHit).toEqual([{ kind: 'damage', damageType: 'fire', percent: 7 }])
  })

  it('a unique power’s lines ride along as on-hit lines', () => {
    const def = { ...iron, unique: true, uniquePower: { text: '+5 Momentum on hit', effects: [{ kind: 'momentum' as const, amount: 5 }] } }
    expect(effectiveItemStats(content, t, def, inst('iron-longsword')).onHit).toEqual([{ kind: 'momentum', amount: 5 }])
  })
})

describe('wear (03 §6.4, 08 §9.1, §9.4)', () => {
  const copper = item(content, 'copper-longsword')

  it('an F weapon at k 1.33 wears 75 bp per hit; the sub-percent carry keeps 40 hits at exactly 30%', () => {
    const fresh = inst('copper-longsword')
    const first = wearWeapon(t, copper, fresh)
    expect(first).toMatchObject({ wearBp: 75, carryBp: 75, crossedToast: false, neglect: false, destroyed: false })
    expect(first.inst.durability).toBe(100)
    expect(fresh.durability).toBe(100)
    let cur = first.inst
    let carry = first.carryBp
    for (let hit = 1; hit < 40; hit++) {
      const r = wearWeapon(t, copper, cur, { carryBp: carry })
      cur = r.inst
      carry = r.carryBp
    }
    expect(cur.durability).toBe(70)
    expect(carry).toBe(0)
    expect(wearWeapon(t, copper, fresh, { events: 40 }).inst.durability).toBe(70)
  })

  it('3.3 delves to broken: the fourth delve of 40 hits reaches 0 and costs a neglect cycle', () => {
    let cur = inst('copper-longsword')
    let delves = 0
    let neglected = false
    while (cur.durability > 0) {
      const r = wearWeapon(t, copper, cur, { events: 40 })
      cur = r.inst
      neglected ||= r.neglect
      delves++
    }
    expect(delves).toBe(4)
    expect(neglected).toBe(true)
    expect(cur.maxDurability).toBe(95)
    expect(wearWeapon(t, copper, inst('copper-longsword'), { doubleWear: true }).wearBp).toBe(150)
    expect(wearWeapon(t, copper, inst('copper-longsword'), { bow: true }).wearBp).toBe(38) // k 2.66
  })

  it('armor and shields wear by their own k; the toast fires at 20%; neglect erodes the ceiling and destroys at 0', () => {
    const plate = item(content, 'copper-breastplate')
    const thirty = wearArmorPiece(t, plate, inst('copper-breastplate'), { events: 30 })
    expect(thirty.inst.durability).toBe(76) // 30 × 83 bp
    expect(thirty.carryBp).toBe(90)
    const buckler = item(content, 'pine-buckler')
    const block = wearShield(t, buckler, inst('pine-buckler'))
    expect(block.inst.durability).toBe(99)
    expect(block.carryBp).toBe(0)
    expect(wearShield(t, buckler, inst('pine-buckler', { durability: 21 })).crossedToast).toBe(true)
    const neglect = wearShield(t, buckler, inst('pine-buckler', { durability: 1 }))
    expect(neglect).toMatchObject({ neglect: true, destroyed: false })
    expect(neglect.inst).toMatchObject({ durability: 0, maxDurability: 95 })
    expect(wearShield(t, buckler, inst('pine-buckler', { durability: 1, maxDurability: 5 }))).toMatchObject({ neglect: true, destroyed: true })
    expect(wearShield(t, buckler, inst('pine-buckler', { durability: 0, maxDurability: 95 })).neglect).toBe(false)
  })

  it('hits land on armor by Chest 3 · Helmet 2 · Legs 2 · Boots 1 · Gloves 1', () => {
    const rng = Rng.fromSeed(21)
    const counts: Record<string, number> = {}
    for (let i = 0; i < 9000; i++) {
      const slot = pickArmorPieceHit(rng, t)
      counts[slot] = (counts[slot] ?? 0) + 1
    }
    expect(Math.abs((counts.chest ?? 0) - 3000)).toBeLessThan(150)
    expect(Math.abs((counts.helmet ?? 0) - 2000)).toBeLessThan(150)
    expect(Math.abs((counts.gloves ?? 0) - 1000)).toBeLessThan(120)
  })
})

describe('care: repair, +N, promotion, salvage (03 §6.4–§6.5, 08 §4, §8.2, §8.4, §9.3)', () => {
  it('repair by points, kits +25, Field Repair +10, never past the ceiling', () => {
    expect(repairItemPoints(inst('copper-longsword', { durability: 70 }), 20)).toMatchObject({ restored: 20, inst: { durability: 90 } })
    expect(repairKit(t, inst('copper-longsword', { durability: 70 }))).toMatchObject({ restored: 25, inst: { durability: 95 } })
    expect(fieldRepair(t, inst('copper-longsword', { durability: 70 }))).toMatchObject({ restored: 10, inst: { durability: 80 } })
    expect(repairKit(t, inst('copper-longsword', { durability: 90 }))).toMatchObject({ restored: 10, inst: { durability: 100 } })
    expect(repairKit(t, inst('copper-longsword', { durability: 80, maxDurability: 95 }))).toMatchObject({ restored: 15, inst: { durability: 95, maxDurability: 95 } })
  })

  it('“Repair all” bills 0.5% of value per point: 23 + 19 gold for a sword at 70 and a breastplate at 75', () => {
    const bill = repairAllCost(content, t, [inst('copper-longsword', { durability: 70 }), inst('copper-breastplate', { durability: 75 }), inst('ring-of-vigor')])
    expect(bill).toEqual({ gold: 42, points: 55 })
  })

  it('+N: 2% of value × N in gold, one stone to +6 then two, the grade’s stone family; null at max', () => {
    const copper = item(content, 'copper-longsword')
    expect(plusNUpgrade(t, copper, inst('copper-longsword'))).toMatchObject({ gold: 3, stones: 1, stoneFamily: 'whetstone', inst: { plusN: 1 } })
    expect(plusNUpgrade(t, copper, inst('copper-longsword', { plusN: 3 }))).toBeNull()
    expect(plusNUpgrade(t, item(content, 'steel-greataxe'), inst('steel-greataxe', { plusN: 6 }))).toBeNull() // maxPlusN 6
    const sky = item(content, 'skysteel-greataxe')
    expect(plusNUpgrade(t, sky, inst('skysteel-greataxe', { plusN: 6 }))).toMatchObject({ gold: 336, stones: 2, stoneFamily: 'honingOil' }) // 2400 × 2% × 7
    expect(stoneFamilyFor(t, 'B')).toBe('honingOil')
    expect(stoneFamilyFor(t, 'S')).toBe('starGrit')
    expect(stoneFamilyFor(t, 'God')).toBe('starGrit')
  })

  const bronze = item(content, 'bronze-longsword')
  const promotable = inst('bronze-longsword', {
    plusN: 3,
    itemLevel: 4,
    itemXp: 17,
    affinities: [{ familyId: 'cellar-vermin', percent: 5 }],
    affixes: [
      { affixId: 'of-vigor', value: 14, locked: false },
      { affixId: 'sharp', value: 2, locked: true },
    ],
  })

  it('canPromote quotes the target rung’s material (8 Iron for E → D), 25% of the target’s value and the stone refund', () => {
    const ok = canPromote(content, t, bronze, promotable, new Map([['iron', 10]]))
    expect(ok).toEqual({ ok: true, reason: null, targetItemId: 'iron-longsword', materialIds: ['iron'], units: 8, unitsOwned: 10, gold: 95, stoneRefund: 1 })
    expect(canPromote(content, t, bronze, promotable, new Map([['iron', 5]]))).toMatchObject({ ok: false, reason: 'not enough material', unitsOwned: 5 })
    expect(canPromote(content, t, bronze, promotable, new Map([['bronze', 50]]))).toMatchObject({ ok: false, unitsOwned: 0 })
    expect(canPromote(content, t, item(content, 'iron-longsword'), inst('iron-longsword'), new Map())).toMatchObject({ ok: false, reason: 'no C-grade item to promote into' })
    expect(canPromote(content, t, item(content, 'ring-of-vigor'), inst('ring-of-vigor'), new Map())).toMatchObject({ ok: false, reason: 'no material ladder' })
  })

  it('promote keeps level, XP, affinities and every affix, re-rolls one unlocked line at the new band, resets +N and moves to the next rung', () => {
    const r = promote(content, Rng.fromSeed(4), t, bronze, promotable)
    expect(r.targetItemId).toBe('iron-longsword')
    expect(r.inst).toMatchObject({ itemId: 'iron-longsword', plusN: 0, itemLevel: 4, itemXp: 17, affinities: [{ familyId: 'cellar-vermin', percent: 5 }], durability: 100 })
    expect(r.inst.affixes.map((a) => a.affixId)).toEqual(['of-vigor', 'sharp'])
    expect(r.inst.affixes[1]).toEqual({ affixId: 'sharp', value: 2, locked: true })
    const vigor = r.inst.affixes[0] as { value: number }
    expect(vigor.value).toBeGreaterThanOrEqual(8)
    expect(vigor.value).toBeLessThanOrEqual(20)
    expect(r.rerolledAffixId).toBe('of-vigor')
    expect(r.stoneRefund).toEqual({ family: 'whetstone', stones: 1 })
    expect(promotable.plusN).toBe(3)
    expect(promotable.itemId).toBe('bronze-longsword')
    // Every line locked: nothing re-rolls.
    const locked = { ...promotable, affixes: promotable.affixes.map((a) => ({ ...a, locked: true })) }
    expect(promote(content, Rng.fromSeed(4), t, bronze, locked)).toMatchObject({ rerolledAffixId: null, inst: { affixes: locked.affixes } })
  })

  it('the next rung is found by mesh, or by kind + family + slot, and promotion throws when none exists', () => {
    expect(nextRungItem(content, item(content, 'copper-longsword'))?.id).toBe('bronze-longsword')
    expect(nextRungItem(content, item(content, 'copper-breastplate'))?.id).toBe('bronze-breastplate') // different mesh, same type
    expect(nextRungItem(content, item(content, 'iron-longsword'))).toBeNull()
    expect(nextRungItem(content, item(content, 'grinning-companys-hood'))).toBeNull()
    expect(() => promote(content, Rng.fromSeed(1), t, item(content, 'iron-longsword'), inst('iron-longsword'))).toThrow(/no C-grade item/)
    expect(promote(content, Rng.fromSeed(1), t, item(content, 'copper-breastplate'), inst('copper-breastplate')).targetItemId).toBe('bronze-breastplate')
  })

  it('salvage: 25% of the item’s own promotion cost in its material, 50% when destroyed by neglect; Awakened carries 60% XP', () => {
    expect(salvage(t, item(content, 'copper-longsword'), inst('copper-longsword'))).toEqual({ materialLadder: 'metal', materialRung: 0, units: 1, carriedXp: 0 })
    expect(salvage(t, item(content, 'copper-longsword'), inst('copper-longsword'), true).units).toBe(2)
    expect(salvage(t, bronze, inst('bronze-longsword')).units).toBe(2)
    expect(salvage(t, bronze, inst('bronze-longsword'), true).units).toBe(3)
    expect(salvage(t, item(content, 'iron-longsword'), inst('iron-longsword'))).toMatchObject({ units: 2, materialRung: 2 })
    expect(salvage(t, item(content, 'iron-longsword'), inst('iron-longsword'), true).units).toBe(4)
    expect(salvage(t, item(content, 'skysteel-greataxe'), inst('skysteel-greataxe'))).toMatchObject({ units: 4 })
    expect(salvage(t, item(content, 'skysteel-greataxe'), inst('skysteel-greataxe'), true).units).toBe(8)
    expect(salvage(t, item(content, 'ring-of-vigor'), inst('ring-of-vigor')).materialLadder).toBeNull()
    const awakened = inst('iron-longsword', { itemLevel: 10, itemXp: 12 })
    const total = totalItemXp(t, awakened)
    expect(total).toBeGreaterThan(1000)
    expect(salvage(t, item(content, 'iron-longsword'), awakened).carriedXp).toBe(roundHalfUp(total * 0.6))
  })
})

describe('item XP, affinities and Awakened (03 §5.2, D-051)', () => {
  it('levels on the incremental curve (50 to level 2, 63 to 3) and grants +5% vs the family at 3 / 6 / 9', () => {
    const fresh = inst('iron-longsword')
    const two = gainItemXp(t, fresh, 50, 'cellar-vermin')
    expect(two).toMatchObject({ levelsGained: 1, newAffinity: null, awakened: false, inst: { itemLevel: 2, itemXp: 0, affinities: [] } })
    expect(fresh.itemLevel).toBe(1)
    const three = gainItemXp(t, two.inst, 63, 'cellar-vermin')
    expect(three).toMatchObject({ levelsGained: 1, newAffinity: { familyId: 'cellar-vermin', percent: 5 } })
    expect(three.inst.affinities).toEqual([{ familyId: 'cellar-vermin', percent: 5 }])
    const six = gainItemXp(t, three.inst, 78 + 98 + 122, 'restless-dead')
    expect(six).toMatchObject({ levelsGained: 3, newAffinity: { familyId: 'restless-dead', percent: 5 }, inst: { itemLevel: 6, itemXp: 0 } })
    expect(six.inst.affinities).toHaveLength(2)
    const nine = gainItemXp(t, six.inst, 153 + 191 + 238, 'cellar-vermin')
    expect(nine).toMatchObject({ levelsGained: 3, newAffinity: { familyId: 'cellar-vermin', percent: 10 }, inst: { itemLevel: 9 } })
    expect(nine.inst.affinities).toEqual([
      { familyId: 'cellar-vermin', percent: 10 },
      { familyId: 'restless-dead', percent: 5 },
    ])
    const ten = gainItemXp(t, nine.inst, 298, 'cellar-vermin')
    expect(ten).toMatchObject({ levelsGained: 1, awakened: true, newAffinity: null, inst: { itemLevel: 10, itemXp: 0 } })
    expect(isAwakened(t, ten.inst)).toBe(true)
    const more = gainItemXp(t, ten.inst, 1000, 'cellar-vermin')
    expect(more).toMatchObject({ levelsGained: 0, awakened: false, inst: { itemLevel: 10, itemXp: 1000 } })
  })

  it('a gain that crosses two thresholds for one family raises its line once per threshold; no family, no line', () => {
    const big = gainItemXp(t, inst('iron-longsword'), 50 + 63 + 78 + 98 + 122, 'tidebound')
    expect(big.inst.itemLevel).toBe(6)
    expect(big.newAffinity).toEqual({ familyId: 'tidebound', percent: 10 })
    expect(big.inst.affinities).toEqual([{ familyId: 'tidebound', percent: 10 }])
    const nameless = gainItemXp(t, inst('iron-longsword'), 113, null)
    expect(nameless.inst.itemLevel).toBe(3)
    expect(nameless.inst.affinities).toEqual([])
    expect(nameless.newAffinity).toBeNull()
  })
})
