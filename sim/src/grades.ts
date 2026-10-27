import { GRADE_ORDER, gradeIndex } from './durability.ts'
import type { Rng } from './rng.ts'
import { roundHalfUp } from './stats.ts'
import type { Tuning } from './tuning.ts'

/**
 * Grade rolls (03-GAME-DESIGN §6.2, D-008; 08 §10–§11): a shape of weights at offsets from a centre grade,
 * missing lower grades folded into the centre, God folded into SS unless a line is allowed to reach it, and Luck
 * moving half a point per Luck point above 10 (cap 15) from the centre to the upper lines. Weights are kept in
 * hundredths of a point so the fold and the Luck shift stay exact.
 */
export interface ShapeLine {
  /** Offset from the centre grade: −1, 0, +1 … */
  offset: number
  /** Weight in whole points (the lines of one shape sum to 100). */
  weight: number
}

export interface GradeTable {
  /** Weight in hundredths of a point per grade index (F = 0 … God = 8); sums to 10,000. */
  weights: number[]
  centreIndex: number
}

export const DROP_SHAPE = (t: Tuning): ShapeLine[] => {
  const s = t.equipment.dropShape
  return [
    { offset: -1, weight: s.minus1 },
    { offset: 0, weight: s.centre },
    { offset: 1, weight: s.plus1 },
    { offset: 2, weight: s.plus2 },
    { offset: 3, weight: s.plus3 },
  ]
}

export interface GradeTableOptions {
  /** Luck of the roller (10 = none). */
  luck?: number
  /** The highest grade a line may reach; lines above fold down into it (God → SS by default). */
  maxGrade?: string
  /** A chest band cap: the centre itself never exceeds this (08 §10: chests cap at A). */
  centreCap?: string
}

export function buildGradeTable(t: Tuning, centreGrade: string, shape: readonly ShapeLine[], options: GradeTableOptions = {}): GradeTable {
  const maxIndex = gradeIndex(options.maxGrade ?? 'SS')
  let centreIndex = gradeIndex(centreGrade)
  if (options.centreCap) centreIndex = Math.min(centreIndex, gradeIndex(options.centreCap))
  const weights = new Array<number>(GRADE_ORDER.length).fill(0)
  for (const line of shape) {
    let index = centreIndex + line.offset
    if (index < 0) index = centreIndex
    if (index > maxIndex) index = maxIndex
    weights[index] = (weights[index] ?? 0) + line.weight * 100
  }
  const total = weights.reduce((a, b) => a + b, 0)
  if (total !== 10_000) throw new Error(`grade shape sums to ${total / 100}, not 100`)

  // Luck: +0.5 pp per point above 10 (cap +15 pp), taken from the centre and spread over the upper lines in
  // proportion to their weight.
  const luck = options.luck ?? 10
  const shiftPp = Math.min(t.equipment.dropShape.luckCapPp, Math.max(0, (luck - 10) * t.equipment.dropShape.luckPpPerPoint))
  if (shiftPp > 0) {
    const upperTotal = weights.slice(centreIndex + 1).reduce((a, b) => a + b, 0)
    const centreWeight = weights[centreIndex] ?? 0
    if (upperTotal > 0 && centreWeight > 0) {
      const shift = Math.min(centreWeight, roundHalfUp(shiftPp * 100))
      let given = 0
      let firstUpper = -1
      for (let i = centreIndex + 1; i < weights.length; i++) {
        const w = weights[i] ?? 0
        if (w === 0) continue
        if (firstUpper < 0) firstUpper = i
        const part = roundHalfUp((shift * w) / upperTotal)
        weights[i] = w + part
        given += part
      }
      // Rounding remainder goes to the nearest upper line so the centre loses exactly the shift and the sum stays 10,000.
      if (firstUpper >= 0) weights[firstUpper] = (weights[firstUpper] ?? 0) + (shift - given)
      weights[centreIndex] = centreWeight - shift
    }
  }
  return { weights, centreIndex }
}

/** The table as the Odds button shows it: whole-point percentages per grade, highest first omitted when 0. */
export function tablePercents(table: GradeTable): { grade: string; percent: number }[] {
  const out: { grade: string; percent: number }[] = []
  table.weights.forEach((w, i) => {
    if (w > 0) out.push({ grade: GRADE_ORDER[i] as string, percent: w / 100 })
  })
  return out
}

export function rollGrade(rng: Rng, table: GradeTable): string {
  let roll = rng.int(10_000)
  for (let i = 0; i < table.weights.length; i++) {
    const w = table.weights[i] ?? 0
    if (roll < w) return GRADE_ORDER[i] as string
    roll -= w
  }
  return GRADE_ORDER[table.centreIndex] as string
}

/** The floor's centre grade by global floor (08's band table): F 1–3 · E 4–6 · D 7–10 · C 11–15 · B 16–22 · A 23–30 · S 31–34 · SS 35+. */
export const BAND_FLOORS: readonly { grade: string; from: number; to: number; r: number }[] = [
  { grade: 'F', from: 1, to: 3, r: 300 },
  { grade: 'E', from: 4, to: 6, r: 480 },
  { grade: 'D', from: 7, to: 10, r: 770 },
  { grade: 'C', from: 11, to: 15, r: 1230 },
  { grade: 'B', from: 16, to: 22, r: 1970 },
  { grade: 'A', from: 23, to: 30, r: 3150 },
  { grade: 'S', from: 31, to: 34, r: 5040 },
  { grade: 'SS', from: 35, to: 99, r: 8060 },
]

export function bandForFloor(globalFloor: number): { grade: string; r: number } {
  for (const b of BAND_FLOORS) if (globalFloor >= b.from && globalFloor <= b.to) return b
  return BAND_FLOORS[BAND_FLOORS.length - 1] as { grade: string; r: number }
}
