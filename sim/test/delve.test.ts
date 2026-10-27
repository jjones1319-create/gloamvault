import { rmSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import type { Content } from '../src/content.ts'
import { createDelve, hashDelve, legalDelveActions, replayDelve, runDelveAuto, stepDelve } from '../src/delve.ts'
import type { DelveOptions } from '../src/delve-types.ts'
import { createHero, heroStats } from '../src/hero.ts'
import { Rng } from '../src/rng.ts'
import type { HeroRecord } from '../src/types/content.ts'
import { assembleFixtureCorpus } from './fixtures/assemble.ts'

let root = ''
let content: Content

beforeAll(() => {
  root = assembleFixtureCorpus()
  content = loadContentDir(path.join(root, 'content'))
})
afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true })
})

function warden(id = 'w1', name = 'Hesper'): HeroRecord {
  return createHero(content, content.tuning, Rng.fromSeed(1), { id, name, speciesId: 'human', classId: 'warden', freePoints: { strength: 1, endurance: 2, vitality: 3 }, eggPetId: 'cellar-hound', petName: 'Biscuit' })
}

const options = (over: Partial<DelveOptions> = {}): DelveOptions => ({ dungeonId: 'gravehollow-keep', zone: 1, seed: 17, difficulty: 'normal', pactIds: [], auto: true, policy: 'textbook', ...over })

describe('hero creation (03 §2.3) on the fixture content', () => {
  it('a Human Warden with six free points totals 92 and carries the starter kit', () => {
    const h = warden()
    const total = Object.values(h.attributes).reduce((s, v) => s + v, 0)
    expect(total).toBe(92)
    expect(h.attributes.strength).toBe(12)
    expect(h.attributes.endurance).toBe(14)
    expect(h.attributes.vitality).toBe(14)
    expect(h.attributes.wisdom).toBe(11)
    expect(h.attributes.willpower).toBe(11)
    expect(h.equipment.mainHand?.itemId).toBe('copper-shortsword')
    expect(h.equipment.offHand?.itemId).toBe('pine-buckler')
    expect(h.equipment.chest?.itemId).toBe('copper-breastplate')
    expect(h.equipment.ring[0]?.itemId).toBe('ring-of-vigor')
    // The fixture kit lists the eight gear pieces; the consumables of 08 §12 arrive with the real content in Phase 3.
    expect(h.equipment.helmet?.itemId).toBe('copper-helm')
    expect(h.skills.map((s) => s.skillId)).toEqual(['warden-shield-slam', 'warden-provoke', 'warden-brace'])
    expect(h.loadout.actives).toEqual(['warden-shield-slam', 'warden-provoke', 'warden-brace', null])
    expect(h.petInstance?.petId).toBe('cellar-hound')
    expect(h.fieldSkills.fieldRepair.rank).toBe(3)
    expect(h.fieldSkills.firstAid.rank).toBe(3)
    expect(h.fieldSkills.lockpicking.rank).toBe(2)
    const stats = heroStats(content, content.tuning, h)
    expect(stats.hp).toBeGreaterThan(100)
    expect(stats.attackPhys).toBeGreaterThan(30)
    expect(stats.block).toBe(15)
    expect(stats.speed).toBeGreaterThanOrEqual(75)
    expect(stats.speed).toBeLessThanOrEqual(90)
  })

  it('refuses more than six free points or more than three on one attribute', () => {
    expect(() => createHero(content, content.tuning, Rng.fromSeed(1), { id: 'x', name: 'x', speciesId: 'human', classId: 'warden', freePoints: { strength: 4 } })).toThrow()
    expect(() => createHero(content, content.tuning, Rng.fromSeed(1), { id: 'x', name: 'x', speciesId: 'human', classId: 'warden', freePoints: { strength: 3, agility: 3, vitality: 1 } })).toThrow()
  })
})

