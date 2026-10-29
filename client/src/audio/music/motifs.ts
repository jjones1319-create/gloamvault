/**
 * The motifs (07 §2.2), written once here and quoted by the pieces. All original. Each is a run of scale degrees
 * (1–7 in the tonic's octave, 8 the octave above, 0 and below in the octave beneath), so one motif sounds in any mode:
 * "heard once in each zone's mode".
 *
 * - throne — the Hollow King's leitmotif, four long notes: up a step, down to the fifth below, up to the third
 *   (1 2 5̣ 3). Bright and questioning in the Cellars' Mixolydian (D E A F♯), wistful in the Crypts' Dorian (E F♯ B G),
 *   and in the Vault's Phrygian the step is a half step and the drop a tritone (E F B G): the King's own key. Every boss
 *   piece quotes it once — the shared boss theme — and the Throne states it on pipe organ.
 * - company — the Grinning Company's cracked trumpet call: up a fourth, then down by step and a third to the grin
 *   (5̣ 1 ♭7̣ 5̣ 3̣ in D Mixolydian: A D C A F♯), the long note cracked.
 * - vigil — the Barrow Warden's slow descending tetrachord (8 7 6 5), sung in canon with itself on reed organ.
 * - chant — the Tidebound's wordless chant, a neighbour figure around the tonic (1 1 2 1 7̣ 1), sung in fifths.
 */
import { MODE_STEPS, type Mode } from './abc.ts'

export type MotifId = 'throne' | 'company' | 'vigil' | 'chant'

export interface Motif {
  id: MotifId
  degrees: readonly number[]
}

export const MOTIFS: Record<MotifId, Motif> = {
  throne: { id: 'throne', degrees: [1, 2, -2, 3] },
  company: { id: 'company', degrees: [-2, 1, 0, -2, -4] },
  vigil: { id: 'vigil', degrees: [8, 7, 6, 5] },
  chant: { id: 'chant', degrees: [1, 1, 2, 1, 0, 1] },
}

/** A scale degree as MIDI in a key: tonic pitch class, mode, and the octave the tonic sits in (4 → the tonic near C4). */
export function degreeMidi(degree: number, tonic: number, mode: Mode, octave = 4): number {
  const steps = MODE_STEPS[mode]
  const index = (((degree - 1) % 7) + 7) % 7
  const shift = Math.floor((degree - 1) / 7)
  return 12 * (octave + 1) + tonic + steps[index]! + 12 * shift
}

/** The motif's semitone steps in a mode. */
export function motifIntervals(m: Motif, mode: Mode): number[] {
  const p = m.degrees.map((d) => degreeMidi(d, 0, mode))
  return p.slice(1).map((x, i) => x - p[i]!)
}

/** True when `pitches` holds the interval run as a contiguous stretch (any transposition, free rhythm). */
export function containsIntervals(pitches: readonly number[], intervals: readonly number[]): boolean {
  const n = intervals.length
  outer: for (let i = 0; i + n < pitches.length; i++) {
    for (let k = 0; k < n; k++) if (pitches[i + k + 1]! - pitches[i + k]! !== intervals[k]) continue outer
    return true
  }
  return false
}

/** True when `pitches` holds the motif as it sounds in `mode`. */
export function containsMotif(pitches: readonly number[], m: Motif, mode: Mode): boolean {
  return containsIntervals(pitches, motifIntervals(m, mode))
}
