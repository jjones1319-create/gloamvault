/**
 * The instruments (ported from Wildsong Ranch's recipes/instruments.ts, cut to Gloamvault's palette — 07 §2.2's
 * briefs and the Emberfall brief in 07 §1): their articulations, families, hand-set melodic ranges and fallback
 * voices. Sampled instruments come from the CC0 libraries in CREDITS.md (client/public/audio/manifest.json holds the
 * files); six voices are made in code only (filtered noise and band-limited tones: the snare, the bone rattle, the
 * anvil, the wordless voice, the trumpet's brass and the waterphone); two patches layer them with samples (the choir,
 * the cracked trumpet). Pure data. Sounding MIDI throughout (C4 = 60).
 */

export const INSTRUMENT_IDS = [
  'recorder-alto',
  'clarinet',
  'horn',
  'violins',
  'violas',
  'cellos',
  'contrabass',
  'harp',
  'strumstick',
  'tubular-bells',
  'wine-glasses',
  'organ',
  'frame-drum',
  'darbuka',
  'bongos',
  'tambourine',
  'shaker',
  'claves',
  'woodblock',
  'timpani',
  'bass-drum',
  'cymbal-swell',
  'foley',
  'voice',
  'brass',
  'waterphone',
  'snare',
  'rattle',
  'anvil',
  'choir',
  'trumpet',
] as const
export type InstrumentId = (typeof INSTRUMENT_IDS)[number]

export type Family = 'wind' | 'bowed' | 'pluck' | 'mallet' | 'keys' | 'perc' | 'foley' | 'patch' | 'voice'
/** The voice that plays while samples load (or for good, for the code-made instruments). */
export type FallbackVoice = 'wind' | 'pad' | 'pluck' | 'mallet' | 'voice' | 'brass' | 'waterphone' | 'snare' | 'rattle' | 'anvil' | 'silent'

export interface InstrumentDef {
  family: Family
  /** Articulations as named in the manifest; the first is the default. */
  arts: readonly string[]
  /** The articulation for notes of a beat or longer (vibrato), if the instrument has one. */
  longArt?: string
  /** Monophonic: a new note replaces the old one with a 20 ms crossfade. */
  mono?: boolean
  /** Hand-set melodic range, sounding MIDI, inside the playable range. Absent for unpitched percussion. */
  melody?: readonly [number, number]
  fallback: FallbackVoice
  /** Attack and release in ms. Plucks ring naturally and are damped `releaseMs` after the note ends. */
  attackMs: number
  releaseMs: number
  /** Rate-pitched percussion (timpani): `pitch: 'root' | 'fifth'` from the chord track. */
  pitchedPerc?: boolean
  /** Made in code only: there are no samples, the fallback voice is the instrument. */
  synthOnly?: boolean
  /** A patch built from other instruments. */
  patch?: { layers: readonly { inst: InstrumentId; transpose: number; gainDb: number; decayCapSec?: number }[]; minMidi: number }
}

