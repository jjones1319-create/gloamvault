import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { createDelve, runDelveAuto } from '../src/delve.ts'
import type { FightState } from '../src/fight-types.ts'
import { monsterBaseline } from '../src/monsters.ts'
import { fightXpPool } from '../src/progress.ts'
import { addHero, lowerDeathRule, lowerRulesFor, newProfile, nightmareBlocker, settleDelve, startDelve, TownError, type Profile } from '../src/town.ts'
import { heroLevelXpCost, levelGapMultiplier } from '../src/xp.ts'

/**
 * James's answers at checkpoint 1 (D-095–D-097): the Nightmare death rule, battle XP split through the party and scaled
 * by the level gap to the party's average, and a level curve where every level costs more than the one before.
 */
const content = loadContentDir(path.resolve('content'))
const t = content.tuning
const DUNGEON = 'gravehollow-keep'

/** A Nightmare save: the chosen hero (hero-1) and a second hero standing in for a wayfarer (hero-2). */
function nightmarePair(): Profile {
  let p = addHero(content, newProfile(21, 'nightmare'), { name: 'Orrin', speciesId: 'dwarf', classId: 'blade', eggPetId: null }).profile
  p = addHero(content, p, { name: 'Ilse', speciesId: 'human', classId: 'mender', eggPetId: null }).profile
  return { ...p, chosenId: 'hero-1', wayfarerOf: { 'hero-2': 'wayfarer-x' } }
}

describe('Nightmare (D-095)', () => {
  it('the chosen hero leads every delve', () => {
    const p = nightmarePair()
    expect(nightmareBlocker({ ...p, partyIds: ['hero-2'] })).toMatch(/Orrin leads every delve/)
    expect(() => startDelve(content, { ...p, partyIds: ['hero-2'] }, { dungeonId: DUNGEON, floor: 1 })).toThrow(TownError)
    const { state } = startDelve(content, p, { dungeonId: DUNGEON, floor: 1 })
    expect(state.options.deathRule).toBe('nightmare')
    expect(state.options.leaderId).toBe('hero-1')
    // Mortal and Sheltered never ask.
    expect(nightmareBlocker({ ...p, deathRule: 'mortal', partyIds: ['hero-2'] })).toBeNull()
  })

  it("the leader's death ends the delve at once, even when the rest of the party stands", () => {
    const p = nightmarePair()
    let ended = 0
    for (let seed = 1; seed <= 30; seed++) {
      const s = runDelveAuto(content, createDelve(content, { dungeonId: DUNGEON, floor: 1, seed, difficulty: 'normal', pactIds: [], auto: true, policy: 'textbook', deathRule: 'nightmare', leaderId: 'hero-1' }, p.heroes))
      expect(s.phase.kind).toBe('over')
      if (s.phase.kind !== 'over') continue
      const leader = s.heroes[0]!
      if (leader.fallen) {
        ended++
        expect(['chosenDied', 'wiped']).toContain(s.phase.outcome)
        if (s.phase.outcome === 'chosenDied') expect(s.heroes.some((h) => !h.fallen)).toBe(true)
      } else expect(s.phase.outcome).not.toBe('chosenDied')
    }
    expect(ended).toBeGreaterThan(0)
  })

  it('settling the leader\'s death ends the save: everything is lost and the Hall keeps a line', () => {
    let p = nightmarePair()
    p = { ...p, purse: 120, bank: 900, materials: { 'copper-ingot': 4 } }
    const started = startDelve(content, p, { dungeonId: DUNGEON, floor: 1 })
    started.state.heroes[0]!.fallen = true
    started.state.phase = { kind: 'over', outcome: 'chosenDied', summary: 'Orrin died' }
    const r = settleDelve(content, started.profile, started.state)
    expect(r.hall).not.toBeNull()
    expect(r.hall?.name).toBe('Orrin')
    expect(r.hall?.how).toBe('fell')
    expect(r.hall?.wayfarers).toBe(1)
    expect(r.summary.ended).toBe(true)
    expect(r.profile.heroes).toHaveLength(0)
    expect(r.profile.bank).toBe(0)
    expect(r.profile.purse).toBe(0)
    expect(r.profile.materials).toEqual({})
    expect(r.profile.deathRule).toBe('nightmare')
  })

  it("a wayfarer's death under Nightmare is a Mortal death: carried home to the Shrine", () => {
    const p = nightmarePair()
    const started = startDelve(content, p, { dungeonId: DUNGEON, floor: 1 })
    started.state.heroes[1]!.fallen = true
    started.state.phase = { kind: 'over', outcome: 'retreated', summary: 'walked out' }
    const r = settleDelve(content, started.profile, started.state)
    expect(r.hall).toBeNull()
    expect(r.profile.dead.map((d) => d.heroId)).toEqual(['hero-2'])
    expect(r.profile.heroes).toHaveLength(2)
  })

  it('a rule can be lowered in town, never raised', () => {
    const p = nightmarePair()
    expect(lowerRulesFor('nightmare')).toEqual(['mortal', 'sheltered'])
    expect(lowerRulesFor('mortal')).toEqual(['sheltered'])
    expect(lowerRulesFor('sheltered')).toEqual([])
    expect(lowerDeathRule(p, 'mortal').deathRule).toBe('mortal')
    expect(lowerDeathRule(p, 'sheltered').deathRule).toBe('sheltered')
    expect(lowerDeathRule({ ...p, deathRule: 'mortal' }, 'nightmare').deathRule).toBe('mortal')
    const inDelve = startDelve(content, p, { dungeonId: DUNGEON, floor: 1 }).profile
    expect(() => lowerDeathRule(inDelve, 'mortal')).toThrow(/only be lowered in town/)
  })
})

