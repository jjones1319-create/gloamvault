/**
 * Lint rules 60–64 (tools/lint/rules-f.ts): the real content passes them, and deliberately broken copies fail with the
 * expected rule on the expected file. Each corpus is a temporary copy of content/ with several independent breaks.
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gloamvault-lint-f-'))
  tempRoots.push(root)
  fs.cpSync(path.join(repoRoot, 'content'), path.join(root, 'content'), { recursive: true })
  // Rule 31 reads the handler folder next to content/: point it at the real one.
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

function messages(r: LintResult, rel: string, rule: number): string[] {
  return r.failures.filter((f) => f.file === rel && f.rule === rule).map((f) => f.message)
}

function expectRule(r: LintResult, rel: string, rule: number, part: string): void {
  const hits = messages(r, rel, rule)
  expect(hits.some((m) => m.includes(part)), `expected rule ${rule} on ${rel} with '${part}'; got:\n${r.failures.filter((f) => f.rule >= 60 && f.rule <= 64).map((f) => `${f.file}: ${f.rule}. ${f.message}`).join('\n')}`).toBe(true)
}

const TUNING = 'content/tuning.json'
const DUNGEON = 'content/dungeons/gravehollow-keep/dungeon.json'

describe('rules 60–64 on the real content', () => {
  it('raise no failure', () => {
    const r = lintCorpus(repoRoot)
    expect(r.failures.filter((f) => f.rule >= 60 && f.rule <= 64).map((f) => `${f.file}: ${f.rule}. ${f.message}`)).toEqual([])
  })
})

/** Rules 60–62 share one broken copy, linted once: each break touches its own file. */
const kinds = copyContent()
edit(kinds, 'content/statuses/freeze.json', (j) => {
  j.bossBecomes = 'freeze'
})
edit(kinds, 'content/statuses/burn.json', (j) => {
  j.element = 'frost'
})
edit(kinds, 'content/statuses/haste.json', (j) => {
  j.cleansedBy = ['cleanse']
})
edit(kinds, 'content/statuses/slow.json', (j) => {
  j.skipsActionChance = 50
})
edit(kinds, 'content/statuses/weaken.json', (j) => {
  j.cleansedBy = ['strip']
})
edit(kinds, 'content/statuses/mark.json', (j) => {
  j.visual.icon = 'status-bleed'
})
edit(kinds, 'content/statuses/fear.json', (j) => {
  j.bossBecomes = 'daze'
})
edit(kinds, 'content/species/halfling.json', (j) => {
  j.restrictions = [...j.restrictions, { kind: 'slot', slot: 'ring', reason: 'test: no rings' }]
})
edit(kinds, 'content/species/elf.json', (j) => {
  j.body.skinTones = j.body.skinTones.slice(0, 2)
  j.traits[1].id = j.traits[0].id
})
edit(kinds, 'content/elite-affixes/thorned.json', (j) => {
  j.hpMultiplier = 4
})
for (const id of ['nullifier', 'shackler'])
  edit(kinds, `content/elite-affixes/${id}.json`, (j) => {
    j.affixClass = 'offensive'
  })
edit(kinds, 'content/elite-affixes/spiteful.json', (j) => {
  j.tell = 'It swells, and swells, and swells, and keeps on swelling for a whole turn before it dies.'
})
const r = lintCorpus(kinds)

describe('rule 60: statuses', () => {
  it('a bossBecomes that names the status itself', () => expectRule(r, 'content/statuses/freeze.json', 60, 'bossBecomes names the status itself'))
  // Burn now claims frost too: the second file read (chill) carries the failure.
  it('two statuses marking one element', () => expectRule(r, 'content/statuses/chill.json', 60, "element 'frost' already marks with 'burn'"))
  it('a buff with no strip', () => expectRule(r, 'content/statuses/haste.json', 60, "must list 'strip'"))
  it('a debuff only stripped', () => expectRule(r, 'content/statuses/weaken.json', 60, 'must list a cleanse'))
  it('a turn skip on a debuff', () => expectRule(r, 'content/statuses/slow.json', 60, 'only control statuses skip turns'))
  it('a shared icon', () => expectRule(r, 'content/statuses/mark.json', 60, "visual.icon 'status-bleed'"))
  it('a boss conversion on a status bosses are immune to', () => expectRule(r, 'content/statuses/fear.json', 60, 'never applies'))
})

