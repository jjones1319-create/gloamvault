/**
 * `node tools/audio/copy-samples.ts [--from <Wildsong Ranch folder>]` (Phase 8, pass A): copies the CC0 Opus samples
 * Gloamvault plays from Wildsong Ranch's public/audio (James's own MIT game; its samples were trimmed, level-matched,
 * loop-baked and encoded by its tools/audio/build-samples.ts from VCSL, VSCO 2 CE and Kenney's Impact Sounds and RPG
 * Audio) into client/public/audio/<instrument>/, and writes client/public/audio/manifest.json: every file with its
 * pitch, onset and loop points (Wildsong's measurements), its source library and a short content hash (the client
 * fetches `?v=<hash>`, so a changed file is a new cache entry). Only reads the Wildsong folder; never writes there.
 * Re-runnable: the output folder is rebuilt from the pick list below.
 */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

interface WildSample {
  file: string
  inst: string
  art: string
  dyn: string
  root: number
  cents: number
  take: number
  onset: number
  loopStart: number | null
  loopEnd: number | null
  trimDb: number
  seconds: number
  bytes: number
}

interface WildManifest {
  version: number
  sampleRate: number
  codec: string
  instruments: Record<string, { pack: string; arts: Record<string, WildSample[]> }>
  sources: Record<string, { name: string; url: string; license: string; pin: string | null; sha256: string | null }>
}

/** What Gloamvault plays, by instrument and articulation (client/src/audio/recipes/instruments.ts must match). */
export const PICK: Record<string, readonly string[]> = {
  'recorder-alto': ['sus', 'vib'],
  clarinet: ['sus'],
  horn: ['sus'],
  violins: ['vib', 'spic', 'trem'],
  violas: ['vib'],
  cellos: ['vib', 'pizz', 'trem'],
  contrabass: ['pizz', 'sus'],
  harp: ['pluck'],
  strumstick: ['pluck'],
  'tubular-bells': ['hit'],
  'wine-glasses': ['slow'],
  organ: ['sus'],
  'frame-drum': ['hit', 'muted'],
  darbuka: ['hit'],
  bongos: ['hit'],
  tambourine: ['hit'],
  shaker: ['hit'],
  claves: ['hit'],
  woodblock: ['hit'],
  timpani: ['hit', 'roll'],
  'bass-drum': ['hit'],
  'cymbal-swell': ['swell'],
  foley: ['footstep_concrete', 'footstep_wood', 'impactWood_light', 'impactWood_heavy', 'impactSoft_heavy', 'impactSoft_medium', 'impactPlank_medium', 'impactMining', 'impactPunch_medium', 'cloth', 'creak', 'handleCoins'],
}

/** Which library each instrument came from (Wildsong's CREDITS.md and SOUND_UPGRADE §5.2). */
const VSCO = new Set(['flute', 'clarinet', 'horn', 'violins', 'violas', 'cellos', 'contrabass'])
const KENNEY_RPG = new Set(['cloth', 'creak', 'handleCoins', 'bookFlip'])

export function sourceOf(inst: string, art: string): string {
  if (inst === 'foley') return KENNEY_RPG.has(art) ? 'kenney-rpg' : 'kenney-impact'
  return VSCO.has(inst) ? 'vsco' : 'vcsl'
}

function main(): void {
  const args = process.argv.slice(2)
  const fromArg = args.indexOf('--from')
  const wildsong = resolve(fromArg >= 0 && args[fromArg + 1] ? args[fromArg + 1]! : join(process.cwd(), '..', 'Monster Rancher'))
  const srcDir = join(wildsong, 'public', 'audio')
  const outDir = join(process.cwd(), 'client', 'public', 'audio')
  const wild = JSON.parse(readFileSync(join(srcDir, 'manifest.json'), 'utf8')) as WildManifest
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  const instruments: Record<string, { arts: Record<string, unknown[]> }> = {}
  const used = new Set<string>()
  let files = 0
  let bytes = 0
  let seconds = 0
  for (const [inst, arts] of Object.entries(PICK)) {
    const def = wild.instruments[inst]
    if (!def) throw new Error(`Wildsong has no ${inst}`)
    instruments[inst] = { arts: {} }
    for (const art of arts) {
      const list = def.arts[art]
      if (!list?.length) throw new Error(`Wildsong has no ${inst}/${art}`)
      instruments[inst]!.arts[art] = list.map((s) => {
        const name = s.file.split('/').pop()!
        const rel = `${inst}/${name}`
        const to = join(outDir, inst, name)
        mkdirSync(dirname(to), { recursive: true })
        copyFileSync(join(srcDir, s.file), to)
        const data = readFileSync(to)
        const src = sourceOf(inst, art)
        used.add(src)
        files++
        bytes += data.length
        seconds += s.seconds
        return { file: rel, inst, art, root: s.root, cents: s.cents, take: s.take, onset: s.onset, loopStart: s.loopStart, loopEnd: s.loopEnd, seconds: s.seconds, bytes: data.length, src, hash: createHash('sha1').update(data).digest('hex').slice(0, 8) }
      })
    }
  }
  const sources = Object.fromEntries(Object.entries(wild.sources).filter(([k]) => used.has(k)))
  const manifest = {
    note: 'Gloamvault audio (Phase 8): CC0 samples copied from Wildsong Ranch by tools/audio/copy-samples.ts; `src` names each file\'s library in `sources` (CREDITS.md lists them).',
    version: 1,
    sampleRate: wild.sampleRate,
    codec: wild.codec,
    totals: { files, bytes, seconds: Math.round(seconds * 10) / 10 },
    sources,
    instruments,
  }
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`)
  console.log(`copied ${files} files, ${(bytes / 1024).toFixed(0)} KB, ${seconds.toFixed(0)} s of audio into ${outDir}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
