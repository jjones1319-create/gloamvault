/**
 * The buses and the master chain (ported from Wildsong Ranch's engine/context.ts, SOUND_UPGRADE §4.2–4.3 there):
 *
 *   songs → musicBus: HP 35 Hz · high shelf −1.5 dB @ 7 kHz · duck · pause lowpass ─┐
 *   beds  → ambienceBus ─────────────────────────────────────────────────────────────┴→ mix: glue 1.5:1 @ −20 dB
 *   sfx   → sfxBus: compressor 2:1 @ −16 dB ───────────────────────────────────────────┐
 *   ui    → uiBus ────────────────────────────────────────────────────────────────────┤  (effects join after the glue)
 *   mix → phone-speaker EQ → limiter (−4 dB, 20:1) → master gain → width 70% → out
 *
 * Reverbs: a music slot (hall or room) and a place slot (outdoor, room, cave, underwater) fed by the beds and the
 * effects. Effects and UI join after the glue so a hit never pulls the music down. Gloamvault's settings (Phase 8):
 * master, music and effects sliders (gain = (v/100)²) and a mute; the ambience rides the effects slider. Works on an
 * AudioContext and on an OfflineAudioContext.
 */
import { makeCompressor, makeFilter, makeGain, rampTo } from './nodes.ts'
import { Meters } from './meters.ts'
import { ReverbSlot } from './reverb.ts'

export interface VolumeSettings {
  master: number
  music: number
  sfx: number
  muted: boolean
}

export interface Graph {
  ctx: BaseAudioContext
  /** Songs connect here. */
  music: GainNode
  /** Beds connect here. */
  ambience: GainNode
  /** Effects connect here. */
  sfx: GainNode
  /** UI ticks connect here. */
  ui: GainNode
  master: GainNode
  reverbMusic: ReverbSlot
  reverbPlace: ReverbSlot
  meters: Meters | null
  setVolumes(v: VolumeSettings): void
  /** The pause filter: lowpass to 700 Hz and −4 dB over 300 ms; off reverses it. */
  setPaused(on: boolean): void
  /** The only duck: the music dips `db` for `seconds` (an Ultimate's flourish). */
  duck(db: number, seconds: number): void
  musicFilterHz(): number
  duckDb(): number
}

/** The phone-speaker preset (Wildsong's default): high-pass 90 Hz, −2.5 dB at 3.2 kHz, −2 dB shelf at 8 kHz, 70% width. */
export const SPEAKER = { hpHz: 90, peakDb: -2.5, peakHz: 3200, shelfDb: -2, shelfHz: 8000, width: 0.7 }

export function sliderGain(v: number): number {
  const x = Math.max(0, Math.min(100, v)) / 100
  return x * x
}

