/**
 * Pass B's lint rules (40–44) and its changes to rules 22, 27 and 34 (Phase 7): each case copies content/ into a temp
 * dir, breaks one thing and asserts that its rule fires on its file. Other passes' work in progress may make other
 * rules fail in the copy; each case looks only for its own rule.
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gloamvault-items-lint-'))
  tempRoots.push(root)
  fs.cpSync(path.join(repoRoot, 'content'), path.join(root, 'content'), { recursive: true })
  return root
}

const abs = (root: string, rel: string) => path.join(root, ...rel.split('/'))
const read = (root: string, rel: string): Loose => JSON.parse(fs.readFileSync(abs(root, rel), 'utf8')) as Loose
function write(root: string, rel: string, json: unknown): void {
  fs.mkdirSync(path.dirname(abs(root, rel)), { recursive: true })
  fs.writeFileSync(abs(root, rel), `${JSON.stringify(json, null, 2)}\n`)
}
function edit(root: string, rel: string, mutate: (j: Loose) => void): void {
  const j = read(root, rel)
  mutate(j)
  write(root, rel, j)
}

function hits(r: LintResult, rel: string, rule: number): string[] {
  return r.failures.filter((f) => f.file === rel && f.rule === rule).map((f) => f.message)
}

function expectRule(r: LintResult, rel: string, rule: number, part: string): void {
  const h = hits(r, rel, rule)
  expect(h.some((m) => m.includes(part)), `rule ${rule} on ${rel} with '${part}'; got: ${h.join(' | ') || 'none'}`).toBe(true)
}

interface Case {
  name: string
  setup(root: string): void
  check(r: LintResult): void
}

const cases: Case[] = [
  {
    name: 'an egg for a pet that does not exist (rule 40)',
    setup: (root) => write(root, 'content/items/egg/griffin-egg.json', { ...read(root, 'content/items/egg/wisp-egg.json'), id: 'griffin-egg', name: 'Griffin Egg' }),
    check: (r) => expectRule(r, 'content/items/egg/griffin-egg.json', 40, "names pet 'griffin'"),
  },
  {
    name: 'a pet with no egg item (rule 40)',
    setup: (root) => fs.rmSync(abs(root, 'content/items/egg/wisp-egg.json')),
    check: (r) => expectRule(r, 'content/pets/wisp.json', 40, 'has no egg item'),
  },
  {
    name: 'two Standard chest keys, and a key with no opening tag (rule 41)',
    setup: (root) => {
      write(root, 'content/items/key/spare-chest-key.json', { ...read(root, 'content/items/key/standard-chest-key.json'), id: 'spare-chest-key', name: 'Spare Chest Key' })
      edit(root, 'content/items/key/bandit-lockpick.json', (j) => delete j.tags)
    },
    check: (r) => {
      expect(hits(r, 'content/items/key/spare-chest-key.json', 41).concat(hits(r, 'content/items/key/standard-chest-key.json', 41)).some((m) => m.includes('a second standard chest key'))).toBe(true)
      expectRule(r, 'content/items/key/bandit-lockpick.json', 41, 'exactly one of the tags')
    },
  },
  {
    name: 'a safe item with no zone, a usable-in-a-fight consumable that does nothing, a weapon in a consumable drop (rule 42)',
    setup: (root) => {
      edit(root, 'content/items/consumable/reading-glass.json', (j) => (j.tags = ['safe-item']))
      edit(root, 'content/items/consumable/wax-plugs.json', (j) => (j.consumable.inCombat = true))
      edit(root, 'content/loot-tables/gravehollow-cellars.json', (j) => j.consumableDrop.itemIds.push('iron-longsword'))
    },
    check: (r) => {
      expectRule(r, 'content/items/consumable/reading-glass.json', 42, "exactly one zone")
      expectRule(r, 'content/items/consumable/wax-plugs.json', 42, 'the Item action would do nothing')
      expectRule(r, 'content/loot-tables/gravehollow-cellars.json', 42, "'iron-longsword'")
    },
  },
  {
    name: "a set piece that cannot promote within its set, and a C-grade unique (rule 43)",
    setup: (root) => {
      fs.rmSync(abs(root, 'content/items/armor/barrow-wardens-helm-b.json'))
      edit(root, 'content/items/armor/lamplighters-hood.json', (j) => {
        j.grade = 'C'
        j.affixSlots = 2
        j.maxPlusN = 6
        j.materialRung = 3
      })
    },
    check: (r) => {
      expectRule(r, 'content/sets/barrow-wardens-vigil.json', 43, 'no helmet piece of that grade')
      expectRule(r, 'content/items/armor/barrow-wardens-helm-c.json', 43, 'promotion would drop the set')
      expectRule(r, 'content/items/armor/lamplighters-hood.json', 43, 'B or above')
    },
  },
  {
    name: 'an instant relic with an action weight, a rung with only regional names (rule 44)',
    setup: (root) => {
      edit(root, 'content/items/relic/the-brine-pearl.json', (j) => (j.weight = 600))
      edit(root, 'content/items/material/wolf-hide.json', (j) => (j.tags = ['regional']))
    },
    check: (r) => {
      expectRule(r, 'content/items/relic/the-brine-pearl.json', 44, 'weight must be null')
      expectRule(r, 'content/items/material/wolf-hide.json', 44, 'only regional names')
    },
  },
  {
    name: "a percentage secondary that does not step from B, a loot table's item chance off 08 §11 (rules 22, 27)",
    setup: (root) => {
      edit(root, 'content/items/armor/wyvern-hide-jerkin.json', (j) => (j.baseStats.dodge = 3))
      edit(root, 'content/loot-tables/gravehollow-cellars.json', (j) => (j.itemChance = 41))
    },
    check: (r) => {
      expectRule(r, 'content/items/armor/wyvern-hide-jerkin.json', 22, 'baseStats.dodge is 3')
      expectRule(r, 'content/loot-tables/gravehollow-cellars.json', 27, 'itemChance is 41')
    },
  },
  {
    name: 'an S-grade wayfarer with nine creation points (rule 34)',
    setup: (root) => edit(root, 'content/wayfarers/vorrin-scalehold.json', (j) => (j.freePoints = { endurance: 3, vitality: 3, strength: 3 })),
    check: (r) => expectRule(r, 'content/wayfarers/vorrin-scalehold.json', 34, 'a grade S wayfarer has 10'),
  },
]

describe("pass B's item rules (40–44) and the Phase 7 changes to 22, 27 and 34", () => {
  it('the real content raises none of them', () => {
    const r = lintCorpus(repoRoot)
    const mine = r.failures.filter((f) => [40, 41, 42, 43, 44].includes(f.rule) && !/zone:the-(crypts|drowned-vault)/.test(f.message))
    expect(mine.map((f) => `${f.file}: ${f.rule}. ${f.message}`)).toEqual([])
  })
  for (const c of cases) {
    it(c.name, () => {
      const root = copyContent()
      c.setup(root)
      c.check(lintCorpus(root))
    })
  }
})
