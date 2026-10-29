import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseRule } from '../../../../../sim/src/ai.ts'
import { heroAtLevel } from '../../../../../sim/src/hero.ts'
import { addHero, newProfile } from '../../../../../sim/src/town.ts'
import type { HeroRecord } from '../../../../../sim/src/types/content.ts'
import { heroLevelXpCost } from '../../../../../sim/src/xp.ts'
import { loadContentDir } from '../../../../../tools/sim/loadContent.ts'
import { formatStat, signed } from './labels.ts'
import { attributeGrowth, clauseText, gradeForActive, levelProgress, namesNotInLoadout, petActives, skillState } from './progress.ts'

const c = loadContentDir(path.resolve('content'))
const t = c.tuning

function warden(): HeroRecord {
  return addHero(c, newProfile(3), { name: 'Orrin', speciesId: 'dwarf', classId: 'warden', freePoints: { endurance: 2, strength: 2, vitality: 2 }, eggPetId: 'cellar-hound' }).hero
}

describe('the hero screen reads the record', () => {
  it('the XP line, Final Fantasy style (D-082)', () => {
    const h = warden()
    expect(levelProgress(t, h).label).toBe(`Lv 1 · 0 / ${heroLevelXpCost(t, 2)} XP to Lv 2`)
    const lv4 = heroAtLevel(c, t, h, 4)
    const more = { ...lv4, battleXp: lv4.battleXp + 37 }
    expect(levelProgress(t, more)).toMatchObject({ level: 4, into: 37, need: heroLevelXpCost(t, 5), atCap: false })
    expect(levelProgress(t, more).label).toBe(`Lv 4 · 37 / ${heroLevelXpCost(t, 5)} XP to Lv 5`)
  })

  it('attributes: the creation value, then growth from levels and from use', () => {
    const h = warden()
    expect(attributeGrowth(c, t, h, 'endurance')).toMatchObject({ now: 16, start: 16, fromLevels: 0, fromUse: 0 })
    const lv4 = heroAtLevel(c, t, h, 4)
    const grown = { ...lv4, attributes: { ...lv4.attributes, strength: lv4.attributes.strength + 1 } }
    const g = attributeGrowth(c, t, grown, 'strength')
    expect(g.start).toBe(h.attributes.strength)
    expect(g.fromUse).toBe(1)
    expect(g.now).toBe(g.start + g.fromLevels + g.fromUse)
    expect(attributeGrowth(c, t, h, 'luck').nextPercent).toBeNull()
  })

  it('skills: known with a rank, or where to get them', () => {
    const h = warden()
    expect(skillState(c, t, h, c.skills.get('warden-provoke')!)).toEqual({ known: true, rank: 1, mastery: false })
    expect(skillState(c, t, h, c.skills.get('warden-rallying-shout')!)).toMatchObject({ known: false, where: 'Skill Hall' })
    expect(skillState(c, t, h, c.skills.get('warden-challenge-all')!)).toMatchObject({ known: false, where: 'Opens at Lv 5' })
    const lv12 = heroAtLevel(c, t, h, 12)
    expect(skillState(c, t, lv12, c.skills.get('warden-the-gate-holds')!)).toMatchObject({ known: false, where: 'A Skill Tome: bosses, Skill Tome chests' })
    expect(skillState(c, t, lv12, c.skills.get('warden-intercept')!)).toMatchObject({ where: 'Skill Hall' })
    expect(skillState(c, t, lv12, c.skills.get('warden-shove')!)).toMatchObject({ where: 'Skill Hall' })
  })

  it('skills, Phase 7: techniques by watching (with the count), Tier IV never sold, Tier V locked', () => {
    const h = warden()
    const stand = c.skills.get('warden-bone-knights-stand')!
    expect(skillState(c, t, h, stand)).toMatchObject({ known: false, where: 'Watch a Bone Knight use Grave Guard' })
    expect(skillState(c, t, { ...h, techniqueWitness: { [stand.id]: 3 } }, stand)).toMatchObject({ where: `Watch a Bone Knight use Grave Guard · seen 3 of ${t.techniques.guaranteedByUse}` })
    expect(skillState(c, t, h, c.skills.get('warden-rampart')!)).toMatchObject({ known: false, where: 'Insight or a Skill Tome · Tier IV is for Lv 20' })
    expect(skillState(c, t, heroAtLevel(c, t, h, 20), c.skills.get('warden-rampart')!)).toMatchObject({ where: 'Insight or a Skill Tome (never sold)' })
    expect(skillState(c, t, h, c.skills.get('warden-aegis-of-the-keep')!)).toMatchObject({ known: false, locked: true, where: 'Locked: the endgame of later dungeons' })
  })

  it('the AI rule in plain words, and names the loadout does not carry', () => {
    const h = warden()
    const rule = parseRule(h.aiRule)
    expect(rule.errors).toEqual([])
    expect(rule.clauses.map(clauseText)[0]).toBe('If your HP < 30% → use small hp potion on yourself')
    expect(rule.clauses.map(clauseText).at(-1)).toBe('Otherwise → shield slam on the front enemy')
    expect(namesNotInLoadout(c, h, rule)).toEqual([])
    expect(namesNotInLoadout(c, h, parseRule('IF enemy status mark THEN aimed shot on marked enemy; ELSE provoke'))).toEqual(['aimed shot'])
  })

  it('pet actives by grade, then by level (03 §9)', () => {
    const h = warden()
    const def = c.pets.get('cellar-hound')!
    const views = petActives(c, t, def, h.petInstance!)
    expect(views.map((v) => v.state)).toEqual(['level', 'grade'])
    expect(views[1]!.note).toBe(`Needs a grade ${gradeForActive(t, 1)} pet`)
    expect(petActives(c, t, def, { ...h.petInstance!, level: 5 })[0]!.state).toBe('ready')
  })

  it('stat words', () => {
    expect(formatStat('fortune', 50)).toBe('5.0%')
    expect(formatStat('carry', 50)).toBe('50 kg')
    expect(formatStat('critRate', 5)).toBe('5%')
    expect(signed('speed', -5)).toBe('−5')
    expect(signed('block', 15)).toBe('+15%')
  })
})
