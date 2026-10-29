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
  /** A viewport other than the phone's (the acceptance matrix is shot at twice its size, to check details). */
  viewport?: { width: number; height: number }
  /** Settings to seed before load (so the overlay shows without taps). */
  settings?: Record<string, unknown>
  /** Actions after load. */
  act?: (page: import('@playwright/test').Page) => Promise<void>
}

const MATRIX_VIEWPORT = { width: 1784, height: 824 }
const PERF = { perfOverlay: true, installCardDismissed: true }
/** The ten Cellars templates (07 §2.2), each shot from its own camera with its kit. */
const CELLARS = ['storeroom', 'wine-vault', 'cistern', 'guardpost', 'kennels', 'cold-hearth', 'stairwell', 'strongroom', 'gallery', 'tap-room']

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
  // Phase 5: the heroes as 3D characters — the viewer (species × class × frame × tier, a close-up at the minimum
  // distance, gear off, a clip), the new hero's Look step, and the delve and a four-hero fight with mixed species.
  { name: 'viewer-dwarf-warden-F', hash: '#viewer=dwarf,warden,F' },
  { name: 'viewer-elf-ranger-S-slight', hash: '#viewer=elf,ranger,S&frame=slight&preset=2' },
  { name: 'viewer-orc-blade-S', hash: '#viewer=orc,blade,S&preset=1&yaw=-40' },
  { name: 'viewer-human-mender-F-slight', hash: '#viewer=human,mender,F&frame=slight&preset=2&skin=2' },
  { name: 'viewer-closeup-draconid', hash: '#viewer=draconid,arcanist,F&zoom=min&yaw=-30' },
  { name: 'viewer-halfling-gear-off', hash: '#viewer=halfling,shade,F&frame=slight&gear=0&preset=1' },
  { name: 'viewer-clip-cast', hash: '#viewer=human,arcanist,S&frame=slight&clip=Cast' },
  {
    name: 'new-hero-look',
    hash: '#new-hero',
    act: async (page) => {
      await page.getByTestId('nh-species-dwarf').click()
      await page.getByTestId('nh-next').click()
      await page.getByTestId('nh-class-warden').click()
      await page.getByTestId('nh-next').click()
      await page.getByTestId('nh-look-face-2').click()
      await page.waitForTimeout(2500)
    },
  },
  { name: 'delve-room-four', hash: '#delve=gravehollow&zone=1&seed=17&party=warden,ranger,mender,arcanist&species=dwarf,elf,human,draconid' },
  { name: 'delve-fight-four-perf', hash: '#delve=gravehollow&zone=1&seed=21&party=warden,blade,mender,arcanist&level=5&auto=1&species=dwarf,orc,elf,draconid', settings: { perfOverlay: true, installCardDismissed: true } },
  // The acceptance matrix: 36 species × class heroes, one clip, one instant, at twice the phone's size.
  { name: 'matrix-idle-F', hash: '#viewer=matrix&clip=Idle&tier=F&t=0', viewport: MATRIX_VIEWPORT },
  { name: 'matrix-idle-S', hash: '#viewer=matrix&clip=Idle&tier=S&t=0', viewport: MATRIX_VIEWPORT },
  { name: 'matrix-run-F', hash: '#viewer=matrix&clip=Run&tier=F&t=0.25', viewport: MATRIX_VIEWPORT },
  { name: 'matrix-run-S', hash: '#viewer=matrix&clip=Run&tier=S&t=0.25', viewport: MATRIX_VIEWPORT },
  { name: 'matrix-heavy-F', hash: '#viewer=matrix&clip=Attack_Heavy&tier=F&at=hit', viewport: MATRIX_VIEWPORT },
  { name: 'matrix-heavy-S', hash: '#viewer=matrix&clip=Attack_Heavy&tier=S&at=hit', viewport: MATRIX_VIEWPORT },
  { name: 'matrix-idle-S-slight', hash: '#viewer=matrix&clip=Idle&tier=S&frame=slight&t=0', viewport: MATRIX_VIEWPORT },
  // Phase 6: the dungeon in 3D. Every Cellars template from its own camera, built from the kit (07 §8.3 link 4) …
  ...CELLARS.map((t): Shot => ({ name: `room-cel-t-${t}`, hash: `#room=cel-t-${t}` })),
  // … monsters on the enemy marks and the party on theirs, the room as the light meter dims it …
  { name: 'room-cel-t-kennels-fight', hash: '#room=cel-t-kennels&monsters=giant-rat,giant-rat,plague-rat,warren-alpha&heroes=4' },
  { name: 'room-cel-t-guardpost-crew', hash: '#room=cel-t-guardpost&monsters=grinning-bruiser,grinning-cutpurse,grinning-crossbowman,grinning-hexer&heroes=2&light=40' },
  // … the Crypts and the Vault (their templates are written ahead of Phase 7 and open only here), and each kit sheet.
  { name: 'room-cry-t-chapel', hash: '#room=cry-t-chapel&monsters=skeleton-footman,bone-knight,skeleton-archer&heroes=2' },
  { name: 'room-cry-t-ossuary', hash: '#room=cry-t-ossuary' },
  { name: 'room-cry-t-reliquary', hash: '#room=cry-t-reliquary' },
  { name: 'room-vlt-t-sluice-hall', hash: '#room=vlt-t-sluice-hall&monsters=brine-ooze,deep-tentacle,vault-leech&heroes=2' },
  { name: 'room-vlt-t-throne-king', hash: '#room=vlt-t-throne&monsters=hollow-king&heroes=2' },
  // A gallery stop (title → Monsters & rooms → Rooms): the room's name, its place in the list, Prev / Next.
  { name: 'gallery-room', hash: '#room=vlt-t-drowned-chapel&heroes=2&monsters=sister-naesa,tidebound-acolyte,tidebound-blade&from=gallery' },
  { name: 'kit-cellars', hash: '#viewer=kit&zone=cellars' },
  { name: 'kit-crypts', hash: '#viewer=kit&zone=crypts' },
  { name: 'kit-vault', hash: '#viewer=kit&zone=vault' },
  // The monster lineups per zone (every manifest entry, playing Idle) and the pets.
  { name: 'monsters-cellars', hash: '#viewer=monsters&zone=cellars' },
  { name: 'monsters-crypts', hash: '#viewer=monsters&zone=crypts' },
  { name: 'monsters-vault', hash: '#viewer=monsters&zone=vault' },
  { name: 'monsters-pets', hash: '#viewer=monsters&zone=pets' },
  // A monster's clips (a tap plays the next: Move, then Attack1).
  {
    name: 'monsters-cellars-clips',
    hash: '#viewer=monsters&zone=cellars',
    act: async (page) => {
      const label = page.locator('[data-testid^="lineup-giant-rat"]').first()
      const box = await label.boundingBox()
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y - 40)
        await page.mouse.click(box.x + box.width / 2, box.y - 40)
      }
      await page.waitForTimeout(700)
    },
  },
  // The effects (sparks, element marks, heals, status rings, the death puff, the six Ultimates), each held at its peak.
  { name: 'fx-sheet', hash: '#viewer=fx&still=1' },
  // Fights with real monsters and the perf overlay: the most a Cellars fight holds for four heroes (six — four Giant Rats
  // and two Plague Rats in the cistern; two Bruisers, a Hexer and three rats on floor 3), and a four-hero fight with four
  // monsters (three Cellar Spiders and a Weaver).
  { name: 'delve-fight-swarm', hash: '#delve=gravehollow&zone=1&seed=19&party=warden,blade,mender,arcanist&level=5&auto=1&species=dwarf,orc,elf,draconid' },
  { name: 'delve-fight-swarm-perf', hash: '#delve=gravehollow&zone=1&seed=19&party=warden,blade,mender,arcanist&level=5&auto=1&species=dwarf,orc,elf,draconid', settings: PERF },
  { name: 'delve-fight-crew-perf', hash: '#delve=gravehollow&zone=3&seed=18&party=warden,blade,mender,arcanist&level=5&auto=1&species=dwarf,orc,elf,draconid', settings: PERF },
  { name: 'delve-fight-four-monsters-perf', hash: '#delve=gravehollow&zone=1&seed=3&party=warden,blade,mender,arcanist&level=5&auto=1&species=human,dwarf,elf,halfling', settings: PERF },
  // Phase 7 — the three zones with the overlay (D-113's check): a Crypts and a Vault fight, and the three new bosses in
  // their arenas (the room=boss link stands the party at the boss's door; auto=1 walks it in).
  { name: 'delve-crypts-fight-perf', hash: '#delve=gravehollow&zone=2&seed=17&party=warden,blade,mender,arcanist&auto=1&species=dwarf,orc,elf,draconid', settings: PERF },
  { name: 'delve-vault-fight-perf', hash: '#delve=gravehollow&zone=3&seed=17&party=warden,blade,mender,arcanist&auto=1&species=dwarf,orc,elf,draconid', settings: PERF },
  { name: 'boss-warden-perf', hash: '#delve=gravehollow-keep&floor=6&seed=5&party=warden,blade,mender,arcanist&level=9&room=boss&auto=1&species=human,dwarf,elf,halfling', settings: PERF },
  { name: 'boss-naesa-perf', hash: '#delve=gravehollow-keep&floor=7&seed=5&party=warden,blade,mender,arcanist&level=12&room=boss&auto=1&species=human,dwarf,elf,halfling', settings: PERF },
  { name: 'boss-king-perf', hash: '#delve=gravehollow-keep&floor=8&seed=5&party=warden,blade,mender,arcanist&level=14&room=boss&auto=1&species=human,dwarf,elf,halfling', settings: PERF },
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
    const viewport = shot.viewport ?? (shot.portrait ? { width: 412, height: 892 } : { width: 892, height: 412 })
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
