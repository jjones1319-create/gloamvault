import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { EMPTY_PITY } from '../src/chests.ts'
import { createDelve, legalDelveActions, runDelveAuto, stepDelve } from '../src/delve.ts'
import type { DelveState } from '../src/delve-types.ts'
import { addBattleXp, heroAtLevel, loseLevels } from '../src/hero.ts'
import { Rng } from '../src/rng.ts'
import { encounterLevelOf, floorThreat, partyLevelOf, threatBand } from '../src/threat.ts'
import {
  addHero,
  buyChest,
  canChooseHero,
  chooseHero,
  heroOf,
  isDead,
  layToRest,
  livingHeroes,
  lowerDeathRule,
  newProfile,
  passLegacy,
  raiseAtShrine,
  settleDelve,
  shrineFee,
  startDelve,
  TownError,
  type Profile,
} from '../src/town.ts'
import { drawWayfarer, heroFromWayfarer, wayfarerOddsTable } from '../src/wayfarers.ts'
import { battleXpForLevel } from '../src/xp.ts'

/**
 * James's direction during Phase 4 (D-088–D-092): death under the Mortal rule, raising the dead, the Ember Shrine,
 * legacies and the chosen hero, the Wayfarer Chest, and the threat read.
 */
const content = loadContentDir(path.resolve('content'))
const t = content.tuning
const DUNGEON = 'gravehollow-keep'

function solo(deathRule: 'mortal' | 'sheltered' = 'mortal'): Profile {
  return addHero(content, newProfile(11, deathRule), { name: 'Orrin', speciesId: 'dwarf', classId: 'warden', freePoints: { strength: 2, endurance: 2, vitality: 2 }, eggPetId: 'cellar-hound' }).profile
}

/** A finished delve, settled: the party's records as they went in, the outcome forced, the named heroes fallen. */
function settleOver(p: Profile, outcome: 'cleared' | 'retreated' | 'wiped', fallenIds: string[]): ReturnType<typeof settleDelve> & { state: DelveState } {
  const started = startDelve(content, p, { dungeonId: DUNGEON, floor: 1 })
  const state = started.state
  for (const h of state.heroes) if (fallenIds.includes(h.record.id)) h.fallen = true
  state.phase = { kind: 'over', outcome, summary: outcome }
  return { ...settleDelve(content, started.profile, state), state }
}

describe('losing levels (D-089)', () => {
  it('takes back exactly what the levels gave', () => {
    const base = heroOf(solo(), 'hero-1')
    const at5 = heroAtLevel(content, t, base, 5)
    const at3 = heroAtLevel(content, t, base, 3)
    const lost = loseLevels(content, t, at5, 2)
    expect(lost.level).toBe(3)
    expect(lost.battleXp).toBe(battleXpForLevel(t, 3))
    expect(lost.attributes).toEqual(at3.attributes)
    expect(lost.creationValues).toEqual(at3.creationValues)
  })

  it('never goes below level 1 (a level-1 hero loses the XP toward level 2)', () => {
    const base = addBattleXp(content, t, heroOf(solo(), 'hero-1'), 30)
    expect(base.level).toBe(1)
    const lost = loseLevels(content, t, base, 2)
    expect(lost.level).toBe(1)
    expect(lost.battleXp).toBe(0)
    expect(lost.attributes).toEqual(base.attributes)
  })
})

describe('the threat read (D-092)', () => {
  it('bands an encounter against the party level', () => {
    expect(threatBand(t, 5, 5)).toBe('even')
    expect(threatBand(t, 6, 5)).toBe('even')
    expect(threatBand(t, 7, 5)).toBe('dangerous')
    expect(threatBand(t, 9, 5)).toBe('deadly')
    expect(threatBand(t, 3, 5)).toBe('easy')
    expect(partyLevelOf([1, 4])).toBe(2)
    expect(partyLevelOf([])).toBe(1)
  })

  it('champions and bosses read higher than their level', () => {
    expect(encounterLevelOf(t, [{ level: 4, championAffixes: 2, isBoss: false, isHunter: false }])).toBe(6)
    expect(encounterLevelOf(t, [{ level: 4, championAffixes: 0, isBoss: true, isHunter: false }])).toBe(7)
    // The Cellars' third floor and its Captain read Deadly to a fresh level-1 hero.
    const f3 = floorThreat(content, DUNGEON, 3, 1)!
    expect(f3.floor.band).toBe('dangerous')
    expect(f3.boss?.band).toBe('deadly')
  })
})

