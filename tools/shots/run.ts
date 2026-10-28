/**
 * `npm run shots [-- --skip-build] [--only name,name]`: builds the app, serves dist/ with `vite preview` on port 4173,
 * drives the installed Google Chrome through Playwright at a landscape S25 Ultra viewport (892 × 412 CSS px at
 * DPR 2.625 ≈ 2,341 × 1,081 px) through the deep-link set below, and writes PNGs to client/shots/.
 * CLAUDE.md rule 7: a client change is not done until these PNGs exist and have been looked at.
 * A leftover preview on 4173 makes this fail fast: kill it first.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Browser } from '@playwright/test'
import { build, preview } from 'vite'

interface Shot {
  name: string
  hash: string
  portrait?: boolean
  /** Settings to seed before load (so the overlay shows without taps). */
  settings?: Record<string, unknown>
  /** Actions after load. */
  act?: (page: import('@playwright/test').Page) => Promise<void>
}

const SHOTS: Shot[] = [
  { name: 'title', hash: '#title' },
  { name: 'title-perf', hash: '#title', settings: { perfOverlay: true, installCardDismissed: true } },
  { name: 'settings', hash: '#settings' },
  { name: 'settings-large-text', hash: '#settings', settings: { textSize: 'large' } },
  { name: 'phone', hash: '#phone' },
  { name: 'title-portrait', hash: '#title', portrait: true },
  // New game asks how death works first (D-088).
  { name: 'title-death-rule', hash: '#title', settings: { installCardDismissed: true }, act: async (page) => page.getByTestId('new-game').click() },
  // Checkpoint 1 (D-095): a Nightmare run that ends, and the Hall of Nightmares it leaves on the title.
  { name: 'delve-nightmare-end', hash: '#delve=gravehollow-keep&floor=1&seed=3&party=blade&death=nightmare&end=1' },
  { name: 'title-hall', hash: '#delve=gravehollow-keep&floor=1&seed=3&party=blade&death=nightmare&end=1', act: async (page) => page.getByTestId('dv-home').click() },
  // Phase 4: the game. `demo=1` is an ephemeral level-1 Warden with gold and an egg; a delve link with a seed is an ephemeral party.
  { name: 'new-hero', hash: '#new-hero' },
  { name: 'town', hash: '#town&demo=1' },
  { name: 'town-waystone', hash: '#town&place=waystone&demo=1' },
  { name: 'town-blacksmith', hash: '#town&place=blacksmith&demo=1' },
  { name: 'town-skills', hash: '#town&place=skills&demo=1' },
  { name: 'town-curio', hash: '#town&place=curio&demo=1' },
  { name: 'town-inn', hash: '#town&place=inn&demo=1' },
  // James's direction during Phase 4 (D-088–D-092): the Shrine, the Wayfarer Chest's odds, the Stables and the Bank.
  { name: 'town-shrine', hash: '#town&place=shrine&demo=1' },
  { name: 'town-curio-wayfarer-odds', hash: '#town&place=curio&demo=1', act: async (page) => page.getByTestId('cm-odds-standard-wayfarer-chest').click() },
  { name: 'town-stables', hash: '#town&place=stables&demo=1' },
  { name: 'town-bank', hash: '#town&place=bank&demo=1' },
  { name: 'hero-pet', hash: '#hero=hero-1&tab=pet&demo=1' },
  { name: 'hero-wayfarer', hash: '#hero=hero-2&tab=status&demo=1' },
  { name: 'hero-status', hash: '#hero=hero-1&tab=status&demo=1' },
  { name: 'hero-gear', hash: '#hero=hero-1&tab=gear&demo=1' },
  { name: 'hero-skills', hash: '#hero=hero-1&tab=skills&demo=1' },
  { name: 'delve-room', hash: '#delve=gravehollow&zone=1&seed=17&party=warden,mender' },
  { name: 'delve-room-perf', hash: '#delve=gravehollow&zone=1&seed=17&party=warden,mender', settings: { perfOverlay: true, installCardDismissed: true } },
  { name: 'delve-fight', hash: '#delve=gravehollow&zone=1&seed=17&party=warden,mender&auto=1' },
  { name: 'delve-fight-four', hash: '#delve=gravehollow&zone=1&seed=21&party=warden,blade,mender,arcanist&level=5&auto=1' },
]

