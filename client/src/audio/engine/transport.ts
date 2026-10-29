/**
 * The music player (ported from Wildsong Ranch's engine/transport.ts, SOUND_UPGRADE §4.4, §6.5–6.6, §4.7 there). One
 * transport per song; every part of the playing song is scheduled bar by bar ahead of the look-ahead (parts in silent
 * layers at zero gain, so a layer fades in at any bar with its held notes already sounding); stems and layers change at
 * the next bar; loops from `loopFrom`; crossfades between songs; interrupting stingers fade the area music out over
 * 150 ms and bring it back at its next section; and the performance: humanising, swing, phrase shaping, vibrato by
 * note length, scoops, mono crossfades, rolled chords.
 *
 * Gloamvault's changes: percussion lines sound (each step plays its drum — the port fills the pitch the step strings
 * leave empty), code-made percussion (snare, rattle, anvil) plays through the synth, a line may carry a lowpass, the
 * ABC ornaments reach the voices, swing works in 3/4, and a stinger chain can hand over to a different piece when the
 * place changed while it played (a won fight's victory stinger ends on the zone's exploring music, not the fight's).
 */
import TUNING from '../tuning.json'
import { articulationOf, INSTRUMENTS, type InstrumentId } from '../recipes/instruments.ts'
import { beatsPerBar, type Mode } from '../music/abc.ts'
import { foldedPitches, instrumentFor, lineFoldShift, loopFromOf, orderOf, sounding, type Arrangement, type LineEvent, type Song } from '../music/song.ts'
import type { Graph } from './context.ts'
import { dbToGain, makeFilter, makeGain, rampTo } from './nodes.ts'
import { between, jitter, type Rng } from './rng.ts'
import type { SampleBank } from './samples.ts'
import { playSample, type NoteParams, type Voice } from './sampler.ts'
import { beatToTime, type Scheduler, type Transport } from './scheduler.ts'
import { playSynth } from './synth.ts'
import { VoicePool } from './voices.ts'

export interface KeyContext {
  /** Tonic pitch class 0–11. */
  tonic: number
  mode: Mode
}

export interface PlayOptions {
  arrangement?: Arrangement | null
  layers?: Iterable<string>
  stem?: string | null
  fadeInSec?: number
  fadeOutSec?: number
  /** Start at this order index (default 0). */
  startIndex?: number
  /** Semitones (stingers are written in C and transposed to the area key). */
  transpose?: number
  /** Loop (songs) or play once (stingers). */
  once?: boolean
  onEnd?: () => void
}

export interface LineState {
  gain: GainNode
  sounding: GainNode
  filter: BiquadFilterNode | null
  on: boolean
}

export interface Playback {
  song: Song
  arrangement: Arrangement | null
  transport: Transport
  tag: string
  out: GainNode
  send: GainNode
  lines: Map<string, LineState>
  layers: Set<string>
  stem: string | null
  sectionStartBeat: number
  orderIndex: number
  /** Bars scheduled so far in the current section. */
  bar: number
  once: boolean
  ended: boolean
  stopping: boolean
  transpose: number
  mono: Map<string, Voice>
  folds: Map<string, number>
  onEnd?: () => void
}

export interface ChainOptions {
  transpose?: number
  fadeInAfterSec?: number
  gainDb?: number
  /** Asked when the chain ends: false leaves the interrupted area music down (the caller starts something else). */
  beforeResume?: () => boolean
  onDone?: () => void
}

export class MusicPlayer {
  readonly ctx: BaseAudioContext
  readonly graph: Graph
  readonly bank: SampleBank
  readonly scheduler: Scheduler
  readonly rng: Rng
  readonly pool = new VoicePool('music', 32)
  current: Playback | null = null
  /** The area song interrupted by a stinger, to be restarted at its next section. */
  interrupted: { playback: Playback; nextIndex: number } | null = null
  private counter = 0
  /** Per-song trims from calibration (dB). */
  trims: Record<string, number> = {}

