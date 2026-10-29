import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { buildTomeBag, openTownChest, EMPTY_PITY } from '../src/chests.ts'
import type { Content } from '../src/content.ts'
import type { DelveHero } from '../src/delve-types.ts'
import type { FightState } from '../src/fight-types.ts'
import { createHero } from '../src/hero.ts'
import { rollTechnique, techniqueChanceBp } from '../src/insight.ts'
import { floorUsesFor, rollInsightFor, rollTechniqueFor, witnessedTechniques } from '../src/progress.ts'
import { Rng } from '../src/rng.ts'
import { createTome, duplicateTomeXp, isObtainable, isTomeSkill, itemValue, readTomeOnHero, tomeCandidates, tomeName, tomeReadBlocker, tomeSkill, tomeValue } from '../src/tomes.ts'
import { addHero, newProfile, readTome, sellItem, townR, TownError, type Profile } from '../src/town.ts'
import type { HeroRecord, SkillDef } from '../src/types/content.ts'
import { skillRankThreshold } from '../src/xp.ts'

/**
 * Phase 7, pass A: monster techniques live (09 §4 — a witnessed use rolls a flat 10%, the 10th is certain; D-028,
 * D-099), Insights that keep their pity and drop a Tome for the party (03 §7.5), and Skill Tomes as items (08 §4,
 * §10.2): read in town by a hero of the class, a duplicate is rank XP, never a technique or Tier V.
 */
const base = loadContentDir(path.resolve('content'))
const t = base.tuning

/** The content with the Wraith's two techniques linked as the generators link them (independent of the link flag). */
function linked(): Content {
  const skills = new Map(base.skills)
  const link = (id: string, monsterId: string, moveIds?: string[]): void => {
    const s = skills.get(id)
    if (!s) throw new Error(`no skill ${id}`)
    skills.set(id, { ...s, monsterTechniqueOf: monsterId, ...(moveIds ? { monsterTechniqueMoveIds: moveIds } : {}) })
  }
  link('mender-wraiths-lament', 'wraith', ['wail'])
  link('shade-wraith-step', 'wraith', ['drift'])
  link('arcanist-hags-cauldron', 'brine-hag')
  const skillsByClass = new Map([...base.skillsByClass].map(([classId, list]) => [classId, list.map((s) => skills.get(s.id) ?? s)]))
  return { ...base, skills, skillsByClass }
}

function hero(classId: string, extraSkills: string[] = [], id = 'h1'): HeroRecord {
  const h = createHero(base, t, Rng.fromSeed(5), { id, name: 'Tobin', speciesId: 'human', classId, eggPetId: null })
  return { ...h, skills: [...h.skills, ...extraSkills.map((skillId) => ({ skillId, rank: 1, xp: 0 }))] }
}

/** A fight whose log holds `uses` (monster actor id → attack ids) and actors standing in for them. */
function fightWith(actors: { id: string; name: string; monsterId: string }[], uses: { actorId: string; attackId?: string; text?: string }[]): FightState {
  return {
    actors: actors.map((a) => ({ id: a.id, name: a.name, monster: { monsterId: a.monsterId } })),
    log: uses.map((u) => ({ tick: 1, round: 1, kind: 'action', actorId: u.actorId, text: u.text ?? `x uses y`, ...(u.attackId ? { data: { attackId: u.attackId } } : {}) })),
  } as unknown as FightState
}

