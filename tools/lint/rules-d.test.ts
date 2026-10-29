/**
 * Lint rules 55–57 (tools/lint/rules-d.ts): the real content passes them, and deliberately broken copies fail with the
 * expected rule on the expected file. One temporary copy of content/ carries several independent breaks.
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gloamvault-lint-d-'))
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

function expectRule(r: LintResult, rel: string, rule: number, part: string): void {
  const hits = r.failures.filter((f) => f.file === rel && f.rule === rule).map((f) => f.message)
  expect(hits.some((m) => m.includes(part)), `expected rule ${rule} on ${rel} with '${part}'; got:\n${r.failures.filter((f) => f.rule >= 55 && f.rule <= 59).map((f) => `${f.file}: ${f.rule}. ${f.message}`).join('\n')}`).toBe(true)
}

const DUNGEON = 'content/dungeons/gravehollow-keep/dungeon.json'
const TUNING = 'content/tuning.json'

describe('rules 55–57 on the real content', () => {
  it('raise no failure', () => {
    const r = lintCorpus(repoRoot)
    expect(r.failures.filter((f) => f.rule >= 55 && f.rule <= 59).map((f) => `${f.file}: ${f.rule}. ${f.message}`)).toEqual([])
  })
})

describe('rules 55–57 on broken copies', () => {
  const root = copyContent()
  edit(root, DUNGEON, (j) => {
    const pacts = j.pacts as Loose[]
    pacts.find((p) => p.id === 'brittle')!.ruleFlags = ['wear-x1-5']
    delete pacts.find((p) => p.id === 'hungry-hunter')!.needsHunter
    pacts.find((p) => p.id === 'thin-line')!.knobs = { revivesPerFloor: 1 }
  })
  edit(root, 'content/contracts/rat-catcher.json', (j) => {
    j.target = { monsterIds: ['giant-rat', 'no-such-rat'], dungeonId: 'gravehollow-keep', zoneId: 'the-cellars' }
  })
  edit(root, 'content/contracts/lights-on.json', (j) => {
    j.target = { lightMin: 50, condition: 'at-the-stairs' }
    j.reward = { goldR: 0.25, keys: [{ kind: 'standard', amount: 4 }], chestId: null, items: [] }
  })
  edit(root, 'content/contracts/keepers-peace.json', (j) => {
    j.target.curioId = 'sealed-cask-of-nowhere'
  })
  edit(root, 'content/contracts/tide-turner.json', (j) => {
    j.band = null
    delete j.target.monsterId
  })
  edit(root, TUNING, (j) => {
    j.pets.traitGrowth.sources.perception = 'sniffs'
    j.pets.traitGrowth.usesForRank = [0, 50, 40]
  })
  const r = lintCorpus(root)

  it('rule 55: an unknown rule flag, a hunter Pact without needsHunter, a fixed revive count', () => {
    expectRule(r, DUNGEON, 55, "rule flag 'wear-x1-5'")
    expectRule(r, DUNGEON, 55, "pact 'hungry-hunter' moves the hunter")
    expectRule(r, DUNGEON, 55, "pact 'thin-line' sets knobs.revivesPerFloor")
  })

  it('rule 56: a kill with no count, a dangling monster, an unknown condition, keys over the cap, a curio of nowhere, a weekly with no band', () => {
    expectRule(r, 'content/contracts/rat-catcher.json', 56, 'needs target.count')
    expectRule(r, 'content/contracts/rat-catcher.json', 56, "no monster 'no-such-rat'")
    expectRule(r, 'content/contracts/lights-on.json', 56, "'at-the-stairs' is not one the sim checks")
    expectRule(r, 'content/contracts/lights-on.json', 56, 'pays 4 standard keys')
    expectRule(r, 'content/contracts/keepers-peace.json', 56, "curioId 'sealed-cask-of-nowhere'")
    expectRule(r, 'content/contracts/tide-turner.json', 56, 'written for a band')
    expectRule(r, 'content/contracts/tide-turner.json', 56, "'tide-below-step-4' needs target.monsterId")
  })

  it('rule 57: a growth source the sim does not count, ranks that do not climb', () => {
    expectRule(r, TUNING, 57, "sources.perception is 'sniffs'")
    expectRule(r, TUNING, 57, 'must climb')
  })
})