  constructor(ctx: BaseAudioContext, graph: Graph, bank: SampleBank, scheduler: Scheduler, rng: Rng) {
    this.ctx = ctx
    this.graph = graph
    this.bank = bank
    this.scheduler = scheduler
    this.rng = rng
    scheduler.addFiller((until) => this.fill(until))
  }

  /** The key the playing song is in (for musical effects), with its transposition. */
  key(): KeyContext | null {
    const p = this.current && !this.current.once ? this.current : (this.interrupted?.playback ?? this.current)
    if (!p) return null
    return { tonic: (((p.song.tune.key.tonic + p.transpose) % 12) + 12) % 12, mode: p.song.tune.key.mode }
  }

  /** True while an interrupting stinger holds the music (a once-only piece is `stopping` as soon as its last bar is scheduled). */
  stingerPlaying(): boolean {
    return this.current !== null && this.current.once && !this.current.ended
  }

  play(song: Song, o: PlayOptions = {}): Playback {
    const now = this.ctx.currentTime
    const fadeIn = o.fadeInSec ?? TUNING.crossfadeSec
    const fadeOut = o.fadeOutSec ?? TUNING.crossfadeSec
    if (this.current && !this.current.stopping) this.stopPlayback(this.current, now, fadeOut)
    const arrangement = o.arrangement ?? null
    const bpm = song.bpm + (arrangement?.tempoNudge ?? 0)
    const startTime = now + 0.05
    const transport: Transport = { startTime, bpm, beatsPerBar: beatsPerBar(song.meter) }
    const tag = `song-${++this.counter}`
    const out = makeGain(this.ctx, 0)
    const send = makeGain(this.ctx, (arrangement?.musicSend ?? song.musicSend) * 0.8)
    out.connect(this.graph.music)
    out.connect(send)
    send.connect(this.graph.reverbMusic.input)
    const lines = new Map<string, LineState>()
    for (const line of song.lines) {
      const gain = makeGain(this.ctx, dbToGain(line.gain))
      const s = makeGain(this.ctx, 0)
      let filter: BiquadFilterNode | null = null
      if (line.lowpassHz) {
        filter = makeFilter(this.ctx, 'lowpass', line.lowpassHz, 0.6)
        gain.connect(filter)
        filter.connect(s)
      } else gain.connect(s)
      s.connect(out)
      lines.set(line.id, { gain, sounding: s, filter, on: false })
    }
    const playback: Playback = {
      song,
      arrangement,
      transport,
      tag,
      out,
      send,
      lines,
      layers: new Set(o.layers ?? ['main']),
      stem: o.stem ?? null,
      sectionStartBeat: 0,
      orderIndex: o.startIndex ?? 0,
      bar: 0,
      once: o.once ?? false,
      ended: false,
      stopping: false,
      transpose: o.transpose ?? 0,
      mono: new Map(),
      folds: new Map(),
      onEnd: o.onEnd,
    }
    this.applySounding(playback, startTime, 0.02)
    const trim = dbToGain(TUNING.musicMakeupDb + (this.trims[song.id] ?? 0) + (arrangement?.gainDb ?? 0))
    out.gain.setValueAtTime(0.0001, now)
    out.gain.linearRampToValueAtTime(trim, startTime + fadeIn)
    this.current = playback
    // Fill now rather than at the next tick: a song started from inside a scheduler callback would otherwise get its
    // first bar scheduled late.
    this.fill(this.scheduler.horizon())
    this.graph.reverbMusic.setPreset(song.kind === 'fight' || song.kind === 'boss' ? 'room' : 'hall')
    return playback
  }

