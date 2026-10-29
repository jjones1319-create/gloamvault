/**
 * The audio runtime (Phase 8; the engine-side glue behind `index.ts`, loaded with the engine on the first gesture).
 * It applies the director's requests (pieces, layers, stems, beds, reverb), loads each piece's samples before it
 * starts (a short wait, then the code-made voices cover whatever is missing), plays effects by id in the playing key,
 * and plays stingers in the area's key — when the place changed while a stinger played (a won fight's victory ends on
 * the zone's exploring music), the chain hands over to the new piece instead of bringing the fight back.
 * Every call is guarded: a sound is never worth an error.
 */
import TUNING from './tuning.json'
import type { BedRequest, Request, SongRequest, StingerName } from './director.ts'
import { createEngine, type Engine } from './engine/index.ts'
import type { VolumeSettings } from './engine/context.ts'
import type { ReverbPreset } from './engine/reverb.ts'
import type { Playback } from './engine/transport.ts'
import { songUsage, type Arrangement, type Song } from './music/song.ts'
import { isSongId, loadSong } from './music/songs/index.ts'
import { STINGERS } from './music/stingers.ts'
import { bedLayers, CAMPFIRE, isBedId, type BedLayer } from './recipes/ambience.ts'
import { allSfx, chestRevealSfx, sfxUsage, type SfxDef } from './recipes/sfx.ts'
import type { SoundCue } from './sounds.ts'

export interface AudioRuntime {
  engine: Engine
  apply(r: Request): void
  effect(id: string, o?: { pan?: number; gainDb?: number; at?: number }): void
  cues(list: readonly SoundCue[], staggerSec?: number): void
  chestReveal(rare: boolean): void
  stingers(ids: readonly StingerName[]): void
  setVolumes(v: VolumeSettings): void
  debug(): Record<string, unknown>
}

interface Applied {
  key: string
  song: Song | null
  playback: Playback | null
}

