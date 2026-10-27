import { describe, expect, it } from 'vitest'
import { applyLine, canAct, dealDamage, statOf, type EffectContext } from '../src/effects.ts'
import { applyFightCommand, createFight, legalFightActions, runFight, runFightAuto } from '../src/fight.ts'
import type { FightState } from '../src/fight-types.ts'
import { hashState } from '../src/hash.ts'
import { buildMonsterActor } from '../src/monsters.ts'
import { Rng } from '../src/rng.ts'
import { applyStatus, countDownStatuses, hasStatus, pendingTicks } from '../src/statuses.ts'
import type { MonsterDef, SkillDef } from '../src/types/content.ts'
import { exactTuning, example, loadTuning, makeContent, makeHeroActor } from './helpers.ts'

const tuning = loadTuning()
const exact = exactTuning(tuning)

const SHIELD_SLAM = example('skill', 'skill')
const PROVOKE: SkillDef = {
  id: 'warden-provoke',
  classId: 'warden',
  school: 'warcry',
  tier: 1,
  name: 'Provoke',
  description: 'Taunt 2 turns; +10 Momentum.',
  type: 'active',
  cost: 8,
  weight: 800,
  target: 'enemy',
  effects: [
    { kind: 'taunt', duration: 2 },
    { kind: 'momentum', amount: 10, target: 'self' },
  ],
  prerequisiteId: null,
  isUltimate: false,
  monsterTechniqueOf: null,
  rankScaling: { effectPerRank: 4, costPerRank: -2 },
  mastery: { text: 'Taunt 3 turns.', effects: [{ kind: 'taunt', duration: 3 }] },
  tags: ['taunt', 'control'],
  xpTags: ['willpower'],
  aiHints: { role: 'control', priority: 70 },
}
const GIANT_RAT = example('monster', 'monster')
const ratDef = GIANT_RAT.json as MonsterDef
const cutpurseDef: MonsterDef = {
  ...ratDef,
  id: 'grinning-cutpurse',
  name: 'Grinning Cutpurse',
  size: 'medium',
  multipliers: { hp: 0.9, attack: 0.9, defense: 0.8 },
  speed: 110,
  attacks: [
    { id: 'shank', name: 'Shank', damageType: 'pierce', weight: 800, multiplier: 0.9, target: 'enemy', effects: [{ kind: 'applyStatus', status: 'bleed', chance: 20, duration: 2 }], aiWeight: 70, tell: null },
    { id: 'net', name: 'Net', damageType: 'blunt', weight: 1000, multiplier: 0, target: 'enemy', effects: [{ kind: 'applyStatus', status: 'grab' }], aiWeight: 30, tell: 'he swings the net' },
  ],
  behavior: { rules: [{ if: 'always', then: 'shank' }], fleesAtPercent: 0 },
  resist: [],
  weak: [],
  immune: [],
}

const content = makeContent([SHIELD_SLAM, { kind: 'skill', path: 'skills/warden/warden-provoke.json', json: PROVOKE }, GIANT_RAT, { kind: 'monster', path: 'monsters/grinning-cutpurse.json', json: cutpurseDef }])

function warden(id = 'warden', aiRule?: string) {
  // warden.md §8: L4, Str 12 · Agi 10 · Vit 12 · End 14 · Will 11; Bronze Sword Attack 14 (req 10); Crude Plate Def 20; Kite shield 25%.
  return makeHeroActor(tuning, {
    id,
    name: 'Warden',
    level: 4,
    attributes: { strength: 12, vitality: 12, endurance: 14, willpower: 11 },
    weapon: { attack: 14, type: 'sword', damageType: 'slash', weight: 1000, strengthRequirement: 10 },
    armorDefense: 20,
    armorPieces: [
      { penaltyShare: 3, strengthRequirement: 10 },
      { penaltyShare: 8, strengthRequirement: 12 },
      { penaltyShare: 5, strengthRequirement: 11 },
      { penaltyShare: 2, strengthRequirement: 9 },
      { penaltyShare: 2, strengthRequirement: 9 },
    ],
    shieldBlock: 25,
    actives: ['warden-shield-slam', 'warden-provoke', null, null],
    ranks: { 'warden-shield-slam': 1, 'warden-provoke': 1 },
    aiRule: aiRule ?? 'IF ally HP < 40% THEN provoke; ELSE shield slam front enemy',
  })
}

