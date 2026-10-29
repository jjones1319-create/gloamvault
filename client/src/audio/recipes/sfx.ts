/**
 * The sound effects (Phase 8; the recipe shape is Wildsong Ranch's, every recipe is new). Natural sources only: CC0
 * Foley (Kenney), a few CC0 instrument samples, filtered noise, sine and triangle tones. Soft transients, every sound
 * fades out. An effect is a list of layers; pitched layers that follow the playing piece's key use scale degrees, so a
 * heal or a level-up chime is always in tune with the music. Pure data; `engine/sfx.ts` performs it.
 *
 * Tied to what the game already logs (sounds.ts maps them): the fight's beats (damage by type, crits, heals, statuses,
 * tells, the arena's events, deaths), the delve's log (doors, traps, curios, chests, gold, stairs, the Waystone, the
 * hunter) and the UI (taps, confirm, back, errors, coins, a chest's reveal).
 */
import type { FilterSpec, NoiseColor } from './ambience.ts'
import { INSTRUMENTS, type InstrumentId } from './instruments.ts'

export type SfxBus = 'sfx' | 'ui'

export type SfxLayer =
  | { kind: 'noise'; color: NoiseColor; filter?: FilterSpec; sweepTo?: number; a: number; h?: number; d: number; gainDb?: number; delay?: number; lowpassHz?: number; am?: number; reverse?: boolean }
  | { kind: 'tone'; wave: 'sine' | 'triangle'; hz: number; to?: number; a: number; h?: number; d: number; gainDb?: number; delay?: number; detune?: number; lowpassHz?: number }
  | { kind: 'sample'; inst: InstrumentId; art?: string; midi?: number; vel?: number; gainDb?: number; delay?: number; cents?: number; lowpassHz?: number; dur?: number }
  | { kind: 'note'; inst: InstrumentId; art?: string; degree: number; octave?: number; dur: number; vel?: number; gainDb?: number; delay?: number; semis?: number }
  | { kind: 'chord'; inst: InstrumentId; art?: string; degrees: readonly number[]; octave?: number; dur: number; vel?: number; gainDb?: number; delay?: number; rollMs?: number }

export interface SfxDef {
  bus: SfxBus
  layers: readonly SfxLayer[]
  /** Minimum gap between two plays of this id, ms. */
  throttleMs?: number
  /** A trim on the whole effect, dB. */
  trimDb?: number
  /** A send into the place's reverb (0–1): a sound that belongs to the room. */
  reverb?: number
}

type Noise = Extract<SfxLayer, { kind: 'noise' }>
type Tone = Extract<SfxLayer, { kind: 'tone' }>
type Sample = Extract<SfxLayer, { kind: 'sample' }>
type Note = Extract<SfxLayer, { kind: 'note' }>

const noise = (color: NoiseColor, filter: FilterSpec | undefined, a: number, d: number, gainDb: number, extra: Partial<Noise> = {}): SfxLayer => ({ kind: 'noise', color, filter, a, d, gainDb, ...extra })
const tone = (wave: 'sine' | 'triangle', hz: number, a: number, d: number, gainDb: number, extra: Partial<Tone> = {}): SfxLayer => ({ kind: 'tone', wave, hz, a, d, gainDb, ...extra })
const foley = (art: string, gainDb: number, extra: Partial<Sample> = {}): SfxLayer => ({ kind: 'sample', inst: 'foley', art, gainDb, ...extra })
const sample = (inst: InstrumentId, gainDb: number, extra: Partial<Sample> = {}): SfxLayer => ({ kind: 'sample', inst, gainDb, ...extra })
const note = (inst: InstrumentId, degree: number, octave: number, dur: number, gainDb: number, extra: Partial<Note> = {}): SfxLayer => ({ kind: 'note', inst, degree, octave, dur, gainDb, ...extra })
const bp = (hz: number, q = 1): FilterSpec => ({ type: 'bandpass', hz, q })
const lp = (hz: number, q = 0.6): FilterSpec => ({ type: 'lowpass', hz, q })
const hp = (hz: number, q = 0.7): FilterSpec => ({ type: 'highpass', hz, q })