  private stopPlayback(p: Playback, at: number, fadeSec: number): void {
    if (p.stopping) return
    p.stopping = true
    rampTo(p.out.gain, 0, at, Math.max(0.05, fadeSec))
    this.scheduler.cancel(p.tag)
    const end = at + fadeSec + 0.1
    this.scheduler.add(end, () => {
      p.ended = true
      this.pool.stopOwner(p.tag, end, 0.1)
      try {
        p.out.disconnect()
        p.send.disconnect()
      } catch {
        /* fine */
      }
    })
    if (this.current === p) this.current = null
  }

  stop(fadeSec: number = TUNING.crossfadeSec): void {
    if (this.current) this.stopPlayback(this.current, this.ctx.currentTime, fadeSec)
    this.interrupted = null
  }

  /** Which lines sound now, applied as fades on the per-line gains. */
  private applySounding(p: Playback, at: number, fadeSec: number): void {
    const on = sounding(p.song, { stem: p.stem, layers: p.layers, arrangement: p.arrangement })
    for (const [id, l] of p.lines) {
      const want = on.has(id)
      if (want === l.on) continue
      l.on = want
      rampTo(l.sounding.gain, want ? 1 : 0, at, fadeSec)
      this.pool.setSilent(`${p.tag}/${id}`, !want)
    }
  }

  /** A layer change lands at the next bar and fades over one bar. */
  setLayers(layers: Iterable<string>): void {
    const p = this.current
    if (!p || p.once) return
    const next = new Set(layers)
    if (sameSet(next, p.layers)) return
    p.layers = next
    this.applySounding(p, this.nextBarTime(p), (p.transport.beatsPerBar * 60) / p.transport.bpm)
  }

  setStem(stem: string | null): void {
    const p = this.current
    if (!p || p.once || p.stem === stem) return
    p.stem = stem
    this.applySounding(p, this.nextBarTime(p), (p.transport.beatsPerBar * 60) / p.transport.bpm)
  }

  private nextBarTime(p: Playback): number {
    const t = p.transport
    const beat = ((this.ctx.currentTime - t.startTime) * t.bpm) / 60
    const bar = Math.floor(beat / t.beatsPerBar + 1e-6) + 1
    return beatToTime(t, bar * t.beatsPerBar)
  }

  /** Remembers the area song and fades it out, so `resumeArea` can restart it at the section after the one it left. */
  suspendArea(fadeSec: number): void {
    const area = this.current
    if (!area || area.stopping || area.once) return
    const order = orderOf(area.song, area.arrangement)
    let next = area.orderIndex + 1
    if (next >= order.length) next = loopFromOf(area.song, area.arrangement)
    this.interrupted = { playback: area, nextIndex: next }
    this.stopPlayback(area, this.ctx.currentTime, fadeSec)
  }

  /** Restarts the suspended area song at its next section with a fade-in. */
  resumeArea(fadeInSec: number): Playback | null {
    const it = this.interrupted
    this.interrupted = null
    if (!it) return null
    const old = it.playback
    return this.play(old.song, { arrangement: old.arrangement, layers: old.layers, stem: old.stem, fadeInSec, fadeOutSec: 0.1, startIndex: it.nextIndex, transpose: old.transpose })
  }

  /**
   * Interrupting stingers in a row (a victory, then a level up): the area music fades over 150 ms, the stingers play,
   * and after the last the area music comes back at the section after the one it left — unless `beforeResume` says
   * no. A song started meanwhile wins: the chain stops and the area music is not brought back over it.
   */
  interruptChain(stingers: readonly Song[], o: ChainOptions = {}): Playback | null {
    if (stingers.length === 0) return null
    this.suspendArea(TUNING.stingerFadeOutSec)
    const fadeIn = o.fadeInAfterSec ?? TUNING.stingerFadeInSec
    const playAt = (i: number): Playback => {
      const p: Playback = this.play(stingers[i]!, {
        transpose: o.transpose ?? 0,
        once: true,
        fadeInSec: 0.02,
        fadeOutSec: TUNING.stingerFadeOutSec,
        arrangement: o.gainDb ? { gainDb: o.gainDb } : null,
        onEnd: () => {
          if (this.current !== null && this.current !== p) return
          if (i + 1 < stingers.length) {
            playAt(i + 1)
            return
          }
          if (o.beforeResume && !o.beforeResume()) this.interrupted = null
          else this.resumeArea(fadeIn)
          o.onDone?.()
        },
      })
      return p
    }
    return playAt(0)
  }

