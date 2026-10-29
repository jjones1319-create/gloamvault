import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { corridorChoices, isCorridorSkill, roomEntryTicks } from '../src/corridor.ts'
import { createDelve, legalDelveActions, stepDelve } from '../src/delve.ts'
import type { DelveOptions } from '../src/delve-types.ts'
import { createFight, legalFightActions } from '../src/fight.ts'
import type { Actor } from '../src/fight-types.ts'
import { buildHeroActor, createHero } from '../src/hero.ts'
import { buildMonsterActor } from '../src/monsters.ts'
import { addTraitUses, applyPetTraitAuras, buildPetActor, growPetTraitFromFight, growPetTraitFromFinds, partyPetTraitBonus, petTraitLineAmount, petTraitProgress, petTraitRank, petTraitRankFor } from '../src/pets.ts'
import { Rng } from '../src/rng.ts'
import { addHero, newProfile, noStrikerHint, setParty } from '../src/town.ts'
import type { HeroRecord, PetInstance, SkillDef } from '../src/types/content.ts'

const content = loadContentDir(path.resolve('content'))
const t = content.tuning

const options = (over: Partial<DelveOptions> = {}): DelveOptions => ({ dungeonId: 'gravehollow-keep', floor: 1, seed: 41, difficulty: 'normal', pactIds: [], auto: false, policy: 'textbook', deathRule: 'sheltered', ...over })

function pathfinder(skills: string[]): HeroRecord {
  const r = createHero(content, t, Rng.fromSeed(5), { id: 'r1', name: 'Pip', speciesId: 'halfling', classId: 'ranger', eggPetId: 'rat-prince' })
  return { ...r, skills: [...r.skills, ...skills.map((skillId) => ({ skillId, rank: 1, xp: 0 }))], loadout: { ...r.loadout, actives: [...skills, null, null, null, null].slice(0, 4) as never } }
}

function pet(petId: string, over: Partial<PetInstance> = {}): PetInstance {
  return { petId, name: petId, grade: 'F', level: 1, xp: 0, bondStars: 0, traitRank: 1, stance: content.pets.get(petId)!.roleLean, ranchImport: null, ...over }
}

describe('corridor skills (D-099: their pool, no turn, no floor-clock tick)', () => {
  it('the Pathfinder actives have corridor uses; a pure fight skill does not', () => {
    for (const id of ['ranger-trailblaze', 'ranger-flint-tinder', 'ranger-double-time', 'ranger-scout-ahead']) expect(isCorridorSkill(content.skills.get(id)!)).toBe(true)
    expect(isCorridorSkill(content.skills.get('ranger-aimed-shot')!)).toBe(false)
  })

  it('Flint & Tinder: Light +10 for its Stamina, and the floor clock does not move', () => {
    const s = createDelve(content, options({ light: 50 }), [pathfinder(['ranger-flint-tinder'])])
    const action = legalDelveActions(content, s).find((a) => a.command.kind === 'corridorSkill')!
    expect(action.enabled).toBe(true)
    const clock = s.floor.clock
    const pool = s.heroes[0]!.poolPercent
    stepDelve(content, s, action.command)
    expect(s.light).toBe(60)
    expect(s.floor.clock).toBe(clock)
    expect(s.heroes[0]!.poolPercent).toBeLessThan(pool)
    expect(s.log.at(-1)?.kind).toBe('corridorSkill')
  })

  it('Trailblaze shifts the next room’s ambush roll; Double Time lets two room entries share a tick', () => {
    const s = createDelve(content, options(), [pathfinder(['ranger-trailblaze', 'ranger-double-time'])])
    for (const id of ['ranger-trailblaze', 'ranger-double-time']) {
      const a = legalDelveActions(content, s).find((x) => x.command.kind === 'corridorSkill' && x.command.skillId === id)!
      stepDelve(content, s, a.command)
    }
    expect(s.floor.ambushShiftNext).toBe(-10)
    expect(s.floor.roomsPerTick).toEqual({ left: 2, paid: false })
    expect(roomEntryTicks(s)).toBe(true)
    expect(roomEntryTicks(s)).toBe(false)
    expect(roomEntryTicks(s)).toBe(true)
  })

  it('a hero short of Stamina cannot; Blind Map leaves Scout Ahead nothing to do', () => {
    const s = createDelve(content, options({ pactIds: ['blind-map'] }), [pathfinder(['ranger-scout-ahead', 'ranger-trailblaze'])])
    const scout = corridorChoices(content, s, 0).find((c) => c.skill.id === 'ranger-scout-ahead')!
    expect(scout.reason).toMatch(/Blind Map/)
    s.heroes[0]!.poolPercent = 1
    expect(corridorChoices(content, s, 0).find((c) => c.skill.id === 'ranger-trailblaze')!.reason).toMatch(/needs/)
  })
})