/** A soft wooden tock: the tap every button makes (UI bus, so the Effects slider sets it). */
const tock = (hz: number, gainDb: number, delay = 0): SfxLayer[] => [tone('sine', hz, 2, 45, gainDb, { to: hz * 0.78, delay }), noise('white', bp(3200, 1.2), 1, 9, gainDb - 9, { delay })]

/* ---------- UI ---------- */

export const UI_SFX = {
  'ui-tap': { bus: 'ui', throttleMs: 50, layers: tock(880, -17) },
  'ui-confirm': { bus: 'ui', throttleMs: 60, layers: [...tock(880, -18), note('harp', 5, 5, 0.35, -16, { vel: 0.4 }), note('harp', 8, 5, 0.5, -16, { vel: 0.4, delay: 0.07 })] },
  'ui-back': { bus: 'ui', throttleMs: 60, layers: [...tock(640, -18), foley('cloth', -8, { vel: 0.5, lowpassHz: 4000 })] },
  'ui-error': { bus: 'ui', throttleMs: 200, layers: [noise('brown', lp(260, 0.7), 3, 70, -12), tone('triangle', 150, 3, 120, -16, { to: 118, lowpassHz: 900 })] },
  'ui-coins': { bus: 'ui', throttleMs: 120, layers: [foley('handleCoins', -6, { vel: 0.6, lowpassHz: 6000 }), tone('sine', 2700, 2, 140, -26, { delay: 0.04, lowpassHz: 6000 })] },
  'ui-heavy': { bus: 'ui', throttleMs: 80, layers: [...tock(520, -16), noise('brown', lp(300), 3, 90, -18)] },
} as const satisfies Record<string, SfxDef>

/** A chest's reveal at the Curio Merchant: the lid, a thunk, a harp rising, and a sparkle that grows with the grade. */
export function chestRevealSfx(rare: boolean): SfxDef {
  const sparkle = rare ? [0, 1, 2, 3, 4].map((i) => tone('sine', 2600 + 420 * i, 2, 260, -24 - i, { delay: 0.32 + i * 0.06, lowpassHz: 7000 })) : []
  return {
    bus: 'sfx',
    throttleMs: 300,
    reverb: 0.25,
    layers: [
      foley('creak', -4, { vel: 0.6, lowpassHz: 5000, cents: 200 }),
      foley('impactWood_light', -8, { vel: 0.6, delay: 0.16, lowpassHz: 4500 }),
      { kind: 'chord', inst: 'harp', degrees: rare ? [1, 3, 5, 8, 10] : [1, 3, 5, 8], octave: 4, dur: 1.2, vel: 0.5, gainDb: -10, delay: 0.2, rollMs: 55 },
      ...sparkle,
    ],
  }
}

/* ---------- the delve ---------- */

const steps = (art: string, n: number, gap: number, gainDb: number, fall = 0): SfxLayer[] => Array.from({ length: n }, (_, i) => foley(art, gainDb - i * fall, { vel: 0.6, delay: i * gap, lowpassHz: 4000, cents: -i * 60 * Math.sign(fall) }))

