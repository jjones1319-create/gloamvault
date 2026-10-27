import { rmSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import type { Content } from '../src/content.ts'
import { createDelve, legalDelveActions, stepDelve } from '../src/delve.ts'
import type { DelveOptions, DelveState } from '../src/delve-types.ts'
import { applyBattleXpLevel, createHero, heroAtLevel, levelUpGains } from '../src/hero.ts'
import { choosePolicyCommand } from '../src/policies.ts'
import { Rng } from '../src/rng.ts'
import type { HeroRecord } from '../src/types/content.ts'
import { battleXpForLevel, heroLevelForXp, heroLevelXpCost } from '../src/xp.ts'
import { assembleFixtureCorpus } from './fixtures/assemble.ts'

// The shipped content (classes with attribute bonuses) and the fixture dungeon (a small, stable floor set).
const real = loadContentDir(path.resolve('content'))
const t = real.tuning
let root = ''
let fixture: Content

beforeAll(() => {
  root = assembleFixtureCorpus()
  fixture = loadContentDir(path.join(root, 'content'))
})
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('Final Fantasy-style hero levels (D-082)', () => {
  it('the curve: level N costs 60 × 1.28^(N−2) battle XP', () => {
    expect(heroLevelXpCost(t, 1)).toBe(0)
    expect(heroLevelXpCost(t, 2)).toBe(60)
    expect(heroLevelXpCost(t, 5)).toBe(126)
    expect(heroLevelXpCost(t, 10)).toBe(432)
    expect(heroLevelForXp(t, 0)).toBe(1)
    expect(heroLevelForXp(t, 59)).toBe(1)
    expect(heroLevelForXp(t, 60)).toBe(2)
    for (const lv of [2, 5, 8, 15]) {
      expect(heroLevelForXp(t, battleXpForLevel(t, lv))).toBe(lv)
      expect(heroLevelForXp(t, battleXpForLevel(t, lv) - 1)).toBe(lv - 1)
    }
  })

  it('level-ups grow the class bonus attributes in turn and Vitality every second level', () => {
    // Blade: +2 Str, +2 Agi → L2 Str, L3 Agi, L4 Str, L5 Agi; Vitality at L2 and L4.
    expect(levelUpGains(real, t, 'blade', 1, 5)).toEqual({ strength: 2, agility: 2, vitality: 2 })
    expect(levelUpGains(real, t, 'blade', 1, 1)).toEqual({})
  })

  it('applies the level and the growth to the record, raising the soft-cap base with it', () => {
    const h = createHero(real, t, Rng.fromSeed(1), { id: 'b', name: 'Blade', speciesId: 'human', classId: 'blade', freePoints: { strength: 2, agility: 2, vitality: 2 }, eggPetId: null })
    expect(h.level).toBe(1)
    expect(h.battleXp).toBe(0)
    const up = applyBattleXpLevel(real, t, { ...h, battleXp: battleXpForLevel(t, 5) + 3 })
    expect(up.level).toBe(5)
    expect(up.attributes.strength).toBe(h.attributes.strength + 2)
    expect(up.attributes.vitality).toBe(h.attributes.vitality + 2)
    expect(up.creationValues.agility).toBe(h.creationValues.agility + 2)
    expect(heroAtLevel(real, t, h, 8).level).toBe(8)
  })
})

function fixtureHero(): HeroRecord {
  return createHero(fixture, fixture.tuning, Rng.fromSeed(5), { id: 'w', name: 'Orrin', speciesId: 'human', classId: 'warden', freePoints: { strength: 2, endurance: 2, vitality: 2 }, eggPetId: 'cellar-hound' })
}

function stepUntil(state: DelveState, done: (s: DelveState) => boolean, limit = 400): DelveState {
  const prng = Rng.fromSeed(99)
  let s = state
  for (let i = 0; i < limit && !done(s) && s.phase.kind !== 'over'; i++) {
    const cmd = choosePolicyCommand('textbook', s, legalDelveActions(fixture, s), prng)
    if (!cmd) break
    s = stepDelve(fixture, s, cmd)
  }
  return s
}

describe('battle XP after a won fight (D-082)', () => {
  it('every hero standing at the end of a victory takes the fight\'s XP', () => {
    const opts: DelveOptions = { dungeonId: 'gravehollow-keep', zone: 1, seed: 17, difficulty: 'normal', pactIds: [], auto: true, policy: 'textbook' }
    const state = stepUntil(createDelve(fixture, opts, [fixtureHero()]), (s) => s.phase.kind === 'result' && s.phase.title === 'Victory')
    expect(state.phase.kind).toBe('result')
    expect(state.heroes[0]!.record.battleXp).toBeGreaterThan(0)
  })
})

describe('leaving the dungeon (D-083)', () => {
  it('only from the floor\'s entrance or its end, and free', () => {
    const opts: DelveOptions = { dungeonId: 'gravehollow-keep', zone: 1, seed: 17, difficulty: 'normal', pactIds: [], auto: true, policy: 'textbook' }
    let state = createDelve(fixture, opts, [fixtureHero()])
    expect(state.floor.currentRoomId).toBe(state.floor.graph.entryId)
    const atEntry = legalDelveActions(fixture, state).find((a) => a.command.kind === 'retreat')
    expect(atEntry?.label).toBe('Walk out to town')
    // Step into another room: no way out there.
    const move = legalDelveActions(fixture, state).find((a) => a.command.kind === 'move' && a.enabled)!
    state = stepDelve(fixture, state, move.command)
    while (state.phase.kind !== 'room' && state.phase.kind !== 'over') state = stepDelve(fixture, state, legalDelveActions(fixture, state).find((a) => a.enabled)!.command)
    if (state.phase.kind === 'room' && state.floor.currentRoomId !== state.floor.graph.exitId) {
      expect(legalDelveActions(fixture, state).some((a) => a.command.kind === 'retreat')).toBe(false)
      expect(() => stepDelve(fixture, structuredClone(state), { kind: 'retreat' })).toThrow()
    }
    // Reach the stairs: "Teleport out" records the floor as finished and keeps the gold.
    state = stepUntil(state, (s) => s.phase.kind === 'room' && s.floor.currentRoomId === s.floor.graph.exitId)
    if (state.phase.kind === 'room') {
      const out = legalDelveActions(fixture, state).find((a) => a.command.kind === 'retreat')
      expect(out?.label).toBe('Teleport out to town')
      const gold = state.gold
      state = stepDelve(fixture, state, { kind: 'retreat' })
      expect(state.phase.kind).toBe('over')
      expect(state.gold).toBe(gold)
      expect(state.stats.deepestFloorCompleted).toBe(state.floor.number)
    }
  })
})