const args = process.argv.slice(2)
const skipBuild = args.includes('--skip-build')
const onlyIdx = args.indexOf('--only')
const only = onlyIdx >= 0 ? new Set((args[onlyIdx + 1] ?? '').split(',').filter(Boolean)) : null
const OUT = join('client', 'shots')
/** The preview port: 4173, or `GLOAMVAULT_PORT` when another project on the machine holds it. */
const PORT = Number(process.env.GLOAMVAULT_PORT ?? 4173)
const BASE = '/gloamvault/'

mkdirSync(OUT, { recursive: true })
if (!skipBuild) {
  console.log('building…')
  await build({ configFile: 'vite.config.ts', logLevel: 'warn' })
}

const server = await preview({ configFile: 'vite.config.ts', preview: { port: PORT, strictPort: true, open: false }, logLevel: 'warn' })
const origin = `http://localhost:${PORT}`
console.log(`serving ${origin}${BASE}`)

let browser: Browser | null = null
const problems: string[] = []
const written: { name: string; file: string; width: number; height: number }[] = []
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  for (const shot of SHOTS) {
    if (only && !only.has(shot.name)) continue
    const viewport = shot.portrait ? { width: 412, height: 892 } : { width: 892, height: 412 }
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 2.625,
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 16; SM-S938B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
      // Every shot is a fresh install, so the service worker's one-time "Ready to play offline" note would cover the top
      // bar in each picture; the screens are the subject here (the e2e smoke keeps the worker).
      serviceWorkers: 'block',
    })
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console.error: ${m.text()}`)
    })
    if (shot.settings) {
      // Seed IndexedDB before the app boots: same database and key the app uses (client/src/save/db.ts).
      await page.addInitScript((settings) => {
        const req = indexedDB.open('gloamvault')
        req.onupgradeneeded = () => {
          req.result.createObjectStore('kv')
        }
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('kv', 'readwrite')
          tx.objectStore('kv').put({ version: 1, perfOverlay: false, frameMode: 'smooth', textSize: 'normal', reduceMotion: false, haptics: true, installCardDismissed: false, ...settings }, 'gloamvault/settings')
          tx.oncomplete = () => db.close()
        }
      }, shot.settings)
    }
    await page.goto(`${origin}${BASE}${shot.hash}`, { waitUntil: 'load' })
    try {
      await page.waitForSelector('html[data-ready="1"]', { timeout: 20_000 })
    } catch {
      problems.push(`${shot.name}: the app never signalled ready (data-ready)`)
    }
    await page.waitForTimeout(shot.settings?.perfOverlay ? 1400 : 500)
    if (shot.act) await shot.act(page)
    const file = join(OUT, `${shot.name}.png`)
    await page.screenshot({ path: file, type: 'png' })
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    if (scrollWidth > viewport.width) problems.push(`${shot.name}: horizontal scroll (${scrollWidth} > ${viewport.width})`)
    for (const e of errors) problems.push(`${shot.name}: ${e}`)
    written.push({ name: shot.name, file, width: viewport.width, height: viewport.height })
    console.log(`shot ${file}${errors.length ? ` (${errors.length} error(s))` : ''}`)
    await context.close()
  }
} finally {
  await browser?.close()
  await new Promise<void>((resolve) => server.httpServer.close(() => resolve()))
}

writeFileSync(join(OUT, 'index.json'), JSON.stringify({ at: new Date().toISOString(), shots: written, problems }, null, 2))
if (problems.length) {
  console.error(`shots: ${problems.length} problem(s)`)
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
console.log(`shots OK: ${written.length} written to ${OUT}/`)
