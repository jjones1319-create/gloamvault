/**
 * The song model (ported from Wildsong Ranch's music/song.ts, SOUND_UPGRADE §6.1, §6.5 there). A song file holds
 * its ABC (the only source of tempo, meter and key), its parts (ABC voices), accompaniment lines (generators over the
 * chord track), percussion lines (step strings), its form (order and loop point), its layers, stems and arrangements.
 * `defineSong` parses and compiles everything once into plain events per section per line, which the scheduler, the
 * checker and the tests read. Gloamvault drops Wildsong's weather rules and kits and adds: the kinds of this game
 * (title, town, explore, fight, boss, stinger), a per-line lowpass (the Vault's submerged bell), the ABC ornaments, and
 * the motif quotes the checker looks for (07 §2.2: the Throne's leitmotif in every zone and boss). Pure.
 */
import { articulationOf, foldInto, INSTRUMENTS, isInstrumentId, octaveShiftInto, type InstrumentId } from '../recipes/instruments.ts'
import { beatsPerBar, parseAbc, type Ornament, type Tune } from './abc.ts'
import { chordAt, chordTrack, type Chord, type ChordAt } from './chords.ts'
import type { MotifId } from './motifs.ts'
import { generate, type GenEvent, type PatternId } from './patterns.ts'
import { defaultGrid, percEvents } from './perc.ts'

export const SONG_KINDS = ['title', 'town', 'explore', 'fight', 'boss', 'stinger'] as const
export type SongKind = (typeof SONG_KINDS)[number]

export const ROLES = ['lead', 'counter', 'accomp', 'bass', 'perc', 'colour'] as const
export type Role = (typeof ROLES)[number]

interface LineCommon {
  layers: readonly string[]
  /** dB. */
  gain?: number
  /** −1…1. */
  pan?: number
  /** A lowpass on the whole line (a bell heard under water, a horn behind a wall). */
  lowpassHz?: number
}

export interface PartDef extends LineCommon {
  inst: InstrumentId
  art?: string
  role: Role
  /** The ABC voice that holds the notes (default: the part's id). */
  voice?: string
}

export interface AccompDef extends LineCommon {
  inst: InstrumentId
  art?: string
  role: Role
  pattern: PatternId
  octave?: number
  density?: 'sparse' | 'normal' | 'busy'
  spread?: 'close' | 'open'
  size?: number
  octaveJumps?: boolean
}

export interface PercLineDef extends LineCommon {
  inst: InstrumentId
  art?: string
  steps: string
  /** Pitched percussion follows the chord track. */
  pitch?: 'root' | 'fifth'
}

export interface PercDef {
  grid?: number
  lines: Record<string, PercLineDef>
}

export interface Arrangement {
  /** Only these lines sound (default: all). */
  lines?: readonly string[]
  order?: readonly string[]
  loopFrom?: number
  /** Swap the instrument of these lines. */
  swap?: Partial<Record<string, InstrumentId>>
  /** The articulation of these lines. */
  arts?: Partial<Record<string, string>>
  /** Quarter-note BPM added to the song's tempo. */
  tempoNudge?: number
  gainDb?: number
  musicSend?: number
  /** Half-time feel: percussion off. */
  halfTime?: boolean
}

export interface MotifQuote {
  motif: MotifId
  part: string
  section: string
}

export interface SongDef {
  id: string
  kind: SongKind
  brief: string
  /** Reverb send 0–1. */
  musicSend: number
  /** 8th-note swing ratio 0.5 (straight) to 0.62. */
  swing?: number
  abc: string
  parts: Record<string, PartDef>
  accomp?: Record<string, AccompDef>
  perc?: PercDef
  order: readonly string[]
  loopFrom: number
  stems?: Record<string, readonly string[]>
  arrangements?: Record<string, Arrangement>
  derivedFrom?: string
  /** Where the motifs are quoted, for the checker (07 §2.2). */
  quotes?: readonly MotifQuote[]
}

