/**
 * The linter as a pure function: `lintCorpus(rootDir, options)` loads `<rootDir>/content`, validates every file with
 * ajv 2020-12 (README "npm run lint" steps 1–3), runs the cross-file rules (step 4) and returns a LintResult that
 * `formatResult` prints exactly as step 5 describes. Nothing is written.
 */
import Ajv2020Import from 'ajv/dist/2020.js'
import type { ErrorObject, ValidateFunction } from 'ajv'
import { DRAFT_2020, SCHEMA_ID_BASE, loadCorpus, schemaRefFor, type ContentFile, type Corpus, type FileRole, type LintOptions } from './corpus.ts'
import { isObj } from './json.ts'
import { runRules, type Failure } from './rules.ts'

// Under Node ESM the default export of ajv's CJS build is the class; some loaders wrap it in { default }.
const Ajv2020 = (Ajv2020Import as unknown as { default?: typeof Ajv2020Import }).default ?? Ajv2020Import

export type { Failure } from './rules.ts'
export type { LintOptions } from './corpus.ts'

export type FileResult = {
  /** Repo-relative path with forward slashes. */
  path: string
  role: 'schema' | FileRole
  kind: string | null
  ok: boolean
  /** Formatted problems: ajv errors as `<instancePath> <message> <params>`, or one structural message. */
  errors: string[]
}