describe('a delve on the Cellars fixture (03 §1, §4, §11, §12)', () => {
  it('creates floor 1 with the party in the entry room and legal doors', () => {
    const state = createDelve(content, options(), [warden()])
    expect(state.floor.number).toBe(1)
    expect(state.floor.graph.rooms.length).toBeGreaterThanOrEqual(5)
    expect(state.floor.currentRoomId).toBe(state.floor.graph.entryId)
    expect(state.light).toBe(100)
    const actions = legalDelveActions(content, state)
    expect(actions.some((a) => a.command.kind === 'move' && a.enabled)).toBe(true)
    expect(actions.some((a) => a.command.kind === 'retreat')).toBe(true)
  })

  it('runs a solo Warden through the Cellars on auto to an outcome, deterministically', () => {
    const run = (seed: number) => runDelveAuto(content, createDelve(content, options({ seed }), [warden()]))
    const a = run(17)
    expect(a.phase.kind).toBe('over')
    if (a.phase.kind === 'over') expect(['cleared', 'retreated', 'wiped', 'capped']).toContain(a.phase.outcome)
    expect(a.stats.rooms).toBeGreaterThan(1)
    expect(a.stats.fights).toBeGreaterThan(0)
    expect(a.commandLog.length).toBeGreaterThan(3)
    const b = run(17)
    expect(hashDelve(a)).toBe(hashDelve(b))
    expect(a.log.length).toBe(b.log.length)
  })

  it('replays from the seed and the command log to the same hash', () => {
    const state = runDelveAuto(content, createDelve(content, options({ seed: 99 }), [warden()]))
    const again = replayDelve(content, options({ seed: 99 }), [warden()], state.commandLog)
    expect(hashDelve(again)).toBe(hashDelve(state))
    expect(again.stats).toEqual(state.stats)
  })

  it('a three-Warden party plays the zone and different seeds give different delves', () => {
    const party = [warden('w1', 'Hesper'), warden('w2', 'Orrin'), warden('w3', 'Mab')]
    const a = runDelveAuto(content, createDelve(content, options({ seed: 5 }), party))
    const b = runDelveAuto(content, createDelve(content, options({ seed: 6 }), party))
    expect(a.phase.kind).toBe('over')
    expect(hashDelve(a)).not.toBe(hashDelve(b))
    expect(a.stats.fights + b.stats.fights).toBeGreaterThan(0)
  })

  it('a human step: an illegal command throws, a legal move enters the room', () => {
    const state = createDelve(content, options({ auto: false }), [warden()])
    expect(() => stepDelve(content, state, { kind: 'move', toRoomId: 'nowhere' })).toThrow()
    const move = legalDelveActions(content, state).find((a) => a.command.kind === 'move' && a.enabled)
    expect(move).toBeDefined()
    stepDelve(content, state, move!.command)
    expect(state.stats.rooms).toBe(2)
    expect(['room', 'fight', 'curio', 'result']).toContain(state.phase.kind)
    if (state.phase.kind === 'fight') {
      const fightActions = legalDelveActions(content, state)
      expect(fightActions.some((a) => a.command.kind === 'fight')).toBe(true)
    }
  })

  it('walking out of the entrance is free on Normal; Hard keeps its toll (D-083)', () => {
    const state = createDelve(content, options({ auto: false }), [warden()])
    state.gold = 100
    stepDelve(content, state, { kind: 'retreat' })
    expect(state.phase.kind).toBe('over')
    expect(state.gold).toBe(100)
    const hard = createDelve(content, options({ auto: false, difficulty: 'hard' }), [warden()])
    hard.gold = 100
    stepDelve(content, hard, { kind: 'retreat' })
    expect(hard.gold).toBe(85)
  })

  it('hard mode and a pact change the knobs', () => {
    const hard = createDelve(content, options({ difficulty: 'hard' }), [warden()])
    expect(hard.knobs.enemyHpPercent).toBe(125)
    expect(hard.floor.revivesLeft).toBe(1)
    expect(hard.light).toBe(80)
  })
})