export interface LineEvent {
  bar: number
  /** Beats from the bar's start. */
  t: number
  /** Beats; may cross bar lines after tie merging. */
  dur: number
  pitches: number[]
  vel: number
  grace?: number[]
  strumMs?: number
  /** First note after a rest (winds scoop, phrase shaping). */
  phraseStart?: boolean
  orn?: Ornament
}

export interface Line {
  id: string
  kind: 'part' | 'accomp' | 'perc'
  inst: InstrumentId
  art: string
  role: Role
  layers: readonly string[]
  gain: number
  pan: number
  lowpassHz?: number
  pitchedPerc?: 'root' | 'fifth'
}

export interface SectionData {
  name: string
  bars: number
  /** Beats in the section (sum of bar lengths; a pickup bar counts as written). */
  beats: number
  chordTrack: ChordAt[]
  /** Events per line id. */
  events: Record<string, LineEvent[]>
  /** Lead-bar pitch lists per part voice (for the checker's repetition rule), before tie merging. */
  voiceBars: Record<string, number[][]>
}

export interface Song extends SongDef {
  tune: Tune
  lines: Line[]
  sections: Record<string, SectionData>
  /** Quarter-note BPM. */
  bpm: number
  meter: readonly [number, number]
}

function requireInstrument(id: string, where: string): InstrumentId {
  if (!isInstrumentId(id)) throw new Error(`${where}: unknown instrument "${id}"`)
  return id
}

/** Merges tied events (same single pitch, back to back) into one longer event and marks phrase starts. */
function compilePart(bars: readonly { events: readonly { t: number; dur: number; pitches: number[]; tie: boolean; grace?: number[]; vel: number; orn?: Ornament }[]; length: number }[]): LineEvent[] {
  const out: LineEvent[] = []
  let open: LineEvent | null = null
  let openTie = false
  let afterRest = true
  bars.forEach((bar, b) => {
    for (const ev of bar.events) {
      if (ev.pitches.length === 0) {
        afterRest = true
        open = null
        openTie = false
        continue
      }
      if (open && openTie && open.pitches.length === 1 && ev.pitches.length === 1 && open.pitches[0] === ev.pitches[0]) {
        open.dur += ev.dur
        openTie = ev.tie
        continue
      }
      const e: LineEvent = { bar: b, t: ev.t, dur: ev.dur, pitches: [...ev.pitches], vel: ev.vel }
      if (ev.grace) e.grace = [...ev.grace]
      if (ev.orn) e.orn = ev.orn
      if (afterRest) e.phraseStart = true
      afterRest = false
      out.push(e)
      open = e
      openTie = ev.tie
    }
  })
  return out
}

function fromGen(events: readonly GenEvent[]): LineEvent[] {
  const out: LineEvent[] = []
  let open: LineEvent | null = null
  let openTie = false
  for (const g of events) {
    if (open && openTie && open.pitches.join(',') === g.pitches.join(',')) {
      open.dur += g.dur
      openTie = g.tie ?? false
      continue
    }
    const e: LineEvent = { bar: g.bar, t: g.t, dur: g.dur, pitches: [...g.pitches], vel: g.vel }
    if (g.strumMs) e.strumMs = g.strumMs
    out.push(e)
    open = e
    openTie = g.tie ?? false
  }
  return out
}

/** The range the generators use: the instrument's melody range. */
function generatorRange(inst: InstrumentId): readonly [number, number] {
  const m = INSTRUMENTS[inst].melody
  return m ? [m[0], m[1]] : [36, 84]
}

function common(id: string, kind: Line['kind'], inst: InstrumentId, art: string, role: Role, d: LineCommon): Line {
  const line: Line = { id, kind, inst, art, role, layers: d.layers, gain: d.gain ?? 0, pan: d.pan ?? 0 }
  if (d.lowpassHz) line.lowpassHz = d.lowpassHz
  return line
}

