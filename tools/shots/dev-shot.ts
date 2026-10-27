/**
 * `node tools/shots/dev-shot.ts --port 5181 --hash "#town&demo=1" --out shots-dev/town.png [--tap "[data-testid=x]"]… [--wait 800]`
 *
 * One screenshot of a running `vite` dev server (`npx vite --port 5181 --strictPort`) at the landscape S25 Ultra
 * viewport (892 × 412 CSS px, DPR 2.625, D-052), for a screen pass to look at its own work while other passes run on
 * other ports. `--tap` (repeatable) clicks a selector after the app is ready, each followed by a short wait; the
 * page's errors and any horizontal scroll are printed and make the exit code 1.
 */
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
const opt = (name: string, fallback?: string): string | undefined => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const taps: string[] = []
args.forEach((a, i) => {
  if (a === '--tap' && args[i + 1]) taps.push(args[i + 1]!)
})
const port = Number(opt('port', '5173'))
const hash = opt('hash', '#title')!
const out = opt('out', 'shots-dev/shot.png')!
const wait = Number(opt('wait', '600'))
const portrait = args.includes('--portrait')

mkdirSync(dirname(out), { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const problems: string[] = []
try {
  const viewport = portrait ? { width: 412, height: 892 } : { width: 892, height: 412 }
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console.error: ${m.text()}`)
  })
  // A cold dev server serves hundreds of modules: on a busy machine the first load can take well over 30 s, so wait
  // for the document (not every module's 'load') and give both waits three minutes.
  await page.goto(`http://localhost:${port}/gloamvault/${hash}`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  try {
    await page.waitForSelector('html[data-ready="1"]', { timeout: 180_000 })
  } catch {
    problems.push('the app never signalled ready (data-ready)')
  }
  await page.waitForTimeout(wait)
  for (const sel of taps) {
    try {
      await page.locator(sel).first().click({ timeout: 5000 })
    } catch (e) {
      problems.push(`tap ${sel}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`)
    }
    await page.waitForTimeout(wait)
  }
  await page.screenshot({ path: out, type: 'png' })
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  if (scrollWidth > viewport.width) problems.push(`horizontal scroll (${scrollWidth} > ${viewport.width})`)
  await context.close()
} finally {
  await browser.close()
}
console.log(`wrote ${out}`)
for (const p of problems) console.error(`  problem: ${p}`)
process.exit(problems.length ? 1 : 0)
