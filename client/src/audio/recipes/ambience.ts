/**
 * The ambience beds (Phase 8; the bed engine is ported from Wildsong Ranch, its recipes rewritten for 07 §2.2's
 * "Fog / ambience" lines and Emberfall at dusk — 03 §13 step 2). A bed is a named set of layers: shaped noise with slow
 * movement, spawners of one-shot events (drips, clicks, chirps, a far bell, distant voices, the forge's anvil) and
 * steady tones. Levels are starting points in dBFS for each layer alone; `tuning.json` → `levels.beds` trims a whole
 * bed. Everything is made from filtered noise and sine tones, plus a few CC0 samples (a tubular bell, footsteps). Pure
 * data; `engine/ambience.ts` performs it.
 */
import type { InstrumentId } from './instruments.ts'

export type NoiseColor = 'white' | 'pink' | 'brown'

export interface FilterSpec {
  type: BiquadFilterType
  hz: number
  q?: number
  gainDb?: number
}

export interface NoiseLayer {
  kind: 'noise'
  id: string
  color: NoiseColor
  filters?: readonly FilterSpec[]
  levelDb: number
  /** A slow gain LFO: ±depthDb at rateHz (or a range picked per instance). */
  lfo?: { rateHz: number | readonly [number, number]; depthDb: number }
  /** A seeded random walk every 250 ms: ±db on the gain, ±hz on the first filter. */
  walk?: { db?: number; hz?: number }
  /** Amplitude modulation (murmur syllables). */
  am?: { rateHz: number | readonly [number, number]; depth: number }
  /** Two decorrelated sources panned left and right (default true). */
  stereo?: boolean
  pan?: number
}

export type SpawnEvent =
  | { kind: 'chirp'; hz: readonly [number, number]; ms: readonly [number, number]; sweep?: number; fm?: number }
  | { kind: 'click'; ms?: number }
  | { kind: 'drip'; from: number; to: number; ms: number }
  | { kind: 'crackle'; ms: readonly [number, number] }
  | { kind: 'bubble'; from: number; to: number; ms: number }
  | { kind: 'sample'; inst: InstrumentId; art: string; midi?: number }
  | { kind: 'noiseBurst'; color: NoiseColor; filter?: FilterSpec; ms: readonly [number, number]; lowpassHz?: number }
  /** A far, low rumble whose lowpass falls (something heavy, far off). */
  | { kind: 'rumble'; seconds: readonly [number, number] }
  | { kind: 'crickets'; hz: number; pulseHz: number; pulses: number }
  /** Distant voices: a swell of syllable-modulated, band-passed noise. */
  | { kind: 'murmur'; seconds: readonly [number, number]; hz: number }
  /** The forge's anvil: a struck steel ping. */
  | { kind: 'anvil'; hz: readonly [number, number] }

export interface SpawnLayer {
  kind: 'spawn'
  id: string
  levelDb: number
  /** Events (or phrases) per second, Poisson. */
  rate: number
  /** A phrase of several events. */
  burst?: { count: readonly [number, number]; gapMs: readonly [number, number] }
  event: SpawnEvent
  pan?: 'wide' | 'random' | number
  /** ±cents of pitch variation. */
  pitchCents?: number
  levelJitterDb?: number
  lowpassHz?: number
}

export interface ToneLayer {
  kind: 'tone'
  id: string
  hz: readonly number[]
  levelDb: number
  /** Slow beating between the tones. */
  beatHz?: number
  lowpassHz?: number
}

export type BedLayer = NoiseLayer | SpawnLayer | ToneLayer

export const BED_IDS = ['town', 'town-inn', 'town-forge', 'town-shrine', 'cellars', 'crypts', 'vault'] as const
export type BedId = (typeof BED_IDS)[number]

export interface BedRecipe {
  id: BedId
  layers: readonly BedLayer[]
  /** Beds this one extends (their layers come first). */
  extends?: BedId
}

const drips = (id: string, levelDb: number, rate: number): SpawnLayer => ({
  kind: 'spawn',
  id,
  levelDb,
  rate,
  event: { kind: 'drip', from: 1900, to: 1000, ms: 16 },
  pan: 'random',
  pitchCents: 350,
  levelJitterDb: 5,
})

const crackle = (id: string, levelDb: number, rate: number, pan = -0.4): SpawnLayer => ({ kind: 'spawn', id, levelDb, rate, event: { kind: 'crackle', ms: [6, 28] }, pan, levelJitterDb: 5, lowpassHz: 3500 })

/** The campfire a rest room adds to its zone's bed (07 §2.2: the Rest room's centrepiece). */
export const CAMPFIRE: readonly BedLayer[] = [
  crackle('campfire', -40, 7, 0),
  { kind: 'noise', id: 'campfire-roar', color: 'pink', filters: [{ type: 'lowpass', hz: 500, q: 0.6 }], levelDb: -44, lfo: { rateHz: [0.3, 0.6], depthDb: 3 }, stereo: false },
]

