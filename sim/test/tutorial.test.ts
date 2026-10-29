import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { createDelve, hashDelve, runDelveAuto, stepDelve } from '../src/delve.ts'
import type { DelveState } from '../src/delve-types.ts'
import { addHero, newProfile, settleDelve, startDelve } from '../src/town.ts'
import { dressTutorialRoom, isTutorialFloor, tutorialFor } from '../src/tutorial.ts'
import type { DungeonDef, HeroRecord } from '../src/types/content.ts'

/**
 * The lesson floor (D-038, 03 §13; Phase 8, pass B): a profile's first delve opens on a fixed floor — Entry · Fight ·
 * Trap room · Stairs — whose contents come from the dungeon's `tutorial` block, so nothing on it is rolled; every later
 * floor and delve plays normally.
 */
const content = loadContentDir(path.resolve('content'))
const DUNGEON = 'gravehollow-keep'
const dungeon = content.dungeons.get(DUNGEON) as DungeonDef
const lesson = dungeon.tutorial!

function party(speciesId = 'human', classId = 'warden'): HeroRecord[] {
  return addHero(content, newProfile(7), { name: 'Orrin', speciesId, classId, eggPetId: null }).profile.heroes
}

function firstDelve(seed: number, heroes = party(), auto = true): DelveState {
  return createDelve(content, { dungeonId: DUNGEON, floor: 1, seed, difficulty: 'normal', pactIds: [], auto, policy: 'textbook', firstDelve: true, deathRule: 'mortal' }, heroes)
}

/** Steps the scripted player until `until` holds or the delve ends (a cap keeps a bug from hanging the test). */
function stepUntil(s: DelveState, until: (s: DelveState) => boolean, cap = 400): DelveState {
  for (let i = 0; i < cap && !until(s) && s.phase.kind !== 'over'; i++) stepDelve(content, s, { kind: 'auto' })
  return s
}

function roomOfKind(s: DelveState, kind: string) {
  const g = s.floor.graph.rooms.find((r) => r.kind === kind)!
  return { graph: g, state: s.floor.rooms[g.id]! }
}

describe('the lesson block', () => {
  it('is Gravehollow floor 1: the Rat Pack, a Loose Flagstone and a small chest, no hunter, no surprise', () => {
    expect(lesson).toEqual({ floor: 1, encounterId: 'rat-pack', trapIds: ['loose-flagstone'], chest: 'small', hunter: false, surprise: false })
    expect(isTutorialFloor(dungeon, { firstDelve: true }, 1)).toBe(true)
    expect(isTutorialFloor(dungeon, { firstDelve: true }, 2)).toBe(false)
    expect(isTutorialFloor(dungeon, {}, 1)).toBe(false)
    expect(tutorialFor(dungeon, { firstDelve: false }, 1)).toBeNull()
  })
})