function cutpurse(id = 'cutpurse') {
  const a = buildMonsterActor(content, tuning, cutpurseDef, { id, level: 4, row: 'front', hpPercent: 100 })
  a.base.defense = 14
  a.hp = a.maxHp = 56
  return a
}

function ctxFor(state: FightState, t = tuning, seed = 1): EffectContext {
  return { content, t, state, rng: Rng.fromSeed(seed) }
}

describe('the damage pipeline (03 §2.2, warden.md §8)', () => {
  it('Shield Slam on the Cutpurse: Attack 42 × 1.3 through Defense 14 = 48 at fixed variance; a basic attack 37', () => {
    const w = warden()
    expect(w.base.attackPhys).toBe(42)
    expect(w.base.defense).toBe(34)
    expect(w.maxHp).toBe(126)
    expect(w.base.stamina).toBe(72)
    const c = cutpurse()
    const state = createFight(content, exact, { heroes: [w], pets: [], monsters: [c], surprised: null, light: 100, options: { dungeonId: 'gravehollow-keep', floor: 3, floorLevel: 4 }, rng: Rng.fromSeed(5) })
    const ctx = ctxFor(state, exact, 5)
    // No crits, no misses, no variance: pin the rolls by stripping the chances.
    w.base.critRate = 0
    w.base.accuracy = 100
    w.base.variance = 100
    const src = { kind: 'skill' as const, id: 'warden-shield-slam', label: 'Shield Slam', isUltimate: false, neverMisses: true, effectPercent: 100, reach: false, ranged: false, isMelee: true }
    const slam = applyLine(ctx, w, { kind: 'damage', multiplier: 1.3, damageType: 'blunt' }, 'enemyFront', c, src)
    expect(slam.results[0]?.dealt).toBe(48)
    const basic = applyLine(ctx, w, { kind: 'damage', multiplier: 1.0, damageType: 'slash' }, 'enemyFront', c, { ...src, label: 'basic' })
    expect(basic.results[0]?.dealt).toBe(37)
    expect(c.hp).toBe(56 - 48 - 37 < 0 ? 0 : 56 - 48 - 37)
    expect(c.gone).toBe(true)
  })

  it('a rat bite on the Warden: 18 × 100 / 134 = 13, halved by Block or Guard; a Shield absorbs first', () => {
    const w = warden()
    const rat = buildMonsterActor(content, tuning, ratDef, { id: 'rat', level: 4, row: 'front', hpPercent: 100 })
    rat.base.attackPhys = 18
    rat.base.accuracy = 100
    rat.base.critRate = 0
    rat.base.variance = 100
    const state = createFight(content, exact, { heroes: [w], pets: [], monsters: [rat], surprised: null, light: 100, options: { dungeonId: 'g', floor: 1, floorLevel: 1 }, rng: Rng.fromSeed(2) })
    const ctx = ctxFor(state, exact, 2)
    w.base.block = 0
    const plain = dealDamage(ctx, rat, w, { amount: 18, damageType: 'pierce', canMiss: false, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: true, ignoresDefense: false, sourceLabel: 'bite' })
    // Plate is weak to Pierce: ×1.25 → 23 → 23 × 100 / 134 = 17.
    expect(plain.dealt).toBe(17)
    expect(plain.weaknessHit).toBe(true)
    w.guarding = true
    const guarded = dealDamage(ctx, rat, w, { amount: 18, damageType: 'blunt', canMiss: false, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: true, ignoresDefense: false, sourceLabel: 'bite' })
    expect(guarded.guarded).toBe(true)
    expect(guarded.dealt).toBe(7)
    w.guarding = false
    applyStatus(content, tuning, ctx.rng, w, { status: 'shield', magnitude: 10, sourceId: null })
    const shielded = dealDamage(ctx, rat, w, { amount: 18, damageType: 'blunt', canMiss: false, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: true, ignoresDefense: false, sourceLabel: 'bite' })
    expect(shielded.absorbed).toBe(10)
    expect(shielded.dealt).toBe(3)
    expect(hasStatus(w, 'shield')).toBe(false)
  })
})

