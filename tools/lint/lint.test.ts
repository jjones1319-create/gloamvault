/**
 * The content linter: (a) the real content/ passes; (b) deliberately broken variants fail with the expected rule.
 * Variants are built by copying content/ into a temp dir and mutating one file. Content kinds that do not exist yet
 * (classes, skills, items …) are stood up from their example first; dangling references those examples carry
 * produce other failures the tests ignore — each test asserts only that its specific rule fires on its file.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { formatResult, lintCorpus, type Failure, type LintResult } from './lint.ts'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const examplesDir = path.join(repoRoot, 'content', 'examples')

type Loose = Record<string, any>

const CLASS = 'content/classes/warden.json'
const SPECIES = 'content/species/dwarf.json'
const SKILL = 'content/skills/warden/warden-shield-slam.json'
const ITEM = 'content/items/weapon/iron-longsword.json'
const BOSS = 'content/monsters/captain-vexa-marrow.json'
const RAT = 'content/monsters/giant-rat.json'
const DUNGEON = 'content/dungeons/gravehollow-keep/dungeon.json'
const CHEST = 'content/chests/standard-gear-chest.json'
const LOOT = 'content/loot-tables/gravehollow-cellars.json'
const AFFIX = 'content/affixes/of-vigor.json'
const SET = 'content/sets/grinning-companys-cut.json'
const ENCOUNTER = 'content/encounters/rat-pack.json'
const PET = 'content/pets/cellar-hound.json'
const TUNING = 'content/tuning.json'
const HERO = 'content/saves/hero-7f3a9c.json'

const tempRoots: string[] = []
afterAll(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true })
})

function copyContent(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gloamvault-lint-'))
  tempRoots.push(root)
  fs.cpSync(path.join(repoRoot, 'content'), path.join(root, 'content'), { recursive: true })
  return root
}

function abs(root: string, rel: string): string {
  return path.join(root, ...rel.split('/'))
}

function readJson(file: string): Loose {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Loose
}

function writeJson(root: string, rel: string, json: unknown): void {
  const file = abs(root, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`)
}

/** Copies an example into the content tree (optionally mutated) and returns it. */
function place(root: string, example: string, rel: string, mutate?: (j: Loose) => void): Loose {
  const json = readJson(path.join(examplesDir, example))
  mutate?.(json)
  writeJson(root, rel, json)
  return json
}

function edit(root: string, rel: string, mutate: (j: Loose) => void): void {
  const json = readJson(abs(root, rel))
  mutate(json)
  writeJson(root, rel, json)
}

function describeResult(r: LintResult): string {
  const files = r.files.filter((f) => !f.ok).map((f) => `FAIL ${f.path}\n  ${f.errors.join('\n  ')}`)
  const rules = r.failures.map((x) => `${x.file}: ${x.rule}. ${x.message}`)
  return [...files, ...rules].join('\n')
}

function rulesFor(r: LintResult, rel: string, rule: number): Failure[] {
  return r.failures.filter((f) => f.file === rel && f.rule === rule)
}

function expectRule(r: LintResult, rel: string, rule: number, messagePart?: string): void {
  const hits = rulesFor(r, rel, rule)
  expect(hits.length, `expected rule ${rule} on ${rel}; got:\n${describeResult(r)}`).toBeGreaterThan(0)
  if (messagePart !== undefined) {
    expect(hits.some((h) => h.message.includes(messagePart)), `expected a rule ${rule} message with '${messagePart}'; got:\n${hits.map((h) => h.message).join('\n')}`).toBe(true)
  }
}

function expectSchemaFail(r: LintResult, rel: string, instancePath: string, messagePart?: string): void {
  const f = r.files.find((x) => x.path === rel)
  expect(f, `no result for ${rel}`).toBeDefined()
  expect(f?.ok, `${rel} validated although it is broken:\n${describeResult(r)}`).toBe(false)
  const at = (f?.errors ?? []).filter((e) => e.startsWith(`${instancePath} `) || e.startsWith(`${instancePath}/`))
  expect(at.length, `expected an ajv error at ${instancePath}; got:\n${(f?.errors ?? []).join('\n')}`).toBeGreaterThan(0)
  if (messagePart !== undefined) expect(at.some((e) => e.includes(messagePart)), `expected '${messagePart}' in:\n${at.join('\n')}`).toBe(true)
}

