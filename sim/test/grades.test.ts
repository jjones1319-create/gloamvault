import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DROP_SHAPE, bandForFloor, buildGradeTable, rollGrade, tablePercents } from '../src/grades.ts'
import { Rng } from '../src/rng.ts'
import type { Tuning } from '../src/tuning.ts'

const t = JSON.parse(readFileSync('content/tuning.json', 'utf8')) as Tuning

const STANDARD = [
  { offset: 0, weight: 56 },
  { offset: 1, weight: 25 },
  { offset: 2, weight: 14 },
  { offset: 3, weight: 4 },
  { offset: 4, weight: 1 },
]

describe('grade shapes (03 §6.2, 08 §10–§11)', () => {
  it('the Cellars floor drop folds E-below-F into the centre: F 81 · E 14 · D 4 · C 1', () => {
    expect(tablePercents(buildGradeTable(t, 'F', DROP_SHAPE(t)))).toEqual([
      { grade: 'F', percent: 81 },
      { grade: 'E', percent: 14 },
      { grade: 'D', percent: 4 },
      { grade: 'C', percent: 1 },
    ])
    expect(tablePercents(buildGradeTable(t, 'E', DROP_SHAPE(t)))).toEqual([
      { grade: 'F', percent: 25 },
      { grade: 'E', percent: 56 },
      { grade: 'D', percent: 14 },
      { grade: 'C', percent: 4 },
      { grade: 'B', percent: 1 },
    ])
  })

  it('the Standard chest at band B folds God into SS: B 56 · A 25 · S 14 · SS 5; band A: A 56 · S 25 · SS 19', () => {
    expect(tablePercents(buildGradeTable(t, 'B', STANDARD))).toEqual([
      { grade: 'B', percent: 56 },
      { grade: 'A', percent: 25 },
      { grade: 'S', percent: 14 },
      { grade: 'SS', percent: 5 },
    ])
    expect(tablePercents(buildGradeTable(t, 'A', STANDARD))).toEqual([
      { grade: 'A', percent: 56 },
      { grade: 'S', percent: 25 },
      { grade: 'SS', percent: 19 },
    ])
    // The chest band caps at A: a band-S centre reads as A.
    expect(buildGradeTable(t, 'S', STANDARD, { centreCap: 'A' }).centreIndex).toBe(5)
  })

  it('Luck 14 moves 2 points from the centre to the upper lines, cap 15', () => {
    const lucky = tablePercents(buildGradeTable(t, 'B', STANDARD, { luck: 14 }))
    expect(lucky[0]).toEqual({ grade: 'B', percent: 54 })
    const upper = lucky.slice(1).reduce((a, b) => a + b.percent, 0)
    expect(upper).toBeCloseTo(46, 5)
    const capped = tablePercents(buildGradeTable(t, 'B', STANDARD, { luck: 60 }))
    expect(capped[0]).toEqual({ grade: 'B', percent: 41 })
    const unlucky = tablePercents(buildGradeTable(t, 'B', STANDARD, { luck: 5 }))
    expect(unlucky[0]).toEqual({ grade: 'B', percent: 56 })
  })

  it('a shape that does not sum to 100 throws; rolls follow the table', () => {
    expect(() => buildGradeTable(t, 'F', [{ offset: 0, weight: 90 }])).toThrow()
    const table = buildGradeTable(t, 'F', DROP_SHAPE(t))
    const rng = Rng.fromSeed(12)
    const counts: Record<string, number> = {}
    for (let i = 0; i < 20_000; i++) {
      const g = rollGrade(rng, table)
      counts[g] = (counts[g] ?? 0) + 1
    }
    expect(Math.abs((counts.F ?? 0) / 200 - 81)).toBeLessThan(1.5)
    expect(Math.abs((counts.C ?? 0) / 200 - 1)).toBeLessThan(0.5)
    expect(counts.B).toBeUndefined()
  })

  it('bands by global floor', () => {
    expect(bandForFloor(1)).toMatchObject({ grade: 'F', r: 300 })
    expect(bandForFloor(3)).toMatchObject({ grade: 'F' })
    expect(bandForFloor(4)).toMatchObject({ grade: 'E', r: 480 })
    expect(bandForFloor(10)).toMatchObject({ grade: 'D' })
    expect(bandForFloor(40)).toMatchObject({ grade: 'SS' })
  })
})