export function defineSong(def: SongDef): Song {
  const tune = parseAbc(def.abc)
  const chordsVoice = tune.voices.find((v) => v.id === 'chords')
  const lines: Line[] = []
  for (const [id, p] of Object.entries(def.parts)) {
    const inst = requireInstrument(p.inst, `${def.id}/${id}`)
    if (!tune.voices.some((v) => v.id === (p.voice ?? id))) throw new Error(`${def.id}: part ${id} has no ABC voice "${p.voice ?? id}"`)
    lines.push(common(id, 'part', inst, articulationOf(inst, p.art), p.role, p))
  }
  for (const [id, a] of Object.entries(def.accomp ?? {})) {
    if (def.parts[id]) throw new Error(`${def.id}: line id ${id} is both a part and an accompaniment`)
    const inst = requireInstrument(a.inst, `${def.id}/${id}`)
    lines.push(common(id, 'accomp', inst, articulationOf(inst, a.art), a.role, a))
  }
  for (const [id, p] of Object.entries(def.perc?.lines ?? {})) {
    if (def.parts[id] || def.accomp?.[id]) throw new Error(`${def.id}: line id ${id} is used twice`)
    const inst = requireInstrument(p.inst, `${def.id}/${id}`)
    const line = common(id, 'perc', inst, articulationOf(inst, p.art), 'perc', p)
    if (p.pitch) line.pitchedPerc = p.pitch
    lines.push(line)
  }

  const grid = def.perc?.grid ?? defaultGrid(tune.meter)
  const sections: Record<string, SectionData> = {}
  let lastChord: Chord | null = null
  for (const name of tune.sections) {
    const anyVoice = tune.voices[0]!.sections.find((s) => s.name === name)!
    const bars = anyVoice.bars.length
    const beats = anyVoice.bars.reduce((s, b) => s + b.length, 0)
    const meter = anyVoice.bars[0]?.meter ?? tune.meter
    let track: ChordAt[] = []
    if (chordsVoice) {
      const r = chordTrack(chordsVoice.sections.find((s) => s.name === name)!, lastChord)
      track = r.track
      lastChord = r.last
    }
    const events: Record<string, LineEvent[]> = {}
    const voiceBars: Record<string, number[][]> = {}
    for (const line of lines) {
      if (line.kind === 'part') {
        const p = def.parts[line.id]!
        const sec = tune.voices.find((v) => v.id === (p.voice ?? line.id))!.sections.find((s) => s.name === name)!
        events[line.id] = compilePart(sec.bars)
        voiceBars[line.id] = sec.bars.map((b) => b.events.flatMap((e) => (e.pitches.length ? [e.pitches[0]!] : [-1])))
      } else if (line.kind === 'accomp') {
        const a = def.accomp![line.id]!
        if (track.length === 0) throw new Error(`${def.id}: accompaniment ${line.id} needs a V:chords voice`)
        events[line.id] = fromGen(generate(a.pattern, track, bars, meter, { octave: a.octave, density: a.density, spread: a.spread, size: a.size, octaveJumps: a.octaveJumps, range: generatorRange(line.inst) }))
      } else {
        const p = def.perc!.lines[line.id]!
        const evs = percEvents(p.steps, grid, bars, meter)
        if (line.pitchedPerc) {
          for (const e of evs) {
            const c = chordAt(track, e.bar, e.t)
            if (c) {
              const pc = line.pitchedPerc === 'fifth' ? (c.root + 7) % 12 : c.bass
              // Timpani sit around C2–A3.
              let m = 36 + ((((pc - 36) % 12) + 12) % 12)
              if (m > 57) m -= 12
              e.pitches = [m]
            }
          }
        }
        events[line.id] = fromGen(evs)
      }
    }
    sections[name] = { name, bars, beats, chordTrack: track, events, voiceBars }
  }
  for (const name of def.order) if (!sections[name]) throw new Error(`${def.id}: order names unknown section "${name}"`)
  for (const [stem, ids] of Object.entries(def.stems ?? {})) for (const id of ids) if (!lines.some((l) => l.id === id)) throw new Error(`${def.id}: stem ${stem} names unknown line ${id}`)
  for (const [name, a] of Object.entries(def.arrangements ?? {})) for (const n of a.order ?? []) if (!sections[n]) throw new Error(`${def.id}: arrangement ${name} names unknown section "${n}"`)
  return { ...def, tune, lines, sections, bpm: tune.bpm, meter: tune.meter }
}

