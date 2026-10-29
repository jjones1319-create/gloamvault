import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { createDelve, stepDelve } from '../src/delve.ts'
import type { DelveOptions, DelveState } from '../src/delve-types.ts'
import { createHero, heroAtLevel } from '../src/hero.ts'
import { createItemInstance } from '../src/items.ts'
import { Rng } from '../src/rng.ts'
import { newProfile, settleDelve, type Profile } from '../src/town.ts'
import type { HeroRecord, ItemInstance } from '../src/types/content.ts'

/**
 * A boss's rewards reach the party and the save (06 §3, 08 §11; D-037): every kill's lines, the first kill's on top
 * when the profile has none (DelveOptions.bossKills), the arena's record on the delve's stats (07 §8.2), and the town
 * lines — the title, +1 Luck — paid to the heroes standing when the delve is settled.
 */
const content = loadContentDir(path.resolve('content'))
const t = content.tuning
const DUNGEON = 'gravehollow-keep'

function strongHero(i: number, classId: string): HeroRecord {
  const egg = [...content.pets.values()].find((p) => p.creationChoice)
  let h = createHero(content, t, Rng.fromSeed(100 + i), { id: `hero-${i + 1}`, name: `${classId}-${i + 1}`, speciesId: 'human', classId, freePoints: { endurance: 2, vitality: 2, strength: 2 }, eggPetId: egg?.id ?? null })
  h = heroAtLevel(content, t, h, 14)
  // Every worn piece at grade C of its own kind (the runner's "ground" party), so the fight is won.
  const rng = Rng.fromSeed(7 + i)
  const up = (inst: ItemInstance | null): ItemInstance | null => {
    if (!inst) return inst
    const mesh = content.items.get(inst.itemId)?.visual.meshId
    const target = [...content.items.values()].find((d) => d.visual.meshId === mesh && d.grade === 'C')
    return target ? createItemInstance(content, rng, target.id) : inst
  }
  const e = h.equipment
  return { ...h, equipment: { ...e, mainHand: up(e.mainHand), offHand: up(e.offHand), helmet: up(e.helmet), chest: up(e.chest), legs: up(e.legs), boots: up(e.boots), gloves: up(e.gloves), ring: [up(e.ring[0]), up(e.ring[1])], talisman: up(e.talisman), relic: up(e.relic) } }
}

const party = (): HeroRecord[] => ['warden', 'blade', 'warden', 'blade'].filter((c) => content.classes.has(c)).map((c, i) => strongHero(i, c))

/** Walks the party into Vexa's tap room (auto: the fight plays out) and returns the delve after it. */
function fightVexa(over: Partial<DelveOptions> = {}): DelveState {
  const options: DelveOptions = { dungeonId: DUNGEON, floor: 3, seed: 4242, difficulty: 'normal', pactIds: [], auto: true, policy: 'textbook', ...over }
  const state = createDelve(content, options, party())
  const bossRoom = state.floor.graph.rooms.find((r) => r.kind === 'boss')!
  const before = state.floor.graph.rooms.find((r) => r.id !== bossRoom.id && (r.doors.some((d) => d.to === bossRoom.id) || bossRoom.doors.some((d) => d.to === r.id)))!
  state.floor.hasKey = true
  state.floor.currentRoomId = before.id
  state.floor.rooms[before.id]!.visited = true
  state.phase = { kind: 'room' }
  stepDelve(content, state, { kind: 'move', toRoomId: bossRoom.id })
  return state
}

describe('a boss kill pays its lines (06 §3, 08 §11)', () => {
  it('the first kill: the stack doubled, the Relic, the key in materials, the Tome, the title and Waystone for the town', () => {
    const state = fightVexa()
    expect(state.phase.kind).toBe('result')
    const lines = state.phase.kind === 'result' ? state.phase.lines : []
    expect(lines.some((l) => l.startsWith('First kill:'))).toBe(true)
    expect(state.materials.copper ?? 0).toBeGreaterThanOrEqual(8)
    expect(state.materials.rawhide ?? 0).toBeGreaterThanOrEqual(8)
    expect(state.materials['standard-chest-key']).toBe(1)
    expect(state.pile.some((i) => i.itemId === 'the-grinning-mask')).toBe(true)
    expect(state.bossRewards?.map((r) => [r.kind, r.id])).toEqual([
      ['title', 'toll-breaker'],
      ['waystone', 'the-cellars'],
    ])
    const record = state.stats.bossArenas?.[0]
    expect(record).toMatchObject({ boss: 'captain-vexa-marrow', floor: 3, outcome: 'victory', firstKill: true })
    expect(record!.lightMin).toBeLessThanOrEqual(60)
  })

  it('a later kill pays only the halved stack: no Relic, no key, no title (DelveOptions.bossKills)', () => {
    const state = fightVexa({ bossKills: { 'captain-vexa-marrow': 1 } })
    expect(state.phase.kind).toBe('result')
    const lines = state.phase.kind === 'result' ? state.phase.lines : []
    expect(lines.some((l) => l.startsWith('First kill:'))).toBe(false)
    expect(state.materials['standard-chest-key'] ?? 0).toBe(0)
    expect(state.pile.some((i) => i.itemId === 'the-grinning-mask')).toBe(false)
    expect(state.bossRewards ?? []).toEqual([])
    expect(state.stats.bossArenas?.[0]).toMatchObject({ outcome: 'victory', firstKill: false })
  })
})

describe('the town pays the title and the Luck to the heroes standing (06 §3; D-037)', () => {
  it('settleDelve adds the title once and +1 Luck to every hero who came home standing', () => {
    let profile: Profile = newProfile(5, 'sheltered')
    const heroes = party()
    profile = { ...profile, heroes, partyIds: heroes.map((h) => h.id), chosenId: heroes[0]!.id }
    const state = createDelve(content, { dungeonId: DUNGEON, floor: 3, seed: 9, difficulty: 'normal', pactIds: [], auto: true, policy: 'textbook', deathRule: 'sheltered' }, heroes)
    state.bossRewards = [
      { bossId: 'hollow-king', kind: 'title', id: 'hollow-crowned', amount: 1 },
      { bossId: 'hollow-king', kind: 'luck', amount: 1 },
    ]
    state.heroes[1]!.fallen = true
    state.phase = { kind: 'over', outcome: 'cleared', summary: 'test' }
    const { profile: after } = settleDelve(content, { ...profile, activeDelve: { options: state.options, party: heroes, commands: [] } }, state)
    const standing = after.heroes.find((h) => h.id === heroes[0]!.id)!
    const fallen = after.heroes.find((h) => h.id === heroes[1]!.id)!
    expect(standing.titles).toContain('hollow-crowned')
    expect(standing.attributes.luck).toBe(heroes[0]!.attributes.luck + 1)
    expect(standing.creationValues.luck).toBe(heroes[0]!.creationValues.luck + 1)
    expect(fallen.titles).not.toContain('hollow-crowned')
    expect(fallen.attributes.luck).toBe(heroes[1]!.attributes.luck)
  })
})
