/**
 * Loads the content corpus for the linter: the schemas, every content file (kind resolved from its folder),
 * the examples (kind resolved from the file name) and, on request, hero save records.
 * Pure reads; nothing is written. Paths are reported relative to the repo root with forward slashes.
 */
import fs from 'node:fs'
import path from 'node:path'
import { isObj, str, type Json } from './json.ts'

export const SCHEMA_ID_BASE = 'https://gloamvault.dev/schemas/'
export const DRAFT_2020 = 'https://json-schema.org/draft/2020-12/schema'

/** Every content kind. Each is a schema name except `template` (dungeon.schema.json#/$defs/template). */
export type ContentKind =
  | 'class'
  | 'species'
  | 'skill'
  | 'item'
  | 'affix'
  | 'item-set'
  | 'monster'
  | 'elite-affix'
  | 'dungeon'
  | 'template'
  | 'encounter'
  | 'pet'
  | 'chest'
  | 'loot-table'
  | 'contract'
  | 'status'
  | 'tuning'
  | 'hero'

export type FileRole = 'content' | 'example' | 'save'

export type SchemaFile = {
  /** Repo-relative path, e.g. content/schemas/class.schema.json */
  path: string
  /** Schema name, e.g. class */
  name: string
  json: Json | undefined
  parseError?: string
}

export type ContentFile = {
  /** Repo-relative path with forward slashes. */
  path: string
  role: FileRole
  /** null when the path maps to no kind the README lists. */
  kind: ContentKind | null
  /** The $id (plus fragment for templates) the file validates against; null with kind null. */
  schemaRef: string | null
  json: Json | undefined
  parseError?: string
  /** Path segments under content/ for content files; [] for examples and saves. */
  segments: string[]
}

export type Corpus = {
  rootDir: string
  schemas: SchemaFile[]
  /** Schema names (file name without .schema.json), sorted. */
  schemaNames: string[]
  content: ContentFile[]
  examples: ContentFile[]
  saves: ContentFile[]
  /** Content files by kind (content role only; saves are in `saves`). */
  byKind: Map<ContentKind, ContentFile[]>
}

export type LintOptions = {
  /** true: lint content/saves/*.json when that folder exists; a string: a file or folder of hero records. */
  saves?: string | boolean
}

export function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}

export function relPath(rootDir: string, abs: string): string {
  return toPosix(path.relative(rootDir, abs))
}

export function readJsonFile(abs: string): { json?: Json; error?: string } {
  let text: string
  try {
    text = fs.readFileSync(abs, 'utf8')
  } catch (e) {
    return { error: `cannot read: ${e instanceof Error ? e.message : String(e)}` }
  }
  try {
    return { json: JSON.parse(text) as Json }
  } catch (e) {
    return { error: `invalid JSON: ${e instanceof Error ? e.message : String(e)}` }
  }
}

/** The $id a kind validates against. */
export function schemaRefFor(kind: ContentKind): string {
  if (kind === 'template') return `${SCHEMA_ID_BASE}dungeon.schema.json#/$defs/template`
  return `${SCHEMA_ID_BASE}${kind}.schema.json`
}

const FOLDER_KINDS: Record<string, ContentKind> = {
  classes: 'class',
  species: 'species',
  affixes: 'affix',
  sets: 'item-set',
  monsters: 'monster',
  'elite-affixes': 'elite-affix',
  encounters: 'encounter',
  pets: 'pet',
  chests: 'chest',
  'loot-tables': 'loot-table',
  contracts: 'contract',
  statuses: 'status',
}

/**
 * The kind of a content file from its path segments under content/ (README "Layout"):
 * tuning.json; <kind-folder>/<id>.json; skills/<class>/<id>.json; items/<kind>/<id>.json;
 * dungeons/<d>/dungeon.json; dungeons/<d>/templates/<id>.json. Anything else is null.
 */
export function kindForContentPath(segments: string[]): ContentKind | null {
  const [first, second, third, fourth] = segments
  if (first === undefined) return null
  if (segments.length === 1) return first === 'tuning.json' ? 'tuning' : null
  if (segments.length === 2) return FOLDER_KINDS[first] ?? null
  if (segments.length === 3) {
    if (first === 'skills') return 'skill'
    if (first === 'items') return 'item'
    if (first === 'dungeons' && third === 'dungeon.json') return 'dungeon'
    return null
  }
  if (segments.length === 4 && first === 'dungeons' && third === 'templates' && second !== undefined && fourth !== undefined) {
    return 'template'
  }
  return null
}