function arrangementOf(song: Song, r: SongRequest): Arrangement | null {
  return r.arrangement ? (song.arrangements?.[r.arrangement] ?? null) : null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function boot(ctx: AudioContext, baseUrl: string): AudioRuntime {
  const engine = createEngine(ctx, { baseUrl, meters: true, driver: 'realtime' })
  engine.start()
  const sfx = allSfx()
  let last: Request | null = null
  let applied: Applied = { key: '', song: null, playback: null }
  /** The song request made while a stinger held the music (undefined: none). */
  let pendingSong: SongRequest | null | undefined = undefined
  let applying: Promise<void> = Promise.resolve()

  // The effects' instruments and the stingers' are kept loaded for the session (the core set).
  const stingerUsage = Object.values(STINGERS).flatMap((s) => songUsage(s))
  void engine.keep([...sfxUsage(), ...stingerUsage]).catch(() => undefined)

  const songKey = (r: SongRequest | null) => (r ? `${r.id}|${r.arrangement ?? ''}` : '')

  function setBed(b: BedRequest | null): void {
    if (b === null) {
      engine.ambience.setBed(null)
      return
    }
    if (!isBedId(b.id)) return
    const extra: readonly BedLayer[] = b.campfire ? CAMPFIRE : []
    // A bed's sampled events (the Warden's far bell, footsteps) load in the background; until then they are silent.
    const want = [...bedLayers(b.id), ...extra].flatMap((l) => (l.kind === 'spawn' && l.event.kind === 'sample' ? [{ inst: l.event.inst, art: l.event.art }] : []))
    if (want.length) void engine.need(want).catch(() => undefined)
    engine.ambience.setBed(b.id, TUNING.bedCrossfadeSec, extra, b.campfire ? 'campfire' : '')
  }

  async function startSong(r: SongRequest): Promise<void> {
    if (!isSongId(r.id)) return
    const song = await loadSong(r.id)
    if (songKey(last && last.song !== 'keep' ? last.song : null) !== songKey(r)) return
    // The longest a new piece waits for its samples before it starts on the code-made voices.
    await Promise.race([engine.need(songUsage(song)).catch(() => undefined), sleep(TUNING.sampleWaitMs)])
    const current = last && last.song !== 'keep' ? last.song : null
    if (songKey(current) !== songKey(r)) return
    if (engine.music.stingerPlaying()) {
      pendingSong = current
      return
    }
    const fight = song.kind === 'fight' || song.kind === 'boss'
    const fadeIn = fight ? TUNING.fightInSec : r.crossfadeSec
    const fadeOut = fight ? TUNING.fightInSec : applied.song?.kind === 'fight' || applied.song?.kind === 'boss' ? TUNING.fightOutSec : r.crossfadeSec
    const playback = engine.music.play(song, { arrangement: arrangementOf(song, r), layers: current!.layers, stem: current!.stem, fadeInSec: fadeIn, fadeOutSec: fadeOut })
    applied = { key: songKey(r), song, playback }
  }

  async function applyNow(r: Request): Promise<void> {
    if (r.reverb !== 'keep') engine.graph.reverbPlace.setPreset(r.reverb as ReverbPreset)
    if (r.bed !== 'keep') setBed(r.bed)
    if (r.song === 'keep') return
    if (engine.music.stingerPlaying()) {
      // The stinger finishes first; its chain then resumes or hands over (see `stingers`).
      pendingSong = r.song
      return
    }
    if (r.song === null) {
      if (engine.music.current) engine.music.stop(1.2)
      applied = { key: '', song: null, playback: null }
      return
    }
    const p = engine.music.current
    if (applied.key === songKey(r.song) && p && !p.stopping && !p.once) {
      engine.music.setLayers(r.song.layers)
      engine.music.setStem(r.song.stem)
      return
    }
    await startSong(r.song)
  }

  function apply(r: Request): void {
    last = r
    applying = applying.then(() => (last === r ? applyNow(r) : undefined)).catch((e: unknown) => console.warn('audio: a request failed', e))
  }

  function effect(id: string, o: { pan?: number; gainDb?: number; at?: number } = {}): void {
    const def: SfxDef | undefined = sfx[id]
    if (!def) return
    try {
      engine.sfx.play(id, def, { pan: o.pan, gainDb: o.gainDb, at: o.at, key: engine.music.key() ?? undefined })
    } catch {
      /* a sound is never worth an error */
    }
  }

  function cues(list: readonly SoundCue[], staggerSec = 0.03): void {
    const now = ctx.currentTime
    list.forEach((c, i) => effect(c.id, { pan: c.pan, gainDb: c.gainDb, at: now + i * staggerSec }))
  }

  /** The transposition that moves a stinger written in C into the area key, by the nearest road (−6…+5). */
  function transposeToArea(): number {
    const tonic = engine.music.key()?.tonic ?? 0
    return tonic > 6 ? tonic - 12 : tonic
  }

  function stingers(ids: readonly StingerName[]): void {
    const songs = ids.map((id) => STINGERS[id]).filter((s): s is Song => !!s)
    if (songs.length === 0) return
    pendingSong = undefined
    try {
      engine.music.interruptChain(songs, {
        transpose: transposeToArea(),
        fadeInAfterSec: TUNING.stingerFadeInSec,
        beforeResume: () => {
          const want = pendingSong
          if (want === undefined) return true
          const area = engine.music.interrupted?.playback
          if (want && area && songKey(want) === applied.key) {
            area.layers = new Set(want.layers)
            area.stem = want.stem
            pendingSong = undefined
            return true
          }
          return false
        },
        onDone: () => {
          const want = pendingSong
          pendingSong = undefined
          if (want === undefined || !last) return
          if (want === null) {
            applied = { key: '', song: null, playback: null }
            return
          }
          if (songKey(want) !== applied.key || !engine.music.current) void startSong(want)
        },
      })
    } catch (e) {
      console.warn('audio: a stinger failed', e)
    }
  }

  return {
    engine,
    apply,
    effect,
    cues,
    chestReveal(rare) {
      try {
        engine.sfx.play(rare ? 'chest-reveal-rare' : 'chest-reveal', chestRevealSfx(rare), { key: engine.music.key() ?? undefined })
      } catch {
        /* never an error */
      }
    },
    stingers,
    setVolumes: (v) => engine.graph.setVolumes(v),
    debug: () => ({ ...engine.debug(), request: last ? { song: last.song === 'keep' ? 'keep' : (last.song?.id ?? null), layers: last.song && last.song !== 'keep' ? last.song.layers : null, bed: last.bed === 'keep' ? 'keep' : (last.bed?.id ?? null) } : null }),
  }
}
