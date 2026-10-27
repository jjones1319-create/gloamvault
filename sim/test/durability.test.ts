import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { applyWear, durabilityBand, fromPercent, itemValue, plusNCost, plusNStatPercent, pointsToFull, promotionGold, promotionUnits, repair, repairCost, salvageUnits, toPercent, wearPerEvent, wipePenalty } from '../src/durability.ts'
import type { Tuning } from '../src/tuning.ts'

const t = JSON.parse(readFileSync('content/tuning.json', 'utf8')) as Tuning

describe('durability (03 §6.4, 08 §9)', () => {
  it('an F weapon at k 1.33 spends ~30% over 40 meaningful hits: 3.3 delves to broken', () => {
    const item = { durabilityBp: fromPercent(100), maxDurability: 100 }
    const bp = wearPerEvent(1.33)
    expect(bp).toBe(75)
    for (let i = 0; i < 40; i++) applyWear(t, item, bp)
    expect(toPercent(item.durabilityBp)).toBe(70)
    let delves = 1
    while (item.durabilityBp > 0) {
      for (let i = 0; i < 40; i++) applyWear(t, item, bp)
      delves++
    }
    expect(delves).toBe(4)
    expect(wearPerEvent(1.33, true)).toBe(150)
    expect(wearPerEvent(4.07)).toBe(25)
  })

  it('the stat bands: full to 60, linear to −30% at 20, Damaged −50%, Broken 0', () => {
    expect(durabilityBand(t, fromPercent(100))).toEqual({ band: 'full', statPercent: 100, accuracyPenalty: 0 })
    expect(durabilityBand(t, fromPercent(60))).toEqual({ band: 'full', statPercent: 100, accuracyPenalty: 0 })
    expect(durabilityBand(t, fromPercent(40))).toEqual({ band: 'worn', statPercent: 85, accuracyPenalty: 5 })
    expect(durabilityBand(t, fromPercent(20))).toEqual({ band: 'worn', statPercent: 70, accuracyPenalty: 10 })
    expect(durabilityBand(t, fromPercent(19))).toEqual({ band: 'damaged', statPercent: 50, accuracyPenalty: 10 })
    expect(durabilityBand(t, fromPercent(1))).toEqual({ band: 'damaged', statPercent: 50, accuracyPenalty: 10 })
    expect(durabilityBand(t, 0)).toEqual({ band: 'broken', statPercent: 0, accuracyPenalty: 0 })
  })

  it('neglect erodes the ceiling by 5 per cycle; twenty cycles destroy; repair never passes the ceiling', () => {
    const item = { durabilityBp: fromPercent(3), maxDurability: 100 }
    const first = applyWear(t, item, 500)
    expect(first).toEqual({ crossedToast: false, neglect: true, destroyed: false })
    expect(item.durabilityBp).toBe(0)
    expect(item.maxDurability).toBe(95)
    expect(applyWear(t, item, 100).neglect).toBe(false)
    expect(repair(item, 200)).toBe(95)
    expect(item.durabilityBp).toBe(9500)
    expect(pointsToFull(item)).toBe(0)
    let destroyed = false
    for (let cycle = 0; cycle < 19; cycle++) {
      item.durabilityBp = 100
      destroyed = applyWear(t, item, 100).destroyed
    }
    expect(item.maxDurability).toBe(0)
    expect(destroyed).toBe(true)
    const fresh = { durabilityBp: fromPercent(21), maxDurability: 100 }
    expect(applyWear(t, fresh, 150).crossedToast).toBe(true)
  })

  it('repair cost is 0.5% of value per point; a 30-point repair on a 150-gold sword is 23 gold', () => {
    expect(repairCost(t, 150, 30)).toBe(23)
    expect(repairCost(t, 1000, 100)).toBe(500)
    const sword = { durabilityBp: fromPercent(70), maxDurability: 100 }
    expect(pointsToFull(sword)).toBe(30)
    const wiped = wipePenalty(t, sword)
    expect(toPercent(sword.durabilityBp)).toBe(60)
    expect(wiped.neglect).toBe(false)
  })

  it('+N: gold 2% × N of value, 1 stone to +6 then 2, +5% of base per level', () => {
    expect(plusNCost(t, 150, 1)).toEqual({ gold: 3, stones: 1 })
    expect(plusNCost(t, 150, 3)).toEqual({ gold: 9, stones: 1 })
    expect(plusNCost(t, 1000, 7)).toEqual({ gold: 140, stones: 2 })
    expect(plusNStatPercent(t, 10)).toBe(150)
    expect(plusNStatPercent(t, 0)).toBe(100)
  })

  it('promotion counts (D-031), gold, salvage and values', () => {
    expect(promotionUnits(t, 'F')).toBe(6)
    expect(promotionUnits(t, 'A')).toBe(20)
    expect(promotionUnits(t, 'SS')).toBe(50)
    expect(promotionUnits(t, 'God')).toBeNull()
    expect(promotionGold(t, 240)).toBe(60)
    expect(salvageUnits(t, 'F')).toBe(1)
    expect(salvageUnits(t, 'E')).toBe(2)
    expect(salvageUnits(t, 'God')).toBe(13)
    expect(salvageUnits(t, 'God', true)).toBe(25)
    expect(itemValue(t, 'F', 'mainHand')).toBe(150)
    expect(itemValue(t, 'D', 'helmet')).toBe(266)
    expect(itemValue(t, 'God', 'relic')).toBe(7800)
  })
})