describe('statuses in a fight (03 §3.5)', () => {
  it('Bleed ticks 25% of the applying hit per stack at turn start, stacks to 3, and counts down at turn end', () => {
    const w = warden()
    const state = createFight(content, tuning, { heroes: [w], pets: [], monsters: [cutpurse()], surprised: null, light: 100, options: { dungeonId: 'g', floor: 1, floorLevel: 1 }, rng: Rng.fromSeed(3) })
    const rng = Rng.fromSeed(3)
    expect(applyStatus(content, tuning, rng, w, { status: 'bleed', magnitude: 40, sourceId: 'cutpurse' }).outcome).toBe('applied')
    applyStatus(content, tuning, rng, w, { status: 'bleed', magnitude: 20, sourceId: 'cutpurse' })
    applyStatus(content, tuning, rng, w, { status: 'bleed', magnitude: 20, sourceId: 'cutpurse' })
    applyStatus(content, tuning, rng, w, { status: 'bleed', magnitude: 20, sourceId: 'cutpurse' })
    const bleed = w.statuses.find((s) => s.id === 'bleed')!
    expect(bleed.stacks).toBe(3)
    expect(bleed.magnitude).toBe(10)
    const ticks = pendingTicks(content, w)
    expect(ticks).toEqual([{ status: 'bleed', kind: 'dot', amount: 30, damageType: 'slash', ignoresDefense: true, sourceId: 'cutpurse' }])
    countDownStatuses(w)
    countDownStatuses(w)
    expect(hasStatus(w, 'bleed')).toBe(true)
    expect(countDownStatuses(w)).toEqual(['bleed'])
    expect(hasStatus(w, 'bleed')).toBe(false)
    void state
  })

  it('a second Chill becomes Freeze; a boss takes Chill again; Stun becomes Daze on a boss; Poison on an immune monster does nothing', () => {
    const rng = Rng.fromSeed(4)
    const w = warden()
    expect(applyStatus(content, tuning, rng, w, { status: 'chill', sourceId: null }).outcome).toBe('applied')
    const second = applyStatus(content, tuning, rng, w, { status: 'chill', sourceId: null })
    expect(second).toEqual({ outcome: 'applied', status: 'freeze', upgraded: true })
    expect(hasStatus(w, 'chill')).toBe(false)
    expect(hasStatus(w, 'freeze')).toBe(true)
    expect(w.energy).toBe(-1000)
    const boss = buildMonsterActor(content, tuning, { ...cutpurseDef, id: 'boss', role: 'boss', boss: { phases: [{ atHpPercent: 100, attacks: ['shank'], adds: [], arenaRule: null }, { atHpPercent: 50, attacks: ['shank', 'net'], adds: [], arenaRule: null }], everyKill: [], firstKill: [], immunities: ['petrify', 'grab', 'web', 'root', 'fear'], cannotFlee: true } }, { id: 'boss', level: 4, row: 'back', hpPercent: 100 })
    boss.base.resistance = 0
    expect(applyStatus(content, tuning, rng, boss, { status: 'stun', sourceId: null })).toEqual({ outcome: 'applied', status: 'daze', upgraded: false })
    expect(boss.energy).toBe(-500)
    applyStatus(content, tuning, rng, boss, { status: 'chill', sourceId: null })
    expect(applyStatus(content, tuning, rng, boss, { status: 'chill', sourceId: null })).toEqual({ outcome: 'applied', status: 'chill', upgraded: false })
    expect(applyStatus(content, tuning, rng, boss, { status: 'grab', sourceId: null }).outcome).toBe('immune')
    const rat = buildMonsterActor(content, tuning, { ...ratDef, statusImmune: ['poison'] }, { id: 'r', level: 1, row: 'front', hpPercent: 100 })
    expect(applyStatus(content, tuning, rng, rat, { status: 'poison', sourceId: null }).outcome).toBe('immune')
  })

  it('Chill slows: Speed reads ×0.75 while held', () => {
    const w = warden()
    const state = createFight(content, tuning, { heroes: [w], pets: [], monsters: [cutpurse()], surprised: null, light: 100, options: { dungeonId: 'g', floor: 1, floorLevel: 1 }, rng: Rng.fromSeed(6) })
    const ctx = ctxFor(state)
    const before = statOf(ctx, w, 'speed')
    applyStatus(content, tuning, ctx.rng, w, { status: 'chill', sourceId: null })
    expect(statOf(ctx, w, 'speed')).toBe(Math.floor(before * 0.75 + 0.5))
  })

  it('Grab holds the hero until the grabber takes 10% of its HP', () => {
    const w = warden()
    const c = cutpurse()
    const state = createFight(content, tuning, { heroes: [w], pets: [], monsters: [c], surprised: null, light: 100, options: { dungeonId: 'g', floor: 1, floorLevel: 1 }, rng: Rng.fromSeed(7) })
    const ctx = ctxFor(state)
    w.base.resistance = 0
    applyStatus(content, tuning, ctx.rng, w, { status: 'grab', sourceId: c.id })
    w.grabbedBy = c.id
    expect(canAct(ctx, w)).toBe(false)
    dealDamage(ctx, w, c, { amount: 3, damageType: 'slash', canMiss: false, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: true, ignoresDefense: true, sourceLabel: 'x' })
    expect(w.grabDamage).toBe(3)
    expect(canAct(ctx, w)).toBe(false)
  })
})