describe('monster techniques (09 §4, D-028, D-099)', () => {
  it('rolls a flat 10% per witnessed use and is certain on the 10th', () => {
    expect(techniqueChanceBp(t)).toBe(t.techniques.percentPerWitnessedUse * 100)
    expect(t.techniques.guaranteedByUse).toBe(10)
    const rng = Rng.fromSeed(1)
    expect(rollTechnique(t, rng, 10)).toBe(true)
    expect(rollTechnique(t, rng, 11)).toBe(true)
    // Below the guarantee the flat chance decides: about 10% of many first sightings.
    let hits = 0
    const r2 = Rng.fromSeed(99)
    for (let i = 0; i < 4000; i++) if (rollTechnique(t, r2, 1)) hits++
    expect(hits).toBeGreaterThan(300)
    expect(hits).toBeLessThan(500)
  })

  it("counts only the technique's own move (data.attackId, or the action's text)", () => {
    const content = linked()
    const fight = fightWith(
      [{ id: 'm1', name: 'Wraith', monsterId: 'wraith' }],
      [
        { actorId: 'm1', attackId: 'wail' },
        { actorId: 'm1', attackId: 'chill-touch' },
        { actorId: 'm1', text: 'Wraith uses Drift' },
        { actorId: 'm1', text: 'Wraith uses Wail on Tobin' },
      ],
    )
    const seen = witnessedTechniques(content, fight)
    expect(seen.filter((s) => s === 'mender-wraiths-lament')).toHaveLength(2)
    expect(seen.filter((s) => s === 'shade-wraith-step')).toHaveLength(1)
  })

  it('a technique with no move list is witnessed on any of its monster’s moves', () => {
    const content = linked()
    const fight = fightWith([{ id: 'm2', name: 'Brine Hag', monsterId: 'brine-hag' }], [{ actorId: 'm2', attackId: 'cackle' }, { actorId: 'm2', attackId: 'brine-claw' }])
    expect(witnessedTechniques(content, fight).filter((s) => s === 'arcanist-hags-cauldron')).toHaveLength(2)
  })

  it('nothing is witnessed while the skill is not linked to the monster', () => {
    const unlinked: Content = { ...base, skills: new Map([...base.skills].map(([id, s]) => [id, { ...s, monsterTechniqueOf: null }])) }
    const fight = fightWith([{ id: 'm1', name: 'Wraith', monsterId: 'wraith' }], [{ actorId: 'm1', attackId: 'wail' }])
    expect(witnessedTechniques(unlinked, fight)).toEqual([])
  })

  it('needs the class and the prerequisite; counts on the hero; the 10th teaches and clears the count', () => {
    const content = linked()
    const rng = Rng.fromSeed(3)
    // A Blade never learns the Mender's Lament; a Mender without Censure does not roll (mender.md §8).
    expect(rollTechniqueFor(content, t, rng, hero('blade', ['blade-open-vein']), 'mender-wraiths-lament').learned).toBe(false)
    const noPrereq = rollTechniqueFor(content, t, rng, hero('mender'), 'mender-wraiths-lament')
    expect(noPrereq.learned).toBe(false)
    expect(noPrereq.hero.techniqueWitness?.['mender-wraiths-lament']).toBeUndefined()
    // With Censure each witnessed use counts until it lands; never later than the 10th.
    let h = hero('mender', ['mender-censure'])
    let uses = 0
    let learned = false
    const always = { int: () => 9_999, pct: () => false, pick: <T,>(xs: readonly T[]) => xs[0]! } as unknown as Rng
    while (!learned && uses < 20) {
      uses++
      const r = rollTechniqueFor(content, t, always, h, 'mender-wraiths-lament')
      h = r.hero
      learned = r.learned
      if (!learned) expect(h.techniqueWitness?.['mender-wraiths-lament']).toBe(uses)
    }
    expect(uses).toBe(10)
    expect(h.skills.some((s) => s.skillId === 'mender-wraiths-lament')).toBe(true)
    expect(h.techniqueWitness?.['mender-wraiths-lament']).toBeUndefined()
    // Known: no further rolls.
    expect(rollTechniqueFor(content, t, rng, h, 'mender-wraiths-lament').learned).toBe(false)
  })
})

describe('Insight (03 §7.5) as of Phase 7', () => {
  it('never offers a technique, the Ultimate or Tier V, and the pity counter is the one passed in', () => {
    const content = linked()
    const used = content.skills.get('mender-censure')!
    const h = hero('mender', ['mender-censure', 'mender-radiance', 'mender-smite'])
    const counter = { usesSincePity: t.skills.insight.pityUses - 1 }
    // The pity lands on this use; the only Tier III Sanctity candidates are Judgement's line (needs Holy Lance) and Hallowed Ground (needs Ward of Faith), so nothing … or a non-technique.
    const learned = rollInsightFor(content, t, Rng.fromSeed(7), h, counter, used, 1)
    if (learned) {
      expect(learned.monsterTechniqueOf).toBeNull()
      expect(learned.isUltimate).toBe(false)
      expect(learned.tier).toBeLessThanOrEqual(t.skills.obtainableTierMax.value)
      expect(counter.usesSincePity).toBe(0)
    }
    // Tier V is designed but locked (D-099): obtainable stops at IV.
    const v = [...content.skills.values()].find((s) => s.tier === 5)
    if (v) expect(isObtainable(t, v)).toBe(false)
  })
})