/** A won fight's actors, enough for the pool: heroes at the given levels and defeated monsters. */
function wonFight(heroLevels: number[], monsters: { level: number; xpClass: number; affixes?: number; boss?: boolean }[]): FightState {
  const actors = [
    ...heroLevels.map((level, i) => ({ id: `hero-${i}`, kind: 'hero', side: 'party', level, fallen: false, gone: false, fled: false })),
    ...monsters.map((m, i) => ({
      id: `m-${i}`,
      kind: 'monster',
      side: 'enemy',
      level: m.level,
      gone: true,
      fled: false,
      monster: { xpClass: m.xpClass, isBoss: m.boss ?? false, isHunter: false, champion: m.affixes ? { affixIds: Array.from({ length: m.affixes }, (_, k) => `a${k}`) } : null },
    })),
  ]
  return { actors } as unknown as FightState
}

describe('battle XP and the level gap (D-096)', () => {
  it('reads the curve: ×0.25 at 5 below, ×2 at 5 above, ×3 at the cap, linear between', () => {
    expect(levelGapMultiplier(t, -12)).toBe(5)
    expect(levelGapMultiplier(t, -5)).toBe(25)
    expect(levelGapMultiplier(t, -2)).toBe(70)
    expect(levelGapMultiplier(t, 0)).toBe(100)
    expect(levelGapMultiplier(t, 2)).toBe(140)
    expect(levelGapMultiplier(t, 5)).toBe(200)
    expect(levelGapMultiplier(t, 14)).toBe(300)
  })

  it("the party's average level decides the multiplier, so a weaker hero raises everyone's pool", () => {
    const unit = (level: number) => monsterBaseline(t, level).xpUnit
    const pack = [
      { level: 6, xpClass: 1 },
      { level: 6, xpClass: 2 },
    ]
    const level = fightXpPool(t, wonFight([6, 6], pack))
    expect(level).toBe(unit(6) * 3)
    // Average 6 either way.
    expect(fightXpPool(t, wonFight([2, 10], pack))).toBe(level)
    // A party five levels above: a quarter.
    expect(fightXpPool(t, wonFight([11, 11], pack))).toBe(Math.round(unit(6) * 0.25) + Math.round(unit(6) * 2 * 0.25))
    // A strong hero alone (gap −4 → ×0.4) against the same strong hero with a weak wayfarer (average 6: ×1.0).
    expect(fightXpPool(t, wonFight([10, 2], pack))).toBeGreaterThan(fightXpPool(t, wonFight([10], pack)))
  })

  it('champions and bosses count as the threat chip counts them', () => {
    const unit = monsterBaseline(t, 5).xpUnit
    expect(fightXpPool(t, wonFight([5], [{ level: 5, xpClass: 1, affixes: 2 }]))).toBe(Math.round(unit * 1.4))
    expect(fightXpPool(t, wonFight([5], [{ level: 5, xpClass: 1, boss: true }]))).toBe(Math.round(unit * 1.6))
  })
})

describe('the level curve (D-097)', () => {
  it('every level costs more battle XP than the one before', () => {
    expect(heroLevelXpCost(t, 2)).toBe(60)
    for (let level = 3; level <= 40; level++) expect(heroLevelXpCost(t, level)).toBeGreaterThan(heroLevelXpCost(t, level - 1))
  })
})