export const DELVE_SFX = {
  door: { bus: 'sfx', throttleMs: 400, reverb: 0.35, layers: [foley('creak', -6, { vel: 0.55, lowpassHz: 3800, cents: -300 }), ...steps('footstep_concrete', 3, 0.3, -6)] },
  'trap-spotted': { bus: 'sfx', throttleMs: 300, layers: [tone('sine', 1760, 3, 160, -6, { lowpassHz: 5000 }), note('harp', 5, 5, 0.4, -2, { vel: 0.45, delay: 0.05 }), note('harp', 7, 5, 0.5, -4, { vel: 0.4, delay: 0.14 })] },
  trap: { bus: 'sfx', throttleMs: 300, reverb: 0.3, layers: [noise('white', bp(1800, 1.3), 1, 60, -10), foley('impactMining', -4, { vel: 0.75, lowpassHz: 4500, delay: 0.02 }), tone('sine', 85, 2, 260, -10, { to: 50, delay: 0.03 })] },
  disarm: { bus: 'sfx', throttleMs: 200, layers: [foley('impactWood_light', -8, { vel: 0.5, cents: 500, lowpassHz: 6000 }), foley('impactWood_light', -10, { vel: 0.45, cents: 700, lowpassHz: 6000, delay: 0.11 }), note('harp', 8, 5, 0.4, -18, { vel: 0.4, delay: 0.16 })] },
  'disarm-fail': { bus: 'sfx', throttleMs: 200, layers: [foley('impactMining', -6, { vel: 0.6, lowpassHz: 3500 }), noise('brown', lp(240), 3, 120, -14, { delay: 0.04 })] },
  secret: { bus: 'sfx', throttleMs: 600, reverb: 0.4, layers: [noise('brown', lp(320), 120, 1100, -10, { am: 9 }), tone('sine', 60, 200, 900, -14), note('harp', 5, 4, 1, -18, { vel: 0.35, delay: 0.9 })] },
  key: { bus: 'sfx', throttleMs: 300, layers: [foley('handleCoins', 2, { vel: 0.5, cents: 900, lowpassHz: 7000 }), tone('sine', 3100, 2, 120, -16, { delay: 0.05 }), tone('sine', 3700, 2, 140, -18, { delay: 0.12 })] },
  gold: { bus: 'sfx', throttleMs: 250, layers: [foley('handleCoins', -4, { vel: 0.65, lowpassHz: 6500 }), foley('handleCoins', -8, { vel: 0.5, delay: 0.12, lowpassHz: 6000 }), note('harp', 5, 5, 0.4, -18, { vel: 0.4, delay: 0.05 })] },
  chest: { bus: 'sfx', throttleMs: 300, reverb: 0.3, layers: [foley('creak', -4, { vel: 0.6, lowpassHz: 4500, cents: 150 }), foley('impactWood_heavy', -8, { vel: 0.55, delay: 0.25, lowpassHz: 3500 }), foley('handleCoins', -8, { vel: 0.55, delay: 0.38, lowpassHz: 6000 })] },
  'lock-fail': { bus: 'sfx', throttleMs: 300, layers: [0, 0.09, 0.18].map((t, i) => foley('impactWood_light', -8 - i, { vel: 0.55, cents: 900, lowpassHz: 5000, delay: t })) },
  curio: { bus: 'sfx', throttleMs: 400, reverb: 0.4, layers: [{ kind: 'chord', inst: 'harp', degrees: [1, 2, 5, 9], octave: 4, dur: 1.4, vel: 0.4, gainDb: -14, rollMs: 70 }, tone('sine', 110, 300, 900, -18, { lowpassHz: 500 })] },
  stairs: { bus: 'sfx', throttleMs: 800, reverb: 0.45, layers: [...steps('footstep_concrete', 5, 0.32, -5, 2), noise('pink', bp(300, 0.6), 400, 1400, -20, { sweepTo: 150 })] },
  waystone: { bus: 'sfx', throttleMs: 1000, reverb: 0.5, layers: [tone('sine', 110, 300, 1400, -14), tone('sine', 165.4, 350, 1400, -18), tone('sine', 220.6, 400, 1300, -20), { kind: 'chord', inst: 'harp', degrees: [1, 5, 8, 12], octave: 4, dur: 1.6, vel: 0.4, gainDb: -14, delay: 0.3, rollMs: 90 }] },
  'hunter-enters': { bus: 'sfx', throttleMs: 1500, reverb: 0.6, layers: [sample('frame-drum', -6, { vel: 0.7, lowpassHz: 900 }), tone('sine', 55, 30, 1200, -10), noise('pink', bp(220, 0.8), 300, 1500, -18, { sweepTo: 120 })] },
  'hunter-near': { bus: 'sfx', throttleMs: 4000, reverb: 0.4, layers: [noise('brown', bp(180, 1.2), 200, 700, -10, { am: 22 }), sample('frame-drum', -8, { art: 'muted', vel: 0.6, delay: 0.5 }), sample('frame-drum', -10, { art: 'muted', vel: 0.5, delay: 0.78 })] },
  rest: { bus: 'sfx', throttleMs: 1000, reverb: 0.2, layers: [noise('pink', lp(700), 250, 900, -14, { sweepTo: 1600 }), { kind: 'chord', inst: 'harp', degrees: [1, 3, 5], octave: 4, dur: 1.4, vel: 0.35, gainDb: -16, delay: 0.3, rollMs: 80 }] },
  repair: { bus: 'sfx', throttleMs: 400, reverb: 0.25, layers: [0, 0.28, 0.56].map((t, i) => foley('impactMining', -8 - i, { vel: 0.55, lowpassHz: 5000, delay: t, cents: 300 })) },
  potion: { bus: 'sfx', throttleMs: 300, layers: [tone('sine', 420, 4, 70, -14, { to: 980 }), noise('white', bp(900, 2), 20, 260, -22, { am: 14, delay: 0.08 }), note('harp', 8, 5, 0.4, -18, { vel: 0.4, delay: 0.22 })] },
  raise: { bus: 'sfx', throttleMs: 1500, reverb: 0.5, layers: [{ kind: 'chord', inst: 'voice', degrees: [1, 5, 8], octave: 3, dur: 2, vel: 0.5, gainDb: -10 }, { kind: 'chord', inst: 'harp', degrees: [1, 3, 5, 8, 10], octave: 4, dur: 1.6, vel: 0.45, gainDb: -12, delay: 0.4, rollMs: 80 }] },
  'first-aid': { bus: 'sfx', throttleMs: 400, layers: [foley('cloth', -4, { vel: 0.6, lowpassHz: 5000 }), foley('cloth', -6, { vel: 0.5, delay: 0.22, lowpassHz: 4500 }), note('harp', 5, 5, 0.4, -18, { vel: 0.4, delay: 0.3 })] },
  coins: { bus: 'sfx', throttleMs: 200, layers: [foley('handleCoins', -5, { vel: 0.6, lowpassHz: 6000 })] },
  relic: { bus: 'sfx', throttleMs: 600, layers: [tone('sine', 1400, 3, 400, -20, { to: 2100, lowpassHz: 5000 }), foley('handleCoins', -10, { vel: 0.5, cents: 600, delay: 0.3 })] },
  ambush: { bus: 'sfx', throttleMs: 800, reverb: 0.35, layers: [sample('frame-drum', -3, { vel: 0.85 }), tone('sine', 70, 2, 400, -8, { to: 45 }), noise('white', hp(1800), 2, 120, -16, { delay: 0.01 })] },
  'fight-start': { bus: 'sfx', throttleMs: 800, reverb: 0.3, layers: [sample('frame-drum', -6, { vel: 0.7 }), foley('cloth', -6, { vel: 0.55, delay: 0.05, lowpassHz: 4000 })] },
  floor: { bus: 'sfx', throttleMs: 1500, reverb: 0.6, layers: [tone('sine', 50, 80, 1600, -12), noise('pink', bp(260, 0.6), 600, 1800, -22, { sweepTo: 140 })] },
  item: { bus: 'sfx', throttleMs: 250, layers: [foley('cloth', -6, { vel: 0.55, lowpassHz: 5000 }), note('harp', 5, 5, 0.3, -18, { vel: 0.4, delay: 0.08 })] },
} as const satisfies Record<string, SfxDef>

