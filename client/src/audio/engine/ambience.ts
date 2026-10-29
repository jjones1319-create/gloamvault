/**
 * The ambience engine (ported from Wildsong Ranch's engine/ambience.ts, SOUND_UPGRADE §9.1 there; Wildsong's crowds and
 * weather overlays left behind). Only noise loops are played (8 s, seeded, with a crossfaded seam; pink and brown are
 * baked from the white loop); layers are shaped by biquads and moved slowly by an LFO and a seeded random walk every
 * 250 ms. Spawners fire one-shot events at a Poisson rate with random pan, pitch and level. Every stereo bed uses two
 * decorrelated sources. Beds crossfade over 2 s. Gloamvault adds three events: a far rumble, distant voices and the
 * forge's anvil.
 */
import TUNING from '../tuning.json'
import { bedLayers, type BedId, type BedLayer, type FilterSpec, type NoiseColor, type SpawnEvent, type SpawnLayer } from '../recipes/ambience.ts'
import { dbToGain, makeFilter, makeGain, makeOscillator, rampTo } from './nodes.ts'
import { between, createRng, type Rng } from './rng.ts'
import type { SampleBank } from './samples.ts'
import { VoicePool } from './voices.ts'
import type { Voice } from './sampler.ts'

const LOOP_SEC = 8
const SEAM_SEC = 0.1
const WALK_SEC = 0.25

const noiseCache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>()

/** The 8 s noise loop of a colour, one per colour per context; every layer plays it from its own offset. */
export function noiseLoop(ctx: BaseAudioContext, color: NoiseColor = 'white'): AudioBuffer {
  let perCtx = noiseCache.get(ctx)
  if (!perCtx) {
    perCtx = new Map()
    noiseCache.set(ctx, perCtx)
  }
  const cached = perCtx.get(color)
  if (cached) return cached
  const sr = ctx.sampleRate
  const n = Math.round(LOOP_SEC * sr)
  const buffer = ctx.createBuffer(1, n, sr)
  const d = buffer.getChannelData(0)
  const rng = createRng(0x5eed + (color === 'pink' ? 1 : color === 'brown' ? 2 : 0))
  for (let i = 0; i < n; i++) d[i] = rng() * 2 - 1
  const seam = Math.round(SEAM_SEC * sr)
  for (let i = 0; i < seam; i++) {
    const w = i / seam
    d[n - seam + i] = Math.cos((w * Math.PI) / 2) * d[n - seam + i]! + Math.sin((w * Math.PI) / 2) * d[i]!
  }
  colourInPlace(d, color, sr)
  perCtx.set(color, buffer)
  return buffer
}

/** Pink or brown from the white loop, filtered in JS (an IIRFilterNode costs Chrome ~400 ms to create). */
function colourInPlace(d: Float32Array, color: NoiseColor, sr: number): void {
  if (color === 'white') return
  const n = d.length
  const x = Float32Array.from(d)
  const warm = Math.min(n, Math.round(sr))
  if (color === 'brown') {
    let y1 = 0
    for (let i = n - warm; i < n; i++) y1 = 0.02 * x[i]! + 0.98 * y1
    for (let i = 0; i < n; i++) {
      y1 = 0.02 * x[i]! + 0.98 * y1
      d[i] = y1
    }
    return
  }
  let x1 = 0
  let x2 = 0
  let x3 = 0
  let y1 = 0
  let y2 = 0
  let y3 = 0
  const step = (x0: number): number => {
    const y = 0.049922035 * x0 - 0.095993537 * x1 + 0.050612699 * x2 - 0.004408786 * x3 + 2.494956002 * y1 - 2.017265875 * y2 + 0.5221894 * y3
    x3 = x2
    x2 = x1
    x1 = x0
    y3 = y2
    y2 = y1
    y1 = y
    return y
  }
  for (let i = n - warm; i < n; i++) step(x[i]!)
  for (let i = 0; i < n; i++) d[i] = step(x[i]!)
}

