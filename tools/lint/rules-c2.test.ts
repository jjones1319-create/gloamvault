/**
 * Lint rules 50–54 (tools/lint/rules-c2.ts): the real content passes them, and deliberately broken copies of the
 * bosses fail with the expected rule on the expected file. One temporary copy of content/ carries every break.
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

function copyContent(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gloamvault-lint-c2-'))
  tempRoots.push(root)
  fs.cpSync(path.join(repoRoot, 'content'), path.join(root, 'content'), { recursive: true })
  fs.mkdirSync(path.join(root, 'sim', 'src', 'skills'), { recursive: true })
  fs.cpSync(path.join(repoRoot, 'sim', 'src', 'skills', 'custom'), path.join(root, 'sim', 'src', 'skills', 'custom'), { recursive: true })
  return root
}

function edit(root: string, rel: string, mutate: (j: Loose) => void): void {
  const file = path.join(root, ...rel.split('/'))
  const json = JSON.parse(fs.readFileSync(file, 'utf8')) as Loose
  mutate(json)
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`)
}

const mine = (r: LintResult) => r.failures.filter((f) => f.rule >= 50 && f.rule <= 54)

function expectRule(r: LintResult, rel: string, rule: number, part: string): void {
  const hits = r.failures.filter((f) => f.file === rel && f.rule === rule).map((f) => f.message)
  expect(hits.some((m) => m.includes(part)), `expected rule ${rule} on ${rel} with '${part}'; got:\n${mine(r).map((f) => `${f.file}: ${f.rule}. ${f.message}`).join('\n')}`).toBe(true)
}

const VEXA = 'content/monsters/captain-vexa-marrow.json'
const WARDEN = 'content/monsters/barrow-warden.json'
const NAESA = 'content/monsters/sister-naesa.json'
const KING = 'content/monsters/hollow-king.json'

describe('rules 50–54 on the real content', () => {
  it('raise no failure', () => {
    const r = lintCorpus(repoRoot)
    expect(mine(r).map((f) => `${f.file}: ${f.rule}. ${f.message}`)).toEqual([])
  })
})

describe('rules 50–54 on broken copies', () => {
  const root = copyContent()
  edit(root, VEXA, (j) => {
    j.boss.phases[1].opener = 'grin'
    j.boss.arena.rules.push({ kind: 'quake', every: 3 })
    j.boss.arena.rules.find((r: Loose) => r.kind === 'lightsOut').tell = 'no-such-tell'
    j.boss.arena.room = 'cel-t-cistern'
  })
  edit(root, WARDEN, (j) => {
    j.boss.phases[1].light = { add: -80 }
    j.boss.arena.rules.find((r: Loose) => r.kind === 'heel').monsters = ['skeleton-footman']
    j.boss.arena.rules.find((r: Loose) => r.kind === 'piles').every = 2
    j.boss.parts[0].effect.removeAttacks = ['no-such-attack']
    j.attacks.find((a: Loose) => a.id === 'toll').hint = undefined
  })
  edit(root, NAESA, (j) => {
    j.boss.arena.rules.find((r: Loose) => r.kind === 'tide').params.wadeAt = 9
    j.boss.parts.find((p: Loose) => p.id === 'tentacle-arm').effect = { removeStatuses: { 'tentacle-lash': ['grab'] } }
    j.attacks.find((a: Loose) => a.id === 'undertow').aim = 'lowestHp'
  })
  edit(root, KING, (j) => {
    j.boss.arena.rules.find((r: Loose) => r.kind === 'hunters').monsters = ['old-gnaw', 'giant-rat', 'vault-leech']
    for (const a of j.attacks) if (j.boss.phases[2].attacks.includes(a.id)) a.aiWeight = 0
  })
  const r = lintCorpus(root)

  it('rule 50: an opener outside its phase, a light step that leaves 0–100', () => {
    expectRule(r, VEXA, 50, "opener 'grin' is not one of the phase's attacks")
    expectRule(r, WARDEN, 50, 'outside 0–100')
  })

  it('rule 51: an unknown rule kind, a stray field, a missing tell, a heel that is no hunter, a tide step past the top', () => {
    expectRule(r, VEXA, 51, "kind 'quake' is not a rule")
    expectRule(r, VEXA, 51, "tell 'no-such-tell' is not one of boss.arena.tells")
    expectRule(r, WARDEN, 51, "'skeleton-footman' is not a hunter")
    expectRule(r, WARDEN, 51, "carries 'every'")
    expectRule(r, NAESA, 51, 'params.wadeAt 9')
    expectRule(r, KING, 51, "'giant-rat' is not a hunter")
  })

  it('rule 52: a part that names no attack of the boss, or a status its attack never applies', () => {
    expectRule(r, WARDEN, 52, "removeAttacks 'no-such-attack'")
    expectRule(r, NAESA, 52, "'tentacle-lash' applies no 'grab'")
  })

  it("rule 53: a boss's tell without its hint, an aim on an attack that hits everyone, a phase that never acts", () => {
    expectRule(r, WARDEN, 53, "'toll' is telegraphed")
    expectRule(r, NAESA, 53, "aim 'lowestHp' needs a single-target attack")
    expectRule(r, KING, 53, 'boss.phases[2] has no attack with an aiWeight above 0')
  })

  it('rule 54: an arena room that hosts no boss', () => {
    expectRule(r, VEXA, 54, "'cel-t-cistern' does not host a boss")
  })
})