/* ---------- the fight ---------- */

/** One blow by its damage type or element (vfx/recipes.ts's FxKind): what a hit sounds like. */
export const HIT_SFX = {
  slash: [noise('white', bp(2600, 1.1), 6, 90, -14, { sweepTo: 5200 }), foley('impactPunch_medium', -10, { vel: 0.6, lowpassHz: 4500, delay: 0.04 })],
  pierce: [noise('white', hp(2200), 3, 50, -16, { sweepTo: 3600 }), foley('impactWood_light', -8, { vel: 0.6, lowpassHz: 5000, delay: 0.03 })],
  blunt: [foley('impactSoft_heavy', -6, { vel: 0.7, lowpassHz: 4000 }), tone('sine', 95, 2, 160, -10, { to: 52 })],
  fire: [noise('pink', lp(450), 30, 260, -12, { sweepTo: 2600 }), noise('white', hp(2000), 2, 26, -20, { delay: 0.1 }), noise('white', hp(2300), 2, 20, -22, { delay: 0.18 })],
  frost: [tone('sine', 2100, 2, 140, -18, { lowpassHz: 6000 }), tone('sine', 3300, 2, 110, -20, { lowpassHz: 6000 }), tone('sine', 4700, 2, 80, -22, { lowpassHz: 6000 }), noise('white', bp(1500, 1), 2, 70, -14)],
  lightning: [noise('white', bp(1300, 1), 1, 45, -9), noise('brown', lp(160), 10, 420, -12, { delay: 0.03 })],
  poison: [noise('white', bp(1100, 1.4), 20, 300, -14, { am: 28 }), tone('sine', 240, 10, 220, -18, { to: 160, lowpassHz: 1200 })],
  holy: [note('harp', 8, 5, 0.6, -12, { vel: 0.5 }), tone('sine', 2640, 3, 400, -22, { lowpassHz: 7000 }), noise('white', hp(3200), 2, 60, -18)],
  shadow: [noise('pink', lp(800), 260, 40, -12, { reverse: true }), tone('sine', 55, 20, 480, -14)],
  bleed: [noise('white', bp(1500, 1.2), 4, 90, -14, { sweepTo: 2800 }), foley('impactSoft_medium', -8, { vel: 0.6, lowpassHz: 3500, delay: 0.03 })],
} as const satisfies Record<string, readonly SfxLayer[]>

