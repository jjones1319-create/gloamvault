/**
 * Node-side content loading for the tools and the tests: walks content/ with node:fs, resolves each file's kind
 * from its path (sim/src/content.ts `kindForContentPath`) and hands the parsed JSON to `buildContent`. The sim
 * itself never touches the file system; this is the tools' side of that line (10-TECH-PLAN §3).
 */
import fs from 'node:fs'
import path from 'node:path'
import { buildContent, kindForContentPath, type Content, type ContentKind, type RawContentFile } from '../../sim/src/content.ts'

/** Top-level folders under content/ that hold no content records. */
const SKIP_TOP_LEVEL: ReadonlySet<string> = new Set(['schemas', 'examples', 'saves'])

function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}

function readJson(abs: string): unknown {
  let text: string
  try {
    text = fs.readFileSync(abs, 'utf8')
  } catch (e) {
    throw new Error(`${toPosix(abs)}: cannot read: ${e instanceof Error ? e.message : String(e)}`)
  }
  try {
    return JSON.parse(text) as unknown
  } catch (e) {
    throw new Error(`${toPosix(abs)}: invalid JSON: ${e instanceof Error ? e.message : String(e)}`)
  }
}

function rawFile(kind: ContentKind, filePath: string, json: unknown, dungeonId: string | undefined): RawContentFile {
  return dungeonId === undefined ? { kind, path: filePath, json } : { kind, path: filePath, json, dungeonId }
}

function compareNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Loads the real corpus from `<dir>` (default `content`, relative to the working directory) into a `Content`. */
export function loadContentDir(dir = 'content'): Content {
  return buildContent(readContentFiles(dir))
}

/**
 * The corpus as raw files, in sorted path order, before indexing: what `loadContentDir` builds from and what the
 * Unity bundle carries (tools/unity/bundle.ts; the bridge builds the same `Content` inside the app).
 */
export function readContentFiles(dir = 'content'): RawContentFile[] {
  const root = path.resolve(dir)
  const files: RawContentFile[] = []
  const visit = (d: string, depth: number): void => {
    const entries = fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => compareNames(a.name, b.name))
    for (const entry of entries) {
      const abs = path.join(d, entry.name)
      if (entry.isDirectory()) {
        if (depth === 0 && SKIP_TOP_LEVEL.has(entry.name)) continue
        visit(abs, depth + 1)
        continue
      }
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue
      const rel = toPosix(path.relative(root, abs))
      const located = kindForContentPath(rel)
      if (located === null) continue
      files.push(rawFile(located.kind, rel, readJson(abs), located.dungeonId))
    }
  }
  visit(root, 0)
  return files
}

/**
 * Schema names an example file name may start with, as the linter resolves them: the longest match wins
 * (`monster-boss.example.json` is a monster, `item-set.example.json` an item-set). `hero` is a save record and
 * `common` has no example; both map to null. Templates have no example file (they live inside the dungeon example).
 */
const EXAMPLE_SCHEMA_NAMES: ReadonlyMap<string, ContentKind | null> = new Map<string, ContentKind | null>([
  ['affix', 'affix'],
  ['chest', 'chest'],
  ['class', 'class'],
  ['common', null],
  ['contract', 'contract'],
  ['dungeon', 'dungeon'],
  ['elite-affix', 'elite-affix'],
  ['encounter', 'encounter'],
  ['hero', null],
  ['item', 'item'],
  ['item-set', 'item-set'],
  ['loot-table', 'loot-table'],
  ['monster', 'monster'],
  ['pet', 'pet'],
  ['skill', 'skill'],
  ['species', 'species'],
  ['status', 'status'],
  ['tuning', 'tuning'],
  ['wayfarer', 'wayfarer'],
])

/** The content kind of an example file by its name, or null when it is not content (hero, common, not an example). */
export function kindForExampleFile(fileName: string): ContentKind | null {
  const suffix = '.example.json'
  if (!fileName.endsWith(suffix)) return null
  const base = fileName.slice(0, -suffix.length)
  let bestName: string | null = null
  for (const name of EXAMPLE_SCHEMA_NAMES.keys()) {
    if ((base === name || base.startsWith(`${name}-`)) && (bestName === null || name.length > bestName.length)) bestName = name
  }
  return bestName === null ? null : (EXAMPLE_SCHEMA_NAMES.get(bestName) ?? null)
}

/**
 * Assembles a corpus from `content/examples/*.example.json`, each placed at its kind, for tests that want one of
 * everything. Hero and common examples are skipped; the dungeon example's templates stay inline.
 */
export function loadExamplesAsContent(dir = path.join('content', 'examples')): Content {
  const root = path.resolve(dir)
  const files: RawContentFile[] = []
  for (const name of fs.readdirSync(root).sort(compareNames)) {
    const kind = kindForExampleFile(name)
    if (kind === null) continue
    const abs = path.join(root, name)
    const json = readJson(abs)
    const dungeonId = kind === 'dungeon' && typeof json === 'object' && json !== null ? (json as { id?: unknown }).id : undefined
    files.push(rawFile(kind, toPosix(path.join(dir, name)), json, typeof dungeonId === 'string' ? dungeonId : undefined))
  }
  return buildContent(files)
}
