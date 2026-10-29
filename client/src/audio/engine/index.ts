/**
 * The engine (ported from Wildsong Ranch's engine/index.ts). Wires the graph, the sample bank, the scheduler on a
 * driver, the music player, the ambience and the effect player on any BaseAudioContext, so the same code plays in the
 * game (AudioContext, realtime driver), renders offline (OfflineAudioContext, offline driver — the headless check) and
 * runs in the tests (fake driver). Only this folder touches Web Audio.
 */
import TUNING from '../tuning.json'
import { Ambience } from './ambience.ts'
import { createGraph, type Graph } from './context.ts'
import { fakeDriver, offlineDriver, realtimeDriver, type Driver, type OfflineDriver } from './driver.ts'
import { createRng, type Rng } from './rng.ts'
import { SampleBank, type ArtRef } from './samples.ts'
import { Scheduler } from './scheduler.ts'
import { SfxEngine } from './sfx.ts'
import { MusicPlayer } from './transport.ts'

export interface EngineOptions {
  /** The app's base URL (import.meta.env.BASE_URL), where public/audio lives. */
  baseUrl: string
  seed?: number
  meters?: boolean
  /** Which driver: realtime (the game), offline (renders) or fake (tests). */
  driver?: 'realtime' | 'offline' | 'fake'
  fetchFn?: typeof fetch
}

export interface AudioDebugView {
  song: string | null
  section: string
  layers: string[]
  stem: string | null
  stinger: boolean
  bpm: number
  bed: string | null
  musicFilterHz: number
  duckDb: number
  lateEvents: number
  played: number
  voices: { music: number; ambience: number; sfx: number }
  meters: Record<string, { peakDb: number; rmsDb: number }>
  samples: { loaded: string[]; seconds: number; failures: number; decodeMs: number }
  effects: { played: number; throttled: number }
}

export interface Engine {
  ctx: BaseAudioContext
  graph: Graph
  bank: SampleBank
  scheduler: Scheduler
  driver: Driver
  music: MusicPlayer
  ambience: Ambience
  sfx: SfxEngine
  rng: Rng
  start(): void
  stop(): void
  /** Loads these articulations (a piece's, a bed's) and resolves when they are in or failed. */
  need(list: readonly ArtRef[]): Promise<void>
  /** Loads these articulations and keeps them for the session (the effects' core set). */
  keep(list: readonly ArtRef[]): Promise<void>
  render(): Promise<AudioBuffer>
  debug(): AudioDebugView
}

export function createEngine(ctx: BaseAudioContext, o: EngineOptions): Engine {
  const rng = createRng(o.seed ?? ((Date.now() ^ 0x5eed) >>> 0))
  const graph = createGraph(ctx, { seed: o.seed, meters: o.meters })
  const bank = new SampleBank(ctx, o.baseUrl, o.fetchFn)
  const kind = o.driver ?? ('startRendering' in ctx ? 'offline' : 'realtime')
  const driver: Driver | OfflineDriver = kind === 'offline' ? offlineDriver(ctx as OfflineAudioContext, 0.1) : kind === 'fake' ? fakeDriver() : realtimeDriver(ctx, TUNING.tickMs)
  const scheduler = new Scheduler(driver, TUNING.lookaheadSec, TUNING.lateToleranceMs / 1000)
  const music = new MusicPlayer(ctx, graph, bank, scheduler, rng)
  const ambience = new Ambience(ctx, graph.ambience, graph.reverbPlace.input, bank, rng)
  const sfx = new SfxEngine(ctx, graph, bank, rng)
  music.trims = { ...TUNING.levels.songs }
  ambience.bedTrims = { ...TUNING.levels.beds }
  let lastSweep = 0
  scheduler.addFiller((until) => {
    const now = ctx.currentTime
    ambience.tick(now, until)
    if (now - lastSweep > 10) {
      lastSweep = now
      bank.sweep(now)
    }
  })
  return {
    ctx,
    graph,
    bank,
    scheduler,
    driver,
    music,
    ambience,
    sfx,
    rng,
    start: () => scheduler.start(),
    stop: () => {
      scheduler.stop()
      music.stopAll()
      ambience.stopAll()
      sfx.stopAll()
    },
    need: (list) => bank.need(list, ctx.currentTime),
    keep: (list) => {
      for (const r of list) bank.keep.add(`${r.inst}/${r.art}`)
      return bank.need(list, ctx.currentTime)
    },
    render: () => {
      if (!('render' in driver)) throw new Error('render needs the offline driver')
      return (driver as OfflineDriver).render()
    },
    debug: () => {
      const s = music.state()
      return {
        song: s?.song ?? null,
        section: s?.section ?? '',
        layers: s?.layers ?? [],
        stem: s?.stem ?? null,
        stinger: s?.stinger ?? false,
        bpm: s?.bpm ?? 0,
        bed: ambience.bedKey,
        musicFilterHz: Math.round(graph.musicFilterHz()),
        duckDb: Math.round(graph.duckDb() * 10) / 10,
        lateEvents: scheduler.lateEvents,
        played: scheduler.played,
        voices: { music: music.voices(), ambience: ambience.voices(), sfx: sfx.voices() },
        meters: graph.meters?.readAll() ?? {},
        samples: bank.report(),
        effects: { played: sfx.played, throttled: sfx.throttled },
      }
    },
  }
}
