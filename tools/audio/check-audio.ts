/**
 * `node tools/audio/check-audio.ts --port 5201 [--only emberfall,throne] [--seconds 8]` (Phase 8, pass A): a headless
 * check that the sound works in Chrome, for a pass that cannot hear. Needs a running dev server
 * (`npx vite --port 5201 --strictPort`).
 *
 * 1. Live: opens the title, the town (the smithy), a Cellars fight and a Crypts room at the phone's viewport, taps once
 *    (the gesture Android Chrome needs), waits, and reads `window.__audio`: the piece, the layers, the bed, the
 *    samples decoded, the scheduler's late events. Page errors fail the run.
 * 2. Offline: renders every piece and stinger through the real engine in an OfflineAudioContext with its samples
 *    loaded, and measures the result's peak and loudness, so a silent or clipping piece fails the run.
 */
import { chromium, type Page } from '@playwright/test'

const args = process.argv.slice(2)
const opt = (name: string, fallback?: string): string | undefined => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const port = Number(opt('port', '5201'))
const seconds = Number(opt('seconds', '8'))
const only = (opt('only', '') ?? '').split(',').filter(Boolean)
const base = `http://localhost:${port}/gloamvault/`

const problems: string[] = []

interface Scenario {
  name: string
  hash: string
  /** What the director should ask for once the sound is on. */
  expect: { song: string | null; bed?: string | null; stem?: string; effects?: boolean; finally?: string }
  /** Taps after the sound is on (Auto, to play a fight out). */
  then?: string[]
}

const SCENARIOS: Scenario[] = [
  { name: 'title', hash: '#title', expect: { song: 'emberfall' } },
  { name: 'the smithy', hash: '#town&demo=1&place=blacksmith', expect: { song: 'emberfall', bed: 'town-forge', stem: 'forge' } },
  { name: 'a Cellars fight', hash: '#delve=gravehollow-keep&floor=1&seed=17&party=warden,mender&auto=1', expect: { song: 'cellars-fight', bed: 'cellars' } },
  { name: 'a fight played out', hash: '#delve=gravehollow-keep&floor=1&seed=17&party=warden,mender&auto=1', expect: { song: null, effects: true, finally: 'cellars' }, then: ['[data-testid=fx-auto]'] },
  { name: 'a Crypts room', hash: '#delve=gravehollow-keep&zone=2&seed=23&party=warden,mender', expect: { song: 'crypts', bed: 'crypts' } },
]

async function readState(page: Page): Promise<Record<string, unknown>> {
  return (await page.evaluate(() => (window as unknown as { __audio?: { state: unknown } }).__audio?.state ?? null)) as Record<string, unknown>
}

