/**
 * Lint rules 45–49 (tools/lint/rules-c1.ts): the real content passes them, and deliberately broken copies of the
 * dungeon, the monsters, the encounters and the tuning fail with the expected rule on the expected file. One
 * temporary copy of content/ carries every break.
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gloamvault-lint-c1-'))
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

const mine = (r: LintResult) => r.failures.filter((f) => f.rule >= 45 && f.rule <= 49)

function expectRule(r: LintResult, rel: string, rule: number, part: string): void {
  const hits = r.failures.filter((f) => f.file === rel && f.rule === rule).map((f) => f.message)
  expect(hits.some((m) => m.includes(part)), `expected rule ${rule} on ${rel} with '${part}'; got:\n${mine(r).map((f) => `${f.file}: ${f.rule}. ${f.message}`).join('\n')}`).toBe(true)
}

const DUNGEON = 'content/dungeons/gravehollow-keep/dungeon.json'
const TUNING = 'content/tuning.json'
const NETTER = 'content/monsters/grinning-netter.json'
const GHOUL = 'content/monsters/ghoul.json'
const BELFRY = 'content/encounters/belfry.json'
const GRAVE_WATCH = 'content/encounters/grave-watch.json'

describe('rules 45–49 on the real content', () => {
  it('raise no failure', () => {
    const r = lintCorpus(repoRoot)
    expect(mine(r).map((f) => `${f.file}: ${f.rule}. ${f.message}`)).toEqual([])
  })
})

describe('rules 45–49 on broken copies', () => {
  const root = copyContent()
  edit(root, DUNGEON, (d) => {
    d.zones[0].waystone = false
    d.floors.find((f: Loose) => f.floor === 5).monsterLevel = 4
    d.levelRange.max = 14
    const throne = d.floors.find((f: Loose) => f.floor === 8)
    throne.roomsMax = 5
    const scythe = d.traps.find((t: Loose) => t.id === 'bone-scythe')
    scythe.placement.templateIds = ['vlt-t-sluice-hall']
    const glyph = d.traps.find((t: Loose) => t.id === 'warding-glyph')
    glyph.condition.partyClassIds = ['necromancer']
    const jar = d.curios.find((c: Loose) => c.id === 'leech-jar')
    jar.choices[0].outcomes[1].effect.summonId = 'ghoul'
    d.zones.find((z: Loose) => z.id === 'the-drowned-vault').joiners[0].monsterId = 'vault-leech'
  })
  edit(root, TUNING, (t) => {
    t.merchant.stock.push({ itemId: 'no-such-thing', quantity: 1, priceR: 0.01 })
    t.merchant.beforeFinalBoss.itemId = 'repair-kit-xl'
    t.bands.floors[3].from = 10
  })
  edit(root, NETTER, (m) => {
    m.behavior.rules.push({ if: 'always', then: 'gaff' })
  })
  edit(root, BELFRY, (e) => {
    e.floorBand = { min: 3, max: 4 }
  })
  edit(root, GRAVE_WATCH, (e) => {
    e.composition.push({ monsterId: 'tidebound-blade', count: 1, row: 'front' })
  })
  edit(root, GHOUL, (m) => {
    m.levelBand = { min: 7, max: 7 }
  })
  const r = lintCorpus(root)

  it('rule 45: the first Waystone, climbing levels, levelRange, the throne at 4 rooms', () => {
    expectRule(r, DUNGEON, 45, "has waystone false")
    expectRule(r, DUNGEON, 45, 'floor 5 monsterLevel 4 is below floor 4')
    expectRule(r, DUNGEON, 45, 'levelRange.max 14')
    expectRule(r, DUNGEON, 45, 'the throne floor 8 has rooms 4–5')
  })

  it('rule 46: merchant stock lines are items, the Torch line is a stock line, the bands tile the floors', () => {
    expectRule(r, TUNING, 46, "merchant.stock[6].itemId 'no-such-thing' is not an item")
    expectRule(r, TUNING, 46, "beforeFinalBoss.itemId 'repair-kit-xl'")
    expectRule(r, TUNING, 46, 'bands.floors[3] starts at floor 10, expected 9')
  })

  it('rule 47: an encounter stays in one zone, its monsters belong to it at their levels', () => {
    expectRule(r, BELFRY, 47, 'floorBand 3–4 does not lie inside one zone')
    expectRule(r, GRAVE_WATCH, 47, "'tidebound-blade' belongs to zone 'the-drowned-vault'")
    expectRule(r, 'content/encounters/ghoul-pack.json', 47, "'ghoul' fights at L8 on floor 6, outside its levelBand 7–7")
  })

  it('rule 48: a trailing unconditional gambit kills the weights', () => {
    expectRule(r, NETTER, 48, "unconditional 'gaff'")
  })

  it('rule 49: trap placement and conditions, curio fights and joiners stay in their zone', () => {
    expectRule(r, DUNGEON, 49, "trap 'bone-scythe' of zone 'the-crypts' names template 'vlt-t-sluice-hall'")
    expectRule(r, DUNGEON, 49, "condition.partyClassIds 'necromancer' is not a class")
    expectRule(r, DUNGEON, 49, "curio 'leech-jar' of zone 'the-drowned-vault' calls 'ghoul' of zone 'the-crypts'")
    expectRule(r, DUNGEON, 49, "joiner 'vault-leech' is a hunter")
  })

  it('leaves the rest of the content alone (but for floor 5, lowered on purpose)', () => {
    const other = mine(r).filter((f) => ![DUNGEON, TUNING, NETTER, BELFRY, GRAVE_WATCH, 'content/encounters/ghoul-pack.json', 'content/encounters/the-sextons-vigil.json'].includes(f.file) && !f.message.includes('on floor 5,'))
    expect(other.map((f) => `${f.file}: ${f.rule}. ${f.message}`)).toEqual([])
  })
})
