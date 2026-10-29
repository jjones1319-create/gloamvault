import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PICK, sourceOf } from '../../../tools/audio/copy-samples.ts'
import { songUsage } from './music/song.ts'
import { loadAllSongs } from './music/songs/index.ts'
import { STINGERS } from './music/stingers.ts'
import { BEDS, bedLayers, CAMPFIRE, type BedId } from './recipes/ambience.ts'
import { INSTRUMENT_IDS, INSTRUMENTS } from './recipes/instruments.ts'
import { sfxUsage } from './recipes/sfx.ts'

/**
 * Phase 8 (pass A): the committed samples match their manifest — every file is on disk with its hash and size, every
 * file names its CC0 library (CREDITS.md lists them), the copy script's pick list is exactly what the manifest holds,
 * and every instrument a piece, a stinger, an effect or a bed plays is there (or is made in code).
 */
interface Sample {
  file: string
  inst: string
  art: string
  root: number
  src: string
  hash: string
  bytes: number
}
const DIR = 'client/public/audio'
const manifest = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8')) as {
  sources: Record<string, { name: string; url: string; license: string }>
  instruments: Record<string, { arts: Record<string, Sample[]> }>
  totals: { files: number; bytes: number }
}
const samples = Object.values(manifest.instruments).flatMap((i) => Object.values(i.arts).flat())

describe('the audio manifest', () => {
  it('every sample is on disk with the hash and size the manifest says', () => {
    expect(samples.length).toBe(manifest.totals.files)
    for (const s of samples) {
      const p = join(DIR, s.file)
      expect(existsSync(p), s.file).toBe(true)
      expect(statSync(p).size, s.file).toBe(s.bytes)
      expect(createHash('sha1').update(readFileSync(p)).digest('hex').slice(0, 8), s.file).toBe(s.hash)
    }
  })

  it('every sample names its CC0 library, and every library is credited', () => {
    const credits = readFileSync('CREDITS.md', 'utf8')
    for (const s of samples) {
      expect(manifest.sources[s.src], `${s.file}: ${s.src}`).toBeTruthy()
      expect(s.src).toBe(sourceOf(s.inst, s.art))
    }
    for (const src of Object.values(manifest.sources)) {
      expect(src.license).toBe('CC0 1.0')
      expect(credits, src.name).toContain(src.name)
    }
  })

  it('holds exactly the copy script\'s pick list, and the instruments table knows every articulation', () => {
    const held = Object.fromEntries(Object.entries(manifest.instruments).map(([inst, d]) => [inst, Object.keys(d.arts).sort()]))
    const picked = Object.fromEntries(Object.entries(PICK).map(([inst, arts]) => [inst, [...arts].sort()]))
    expect(held).toEqual(picked)
    for (const [inst, arts] of Object.entries(held)) {
      expect(INSTRUMENT_IDS as readonly string[], inst).toContain(inst)
      expect([...INSTRUMENTS[inst as keyof typeof INSTRUMENTS].arts].sort(), inst).toEqual(arts)
    }
  })

  it('every instrument a piece, a stinger, an effect or a bed plays has its samples (or is made in code)', async () => {
    const songs = await loadAllSongs()
    const used = [...Object.values(songs), ...Object.values(STINGERS)].flatMap((s) => songUsage(s))
    used.push(...sfxUsage())
    for (const id of Object.keys(BEDS) as BedId[]) {
      for (const l of [...bedLayers(id), ...CAMPFIRE]) if (l.kind === 'spawn' && l.event.kind === 'sample') used.push({ inst: l.event.inst, art: l.event.art })
    }
    const missing = used.filter((u) => !manifest.instruments[u.inst]?.arts[u.art]?.length).map((u) => `${u.inst}/${u.art}`)
    expect([...new Set(missing)]).toEqual([])
  })

  it('stays small: under 3 MB of Opus, fetched per place on first use', () => {
    expect(manifest.totals.bytes).toBeLessThan(3 * 1024 * 1024)
  })
})