export interface SoundingOptions {
  stem?: string | null
  layers: ReadonlySet<string>
  arrangement?: Arrangement | null
}

/** Which lines sound: in the active stem (or no stem), allowed by the arrangement, and at least one layer on. */
export function sounding(song: Song, o: SoundingOptions): Set<string> {
  const out = new Set<string>()
  const stem = o.stem ? song.stems?.[o.stem] : null
  for (const line of song.lines) {
    if (stem && !stem.includes(line.id)) continue
    if (o.arrangement?.lines && !o.arrangement.lines.includes(line.id)) continue
    if (o.arrangement?.halfTime && line.kind === 'perc') continue
    if (!line.layers.some((l) => o.layers.has(l))) continue
    out.add(line.id)
  }
  return out
}

/** The instrument a line plays after an arrangement's swap. */
export function instrumentFor(song: Song, lineId: string, arrangement?: Arrangement | null): InstrumentId {
  const line = song.lines.find((l) => l.id === lineId)
  if (!line) throw new Error(`${song.id}: no line ${lineId}`)
  return arrangement?.swap?.[lineId] ?? line.inst
}

/** A line moved onto another instrument keeps its shape: it moves by the octave that fits most of it into the new range. */
export function lineFoldShift(song: Song, lineId: string, inst: InstrumentId, transpose = 0): number {
  const range = INSTRUMENTS[inst].melody
  if (!range) return 0
  const pitches: number[] = []
  for (const sec of Object.values(song.sections)) for (const e of sec.events[lineId] ?? []) for (const p of e.pitches) pitches.push(p + transpose)
  return octaveShiftInto(pitches, range)
}

/** The sounding pitches of one event of a line moved onto `inst`, given the line's fold shift. */
export function foldedPitches(pitches: readonly number[], inst: InstrumentId, transpose: number, shift: number): number[] {
  const range = INSTRUMENTS[inst].melody
  return pitches.map((p) => (range ? foldInto(p + transpose + shift, range) : p + transpose))
}

/** The play order of an arrangement (or the song's own). */
export function orderOf(song: Song, arrangement?: Arrangement | null): readonly string[] {
  return arrangement?.order ?? song.order
}

export function loopFromOf(song: Song, arrangement?: Arrangement | null): number {
  return arrangement?.loopFrom ?? song.loopFrom
}

/** Seconds of music in one pass of the order. */
export function passSeconds(song: Song, arrangement?: Arrangement | null): number {
  const bpm = song.bpm + (arrangement?.tempoNudge ?? 0)
  let beats = 0
  for (const name of orderOf(song, arrangement)) beats += song.sections[name]!.beats
  return (beats * 60) / bpm
}

/** Seconds of one section. */
export function sectionSeconds(song: Song, name: string, arrangement?: Arrangement | null): number {
  const bpm = song.bpm + (arrangement?.tempoNudge ?? 0)
  return (song.sections[name]!.beats * 60) / bpm
}

/** Quarter-note beats per bar. */
export function barBeats(song: Song): number {
  return beatsPerBar(song.meter)
}

/** Every (instrument, articulation) a song can sound, patches opened up: what the bank must load before it plays. */
export function songUsage(song: Song): { inst: string; art: string }[] {
  const out = new Map<string, { inst: string; art: string }>()
  const add = (inst: InstrumentId, art: string) => {
    const def = INSTRUMENTS[inst]
    if (def.patch) {
      for (const l of def.patch.layers) add(l.inst, INSTRUMENTS[l.inst].arts[0]!)
      return
    }
    if (def.synthOnly) return
    out.set(`${inst}/${art}`, { inst, art })
    if (def.longArt && art === def.arts[0]) out.set(`${inst}/${def.longArt}`, { inst, art: def.longArt })
  }
  for (const line of song.lines) add(line.inst, line.art)
  for (const a of Object.values(song.arrangements ?? {})) {
    for (const [id, inst] of Object.entries(a.swap ?? {})) if (inst) add(inst, articulationOf(inst, a.arts?.[id]))
  }
  return [...out.values()]
}