export type HitKind = keyof typeof HIT_SFX

export const FIGHT_SFX = {
  crit: { bus: 'sfx', throttleMs: 60, layers: [noise('white', lp(5200), 1, 16, -8), tone('sine', 82, 2, 180, -8, { to: 44, delay: 0.01 }), foley('impactPunch_medium', -6, { vel: 0.8, lowpassHz: 5000 })] },
  miss: { bus: 'sfx', throttleMs: 80, layers: [noise('white', bp(1200, 1), 10, 100, -14, { sweepTo: 560 })] },
  heal: { bus: 'sfx', throttleMs: 120, layers: [1, 3, 5, 8].map((d, i) => note('harp', d, 4, 0.45, -3, { vel: 0.45, delay: i * 0.075 })) },
  buff: { bus: 'sfx', throttleMs: 120, layers: [note('harp', 5, 5, 0.35, -7, { vel: 0.4 }), note('harp', 9, 5, 0.45, -8, { vel: 0.4, delay: 0.07 }), tone('sine', 1980, 30, 320, -18, { to: 2640, lowpassHz: 6000 })] },
  debuff: { bus: 'sfx', throttleMs: 120, layers: [tone('triangle', 233, 10, 380, -16, { to: 156, lowpassHz: 1100 }), noise('pink', bp(600, 1), 40, 300, -22, { sweepTo: 260 })] },
  revive: { bus: 'sfx', throttleMs: 400, reverb: 0.4, layers: [{ kind: 'chord', inst: 'harp', degrees: [1, 5, 8, 10], octave: 4, dur: 1.2, vel: 0.5, gainDb: -10, rollMs: 60 }, { kind: 'chord', inst: 'voice', degrees: [1, 5], octave: 4, dur: 1.2, vel: 0.45, gainDb: -14, delay: 0.1 }] },
  guard: { bus: 'sfx', throttleMs: 150, layers: [foley('impactWood_heavy', -8, { vel: 0.6, lowpassHz: 2800 }), tone('sine', 140, 2, 140, -18, { to: 110 })] },
  tell: { bus: 'sfx', throttleMs: 600, reverb: 0.3, layers: [noise('pink', bp(300, 0.9), 500, 160, -14, { sweepTo: 1300 }), ...[0, 0.16, 0.28, 0.37, 0.44].map((t, i) => sample('frame-drum', -14 + i * 1.5, { art: 'muted', vel: 0.5, delay: t }))] },
  'tell-broken': { bus: 'sfx', throttleMs: 300, layers: [noise('white', bp(2200, 1.4), 1, 40, -12), tone('triangle', 520, 3, 260, -18, { to: 260, lowpassHz: 1800 })] },
  ultimate: { bus: 'sfx', throttleMs: 600, reverb: 0.45, layers: [noise('pink', bp(380, 0.7), 160, 520, -12, { sweepTo: 1800 }), { kind: 'chord', inst: 'harp', degrees: [1, 5, 8, 12], octave: 3, dur: 1.2, vel: 0.6, gainDb: -10, rollMs: 35 }, sample('cymbal-swell', -12, { vel: 0.5 })] },
  kill: { bus: 'sfx', throttleMs: 90, layers: [tone('sine', 72, 3, 300, -6, { to: 40 }), noise('brown', lp(220), 3, 260, -10), foley('impactSoft_heavy', -8, { vel: 0.6, lowpassHz: 2800, delay: 0.05 })] },
  downed: { bus: 'sfx', throttleMs: 200, layers: [foley('impactSoft_medium', -6, { vel: 0.6, lowpassHz: 3000 }), note('harp', 5, 4, 0.5, -14, { vel: 0.45, delay: 0.1 }), note('harp', 3, 4, 0.8, -14, { vel: 0.4, delay: 0.32 })] },
  fallen: { bus: 'sfx', throttleMs: 800, reverb: 0.6, layers: [sample('tubular-bells', -10, { midi: 57, vel: 0.55, lowpassHz: 1600, dur: 3 }), tone('sine', 55, 200, 1600, -16)] },
  'monster-flee': { bus: 'sfx', throttleMs: 300, layers: [...steps('footstep_concrete', 4, 0.13, -10, 2)] },
  flee: { bus: 'sfx', throttleMs: 800, layers: [...steps('footstep_concrete', 6, 0.15, -6, 1.5), noise('pink', bp(500, 0.7), 60, 500, -22, { sweepTo: 250 })] },
} as const satisfies Record<string, SfxDef>

