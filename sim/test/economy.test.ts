import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buyPricePercent, chestBandGrade, chestPriceR, goldFor, rForFloor, rForGrade, retreatToll, sellPrice, skillHallPriceR, townPrice } from '../src/economy.ts'
import { insightChanceBp, rollInsight, sparkCurve, sweetSpotLevel, techniqueChanceBp } from '../src/insight.ts'
import { Rng } from '../src/rng.ts'
import type { Tuning } from '../src/tuning.ts'

const t = JSON.parse(readFileSync('content/tuning.json', 'utf8')) as Tuning

describe('Insight (03 §7.5)', () => {
  it('the spark curve: 1 at 0, 0.5 at ±3, 0.25 at ±6, 0 beyond ±10', () => {
    expect(sparkCurve(t, 0)).toBe(10_000)
    expect(sparkCurve(t, 3)).toBe(5000)
    expect(sparkCurve(t, -3)).toBe(5000)
    expect(sparkCurve(t, 6)).toBe(2500)
    expect(sparkCurve(t, 10)).toBe(0)
    expect(sparkCurve(t, 15)).toBe(0)
    expect(sparkCurve(t, 1)).toBe(8333)
  })

  it('4% at the sweet spot, scaled by Wisdom; techniques a flat 10%', () => {
    expect(sweetSpotLevel(t, 2)).toBe(12)
    expect(insightChanceBp(t, 12, 2, 10)).toBe(400)
    expect(insightChanceBp(t, 12, 2, 20)).toBe(440)
    expect(insightChanceBp(t, 15, 2, 10)).toBe(200)
    expect(insightChanceBp(t, 4, 4, 10)).toBe(0)
    expect(techniqueChanceBp(t)).toBe(1000)
  })

  it('pity guarantees an Insight on the 60th qualifying use and resets', () => {
    const rng = Rng.fromSeed(21)
    const counter = { usesSincePity: 0 }
    let hits = 0
    for (let i = 0; i < 59; i++) if (rollInsight(t, rng, counter, 0)) hits++
    expect(hits).toBe(0)
    expect(rollInsight(t, rng, counter, 0)).toBe(true)
    expect(counter.usesSincePity).toBe(0)
    let natural = 0
    for (let i = 0; i < 10_000; i++) {
      const c = { usesSincePity: 0 }
      if (rollInsight(t, rng, c, 400)) natural++
    }
    expect(natural / 100).toBeGreaterThan(3)
    expect(natural / 100).toBeLessThan(5)
  })
})

describe('economy in R (03 §7.4, §7.6, §8)', () => {
  it('R per band and per floor', () => {
    expect(rForGrade(t, 'F')).toBe(300)
    expect(rForGrade(t, 'E')).toBe(480)
    expect(rForGrade(t, 'SS')).toBe(8060)
    expect(rForFloor(2)).toBe(300)
    expect(rForFloor(5)).toBe(480)
    expect(goldFor(0.5, 300)).toBe(150)
  })

  it('the Skill Hall ramps +20% per purchase to ×3', () => {
    expect(skillHallPriceR(t, 1, 0)).toBeCloseTo(0.1)
    expect(skillHallPriceR(t, 1, 1)).toBeCloseTo(0.12)
    expect(skillHallPriceR(t, 3, 0)).toBeCloseTo(1.0)
    expect(skillHallPriceR(t, 3, 10)).toBeCloseTo(3.0)
    expect(skillHallPriceR(t, 3, 50)).toBeCloseTo(3.0)
  })

  it('Haggling: 130% − 1%/rank to a floor of 85%; sell 40% + 0.5%/rank; the merchant charges ×1.5', () => {
    expect(buyPricePercent(t, 0)).toBe(130)
    expect(buyPricePercent(t, 10)).toBe(120)
    expect(buyPricePercent(t, 50)).toBe(85)
    expect(buyPricePercent(t, 0, 150)).toBe(195)
    expect(sellPrice(t, 150, 0)).toBe(60)
    expect(sellPrice(t, 150, 10)).toBe(68)
    expect(townPrice(t, 0.5, 300, 0)).toBe(195)
    expect(townPrice(t, 0.02, 300, 10, 150)).toBe(11)
  })

  it('chest prices, the chest band cap at A, the retreat toll', () => {
    expect(chestPriceR(t, 'gear', false)).toBe(0.5)
    expect(chestPriceR(t, 'petEgg', true)).toBe(6)
    expect(chestBandGrade(2)).toBe('F')
    expect(chestBandGrade(20)).toBe('B')
    expect(chestBandGrade(33)).toBe('A')
    expect(chestBandGrade(40)).toBe('A')
    // D-083 (James): leaving from the entrance or a floor's end is free; the toll percent stays a Pact knob.
    expect(retreatToll(t, 250)).toBe(0)
    expect(retreatToll(t, 250, 10)).toBe(25)
    expect(retreatToll(t, 250, 25)).toBe(63)
  })
})