/** The makeup after each colour so it sits near the white loop's RMS (−5 dBFS). */
export const COLOUR_MAKEUP_DB: Record<NoiseColor, number> = { white: 0, pink: 20, brown: 14 }

export function colourChain(ctx: BaseAudioContext, color: NoiseColor): { input: AudioNode; output: AudioNode } | null {
  if (color === 'white') return null
  const makeup = makeGain(ctx, dbToGain(COLOUR_MAKEUP_DB[color]))
  return { input: makeup, output: makeup }
}

/** The Foley calibration (tuning levels.foley): each articulation's lift to a common level. */
export function foleyTrimDb(inst: string, art: string): number {
  return inst === 'foley' ? ((TUNING.levels.foley as Record<string, number>)[art] ?? 0) : 0
}

/** The white loop's RMS is about −5 dBFS; this lifts a layer so `levelDb` reads as its RMS. */
const WHITE_RMS_MAKEUP_DB = 5

/** The RMS a biquad takes out of broadband noise, roughly, so a recipe's level survives its filters. */
export function filterMakeupDb(f: { type: BiquadFilterType; q?: number }): number {
  switch (f.type) {
    case 'bandpass':
      return 6 + ((f.q ?? 0.707) > 1 ? 4 : 0)
    case 'lowpass':
    case 'highpass':
      return 2
    default:
      return 0
  }
}

interface LiveNoise {
  kind: 'noise'
  id: string
  gain: GainNode
  baseDb: number
  makeupDb: number
  firstFilter: BiquadFilterNode | null
  baseHz: number
  walk: { db: number; hz: number } | null
  walkDb: number
  walkHz: number
  sources: AudioScheduledSourceNode[]
}

interface LiveSpawn {
  kind: 'spawn'
  id: string
  gain: GainNode
  layer: SpawnLayer
}

interface LiveTone {
  kind: 'tone'
  id: string
  gain: GainNode
  sources: AudioScheduledSourceNode[]
}

type Live = LiveNoise | LiveSpawn | LiveTone

export interface BedInstance {
  key: string
  out: GainNode
  layers: Live[]
  stop(at: number, fadeSec: number): void
}

export class Ambience {
  readonly ctx: BaseAudioContext
  readonly dest: AudioNode
  readonly reverbSend: AudioNode
  readonly bank: SampleBank
  readonly rng: Rng
  readonly pool = new VoicePool('ambience', 16)
  current: BedInstance | null = null
  bedId: BedId | null = null
  /** The bed and its extra layers (a rest room's campfire), as one key. */
  bedKey: string | null = null
  /** Per-bed trims from calibration (dB). */
  bedTrims: Record<string, number> = {}
  private nextWalk = 0

  constructor(ctx: BaseAudioContext, dest: AudioNode, reverbSend: AudioNode, bank: SampleBank, rng: Rng) {
    this.ctx = ctx
    this.dest = dest
    this.reverbSend = reverbSend
    this.bank = bank
    this.rng = rng
  }

  private levelOf(baseDb: number, bedId: string): number {
    return baseDb + (this.bedTrims[bedId] ?? 0)
  }

