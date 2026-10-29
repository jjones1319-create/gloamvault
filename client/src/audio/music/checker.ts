/**
 * The music checker (ported from Wildsong Ranch's music/checker.ts, SOUND_UPGRADE §6.7 there; test-only: nothing the
 * game runs imports it). The song's kind picks its tempo band and length bounds and which rules apply; it reads the
 * compiled song, the sample roots from the manifest and (for distinctness) the other songs. Gloamvault's bands follow
 * 07 §2.2's briefs (the Vault at 54, the Crypts at 60, fights at 104–112, the Warden and the Throne at 72); its lead
 * register reaches down to A2 for the bowed and sung lines. A part whose role is `colour` (a motif call, a bell, a
 * parallel voice) is checked for range only.
 */
import { INSTRUMENTS, nearestRoot, playableRange, type SampleRoots } from '../recipes/instruments.ts'
import { strongBeats } from './abc.ts'
import { chordAt, isChordTone } from './chords.ts'
import { containsMotif, MOTIFS } from './motifs.ts'
import { passSeconds, type LineEvent, type Song, type SongKind } from './song.ts'

export interface CheckIssue {
  rule: number
  level: 'error' | 'warning'
  message: string
  line?: string
  section?: string
  bar?: number
}

export interface CheckContext {
  roots: SampleRoots
  /** The other songs, for rule 13. */
  others?: readonly Song[]
}

/** Tempo bands in quarter-note BPM and loop-length bounds in seconds, by kind. */
export const TEMPO_BANDS: Record<SongKind, readonly [number, number]> = {
  title: [60, 112],
  town: [90, 116],
  explore: [50, 104],
  fight: [96, 132],
  boss: [50, 132],
  stinger: [60, 140],
}
export const LENGTH_BOUNDS: Record<SongKind, readonly [number, number]> = {
  title: [30, 160],
  town: [60, 160],
  explore: [60, 160],
  fight: [60, 600],
  boss: [60, 600],
  stinger: [1.5, 10],
}

const LEAD_LOW = 45 // A2
const LEAD_HIGH = 88 // E6
const C7 = 96
const A5 = 81
const MP_VEL = 0.5

function topPitch(e: LineEvent): number {
  return Math.max(...e.pitches)
}

