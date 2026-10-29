/**
 * The sample bank (ported from Wildsong Ranch's engine/samples.ts). Reads public/audio/manifest.json and decodes
 * samples with `decodeAudioData` on demand — per instrument articulation, the moment a piece, a bed or an effect
 * needs it, a few files at a time — so a place fetches only what it plays (Phase 8: the audio is runtime-cached, never
 * precached). An articulation unused for 60 s is released unless it is kept (the core set the effects use). Picks the
 * nearest sample for a note with alternate takes rotating. A missing file or a failed decode is logged once and
 * skipped: the fallback voices play instead.
 */
import TUNING from '../tuning.json'
import { nearestRoot, type SampleRoots } from '../recipes/instruments.ts'

export interface ManifestSample {
  file: string
  inst: string
  art: string
  root: number
  cents: number
  take: number
  onset: number
  loopStart: number | null
  loopEnd: number | null
  seconds: number
  bytes: number
  /** The source library's key in `sources` (vcsl, vsco, kenney-impact, kenney-rpg). */
  src: string
  /** A short content hash: the file is fetched as `?v=<hash>`, so a changed file is a new cache entry. */
  hash?: string
}

export interface Manifest {
  version: number
  sampleRate: number
  codec: string
  instruments: Record<string, { arts: Record<string, ManifestSample[]> }>
  sources: Record<string, { name: string; url: string; license: string; pin: string | null; sha256: string | null }>
}

export type LoadState = 'idle' | 'loading' | 'ready' | 'failed'

export interface PickedSample {
  sample: ManifestSample
  buffer: AudioBuffer
  /** Playback rate for the wanted pitch. */
  rate: number
}

export interface ArtRef {
  inst: string
  art: string
}

export const RELEASE_AFTER_SEC = TUNING.releaseUnusedSec
const CONCURRENCY = 6

interface ArtEntry {
  state: LoadState
  lastUsed: number
  promise: Promise<void> | null
}

export class SampleBank {
  readonly ctx: BaseAudioContext
  readonly baseUrl: string
  manifest: Manifest | null = null
  /** Articulations never released ("inst/art"): the effects' core set. */
  readonly keep = new Set<string>()
  private buffers = new Map<string, AudioBuffer>()
  private arts = new Map<string, ArtEntry>()
  private takeCounter = new Map<string, number>()
  private fetchFn: typeof fetch
  private manifestPromise: Promise<Manifest> | null = null
  failures = 0
  decodeMs = 0

  constructor(ctx: BaseAudioContext, baseUrl: string, fetchFn: typeof fetch = (...a) => fetch(...a)) {
    this.ctx = ctx
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    this.fetchFn = fetchFn
  }