  private buildNoise(layer: Extract<BedLayer, { kind: 'noise' }>, out: AudioNode, bedId: string): LiveNoise {
    const ctx = this.ctx
    const makeupDb = WHITE_RMS_MAKEUP_DB + (layer.filters ?? []).reduce((s, f) => s + filterMakeupDb(f), 0)
    const gain = makeGain(ctx, dbToGain(this.levelOf(layer.levelDb, bedId) + makeupDb))
    gain.connect(out)
    const sources: AudioScheduledSourceNode[] = []
    let firstFilter: BiquadFilterNode | null = null
    const chains = layer.stereo !== false ? [-0.7, 0.7] : [layer.pan ?? 0]
    chains.forEach((pan, i) => {
      const src = ctx.createBufferSource()
      src.buffer = noiseLoop(ctx, layer.color)
      src.loop = true
      let node: AudioNode = src
      const colour = colourChain(ctx, layer.color)
      if (colour) {
        node.connect(colour.input)
        node = colour.output
      }
      for (const f of layer.filters ?? []) {
        const bq = makeFilter(ctx, f.type, f.hz, f.q ?? 0.707, f.gainDb ?? 0)
        node.connect(bq)
        node = bq
        firstFilter ??= bq
      }
      if (layer.am) {
        const am = makeGain(ctx, 1 - layer.am.depth)
        const lfo = makeOscillator(ctx, 'sine', typeof layer.am.rateHz === 'number' ? layer.am.rateHz : between(this.rng, layer.am.rateHz[0], layer.am.rateHz[1]))
        const depth = makeGain(ctx, layer.am.depth)
        lfo.connect(depth)
        depth.connect(am.gain)
        node.connect(am)
        node = am
        lfo.start()
        sources.push(lfo)
      }
      if (Math.abs(pan) > 0.01 && typeof StereoPannerNode !== 'undefined') {
        const p = ctx.createStereoPanner()
        p.pan.value = pan
        node.connect(p)
        node = p
      }
      node.connect(gain)
      // The two channels start half a loop apart so they never line up.
      src.start(ctx.currentTime, (between(this.rng, 0, LOOP_SEC) + (i * LOOP_SEC) / chains.length) % LOOP_SEC)
      sources.push(src)
    })
    if (layer.lfo) {
      const rate = typeof layer.lfo.rateHz === 'number' ? layer.lfo.rateHz : between(this.rng, layer.lfo.rateHz[0], layer.lfo.rateHz[1])
      const lfo = makeOscillator(ctx, 'sine', rate)
      const depth = makeGain(ctx, gain.gain.value * (dbToGain(layer.lfo.depthDb) - 1) * 0.5)
      lfo.connect(depth)
      depth.connect(gain.gain)
      lfo.start()
      sources.push(lfo)
    }
    return { kind: 'noise', id: layer.id, gain, baseDb: layer.levelDb, makeupDb, firstFilter, baseHz: layer.filters?.[0]?.hz ?? 0, walk: layer.walk ? { db: layer.walk.db ?? 0, hz: layer.walk.hz ?? 0 } : null, walkDb: 0, walkHz: 0, sources }
  }

  private buildTone(layer: Extract<BedLayer, { kind: 'tone' }>, out: AudioNode, bedId: string): LiveTone {
    const ctx = this.ctx
    const gain = makeGain(ctx, dbToGain(this.levelOf(layer.levelDb, bedId)))
    const lp = makeFilter(ctx, 'lowpass', layer.lowpassHz ?? 4000, 0.5)
    lp.connect(gain)
    gain.connect(out)
    const sources: AudioScheduledSourceNode[] = []
    layer.hz.forEach((hz, i) => {
      const osc = makeOscillator(ctx, 'sine', hz + (layer.beatHz && i % 2 ? layer.beatHz : 0))
      const g = makeGain(ctx, 1 / layer.hz.length)
      osc.connect(g)
      g.connect(lp)
      osc.start()
      sources.push(osc)
    })
    return { kind: 'tone', id: layer.id, gain, sources }
  }

  private build(key: string, bedId: string, layers: readonly BedLayer[]): BedInstance {
    const ctx = this.ctx
    const out = makeGain(ctx, 0)
    out.connect(this.dest)
    const send = makeGain(ctx, 0.25)
    out.connect(send)
    send.connect(this.reverbSend)
    const live: Live[] = layers.map((layer) => {
      if (layer.kind === 'noise') return this.buildNoise(layer, out, bedId)
      if (layer.kind === 'tone') return this.buildTone(layer, out, bedId)
      const gain = makeGain(ctx, dbToGain(this.levelOf(layer.levelDb, bedId)))
      gain.connect(out)
      return { kind: 'spawn', id: layer.id, gain, layer }
    })
    return {
      key,
      out,
      layers: live,
      stop: (at, fadeSec) => {
        rampTo(out.gain, 0, at, fadeSec)
        const end = at + fadeSec + 0.1
        for (const l of live) {
          if (l.kind === 'spawn') continue
          for (const s of l.sources) {
            try {
              s.stop(end)
            } catch {
              /* already stopped */
            }
          }
        }
        setTimeoutSafe(() => {
          try {
            out.disconnect()
            send.disconnect()
          } catch {
            /* fine */
          }
        }, (fadeSec + 0.3) * 1000)
      },
    }
  }