/** An example's kind: the longest schema name its file name starts with (`monster-boss` is a `monster`). */
export function kindForExample(fileName: string, schemaNames: string[]): ContentKind | null {
  if (!fileName.endsWith('.example.json')) return null
  const base = fileName.slice(0, -'.example.json'.length)
  let best: string | null = null
  for (const name of schemaNames) {
    if (name === 'common') continue
    if (base === name || base.startsWith(`${name}-`)) {
      if (best === null || name.length > best.length) best = name
    }
  }
  return best as ContentKind | null
}

function listJsonFiles(dir: string, skipDirs: ReadonlySet<string>): string[] {
  const out: string[] = []
  const visit = (d: string, depth: number): void => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const abs = path.join(d, entry.name)
      if (entry.isDirectory()) {
        if (depth === 0 && skipDirs.has(entry.name)) continue
        visit(abs, depth + 1)
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        out.push(abs)
      }
    }
  }
  visit(dir, 0)
  return out.sort()
}

function loadFile(rootDir: string, abs: string, role: FileRole, kind: ContentKind | null, segments: string[]): ContentFile {
  const read = readJsonFile(abs)
  const file: ContentFile = {
    path: relPath(rootDir, abs),
    role,
    kind,
    schemaRef: kind ? schemaRefFor(kind) : null,
    json: read.json,
    segments,
  }
  if (read.error !== undefined) file.parseError = read.error
  return file
}

/** Loads schemas, content, examples and (optionally) saves under `<rootDir>/content`. */
export function loadCorpus(rootDir: string, options: LintOptions = {}): Corpus {
  const contentDir = path.join(rootDir, 'content')
  const schemasDir = path.join(contentDir, 'schemas')
  const examplesDir = path.join(contentDir, 'examples')

  const schemas: SchemaFile[] = []
  if (fs.existsSync(schemasDir)) {
    for (const name of fs.readdirSync(schemasDir).sort()) {
      if (!name.endsWith('.schema.json')) continue
      const abs = path.join(schemasDir, name)
      const read = readJsonFile(abs)
      const schema: SchemaFile = { path: relPath(rootDir, abs), name: name.slice(0, -'.schema.json'.length), json: read.json }
      if (read.error !== undefined) schema.parseError = read.error
      schemas.push(schema)
    }
  }
  const schemaNames = schemas.map((s) => s.name).sort()

  const content: ContentFile[] = []
  const byKind = new Map<ContentKind, ContentFile[]>()
  for (const abs of listJsonFiles(contentDir, new Set(['schemas', 'examples', 'saves']))) {
    const segments = toPosix(path.relative(contentDir, abs)).split('/')
    const kind = kindForContentPath(segments)
    const file = loadFile(rootDir, abs, 'content', kind, segments)
    content.push(file)
    if (kind) {
      const list = byKind.get(kind) ?? []
      list.push(file)
      byKind.set(kind, list)
    }
  }

  const examples: ContentFile[] = []
  if (fs.existsSync(examplesDir)) {
    for (const name of fs.readdirSync(examplesDir).sort()) {
      if (!name.endsWith('.json')) continue
      const abs = path.join(examplesDir, name)
      examples.push(loadFile(rootDir, abs, 'example', kindForExample(name, schemaNames), []))
    }
  }

  const saves: ContentFile[] = []
  if (options.saves !== undefined && options.saves !== false) {
    let target: string | null = null
    if (options.saves === true) {
      const dir = path.join(contentDir, 'saves')
      if (fs.existsSync(dir)) target = dir
    } else {
      target = path.resolve(rootDir, options.saves)
    }
    if (target !== null) {
      let files: string[] = []
      try {
        files = fs.statSync(target).isDirectory() ? listJsonFiles(target, new Set()) : [target]
      } catch {
        files = [target]
      }
      for (const abs of files) saves.push(loadFile(rootDir, abs, 'save', 'hero', []))
    }
  }

  return { rootDir, schemas, schemaNames, content, examples, saves, byKind }
}

/** True when the value is a record with a string id (the shape every content file but tuning has). */
export function hasId(json: Json | undefined): json is { [key: string]: Json } & { id: string } {
  return isObj(json) && str(json.id) !== undefined
}
