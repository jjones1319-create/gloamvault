/**
 * Voices made in code (ported from Wildsong Ranch's engine/synth.ts and extended for Gloamvault). All band-limited —
 * sines, triangles and PeriodicWaves of at most 8 harmonics, filtered noise — and every stop is a ramp.
 *
 * Wildsong's four fallbacks play while samples load or if they fail: wind (a sine with its 2nd harmonic at −30 dB, a
 * breath puff, a delayed vibrato), pad (three detuned triangles into a 1.2 kHz lowpass), pluck (Karplus-Strong,
 * rendered once per pitch) and mallet (four modal partials). Gloamvault's own instruments (07 §2.2's briefs):
 * - voice: the wordless choir — a soft 8-harmonic wave through two vowel formants, a delayed vibrato and a breath;
 * - brass: the Company's cracked trumpet — a brassy 8-harmonic wave whose filter opens on the attack, a lip scoop, and
 *   on `!crack!` a sharp break with a spit of noise;
 * - waterphone: three inharmonic partials that drift in pitch, a tremolo and a bowed-noise edge;
 * - snare (hit and roll), rattle (the bone rattle: a cluster of tiny clicks), anvil (the forge's ringing ping).
 */
import { INSTRUMENTS, type FallbackVoice } from '../recipes/instruments.ts'
import { dbToGain, makeFilter, makeGain, makeOscillator, makePeriodicWave } from './nodes.ts'
import { createRng } from './rng.ts'
import { ornamentBend, velocityDb, type NoteParams, type Voice } from './sampler.ts'

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

const waves = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>()
const noises = new WeakMap<BaseAudioContext, AudioBuffer>()
const pluckCache = new Map<string, AudioBuffer>()

function wave(ctx: BaseAudioContext, name: string, harmonics: readonly number[]): PeriodicWave {
  let m = waves.get(ctx)
  if (!m) {
    m = new Map()
    waves.set(ctx, m)
  }
  let w = m.get(name)
  if (!w) {
    w = makePeriodicWave(ctx, harmonics)
    m.set(name, w)
  }
  return w
}

/** Half a second of seeded white noise, one per context. */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const have = noises.get(ctx)
  if (have) return have
  const n = Math.round(ctx.sampleRate * 0.5)
  const b = ctx.createBuffer(1, n, ctx.sampleRate)
  const d = b.getChannelData(0)
  const rng = createRng(0xb4ea7)
  for (let i = 0; i < n; i++) d[i] = rng() * 2 - 1
  noises.set(ctx, b)
  return b
}

/** Karplus-Strong string, rendered once per pitch and sample rate. */
function pluckBuffer(ctx: BaseAudioContext, midi: number): AudioBuffer {
  const key = `${ctx.sampleRate}:${midi}`
  const cached = pluckCache.get(key)
  if (cached) return cached
  const sr = ctx.sampleRate
  const period = Math.max(2, Math.round(sr / midiToHz(midi)))
  const n = Math.round(sr * 2)
  const buffer = ctx.createBuffer(1, n, sr)
  const out = buffer.getChannelData(0)
  const line = new Float32Array(period)
  const rng = createRng(1000 + midi)
  for (let i = 0; i < period; i++) line[i] = rng() * 2 - 1
  const decay = 0.994 + Math.min(0.0055, midi / 20000)
  let idx = 0
  let prev = 0
  for (let i = 0; i < n; i++) {
    const v = decay * 0.5 * (line[idx]! + line[(idx + 1) % period]!)
    out[i] = 0.5 * (v + prev)
    prev = v
    line[idx] = v
    idx = (idx + 1) % period
  }
  const fade = Math.round(sr * 0.05)
  for (let i = 0; i < fade; i++) out[n - fade + i] = out[n - fade + i]! * (1 - i / fade)
  pluckCache.set(key, buffer)
  return buffer
}

/** A looping noise source from the shared buffer. */
function noiseSource(ctx: BaseAudioContext): AudioBufferSourceNode {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx)
  src.loop = true
  return src
}

