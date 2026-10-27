import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { runDelveAuto } from '../src/delve.ts'
import {
  addHero,
  buyChest,
  chooseHero,
  chestPrice,
  deposit,
  equip,
  hatchEgg,
  learnSkill,
  newProfile,
  partyHeroes,
  questBoard,
  repairAll,
  repairAllQuote,
  settleDelve,
  skillHallOffers,
  startDelve,
  TownError,
  unequip,
  waystoneFloors,
  withdraw,
  type Profile,
} from '../src/town.ts'

const content = loadContentDir(path.resolve('content'))
const t = content.tuning
const DUNGEON = 'gravehollow-keep'

function withHero(): Profile {
  return addHero(content, newProfile(7), { name: 'Orrin', speciesId: 'dwarf', classId: 'warden', freePoints: { strength: 2, endurance: 2, vitality: 2 }, eggPetId: 'cellar-hound' }).profile
}

describe('the roster and the party (D-090, D-091)', () => {
  it('the first hero is the chosen hero and the party; the selection stays shut while they live', () => {
    const p = withHero()
    expect(p.heroes).toHaveLength(1)
    expect(p.partyIds).toEqual([p.heroes[0]!.id])
    expect(p.chosenId).toBe(p.heroes[0]!.id)
    expect(p.deathRule).toBe('mortal')
    expect(partyHeroes(p)[0]!.petInstance?.petId).toBe('cellar-hound')
    expect(() => chooseHero(content, p, { name: 'Two', speciesId: 'human', classId: 'mender', eggPetId: null })).toThrow(TownError)
    expect(t.coop.rosterMax).toBe(12)
  })
})

describe('a delve from the Waystone and home again (03 §13, D-083)', () => {
  it('the Waystone opens floor 1, then the floor below the deepest finished', () => {
    const p = withHero()
    expect(waystoneFloors(content, p, DUNGEON)).toEqual([1])
    expect(waystoneFloors(content, { ...p, progress: { ...p.progress, deepest: { [DUNGEON]: 2 } } }, DUNGEON)).toEqual([1, 2, 3])
    expect(() => startDelve(content, p, { dungeonId: DUNGEON, floor: 2 })).toThrow(TownError)
  })

  it('carries the purse in, brings gold, gear, levels and progress home', () => {
    let p = { ...withHero(), purse: 40 }
    const started = startDelve(content, p, { dungeonId: DUNGEON, floor: 1, auto: true })
    p = started.profile
    expect(p.purse).toBe(0)
    expect(p.activeDelve?.options.floor).toBe(1)
    expect(started.state.gold).toBe(40)
    const done = runDelveAuto(content, started.state)
    expect(done.phase.kind).toBe('over')
    const { profile, summary } = settleDelve(content, p, done)
    expect(profile.activeDelve).toBeNull()
    expect(profile.progress.delves).toBe(1)
    expect(profile.lastDelve).toEqual(summary)
    if (summary.outcome === 'wiped') expect(profile.purse).toBe(0)
    else expect(profile.purse).toBe(done.gold)
    // A Mortal wipe loses the hero for good: the bearers bring the worn gear home to the armory (D-088).
    const lostGear = summary.lost.length > 0 ? 10 : 0
    expect(profile.armory.length).toBeGreaterThanOrEqual(done.pile.length)
    expect(profile.armory.length).toBeLessThanOrEqual(done.pile.length + lostGear)
    if (summary.lost.length === 0) expect(profile.heroes[0]!.battleXp).toBeGreaterThanOrEqual(0)
    else expect(profile.memorial.map((m) => m.name)).toEqual(['Orrin'])
    if (done.stats.deepestFloorCompleted >= 1) expect(profile.progress.deepest[DUNGEON]).toBe(done.stats.deepestFloorCompleted)
  })
})

describe('town services', () => {
  const rich = (): Profile => ({ ...withHero(), purse: 2000 })

  it('the bank moves gold between purse and vault; prices pay purse first', () => {
    let p = deposit(rich(), 500)
    expect([p.purse, p.bank]).toEqual([1500, 500])
    p = withdraw(p, 200)
    expect([p.purse, p.bank]).toEqual([1700, 300])
  })

  it('Repair all restores every worn piece for its quote', () => {
    let p = rich()
    const hero = p.heroes[0]!
    const worn = { ...hero, equipment: { ...hero.equipment, mainHand: { ...hero.equipment.mainHand!, durability: 40 } } }
    p = { ...p, heroes: [worn] }
    const quote = repairAllQuote(content, p, hero.id)
    expect(quote.gold).toBeGreaterThan(0)
    const after = repairAll(content, p, hero.id)
    expect(after.heroes[0]!.equipment.mainHand!.durability).toBe(100)
    expect(after.purse).toBe(2000 - quote.gold)
  })

  it('the Skill Hall sells open Tier I skills and gates the rest by level', () => {
    const p = rich()
    const offers = skillHallOffers(content, p, p.heroes[0]!.id)
    const open = offers.find((o) => o.locked === null)!
    expect(open).toBeDefined()
    expect(offers.some((o) => o.locked?.startsWith('Tier 2 opens'))).toBe(true)
    const learned = learnSkill(content, p, p.heroes[0]!.id, open.skillId)
    expect(learned.heroes[0]!.skills.some((s) => s.skillId === open.skillId)).toBe(true)
    expect(learned.purse).toBe(2000 - open.price)
  })

  it('a Standard gear chest pays out and advances the pity counter; an egg hatches', () => {
    let p = rich()
    const price = chestPrice(content, p, 'standard-gear-chest')
    const { profile, result } = buyChest(content, p, 'standard-gear-chest', p.heroes[0]!.id)
    expect(profile.purse).toBe(2000 - price)
    expect(['item', 'salvage']).toContain(result.kind)
    expect(profile.pity['gear']).toBeDefined()
    p = { ...profile, eggs: [{ petId: 'spiderling', grade: 'F' }] }
    const hatched = hatchEgg(content, p, 0, p.heroes[0]!.id)
    expect(hatched.heroes[0]!.petInstance?.petId).toBe('spiderling')
    expect(hatched.stables.map((s) => s.petId)).toEqual(['cellar-hound'])
  })

  it('equip and unequip move items between the armory and the slots', () => {
    const p = rich()
    const hero = p.heroes[0]!
    const off = unequip(p, hero.id, 'helmet')
    expect(off.heroes[0]!.equipment.helmet).toBeNull()
    expect(off.armory).toHaveLength(1)
    const on = equip(content, off, hero.id, off.armory[0]!.instanceId)
    expect(on.heroes[0]!.equipment.helmet?.itemId).toBe(hero.equipment.helmet!.itemId)
    expect(on.armory).toHaveLength(0)
  })

  it('the Quest Board draws three contracts per week, the same three all week', () => {
    expect(questBoard(content, 100)).toHaveLength(3)
    expect(questBoard(content, 100)).toEqual(questBoard(content, 100))
  })
})