describe('Mortal in the dungeon (D-088, D-089)', () => {
  function party(): DelveState {
    let p = addHero(content, newProfile(5), { name: 'Orrin', speciesId: 'dwarf', classId: 'warden', eggPetId: null }).profile
    p = addHero(content, p, { name: 'Sister', speciesId: 'human', classId: 'mender', eggPetId: null }).profile
    return createDelve(content, { dungeonId: DUNGEON, floor: 1, seed: 99, difficulty: 'normal', pactIds: [], auto: false, policy: 'textbook', deathRule: 'mortal' }, p.heroes)
  }

  it('has no floor revive budget, and First Aid never reaches the dead', () => {
    const s = party()
    expect(s.floor.revivesLeft).toBe(0)
    s.heroes[0]!.fallen = true
    const actions = legalDelveActions(content, s)
    expect(actions.some((a) => a.command.kind === 'firstAid')).toBe(false)
    expect(() => stepDelve(content, s, { kind: 'firstAid', heroIndex: 1, targetIndex: 0 })).toThrow(/cannot raise the dead/)
  })

  it('a healer below level 10 cannot raise; at level 10 with a revive skill they can, for a level', () => {
    const s = party()
    s.heroes[0]!.record = heroAtLevel(content, t, s.heroes[0]!.record, 4)
    s.heroes[0]!.fallen = true
    expect(legalDelveActions(content, s).some((a) => a.command.kind === 'raise')).toBe(false)
    const mender = s.heroes[1]!
    mender.record = heroAtLevel(content, t, { ...mender.record, skills: [...mender.record.skills, { skillId: 'mender-breath-of-life', rank: 1, xp: 0 }] }, 10)
    const raise = legalDelveActions(content, s).find((a) => a.command.kind === 'raise')
    expect(raise?.enabled).toBe(true)
    stepDelve(content, s, raise!.command)
    expect(s.heroes[0]!.fallen).toBe(false)
    expect(s.heroes[0]!.record.level).toBe(3)
    expect(s.heroes[0]!.hpPercent).toBe(t.death.raise.hpPercent)
    expect(mender.poolPercent).toBe(100 - t.death.raise.healerPoolPercent)
    expect(s.stats.raises).toBe(1)
    // Once per healer per floor.
    s.heroes[0]!.fallen = true
    const again = legalDelveActions(content, s).find((a) => a.command.kind === 'raise')
    expect(again?.enabled).toBe(false)
  })

  it('a fresh solo hero on the Cellars dies for good often enough to fear it', () => {
    let wipes = 0
    for (let seed = 1; seed <= 12; seed++) {
      const p = addHero(content, newProfile(seed), { name: 'Solo', speciesId: 'human', classId: 'blade', eggPetId: null }).profile
      const s = runDelveAuto(content, createDelve(content, { dungeonId: DUNGEON, floor: 1, seed, difficulty: 'normal', pactIds: [], auto: true, policy: 'textbook', deathRule: 'mortal' }, p.heroes))
      if (s.phase.kind === 'over' && s.phase.outcome === 'wiped') wipes++
    }
    expect(wipes).toBeGreaterThan(0)
  })
})