export function checkSong(song: Song, ctx: CheckContext): CheckIssue[] {
  const issues: CheckIssue[] = []
  const err = (rule: number, message: string, extra: Partial<CheckIssue> = {}) => issues.push({ rule, level: 'error', message, ...extra })
  const warn = (rule: number, message: string, extra: Partial<CheckIssue> = {}) => issues.push({ rule, level: 'warning', message, ...extra })
  const bpb = (song.meter[0] / song.meter[1]) * 4
  const secPerBeat = 60 / song.bpm
  const big = song.kind === 'fight' || song.kind === 'boss'
  const melodic = song.lines.filter((l) => l.role === 'lead' || l.role === 'counter')

  // 1. Structure.
  if (song.order.length === 0) err(1, 'the order is empty')
  if (song.loopFrom < 0 || song.loopFrom >= song.order.length) err(1, `loopFrom ${song.loopFrom} is outside the order`)

  // 2. Ranges and sample coverage.
  for (const line of song.lines) {
    const def = INSTRUMENTS[line.inst]
    const range = playableRange(ctx.roots, line.inst, line.art)
    const roots = ctx.roots[line.inst]?.[line.art] ?? []
    for (const [name, sec] of Object.entries(song.sections)) {
      for (const e of sec.events[line.id] ?? []) {
        for (const p of e.pitches) {
          if (def.melody === undefined) {
            if (line.pitchedPerc && roots.length && roots.every((r) => Math.abs(r - p) > 9)) err(2, `${line.id}: ${p} is more than 9 semitones from any ${line.inst} sample`, { line: line.id, section: name, bar: e.bar })
            continue
          }
          if (range === null) {
            err(2, `${line.id}: ${line.inst}/${line.art} has no samples in the manifest`, { line: line.id, section: name })
            break
          }
          if (p < range[0] || p > range[1]) err(2, `${line.id}: ${p} is outside ${line.inst}'s playable range ${range[0]}–${range[1]}`, { line: line.id, section: name, bar: e.bar })
          else if (!def.patch && !def.synthOnly && nearestRoot(roots, p) === null) err(2, `${line.id}: ${p} is more than 4 semitones from any ${line.inst}/${line.art} sample`, { line: line.id, section: name, bar: e.bar })
          if (melodic.includes(line) && (p < def.melody[0] || p > def.melody[1])) err(2, `${line.id}: ${p} is outside ${line.inst}'s melody range ${def.melody[0]}–${def.melody[1]}`, { line: line.id, section: name, bar: e.bar })
          if (melodic.includes(line) && (p < LEAD_LOW || p > LEAD_HIGH)) err(10, `${line.id}: ${p} is outside the lead register A2–E6`, { line: line.id, section: name, bar: e.bar })
        }
      }
    }
  }

  // 3. Monophonic instruments never overlap.
  for (const line of song.lines) {
    if (!INSTRUMENTS[line.inst].mono) continue
    for (const [name, sec] of Object.entries(song.sections)) {
      const evs = (sec.events[line.id] ?? []).map((e) => ({ s: e.bar * bpb + e.t, e: e.bar * bpb + e.t + e.dur, bar: e.bar }))
      for (let i = 1; i < evs.length; i++) if (evs[i]!.s < evs[i - 1]!.e - 1e-6) err(3, `${line.id}: notes overlap in bar ${evs[i]!.bar + 1} (${line.inst} is monophonic)`, { line: line.id, section: name, bar: evs[i]!.bar })
      for (const e of sec.events[line.id] ?? []) if (e.pitches.length > 1) err(3, `${line.id}: a chord on a monophonic instrument`, { line: line.id, section: name, bar: e.bar })
    }
  }

  // 4. Wind leads breathe: never more than 4 bars or 8 s without a rest of at least an eighth.
  for (const line of melodic) {
    if (INSTRUMENTS[line.inst].family !== 'wind') continue
    const limitBeats = Math.min(4 * bpb, 8 / secPerBeat)
    for (const [name, sec] of Object.entries(song.sections)) {
      let runStart: number | null = null
      let lastEnd = 0
      for (const e of sec.events[line.id] ?? []) {
        const s = e.bar * bpb + e.t
        if (runStart === null || s - lastEnd >= 0.5 - 1e-6) runStart = s
        lastEnd = s + e.dur
        if (lastEnd - runStart > limitBeats + 1e-6) {
          err(4, `${line.id}: no breath for ${((lastEnd - runStart) * secPerBeat).toFixed(1)} s ending in bar ${e.bar + 1}`, { line: line.id, section: name, bar: e.bar })
          runStart = lastEnd
        }
      }
    }
  }

  // 5. Melodic rules: leads must, counters should (a warning).
  for (const line of melodic) {
    const report = line.role === 'lead' ? err : warn
    let moves = 0
    let steps = 0
    let wideLeaps = 0
    let recovered = 0
    for (const [name, sec] of Object.entries(song.sections)) {
      const evs = sec.events[line.id] ?? []
      for (let i = 0; i < evs.length; i++) {
        const e = evs[i]!
        const p = topPitch(e)
        const next = evs[i + 1]
        if (next) {
          const iv = topPitch(next) - p
          moves++
          if (Math.abs(iv) <= 2) steps++
          if (Math.abs(iv) > 12) report(5, `${line.id}: a leap of ${Math.abs(iv)} semitones in bar ${next.bar + 1}`, { line: line.id, section: name, bar: next.bar })
          if (Math.abs(iv) > 7) {
            wideLeaps++
            const after = evs[i + 2]
            if (after) {
              const back = topPitch(after) - topPitch(next)
              if (Math.abs(back) <= 2 && Math.sign(back) === -Math.sign(iv)) recovered++
            } else recovered++
          }
        }
        const endsPhrase = !next || next.phraseStart === true
        if (endsPhrase && sec.chordTrack.length) {
          const c = chordAt(sec.chordTrack, e.bar, e.t)
          if (c && !isChordTone(c, p)) report(5, `${line.id}: phrase ends on ${p}, not a tone of ${c.text} (bar ${e.bar + 1})`, { line: line.id, section: name, bar: e.bar })
        }
      }
    }
    if (moves >= 8) {
      const share = steps / moves
      if (share < 0.55 || share > 0.85) report(5, `${line.id}: ${(share * 100).toFixed(0)}% of moves are steps (55–85% wanted)`, { line: line.id })
    }
    if (wideLeaps > 0 && recovered / wideLeaps < 0.8) report(5, `${line.id}: only ${recovered}/${wideLeaps} wide leaps turn back by step`, { line: line.id })
  }

  // 6. Downbeats: a chord tone, or a suspension that resolves by step within the bar.
  for (const line of melodic) {
    const report = line.role === 'lead' ? err : warn
    for (const [name, sec] of Object.entries(song.sections)) {
      if (sec.chordTrack.length === 0) continue
      const evs = sec.events[line.id] ?? []
      for (let b = 0; b < sec.bars; b++) {
        const sounding = evs.find((e) => e.bar === b && e.t === 0) ?? evs.find((e) => e.bar * bpb + e.t < b * bpb && e.bar * bpb + e.t + e.dur > b * bpb + 1e-6)
        if (!sounding) continue
        const c = chordAt(sec.chordTrack, b, 0)
        if (!c) continue
        const p = topPitch(sounding)
        if (!isChordTone(c, p)) {
          const next = evs[evs.indexOf(sounding) + 1]
          const resolves = next && next.bar === b && Math.abs(topPitch(next) - p) <= 2 && isChordTone(c, topPitch(next))
          if (!resolves) report(6, `${line.id}: downbeat ${p} of bar ${b + 1} is not a tone of ${c.text} and does not resolve by step`, { line: line.id, section: name, bar: b })
        }
        const againstBass = (((p - c.bass) % 12) + 12) % 12
        if (againstBass === 1 || againstBass === 11) warn(6, `${line.id}: ${p} is a ${againstBass === 1 ? 'minor 2nd' : 'major 7th'} against the bass of ${c.text} in bar ${b + 1}`, { line: line.id, section: name, bar: b })
      }
    }
  }

  // 7. The lead sits at least a 3rd above the highest accompaniment note on strong beats (a warning).
  const accompLines = song.lines.filter((l) => l.role === 'accomp')
  for (const line of melodic.filter((l) => l.role === 'lead')) {
    for (const [name, sec] of Object.entries(song.sections)) {
      const evs = sec.events[line.id] ?? []
      for (let b = 0; b < sec.bars; b++) {
        for (const sb of strongBeats(song.meter)) {
          const at = b * bpb + sb
          const lead = evs.find((e) => e.bar * bpb + e.t <= at + 1e-6 && e.bar * bpb + e.t + e.dur > at + 1e-6)
          if (!lead) continue
          let top = -Infinity
          for (const a of accompLines) for (const e of sec.events[a.id] ?? []) if (e.bar * bpb + e.t <= at + 1e-6 && e.bar * bpb + e.t + e.dur > at + 1e-6 && e.pitches.length) top = Math.max(top, ...e.pitches)
          if (top !== -Infinity && topPitch(lead) < top + 3) {
            warn(7, `${line.id}: ${topPitch(lead)} sits under the accompaniment (${top}) on a strong beat of bar ${b + 1}`, { line: line.id, section: name, bar: b })
            break
          }
        }
      }
    }
  }

  // 8. Tempo band and loop length.
  const band = TEMPO_BANDS[song.kind]
  if (song.bpm < band[0] || song.bpm > band[1]) err(8, `tempo ${song.bpm} is outside the ${song.kind} band ${band[0]}–${band[1]}`)
  const bounds = LENGTH_BOUNDS[song.kind]
  const seconds = passSeconds(song)
  if (seconds < bounds[0] || seconds > bounds[1]) err(8, `one pass is ${seconds.toFixed(1)} s; a ${song.kind} wants ${bounds[0]}–${bounds[1]} s`)

  // 9. Variety (not stingers or the title's arrangement).
  if (song.kind !== 'stinger') {
    const lead = song.lines.find((l) => l.role === 'lead')
    if (lead) {
      const sigOf = (bars: number[][]) => bars.map((b) => b.join(',')).join('|')
      const names = Object.keys(song.sections)
      const distinct = new Set(names.map((n) => sigOf(song.sections[n]!.voiceBars[lead.id] ?? [])))
      if (distinct.size < 2) err(9, 'fewer than two contrasting sections')
      const allBars = names.flatMap((n) => song.sections[n]!.voiceBars[lead.id] ?? []).filter((b) => b.some((p) => p >= 0))
      const seen = new Set<string>()
      let identical = 0
      for (const b of allBars) {
        const k = b.join(',')
        if (seen.has(k)) identical++
        else seen.add(k)
      }
      if (allBars.length && identical / allBars.length > 0.35) err(9, `${((identical / allBars.length) * 100).toFixed(0)}% of lead bars repeat an earlier bar (35% allowed)`)
      let varied = false
      for (let i = 0; i < names.length && !varied; i++) {
        for (let j = 0; j < names.length; j++) {
          if (i === j) continue
          const a = song.sections[names[i]!]!.voiceBars[lead.id] ?? []
          const b = song.sections[names[j]!]!.voiceBars[lead.id] ?? []
          if (a.length === 0 || sigOf(a) === sigOf(b)) continue
          if (a.filter((bar, k) => b[k] && bar.join(',') === b[k]!.join(',')).length >= Math.ceil(a.length * 0.4)) {
            varied = true
            break
          }
        }
      }
      if (!varied) err(9, 'no varied repeat: no section shares at least 40% of its lead bars with another while differing')
    }
  }

  // 10. Register and density.
  for (const line of song.lines) {
    if (INSTRUMENTS[line.inst].melody === undefined) continue
    for (const [name, sec] of Object.entries(song.sections)) {
      for (const e of sec.events[line.id] ?? []) {
        const p = topPitch(e)
        if (p > C7) err(10, `${line.id}: ${p} is above C7`, { line: line.id, section: name, bar: e.bar })
        if (p > A5 && e.dur >= 1 && e.vel > MP_VEL + 1e-6) warn(10, `${line.id}: a sustained ${p} above A5 at louder than mp`, { line: line.id, section: name, bar: e.bar })
      }
    }
  }
  {
    const limit = big ? 6 : 4
    const isMelodic = (l: Song['lines'][number]) => l.role === 'lead' || l.role === 'counter' || l.role === 'accomp'
    const groups = song.stems ? Object.entries(song.stems).map(([name, ids]) => ({ name, lines: song.lines.filter((l) => ids.includes(l.id) && isMelodic(l)) })) : [{ name: '', lines: song.lines.filter(isMelodic) }]
    for (const group of groups) {
      for (const [name, sec] of Object.entries(song.sections)) {
        const total = Math.round(sec.beats * 4)
        for (let s = 0; s < total; s++) {
          const at = s / 4 + 1e-4
          let n = 0
          for (const l of group.lines) if ((sec.events[l.id] ?? []).some((e) => e.bar * bpb + e.t <= at && e.bar * bpb + e.t + e.dur > at)) n++
          if (n > limit) {
            warn(10, `${n} melodic voices sound at once in bar ${Math.floor(at / bpb) + 1}${group.name ? ` of stem ${group.name}` : ''} (${limit} wanted)`, { section: name, bar: Math.floor(at / bpb) })
            break
          }
        }
      }
    }
  }

  // 12. The motif quotes the song declares are there, in its own mode.
  for (const q of song.quotes ?? []) {
    const evs = song.sections[q.section]?.events[q.part]
    if (!evs) err(12, `a ${q.motif} quote names ${q.part}/${q.section}, which does not exist`)
    else if (!containsMotif(evs.map(topPitch), MOTIFS[q.motif], song.tune.key.mode)) err(12, `the ${q.motif} motif is not in ${q.part}/${q.section} (in ${song.tune.key.mode})`)
  }

  // 13. Distinctness across songs.
  if (ctx.others?.length) {
    const mine = leadWindows(song)
    for (const other of ctx.others) {
      if (other.id === song.id || other.derivedFrom === song.id || song.derivedFrom === other.id) continue
      const theirs = leadWindows(other)
      for (const [sig, where] of mine) {
        if (theirs.has(sig)) {
          err(13, `${where} shares a 2-bar lead phrase with ${other.id} (${theirs.get(sig)})`)
          break
        }
      }
    }
  }

  // 14. Every instrument is one of ours.
  for (const line of song.lines) if (!(line.inst in INSTRUMENTS)) err(14, `${line.id}: ${line.inst} is not an instrument`)
  return issues
}

/** Every 2-bar window of the lead's interval-and-rhythm signature, with where it sits. */
function leadWindows(song: Song): Map<string, string> {
  const out = new Map<string, string>()
  const lead = song.lines.find((l) => l.role === 'lead')
  if (!lead) return out
  for (const [name, sec] of Object.entries(song.sections)) {
    const evs = sec.events[lead.id] ?? []
    for (let b = 0; b + 1 < sec.bars; b++) {
      const win = evs.filter((e) => e.bar === b || e.bar === b + 1)
      if (win.length < 4) continue
      const sig = win.map((e, i) => `${i ? topPitch(e) - topPitch(win[i - 1]!) : 'x'}:${e.dur}`).join(' ')
      if (!out.has(sig)) out.set(sig, `${song.id}/${name} bars ${b + 1}–${b + 2}`)
    }
  }
  return out
}