  /** Crossfades to a bed (null = silence) over `fadeSec`, with extra layers (a rest room's campfire). */
  setBed(id: BedId | null, fadeSec: number = TUNING.bedCrossfadeSec, extra: readonly BedLayer[] = [], extraKey = ''): void {
    const key = id ? `${id}${extraKey ? `+${extraKey}` : ''}` : null
    if (key === this.bedKey) return
    const now = this.ctx.currentTime
    if (this.current) {
      this.current.stop(now, fadeSec)
      this.current = null
    }
    this.bedId = id
    this.bedKey = key
    if (!id || !key) return
    const inst = this.build(key, id, [...bedLayers(id), ...extra])
    this.current = inst
    rampTo(inst.out.gain, dbToGain(TUNING.ambienceMakeupDb), now, fadeSec)
  }

  /** The tick: random walks every 250 ms and Poisson spawns. Called from the scheduler's filler with the horizon. */
  tick(now: number, until: number): void {
    const bed = this.current
    if (!bed) return
    if (now >= this.nextWalk) {
      this.nextWalk = now + WALK_SEC
      for (const l of bed.layers) {
        if (l.kind !== 'noise' || !l.walk) continue
        l.walkDb = Math.max(-l.walk.db, Math.min(l.walk.db, l.walkDb + (this.rng() - 0.5) * l.walk.db))
        l.gain.gain.setTargetAtTime(dbToGain(this.levelOf(l.baseDb, this.bedId ?? '') + l.makeupDb + l.walkDb), now, WALK_SEC)
        if (l.firstFilter && l.walk.hz) {
          l.walkHz = Math.max(-l.walk.hz, Math.min(l.walk.hz, l.walkHz + (this.rng() - 0.5) * l.walk.hz))
          l.firstFilter.frequency.setTargetAtTime(Math.max(30, l.baseHz + l.walkHz), now, WALK_SEC)
        }
      }
    }
    const dt = Math.max(0, until - now)
    for (const l of bed.layers) {
      if (l.kind !== 'spawn' || l.layer.rate <= 0) continue
      // Poisson in the window, at most one phrase per tick (the window is ~0.4 s and the scheduler ticks every 25 ms).
      if (this.rng() < l.layer.rate * dt * 0.0625) this.spawnPhrase(l, now + this.rng() * dt)
    }
  }

  private spawnPhrase(l: LiveSpawn, at: number): void {
    const b = l.layer.burst
    const count = b ? Math.round(between(this.rng, b.count[0], b.count[1])) : 1
    let t = at
    for (let i = 0; i < count; i++) {
      this.spawnOne(l, t)
      if (b) t += between(this.rng, b.gapMs[0], b.gapMs[1]) / 1000
    }
  }

  private panOf(l: SpawnLayer): number {
    if (typeof l.pan === 'number') return l.pan
    if (l.pan === 'wide') return between(this.rng, -0.8, 0.8)
    if (l.pan === 'random') return between(this.rng, -0.5, 0.5)
    return 0
  }