describe('the fight loop (03 §3)', () => {
  function rats(n: number) {
    return Array.from({ length: n }, (_, i) => buildMonsterActor(content, tuning, ratDef, { id: `rat${i}`, level: 1, row: 'front', hpPercent: 70 }))
  }

  it('a Warden beats three rats on auto within the round targets, and the same seed replays to the same hash', () => {
    const run = (seed: number) => {
      const state = createFight(content, tuning, { heroes: [warden()], pets: [], monsters: rats(3), surprised: null, light: 100, options: { dungeonId: 'g', floor: 1, floorLevel: 1, autoHeroes: true }, rng: Rng.fromSeed(seed) })
      return runFightAuto(content, tuning, state)
    }
    const a = run(11)
    expect(a.over?.outcome).toBe('victory')
    expect(a.round).toBeGreaterThanOrEqual(1)
    expect(a.round).toBeLessThanOrEqual(12)
    expect(a.counters.monstersKilled).toBe(3)
    expect(a.log.some((e) => e.kind === 'damage')).toBe(true)
    const b = run(11)
    expect(hashState(a)).toBe(hashState(b))
    const c = run(12)
    expect(hashState(c)).not.toBe(hashState(a))
  })

  it('a human hero stops the loop, sees its legal actions, and a command resumes it', () => {
    const w = warden()
    const state = createFight(content, tuning, { heroes: [w], pets: [], monsters: rats(2), surprised: 'enemy', light: 100, options: { dungeonId: 'g', floor: 1, floorLevel: 1 }, rng: Rng.fromSeed(21) })
    runFight(content, tuning, state)
    expect(state.pendingActorId).toBe('warden')
    const actions = legalFightActions(content, tuning, state)
    const labels = actions.map((a) => a.label)
    expect(labels).toContain('Attack')
    expect(labels.some((l) => l.startsWith('Shield Slam'))).toBe(true)
    expect(labels.some((l) => l.startsWith('Provoke'))).toBe(true)
    expect(labels).toContain('Guard')
    expect(labels).toContain('Flee')
    const slam = actions.find((a) => a.label.startsWith('Shield Slam'))!
    expect(slam.enabled).toBe(true)
    expect(slam.targets.length).toBe(2)
    applyFightCommand(content, tuning, state, { kind: 'skill', slot: 0, targetId: slam.targets[0]! })
    expect(state.log.some((e) => e.kind === 'action' && e.text.includes('Shield Slam'))).toBe(true)
    expect(w.tally.skillUses['warden-shield-slam']).toBe(1)
    expect(state.xp.some((x) => x.kind === 'skill' && x.id === 'warden-shield-slam')).toBe(true)
    expect(state.pendingActorId === 'warden' || state.over !== null).toBe(true)
  })

  it('an illegal command throws and leaves the fight waiting', () => {
    const state = createFight(content, tuning, { heroes: [warden()], pets: [], monsters: rats(1), surprised: 'enemy', light: 100, options: { dungeonId: 'g', floor: 1, floorLevel: 1 }, rng: Rng.fromSeed(22) })
    runFight(content, tuning, state)
    expect(() => applyFightCommand(content, tuning, state, { kind: 'skill', slot: 3, targetId: null })).toThrow()
    expect(state.pendingActorId).toBe('warden')
  })

  it('rounds count when every living hero has acted; a surprised party starts at 0 energy', () => {
    const a = warden('a')
    const b = warden('b', 'ELSE guard')
    const state = createFight(content, tuning, { heroes: [a, b], pets: [], monsters: rats(2), surprised: 'party', light: 100, options: { dungeonId: 'g', floor: 1, floorLevel: 1, autoHeroes: true }, rng: Rng.fromSeed(31) })
    expect(a.energy).toBe(0)
    expect(b.energy).toBe(0)
    expect(state.actors.find((x) => x.id === 'rat0')!.energy).toBeGreaterThanOrEqual(500)
    runFightAuto(content, tuning, state)
    const roundEvents = state.log.filter((e) => e.kind === 'round')
    expect(roundEvents.length).toBe(state.round - 1)
  })

  it('a downed hero is fallen after three of its turns; the fight ends in defeat when nobody stands', () => {
    const w = warden()
    w.hp = 1
    const strong = buildMonsterActor(content, tuning, ratDef, { id: 'bigrat', level: 14, row: 'front', hpPercent: 300 })
    strong.base.attackPhys = 500
    strong.base.accuracy = 100
    const state = createFight(content, tuning, { heroes: [w], pets: [], monsters: [strong], surprised: 'party', light: 100, options: { dungeonId: 'g', floor: 1, floorLevel: 1, autoHeroes: true }, rng: Rng.fromSeed(41) })
    runFightAuto(content, tuning, state)
    expect(state.over?.outcome).toBe('defeat')
    expect(state.counters.heroDowns).toBe(1)
  })

  it('Flee is not offered against a boss and the party can flee from rats', () => {
    const boss = buildMonsterActor(content, tuning, { ...cutpurseDef, id: 'boss', role: 'boss', boss: { phases: [{ atHpPercent: 100, attacks: ['shank'], adds: [], arenaRule: null }, { atHpPercent: 50, attacks: ['shank'], adds: [], arenaRule: null }], everyKill: [], firstKill: [], immunities: [], cannotFlee: true } }, { id: 'boss', level: 4, row: 'front', hpPercent: 100 })
    const s1 = createFight(content, tuning, { heroes: [warden()], pets: [], monsters: [boss], surprised: 'enemy', light: 100, options: { dungeonId: 'g', floor: 3, floorLevel: 4 }, rng: Rng.fromSeed(51) })
    runFight(content, tuning, s1)
    expect(legalFightActions(content, tuning, s1).find((a) => a.label === 'Flee')?.enabled).toBe(false)
    let fled = 0
    for (let seed = 60; seed < 80; seed++) {
      const s2 = createFight(content, tuning, { heroes: [warden('w', 'ELSE flee')], pets: [], monsters: rats(2), surprised: 'enemy', light: 100, options: { dungeonId: 'g', floor: 1, floorLevel: 1, autoHeroes: true }, rng: Rng.fromSeed(seed) })
      runFightAuto(content, tuning, s2)
      if (s2.over?.outcome === 'fled') fled++
    }
    expect(fled).toBeGreaterThan(5)
  })
})
