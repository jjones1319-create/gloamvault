import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { createFight, runFightAuto } from '../src/fight.ts'
import { buildMonsterActor } from '../src/monsters.ts'
import { buildPetActor } from '../src/pets.ts'
import { Rng } from '../src/rng.ts'
import { actionSkippedBy, applyStatus, hasStatus } from '../src/statuses.ts'
import type { MonsterDef } from '../src/types/content.ts'
import { example, loadTuning, makeContent, makeHeroActor } from './helpers.ts'

/**
 * D-127 (Proposed; 03 §3.5–§3.6). A control push (Freeze, Stun, Daze, Petrify) lands once until its target has had a
 * turn, so several appliers cannot chain-lock a slow hero (or a monster) out of a fight; a Stun, Freeze or Petrify costs
 * one action — the push is the skipped action ("skip the next action (energy −1,000)") — and the round keeps counting,
 * so round-keyed arena clocks and the round cap tick on.
 */
const tuning = loadTuning()
const content = makeContent()
const ratDef = example('monster', 'monster').json as MonsterDef

function hero(speed?: number) {
  const h = makeHeroActor(tuning, { id: 'hero-0', name: 'Warden', level: 4, attributes: { vitality: 14, endurance: 14 }, armorDefense: 20, aiRule: 'ELSE basic attack nearest' })
  if (speed !== undefined) h.base.speed = speed
  return h
}

describe('the push guard', () => {
  it('a second push before the target has had a turn applies the status, not the push', () => {
    const h = hero()
    h.energy = 500
    expect(applyStatus(content, tuning, Rng.fromSeed(1), h, { status: 'freeze', sourceId: 'a' }).outcome).toBe('applied')
    expect(h.energy).toBe(500 - 1000)
    expect(h.pushGuard).toBe(true)
    expect(applyStatus(content, tuning, Rng.fromSeed(2), h, { status: 'stun', sourceId: 'b' }).outcome).toBe('applied')
    expect(applyStatus(content, tuning, Rng.fromSeed(3), h, { status: 'daze', sourceId: 'c' }).outcome).toBe('applied')
    expect(h.energy).toBe(500 - 1000)
    expect(hasStatus(h, 'stun')).toBe(true)
    // Its turn came up (fight.ts takeTurn clears the guard): the next push lands again.
    h.pushGuard = false
    applyStatus(content, tuning, Rng.fromSeed(4), h, { status: 'daze', sourceId: 'c' })
    expect(h.energy).toBe(500 - 1000 - 500)
  })

  it('the tuning switch turns the guard off (every push lands, as before Phase 7)', () => {
    const off = { ...tuning, combat: { ...tuning.combat, pushGuard: { ...tuning.combat.pushGuard, value: false } } } as typeof tuning
    const h = hero()
    applyStatus(content, off, Rng.fromSeed(1), h, { status: 'freeze', sourceId: 'a' })
    applyStatus(content, off, Rng.fromSeed(2), h, { status: 'stun', sourceId: 'b' })
    expect(h.energy).toBe(-2000)
  })

  it('a Stun, a Freeze or a Petrify costs one action: the push, never a skipped turn as well', () => {
    for (const status of ['stun', 'freeze', 'petrify'] as const) {
      const h = hero()
      applyStatus(content, tuning, Rng.fromSeed(1), h, { status, sourceId: 'a' })
      expect(h.energy, status).toBe(-1000)
      expect(hasStatus(h, status), status).toBe(true)
      expect(actionSkippedBy(content, Rng.fromSeed(9), h), status).toBeNull()
    }
  })
})

describe('no chain-lock, and the round keeps counting', () => {
  // Three quick monsters whose every blow Chills (a second Chill is a Freeze): before D-127 a slow hero never acted again.
  const froster: MonsterDef = {
    ...ratDef,
    id: 'test-froster',
    name: 'Froster',
    speed: 125,
    attacks: [{ id: 'frost-lash', name: 'Frost Lash', damageType: 'frost', weight: 1000, multiplier: 0.05, target: 'enemy', effects: [{ kind: 'applyStatus', status: 'chill' }], aiWeight: 100, tell: null }],
    behavior: { rules: [{ if: 'always', then: 'frost-lash' }], fleesAtPercent: 0 },
    resist: [],
    weak: [],
    immune: [],
  }
  const withFroster = makeContent([{ kind: 'monster', path: 'monsters/test-froster.json', json: froster }])

  it('a slow hero frozen by three appliers still gets turns, and the rounds run to the cap', () => {
    const h = hero(80)
    h.hp = h.maxHp = 100_000 // outlasts the round cap: the test is about turns, not damage
    const monsters = [0, 1, 2].map((i) => {
      const m = buildMonsterActor(withFroster, tuning, froster, { id: `froster-${i}`, level: 4, row: 'front', hpPercent: 100 })
      m.hp = m.maxHp = 100_000
      return m
    })
    const state = createFight(withFroster, tuning, { heroes: [h], pets: [], monsters, surprised: null, light: 100, options: { dungeonId: 'g', floor: 1, floorLevel: 4, autoHeroes: true }, rng: Rng.fromSeed(7) })
    runFightAuto(withFroster, tuning, state)
    expect(state.over).not.toBeNull()
    const cap = tuning.combat.rounds.hardCap
    expect(state.round).toBeGreaterThanOrEqual(cap)
    const acted = state.actors.find((a) => a.id === 'hero-0')!.tally.actions
    // At least one turn in every two: each push costs one, and the next cannot land before the turn comes up.
    expect(acted).toBeGreaterThanOrEqual(Math.floor(cap / 2))
  })
})

describe('every hero fallen is a wipe, even with a pet standing (03 §12.2)', () => {
  it('a fight whose last hero has fallen ends in defeat at once, never runs on with the pet', () => {
    const real = loadContentDir(path.resolve('content'))
    const h = hero()
    h.hp = 0
    h.fallen = true
    const pet = buildPetActor(real, tuning, { petId: 'cellar-hound', name: 'Pip', grade: 'F', level: 4, xp: 0, bondStars: 0, traitRank: 1, stance: 'mend', ranchImport: null }, { id: 'pet-0', ownerId: 'hero-0', ownerLevel: 4, hpPercent: 100 })
    pet.hp = pet.maxHp = 100_000
    const rat = buildMonsterActor(real, tuning, ratDef, { id: 'rat-0', level: 1, row: 'front', hpPercent: 100 })
    rat.hp = rat.maxHp = 100_000
    const state = createFight(real, tuning, { heroes: [h], pets: [pet], monsters: [rat], surprised: null, light: 100, options: { dungeonId: 'g', floor: 1, floorLevel: 1, autoHeroes: true }, rng: Rng.fromSeed(3) })
    runFightAuto(real, tuning, state)
    expect(state.over?.outcome).toBe('defeat')
    expect(state.log.length).toBeLessThan(200)
  })
})