export const BEDS: Record<BedId, BedRecipe> = {
  // Emberfall at dusk: the air, a hearth, the forge across the square, a quiet murmur from the Lantern Inn, crickets.
  town: {
    id: 'town',
    layers: [
      { kind: 'noise', id: 'air', color: 'pink', filters: [{ type: 'bandpass', hz: 500, q: 0.5 }], levelDb: -46, lfo: { rateHz: [0.08, 0.2], depthDb: 4 }, walk: { db: 1.5, hz: 60 } },
      crackle('hearth', -48, 5),
      { kind: 'spawn', id: 'forge', levelDb: -42, rate: 1 / 14, burst: { count: [2, 4], gapMs: [320, 520] }, event: { kind: 'anvil', hz: [1080, 1260] }, pan: 0.5, levelJitterDb: 3, lowpassHz: 3200 },
      { kind: 'noise', id: 'murmur', color: 'pink', filters: [{ type: 'bandpass', hz: 420, q: 1.4 }, { type: 'lowpass', hz: 900, q: 0.5 }], levelDb: -50, am: { rateHz: [3, 5], depth: 0.45 }, lfo: { rateHz: [0.05, 0.12], depthDb: 4 }, stereo: false, pan: -0.5 },
      { kind: 'spawn', id: 'crickets', levelDb: -50, rate: 1 / 3, event: { kind: 'crickets', hz: 4300, pulseHz: 28, pulses: 6 }, pan: 'wide', pitchCents: 120, levelJitterDb: 4 },
      { kind: 'spawn', id: 'steps', levelDb: -40, rate: 1 / 22, burst: { count: [3, 5], gapMs: [430, 560] }, event: { kind: 'sample', inst: 'foley', art: 'footstep_concrete' }, pan: 'random', pitchCents: 80, levelJitterDb: 3, lowpassHz: 3800 },
    ],
  },
  // The Lantern Inn: the room's murmur up close, laughter now and then, the clink of a cup, the hearth.
  'town-inn': {
    id: 'town-inn',
    layers: [
      { kind: 'noise', id: 'room', color: 'brown', filters: [{ type: 'lowpass', hz: 320, q: 0.5 }], levelDb: -40 },
      { kind: 'noise', id: 'talk-low', color: 'pink', filters: [{ type: 'bandpass', hz: 360, q: 1.5 }], levelDb: -42, am: { rateHz: [3, 6], depth: 0.5 }, lfo: { rateHz: [0.1, 0.2], depthDb: 3 } },
      { kind: 'noise', id: 'talk-mid', color: 'pink', filters: [{ type: 'bandpass', hz: 820, q: 1.5 }], levelDb: -45, am: { rateHz: [3, 6], depth: 0.5 }, lfo: { rateHz: [0.1, 0.25], depthDb: 3 } },
      { kind: 'spawn', id: 'laughter', levelDb: -44, rate: 1 / 16, event: { kind: 'murmur', seconds: [0.6, 1.3], hz: 700 }, pan: 'random', levelJitterDb: 3 },
      { kind: 'spawn', id: 'cups', levelDb: -46, rate: 1 / 7, event: { kind: 'chirp', hz: [2300, 3200], ms: [35, 70] }, pan: 'random', pitchCents: 150, levelJitterDb: 4, lowpassHz: 5000 },
      crackle('hearth', -44, 6, 0.4),
      { kind: 'spawn', id: 'boards', levelDb: -40, rate: 1 / 18, burst: { count: [2, 4], gapMs: [420, 560] }, event: { kind: 'sample', inst: 'foley', art: 'footstep_wood' }, pan: 'random', pitchCents: 80, levelJitterDb: 3, lowpassHz: 3500 },
    ],
  },
  // Hesper's smithy: the anvil close by, the forge's fire, the bellows breathing.
  'town-forge': {
    id: 'town-forge',
    layers: [
      { kind: 'noise', id: 'fire', color: 'pink', filters: [{ type: 'lowpass', hz: 650, q: 0.6 }], levelDb: -40, lfo: { rateHz: [0.2, 0.5], depthDb: 3 } },
      crackle('coals', -44, 8, 0.2),
      { kind: 'spawn', id: 'anvil', levelDb: -34, rate: 1 / 4, burst: { count: [2, 5], gapMs: [280, 460] }, event: { kind: 'anvil', hz: [1100, 1300] }, pan: 0.3, levelJitterDb: 3, lowpassHz: 5200 },
      { kind: 'spawn', id: 'bellows', levelDb: -40, rate: 1 / 7, event: { kind: 'noiseBurst', color: 'pink', filter: { type: 'lowpass', hz: 420, q: 0.6 }, ms: [700, 1200] }, pan: -0.4, levelJitterDb: 2 },
    ],
  },
  // The Ember Shrine: still air and a low hum, a candle's flicker.
  'town-shrine': {
    id: 'town-shrine',
    layers: [
      { kind: 'tone', id: 'hum', hz: [110, 165, 220], levelDb: -50, beatHz: 0.3, lowpassHz: 700 },
      { kind: 'noise', id: 'air', color: 'pink', filters: [{ type: 'bandpass', hz: 420, q: 0.6 }], levelDb: -50, lfo: { rateHz: [0.05, 0.1], depthDb: 3 } },
      crackle('candles', -54, 2, 0),
    ],
  },
  // 07 §2.2 the Cellars: warm, damp brick; drips in the cisterns; the Company laughing somewhere far off; rats.
  cellars: {
    id: 'cellars',
    layers: [
      { kind: 'noise', id: 'room', color: 'brown', filters: [{ type: 'lowpass', hz: 260, q: 0.5 }], levelDb: -40, walk: { db: 1.5 } },
      drips('drips', -40, 0.5),
      { kind: 'spawn', id: 'company', levelDb: -50, rate: 1 / 32, event: { kind: 'murmur', seconds: [0.8, 1.6], hz: 620 }, pan: 'wide', levelJitterDb: 3, lowpassHz: 900 },
      { kind: 'spawn', id: 'rats', levelDb: -48, rate: 1 / 24, burst: { count: [2, 4], gapMs: [60, 140] }, event: { kind: 'chirp', hz: [2900, 4200], ms: [25, 60], sweep: 0.4, fm: 55 }, pan: 'wide', pitchCents: 200, levelJitterDb: 3, lowpassHz: 6000 },
      { kind: 'spawn', id: 'above', levelDb: -44, rate: 1 / 45, event: { kind: 'rumble', seconds: [1.2, 2.4] }, pan: 'random' },
    ],
  },
  // 07 §2.2 the Crypts: wind in unseen vents, the Warden's far bell every 90–150 s, bone-clicks in the dark.
  crypts: {
    id: 'crypts',
    layers: [
      { kind: 'noise', id: 'wind', color: 'pink', filters: [{ type: 'bandpass', hz: 380, q: 0.6 }], levelDb: -36, lfo: { rateHz: [0.06, 0.15], depthDb: 6 }, walk: { db: 2, hz: 120 } },
      { kind: 'noise', id: 'whistle', color: 'white', filters: [{ type: 'bandpass', hz: 1350, q: 7 }], levelDb: -54, lfo: { rateHz: [0.04, 0.09], depthDb: 6 }, walk: { hz: 140 } },
      { kind: 'noise', id: 'deep', color: 'brown', filters: [{ type: 'lowpass', hz: 170, q: 0.5 }], levelDb: -42 },
      { kind: 'spawn', id: 'bell', levelDb: -30, rate: 1 / 120, event: { kind: 'sample', inst: 'tubular-bells', art: 'hit', midi: 57 }, pan: 0.35, lowpassHz: 1500 },
      { kind: 'spawn', id: 'bones', levelDb: -46, rate: 1 / 20, burst: { count: [2, 5], gapMs: [30, 90] }, event: { kind: 'click', ms: 5 }, pan: 'wide', levelJitterDb: 4, lowpassHz: 4000 },
    ],
  },
  // 07 §2.2 the Drowned Vault: water everywhere — lapping, constant dripping, bubbles, sloshing, a sub-bass weight.
  vault: {
    id: 'vault',
    layers: [
      { kind: 'noise', id: 'water', color: 'pink', filters: [{ type: 'lowpass', hz: 700, q: 0.5 }], levelDb: -36, lfo: { rateHz: [0.22, 0.4], depthDb: 5 }, walk: { db: 2, hz: 90 } },
      { kind: 'noise', id: 'sub', color: 'brown', filters: [{ type: 'lowpass', hz: 90, q: 0.6 }], levelDb: -38, lfo: { rateHz: [0.04, 0.08], depthDb: 4 } },
      drips('drips', -38, 1.6),
      { kind: 'spawn', id: 'bubbles', levelDb: -44, rate: 0.3, burst: { count: [1, 4], gapMs: [40, 110] }, event: { kind: 'bubble', from: 420, to: 1200, ms: 30 }, pan: 'random', pitchCents: 200, levelJitterDb: 4 },
      { kind: 'spawn', id: 'slosh', levelDb: -42, rate: 1 / 9, event: { kind: 'noiseBurst', color: 'pink', filter: { type: 'bandpass', hz: 600, q: 0.7 }, ms: [300, 700], lowpassHz: 1800 }, pan: 'random', levelJitterDb: 3 },
    ],
  },
}

/** The bed's layers with any base bed's first. */
export function bedLayers(id: BedId): BedLayer[] {
  const r = BEDS[id]
  return [...(r.extends ? bedLayers(r.extends) : []), ...r.layers]
}

export function isBedId(id: string): id is BedId {
  return (BED_IDS as readonly string[]).includes(id)
}