describe('Skill Tomes (08 §4, §10.2; 03 §7.5)', () => {
  it('a Tome is the one tome item with the skill on the instance', () => {
    const inst = createTome(base, Rng.fromSeed(2), 'warden-shield-slam')
    expect(base.items.get(inst.itemId)?.kind).toBe('tome')
    expect(inst.skillId).toBe('warden-shield-slam')
    expect(tomeSkill(base, inst)?.id).toBe('warden-shield-slam')
    expect(tomeName(base, inst)).toBe('Skill Tome: Shield Slam')
  })

  it('never carries a technique, Tier V, or a field or pet skill', () => {
    const content = linked()
    const lament = content.skills.get('mender-wraiths-lament')!
    expect(isTomeSkill(t, lament)).toBe(false)
    for (const s of content.skills.values()) {
      if (s.classId === 'field' || s.classId === 'pet') expect(isTomeSkill(t, s)).toBe(false)
      if (s.tier === 5) expect(isTomeSkill(t, s)).toBe(false)
      if (s.monsterTechniqueLater) expect(isTomeSkill(t, s)).toBe(false)
    }
    const bag = buildTomeBag(content, 'mender', { min: 3, max: 4 }, new Set())
    expect(bag['3']).not.toContain('mender-wraiths-lament')
    expect(bag['4']).not.toContain('mender-trolls-regrowth')
    expect(tomeCandidates(content, 'mender', 5, new Set())).toEqual([])
  })

  it('reading teaches an unknown skill; a duplicate is one rank of XP', () => {
    const h = hero('warden')
    const smite = base.skills.get('warden-intercept')!
    const learned = readTomeOnHero(t, h, smite)
    expect(learned.outcome.kind).toBe('learned')
    expect(learned.hero.skills.find((s) => s.skillId === smite.id)?.rank).toBe(1)
    const again = readTomeOnHero(t, learned.hero, smite)
    expect(again.outcome).toMatchObject({ kind: 'rankXp', ranksGained: 1 })
    expect(again.hero.skills.find((s) => s.skillId === smite.id)?.xp).toBe(skillRankThreshold(t, 2))
    expect(duplicateTomeXp(t, 1)).toBe(skillRankThreshold(t, 2))
  })

  it('in town: a hero of the class reads it from the bag or the bank; it is used up', () => {
    let p: Profile = addHero(base, newProfile(9), { name: 'Bram', speciesId: 'human', classId: 'warden', eggPetId: null }).profile
    p = addHero(base, p, { name: 'Ilse', speciesId: 'human', classId: 'mender', eggPetId: null }).profile
    const warden = p.heroes.find((h) => h.classId === 'warden')!
    const mender = p.heroes.find((h) => h.classId === 'mender')!
    const banked = createTome(base, Rng.fromSeed(4), 'warden-intercept')
    const carried = createTome(base, Rng.fromSeed(5), 'warden-intercept')
    p = { ...p, armory: [...p.armory, banked], heroes: p.heroes.map((h) => (h.id === warden.id ? { ...h, bag: [...h.bag, carried] } : h)) }
    expect(() => readTome(base, p, mender.id, banked.instanceId)).toThrow(TownError)
    expect(tomeReadBlocker(base, mender, banked)).toMatch(/Only a Warden/)
    const first = readTome(base, p, warden.id, banked.instanceId)
    expect(first.outcome.kind).toBe('learned')
    expect(first.profile.armory.some((i) => i.instanceId === banked.instanceId)).toBe(false)
    const second = readTome(base, first.profile, warden.id, carried.instanceId)
    expect(second.outcome.kind).toBe('rankXp')
    expect(second.profile.heroes.find((h) => h.id === warden.id)!.bag.some((i) => i.instanceId === carried.instanceId)).toBe(false)
  })

  it('sells for its tier (08 §4: the Hall’s price in R)', () => {
    let p: Profile = addHero(base, newProfile(9), { name: 'Bram', speciesId: 'human', classId: 'warden', eggPetId: null }).profile
    const t1 = createTome(base, Rng.fromSeed(6), 'warden-shield-slam')
    const t3 = createTome(base, Rng.fromSeed(7), 'warden-crushing-rebuke')
    const r = townR(p)
    expect(itemValue(base, t1, r)).toBe(tomeValue(t, 1, r))
    expect(itemValue(base, t3, r)).toBeGreaterThan(itemValue(base, t1, r))
    p = { ...p, armory: [t1, t3] }
    const sold = sellItem(base, p, t3.instanceId)
    expect(sold.purse).toBeGreaterThan(p.purse)
  })

  it('a Skill Tome chest gives a Tome item, never the skill straight into the hero', () => {
    const chest = base.chests.get('standard-skill-tome')!
    const out = openTownChest(base, t, Rng.fromSeed(11), { chest, bandGrade: 'F', luck: 10, pity: EMPTY_PITY, classId: 'warden', heroSkillIds: new Set() })
    expect(out.result.kind).toBe('tome')
    if (out.result.kind === 'tome') {
      expect(out.result.inst.skillId).toBe(out.result.skillId)
      expect(base.items.get(out.result.inst.itemId)?.kind).toBe('tome')
    }
  })
})

describe('floor-limited passives (D-099)', () => {
  it("reads one floor's triggers from the delve hero", () => {
    const dh = { skillUses: { 'floor:3:blade-undying-rage': 1, 'floor:2:blade-undying-rage': 1, 'blade-twin-cut': 4 } } as unknown as DelveHero
    expect(floorUsesFor(dh, 3)).toEqual({ 'blade-undying-rage': 1 })
    expect(floorUsesFor(dh, 4)).toEqual({})
  })
})

void ({} as SkillDef)
