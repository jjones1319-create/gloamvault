import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { addHero, newProfile } from '../../../../../sim/src/town.ts'
import type { HeroRecord } from '../../../../../sim/src/types/content.ts'
import { attributePointCost, skillRankThreshold } from '../../../../../sim/src/xp.ts'
import { loadContentDir } from '../../../../../tools/sim/loadContent.ts'
import { attributeGrowthLines, fieldSkillGrowthLines, growthNote, heroXpBonusPercent, skillGrowthLines } from './growth.ts'

const c = loadContentDir(path.resolve('content'))
const t = c.tuning

function hero(speciesId = 'dwarf', classId = 'warden'): HeroRecord {
  return addHero(c, newProfile(3), { name: 'Orrin', speciesId, classId, eggPetId: null }).hero
}

describe('the status screen’s growth lines (03 §5)', () => {
  it('count the uses to an attribute’s next point from the counter the sim keeps', () => {
    const h = hero()
    const str = h.attributes.strength
    const cost = attributePointCost(t, str + 1)
    // A Dwarf at Wisdom 10 earns 1 XP a tagged use: the whole cost, then the cost less what is banked.
    const fresh = attributeGrowthLines(c, t, h).find((l) => l.key === 'strength')!
    expect(fresh.step).toBe(`${str} → ${str + 1}`)
    expect(fresh.text).toMatch(new RegExp(`^about ${cost} more melee hits`))
    const banked = attributeGrowthLines(c, t, { ...h, attributeXp: { ...h.attributeXp, strength: 500 } }).find((l) => l.key === 'strength')!
    expect(banked.text).toMatch(new RegExp(`^about ${cost - 5} more melee hits`))
    expect(banked.percent).toBe(Math.floor((500 * 100) / (cost * 100)))
  })

  it('name the loadout skills that train an attribute, and Luck never grows', () => {
    const lines = attributeGrowthLines(c, t, hero())
    const trained = lines.filter((l) => l.text.includes('or uses of'))
    expect(trained.length).toBeGreaterThan(0)
    expect(lines.find((l) => l.key === 'luck')).toMatchObject({ percent: null })
    expect(lines.map((l) => l.key)).toEqual(['strength', 'agility', 'vitality', 'endurance', 'wisdom', 'perception', 'willpower', 'luck'])
  })

  it('slow down past the soft cap', () => {
    const h = hero()
    const capped = { ...h, attributes: { ...h.attributes, strength: h.creationValues.strength + 2 * h.level } }
    expect(attributeGrowthLines(c, t, capped).find((l) => l.key === 'strength')!.text).toMatch(/soft cap/)
  })

  it('count a Human’s and a wise hero’s bonus', () => {
    expect(heroXpBonusPercent(c, t, hero('dwarf'))).toBe(0)
    expect(heroXpBonusPercent(c, t, hero('human'))).toBeGreaterThan(0)
  })

  it('count the uses to a skill’s next rank, and mark mastery', () => {
    const h = hero()
    const id = h.loadout.actives.find((x) => x !== null)!
    const line = skillGrowthLines(c, t, h).find((l) => l.key === id)!
    expect(line.step).toBe('rank 1 → 2')
    expect(line.text).toBe(`about ${Math.ceil(skillRankThreshold(t, 2) / t.xp.skill.xpPerUse)} more uses`)
    const mastered = { ...h, skills: h.skills.map((k) => (k.skillId === id ? { ...k, rank: t.xp.skill.maxRank } : k)) }
    expect(skillGrowthLines(c, t, mastered).find((l) => l.key === id)).toMatchObject({ percent: null, text: expect.stringMatching(/^mastered/) })
  })

  it('show the field skills’ XP toward their next rank', () => {
    const h = hero()
    const lines = fieldSkillGrowthLines(t, { ...h, fieldSkills: { ...h.fieldSkills, trapDisarm: { rank: 1, xp: 30 } } })
    expect(lines).toHaveLength(8)
    const disarm = lines.find((l) => l.key === 'trapDisarm')!
    expect(disarm.text).toBe(`${skillRankThreshold(t, 2) - 30} XP to go · grows with each trap disarmed`)
    expect(disarm.percent).toBe(Math.floor((30 * 100) / skillRankThreshold(t, 2)))
  })

  it('say what "about N more" assumes, from tuning', () => {
    expect(growthNote(t)).toMatch(/^Counted at an even fight\. Foes 5 levels above you count ×2 \(up to ×3\), foes 10 below count ×0\.1\. Each delve, a skill’s first 20 uses count in full\.$/)
  })
})
