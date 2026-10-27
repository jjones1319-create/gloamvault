/**
 * Assembles the Phase 2 fixture corpus (12-ROADMAP Phase 2 "done when"): a temporary `<root>/content` made of the
 * real `content/schemas`, `content/examples`, `content/statuses` and `content/tuning.json`, with the records under
 * `sim/test/fixtures/content/` copied on top. The linter (`lintCorpus(root, { skipRules })`) and the sim's loader
 * (`loadContentDir(path.join(root, 'content'))`) both read that folder; nothing in the repo is touched.
 * The caller removes the returned root when done (`fs.rmSync(root, { recursive: true, force: true })`).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
export const fixtureContentDir = path.join(repoRoot, 'sim', 'test', 'fixtures', 'content')

/**
 * Linter rules a fixture corpus cannot satisfy (content/README.md "Gating"): 4 (45 skills per class), 10 (every
 * role in a family), 14 (exactly twelve elite affixes). Every other rule applies to the fixture as written.
 */
export const FIXTURE_SKIP_RULES: readonly number[] = [4, 10, 14]

/**
 * Rule failures the fixture carries on purpose and the test asserts are the only ones: the Cellars boss sits on the
 * fixture dungeon's last floor (F3 is the last floor written), so rule 11 reads her as a final boss and asks for
 * three phases; 06 §3.1 gives the zone boss two.
 */
export const FIXTURE_KNOWN_FAILURES: ReadonlyArray<{ file: string; rule: number; message: RegExp }> = [
  { file: 'content/monsters/captain-vexa-marrow.json', rule: 11, message: /final boss has 2 phases, expected 3/ },
]

export function assembleFixtureCorpus(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gloamvault-fixture-'))
  const content = path.join(root, 'content')
  fs.mkdirSync(content, { recursive: true })
  const real = path.join(repoRoot, 'content')
  for (const dir of ['schemas', 'examples', 'statuses']) {
    fs.cpSync(path.join(real, dir), path.join(content, dir), { recursive: true })
  }
  fs.copyFileSync(path.join(real, 'tuning.json'), path.join(content, 'tuning.json'))
  fs.cpSync(fixtureContentDir, content, { recursive: true })
  return root
}

/** Every `.json` under a folder, as repo-style forward-slash paths relative to it; [] when the folder is missing. */
export function listJson(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const out: string[] = []
  const visit = (d: string): void => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const abs = path.join(d, entry.name)
      if (entry.isDirectory()) visit(abs)
      else if (entry.isFile() && entry.name.endsWith('.json')) out.push(path.relative(dir, abs).split(path.sep).join('/'))
    }
  }
  visit(dir)
  return out
}