describe('a first delve opens on the lesson floor', () => {
  it('lays out Entry · Fight · Trap room · Stairs with the block’s contents on every seed', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = firstDelve(seed)
      expect(s.floor.graph.kind).toBe('tutorial')
      expect(s.floor.graph.rooms.map((r) => r.kind)).toEqual(['entry', 'fight', 'trapGauntlet', 'stairs'])
      expect(s.floor.hunter, 'no hunter stalks the lesson').toBeNull()
      const fight = roomOfKind(s, 'fight')
      expect(fight.state.encounterId).toBe('rat-pack')
      expect(fight.graph.encounterId).toBe('rat-pack')
      const trapRoom = roomOfKind(s, 'trapGauntlet')
      expect(trapRoom.state.traps.map((t) => t.trapId)).toEqual(['loose-flagstone'])
      expect(trapRoom.state.chests).toEqual([{ size: 'small', locked: false, trapped: false, trapId: null, opened: false }])
      for (const kind of ['entry', 'fight', 'stairs']) {
        const r = roomOfKind(s, kind).state
        expect(r.traps, `${kind} holds no trap`).toEqual([])
        expect(r.chests).toEqual([])
        expect(r.curioId).toBeNull()
      }
    }
  })

  it('never opens its first fight with a surprise', () => {
    for (let seed = 1; seed <= 40; seed++) {
      // Heroes wait for commands (auto off), so the fight is still open at its first hero turn.
      const s = stepUntil(firstDelve(seed, party(), false), (x) => x.phase.kind === 'fight')
      expect(s.phase.kind).toBe('fight')
      expect(s.stats.ambushedParty + s.stats.ambushedMonsters, `seed ${seed}`).toBe(0)
      expect(s.log.find((e) => e.kind === 'fightStart')?.data?.surprised ?? null).toBeNull()
    }
  })

  it('shows its trap to the lowest-Perception heroes (an Orc Warden, an Orc Blade: Perception 9)', () => {
    for (const [speciesId, classId] of [
      ['orc', 'warden'],
      ['orc', 'blade'],
      ['dwarf', 'mender'],
      ['elf', 'ranger'],
    ] as const) {
      const heroes = party(speciesId, classId)
      for (let seed = 1; seed <= 6; seed++) {
        const s = stepUntil(firstDelve(seed, heroes), (x) => x.phase.kind === 'room' && x.floor.currentRoomId === roomOfKind(x, 'trapGauntlet').graph.id)
        if (s.phase.kind === 'over') continue // a wiped first fight never reaches the trap
        const trap = roomOfKind(s, 'trapGauntlet').state.traps[0]!
        expect(trap.revealed, `${speciesId} ${classId} seed ${seed} sees the Loose Flagstone`).toBe(true)
        expect(trap.triggered).toBe(false)
      }
    }
  })

  it('opens its chest and takes the stairs; the scripted player clears it', () => {
    let cleared = 0
    for (let seed = 1; seed <= 20; seed++) {
      const s = runDelveAuto(content, firstDelve(seed))
      expect(s.phase.kind).toBe('over')
      if (s.stats.deepestFloorCompleted >= 1) cleared++
      expect(s.log.filter((e) => e.kind === 'floor' && e.data?.kind === 'tutorial')).toHaveLength(1)
    }
    expect(cleared, 'a solo level-1 hero finishes the lesson floor nearly always').toBeGreaterThanOrEqual(18)
  })

  it('plays every later floor normally', () => {
    const s = stepUntil(firstDelve(3), (x) => x.floor.number === 2)
    expect(s.floor.number).toBe(2)
    expect(s.floor.graph.kind).toBe('normal')
    expect(s.floor.graph.rooms.length).toBeGreaterThanOrEqual(8)
  })

  it('is deterministic: the same seed and commands give the same hash', () => {
    const a = runDelveAuto(content, firstDelve(11))
    const b = runDelveAuto(content, firstDelve(11))
    expect(hashDelve(a)).toBe(hashDelve(b))
  })
})

describe('every delve after the first plays normally', () => {
  it('a profile’s second delve opens on an ordinary floor 1', () => {
    // Sheltered, so a wipe further down never empties the roster before the second delve.
    let p = addHero(content, newProfile(5, 'sheltered'), { name: 'Orrin', speciesId: 'human', classId: 'warden', eggPetId: null }).profile
    const first = startDelve(content, p, { dungeonId: DUNGEON, floor: 1, firstDelve: true, auto: true })
    expect(first.state.floor.graph.kind).toBe('tutorial')
    p = settleDelve(content, first.profile, runDelveAuto(content, first.state)).profile
    const second = startDelve(content, p, { dungeonId: DUNGEON, floor: 1, auto: true })
    expect(second.state.floor.graph.kind).toBe('normal')
    expect(second.state.floor.graph.rooms.length).toBeGreaterThanOrEqual(5)
    expect(second.state.floor.graph.restId).not.toBeNull()
  })

  it('dresses only the trap room of a hand-made graph room', () => {
    const room = { id: 'r9', kind: 'stairs' as const, templateId: 'x', rotation: 0 as const, cells: [], doors: [], hop: 3, onSpine: true, branchDepth: 0, encounterId: null, hasKey: false, variation: 0 }
    const rs = dressTutorialRoom(dungeon, room, lesson)
    expect(rs.traps).toEqual([])
    expect(rs.cleared).toBe(true)
  })
})
