/**
 * Lint rule 70 (tools/lint/rules-b.ts): the real content passes, and deliberately broken copies of the lesson block fail
 * with rule 70 on the dungeon file. Each broken copy carries one break, so every message is checked on its own.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { lintCorpus, type LintResult } from './lint.ts'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
type Loose = Record<string, any>

const tempRoots: string[] = []
afterAll(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true })
})

const DUNGEON = 'content/dungeons/gravehollow-keep/dungeon.json'

function brokenCopy(mutate: (lesson: Loose) => void): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gloamvault-lint-b-'))
  tempRoots.push(root)
  fs.cpSync(path.join(repoRoot, 'content'), path.join(root, 'content'), { recursive: true })
  fs.mkdirSync(path.join(root, 'sim', 'src', 'skills'), { recursive: true })
  fs.cpSync(path.join(repoRoot, 'sim', 'src', 'skills', 'custom'), path.join(root, 'sim', 'src', 'skills', 'custom'), { recursive: true })
  const file = path.join(root, ...DUNGEON.split('/'))
  const json = JSON.parse(fs.readFileSync(file, 'utf8')) as Loose
  mutate(json.tutorial as Loose)
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`)
  return root
}

function rule70(r: LintResult): string[] {
  return r.failures.filter((f) => f.rule === 70).map((f) => `${f.file}: ${f.message}`)
}

describe('rule 70: the lesson floor', () => {
  it('passes on the real content', () => {
    expect(rule70(lintCorpus(repoRoot))).toEqual([])
  })

  it('fails an encounter that does not exist', () => {
    const hits = rule70(lintCorpus(brokenCopy((l) => (l.encounterId = 'no-such-pack'))))
    expect(hits.some((m) => m.startsWith(DUNGEON) && m.includes("'no-such-pack' is not an encounter"))).toBe(true)
  })

  it('fails an encounter of another floor', () => {
    const hits = rule70(lintCorpus(brokenCopy((l) => (l.encounterId = 'grave-watch'))))
    expect(hits.some((m) => m.includes("'grave-watch'"))).toBe(true)
  })

  it('fails a trap some starting heroes could never see', () => {
    // The Greased Stairs need Detection 14; a Perception-9 hero in Radiant light reads 13.
    const hits = rule70(lintCorpus(brokenCopy((l) => (l.trapIds = ['greased-stairs']))))
    expect(hits.some((m) => m.includes("'greased-stairs' needs Detection 14"))).toBe(true)
  })

  it('fails a trap of another zone and one the dungeon lacks', () => {
    const hits = rule70(lintCorpus(brokenCopy((l) => (l.trapIds = ['bone-scythe', 'no-such-trap']))))
    expect(hits.some((m) => m.includes("'bone-scythe' belongs to zone 'the-crypts'"))).toBe(true)
    expect(hits.some((m) => m.includes("'no-such-trap', which is not a trap"))).toBe(true)
  })

  it('fails a lesson on a boss floor', () => {
    const hits = rule70(lintCorpus(brokenCopy((l) => (l.floor = 3))))
    expect(hits.some((m) => m.includes('floor 3 carries a boss'))).toBe(true)
  })
})