describe('rule 61: species', () => {
  it('a species that cannot wear a starter kit piece', () => expectRule(r, 'content/species/halfling.json', 61, 'cannot wear'))
  it('fewer than three skin tones', () => expectRule(r, 'content/species/elf.json', 61, 'body.skinTones has 2'))
  it('a trait id used twice', () => expectRule(r, 'content/species/elf.json', 61, 'trait id'))
})

describe('rule 62: elite affixes', () => {
  it('a champion multiplier off the pool', () => expectRule(r, 'content/elite-affixes/thorned.json', 62, 'hpMultiplier 4 differs'))
  it('a pool without control affixes', () => expectRule(r, 'content/elite-affixes', 62, "class 'control'"))
  it('a tell that is not a short cue', () => expectRule(r, 'content/elite-affixes/spiteful.json', 62, 'tell is'))
})

describe('rules 63–64: the runner and the threat', () => {
  const root = copyContent()
  edit(root, TUNING, (j) => {
    j.runner.recipes[0].classes = ['nobody']
    j.runner.recipes[1].clearTarget = [80, 20]
    j.runner.recipes[2].gear = 'Q'
    j.runner.careful.turnBackFrom = 'scary'
    j.runner.targets.goldPerFloor['gravehollow-keep'] = [1, 2, 3]
    j.runner.targets.rounds.fight = [6, 3]
    j.runner.policy = 'reckless'
    j.runner.bossKills = 'sometimes'
    j.runner.plans.gravehollow[0].sets = ['nope']
    j.runner.plans.gravehollow[1].death = ['sudden']
    j.dungeon.threat.easyAtOrBelow = 0
    j.runner.recipes[3].floors = [2, 5]
    j.dungeon.partyScaling.boss.hp = [1, 1, 1]
  })
  edit(root, DUNGEON, (j) => {
    j.floors[1].monsterLevel = 0
  })
  const r = lintCorpus(root)
  it('a recipe with a class that does not exist', () => expectRule(r, TUNING, 63, "class 'nobody' does not exist"))
  it('a clear target out of order', () => expectRule(r, TUNING, 63, 'clearTarget [80,20]'))
  it('a gear grade that does not exist', () => expectRule(r, TUNING, 63, "gear 'Q' is not a grade"))
  it("the careful player's band", () => expectRule(r, TUNING, 63, "turnBackFrom 'scary'"))
  it('gold targets for the wrong number of floors', () => expectRule(r, TUNING, 63, 'goldPerFloor.gravehollow-keep has 3 floors'))
  it('a target band out of order', () => expectRule(r, TUNING, 63, 'rounds.fight is [6, 3]'))
  it('a scripted player that does not exist', () => expectRule(r, TUNING, 63, "runner.policy 'reckless'"))
  it('a boss-kill mode that does not exist', () => expectRule(r, TUNING, 63, "runner.bossKills 'sometimes'"))
  it('a plan part naming a recipe set nobody is in', () => expectRule(r, TUNING, 63, "no recipe is in set 'nope'"))
  it('a plan part naming a death rule that does not exist', () => expectRule(r, TUNING, 63, "'sudden' is not a death rule"))
  it('Even must hold a fight at the party level', () => expectRule(r, TUNING, 64, 'easyAtOrBelow is 0'))
  it('monster levels never fall with depth', () => expectRule(r, DUNGEON, 64, 'is below floor 1'))
  it('recipe floors outside the recipe zone (D-083: part of a zone, never two)', () => expectRule(r, TUNING, 63, "floors 2–5 lie outside zone 1's floors 1–3"))
  it('a party-size row without four numbers (D-128)', () => expectRule(r, TUNING, 64, 'partyScaling.boss.hp must hold four positive numbers'))
})