describe('home again: the Shrine, legacies and the chosen hero (D-088–D-090)', () => {
  it('a body carried home lies at the Shrine; raising it costs gold and two levels', () => {
    let p = solo()
    p = { ...p, heroes: [heroAtLevel(content, t, p.heroes[0]!, 6)], purse: 5000 }
    p = addHero(content, p, { name: 'Bearer', speciesId: 'orc', classId: 'warden', eggPetId: null }).profile
    const { profile, summary } = settleOver(p, 'retreated', ['hero-1'])
    expect(summary.died).toEqual(['Orrin'])
    expect(isDead(profile, 'hero-1')).toBe(true)
    expect(profile.partyIds).toEqual(['hero-2'])
    expect(livingHeroes(profile).map((h) => h.id)).toEqual(['hero-2'])
    expect(() => startDelve(content, { ...profile, partyIds: ['hero-1'] }, { dungeonId: DUNGEON, floor: 1 })).toThrow(TownError)
    const fee = shrineFee(content, profile, 'hero-1')
    expect(fee).toBeGreaterThan(0)
    const raised = raiseAtShrine(content, profile, 'hero-1')
    expect(isDead(raised, 'hero-1')).toBe(false)
    expect(heroOf(raised, 'hero-1').level).toBe(4)
    expect(raised.purse).toBe(5000 - fee)
    expect(raised.partyIds).toEqual(['hero-2', 'hero-1'])
  })

  it('a wipe loses the party for good: gear and pet come home, the legacy waits, the Memorial remembers', () => {
    let p = solo()
    p = { ...p, heroes: [heroAtLevel(content, t, p.heroes[0]!, 4)] }
    const xp = p.heroes[0]!.battleXp
    const worn = p.heroes[0]!.equipment
    const gearCount = [worn.mainHand, worn.offHand, worn.helmet, worn.chest, worn.legs, worn.boots, worn.gloves, worn.ring[0], worn.ring[1], worn.talisman, worn.relic].filter(Boolean).length
    const { profile, summary } = settleOver(p, 'wiped', ['hero-1'])
    expect(summary.lost).toEqual(['Orrin'])
    expect(profile.heroes).toHaveLength(0)
    expect(profile.armory).toHaveLength(gearCount)
    expect(profile.stables.map((s) => s.petId)).toEqual(['cellar-hound'])
    expect(profile.memorial).toMatchObject([{ name: 'Orrin', chosen: true, how: 'wipe', dungeonId: DUNGEON }])
    expect(profile.legacies).toMatchObject([{ name: 'Orrin', xp: Math.floor((xp * t.death.legacy.percent) / 100), fromChosen: true }])
    expect(canChooseHero(content, profile)).toBe(true)
    // The next chosen hero takes the legacy at once; no creation egg after the first hero.
    const next = chooseHero(content, profile, { name: 'Brenna', speciesId: 'human', classId: 'mender', eggPetId: 'cellar-hound' })
    expect(next.legacy?.name).toBe('Orrin')
    expect(next.hero.battleXp).toBe(profile.legacies[0]!.xp)
    expect(next.hero.petInstance).toBeNull()
    expect(next.profile.legacies).toHaveLength(0)
    expect(next.profile.chosenId).toBe(next.hero.id)
    expect(canChooseHero(content, next.profile)).toBe(false)
  })

  it('a hero laid to rest leaves a legacy any living hero can take', () => {
    let p = solo()
    p = addHero(content, p, { name: 'Pip', speciesId: 'halfling', classId: 'ranger', eggPetId: null }).profile
    p = { ...p, heroes: p.heroes.map((h) => (h.id === 'hero-2' ? heroAtLevel(content, t, h, 5) : h)) }
    const settled = settleOver(p, 'cleared', ['hero-2']).profile
    const rested = layToRest(content, settled, 'hero-2')
    expect(rested.heroes.map((h) => h.id)).toEqual(['hero-1'])
    expect(rested.memorial[0]).toMatchObject({ name: 'Pip', how: 'laidToRest', chosen: false })
    const legacy = rested.legacies[0]!
    expect(legacy.fromChosen).toBe(false)
    const before = heroOf(rested, 'hero-1').battleXp
    const passed = passLegacy(content, rested, legacy.id, 'hero-1')
    expect(heroOf(passed, 'hero-1').battleXp).toBe(before + legacy.xp)
    expect(passed.legacies).toHaveLength(0)
  })

  it('Sheltered loses nobody; Mortal can be lowered to Sheltered but never raised', () => {
    const p = solo('sheltered')
    const { profile, summary } = settleOver(p, 'wiped', ['hero-1'])
    expect(summary.lost).toEqual([])
    expect(profile.heroes).toHaveLength(1)
    expect(lowerDeathRule(solo()).deathRule).toBe('sheltered')
    expect(lowerDeathRule(p).deathRule).toBe('sheltered')
  })
})