export const INSTRUMENTS: Record<InstrumentId, InstrumentDef> = {
  'recorder-alto': { family: 'wind', arts: ['sus', 'vib'], longArt: 'vib', mono: true, melody: [65, 88], fallback: 'wind', attackMs: 30, releaseMs: 90 },
  clarinet: { family: 'wind', arts: ['sus'], mono: true, melody: [52, 86], fallback: 'wind', attackMs: 40, releaseMs: 120 },
  horn: { family: 'wind', arts: ['sus'], mono: true, melody: [41, 64], fallback: 'wind', attackMs: 60, releaseMs: 150 },
  violins: { family: 'bowed', arts: ['vib', 'spic', 'trem'], longArt: 'vib', melody: [55, 86], fallback: 'pad', attackMs: 80, releaseMs: 400 },
  violas: { family: 'bowed', arts: ['vib'], longArt: 'vib', melody: [48, 79], fallback: 'pad', attackMs: 80, releaseMs: 450 },
  cellos: { family: 'bowed', arts: ['vib', 'pizz', 'trem'], longArt: 'vib', melody: [36, 69], fallback: 'pad', attackMs: 80, releaseMs: 500 },
  contrabass: { family: 'bowed', arts: ['pizz', 'sus'], melody: [26, 55], fallback: 'pad', attackMs: 60, releaseMs: 500 },
  harp: { family: 'pluck', arts: ['pluck'], melody: [48, 91], fallback: 'pluck', attackMs: 3, releaseMs: 900 },
  strumstick: { family: 'pluck', arts: ['pluck'], melody: [50, 81], fallback: 'pluck', attackMs: 3, releaseMs: 500 },
  'tubular-bells': { family: 'mallet', arts: ['hit'], melody: [57, 79], fallback: 'mallet', attackMs: 3, releaseMs: 1800 },
  'wine-glasses': { family: 'mallet', arts: ['slow'], melody: [72, 89], fallback: 'waterphone', attackMs: 60, releaseMs: 900 },
  organ: { family: 'keys', arts: ['sus'], melody: [44, 84], fallback: 'pad', attackMs: 30, releaseMs: 300 },
  'frame-drum': { family: 'perc', arts: ['hit', 'muted'], fallback: 'silent', attackMs: 2, releaseMs: 200 },
  darbuka: { family: 'perc', arts: ['hit'], fallback: 'silent', attackMs: 2, releaseMs: 200 },
  bongos: { family: 'perc', arts: ['hit'], fallback: 'silent', attackMs: 2, releaseMs: 200 },
  tambourine: { family: 'perc', arts: ['hit'], fallback: 'silent', attackMs: 2, releaseMs: 250 },
  shaker: { family: 'perc', arts: ['hit'], fallback: 'silent', attackMs: 2, releaseMs: 120 },
  claves: { family: 'perc', arts: ['hit'], fallback: 'silent', attackMs: 2, releaseMs: 120 },
  woodblock: { family: 'perc', arts: ['hit'], fallback: 'silent', attackMs: 2, releaseMs: 120 },
  timpani: { family: 'perc', arts: ['hit', 'roll'], pitchedPerc: true, fallback: 'silent', attackMs: 2, releaseMs: 800 },
  'bass-drum': { family: 'perc', arts: ['hit'], fallback: 'silent', attackMs: 2, releaseMs: 500 },
  'cymbal-swell': { family: 'perc', arts: ['swell'], fallback: 'silent', attackMs: 2, releaseMs: 1500 },
  foley: {
    family: 'foley',
    arts: ['footstep_concrete', 'footstep_wood', 'impactWood_light', 'impactWood_heavy', 'impactSoft_heavy', 'impactSoft_medium', 'impactPlank_medium', 'impactMining', 'impactPunch_medium', 'cloth', 'creak', 'handleCoins'],
    fallback: 'silent',
    attackMs: 2,
    releaseMs: 200,
  },
  voice: { family: 'voice', arts: ['oo'], melody: [43, 81], fallback: 'voice', attackMs: 280, releaseMs: 700, synthOnly: true },
  brass: { family: 'wind', arts: ['sus'], mono: true, melody: [52, 84], fallback: 'brass', attackMs: 22, releaseMs: 110, synthOnly: true },
  waterphone: { family: 'mallet', arts: ['bowed'], melody: [55, 96], fallback: 'waterphone', attackMs: 500, releaseMs: 1600, synthOnly: true },
  snare: { family: 'perc', arts: ['hit', 'roll'], fallback: 'snare', attackMs: 2, releaseMs: 150, synthOnly: true },
  rattle: { family: 'perc', arts: ['hit'], fallback: 'rattle', attackMs: 2, releaseMs: 80, synthOnly: true },
  anvil: { family: 'perc', arts: ['hit'], fallback: 'anvil', attackMs: 2, releaseMs: 900, synthOnly: true },
  choir: {
    family: 'patch',
    arts: ['oo'],
    melody: [45, 79],
    fallback: 'voice',
    attackMs: 280,
    releaseMs: 700,
    patch: {
      layers: [
        { inst: 'voice', transpose: 0, gainDb: 0 },
        { inst: 'violas', transpose: 0, gainDb: -11 },
      ],
      minMidi: 45,
    },
  },
  trumpet: {
    family: 'patch',
    arts: ['sus'],
    mono: true,
    melody: [55, 76],
    fallback: 'brass',
    attackMs: 22,
    releaseMs: 110,
    patch: {
      layers: [
        { inst: 'brass', transpose: 0, gainDb: 0 },
        { inst: 'horn', transpose: -12, gainDb: -12 },
      ],
      minMidi: 55,
    },
  },
}

export function isInstrumentId(id: string): id is InstrumentId {
  return (INSTRUMENT_IDS as readonly string[]).includes(id)
}

/** Resolves an articulation request: the instrument's default when none or an unknown one is asked for. */
export function articulationOf(id: InstrumentId, art?: string): string {
  const def = INSTRUMENTS[id]
  return art && def.arts.includes(art) ? art : def.arts[0]!
}

/** Which samples a (pitched) instrument has at each articulation, by root MIDI, from the manifest. */
export interface SampleRoots {
  [inst: string]: { [art: string]: readonly number[] }
}

/** The playable range: the samples' roots ±4 semitones; a code-made voice plays its melody range; null when missing. */
export function playableRange(roots: SampleRoots, inst: InstrumentId, art?: string): readonly [number, number] | null {
  const def = INSTRUMENTS[inst]
  if (def.patch) return [def.patch.minMidi, def.melody?.[1] ?? 108]
  if (def.synthOnly) return def.melody ?? [24, 108]
  const a = articulationOf(inst, art)
  const list = roots[inst]?.[a]
  if (!list || list.length === 0) return null
  return [Math.min(...list) - 4, Math.max(...list) + 4]
}

/** The octave move (a multiple of 12) that puts the most of these pitches inside the range; a tie goes to the smaller move. */
export function octaveShiftInto(pitches: readonly number[], range: readonly [number, number]): number {
  let best = 0
  let bestIn = -1
  for (let k = -4; k <= 4; k++) {
    const s = k * 12
    let n = 0
    for (const p of pitches) if (p + s >= range[0] && p + s <= range[1]) n++
    if (n > bestIn || (n === bestIn && Math.abs(s) < Math.abs(best))) {
      best = s
      bestIn = n
    }
  }
  return best
}

/** A pitch moved by octaves into the range (a range narrower than an octave keeps whichever octave lands nearer). */
export function foldInto(midi: number, range: readonly [number, number]): number {
  let m = midi
  while (m > range[1]) m -= 12
  while (m < range[0]) m += 12
  if (m > range[1]) return m - range[1] <= range[0] - (m - 12) ? m : m - 12
  return m
}

/** The nearest sample root to `midi` within ±4 semitones, preferring the one just below. */
export function nearestRoot(list: readonly number[], midi: number): number | null {
  let best: number | null = null
  let bestScore = Infinity
  for (const r of list) {
    const d = midi - r
    if (Math.abs(d) > 4) continue
    const score = Math.abs(d) * 2 + (d < 0 ? 1 : 0)
    if (score < bestScore) {
      bestScore = score
      best = r
    }
  }
  return best
}
