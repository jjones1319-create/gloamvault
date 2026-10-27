import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createHero } from '../../../../../sim/src/hero.ts'
import { Rng } from '../../../../../sim/src/rng.ts'
import { loadContentDir } from '../../../../../tools/sim/loadContent.ts'
import {
  EMPTY_DRAFT,
  STEPS,
  addPoint,
  canAddPoint,
  cleanName,
  eggOptions,
  firstSentence,
  furthestStep,
  modParts,
  pointsSpent,
  provisionalHero,
  roleShort,
  skillOptions,
  stepBlocker,
  suggestPoints,
  suggestedName,
  toggleSkill,
  type Draft,
} from './draft.ts'

const c = loadContentDir(path.resolve('content'))
const t = c.tuning
const open = { closed: false, firstHero: true }

function full(overrides: Partial<Draft> = {}): Draft {
  return { ...EMPTY_DRAFT, speciesId: 'dwarf', classId: 'warden', skillIds: [...c.classes.get('warden')!.starterSkillIds], eggPetId: 'cellar-hound', points: suggestPoints(t, c.classes.get('warden')), name: 'Orrin', ...overrides }
}

describe('new hero: free points (03 §2.3)', () => {
  it('suggests six points round the class bonus attributes, never more than three on one', () => {
    expect(suggestPoints(t, c.classes.get('warden'))).toEqual({ endurance: 2, strength: 2, vitality: 2 })
    expect(suggestPoints(t, c.classes.get('blade'))).toEqual({ strength: 3, agility: 3 })
    for (const cls of c.classes.values()) {
      const p = suggestPoints(t, cls)
      expect(pointsSpent(p)).toBe(t.attributes.creation.freePoints)
      for (const v of Object.values(p)) expect(v).toBeLessThanOrEqual(t.attributes.creation.maxFreePerAttribute)
    }
  })

  it('caps one attribute at three and the total at six; Luck takes points too', () => {
    let p = {}
    for (let i = 0; i < 5; i++) p = addPoint(t, p, 'luck', 1)
    expect(p).toEqual({ luck: 3 })
    expect(canAddPoint(t, p, 'luck')).toBe(false)
    p = addPoint(t, addPoint(t, addPoint(t, p, 'wisdom', 1), 'wisdom', 1), 'wisdom', 1)
    expect(pointsSpent(p)).toBe(6)
    expect(canAddPoint(t, p, 'agility')).toBe(false)
    expect(addPoint(t, p, 'agility', 1)).toBe(p)
    expect(addPoint(t, addPoint(t, p, 'luck', -1), 'agility', 1)).toEqual({ luck: 2, wisdom: 3, agility: 1 })
    expect(addPoint(t, {}, 'agility', -1)).toEqual({})
  })
})

describe('new hero: skills and eggs', () => {
  it('offers the Tier I actives, plus a passive only when the class recommends it', () => {
    const warden = skillOptions(c, 'warden').map((s) => s.id)
    expect(warden).toHaveLength(6)
    expect(warden).not.toContain('warden-wall-stance')
    expect(skillOptions(c, 'warden').every((s) => s.tier === 1 && s.type === 'active' && !s.isUltimate)).toBe(true)
    const ranger = skillOptions(c, 'ranger').map((s) => s.id)
    expect(ranger).toContain('ranger-keen-eyes')
    expect(ranger).not.toContain('ranger-quick-hands')
    for (const cls of c.classes.values()) for (const id of cls.starterSkillIds) expect(skillOptions(c, cls.id).map((s) => s.id)).toContain(id)
  })

  it('three picks at most; tapping a pick frees it', () => {
    expect(toggleSkill(['a', 'b'], 'c')).toEqual(['a', 'b', 'c'])
    expect(toggleSkill(['a', 'b', 'c'], 'd')).toBeNull()
    expect(toggleSkill(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })

  it('the egg is one of three creation choices', () => {
    expect(eggOptions(c).map((p) => p.id).sort()).toEqual(['cellar-hound', 'rat-prince', 'spiderling'])
  })
})

describe('new hero: steps', () => {
  it('each step opens Next only when it is done', () => {
    expect(stepBlocker(c, 'species', EMPTY_DRAFT, open)).not.toBeNull()
    expect(stepBlocker(c, 'species', full(), { closed: true, firstHero: false })).toMatch(/still lives/)
    // A later chosen hero brings no egg (D-090): the egg step is done without one.
    expect(stepBlocker(c, 'egg', { ...full(), eggPetId: null }, { closed: false, firstHero: false })).toBeNull()
    expect(stepBlocker(c, 'class', full({ classId: null }), open)).not.toBeNull()
    expect(stepBlocker(c, 'skills', full({ skillIds: ['warden-provoke'] }), open)).toBe('Pick 2 more.')
    expect(stepBlocker(c, 'egg', full({ eggPetId: 'drakeling' }), open)).not.toBeNull()
    expect(stepBlocker(c, 'points', full({ points: { strength: 1 } }), open)).toBe('Place 5 more points.')
    expect(stepBlocker(c, 'points', full({ name: '   ' }), open)).not.toBeNull()
    for (const s of STEPS) expect(stepBlocker(c, s, full(), open)).toBeNull()
    expect(furthestStep(c, EMPTY_DRAFT, open)).toBe(0)
    expect(furthestStep(c, full({ eggPetId: null }), open)).toBe(STEPS.indexOf('egg'))
    expect(furthestStep(c, full(), open)).toBe(STEPS.length - 1)
  })

  it('the preview hero is exactly what Create builds', () => {
    const d = full()
    const preview = provisionalHero(c, d)!
    const made = createHero(c, t, Rng.fromSeed(99), { id: 'x', name: 'Orrin', speciesId: 'dwarf', classId: 'warden', freePoints: d.points, starterSkillIds: d.skillIds, eggPetId: 'cellar-hound' })
    expect(preview.attributes).toEqual(made.attributes)
    expect(preview.equipment.mainHand?.itemId).toBe(made.equipment.mainHand?.itemId)
    expect(provisionalHero(c, full({ classId: null }))).toBeNull()
  })
})

describe('new hero: words', () => {
  it('names: a few per species, cycling; cleaned to 16 characters', () => {
    for (const s of c.species.keys()) expect(suggestedName(s)).toMatch(/^[A-Z][a-z]+$/)
    expect(suggestedName('dwarf', 0)).toBe('Orrin')
    expect(suggestedName('dwarf', 6)).toBe('Orrin')
    expect(cleanName('  Sir   Reginald the Very Long  ')).toBe('Sir Reginald the')
  })

  it('attribute lines, blurbs and roles', () => {
    expect(modParts(c.species.get('dwarf')!.attributeMods).map((m) => `${m.attr}${m.value}`)).toEqual(['endurance2', 'strength1', 'vitality1', 'agility-2'])
    expect(firstSentence(c.species.get('dwarf')!.creationBlurb)).toBe("Forge-row's finest.")
    expect(roleShort(c.classes.get('warden')!.role)).toBe('front-line tank')
  })
})
