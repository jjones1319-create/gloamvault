/**
 * `npm run check:build` (part of `npm run verify`, after `build`): the bundle and precache budgets of
 * 10-TECH-PLAN §7 read from dist/:
 *   - app code (every dist/assets/*.js but the content chunk, gzipped) ≤ 600 KB, and the content data (the
 *     content-*.js chunk the game's JSON compiles to) ≤ 300 KB on its own budget (D-129: content grows with every dungeon)
 *   - the service-worker precache ≤ 8 MB, and no 3D model (models/) or audio sample (audio/) is precached
 *   - the manifest is landscape, fullscreen-capable, and its id / scope / start_url are the GitHub Pages base
 * Runs on Node 24 directly.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const DIST = 'dist'
const BASE = '/gloamvault/'
const JS_LIMIT = 600 * 1024
const CONTENT_LIMIT = 300 * 1024
const PRECACHE_LIMIT = 8 * 1024 * 1024

let failures = 0
function fail(msg: string): void {
  console.error(`check:build FAIL: ${msg}`)
  failures++
}
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`

if (!existsSync(DIST)) {
  fail('dist/ is missing; run npm run build first')
  process.exit(1)
}

// 1. App JavaScript, gzipped.
const assets = join(DIST, 'assets')
const jsFiles = existsSync(assets) ? readdirSync(assets).filter((f) => f.endsWith('.js')) : []
let jsBytes = 0
let contentBytes = 0
const perChunk: string[] = []
for (const f of jsFiles) {
  const gz = gzipSync(readFileSync(join(assets, f))).length
  if (f.startsWith('content-')) contentBytes += gz
  else jsBytes += gz
  perChunk.push(`  ${f.padEnd(34)} ${kb(gz).padStart(10)}`)
}
console.log(`app code gzipped: ${kb(jsBytes)}; content data ${kb(contentBytes)}; ${jsFiles.length} chunks (limits ${kb(JS_LIMIT)} and ${kb(CONTENT_LIMIT)})`)
console.log(perChunk.join('\n'))
if (jsBytes > JS_LIMIT) fail(`app code is ${kb(jsBytes)} gzipped, over ${kb(JS_LIMIT)}`)
if (contentBytes > CONTENT_LIMIT) fail(`content data is ${kb(contentBytes)} gzipped, over ${kb(CONTENT_LIMIT)}`)

// 2. The precache list that vite-plugin-pwa (generateSW) wrote into sw.js.
const sw = join(DIST, 'sw.js')
if (!existsSync(sw)) fail('dist/sw.js is missing (vite-plugin-pwa did not run)')
else {
  const text = readFileSync(sw, 'utf8')
  const urls: string[] = []
  for (const m of text.matchAll(/["']?url["']?\s*:\s*"([^"]+)"/g)) urls.push(m[1]!)
  if (urls.length === 0) fail('no precache entries found in sw.js')
  let total = 0
  for (const url of urls) {
    const clean = url.split('?')[0]!
    const p = join(DIST, clean)
    if (existsSync(p)) total += statSync(p).size
    if (/(^|\/)models\//.test(clean)) fail(`a 3D model is precached: ${url} (models are runtime-cached, 10 §2)`)
    if (/(^|\/)audio\/.+\.(ogg|opus)$/.test(clean)) fail(`an audio sample is precached: ${url} (audio is runtime-cached per piece, Phase 8)`)
  }
  console.log(`precache: ${urls.length} entries, ${kb(total)} (limit ${kb(PRECACHE_LIMIT)})`)
  if (total > PRECACHE_LIMIT) fail(`the precache is ${kb(total)}, over ${kb(PRECACHE_LIMIT)}`)
}

// 3. The manifest.
const manifestPath = join(DIST, 'manifest.webmanifest')
if (!existsSync(manifestPath)) fail('dist/manifest.webmanifest is missing')
else {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
  if (manifest.orientation !== 'landscape') fail(`manifest orientation is ${String(manifest.orientation)}, expected landscape (D-003)`)
  if (manifest.display !== 'fullscreen') fail(`manifest display is ${String(manifest.display)}, expected fullscreen`)
  for (const key of ['id', 'scope', 'start_url']) {
    if (manifest[key] !== BASE) fail(`manifest ${key} is ${String(manifest[key])}, expected ${BASE} (D-040)`)
  }
  const icons = (manifest.icons as { src: string }[] | undefined) ?? []
  for (const icon of icons) {
    if (!existsSync(join(DIST, icon.src))) fail(`manifest icon is missing from dist: ${icon.src}`)
  }
  console.log(`manifest: ${String(manifest.name)} · ${String(manifest.display)} · ${String(manifest.orientation)} · ${icons.length} icons`)
}

if (failures) {
  console.error(`check:build: ${failures} failure(s)`)
  process.exit(1)
}
console.log('check:build OK')
