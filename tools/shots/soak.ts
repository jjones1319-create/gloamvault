/**
 * `node tools/shots/soak.ts [--minutes 30] [--skip-build] [--headed]`: the soak test of 10-TECH-PLAN §4 on desktop
 * Chrome. Builds the app (unless told not to), serves dist/ with `vite preview` (port 4173, or `GLOAMVAULT_PORT`), opens
 * `#autoplay=1&minutes=N` at the phone's landscape viewport — an ephemeral party of four playing delve after delve by
 * itself, rooms and fights — and reads the per-minute samples the page logs to `window.__gvSoak` (fps, CPU frame ms,
 * draw calls, triangles, geometries, textures, GPU estimate, JS heap, delves, rooms, fights). Writes them to
 * client/shots/soak.json and prints a summary: the frame time and the memory at the start and the end, and whether
 * either crept.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Browser } from '@playwright/test'
import { build, preview } from 'vite'

interface Sample {
  minute: number
  fps: number
  frameMs: number
  drawCalls: number
  triangles: number
  geometries: number
  textures: number
  gpuMb: number
  heapMb: number | null
  delves: number
  rooms: number
  fights: number
}

const args = process.argv.slice(2)
const opt = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback
}
const minutes = Math.max(1, Number(opt('minutes', '30')) || 30)
const PORT = Number(process.env.GLOAMVAULT_PORT ?? 4173)
const BASE = '/gloamvault/'
const OUT = join('client', 'shots')
mkdirSync(OUT, { recursive: true })

if (!args.includes('--skip-build')) {
  console.log('building…')
  await build({ configFile: 'vite.config.ts', logLevel: 'warn' })
}
const server = await preview({ configFile: 'vite.config.ts', preview: { port: PORT, strictPort: true, open: false }, logLevel: 'warn' })
const startFloor = Math.max(1, Number(opt('floor', '1')) || 1)
const url = `http://localhost:${PORT}${BASE}#autoplay=1&minutes=${minutes}${startFloor > 1 ? `&floor=${startFloor}` : ''}`
console.log(`soak: ${minutes} min at ${url}`)

let browser: Browser | null = null
const samples: Sample[] = []
const errors: string[] = []
let gpu = 'unknown'
try {
  // The desktop GPU (not the software rasteriser), and a JS heap Chrome reports precisely.
  browser = await chromium.launch({ channel: 'chrome', headless: !args.includes('--headed'), args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] })
  const context = await browser.newContext({ viewport: { width: 892, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`)
  })
  await page.goto(url, { waitUntil: 'load' })
  // Which GPU Chrome drew with (the numbers mean little on the software rasteriser).
  gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    return gl ? String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : 'no WebGL2'
  })
  console.log(`soak: drawing with ${gpu}`)
  const deadline = Date.now() + (minutes + 4) * 60_000
  while (Date.now() < deadline) {
    await page.waitForTimeout(20_000)
    const state = await page.evaluate(() => {
      const w = window as unknown as { __gvSoak?: Sample[]; __gvSoakDone?: boolean }
      return { samples: w.__gvSoak ?? [], done: w.__gvSoakDone === true }
    })
    for (const s of state.samples.slice(samples.length)) {
      samples.push(s)
      console.log(`min ${String(s.minute).padStart(2)}: ${s.fps} fps · ${s.frameMs.toFixed(2)} ms cpu · ${s.drawCalls} calls · ${(s.triangles / 1000).toFixed(1)}k tris · ${s.geometries} geo · ${s.textures} tex · ~${s.gpuMb} MB gpu · ${s.heapMb ?? '?'} MB js · ${s.delves} delves ${s.rooms} rooms ${s.fights} fights`)
    }
    if (state.done) break
  }
  await page.screenshot({ path: join(OUT, 'soak-end.png'), type: 'png' })
  await context.close()
} finally {
  await browser?.close()
  await new Promise<void>((resolve) => server.httpServer.close(() => resolve()))
}

const first = samples.slice(0, 3)
const last = samples.slice(-3)
const avg = (list: Sample[], f: (s: Sample) => number) => (list.length ? list.reduce((t, s) => t + f(s), 0) / list.length : 0)
const summary = {
  gpu,
  minutes: samples.length,
  fps: { start: avg(first, (s) => s.fps), end: avg(last, (s) => s.fps), min: Math.min(...samples.map((s) => s.fps)) },
  frameMs: { start: avg(first, (s) => s.frameMs), end: avg(last, (s) => s.frameMs), max: Math.max(...samples.map((s) => s.frameMs)) },
  heapMb: { start: avg(first, (s) => s.heapMb ?? 0), end: avg(last, (s) => s.heapMb ?? 0), max: Math.max(...samples.map((s) => s.heapMb ?? 0)) },
  gpuMb: { start: avg(first, (s) => s.gpuMb), end: avg(last, (s) => s.gpuMb) },
  geometries: { start: avg(first, (s) => s.geometries), end: avg(last, (s) => s.geometries) },
  drawCalls: { max: Math.max(...samples.map((s) => s.drawCalls)) },
  triangles: { max: Math.max(...samples.map((s) => s.triangles)) },
  played: last[last.length - 1] ? { delves: last[last.length - 1]!.delves, rooms: last[last.length - 1]!.rooms, fights: last[last.length - 1]!.fights } : null,
  errors: errors.slice(0, 20),
}
writeFileSync(join(OUT, 'soak.json'), JSON.stringify({ at: new Date().toISOString(), minutes, samples, summary }, null, 2))
console.log(`soak summary: ${JSON.stringify(summary)}`)
if (samples.length < Math.min(minutes, 2)) {
  console.error('soak: too few samples (did the page start the autoplay?)')
  process.exit(1)
}