/** The arena's events (07 §2.8): light, tide, braziers, candles and the rest. */
export const ARENA_SFX = {
  'light-down': { bus: 'sfx', throttleMs: 400, reverb: 0.4, layers: [noise('pink', lp(1600), 20, 600, -14, { sweepTo: 220 }), tone('sine', 98, 20, 500, -16, { to: 70 })] },
  'light-up': { bus: 'sfx', throttleMs: 400, reverb: 0.3, layers: [noise('pink', lp(300), 120, 400, -14, { sweepTo: 2400 }), tone('sine', 880, 40, 320, -24, { to: 1320, lowpassHz: 4000 })] },
  // 07 §2.2: "a sub-bass boom when the tide rises".
  tide: { bus: 'sfx', throttleMs: 600, reverb: 0.5, layers: [tone('sine', 48, 20, 900, -6, { to: 38 }), noise('pink', lp(600), 300, 1200, -12, { sweepTo: 260 })] },
  sluice: { bus: 'sfx', throttleMs: 500, reverb: 0.4, layers: [foley('creak', -4, { vel: 0.7, cents: -700, lowpassHz: 2500 }), noise('pink', bp(700, 0.7), 200, 900, -16, { sweepTo: 300, delay: 0.2 })] },
  brazier: { bus: 'sfx', throttleMs: 400, reverb: 0.3, layers: [noise('pink', lp(350), 40, 500, -10, { sweepTo: 2600 }), noise('white', hp(2000), 2, 30, -20, { delay: 0.2 }), noise('white', hp(2400), 2, 24, -22, { delay: 0.31 })] },
  candle: { bus: 'sfx', throttleMs: 300, reverb: 0.5, layers: [noise('white', hp(1600), 4, 140, -18, { sweepTo: 900 }), tone('sine', 196, 10, 420, -22, { to: 147, lowpassHz: 800 })] },
  doors: { bus: 'sfx', throttleMs: 800, reverb: 0.5, layers: [noise('brown', lp(300), 150, 1400, -8, { am: 7 }), tone('sine', 52, 200, 1100, -12)] },
  hunter: { bus: 'sfx', throttleMs: 800, reverb: 0.6, layers: [sample('frame-drum', -5, { vel: 0.8, lowpassHz: 1200 }), tone('sine', 62, 20, 900, -10, { to: 48 })] },
  recall: { bus: 'sfx', throttleMs: 500, reverb: 0.4, layers: [...steps('footstep_concrete', 3, 0.17, -8), sample('rattle', -10, { vel: 0.6 })] },
  pulse: { bus: 'sfx', throttleMs: 500, reverb: 0.4, layers: [noise('white', bp(2400, 0.8), 30, 400, -16, { sweepTo: 900 }), tone('sine', 1180, 10, 500, -24)] },
  pull: { bus: 'sfx', throttleMs: 500, reverb: 0.5, layers: [noise('pink', bp(500, 0.6), 200, 900, -10, { sweepTo: 180 }), tone('sine', 62, 100, 700, -14)] },
  frenzy: { bus: 'sfx', throttleMs: 800, layers: [tone('sine', 2900, 2, 260, -20), sample('frame-drum', -4, { vel: 0.85, delay: 0.15 }), sample('frame-drum', -6, { vel: 0.8, delay: 0.3 })] },
  slick: { bus: 'sfx', throttleMs: 300, layers: [foley('cloth', -4, { vel: 0.7, lowpassHz: 4000 }), noise('pink', bp(900, 1), 10, 220, -16, { delay: 0.08 })] },
  barricade: { bus: 'sfx', throttleMs: 800, reverb: 0.4, layers: [foley('impactWood_heavy', -2, { vel: 0.85, lowpassHz: 4000 }), foley('impactPlank_medium', -4, { vel: 0.75, delay: 0.14, lowpassHz: 4000 }), foley('impactPlank_medium', -8, { vel: 0.6, delay: 0.3, lowpassHz: 3500 })] },
  break: { bus: 'sfx', throttleMs: 400, reverb: 0.3, layers: [foley('impactMining', -3, { vel: 0.8, lowpassHz: 5000 }), noise('white', bp(1800, 1.2), 2, 140, -12, { delay: 0.02 })] },
  oath: { bus: 'sfx', throttleMs: 1000, reverb: 0.6, layers: [sample('tubular-bells', -2, { midi: 60, vel: 0.5, lowpassHz: 2000, dur: 2 })] },
} as const satisfies Record<string, SfxDef>