/** A delayed vibrato on a detune param: ±`cents` at `hz`, reaching full depth `delay` seconds after `t0`. */
function vibrato(ctx: BaseAudioContext, param: AudioParam, t0: number, hz: number, cents: number, delay: number, sources: AudioScheduledSourceNode[]): void {
  const lfo = makeOscillator(ctx, 'sine', hz)
  const depth = makeGain(ctx, 0)
  lfo.connect(depth)
  depth.connect(param)
  depth.gain.setValueAtTime(0, t0)
  depth.gain.linearRampToValueAtTime(cents, t0 + delay)
  sources.push(lfo)
}

/** Plays one code-made note; null for the silent family. */
export function playSynth(ctx: BaseAudioContext, dest: AudioNode, kind: FallbackVoice, p: NoteParams): Voice | null {
  if (kind === 'silent') return null
  const def = INSTRUMENTS[p.inst]
  const now = ctx.currentTime
  const t0 = Math.max(now, p.time)
  const hz = midiToHz(p.midi) * (p.rateScale ?? 1)
  const gain = dbToGain(velocityDb(p.vel) + (p.gainDb ?? 0) - 6)
  const env = makeGain(ctx, 0)
  let out: AudioNode = env
  if (p.pan && Math.abs(p.pan) > 0.01 && typeof StereoPannerNode !== 'undefined') {
    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, p.pan))
    env.connect(panner)
    out = panner
  }
  out.connect(dest)
  const sources: AudioScheduledSourceNode[] = []
  /** Sources a case started on its own schedule (the rattle's clicks). */
  const started: AudioScheduledSourceNode[] = []
  const noteEnd = p.time + p.dur
  let endsAt = noteEnd
  const attack = Math.max(0.003, def.attackMs / 1000)
  const release = Math.max(0.03, def.releaseMs / 1000)
  const sustain = (level: number, a = attack, r = release) => {
    env.gain.setValueAtTime(0.0001, t0)
    env.gain.linearRampToValueAtTime(level, t0 + a)
    env.gain.setValueAtTime(level, Math.max(t0 + a, noteEnd))
    endsAt = Math.max(t0 + a, noteEnd) + r
    env.gain.exponentialRampToValueAtTime(0.0001, endsAt)
  }
  const strike = (level: number, decay: number) => {
    env.gain.setValueAtTime(0.0001, t0)
    env.gain.linearRampToValueAtTime(level, t0 + 0.002)
    endsAt = t0 + decay
    env.gain.exponentialRampToValueAtTime(0.0001, endsAt)
  }

  switch (kind) {
    case 'wind': {
      const osc = makeOscillator(ctx, 'custom', hz, wave(ctx, 'wind', [1, dbToGain(-30)]))
      const dark = makeFilter(ctx, 'lowpass', Math.min(12000, Math.max(1200, hz * 6)), 0.5)
      osc.connect(dark)
      dark.connect(env)
      sources.push(osc)
      vibrato(ctx, osc.detune, t0, 5, 12, 0.6, sources)
      if (p.phraseStart) {
        osc.detune.setValueAtTime(-30, t0)
        osc.detune.linearRampToValueAtTime(0, t0 + 0.06)
      }
      const puff = noiseSource(ctx)
      const bp = makeFilter(ctx, 'bandpass', 1500, 1.2)
      const puffGain = makeGain(ctx, 0)
      puff.connect(bp)
      bp.connect(puffGain)
      puffGain.connect(dest)
      puffGain.gain.setValueAtTime(0, t0)
      puffGain.gain.linearRampToValueAtTime(gain * 0.25, t0 + 0.015)
      puffGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06)
      puff.start(t0)
      puff.stop(t0 + 0.08)
      sustain(gain)
      break
    }
    case 'pad': {
      const lp = makeFilter(ctx, 'lowpass', 1200, 0.7)
      lp.connect(env)
      for (const cents of [-7, 0, 7]) {
        const osc = makeOscillator(ctx, 'triangle', hz)
        osc.detune.value = cents
        osc.connect(lp)
        sources.push(osc)
      }
      sustain(gain * 0.5, Math.max(attack, 0.3), Math.max(release, 0.4))
      break
    }
    case 'pluck': {
      const src = ctx.createBufferSource()
      src.buffer = pluckBuffer(ctx, p.midi)
      src.playbackRate.value = p.rateScale ?? 1
      src.connect(env)
      sources.push(src)
      env.gain.setValueAtTime(gain, t0)
      endsAt = Math.min(t0 + 2, noteEnd + release)
      env.gain.setValueAtTime(gain, Math.max(t0, Math.min(noteEnd, endsAt - 0.03)))
      env.gain.exponentialRampToValueAtTime(0.0001, endsAt)
      break
    }
    case 'mallet': {
      for (const [ratio, amp, decay] of [
        [1, 1, 1.2],
        [3.0, 0.4, 0.5],
        [5.9, 0.2, 0.25],
        [8.9, 0.1, 0.12],
      ] as const) {
        if (hz * ratio > ctx.sampleRate * 0.45) continue
        const osc = makeOscillator(ctx, 'sine', hz * ratio)
        const g = makeGain(ctx, 0)
        osc.connect(g)
        g.connect(env)
        g.gain.setValueAtTime(0.0001, t0)
        g.gain.linearRampToValueAtTime(amp, t0 + 0.003)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay * 1.5)
        sources.push(osc)
      }
      env.gain.setValueAtTime(gain, t0)
      endsAt = Math.min(t0 + 1.8, noteEnd + release)
      env.gain.setValueAtTime(gain, Math.max(t0, endsAt - release))
      env.gain.exponentialRampToValueAtTime(0.0001, endsAt)
      break
    }
    case 'voice': {
      // Two vowel formants that open a little with the velocity: "oo" when soft, towards "ah" when loud.
      const v = Math.max(0, Math.min(1, p.vel))
      const f1 = makeFilter(ctx, 'bandpass', 380 + 260 * v, 2.6)
      const f2 = makeFilter(ctx, 'bandpass', 880 + 240 * v, 3.2)
      const f2g = makeGain(ctx, 0.55)
      const top = makeFilter(ctx, 'lowpass', 2600, 0.6)
      f1.connect(top)
      f2.connect(f2g)
      f2g.connect(top)
      top.connect(env)
      const w = wave(ctx, 'voice', [1, 0.55, 0.38, 0.28, 0.2, 0.15, 0.11, 0.08])
      for (const cents of [-6, 6]) {
        const osc = makeOscillator(ctx, 'custom', hz, w)
        osc.detune.value = cents
        osc.connect(f1)
        osc.connect(f2)
        vibrato(ctx, osc.detune, t0, 5.2, 9, 0.7, sources)
        sources.push(osc)
      }
      const breath = noiseSource(ctx)
      const bg = makeGain(ctx, 0.05)
      breath.connect(bg)
      bg.connect(f2)
      sources.push(breath)
      sustain(gain * 3.2)
      break
    }
    case 'brass': {
      const lp = makeFilter(ctx, 'lowpass', hz * 2, 0.9)
      lp.connect(env)
      const osc = makeOscillator(ctx, 'custom', hz, wave(ctx, 'brass', [1, 0.8, 0.62, 0.48, 0.36, 0.26, 0.18, 0.12]))
      osc.connect(lp)
      sources.push(osc)
      // The filter opens on the attack (the "blat") to a brightness set by the velocity.
      const open = Math.min(9000, hz * (3 + 5 * Math.max(0, Math.min(1, p.vel))))
      lp.frequency.setValueAtTime(hz * 1.5, t0)
      lp.frequency.exponentialRampToValueAtTime(open, t0 + 0.04)
      lp.frequency.setTargetAtTime(open * 0.75, t0 + 0.05, 0.12)
      vibrato(ctx, osc.detune, t0, 5.5, 8, 0.35, sources)
      const bend = ornamentBend(p.orn) ?? (p.phraseStart ? { cents: -50, sec: 0.05 } : null)
      if (bend) {
        osc.detune.setValueAtTime(bend.cents, t0)
        osc.detune.linearRampToValueAtTime(0, t0 + bend.sec)
      }
      if (p.orn === 'crack') {
        const spit = noiseSource(ctx)
        const bp = makeFilter(ctx, 'bandpass', 2600, 1.4)
        const sg = makeGain(ctx, 0)
        spit.connect(bp)
        bp.connect(sg)
        sg.connect(out)
        sg.gain.setValueAtTime(0, t0)
        sg.gain.linearRampToValueAtTime(gain * 0.5, t0 + 0.006)
        sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035)
        spit.start(t0)
        spit.stop(t0 + 0.05)
      }
      // A little overshoot on the attack, then the held level.
      env.gain.setValueAtTime(0.0001, t0)
      env.gain.linearRampToValueAtTime(gain * 1.25, t0 + attack)
      env.gain.linearRampToValueAtTime(gain, t0 + attack + 0.06)
      env.gain.setValueAtTime(gain, Math.max(t0 + attack + 0.06, noteEnd))
      endsAt = Math.max(t0 + attack + 0.06, noteEnd) + release
      env.gain.exponentialRampToValueAtTime(0.0001, endsAt)
      break
    }
    case 'waterphone': {
      // Bowed rods: inharmonic partials that drift apart, a slow tremolo and a breath of bowed noise.
      const rng = createRng((Math.floor(p.time * 997) ^ (p.midi * 7919)) >>> 0)
      const trem = makeGain(ctx, 0.75)
      trem.connect(env)
      const lfo = makeOscillator(ctx, 'sine', 3.5 + 3 * rng())
      const depth = makeGain(ctx, 0.25)
      lfo.connect(depth)
      depth.connect(trem.gain)
      sources.push(lfo)
      const span = Math.max(0.5, noteEnd - t0 + release)
      for (const [ratio, amp] of [
        [1, 1],
        [2.76, 0.32],
        [5.4, 0.12],
      ] as const) {
        if (hz * ratio > ctx.sampleRate * 0.45) continue
        const osc = makeOscillator(ctx, 'sine', hz * ratio)
        const g = makeGain(ctx, amp)
        osc.connect(g)
        g.connect(trem)
        osc.detune.setValueAtTime(0, t0)
        osc.detune.linearRampToValueAtTime((rng() < 0.5 ? -1 : 1) * (40 + 90 * rng()), t0 + span)
        sources.push(osc)
      }
      const bow = noiseSource(ctx)
      const bp = makeFilter(ctx, 'bandpass', hz, 18)
      const bg = makeGain(ctx, 0.6)
      bow.connect(bp)
      bp.connect(bg)
      bg.connect(trem)
      sources.push(bow)
      sustain(gain * 0.7)
      break
    }
    case 'snare': {
      const v = Math.max(0.05, Math.min(1, p.vel))
      const noise = noiseSource(ctx)
      const hp = makeFilter(ctx, 'highpass', 900, 0.7)
      const bp = makeFilter(ctx, 'bandpass', 3200, 0.8)
      const ng = makeGain(ctx, 1)
      noise.connect(hp)
      hp.connect(bp)
      bp.connect(ng)
      ng.connect(env)
      sources.push(noise)
      if (p.art === 'roll') {
        // A buzz roll: noise pulsed at ~24 Hz, swelling over the note, then a short tail.
        const am = makeGain(ctx, 0.5)
        ng.disconnect()
        ng.connect(am)
        am.connect(env)
        const lfo = makeOscillator(ctx, 'sine', 24)
        const depth = makeGain(ctx, 0.45)
        lfo.connect(depth)
        depth.connect(am.gain)
        sources.push(lfo)
        const len = Math.max(0.15, p.dur)
        env.gain.setValueAtTime(0.0001, t0)
        env.gain.linearRampToValueAtTime(gain * 0.9 * v, t0 + 0.02)
        env.gain.linearRampToValueAtTime(gain * 2.2 * v, t0 + len)
        endsAt = t0 + len + 0.09
        env.gain.exponentialRampToValueAtTime(0.0001, endsAt)
      } else {
        const body = makeOscillator(ctx, 'triangle', 205)
        body.frequency.exponentialRampToValueAtTime(150, t0 + 0.06)
        const bgain = makeGain(ctx, 0)
        body.connect(bgain)
        bgain.connect(env)
        bgain.gain.setValueAtTime(0.0001, t0)
        bgain.gain.linearRampToValueAtTime(0.9, t0 + 0.002)
        bgain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08)
        sources.push(body)
        strike(gain * 2.2 * v, 0.16)
      }
      break
    }
    case 'rattle': {
      // The bone rattle: three to five dry clicks, a few hundredths of a second apart.
      const rng = createRng((Math.floor(p.time * 1009) ^ 0x7a771e) >>> 0)
      const count = 3 + Math.floor(rng() * 3)
      let t = t0
      for (let i = 0; i < count; i++) {
        const src = noiseSource(ctx)
        const bp = makeFilter(ctx, 'bandpass', 2000 + 1500 * rng(), 3)
        const g = makeGain(ctx, 0)
        src.connect(bp)
        bp.connect(g)
        g.connect(env)
        const level = (1 - i / (count + 1)) * 2.5
        g.gain.setValueAtTime(0.0001, t)
        g.gain.linearRampToValueAtTime(level, t + 0.001)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.012)
        src.start(t)
        src.stop(t + 0.02)
        started.push(src)
        t += 0.014 + 0.016 * rng()
      }
      env.gain.setValueAtTime(gain, t0)
      endsAt = t + 0.03
      env.gain.setValueAtTime(gain, endsAt - 0.01)
      env.gain.linearRampToValueAtTime(0.0001, endsAt)
      break
    }
    case 'anvil': {
      // A struck block of steel: inharmonic partials with the fundamental ringing longest, and a click.
      const base = 1180 * Math.pow(2, (p.midi - 60) / 12)
      for (const [ratio, amp, decay] of [
        [1, 1, 0.9],
        [2.76, 0.45, 0.42],
        [4.07, 0.28, 0.26],
        [5.43, 0.18, 0.16],
      ] as const) {
        if (base * ratio > ctx.sampleRate * 0.45) continue
        const osc = makeOscillator(ctx, 'sine', base * ratio)
        const g = makeGain(ctx, 0)
        osc.connect(g)
        g.connect(env)
        g.gain.setValueAtTime(0.0001, t0)
        g.gain.linearRampToValueAtTime(amp, t0 + 0.002)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay)
        sources.push(osc)
      }
      const click = noiseSource(ctx)
      const hp = makeFilter(ctx, 'highpass', 3000, 0.7)
      const cg = makeGain(ctx, 0)
      click.connect(hp)
      hp.connect(cg)
      cg.connect(env)
      cg.gain.setValueAtTime(0.0001, t0)
      cg.gain.linearRampToValueAtTime(0.6, t0 + 0.001)
      cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.008)
      sources.push(click)
      env.gain.setValueAtTime(gain, t0)
      endsAt = t0 + 0.95
      env.gain.setValueAtTime(gain, endsAt - 0.05)
      env.gain.linearRampToValueAtTime(0.0001, endsAt)
      break
    }
  }
  for (const s of sources) {
    s.start(t0)
    s.stop(endsAt + 0.05)
  }
  const all = [...sources, ...started]
  const voice: Voice = {
    endsAt,
    out,
    source: null,
    rate: null,
    stopped: false,
    stop(at, rel = 0.02) {
      if (voice.stopped) return
      voice.stopped = true
      const t = Math.max(ctx.currentTime, at)
      env.gain.cancelScheduledValues(t)
      env.gain.setValueAtTime(Math.max(0.0001, env.gain.value), t)
      env.gain.exponentialRampToValueAtTime(0.0001, t + rel)
      for (const s of all) {
        try {
          s.stop(t + rel + 0.02)
        } catch {
          /* already stopped */
        }
      }
      voice.endsAt = t + rel
    },
  }
  const last = all[all.length - 1]
  if (last) {
    last.onended = () => {
      try {
        env.disconnect()
        if (out !== env) out.disconnect()
      } catch {
        /* fine */
      }
    }
  }
  return voice
}