export function createGraph(ctx: BaseAudioContext, opts: { seed?: number; meters?: boolean } = {}): Graph {
  const seed = opts.seed ?? 0x1e5e4b
  const music = makeGain(ctx, 1)
  const musicHp = makeFilter(ctx, 'highpass', 35, 0.707)
  const musicShelf = makeFilter(ctx, 'highshelf', 7000, 0.707, -1.5)
  const musicDuck = makeGain(ctx, 1)
  const musicFilter = makeFilter(ctx, 'lowpass', 20000, 0.5)
  const musicOut = makeGain(ctx, 1)
  music.connect(musicHp)
  musicHp.connect(musicShelf)
  musicShelf.connect(musicDuck)
  musicDuck.connect(musicFilter)
  musicFilter.connect(musicOut)

  const ambience = makeGain(ctx, 1)
  const ambienceOut = makeGain(ctx, 1)
  ambience.connect(ambienceOut)

  const mix = makeGain(ctx, 1)
  musicOut.connect(mix)
  ambienceOut.connect(mix)
  const glue = makeCompressor(ctx, { thresholdDb: -20, kneeDb: 6, ratio: 1.5, attackSec: 0.03, releaseSec: 0.3 })
  mix.connect(glue.input)

  const sfx = makeGain(ctx, 1)
  const sfxComp = makeCompressor(ctx, { thresholdDb: -16, kneeDb: 6, ratio: 2, attackSec: 0.003, releaseSec: 0.15 })
  sfx.connect(sfxComp.input)
  const ui = makeGain(ctx, 1)

  const eqHp = makeFilter(ctx, 'highpass', SPEAKER.hpHz, 0.707)
  const eqPeak = makeFilter(ctx, 'peaking', SPEAKER.peakHz, 0.9, SPEAKER.peakDb)
  const eqShelf = makeFilter(ctx, 'highshelf', SPEAKER.shelfHz, 0.707, SPEAKER.shelfDb)
  glue.output.connect(eqHp)
  sfxComp.output.connect(eqHp)
  ui.connect(eqHp)
  eqHp.connect(eqPeak)
  eqPeak.connect(eqShelf)
  const limiter = makeCompressor(ctx, { thresholdDb: -4, kneeDb: 0, ratio: 20, attackSec: 0.001, releaseSec: 0.12 })
  eqShelf.connect(limiter.input)
  const master = makeGain(ctx, 1)
  limiter.output.connect(master)
  // Width: L' = L(1+w)/2 + R(1−w)/2, R' = L(1−w)/2 + R(1+w)/2.
  const split = ctx.createChannelSplitter(2)
  const merge = ctx.createChannelMerger(2)
  const w = SPEAKER.width
  const ll = makeGain(ctx, (1 + w) / 2)
  const lr = makeGain(ctx, (1 - w) / 2)
  const rl = makeGain(ctx, (1 - w) / 2)
  const rr = makeGain(ctx, (1 + w) / 2)
  master.connect(split)
  split.connect(ll, 0)
  split.connect(lr, 0)
  split.connect(rl, 1)
  split.connect(rr, 1)
  ll.connect(merge, 0, 0)
  rl.connect(merge, 0, 0)
  lr.connect(merge, 0, 1)
  rr.connect(merge, 0, 1)
  merge.connect(ctx.destination)

  const reverbMusic = new ReverbSlot(ctx, music, 'hall', seed)
  const reverbPlace = new ReverbSlot(ctx, ambience, 'room', seed + 1)

  let meters: Meters | null = null
  if (opts.meters) {
    meters = new Meters()
    meters.attach(ctx, 'music', musicOut)
    meters.attach(ctx, 'ambience', ambienceOut)
    meters.attach(ctx, 'sfx', sfxComp.output)
    meters.attach(ctx, 'master', master)
  }

  let duckUntil = 0
  let duckLevel = 1
  let paused = false
  const graph: Graph = {
    ctx,
    music,
    ambience,
    sfx,
    ui,
    master,
    reverbMusic,
    reverbPlace,
    meters,
    setVolumes(v) {
      const now = ctx.currentTime
      rampTo(master.gain, v.muted ? 0 : sliderGain(v.master), now, 0.05)
      rampTo(music.gain, sliderGain(v.music), now, 0.05)
      rampTo(sfx.gain, sliderGain(v.sfx), now, 0.05)
      rampTo(ambience.gain, sliderGain(v.sfx), now, 0.05)
      rampTo(ui.gain, sliderGain(v.sfx), now, 0.05)
    },
    setPaused(on) {
      if (paused === on) return
      paused = on
      const now = ctx.currentTime
      musicFilter.frequency.cancelScheduledValues(now)
      musicFilter.frequency.setValueAtTime(musicFilter.frequency.value, now)
      musicFilter.frequency.exponentialRampToValueAtTime(on ? 700 : 20000, now + 0.3)
      const d = duckUntil > now ? duckLevel : 1
      rampTo(musicDuck.gain, on ? Math.pow(10, -4 / 20) * d : d, now, 0.3)
    },
    duck(db, seconds) {
      const now = ctx.currentTime
      duckLevel = Math.pow(10, -Math.abs(db) / 20)
      duckUntil = now + seconds
      const pausedGain = paused ? Math.pow(10, -4 / 20) : 1
      rampTo(musicDuck.gain, duckLevel * pausedGain, now, 0.05)
      musicDuck.gain.setValueAtTime(duckLevel * pausedGain, now + seconds - 0.2)
      musicDuck.gain.linearRampToValueAtTime(pausedGain, now + seconds)
    },
    musicFilterHz: () => musicFilter.frequency.value,
    duckDb: () => {
      const g = musicDuck.gain.value
      return g > 0 ? 20 * Math.log10(g) : -Infinity
    },
  }
  return graph
}