  state(): { song: string; section: string; bar: number; layers: string[]; stem: string | null; bpm: number; stinger: boolean } | null {
    const p = this.current
    if (!p) return null
    return { song: p.song.id, section: orderOf(p.song, p.arrangement)[p.orderIndex] ?? '', bar: p.bar, layers: [...p.layers], stem: p.stem, bpm: p.transport.bpm, stinger: p.once }
  }

  voices(): number {
    return this.pool.count(this.ctx.currentTime)
  }

  /** The scheduler's filler: schedules whole bars until the horizon. */
  private fill(until: number): void {
    const p = this.current
    if (!p || p.ended || p.stopping) return
    for (let guard = 0; guard < 64; guard++) {
      const name = orderOf(p.song, p.arrangement)[p.orderIndex]
      if (name === undefined) {
        this.finish(p)
        return
      }
      const sec = p.song.sections[name]!
      if (p.bar >= sec.bars) {
        this.advanceSection(p, p.sectionStartBeat + sec.beats)
        continue
      }
      const barStartBeat = p.sectionStartBeat + p.bar * p.transport.beatsPerBar
      if (beatToTime(p.transport, barStartBeat) > until) return
      this.scheduleBar(p, name, p.bar, barStartBeat)
      p.bar++
    }
  }

  private advanceSection(p: Playback, atBeat: number): void {
    const order = orderOf(p.song, p.arrangement)
    p.sectionStartBeat = atBeat
    p.bar = 0
    p.orderIndex++
    if (p.orderIndex >= order.length) p.orderIndex = p.once ? order.length : loopFromOf(p.song, p.arrangement)
  }

  private finish(p: Playback): void {
    // A once-only song (a stinger) ends after its last note's release.
    const at = beatToTime(p.transport, p.sectionStartBeat) + 0.3
    if (p.stopping) return
    p.stopping = true
    this.scheduler.add(at, () => {
      p.ended = true
      rampTo(p.out.gain, 0, at, 0.5)
      this.pool.stopOwner(p.tag, at + 0.5, 0.4)
      if (this.current === p) this.current = null
      p.onEnd?.()
    })
  }

