/**
 * The client's side of content loading (10-TECH-PLAN §3): Vite bundles every content JSON at build time through
 * `import.meta.glob`, the path under content/ gives each file its kind, and the sim's pure `buildContent` indexes
 * them. Schemas, examples and saves are excluded from the glob so they never reach the bundle; anything else the
 * layout does not name (README.md is not JSON anyway) is skipped by `kindForContentPath` returning null.
 */
import { buildContent, kindForContentPath, type Content, type RawContentFile } from '../../../sim/src/content.ts'

const modules: Record<string, unknown> = import.meta.glob(
  ['../../../content/**/*.json', '!../../../content/schemas/**', '!../../../content/examples/**', '!../../../content/saves/**'],
  { eager: true, import: 'default' },
)

const CONTENT_MARKER = '/content/'

/** The path under content/ of a glob key such as `../../../content/statuses/bleed.json`. */
function pathUnderContent(globKey: string): string {
  const i = globKey.lastIndexOf(CONTENT_MARKER)
  return i === -1 ? globKey : globKey.slice(i + CONTENT_MARKER.length)
}

let cached: Content | undefined

/** The whole content bundle, built once per page load from the JSON Vite compiled in. */
export function loadContent(): Content {
  if (cached !== undefined) return cached
  const files: RawContentFile[] = []
  for (const globKey of Object.keys(modules).sort()) {
    const rel = pathUnderContent(globKey)
    const located = kindForContentPath(rel)
    if (located === null) continue
    const json = modules[globKey]
    files.push(located.dungeonId === undefined ? { kind: located.kind, path: rel, json } : { kind: located.kind, path: rel, json, dungeonId: located.dungeonId })
  }
  cached = buildContent(files)
  return cached
}
