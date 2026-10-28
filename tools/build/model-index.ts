/**
 * `node tools/build/model-index.ts` — writes client/src/scene/characters/modelIndex.json: every file under
 * client/public/models/ with a short content hash. The client builds each model URL as `models/<path>?v=<hash>`
 * because models are runtime-cached CacheFirst by the service worker (vite.config.ts): without the hash a rebuilt
 * .glb would never reach a phone that already has the old one. The index is also the list of files that exist, so
 * the client never requests a model that is not there (a 404 is a console error on the phone and in the shots).
 *
 * vite.config.ts runs `writeModelIndex()` at the start of every build and dev server (and again in dev when a model
 * changes), so the index cannot go stale; the file is committed so the typecheck has it on a fresh clone.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MODELS_DIR = join('client', 'public', 'models')
export const INDEX_FILE = join('client', 'src', 'scene', 'characters', 'modelIndex.json')
/** What the client may load from models/ (review renders and sources stay out of the index). */
const KINDS = /\.(glb|gltf|bin|json|png|webp|ktx2)$/i

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (KINDS.test(name)) out.push(p)
  }
}

/** `{ "hero/hero_broad.glb": "3f9a0c21d4", … }`, sorted by path. */
export function buildModelIndex(root = process.cwd()): Record<string, string> {
  const dir = resolve(root, MODELS_DIR)
  const files: string[] = []
  walk(dir, files)
  const index: Record<string, string> = {}
  for (const f of files) {
    const rel = relative(dir, f).split(sep).join('/')
    index[rel] = createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 10)
  }
  return index
}

/** Writes the index when it changed; true when the file was (re)written. */
export function writeModelIndex(root = process.cwd()): boolean {
  const file = resolve(root, INDEX_FILE)
  const json = `${JSON.stringify(buildModelIndex(root), null, 2)}\n`
  if (existsSync(file) && readFileSync(file, 'utf8') === json) return false
  writeFileSync(file, json)
  return true
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const changed = writeModelIndex()
  const n = Object.keys(buildModelIndex()).length
  console.log(`model index: ${n} file(s) ${changed ? 'written to' : 'unchanged in'} ${INDEX_FILE}`)
}