export type LintResult = {
  files: FileResult[]
  /** Cross-file rule failures (README rules 1–30, plus 31 and 32). */
  failures: Failure[]
  /** Advisory lines that never fail the run (rule 7's "two techniques per dungeon"). */
  warnings: Failure[]
  schemaCount: number
  /** Content + example (+ save) files validated. */
  fileCount: number
  /** Files that failed validation plus cross-file failures. */
  failureCount: number
  ok: boolean
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function formatAjvError(e: ErrorObject): string {
  return `${e.instancePath || '/'} ${e.message ?? ''} ${JSON.stringify(e.params)}`
}

type Compiled = { results: FileResult[]; validators: Map<string, ValidateFunction> }

// Compiling the 18 schemas costs most of a run; identical schema sets (the tests' temp copies) reuse the validators.
const compiledCache = new Map<string, Compiled>()
const COMPILED_CACHE_LIMIT = 4

function cloneResults(results: FileResult[]): FileResult[] {
  return results.map((r) => ({ ...r, errors: [...r.errors] }))
}

/** Steps 1–2: ajv with the README's options; $id/$schema checks; addSchema all first, then compile each. */
function compileSchemas(corpus: Corpus): Compiled {
  const key = corpus.schemas.map((s) => `${s.name}\u0000${s.parseError ?? ''}\u0000${JSON.stringify(s.json ?? null)}`).join('\u0001')
  const hit = compiledCache.get(key)
  if (hit) return { results: cloneResults(hit.results), validators: hit.validators }

  const ajv = new Ajv2020({ strict: true, allErrors: true, allowUnionTypes: false, strictRequired: false })
  const results: FileResult[] = []
  const byName = new Map<string, FileResult>()
  for (const s of corpus.schemas) {
    const r: FileResult = { path: s.path, role: 'schema', kind: s.name, ok: false, errors: [] }
    results.push(r)
    byName.set(s.name, r)
    if (s.parseError !== undefined) {
      r.errors.push(s.parseError)
      continue
    }
    if (!isObj(s.json)) {
      r.errors.push('schema is not a JSON object')
      continue
    }
    const expectedId = `${SCHEMA_ID_BASE}${s.name}.schema.json`
    if (s.json.$id !== expectedId) r.errors.push(`$id is ${JSON.stringify(s.json.$id ?? null)}, expected ${expectedId}`)
    if (s.json.$schema !== DRAFT_2020) r.errors.push(`$schema is ${JSON.stringify(s.json.$schema ?? null)}, expected ${DRAFT_2020}`)
    try {
      ajv.addSchema(s.json, expectedId)
    } catch (e) {
      r.errors.push(`addSchema: ${errorMessage(e)}`)
    }
  }

  const validators = new Map<string, ValidateFunction>()
  for (const s of corpus.schemas) {
    const r = byName.get(s.name)
    if (!r || r.errors.length > 0) continue
    try {
      const v = ajv.getSchema(`${SCHEMA_ID_BASE}${s.name}.schema.json`)
      if (!v) throw new Error('no validator returned')
      validators.set(s.name, v)
    } catch (e) {
      r.errors.push(`compile: ${errorMessage(e)}`)
    }
  }
  if (validators.has('dungeon')) {
    try {
      const v = ajv.getSchema(schemaRefFor('template'))
      if (!v) throw new Error('no validator returned')
      validators.set('template', v)
    } catch (e) {
      byName.get('dungeon')?.errors.push(`compile #/$defs/template: ${errorMessage(e)}`)
    }
  }

  if (compiledCache.size >= COMPILED_CACHE_LIMIT) {
    const oldest = compiledCache.keys().next().value
    if (oldest !== undefined) compiledCache.delete(oldest)
  }
  compiledCache.set(key, { results: cloneResults(results), validators })
  return { results, validators }
}

export function lintCorpus(rootDir: string, options: LintOptions = {}): LintResult {
  const corpus = loadCorpus(rootDir, options)
  const { results: schemaResults, validators } = compileSchemas(corpus)
  const files: FileResult[] = [...schemaResults]

  // Every schema but common needs at least one example.
  for (const r of schemaResults) {
    if (r.kind === 'common') continue
    if (!corpus.examples.some((e) => e.kind === r.kind)) {
      r.errors.push(`no example: expected content/examples/${r.kind}.example.json (or ${r.kind}-<variant>.example.json)`)
    }
    r.ok = r.errors.length === 0
  }
  for (const r of schemaResults) if (r.kind === 'common') r.ok = r.errors.length === 0

  // Step 3: validate content, examples and saves against their kind's schema.
  const validate = (f: ContentFile): FileResult => {
    const r: FileResult = { path: f.path, role: f.role, kind: f.kind, ok: false, errors: [] }
    if (f.parseError !== undefined) {
      r.errors.push(f.parseError)
      return r
    }
    if (f.kind === null) {
      r.errors.push(
        f.role === 'example'
          ? 'no schema: the file name must start with a schema name (<kind>.example.json or <kind>-<variant>.example.json)'
          : 'no schema for this path: not a content folder the README layout lists',
      )
      return r
    }
    const v = validators.get(f.kind)
    if (!v) {
      r.errors.push(`schema ${schemaRefFor(f.kind)} did not compile`)
      return r
    }
    if (!v(f.json)) for (const e of v.errors ?? []) r.errors.push(formatAjvError(e))
    r.ok = r.errors.length === 0
    return r
  }
  for (const f of corpus.content) files.push(validate(f))
  for (const f of corpus.examples) files.push(validate(f))
  for (const f of corpus.saves) files.push(validate(f))

  // Step 4: the cross-file rules over the real content (and the saves), never the examples.
  const { failures, warnings } = runRules(corpus, new Set(options.skipRules ?? []))
  const byFileThenRule = (a: Failure, b: Failure): number => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.rule - b.rule)
  failures.sort(byFileThenRule)
  warnings.sort(byFileThenRule)

  const failedFiles = files.filter((f) => !f.ok).length
  const failureCount = failedFiles + failures.length
  return {
    files,
    failures,
    warnings,
    schemaCount: corpus.schemas.length,
    fileCount: corpus.content.length + corpus.examples.length + corpus.saves.length,
    failureCount,
    ok: failureCount === 0,
  }
}

/** Step 5's output: one line per file, ajv errors indented, cross-file failures, the final line. */
export function formatResult(result: LintResult): string {
  const lines: string[] = []
  for (const f of result.files) {
    lines.push(`${f.ok ? 'ok' : 'FAIL'} ${f.path}`)
    for (const e of f.errors) lines.push(`  ${e}`)
  }
  for (const x of result.failures) lines.push(`${x.file}: ${x.rule}. ${x.message}`)
  for (const w of result.warnings) lines.push(`warning ${w.file}: ${w.rule}. ${w.message}`)
  lines.push(result.ok ? `ALL GOOD: ${result.schemaCount} schemas, ${result.fileCount} files` : `${result.failureCount} failure(s)`)
  return lines.join('\n')
}