describe('the Wayfarer Chest (D-091)', () => {
  it('calls a wayfarer at the weakest living hero\'s level, who joins the party', () => {
    let p = { ...solo(), purse: 50_000 }
    p = { ...p, heroes: [heroAtLevel(content, t, p.heroes[0]!, 3)] }
    const { profile, result } = buyChest(content, p, 'standard-wayfarer-chest', null)
    expect(result.kind).toBe('wayfarer')
    if (result.kind !== 'wayfarer') return
    const hero = heroOf(profile, result.heroId)
    const def = content.wayfarers.get(result.wayfarerId)!
    expect(hero.name).toBe(def.name)
    expect(hero.classId).toBe(def.classId)
    expect(hero.level).toBe(3)
    expect(profile.wayfarerOf[result.heroId]).toBe(def.id)
    expect(profile.partyIds).toContain(result.heroId)
  })

  it('every wayfarer is unique until the cast runs out, and the Inn holds twelve', () => {
    let p: Profile = { ...solo(), purse: 1_000_000 }
    const seen = new Set<string>()
    for (let i = 0; i < 11; i++) {
      const r = buyChest(content, p, 'standard-wayfarer-chest', null)
      p = r.profile
      if (r.result.kind === 'wayfarer') {
        expect(seen.has(r.result.wayfarerId)).toBe(false)
        seen.add(r.result.wayfarerId)
      }
    }
    expect(p.heroes).toHaveLength(12)
    expect(() => buyChest(content, p, 'standard-wayfarer-chest', null)).toThrow(/Inn is full/)
  })

  it('pity forces a C or better on the tenth chest without one; nobody left returns null', () => {
    const chest = content.chests.get('standard-wayfarer-chest')!
    const forced = drawWayfarer(content, Rng.fromSeed(3), chest, 'F', { plusOneCounter: 9, plusTwoCounter: 0 }, new Set())!
    expect(['C', 'B', 'A']).toContain(forced.grade)
    expect(forced.pity.plusOneCounter).toBe(0)
    expect(drawWayfarer(content, Rng.fromSeed(3), chest, 'F', EMPTY_PITY, new Set(content.wayfarers.keys()))).toBeNull()
    const odds = wayfarerOddsTable(content, chest, 'F', new Set())
    expect(odds.map((o) => [o.grade, o.percent])).toEqual([['D', 50], ['C', 30], ['B', 15], ['A', 5]])
  })

  it('a wayfarer is built from the cast record: points, skills, rule and grade bonus', () => {
    for (const def of content.wayfarers.values()) {
      const h = heroFromWayfarer(content, t, Rng.fromSeed(1), def, 'hero-x', 1)
      expect(h.skills.map((s) => s.skillId).slice(0, 3)).toEqual(def.starterSkillIds)
      expect(h.aiRule).toBe(def.aiRule ?? content.classes.get(def.classId)!.aiRuleDefault)
      expect(h.loadout.passives.filter(Boolean).length).toBe(def.starterSkillIds.filter((id) => content.skills.get(id)?.type === 'passive').length)
    }
  })
})

describe('every hero down is a wipe (03 §12.2)', () => {
  it('a pet that wins the fight after its solo hero died does not walk the delve on alone', () => {
    // The balance runner's seed 93 for "solo warden, ground": the Warden dies on floor 3 and the Cellar Hound finishes
    // the fight. Before the fix the delve walked between two rooms until the 3,000-command cap.
    const egg = [...content.pets.values()].find((p) => p.creationChoice)
    let h = heroOf(addHero(content, newProfile(93), { name: 'warden-1', speciesId: 'human', classId: 'warden', freePoints: { endurance: 2, vitality: 2, strength: 2 }, eggPetId: egg?.id ?? null }).profile, 'hero-1')
    h = heroAtLevel(content, t, h, 12)
    if (h.petInstance) h = { ...h, petInstance: { ...h.petInstance, level: 12, stance: 'mend' }, loadout: { ...h.loadout, stance: 'mend' } }
    for (const deathRule of ['mortal', 'sheltered'] as const) {
      for (let seed = 90; seed <= 96; seed++) {
        const s = runDelveAuto(content, createDelve(content, { dungeonId: DUNGEON, zone: 1, seed, difficulty: 'normal', pactIds: [], auto: true, policy: 'textbook', deathRule }, [h]), 3000)
        expect(s.phase.kind).toBe('over')
        if (s.phase.kind === 'over') expect(s.phase.outcome).not.toBe('capped')
        if (s.heroes.every((x) => x.fallen) && s.phase.kind === 'over') expect(s.phase.outcome).toBe('wiped')
      }
    }
  })
})
