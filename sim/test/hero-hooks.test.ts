import { rmSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import type { Content } from '../src/content.ts'
import { buildHeroActor, createHero } from '../src/hero.ts'
import { Rng } from '../src/rng.ts'
import type { HeroRecord } from '../src/types/content.ts'
import { assembleFixtureCorpus } from './fixtures/assemble.ts'

let root = ''
let content: Content

beforeAll(() => {
  root = assembleFixtureCorpus()
  content = loadContentDir(path.join(root, 'content'))
})
afterAll(() => rmSync(root, { recursive: true, force: true }))

function warden(passives: [string | null, string | null]): HeroRecord {
  const h = createHero(content, content.tuning, Rng.fromSeed(3), { id: 'w', name: 'Orrin', speciesId: 'dwarf', classId: 'warden', freePoints: { strength: 2, endurance: 2, vitality: 2 }, eggPetId: null })
  const skills = passives.filter((p): p is string => p !== null).map((skillId) => ({ skillId, rank: 1, xp: 0 }))
  return { ...h, skills: [...h.skills, ...skills], loadout: { ...h.loadout, passives } }
}

describe('loadout passives on the fight actor (D-071)', () => {
  it('a passive\'s stat lines are fight-long modifiers and its custom lines are hooks', () => {
    const rec = warden(['warden-wall-stance', null])
    const actor = buildHeroActor(content, content.tuning, rec, { id: 'hero-0', row: 'front' })
    const fromStance = actor.modifiers.filter((m) => m.sourceId === 'warden-wall-stance')
    expect(fromStance.length).toBeGreaterThan(0)
    expect(fromStance.every((m) => m.turnsLeft > 1000)).toBe(true)
    expect(actor.hooks.map((h) => h.customId).sort()).toEqual(['armor-wear-multiplier', 'pool-on-block'])
    expect(actor.hooks.every((h) => h.sourceSkillId === 'warden-wall-stance' && h.turnsLeft === null)).toBe(true)
  })

  it('an empty passive slot installs nothing; a species without trait lines adds no hooks', () => {
    const actor = buildHeroActor(content, content.tuning, warden([null, null]), { id: 'hero-0', row: 'front' })
    expect(actor.hooks).toEqual([])
    expect(actor.modifiers).toEqual([])
  })
})
