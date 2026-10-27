import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Tuning } from '../src/tuning.ts'
import { advanceTrack, attributePointCost, attributeSoftCap, difficultyMultiplier, heroLevelFor, isGated, itemLevelCost, skillRankFor, skillRankThreshold, tierOpenAt, useBudgetPercent, useXp } from '../src/xp.ts'

const t = JSON.parse(readFileSync('content/tuning.json', 'utf8')) as Tuning

describe('level by use (03 §5)', () => {
  it('the gate: enemies more than 10 levels below pay nothing', () => {
    expect(isGated(t, 1, 11)).toBe(true)
    expect(isGated(t, 1, 12)).toBe(false)
    expect(useXp(t, 10, 1, 12, 0)).toBe(0)
  })

  it('the D curve: 0.1× at −10, 1× at 0, 2× at +5, 3× at +10, linear between, flat outside', () => {
    expect(difficultyMultiplier(t, 0, 10)).toBe(10)
    expect(difficultyMultiplier(t, 0, 30)).toBe(10)
    expect(difficultyMultiplier(t, 5, 10)).toBe(55)
    expect(difficultyMultiplier(t, 10, 10)).toBe(100)
    expect(difficultyMultiplier(t, 15, 10)).toBe(200)
    expect(difficultyMultiplier(t, 20, 10)).toBe(300)
    expect(difficultyMultiplier(t, 40, 10)).toBe(300)
    expect(difficultyMultiplier(t, 12, 10)).toBe(140)
  })

  it('the per-delve budget: 20 full, 40 half, then a tenth', () => {
    expect(useBudgetPercent(t, 0)).toBe(100)
    expect(useBudgetPercent(t, 19)).toBe(100)
    expect(useBudgetPercent(t, 20)).toBe(50)
    expect(useBudgetPercent(t, 59)).toBe(50)
    expect(useBudgetPercent(t, 60)).toBe(10)
    expect(useXp(t, 10, 5, 5, 0)).toBe(10)
    expect(useXp(t, 10, 10, 5, 25)).toBe(10)
    expect(useXp(t, 10, 5, 5, 100)).toBe(1)
    expect(useXp(t, 10, 5, 5, 0, 10)).toBe(11)
  })

  it('skill ranks: 100 × 1.5^(N−1) total, rank 10 ≈ 3,844', () => {
    expect(skillRankThreshold(t, 1)).toBe(0)
    expect(skillRankThreshold(t, 2)).toBe(150)
    expect(skillRankThreshold(t, 10)).toBe(3844)
    expect(skillRankFor(t, 0)).toBe(1)
    expect(skillRankFor(t, 149)).toBe(1)
    expect(skillRankFor(t, 150)).toBe(2)
    expect(skillRankFor(t, 99_999)).toBe(10)
  })

  it('attribute points: 20 × 1.12^(N−10) → point 20 ≈ 62, 30 ≈ 193, 40 ≈ 600; soft cap creation + 2 × level', () => {
    expect(attributePointCost(t, 11)).toBe(22)
    expect(attributePointCost(t, 20)).toBe(62)
    expect(attributePointCost(t, 30)).toBe(193)
    expect(attributePointCost(t, 40)).toBe(599)
    expect(attributeSoftCap(t, 12, 20)).toBe(52)
  })

  it('item levels (D-051) and hero levels (L2 at 16 ranks, L10 at 80)', () => {
    expect(itemLevelCost(t, 2)).toBe(50)
    let total = 0
    for (let n = 2; n <= 10; n++) total += itemLevelCost(t, n)
    expect(total).toBeGreaterThan(1200)
    expect(total).toBeLessThan(1400)
    expect(heroLevelFor(t, 0)).toBe(1)
    expect(heroLevelFor(t, 15)).toBe(1)
    expect(heroLevelFor(t, 16)).toBe(2)
    expect(heroLevelFor(t, 80)).toBe(10)
    expect(heroLevelFor(t, 240)).toBe(30)
    expect(tierOpenAt(t, 1)).toBe(1)
    expect(tierOpenAt(t, 4)).toBe(1)
    expect(tierOpenAt(t, 5)).toBe(2)
    expect(tierOpenAt(t, 12)).toBe(3)
    expect(tierOpenAt(t, 30)).toBe(5)
  })

  it('advanceTrack handles cumulative (skills) and incremental (items) curves', () => {
    const skill = advanceTrack({ level: 1, xp: 140 }, 100, 10, (n) => skillRankThreshold(t, n), true)
    expect(skill).toEqual({ level: 3, xp: 240, gained: 2 })
    const item = advanceTrack({ level: 1, xp: 50 }, 10, 10, (n) => itemLevelCost(t, n), false)
    expect(item).toEqual({ level: 2, xp: 10, gained: 1 })
    const capped = advanceTrack({ level: 10, xp: 0 }, 9999, 10, (n) => itemLevelCost(t, n), false)
    expect(capped.level).toBe(10)
  })
})
