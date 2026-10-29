/**
 * Lint rules 4, 7 and 35–37 as Phase 7 left them (pass A: tools/lint/rules.ts rules 4 and 7, tools/lint/rules-a.ts):
 * the real content passes them, and deliberately broken copies fail with the expected rule on the expected file.
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gloamvault-lint-a-'))
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

const MINE = new Set([4, 7, 35, 36, 37])

function expectRule(r: LintResult, rel: string, rule: number, part: string): void {
  const hits = r.failures.filter((f) => f.file === rel && f.rule === rule).map((f) => f.message)
  expect(hits.some((m) => m.includes(part)), `expected rule ${rule} on ${rel} with '${part}'; got:\n${r.failures.filter((f) => MINE.has(f.rule)).map((f) => `${f.file}: ${f.rule}. ${f.message}`).join('\n')}`).toBe(true)
}

describe('rules 4, 7 and 35–37 on the real content', () => {
  it('raise no failure', () => {
    const r = lintCorpus(repoRoot)
    expect(r.failures.filter((f) => MINE.has(f.rule)).map((f) => `${f.file}: ${f.rule}. ${f.message}`)).toEqual([])
  })
})

describe('rules 4, 7 and 35–37 on broken copies', () => {
  const root = copyContent()
  // Rule 4: a class without its Tier V.
  for (const f of fs.readdirSync(path.join(root, 'content', 'skills', 'arcanist'))) {
    const j = JSON.parse(fs.readFileSync(path.join(root, 'content', 'skills', 'arcanist', f), 'utf8')) as Loose
    if (j.tier === 5) fs.rmSync(path.join(root, 'content', 'skills', 'arcanist', f))
  }
  // Rule 7: a starter kit with a Tier II pick and a missing item; a move the monster does not have; a technique marked
  // later whose monster exists; a class with one technique too few.
  edit(root, 'content/classes/warden.json', (j) => {
    j.starterKitOptions[0].starterSkillIds = ['warden-shove', 'warden-provoke', 'warden-brace']
    j.starterKitOptions[0].starterKit = [...j.starterKitOptions[0].starterKit, 'no-such-spear']
  })
  edit(root, 'content/skills/mender/mender-wraiths-lament.json', (j) => {
    j.monsterTechniqueMoveIds = ['wail', 'no-such-move']
  })
  edit(root, 'content/skills/mender/mender-trolls-regrowth.json', (j) => {
    j.monsterTechniqueLater = 'wraith'
  })
  // Rule 35: a boss's Tome reward naming a technique and a Tier V tier; a Skill Tome chest reaching Tier V.
  edit(root, 'content/monsters/captain-vexa-marrow.json', (j) => {
    j.boss.firstKill = [...j.boss.firstKill, { kind: 'tome', id: 'blade-ghouls-grasp' }, { kind: 'tome', tier: 5 }]
  })
  edit(root, 'content/chests/grand-skill-tome.json', (j) => {
    j.tomeTiers = { min: 3, max: 5 }
  })
  // Rule 36: an execute above 6.0×, Undying Rage twice per floor, Never Lost past the cap.
  edit(root, 'content/skills/blade/blade-guillotine.json', (j) => {
    j.mastery.effects[0].multiplier = 7
  })
  edit(root, 'content/skills/blade/blade-undying-rage.json', (j) => {
    j.effects[0].amount = 2
  })
  edit(root, 'content/skills/ranger/ranger-never-lost.json', (j) => {
    j.effects[0].amount = -100
  })
  // Rule 37: a monster skill nobody uses.
  fs.mkdirSync(path.join(root, 'content', 'skills', 'monster'), { recursive: true })
  const orphan = JSON.parse(fs.readFileSync(path.join(root, 'content', 'skills', 'field', 'field-haggling.json'), 'utf8')) as Loose
  fs.writeFileSync(path.join(root, 'content', 'skills', 'monster', 'monster-orphan-roar.json'), `${JSON.stringify({ ...orphan, id: 'monster-orphan-roar', classId: 'monster', school: 'monster', name: 'Orphan Roar' }, null, 2)}\n`)
  const r = lintCorpus(root)

  it('rule 4: every class has all five tiers', () => expectRule(r, 'content/classes/arcanist.json', 4, 'no Tier 5 skills'))
  it('rule 7: a starter kit names Tier I skills and items that exist', () => {
    expectRule(r, 'content/classes/warden.json', 7, "starter kit 'spear' skill 'warden-shove' is Tier 2")
    expectRule(r, 'content/classes/warden.json', 7, "item 'no-such-spear' does not resolve")
  })
  it("rule 7: a move list names the monster's attacks", () => expectRule(r, 'content/skills/mender/mender-wraiths-lament.json', 7, "move 'no-such-move' is not an attack of monster 'wraith'"))
  it('rule 7: a technique marked later is linked once its monster exists', () => expectRule(r, 'content/skills/mender/mender-trolls-regrowth.json', 7, "monster 'wraith' is in the content now"))
  it('rule 35: a Tome never carries a technique or Tier V', () => {
    expectRule(r, 'content/monsters/captain-vexa-marrow.json', 35, "tome 'blade-ghouls-grasp' is a monster technique")
    expectRule(r, 'content/monsters/captain-vexa-marrow.json', 35, 'tome tier 5 is outside 1–4')
    expectRule(r, 'content/chests/grand-skill-tome.json', 35, 'Tome tiers 3–5')
  })
  it('rule 36: the D-099 limits', () => {
    expectRule(r, 'content/skills/blade/blade-guillotine.json', 36, 'an execute at 7× is above')
    expectRule(r, 'content/skills/blade/blade-undying-rage.json', 36, 'amount 2 differs from skills.limits.perFloor 1')
    expectRule(r, 'content/skills/ranger/ranger-never-lost.json', 36, 'goes past the −30 cap')
  })
  it('rule 37: a monster skill is used by a monster', () => expectRule(r, 'content/skills/monster/monster-orphan-roar.json', 37, 'no monster record names'))
})
