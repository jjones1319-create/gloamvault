/**
 * The Phase 2 fixture content set (sim/test/fixtures/README.md): the merged corpus — the real schemas, examples,
 * statuses and tuning.json with the fixture records on top — passes the content linter with the fixture's rule
 * skips, carries exactly the records the README lists, and loads through the sim's content layer.
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { lintCorpus, type Failure, type LintResult } from '../../tools/lint/lint.ts'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { FIXTURE_KNOWN_FAILURES, FIXTURE_SKIP_RULES, assembleFixtureCorpus, fixtureContentDir, listJson } from './fixtures/assemble.ts'

const root = assembleFixtureCorpus()
afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

function describeFailures(r: LintResult): string {
  const files = r.files.filter((f) => !f.ok).map((f) => `FAIL ${f.path}\n  ${f.errors.join('\n  ')}`)
  const rules = r.failures.map((x) => `${x.file}: ${x.rule}. ${x.message}`)
  return [...files, ...rules].join('\n')
}

function isKnown(f: Failure): boolean {
  return FIXTURE_KNOWN_FAILURES.some((k) => k.file === f.file && k.rule === f.rule && k.message.test(f.message))
}

describe('the fixture corpus under the content linter', () => {
  const result = lintCorpus(root, { skipRules: FIXTURE_SKIP_RULES })

  it('compiles every schema and validates every example', () => {
    const bad = result.files.filter((f) => (f.role === 'schema' || f.role === 'example') && !f.ok)
    expect(bad.map((f) => `${f.path}: ${f.errors.join('; ')}`)).toEqual([])
    expect(result.schemaCount).toBe(19)
  })

  it('validates every fixture file against its schema (zero ajv errors)', () => {
    const bad = result.files.filter((f) => f.role === 'content' && !f.ok)
    expect(bad.map((f) => `${f.path}\n  ${f.errors.join('\n  ')}`), describeFailures(result)).toEqual([])
    const fixtureFiles = listJson(fixtureContentDir)
    expect(result.files.filter((f) => f.role === 'content').length).toBe(fixtureFiles.length + listJson(path.join(root, 'content', 'statuses')).length + 1)
  })

  it('passes every cross-file rule but the skipped ones and the one known deviation', () => {
    const unexpected = result.failures.filter((f) => !isKnown(f))
    expect(unexpected.map((x) => `${x.file}: ${x.rule}. ${x.message}`), describeFailures(result)).toEqual([])
    for (const k of FIXTURE_KNOWN_FAILURES) {
      const hits = result.failures.filter((f) => f.file === k.file && f.rule === k.rule && k.message.test(f.message))
      expect(hits.length, `known deviation ${k.file} rule ${k.rule} should fire exactly once`).toBe(1)
    }
  })

  it('skips only the rules a fixture cannot satisfy', () => {
    expect([...FIXTURE_SKIP_RULES]).toEqual([4, 10, 14])
  })
})

describe('the fixture set holds exactly the records the README lists', () => {
  const count = (rel: string): number => listJson(path.join(fixtureContentDir, ...rel.split('/'))).length

  it('species, class, skills and pets', () => {
    expect(count('species')).toBe(2)
    expect(count('classes')).toBe(1)
    expect(count('skills/warden')).toBe(12)
    expect(count('skills/field')).toBe(8)
    expect(count('skills/pet')).toBe(2)
    expect(count('pets')).toBe(1)
  })

  it('monsters, elite affixes, encounters and the contract', () => {
    expect(count('monsters')).toBe(7)
    expect(count('elite-affixes')).toBe(5)
    expect(count('encounters')).toBe(4)
    expect(count('contracts')).toBe(1)
  })

  it('the dungeon, its templates, the loot table and the chests', () => {
    expect(listJson(path.join(fixtureContentDir, 'dungeons'))).toContain('gravehollow-keep/dungeon.json')
    expect(count('dungeons/gravehollow-keep/templates')).toBe(9)
    expect(count('loot-tables')).toBe(1)
    expect(count('chests')).toBe(8)
  })

  it('items and affixes', () => {
    expect(count('affixes')).toBe(4)
    expect(count('items')).toBe(32)
    expect(count('items/weapon')).toBe(2)
    expect(count('items/shield')).toBe(1)
    expect(count('items/armor')).toBe(7)
    expect(count('items/ring')).toBe(1)
    expect(count('items/relic')).toBe(1)
    expect(count('items/consumable')).toBe(6)
    expect(count('items/material')).toBe(4)
    expect(count('items/stone')).toBe(6)
    expect(count('items/key')).toBe(3)
    expect(count('items/egg')).toBe(1)
  })

  it('nothing the fixture folder must not carry: no schemas, examples, statuses or tuning of its own', () => {
    for (const dir of ['schemas', 'examples', 'statuses']) expect(fs.existsSync(path.join(fixtureContentDir, dir))).toBe(false)
    expect(fs.existsSync(path.join(fixtureContentDir, 'tuning.json'))).toBe(false)
  })
})

describe('the merged corpus through the sim content layer', () => {
  it('loads with loadContentDir and resolves the Warden kit, starters and the Ultimate', () => {
    const content = loadContentDir(path.join(root, 'content'))
    const warden = content.classes.get('warden')
    expect(warden).toBeDefined()
    for (const id of warden?.starterKit ?? []) expect(content.items.has(id), id).toBe(true)
    for (const id of warden?.starterSkillIds ?? []) expect(content.skills.has(id), id).toBe(true)
    expect(content.skills.get(warden?.ultimateSkillId ?? '')?.isUltimate).toBe(true)
    expect(content.monsters.size).toBe(7)
    expect(content.dungeons.get('gravehollow-keep')?.templates.length).toBe(9)
  })
})
