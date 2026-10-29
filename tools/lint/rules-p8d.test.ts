/**
 * Lint rules 80–81 (tools/lint/rules-p8d.ts): the real content passes, and deliberately broken copies fail — a class's
 * default AI rule naming a relic that does not exist or a skill of another class, a clause the parser drops, and a
 * champion-HP-by-zone table with a dungeon or a percent that cannot be.
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

/** A copy of content/ (and the custom hooks the linter checks) with one file changed. */
function brokenCopy(file: string, mutate: (json: Loose) => void): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gloamvault-lint-p8d-'))
  tempRoots.push(root)
  fs.cpSync(path.join(repoRoot, 'content'), path.join(root, 'content'), { recursive: true })
  fs.mkdirSync(path.join(root, 'sim', 'src', 'skills'), { recursive: true })
  fs.cpSync(path.join(repoRoot, 'sim', 'src', 'skills', 'custom'), path.join(root, 'sim', 'src', 'skills', 'custom'), { recursive: true })
  const target = path.join(root, ...file.split('/'))
  const json = JSON.parse(fs.readFileSync(target, 'utf8')) as Loose
  mutate(json)
  fs.writeFileSync(target, `${JSON.stringify(json, null, 2)}\n`)
  return root
}

const hits = (r: LintResult, rule: number): string[] => r.failures.filter((f) => f.rule === rule).map((f) => `${f.file}: ${f.message}`)

describe('rules 80–81 on the real content', () => {
  it('passes', () => {
    const r = lintCorpus(repoRoot)
    expect(hits(r, 80)).toEqual([])
    expect(hits(r, 81)).toEqual([])
  })
})

describe('rule 80: the AI rules the content ships', () => {
  const WARDEN = 'content/classes/warden.json'
  it('fails a relic that does not exist, a skill of another class and a clause the parser drops', () => {
    const r = lintCorpus(
      brokenCopy(WARDEN, (j) => {
        j.aiRuleDefault = 'IF self HP < 30% THEN item the brass whistle; IF ally HP < 40% THEN backstab on weakest enemy; IF self hp < THEN guard; ELSE shield slam front enemy'
      }),
    )
    const h = hits(r, 80)
    expect(h.some((m) => m.startsWith(WARDEN) && m.includes('"item the brass whistle" names no consumable'))).toBe(true)
    expect(h.some((m) => m.includes('"backstab" is no warden skill'))).toBe(true)
    expect(h.some((m) => m.includes('is dropped'))).toBe(true)
  })

  it("passes the Phase 8 relic lines: a relic a hero wears is named like an item, the Hollow Coin (after a fight) is not", () => {
    const r = lintCorpus(brokenCopy(WARDEN, (j) => (j.aiRuleDefault = 'IF enemies count > 1 THEN item the hollow coin; ELSE shield slam front enemy')))
    expect(hits(r, 80).some((m) => m.includes('"item the hollow coin"'))).toBe(true)
  })
})

describe('rule 81: champion HP by zone', () => {
  const TUNING = 'content/tuning.json'
  it('fails an unknown dungeon and a percent outside 25–400; a number for a zone still to come only warns', () => {
    const r = lintCorpus(
      brokenCopy(TUNING, (j) => {
        j.dungeon.championHpPercentByZone = { 'no-such-keep': [100], 'gravehollow-keep': [133, 100, 100, 100], note: 'x' }
      }),
    )
    const h = hits(r, 81)
    expect(h.some((m) => m.includes("'no-such-keep', which is not a dungeon"))).toBe(true)
    expect(h.some((m) => m.includes('has 4 numbers'))).toBe(false)
    expect(r.warnings.some((w) => w.rule === 81 && w.message.includes('has 4 numbers; the dungeon has 3 zones yet'))).toBe(true)
    const low = lintCorpus(brokenCopy(TUNING, (j) => (j.dungeon.championHpPercentByZone['gravehollow-keep'] = [10, 100, 100])))
    expect(hits(low, 81).some((m) => m.includes('[0] is 10; a percent in 25–400'))).toBe(true)
  })
})