describe('pet traits grow by use (03 §9)', () => {
  it('ranks follow the weighted uses and never fall', () => {
    const table = t.pets.traitGrowth.usesForRank
    expect(petTraitRankFor(t, 0)).toBe(1)
    expect(petTraitRankFor(t, table[1]!)).toBe(2)
    expect(petTraitRankFor(t, table[table.length - 1]!)).toBe(table.length)
    const grown = addTraitUses(t, pet('spiderling'), table[2]!)
    expect(grown.traitRank).toBe(3)
    expect(petTraitRank(t, { ...grown, traitXp: 0 })).toBe(3)
    expect(petTraitProgress(t, grown)).toMatchObject({ rank: 3, next: table[3] })
  })

  it('a trait’s numbers grow with its rank, away from zero', () => {
    const r3 = pet('spiderling', { traitRank: 3 })
    expect(petTraitLineAmount(t, r3, 5)).toBe(6)
    expect(petTraitLineAmount(t, r3, -15)).toBe(-18)
    expect(partyPetTraitBonus(content, [pet('spiderling')], 'detection')).toBe(5)
    expect(partyPetTraitBonus(content, [pet('spiderling', { traitRank: 5 })], 'detection')).toBe(7)
  })

  it('a Perception trait grows by the party’s finds (double while foraging); a fighting trait by its own tally', () => {
    const per = t.pets.traitGrowth.weights.finds
    expect(growPetTraitFromFinds(content, t, pet('spiderling', { stance: 'fierce' }), 4).traitXp).toBe(4 * per)
    expect(growPetTraitFromFinds(content, t, pet('rat-prince', { stance: 'forage' }), 4).traitXp).toBe(4 * per * t.pets.traitGrowth.forageFindsMultiplier)
    expect(growPetTraitFromFinds(content, t, pet('drakeling'), 4).traitXp ?? 0).toBe(0)
    const actor = buildPetActor(content, t, pet('drakeling'), { id: 'pet-0', ownerId: 'hero-0', ownerLevel: 1 })
    actor.tally.hitsLanded = 7
    expect(growPetTraitFromFight(content, t, pet('drakeling'), actor).traitXp).toBe(7)
    expect(growPetTraitFromFight(content, t, pet('spiderling'), actor).traitXp ?? 0).toBe(0)
  })

  it('a pet’s own stat line sits on it; a party line on every ally, the best pet’s only', () => {
    const crab = buildPetActor(content, t, pet('brine-crab'), { id: 'pet-0', ownerId: 'hero-0', ownerLevel: 1 })
    expect(crab.modifiers.some((m) => m.stat === 'block' && m.amount === 20)).toBe(true)
    const hero = buildHeroActor(content, t, createHero(content, t, Rng.fromSeed(2), { id: 'w', name: 'W', speciesId: 'human', classId: 'warden' }), { id: 'hero-0', row: 'front' })
    applyPetTraitAuras(content, t, [hero], [{ inst: pet('bone-pup') }, { inst: pet('bone-pup', { traitRank: 3 }) }])
    const res = hero.modifiers.filter((m) => m.stat === 'resistance')
    expect(res).toHaveLength(1)
    expect(res[0]!.amount).toBe(6)
  })
})

describe('at most 3 summons in a party (D-099)', () => {
  it('a summoning skill greys out while the party holds three summons', () => {
    const summonSkill: SkillDef = { ...content.skills.get('ranger-hunters-mark')!, id: 'ranger-hunters-mark', effects: [{ kind: 'summon', summonId: 'giant-rat' }] }
    const skills = new Map(content.skills)
    skills.set(summonSkill.id, summonSkill)
    const c = { ...content, skills }
    const record = createHero(c, t, Rng.fromSeed(5), { id: 'r1', name: 'Pip', speciesId: 'halfling', classId: 'ranger' })
    const hero = buildHeroActor(c, t, { ...record, loadout: { ...record.loadout, actives: ['ranger-hunters-mark', null, null, null] as never } }, { id: 'hero-0', row: 'back' })
    const rat = c.monsters.get('giant-rat')!
    const summons: Actor[] = [0, 1, 2].map((i) => {
      const a = buildMonsterActor(c, t, rat, { id: `s${i}`, level: 1, row: 'front', hpPercent: 100, summonedBy: 'hero-0' })
      a.side = 'party'
      return a
    })
    const foe = buildMonsterActor(c, t, rat, { id: 'foe', level: 1, row: 'front', hpPercent: 100 })
    const fight = createFight(c, t, { heroes: [hero, ...summons], pets: [], monsters: [foe], surprised: 'enemy', light: 100, options: { dungeonId: 'gravehollow-keep', floor: 1, floorLevel: 1 }, rng: Rng.fromSeed(3) })
    const skill = legalFightActions(c, t, fight, 'hero-0').find((a) => a.command.kind === 'skill')!
    expect(skill.enabled).toBe(false)
    expect(skill.reason).toMatch(/3 summons/)
  })
})

describe('the "No striker" hint (D-099)', () => {
  it('a party of a Warden and a Mender hears it; a Blade in the party silences it', () => {
    let p = addHero(content, newProfile(1), { name: 'Orrin', speciesId: 'dwarf', classId: 'warden' }).profile
    p = addHero(content, p, { name: 'Ada', speciesId: 'human', classId: 'mender' }).profile
    expect(noStrikerHint(p)).toBe('No striker: fights will be long')
    p = addHero(content, p, { name: 'Kell', speciesId: 'human', classId: 'blade' }).profile
    expect(noStrikerHint(p)).toBeNull()
    expect(noStrikerHint(setParty(p, [p.heroes[0]!.id]))).toBe('No striker: fights will be long')
  })
})