  private spawnOne(l: LiveSpawn, at: number): void {
    if (this.pool.count(at) >= this.pool.limit) this.pool.makeRoom(at)
    const e: SpawnEvent = l.layer.event
    const pan = this.panOf(l.layer)
    const db = l.layer.levelJitterDb ? between(this.rng, -l.layer.levelJitterDb, l.layer.levelJitterDb) : 0
    const ratio = Math.pow(2, (l.layer.pitchCents ? between(this.rng, -l.layer.pitchCents, l.layer.pitchCents) : 0) / 1200)
    const lowpass = l.layer.lowpassHz
    const target = l.gain
    switch (e.kind) {
      case 'chirp': {
        const hz = between(this.rng, e.hz[0], e.hz[1]) * ratio
        this.tone(at, hz, hz * (1 + (e.sweep ?? 0) * (this.rng() - 0.5)), between(this.rng, e.ms[0], e.ms[1]) / 1000, db, pan, target, lowpass, e.fm)
        break
      }
      case 'click':
        this.burst(at, 'white', { type: 'bandpass', hz: 2500, q: 2 }, (e.ms ?? 4) / 1000, db, pan, lowpass, target)
        break
      case 'drip':
      case 'bubble':
        this.tone(at, e.from * ratio, e.to * ratio, e.ms / 1000, db, pan, target, lowpass)
        break
      case 'crackle':
        this.burst(at, 'white', { type: 'highpass', hz: 1200, q: 0.7 }, between(this.rng, e.ms[0], e.ms[1]) / 1000, db, pan, lowpass ?? 4000, target)
        break
      case 'noiseBurst':
        this.burst(at, e.color, e.filter ?? null, between(this.rng, e.ms[0], e.ms[1]) / 1000, db, pan, e.lowpassHz ?? lowpass, target)
        break
      case 'rumble':
        this.burst(at, 'brown', { type: 'lowpass', hz: 220, q: 0.6 }, between(this.rng, e.seconds[0], e.seconds[1]), db, pan, undefined, target, 60)
        break
      case 'crickets':
        for (let p = 0; p < e.pulses; p++) this.tone(at + p / e.pulseHz, e.hz * ratio, e.hz, 0.5 / e.pulseHz, db, pan, target, lowpass ?? 6000)
        break
      case 'murmur': {
        // Distant voices: a few syllable swells of band-passed noise.
        const seconds = between(this.rng, e.seconds[0], e.seconds[1])
        const syllables = Math.max(2, Math.round(seconds * 5))
        for (let i = 0; i < syllables; i++) {
          const t = at + (i / syllables) * seconds + between(this.rng, 0, 0.04)
          this.burst(t, 'pink', { type: 'bandpass', hz: e.hz * between(this.rng, 0.8, 1.25), q: 1.6 }, between(this.rng, 0.08, 0.18), db - 3 * (i / syllables), pan, lowpass ?? 1500, target)
        }
        break
      }
      case 'anvil': {
        const hz = between(this.rng, e.hz[0], e.hz[1])
        for (const [r, a, d] of [
          [1, 0, 0.7],
          [2.76, -7, 0.35],
          [4.07, -11, 0.22],
        ] as const)
          this.tone(at, hz * r, hz * r, d, db + a, pan, target, lowpass)
        this.burst(at, 'white', { type: 'highpass', hz: 3000, q: 0.7 }, 0.008, db - 4, pan, lowpass, target)
        break
      }
      case 'sample': {
        const pick = e.midi !== undefined ? this.bank.pick(e.inst, e.art, e.midi) : this.bank.take(e.inst, e.art)
        if (!pick) return
        this.playSampleAt(pick.buffer, pick.rate * ratio, at, db + foleyTrimDb(e.inst, e.art), pan, target, lowpass)
        break
      }
    }
  }

  private tone(at: number, fromHz: number, toHz: number, seconds: number, db: number, pan: number, out: AudioNode, lowpassHz?: number, fmHz?: number): void {
    const ctx = this.ctx
    const osc = makeOscillator(ctx, 'sine', fromHz)
    if (toHz !== fromHz) osc.frequency.exponentialRampToValueAtTime(Math.max(20, toHz), at + seconds)
    const g = makeGain(ctx, 0)
    let node: AudioNode = osc
    const extra: AudioScheduledSourceNode[] = []
    if (fmHz) {
      const mod = makeOscillator(ctx, 'sine', fmHz)
      const depth = makeGain(ctx, fromHz * 0.02)
      mod.connect(depth)
      depth.connect(osc.frequency)
      mod.start(at)
      mod.stop(at + seconds + 0.05)
      extra.push(mod)
    }
    if (lowpassHz) {
      const lp = makeFilter(ctx, 'lowpass', lowpassHz, 0.5)
      node.connect(lp)
      node = lp
    }
    node.connect(g)
    this.connectPanned(g, pan, out)
    const a = Math.min(0.01, seconds * 0.3)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.linearRampToValueAtTime(dbToGain(db), at + a)
    g.gain.exponentialRampToValueAtTime(0.0001, at + seconds)
    osc.start(at)
    osc.stop(at + seconds + 0.02)
    this.track(g, at + seconds, osc)
  }