async function live(page: Page, s: Scenario): Promise<void> {
  await page.goto(`${base}${s.hash}`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page.waitForSelector('html[data-ready="1"]', { timeout: 180_000 }).catch(() => problems.push(`${s.name}: the app never signalled ready`))
  await page.mouse.click(4, 4)
  await page.waitForTimeout(6000)
  for (const sel of s.then ?? []) {
    await page.locator(sel).first().click({ timeout: 5000 }).catch(() => problems.push(`${s.name}: could not tap ${sel}`))
    await page.waitForTimeout(9000)
  }
  const st = await readState(page)
  const request = st?.request as { song?: string | null; bed?: string | null } | undefined
  const samples = st?.samples as { loaded?: string[]; failures?: number; seconds?: number } | undefined
  console.log(`live · ${s.name}: song ${String(st?.song)} [${(st?.layers as string[] | undefined)?.join(',') ?? ''}] stem ${String(st?.stem)} · asked ${String(request?.song)} · bed ${String(st?.bed)} · ${samples?.loaded?.length ?? 0} articulations (${samples?.seconds ?? 0} s) · ${samples?.failures ?? 0} failures · played ${String(st?.played)} · late ${String(st?.lateEvents)} · voices ${JSON.stringify(st?.voices)}`)
  if (!st || st.unlocked === false) problems.push(`${s.name}: the sound did not start after a tap`)
  else {
    const effects = st.effects as { played?: number } | undefined
    console.log(`      effects played ${effects?.played ?? 0}`)
    if (s.expect.effects && !(Number(effects?.played ?? 0) > 3)) problems.push(`${s.name}: no fight sounds were played`)
    if (s.expect.finally) {
      // Whatever stinger plays now ends, and the music hands over to the place's piece.
      await page.waitForTimeout(12000)
      const later = await readState(page)
      console.log(`      later: song ${String(later?.song)} [${(later?.layers as string[] | undefined)?.join(',') ?? ''}] stinger ${String(later?.stinger)}`)
      if (later?.song !== s.expect.finally) problems.push(`${s.name}: after the stingers the song is ${String(later?.song)}, expected ${s.expect.finally}`)
    }
    if (s.expect.song !== null && request?.song !== s.expect.song) problems.push(`${s.name}: the director asked for ${String(request?.song)}, expected ${String(s.expect.song)}`)
    if (s.expect.bed !== undefined && st.bed !== null && !String(st.bed).startsWith(String(s.expect.bed))) problems.push(`${s.name}: bed ${String(st.bed)}, expected ${String(s.expect.bed)}`)
    if (s.expect.stem && st.stem !== s.expect.stem) problems.push(`${s.name}: stem ${String(st.stem)}, expected ${s.expect.stem}`)
    if ((samples?.failures ?? 0) > 0) problems.push(`${s.name}: ${samples?.failures} samples failed to load`)
    if (Number(st.played ?? 0) === 0) problems.push(`${s.name}: nothing was scheduled`)
  }
}

interface Level {
  id: string
  peakDb: number
  rmsDb: number
  loaded: number
  failures: number
}

async function offline(page: Page, ids: readonly string[], layersOf: Record<string, string[]>): Promise<Level[]> {
  return (await page.evaluate(
    async ({ ids, layersOf, seconds }) => {
      const engineMod = await import('/gloamvault/src/audio/engine/index.ts' as string)
      const songsMod = await import('/gloamvault/src/audio/music/songs/index.ts' as string)
      const stingersMod = await import('/gloamvault/src/audio/music/stingers.ts' as string)
      const songMod = await import('/gloamvault/src/audio/music/song.ts' as string)
      const out: { id: string; peakDb: number; rmsDb: number; loaded: number; failures: number }[] = []
      for (const id of ids) {
        const stinger = stingersMod.STINGERS[id]
        const song = stinger ?? (await songsMod.loadSong(id))
        const length = Math.min(seconds, stinger ? 10 : seconds)
        const ctx = new OfflineAudioContext(2, Math.round(48000 * length), 48000)
        const engine = engineMod.createEngine(ctx, { baseUrl: '/gloamvault/', driver: 'offline', seed: 1 })
        await engine.need(songMod.songUsage(song))
        engine.graph.setVolumes({ master: 80, music: 70, sfx: 80, muted: false })
        engine.start()
        engine.music.play(song, { layers: layersOf[id] ?? ['main'], fadeInSec: 0.05, once: !!stinger })
        const buf: AudioBuffer = await engine.render()
        let peak = 0
        let sum = 0
        for (let c = 0; c < buf.numberOfChannels; c++) {
          const d = buf.getChannelData(c)
          for (let i = 0; i < d.length; i++) {
            const v = Math.abs(d[i]!)
            if (v > peak) peak = v
            sum += v * v
          }
        }
        const rms = Math.sqrt(sum / (buf.length * buf.numberOfChannels))
        const report = engine.bank.report()
        out.push({ id, peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity, rmsDb: rms > 0 ? 20 * Math.log10(rms) : -Infinity, loaded: report.loaded.length, failures: report.failures })
      }
      return out
    },
    { ids: [...ids], layersOf, seconds },
  )) as Level[]
}

/** Renders every effect (1.5 s each) and every ambience bed (8 s each) through the engine and measures them. */
async function offlineEffectsAndBeds(page: Page): Promise<{ kind: string; id: string; peakDb: number; rmsDb: number }[]> {
  return (await page.evaluate(async () => {
    const engineMod = await import('/gloamvault/src/audio/engine/index.ts' as string)
    const sfxMod = await import('/gloamvault/src/audio/recipes/sfx.ts' as string)
    const bedMod = await import('/gloamvault/src/audio/recipes/ambience.ts' as string)
    const measure = (buf: AudioBuffer, from = 0) => {
      let peak = 0
      let sum = 0
      let n = 0
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const d = buf.getChannelData(c)
        for (let i = Math.round(from * buf.sampleRate); i < d.length; i++) {
          const v = Math.abs(d[i]!)
          if (v > peak) peak = v
          sum += v * v
          n++
        }
      }
      return { peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity, rmsDb: sum > 0 ? 10 * Math.log10(sum / n) : -Infinity }
    }
    const out: { kind: string; id: string; peakDb: number; rmsDb: number }[] = []
    const all = sfxMod.allSfx()
    // One engine loads the effects' samples once; each effect then renders in its own short context sharing the decoded buffers.
    const warm = engineMod.createEngine(new OfflineAudioContext(2, 48000, 48000), { baseUrl: '/gloamvault/', driver: 'offline', seed: 1 })
    await warm.keep(sfxMod.sfxUsage())
    for (const [id, def] of Object.entries(all)) {
      const ctx = new OfflineAudioContext(2, 72000, 48000)
      const engine = engineMod.createEngine(ctx, { baseUrl: '/gloamvault/', driver: 'offline', seed: 1 })
      await engine.need(sfxMod.sfxUsage())
      engine.graph.setVolumes({ master: 80, music: 70, sfx: 80, muted: false })
      engine.start()
      engine.sfx.play(id, def, { at: 0.05 })
      out.push({ kind: 'effect', id, ...measure(await engine.render()) })
    }
    for (const id of bedMod.BED_IDS) {
      const ctx = new OfflineAudioContext(2, 48000 * 8, 48000)
      const engine = engineMod.createEngine(ctx, { baseUrl: '/gloamvault/', driver: 'offline', seed: 1 })
      const want = bedMod.bedLayers(id).flatMap((l: { kind: string; event?: { kind: string; inst: string; art: string } }) => (l.kind === 'spawn' && l.event?.kind === 'sample' ? [{ inst: l.event.inst, art: l.event.art }] : []))
      await engine.need(want)
      engine.graph.setVolumes({ master: 80, music: 70, sfx: 80, muted: false })
      engine.start()
      engine.ambience.setBed(id, 0.05)
      out.push({ kind: 'bed', id, ...measure(await engine.render(), 1) })
    }
    return out
  })) as { kind: string; id: string; peakDb: number; rmsDb: number }[]
}