  private scheduleBar(p: Playback, section: string, bar: number, barStartBeat: number): void {
    const sec = p.song.sections[section]!
    const t = p.transport
    const spb = 60 / t.bpm
    const stem = p.stem ? p.song.stems?.[p.stem] : null
    const swing = p.song.swing ?? 0.5
    const simple = p.song.meter[1] === 4
    for (const line of p.song.lines) {
      if (stem && !stem.includes(line.id)) continue
      if (p.arrangement?.lines && !p.arrangement.lines.includes(line.id)) continue
      if (p.arrangement?.halfTime && line.kind === 'perc') continue
      const events = sec.events[line.id] ?? []
      const lg = p.lines.get(line.id)!
      const inst: InstrumentId = instrumentFor(p.song, line.id, p.arrangement)
      const def = INSTRUMENTS[inst]
      // A swapped line takes the new instrument's articulation and folds into its range.
      const swapped = inst !== line.inst && line.kind !== 'perc' && def.melody !== undefined
      const wantArt = p.arrangement?.arts?.[line.id]
      const lineArt = wantArt ? articulationOf(inst, wantArt) : swapped ? articulationOf(inst, line.art) : line.art
      let shift = 0
      if (swapped) {
        const k = `${line.id}/${inst}`
        let s = p.folds.get(k)
        if (s === undefined) {
          s = lineFoldShift(p.song, line.id, inst, p.transpose)
          p.folds.set(k, s)
        }
        shift = s
      }
      const phrase = events.filter((e) => e.bar === bar)
      for (const e of phrase) {
        let beat = barStartBeat + e.t
        if (swing > 0.5 && simple && Math.abs(e.t - Math.floor(e.t) - 0.5) < 1e-6) beat += swing - 0.5
        const human = (def.family === 'perc' ? 0.003 : 0.006) * jitter(this.rng)
        const time = beatToTime(t, beat) + human
        const dur = e.dur * spb
        const vel = Math.max(0.05, Math.min(1, e.vel * (1 + 0.06 * jitter(this.rng)) * phraseShape(e, phrase)))
        // Percussion steps carry no pitch: the drum plays its own (midi 60 picks no transposition).
        const raw = e.pitches.length ? e.pitches : line.kind === 'perc' ? [60 - p.transpose] : []
        const pitches = swapped ? foldedPitches(raw, inst, p.transpose, shift) : raw.map((m) => m + p.transpose)
        const art = e.dur >= 1 && def.longArt && lineArt === def.arts[0] ? def.longArt : lineArt
        this.scheduler.add(
          // At the note's own time, never in the past: the look-ahead already runs the callback up to 0.4 s early, and
          // Wildsong's 50 ms lead made a piece's very first notes "late" by the next 25 ms tick, so they were dropped.
          Math.max(this.ctx.currentTime, time),
          () => {
            if (p.ended) return
            if (def.mono) {
              const prev = p.mono.get(line.id)
              if (prev && !prev.stopped && prev.endsAt > time) prev.stop(time, 0.02)
            }
            const roll = (e.strumMs ?? (pitches.length > 1 && def.family === 'pluck' ? between(this.rng, 10, 25) : 0)) / 1000
            pitches.forEach((midi, i) => {
              const params: NoteParams = { inst, art, midi, vel, time: time + i * roll, dur, pan: line.pan, grace: e.grace?.map((g) => g + p.transpose), phraseStart: e.phraseStart, orn: e.orn }
              this.pool.makeRoom(time)
              const v = this.note(params, lg.gain)
              if (!v) return
              this.pool.add({ voice: v, startedAt: time, level: lg.on ? vel : 0, silentLayer: !lg.on, owner: `${p.tag}/${line.id}` })
              if (def.mono) p.mono.set(line.id, v)
            })
          },
          p.tag,
        )
      }
    }
  }

  /** A sampled note, or its code-made voice (while the samples load, or always for the code-made instruments); patches layer their instruments. */
  note(params: NoteParams, dest: AudioNode): Voice | null {
    const def = INSTRUMENTS[params.inst]
    if (def.patch) {
      let first: Voice | null = null
      for (const layer of def.patch.layers) {
        const sub = INSTRUMENTS[layer.inst]
        const v = this.note({ ...params, inst: layer.inst, art: sub.arts[0]!, midi: params.midi + layer.transpose, gainDb: (params.gainDb ?? 0) + layer.gainDb, dur: layer.decayCapSec ? Math.min(params.dur, layer.decayCapSec) : params.dur }, dest)
        first ??= v
      }
      return first
    }
    return playSample(this.ctx, this.bank, dest, params) ?? playSynth(this.ctx, dest, def.fallback, params)
  }

  stopAll(): void {
    const now = this.ctx.currentTime
    if (this.current) this.stopPlayback(this.current, now, 0.2)
    this.interrupted = null
    this.pool.stopAll(now)
  }
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}

/** Phrase shaping: a gentle rise to the phrase's middle and an easing at its end (±6%). */
function phraseShape(e: LineEvent, phrase: readonly LineEvent[]): number {
  const i = phrase.indexOf(e)
  if (i < 0 || phrase.length < 3) return 1
  const x = i / (phrase.length - 1)
  return 1 + 0.06 * Math.sin(Math.PI * x) - 0.03 * x
}