describe('the real content/', () => {
  const result = lintCorpus(repoRoot)

  it('loads 19 schemas, each with an example, and the cross-file rules pass', () => {
    expect(result.schemaCount).toBe(19)
    const badSchemas = result.files.filter((f) => f.role === 'schema' && !f.ok)
    expect(badSchemas.map((f) => `${f.path}: ${f.errors.join('; ')}`)).toEqual([])
    expect(result.failures.map((x) => `${x.file}: ${x.rule}. ${x.message}`)).toEqual([])
  })

  it('every example validates against its schema', () => {
    const bad = result.files.filter((f) => f.role === 'example' && !f.ok)
    expect(bad.map((f) => `${f.path}\n  ${f.errors.join('\n  ')}`)).toEqual([])
    expect(result.files.filter((f) => f.role === 'example').length).toBeGreaterThanOrEqual(18)
  })

  it('every content file validates and the run is ALL GOOD', () => {
    const bad = result.files.filter((f) => f.role === 'content' && !f.ok)
    expect(bad.map((f) => `${f.path}\n  ${f.errors.join('\n  ')}`)).toEqual([])
    expect(result.ok).toBe(true)
    expect(formatResult(result).split('\n').at(-1)).toMatch(/^ALL GOOD: 19 schemas, \d+ files$/)
  })

  it('the CLI prints one line per file, the summary line, and exits with the result', () => {
    let stdout = ''
    let status = 0
    try {
      stdout = execFileSync(process.execPath, ['tools/lint/index.ts'], { cwd: repoRoot, encoding: 'utf8' })
    } catch (e) {
      const err = e as { stdout?: string; status?: number }
      stdout = err.stdout ?? ''
      status = err.status ?? 1
    }
    const lines = stdout.trim().split('\n')
    expect(lines.filter((l) => /^(ok|FAIL) content\//.test(l)).length).toBe(result.files.length)
    expect(lines.at(-1)).toMatch(/^(ALL GOOD: 19 schemas, \d+ files|\d+ failure\(s\))$/)
    expect(status).toBe(result.ok ? 0 : 1)
  })

  it('--saves with no saves folder lints nothing extra', () => {
    const r = lintCorpus(repoRoot, { saves: true })
    expect(r.files.filter((f) => f.role === 'save')).toEqual([])
  })
})

type Case = { name: string; saves?: boolean; setup: (root: string) => void; check: (r: LintResult) => void }

const cases: Case[] = [
  {
    name: 'a passive skill with a weight (schema)',
    setup: (root) =>
      place(root, 'skill.example.json', SKILL, (j) => {
        j.type = 'passive'
      }),
    check: (r) => expectSchemaFail(r, SKILL, '/weight', 'must be null'),
  },
  {
    name: 'an Ultimate at Tier I (schema and rule 6)',
    setup: (root) =>
      place(root, 'skill.example.json', SKILL, (j) => {
        j.isUltimate = true
        j.cost = 0
      }),
    check: (r) => {
      expectSchemaFail(r, SKILL, '/tier')
      expectRule(r, SKILL, 6, 'Tier 1')
    },
  },
  {
    name: 'a weapon with weaponType: null (schema)',
    setup: (root) =>
      place(root, 'item.example.json', ITEM, (j) => {
        j.weaponType = null
      }),
    check: (r) => expectSchemaFail(r, ITEM, '/weaponType'),
  },
  {
    name: 'a boss monster with boss: null (schema)',
    setup: (root) =>
      place(root, 'monster-boss.example.json', BOSS, (j) => {
        j.boss = null
      }),
    check: (r) => expectSchemaFail(r, BOSS, '/boss', 'must be object'),
  },
  {
    name: 'a status file renamed so the file name differs from its id (rule 1)',
    setup: (root) => fs.renameSync(abs(root, 'content/statuses/bleed.json'), abs(root, 'content/statuses/bleeding.json')),
    check: (r) => {
      expectRule(r, 'content/statuses/bleeding.json', 1, "'bleeding'")
      expect(formatResult(r)).toMatch(/^content\/statuses\/bleeding\.json: 1\. file name 'bleeding' differs from id 'bleed'$/m)
    },
  },
  {
    name: 'a missing status, 26 of 27 present (rule 3)',
    setup: (root) => fs.rmSync(abs(root, 'content/statuses/wither.json')),
    check: (r) => expectRule(r, 'content/statuses', 3, "'wither' (26 of 27 present)"),
  },
  {
    name: 'a status whose id is not in the enum (rule 3)',
    setup: (root) =>
      edit(root, 'content/statuses/bleed.json', (j) => {
        j.id = 'frostbite'
      }),
    check: (r) => {
      expectRule(r, 'content/statuses/bleed.json', 3, 'frostbite')
      expectSchemaFail(r, 'content/statuses/bleed.json', '/id')
    },
  },
  {
    name: 'a class whose attributeMods sum to 5 (rule 8)',
    setup: (root) =>
      place(root, 'class.example.json', CLASS, (j) => {
        j.attributeMods.strength = 2
      }),
    check: (r) => expectRule(r, CLASS, 8, '+5, expected +4'),
  },
  {
    name: 'a species netting +3 (rule 8)',
    setup: (root) =>
      place(root, 'species.example.json', SPECIES, (j) => {
        j.attributeMods.agility = -1
      }),
    check: (r) => expectRule(r, SPECIES, 8, '+3, expected +2'),
  },
  {
    name: 'affixSlots wrong for the grade (rule 19)',
    setup: (root) =>
      place(root, 'item.example.json', ITEM, (j) => {
        j.affixSlots = 3
      }),
    check: (r) => expectRule(r, ITEM, 19, 'affixSlots is 3, grade D has 1'),
  },
  {
    name: 'durability above maxDurability (rule 21)',
    setup: (root) =>
      place(root, 'item.example.json', ITEM, (j) => {
        j.durability = 100
        j.maxDurability = 95
      }),
    check: (r) => expectRule(r, ITEM, 21, 'durability 100 is above maxDurability 95'),
  },
  {
    name: "materialRung not the grade's ladder index (rule 22)",
    setup: (root) =>
      place(root, 'item.example.json', ITEM, (j) => {
        j.materialRung = 5
      }),
    check: (r) => expectRule(r, ITEM, 22, 'materialRung 5'),
  },
  {
    name: 'a chest oddsByBand table not summing to 100 (rule 26)',
    setup: (root) =>
      place(root, 'chest.example.json', CHEST, (j) => {
        j.oddsByBand[0].table.D = 50
      }),
    check: (r) => expectRule(r, CHEST, 26, 'sums to 94'),
  },
  {
    name: 'a loot table gradeShape not summing to 100 (rule 27)',
    setup: (root) =>
      place(root, 'loot-table.example.json', LOOT, (j) => {
        j.gradeShape.centre = 71
      }),
    check: (r) => expectRule(r, LOOT, 27, 'sums to 90'),
  },
  {
    name: 'generator.roomWeights not summing to 100 (rule 12)',
    setup: (root) =>
      place(root, 'dungeon.example.json', DUNGEON, (j) => {
        j.generator.roomWeights.fight = 40
      }),
    check: (r) => expectRule(r, DUNGEON, 12, 'sum to 90'),
  },
  {
    name: 'a skill filed under the wrong class folder (rule 1)',
    setup: (root) => place(root, 'skill.example.json', 'content/skills/blade/warden-shield-slam.json'),
    check: (r) => expectRule(r, 'content/skills/blade/warden-shield-slam.json', 1, 'skills/blade/'),
  },
  {
    name: 'an unresolved prerequisiteId (rule 2)',
    setup: (root) =>
      place(root, 'skill.example.json', SKILL, (j) => {
        j.tier = 2
        j.prerequisiteId = 'warden-no-such-skill'
      }),
    check: (r) => expectRule(r, SKILL, 2, "prerequisiteId 'warden-no-such-skill'"),
  },
  {
    name: 'a curio choice whose outcomes sum to 90 (rule 16)',
    setup: (root) =>
      place(root, 'dungeon.example.json', DUNGEON, (j) => {
        j.curios[0].choices[0].outcomes[0].chance = 50
      }),
    check: (r) => expectRule(r, DUNGEON, 16, 'sum to 90'),
  },
  {
    name: 'a reward line of kind key (schema)',
    setup: (root) =>
      place(root, 'monster-boss.example.json', BOSS, (j) => {
        j.boss.everyKill.push({ kind: 'key', id: 'standard-chest-key' })
      }),
    check: (r) => expectSchemaFail(r, BOSS, '/boss/everyKill/5/kind', 'allowed values'),
  },
  {
    // tuning.schema.json's nested-table branch swallows { value } objects, so the linter's rule 32 catches this.
    name: 'a tuning leaf { value: 3 } with no note (rule 32)',
    setup: (root) =>
      edit(root, TUNING, (j) => {
        j.attributes.heroicAt = { value: 3 }
      }),
    check: (r) => expectRule(r, TUNING, 32, 'attributes.heroicAt is a { value } leaf without a note'),
  },
  {
    name: 'an unknown top-level key in tuning.json (schema)',
    setup: (root) =>
      edit(root, TUNING, (j) => {
        j.weather = { source: '03 §0', rain: 1 }
      }),
    check: (r) => expectSchemaFail(r, TUNING, '/', 'weather'),
  },
  {
    name: 'a tuning section without source (schema)',
    setup: (root) =>
      edit(root, TUNING, (j) => {
        delete j.death.source
      }),
    check: (r) => expectSchemaFail(r, TUNING, '/death', "required property 'source'"),
  },
  {
    name: 'affix bands that overlap (rule 24)',
    setup: (root) =>
      place(root, 'affix.example.json', AFFIX, (j) => {
        j.lines[1].bandMin = 'C'
      }),
    check: (r) => expectRule(r, AFFIX, 24, 'lines[1]'),
  },
  {
    name: 'more rolled affixes than affixSlots (rule 20)',
    setup: (root) =>
      place(root, 'item.example.json', ITEM, (j) => {
        j.affixes.push({ affixId: 'of-vigor', value: 10, locked: false })
      }),
    check: (r) => expectRule(r, ITEM, 20, '2 affixes rolled with affixSlots 1'),
  },
  {
    name: 'floors numbered with a gap (rule 13)',
    setup: (root) =>
      place(root, 'dungeon.example.json', DUNGEON, (j) => {
        j.floors[2].floor = 4
      }),
    check: (r) => expectRule(r, DUNGEON, 13, 'numbered 1, 2, 4'),
  },
  {
    name: 'a template door offset outside its footprint (rule 17)',
    setup: (root) =>
      place(root, 'dungeon.example.json', DUNGEON, (j) => {
        j.templates[0].doors[0].offset = 1
      }),
    check: (r) => expectRule(r, DUNGEON, 17, 'offset 1 is outside the north side'),
  },
  {
    name: 'a hard preset missing a knob normal sets (rule 18)',
    setup: (root) =>
      place(root, 'dungeon.example.json', DUNGEON, (j) => {
        delete j.presets.hard.hunterClock
      }),
    check: (r) => expectRule(r, DUNGEON, 18, 'presets.hard does not set hunterClock'),
  },
  {
    name: 'a creation-choice pet whose gradeBand reaches S (rule 28)',
    setup: (root) =>
      place(root, 'pet.example.json', PET, (j) => {
        j.gradeBand.max = 'S'
      }),
    check: (r) => {
      expectRule(r, PET, 28, 'stay ≤ A')
      expectRule(r, PET, 28, 'lists 2 actives but gradeBand.max S allows 3')
    },
  },
  {
    name: 'boss phases not in descending atHpPercent (rule 11)',
    setup: (root) =>
      place(root, 'monster-boss.example.json', BOSS, (j) => {
        j.boss.phases[1].atHpPercent = 100
      }),
    check: (r) => expectRule(r, BOSS, 11, 'phases[1].atHpPercent 100'),
  },
  {
    name: 'an encounter composition totalling 7 (rule 15)',
    setup: (root) =>
      place(root, 'encounter.example.json', ENCOUNTER, (j) => {
        j.composition[0].count = 6
      }),
    check: (r) => expectRule(r, ENCOUNTER, 15, 'totals 7 monsters'),
  },
  {
    name: 'eliteAffixCount off its floor band (rule 14)',
    setup: (root) =>
      place(root, 'dungeon.example.json', DUNGEON, (j) => {
        j.floors[0].eliteAffixCount = 3
      }),
    check: (r) => expectRule(r, DUNGEON, 14, 'floor 1 eliteAffixCount is 3, expected 1'),
  },
  {
    name: 'a set whose gradeMin is above gradeMax (rule 25)',
    setup: (root) =>
      place(root, 'item-set.example.json', SET, (j) => {
        j.gradeMin = 'B'
        j.gradeMax = 'E'
      }),
    check: (r) => expectRule(r, SET, 25, 'gradeMin B is above gradeMax E'),
  },
  {
    name: 'a starter skill that is not Tier I (rule 7)',
    setup: (root) => {
      place(root, 'class.example.json', CLASS)
      place(root, 'skill.example.json', SKILL, (j) => {
        j.tier = 2
      })
    },
    check: (r) => expectRule(r, CLASS, 7, "starter skill 'warden-shield-slam' is Tier 2"),
  },
  {
    name: 'a pet active referenced from a class starterSkillIds (rule 9)',
    setup: (root) => {
      place(root, 'class.example.json', CLASS, (j) => {
        j.starterSkillIds = ['pet-hound-bite', 'warden-provoke', 'warden-brace']
      })
      place(root, 'skill.example.json', 'content/skills/pet/pet-hound-bite.json', (j) => {
        j.id = 'pet-hound-bite'
        j.classId = 'pet'
        j.school = 'pet'
      })
    },
    check: (r) => expectRule(r, CLASS, 9, "starterSkillIds names pet active 'pet-hound-bite'"),
  },
  {
    name: 'a God item that is not unique (rule 23)',
    setup: (root) =>
      place(root, 'item.example.json', ITEM, (j) => {
        j.grade = 'God'
        j.unique = false
        j.uniquePower = null
      }),
    check: (r) => {
      expectRule(r, ITEM, 23, 'unique: true')
      expectRule(r, ITEM, 23, 'uniquePower')
    },
  },
  {
    name: 'a zone hunterId naming a fodder monster (rule 10)',
    setup: (root) => {
      place(root, 'dungeon.example.json', DUNGEON, (j) => {
        j.zones[0].hunterId = 'giant-rat'
      })
      place(root, 'monster.example.json', RAT)
    },
    check: (r) => expectRule(r, DUNGEON, 10, "hunterId 'giant-rat' has role 'fodder'"),
  },
  {
    name: 'a JSON file outside the layout (no schema for the path)',
    setup: (root) => writeJson(root, 'content/weather/rain.json', { id: 'rain' }),
    check: (r) => {
      const f = r.files.find((x) => x.path === 'content/weather/rain.json')
      expect(f?.ok).toBe(false)
      expect(f?.errors.join()).toContain('no schema for this path')
    },
  },
  {
    name: 'a schema without an example',
    setup: (root) => fs.rmSync(abs(root, 'content/examples/affix.example.json')),
    check: (r) => {
      const f = r.files.find((x) => x.path === 'content/schemas/affix.schema.json')
      expect(f?.ok).toBe(false)
      expect(f?.errors.join()).toContain('no example')
      expect(r.ok).toBe(false)
    },
  },
  {
    name: 'a custom effect with no handler once sim/src/skills/custom exists (rule 31)',
    setup: (root) => {
      fs.mkdirSync(path.join(root, 'sim', 'src', 'skills', 'custom'), { recursive: true })
      place(root, 'monster-boss.example.json', BOSS)
    },
    check: (r) => expectRule(r, BOSS, 31, "custom effect 'next-attack-guaranteed-crit'"),
  },
  {
    name: 'a Dwarf hero with three loadout presets (rule 29, --saves)',
    saves: true,
    setup: (root) => {
      place(root, 'species.example.json', SPECIES)
      place(root, 'hero.example.json', HERO, (j) => {
        j.loadoutPresets.push({ name: 'Third', loadout: j.loadout })
      })
    },
    check: (r) => {
      expect(r.files.find((x) => x.path === HERO)?.ok).toBe(true)
      expectRule(r, HERO, 29, "3 loadoutPresets; species 'dwarf' allows 2")
    },
  },
  {
    name: 'a hero whose level does not follow its battle XP (rule 30, --saves)',
    saves: true,
    setup: (root) => {
      place(root, 'skill.example.json', SKILL)
      place(root, 'hero.example.json', HERO, (j) => {
        j.level = 9
      })
    },
    check: (r) => expectRule(r, HERO, 30, 'level 9 but battleXp 80 reaches level 2'),
  },
]

describe('deliberately broken variants fail with the expected rule', () => {
  for (const c of cases) {
    it(c.name, () => {
      const root = copyContent()
      c.setup(root)
      const r = lintCorpus(root, c.saves ? { saves: true } : {})
      expect(r.ok).toBe(false)
      c.check(r)
    })
  }
})
