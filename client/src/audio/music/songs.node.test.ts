import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { SampleRoots } from '../recipes/instruments.ts'
import { checkSong } from './checker.ts'
import { passSeconds, type Song } from './song.ts'
import { loadAllSongs, SONG_IDS } from './songs/index.ts'
import { STINGER_IDS, STINGERS } from './stingers.ts'

/**
 * Phase 8 (pass A): every piece parses (an ABC parse test for each), passes the music checker against the committed
 * manifest's samples, has the layers its place asks for, and quotes the motifs 07 §2.2 asks of it.
 */
function manifestRoots(): SampleRoots {
  const m = JSON.parse(readFileSync('client/public/audio/manifest.json', 'utf8')) as { instruments: Record<string, { arts: Record<string, { root: number }[]> }> }
  const roots: SampleRoots = {}
  for (const [inst, def] of Object.entries(m.instruments)) {
    roots[inst] = {}
    for (const [art, list] of Object.entries(def.arts)) roots[inst]![art] = [...new Set(list.map((s) => s.root))]
  }
  return roots
}

const songs = await loadAllSongs()
const all: Song[] = [...Object.values(songs), ...Object.values(STINGERS)]
const roots = manifestRoots()
const layersOf = (s: Song) => new Set(s.lines.flatMap((l) => [...l.layers]))

describe('every piece parses and passes the music checker', () => {
  for (const song of all) {
    it(`${song.id} has no errors`, () => {
      expect(song.tune.voices.length).toBeGreaterThan(0)
      const issues = checkSong(song, { roots, others: all.filter((s) => s !== song) })
      expect(issues.filter((i) => i.level === 'error').map((i) => `rule ${i.rule}: ${i.message}${i.section ? ` [${i.section}]` : ''}`)).toEqual([])
    })
  }
})

describe('the pieces fit their places (07 §2.2)', () => {
  it('there is a piece for every place and they all load', () => {
    expect(Object.keys(songs).sort()).toEqual([...SONG_IDS].sort())
  })

  it('Emberfall has a stem for every town place and a title arrangement', () => {
    const e = songs.emberfall
    expect(Object.keys(e.stems ?? {}).sort()).toEqual(['forge', 'hall', 'inn', 'shrine', 'square', 'stall'])
    expect(e.arrangements?.title?.lines).toContain('lead')
    expect(e.tune.meter).toEqual([3, 4])
  })

  it('the zones are in their briefs: the Cellars a loping 6/8 Mixolydian, the Crypts Dorian at 60, the Vault Phrygian 3/4 at 54', () => {
    expect(songs.cellars.tune.meter).toEqual([6, 8])
    expect(songs.cellars.tune.key.mode).toBe('mixolydian')
    expect(songs.crypts.tune.key.mode).toBe('dorian')
    expect(songs.crypts.bpm).toBe(60)
    expect(songs.vault.tune.key.mode).toBe('phrygian')
    expect(songs.vault.tune.meter).toEqual([3, 4])
    expect(songs.vault.bpm).toBe(54)
  })

  it('the Cellars fight is 4/4 at 112 with a snare roll; every fight has base, drive and tension layers', () => {
    expect(songs['cellars-fight'].tune.meter).toEqual([4, 4])
    expect(songs['cellars-fight'].bpm).toBe(112)
    expect(songs['cellars-fight'].lines.some((l) => l.inst === 'snare' && l.art === 'roll')).toBe(true)
    for (const id of ['cellars-fight', 'crypts-fight', 'vault-fight'] as const) {
      const layers = layersOf(songs[id])
      for (const l of ['base', 'drive', 'tension']) expect(layers.has(l), `${id} has ${l}`).toBe(true)
      expect(passSeconds(songs[id])).toBeGreaterThanOrEqual(60)
    }
  })

  it('each zone piece has its rest layer, and the Crypts a spider layer of tremolo harp', () => {
    for (const id of ['cellars', 'crypts', 'vault'] as const) expect(layersOf(songs[id]).has('rest'), id).toBe(true)
    const spider = songs.crypts.lines.filter((l) => l.layers.includes('spider'))
    expect(spider.some((l) => l.inst === 'harp')).toBe(true)
  })

  it('the Throne leitmotif is heard once in every zone and in every boss piece', () => {
    for (const id of ['cellars', 'crypts', 'vault', 'vexa', 'warden', 'naesa', 'throne'] as const) {
      expect(songs[id].quotes?.some((q) => q.motif === 'throne'), id).toBe(true)
    }
  })

  it('each boss has its own motif and its phases as layers; the Throne brings back the three hunters', () => {
    expect(songs.vexa.quotes?.some((q) => q.motif === 'company')).toBe(true)
    expect(songs.vexa.tune.meter).toEqual([3, 4])
    expect(songs.warden.quotes?.some((q) => q.motif === 'vigil')).toBe(true)
    expect(songs.warden.bpm).toBe(72)
    expect(songs.naesa.quotes?.some((q) => q.motif === 'chant')).toBe(true)
    expect(songs.naesa.tune.meter).toEqual([7, 8])
    expect(songs.throne.bpm).toBe(72)
    expect(songs.throne.lines.some((l) => l.inst === 'organ')).toBe(true)
    expect(songs.throne.lines.some((l) => l.inst === 'bass-drum')).toBe(true)
    for (const id of ['vexa', 'warden', 'naesa', 'throne'] as const) expect(layersOf(songs[id]).has('phase2'), id).toBe(true)
    expect(layersOf(songs.throne).has('phase3')).toBe(true)
    for (const l of ['company', 'vigil', 'cult']) expect(layersOf(songs.throne).has(l), l).toBe(true)
    expect(songs.throne.quotes?.map((q) => q.motif).sort()).toEqual(['chant', 'company', 'throne', 'vigil'].sort())
  })
})

describe('the stingers', () => {
  it('there are the six: victory, a boss beaten, defeat, level up, a rare find, a boss phase', () => {
    expect([...STINGER_IDS].sort()).toEqual(['bossPhase', 'bossVictory', 'defeat', 'levelUp', 'rareDrop', 'victory'])
  })

  it('stingers are 1.5–10 s and written in C (they are moved to the area key)', () => {
    for (const s of Object.values(STINGERS)) {
      expect(s.tune.key.tonic, s.id).toBe(0)
      const sec = passSeconds(s)
      expect(sec, s.id).toBeGreaterThanOrEqual(1.5)
      expect(sec, s.id).toBeLessThanOrEqual(10)
    }
  })
})