const PIECES = ['emberfall', 'cellars', 'cellars-fight', 'vexa', 'crypts', 'crypts-fight', 'warden', 'vault', 'vault-fight', 'naesa', 'throne']
const STINGERS = ['victory', 'bossVictory', 'defeat', 'levelUp', 'rareDrop', 'bossPhase']
/** What players hear most (fights base+drive, bosses in their first phase); `--full` renders every layer at once. */
const TYPICAL: Record<string, string[]> = {
  'cellars-fight': ['base', 'drive'],
  'crypts-fight': ['base', 'drive'],
  'vault-fight': ['base', 'drive'],
  vexa: ['base'],
  warden: ['base'],
  naesa: ['base'],
  throne: ['base'],
}
const FULL: Record<string, string[]> = {
  'cellars-fight': ['base', 'drive', 'tension'],
  'crypts-fight': ['base', 'drive', 'tension'],
  'vault-fight': ['base', 'drive', 'tension'],
  vexa: ['base', 'phase2'],
  warden: ['base', 'phase2'],
  naesa: ['base', 'phase2'],
  throne: ['base', 'phase2', 'phase3', 'company', 'vigil', 'cult'],
}
const LAYERS = args.includes('--full') ? FULL : TYPICAL

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 892, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true })
  const open = async (): Promise<Page> => {
    const page = await context.newPage()
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`console.error: ${m.text()}`)
      if (m.type() === 'warning' && m.text().startsWith('audio:')) console.log(`  warn: ${m.text()}`)
    })
    return page
  }
  // A fresh page each time: a new hash on the same URL does not reload, and the deep links boot only on a load.
  for (const s of SCENARIOS) {
    if (only.length && !only.includes(s.name)) continue
    const p = await open()
    await live(p, s)
    await p.close()
  }
  const page = await open()
  await page.goto(`${base}#title`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  const ids = [...PIECES, ...STINGERS].filter((id) => !only.length || only.includes(id))
  for (const l of await offline(page, ids, LAYERS)) {
    console.log(`offline · ${l.id.padEnd(14)} peak ${l.peakDb.toFixed(1).padStart(6)} dBFS · rms ${l.rmsDb.toFixed(1).padStart(6)} dBFS · ${l.loaded} articulations · ${l.failures} failures`)
    if (!(l.rmsDb > -50)) problems.push(`${l.id}: silent (rms ${l.rmsDb.toFixed(1)} dBFS)`)
    if (l.peakDb > -0.1) problems.push(`${l.id}: clips (peak ${l.peakDb.toFixed(1)} dBFS)`)
    if (l.failures > 0) problems.push(`${l.id}: ${l.failures} samples failed`)
  }
  if (args.includes('--effects')) {
    for (const l of await offlineEffectsAndBeds(page)) {
      console.log(`offline · ${l.kind.padEnd(6)} ${l.id.padEnd(20)} peak ${l.peakDb.toFixed(1).padStart(6)} dBFS · rms ${l.rmsDb.toFixed(1).padStart(6)} dBFS`)
      if (!(l.peakDb > -60)) problems.push(`${l.kind} ${l.id}: silent`)
      if (l.peakDb > -0.1) problems.push(`${l.kind} ${l.id}: clips`)
    }
  }
  await context.close()
} finally {
  await browser.close()
}
for (const p of problems) console.error(`  problem: ${p}`)
process.exit(problems.length ? 1 : 0)