  private burst(at: number, color: NoiseColor, filter: FilterSpec | null, seconds: number, db: number, pan: number, lowpassHz: number | undefined, out: AudioNode, sweepTo?: number): void {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = noiseLoop(ctx, color)
    src.loop = true
    let node: AudioNode = src
    const colour = colourChain(ctx, color)
    if (colour) {
      node.connect(colour.input)
      node = colour.output
    }
    let makeupDb = WHITE_RMS_MAKEUP_DB
    if (filter) {
      const f = makeFilter(ctx, filter.type, filter.hz, filter.q ?? 0.707)
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + seconds)
      node.connect(f)
      node = f
      makeupDb += filterMakeupDb(filter)
    }
    if (lowpassHz) {
      const lp = makeFilter(ctx, 'lowpass', lowpassHz, 0.5)
      node.connect(lp)
      node = lp
    }
    const g = makeGain(ctx, 0)
    node.connect(g)
    this.connectPanned(g, pan, out)
    const a = Math.min(0.02, seconds * 0.25)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.linearRampToValueAtTime(dbToGain(db + makeupDb), at + a)
    g.gain.exponentialRampToValueAtTime(0.0001, at + seconds)
    src.start(at, between(this.rng, 0, LOOP_SEC))
    src.stop(at + seconds + 0.02)
    this.track(g, at + seconds, src)
  }

  private playSampleAt(buffer: AudioBuffer, rate: number, at: number, db: number, pan: number, out: AudioNode, lowpassHz?: number): void {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.playbackRate.value = rate
    let node: AudioNode = src
    if (lowpassHz) {
      const lp = makeFilter(ctx, 'lowpass', lowpassHz, 0.5)
      node.connect(lp)
      node = lp
    }
    const g = makeGain(ctx, dbToGain(db))
    node.connect(g)
    this.connectPanned(g, pan, out)
    src.start(at)
    this.track(g, at + buffer.duration / rate, src)
  }

  private connectPanned(node: AudioNode, pan: number, out: AudioNode): void {
    if (Math.abs(pan) > 0.01 && typeof StereoPannerNode !== 'undefined') {
      const p = this.ctx.createStereoPanner()
      p.pan.value = Math.max(-1, Math.min(1, pan))
      node.connect(p)
      p.connect(out)
    } else node.connect(out)
  }

  private track(g: GainNode, endsAt: number, src: AudioScheduledSourceNode): void {
    const voice: Voice = {
      endsAt,
      out: g,
      source: null,
      rate: null,
      stopped: false,
      stop: (at, rel = 0.02) => {
        voice.stopped = true
        rampTo(g.gain, 0, at, rel)
        try {
          src.stop(at + rel + 0.02)
        } catch {
          /* fine */
        }
      },
    }
    this.pool.add({ voice, startedAt: this.ctx.currentTime, level: 0.3, silentLayer: false, owner: 'ambience' })
    src.onended = () => {
      try {
        g.disconnect()
      } catch {
        /* fine */
      }
    }
  }

  stopAll(fadeSec = 0.3): void {
    this.current?.stop(this.ctx.currentTime, fadeSec)
    this.current = null
    this.bedId = null
    this.bedKey = null
    this.pool.stopAll(this.ctx.currentTime)
  }

  voices(): number {
    return this.pool.count(this.ctx.currentTime)
  }
}

/** setTimeout when there is one (an OfflineAudioContext in a test has no need to clean up). */
function setTimeoutSafe(fn: () => void, ms: number): void {
  if (typeof setTimeout === 'function') setTimeout(fn, ms)
}