  loadManifest(): Promise<Manifest> {
    this.manifestPromise ??= this.fetchFn(`${this.baseUrl}audio/manifest.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`manifest ${r.status}`)
        return r.json() as Promise<Manifest>
      })
      .then((m) => {
        this.manifest = m
        return m
      })
    // A failed fetch (offline before the manifest was cached) is tried again by the next request.
    this.manifestPromise.catch(() => {
      this.manifestPromise = null
    })
    return this.manifestPromise
  }

  /** Decodes every sample of these articulations (unknown ones are skipped); resolves when all are in or failed. */
  async need(list: readonly ArtRef[], nowSec: number = this.ctx.currentTime): Promise<void> {
    const m = await this.loadManifest()
    const waits: Promise<void>[] = []
    const files: ManifestSample[] = []
    const fresh: ArtEntry[] = []
    for (const { inst, art } of list) {
      const samples = m.instruments[inst]?.arts[art]
      if (!samples || samples.length === 0) continue
      const key = `${inst}/${art}`
      const have = this.arts.get(key)
      if (have) {
        have.lastUsed = nowSec
        if (have.promise && have.state !== 'failed') waits.push(have.promise)
        continue
      }
      const entry: ArtEntry = { state: 'loading', lastUsed: nowSec, promise: null }
      this.arts.set(key, entry)
      fresh.push(entry)
      files.push(...samples)
    }
    if (files.length) {
      const started = typeof performance !== 'undefined' ? performance.now() : 0
      let index = 0
      const worker = async () => {
        while (index < files.length) {
          const f = files[index++]!
          if (this.buffers.has(f.file)) continue
          try {
            const res = await this.fetchFn(`${this.baseUrl}audio/${f.file}${f.hash ? `?v=${f.hash}` : ''}`)
            if (!res.ok) throw new Error(String(res.status))
            const buffer = await this.ctx.decodeAudioData(await res.arrayBuffer())
            this.buffers.set(f.file, buffer)
          } catch (e) {
            this.failures++
            if (this.failures === 1) console.warn(`audio: could not load ${f.file} (${(e as Error).message}); its fallback voice plays instead`)
          }
        }
      }
      const all = Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker)).then(() => {
        this.decodeMs += Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - started)
        for (const e of fresh) e.state = 'ready'
      })
      for (const e of fresh) e.promise = all
      waits.push(all)
    }
    await Promise.all(waits)
  }

  /** Every sample of this articulation is decoded. */
  ready(inst: string, art: string): boolean {
    const list = this.manifest?.instruments[inst]?.arts[art]
    if (!list || list.length === 0) return false
    return list.every((s) => this.buffers.has(s.file))
  }

  hasInstrument(inst: string): boolean {
    return this.manifest?.instruments[inst] !== undefined
  }

  /** The roots per articulation, for ranges and the checker. */
  roots(): SampleRoots {
    const out: SampleRoots = {}
    if (!this.manifest) return out
    for (const [inst, def] of Object.entries(this.manifest.instruments)) {
      out[inst] = {}
      for (const [art, list] of Object.entries(def.arts)) out[inst]![art] = [...new Set(list.map((s) => s.root))]
    }
    return out
  }

  /** Releases articulations (never the kept ones) unused for 60 s. */
  sweep(nowSec: number): void {
    const m = this.manifest
    if (!m) return
    for (const [key, e] of this.arts) {
      if (this.keep.has(key) || e.state !== 'ready' || nowSec - e.lastUsed < RELEASE_AFTER_SEC) continue
      const [inst, art] = key.split('/') as [string, string]
      for (const s of m.instruments[inst]?.arts[art] ?? []) this.buffers.delete(s.file)
      this.arts.delete(key)
    }
  }

  private touch(inst: string, art: string): void {
    const e = this.arts.get(`${inst}/${art}`)
    if (e) e.lastUsed = this.ctx.currentTime
  }

  /** The nearest decoded sample for a pitched note (±4 semitones, preferring the one just below), takes rotating. */
  pick(inst: string, art: string, midi: number): PickedSample | null {
    const list = this.manifest?.instruments[inst]?.arts[art]
    if (!list) return null
    const root = nearestRoot([...new Set(list.map((s) => s.root))], midi)
    if (root === null) return null
    const takes = list.filter((s) => s.root === root && this.buffers.has(s.file))
    if (takes.length === 0) return null
    this.touch(inst, art)
    const key = `${inst}/${art}/${root}`
    const n = this.takeCounter.get(key) ?? 0
    this.takeCounter.set(key, n + 1)
    const sample = takes[n % takes.length]!
    const rate = Math.pow(2, (midi - sample.root - sample.cents / 100) / 12)
    return { sample, buffer: this.buffers.get(sample.file)!, rate }
  }

  /** An unpitched hit (drums, Foley): takes rotate, never the same one twice in a row. */
  take(inst: string, art: string): PickedSample | null {
    const list = this.manifest?.instruments[inst]?.arts[art]
    if (!list) return null
    const takes = list.filter((s) => this.buffers.has(s.file))
    if (takes.length === 0) return null
    this.touch(inst, art)
    const key = `${inst}/${art}`
    const n = this.takeCounter.get(key) ?? 0
    this.takeCounter.set(key, n + 1)
    const sample = takes[n % takes.length]!
    return { sample, buffer: this.buffers.get(sample.file)!, rate: 1 }
  }

  /** For the debug view: articulations loaded, decoded seconds and failures. */
  report(): { loaded: string[]; seconds: number; failures: number; decodeMs: number } {
    let seconds = 0
    for (const b of this.buffers.values()) seconds += b.duration
    return { loaded: [...this.arts.entries()].filter(([, e]) => e.state === 'ready').map(([k]) => k), seconds: Math.round(seconds), failures: this.failures, decodeMs: this.decodeMs }
  }
}
