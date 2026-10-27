/**
 * The content layer: path → kind, the bundle built from the real content/ and from the examples, the merge of split
 * template files, and the errors buildContent must raise (duplicate ids, orphan templates, missing/duplicate tuning).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildContent, CONTENT_KINDS, contentSummary, kindForContentPath, type ContentKind, type RawContentFile } from '../src/content.ts'
import { GRADES, STATUSES, gradeAt, gradeIndex, gradeShift, isMember, lightBandIndex } from '../src/types/enums.ts'
import type { DungeonDef, TemplateDef } from '../src/types/content.ts'
import { kindForExampleFile, loadContentDir, loadExamplesAsContent } from '../../tools/sim/loadContent.ts'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const contentDir = path.join(repoRoot, 'content')
const examplesDir = path.join(contentDir, 'examples')

function readExample(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(examplesDir, name), 'utf8')) as unknown
}

function tuningFile(): RawContentFile {
  return { kind: 'tuning', path: 'tuning.json', json: readExample('tuning.example.json') }
}

describe('kindForContentPath', () => {
  const cases: Array<[string, ContentKind | null, string | undefined]> = [
    ['tuning.json', 'tuning', undefined],
    ['classes/warden.json', 'class', undefined],
    ['species/dwarf.json', 'species', undefined],
    ['skills/warden/warden-shield-slam.json', 'skill', undefined],
    ['skills/field/lockpicking.json', 'skill', undefined],
    ['items/weapon/iron-longsword.json', 'item', undefined],
    ['affixes/of-vigor.json', 'affix', undefined],
    ['sets/grinning-companys-cut.json', 'item-set', undefined],
    ['monsters/giant-rat.json', 'monster', undefined],
    ['elite-affixes/rabid.json', 'elite-affix', undefined],
    ['dungeons/gravehollow-keep/dungeon.json', 'dungeon', 'gravehollow-keep'],
    ['dungeons/gravehollow-keep/templates/cel-t-storeroom.json', 'template', 'gravehollow-keep'],
    ['encounters/rat-pack.json', 'encounter', undefined],
    ['pets/cellar-hound.json', 'pet', undefined],
    ['chests/standard-gear-chest.json', 'chest', undefined],
    ['loot-tables/gravehollow-cellars.json', 'loot-table', undefined],
    ['contracts/rat-catcher.json', 'contract', undefined],
    ['statuses/bleed.json', 'status', undefined],
  ]

  it('maps every layout line, with either slash style and with or without a leading content/', () => {
    for (const [rel, kind, dungeonId] of cases) {
      const variants = [rel, `content/${rel}`, rel.replace(/\//g, '\\'), `content\\${rel.replace(/\//g, '\\')}`, `./content/${rel}`]
      for (const p of variants) {
        const got = kindForContentPath(p)
        expect(got, p).not.toBeNull()
        expect(got?.kind, p).toBe(kind)
        expect(got?.dungeonId, p).toBe(dungeonId)
      }
    }
  })

  it('returns null for schemas, examples, saves, the README and anything off the layout', () => {
    const nulls = [
      'schemas/class.schema.json',
      'content/schemas/common.schema.json',
      'examples/class.example.json',
      'content\\examples\\monster-boss.example.json',
      'saves/hero-7f3a9c.json',
      'README.md',
      'content/README.md',
      'tuning.json.bak',
      'classes/warden.txt',
      'classes/sub/warden.json',
      'skills/warden-shield-slam.json',
      'items/iron-longsword.json',
      'dungeons/gravehollow-keep/floors.json',
      'dungeons/gravehollow-keep/templates/deep/x.json',
      'dungeons/dungeon.json',
      'unknown/thing.json',
      'constructor/x.json',
      '',
    ]
    for (const p of nulls) expect(kindForContentPath(p), p).toBeNull()
  })
})

describe('enums', () => {
  it('keeps the grade ladder in order and the helpers agree with it', () => {
    expect(GRADES).toEqual(['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'God'])
    expect(gradeIndex('F')).toBe(0)
    expect(gradeIndex('God')).toBe(8)
    expect(gradeAt(2)).toBe('D')
    expect(gradeAt(9)).toBeUndefined()
    expect(gradeShift('A', 2)).toBe('SS')
    expect(gradeShift('SS', 5)).toBe('God')
    expect(gradeShift('E', -3)).toBe('F')
    expect(lightBandIndex('radiant')).toBe(0)
    expect(lightBandIndex('pitch')).toBe(4)
    expect(isMember(GRADES, 'S')).toBe(true)
    expect(isMember(GRADES, 'X')).toBe(false)
    expect(STATUSES).toHaveLength(27)
  })
})

describe('buildContent on the real content/', () => {
  const content = loadContentDir(contentDir)

  it('loads all 27 statuses, one per enum value, and the tuning file', () => {
    expect(content.statuses.size).toBe(27)
    for (const status of STATUSES) expect(content.statuses.get(status)?.id, status).toBe(status)
    expect(content.tuning.version).toBe(1)
    expect(contentSummary(content).status).toBe(27)
    expect(contentSummary(content).tuning).toBe(1)
  })

  it('iterates statuses in sorted-id order whatever the file order', () => {
    const ids = [...content.statuses.keys()]
    expect(ids).toEqual([...ids].sort())
  })
})

describe('loadExamplesAsContent', () => {
  it('resolves example file names to kinds as the linter does', () => {
    expect(kindForExampleFile('monster-boss.example.json')).toBe('monster')
    expect(kindForExampleFile('item-set.example.json')).toBe('item-set')
    expect(kindForExampleFile('item.example.json')).toBe('item')
    expect(kindForExampleFile('tuning.example.json')).toBe('tuning')
    expect(kindForExampleFile('hero.example.json')).toBeNull()
    expect(kindForExampleFile('common.example.json')).toBeNull()
    expect(kindForExampleFile('class.json')).toBeNull()
  })

  it('builds without throwing and the summary matches the example files', () => {
    const content = loadExamplesAsContent(examplesDir)
    const summary = contentSummary(content)
    expect(summary).toEqual({
      class: 1,
      species: 1,
      skill: 1,
      item: 1,
      affix: 1,
      'item-set': 1,
      monster: 3,
      'elite-affix': 1,
      dungeon: 1,
      template: 2,
      encounter: 1,
      pet: 1,
      chest: 1,
      'loot-table': 1,
      contract: 1,
      status: 1,
      wayfarer: 1,
      tuning: 1,
    })
    // Every example file but hero.example.json is one record (templates are inline in the dungeon example).
    const exampleFiles = fs.readdirSync(examplesDir).filter((n) => n.endsWith('.example.json') && !n.startsWith('hero'))
    const recordCount = CONTENT_KINDS.filter((k) => k !== 'template').reduce((n, k) => n + summary[k], 0)
    expect(recordCount).toBe(exampleFiles.length)
    for (const kind of CONTENT_KINDS) expect(summary[kind], kind).toBeGreaterThan(0)
  })

  it('builds the helper indexes', () => {
    const content = loadExamplesAsContent(examplesDir)
    expect(content.skillsByClass.get('warden')?.map((s) => s.id)).toEqual(['warden-shield-slam'])
    expect(content.monstersByFamily.get('cellar-vermin')?.map((m) => m.id)).toEqual(['captain-vexa-marrow', 'giant-rat', 'old-gnaw'])
    expect(content.monstersByZone.get('the-cellars')?.length).toBe(3)
    expect(content.encountersByTable.get('cellars-a')?.map((e) => e.id)).toEqual(['rat-pack'])
    expect(content.itemsByKind.get('weapon')?.map((i) => i.id)).toEqual(['iron-longsword'])
    expect(content.dungeons.get('gravehollow-keep')?.templates.map((t) => t.id)).toEqual(['cel-t-storeroom', 'cel-t-wine-vault'])
  })
})

describe('buildContent errors and the template merge', () => {
  it('throws naming the path on a duplicate id within a kind', () => {
    const bleed = readExample('status.example.json')
    const files: RawContentFile[] = [
      tuningFile(),
      { kind: 'status', path: 'statuses/bleed.json', json: bleed },
      { kind: 'status', path: 'statuses/bleed-copy.json', json: bleed },
    ]
    expect(() => buildContent(files)).toThrow(/statuses\/bleed-copy\.json.*duplicate status id "bleed".*statuses\/bleed\.json/)
  })

  it('allows the same id in two different kinds', () => {
    const rat = readExample('monster.example.json') as { id: string }
    const pet = { ...(readExample('pet.example.json') as object), id: rat.id }
    const content = buildContent([
      tuningFile(),
      { kind: 'monster', path: 'monsters/giant-rat.json', json: rat },
      { kind: 'pet', path: 'pets/giant-rat.json', json: pet },
    ])
    expect(content.monsters.has('giant-rat')).toBe(true)
    expect(content.pets.has('giant-rat')).toBe(true)
  })

  it('throws when tuning is missing or duplicated', () => {
    expect(() => buildContent([])).toThrow(/tuning\.json is missing/)
    expect(() => buildContent([tuningFile(), { ...tuningFile(), path: 'tuning-2.json' }])).toThrow(/tuning-2\.json.*duplicate tuning/)
  })

  it('throws naming the path on a record without an id', () => {
    expect(() => buildContent([tuningFile(), { kind: 'class', path: 'classes/nameless.json', json: { name: 'Nameless' } }])).toThrow(
      /classes\/nameless\.json.*no string "id"/,
    )
  })

  it('merges a split template file into its dungeon without mutating the raw dungeon', () => {
    const dungeon = readExample('dungeon.example.json') as DungeonDef
    const inlineTemplates = dungeon.templates
    expect(inlineTemplates.length).toBeGreaterThanOrEqual(2)
    const [moved, ...kept] = inlineTemplates as [TemplateDef, ...TemplateDef[]]
    const rawDungeon = { ...dungeon, templates: kept }
    const snapshot = JSON.stringify(rawDungeon)

    const files: RawContentFile[] = [
      tuningFile(),
      { kind: 'dungeon', path: `dungeons/${dungeon.id}/dungeon.json`, json: rawDungeon, dungeonId: dungeon.id },
      { kind: 'template', path: `dungeons/${dungeon.id}/templates/${moved.id}.json`, json: moved, dungeonId: dungeon.id },
    ]
    const content = buildContent(files)
    const merged = content.dungeons.get(dungeon.id)
    expect(merged).toBeDefined()
    expect(merged?.templates.map((t) => t.id).sort()).toEqual(inlineTemplates.map((t) => t.id).sort())
    expect(merged?.templates.find((t) => t.id === moved.id)).toBe(moved)
    // The merged dungeon is a clone; the raw object and its templates array are untouched.
    expect(merged).not.toBe(rawDungeon)
    expect(rawDungeon.templates).toBe(kept)
    expect(rawDungeon.templates).toHaveLength(inlineTemplates.length - 1)
    expect(JSON.stringify(rawDungeon)).toBe(snapshot)
    expect(contentSummary(content).template).toBe(inlineTemplates.length)
  })

  it('leaves a dungeon with no split templates as the same object', () => {
    const dungeon = readExample('dungeon.example.json') as DungeonDef
    const content = buildContent([tuningFile(), { kind: 'dungeon', path: 'dungeons/x/dungeon.json', json: dungeon, dungeonId: dungeon.id }])
    expect(content.dungeons.get(dungeon.id)).toBe(dungeon)
  })

  it('throws on a template whose dungeon file is missing, and on a duplicate template id', () => {
    const dungeon = readExample('dungeon.example.json') as DungeonDef
    const template = dungeon.templates[0] as TemplateDef
    expect(() =>
      buildContent([tuningFile(), { kind: 'template', path: 'dungeons/nowhere/templates/t.json', json: template, dungeonId: 'nowhere' }]),
    ).toThrow(/dungeons\/nowhere\/templates\/t\.json.*dungeons\/nowhere\/dungeon\.json is missing/)
    expect(() => buildContent([tuningFile(), { kind: 'template', path: 'templates/t.json', json: template }])).toThrow(/templates\/t\.json.*no dungeonId/)
    expect(() =>
      buildContent([
        tuningFile(),
        { kind: 'dungeon', path: `dungeons/${dungeon.id}/dungeon.json`, json: dungeon, dungeonId: dungeon.id },
        { kind: 'template', path: `dungeons/${dungeon.id}/templates/${template.id}.json`, json: template, dungeonId: dungeon.id },
      ]),
    ).toThrow(new RegExp(`templates/${template.id}\\.json.*duplicate template id "${template.id}"`))
  })
})