export type UiSfxId = keyof typeof UI_SFX
export type DelveSfxId = keyof typeof DELVE_SFX
export type FightSfxId = keyof typeof FIGHT_SFX
export type ArenaSfxId = keyof typeof ARENA_SFX

/** Every recipe that has a fixed id, for the debug view and the tests. */
export function allSfx(): Record<string, SfxDef> {
  const out: Record<string, SfxDef> = {}
  for (const [k, v] of Object.entries(UI_SFX)) out[k] = v
  for (const [k, v] of Object.entries(DELVE_SFX)) out[k] = v
  for (const [k, v] of Object.entries(FIGHT_SFX)) out[k] = v
  for (const [k, v] of Object.entries(ARENA_SFX)) out[`arena-${k}`] = v
  for (const [k, v] of Object.entries(HIT_SFX)) out[`hit-${k}`] = { bus: 'sfx', throttleMs: 45, layers: v }
  out['chest-reveal'] = chestRevealSfx(false)
  out['chest-reveal-rare'] = chestRevealSfx(true)
  return out
}

/** Every (instrument, articulation) the effects use: the core set the bank keeps loaded. */
export function sfxUsage(): { inst: string; art: string }[] {
  const out = new Map<string, { inst: string; art: string }>()
  for (const def of Object.values(allSfx())) {
    for (const l of def.layers) {
      if (l.kind !== 'sample' && l.kind !== 'note' && l.kind !== 'chord') continue
      const inst = INSTRUMENTS[l.inst]
      if (inst.synthOnly || inst.patch) continue
      const art = l.art ?? inst.arts[0]!
      out.set(`${l.inst}/${art}`, { inst: l.inst, art })
    }
  }
  return [...out.values()]
}
