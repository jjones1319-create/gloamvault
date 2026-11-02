/**
 * Phase 17 (D-149, D-150, D-142, D-148, D-147, D-152): the delve plays a hand-laid floor — Floor 1's own rooms and
 * joins become the graph, walking rolls random encounters by the light, the smokes, the secret doors found with A,
 * the side exits, the monsters' level band — and the same seed walks the same floor.
 */
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { createDelve, hashDelve, stepDelve } from '../src/delve.ts'
import type { DelveOptions, DelveState } from '../src/delve-types.ts'
import { exitRoomIds, roomId, spotsOf } from '../src/floor-layout.ts'
import { createHero } from '../src/hero.ts'
import { Rng } from '../src/rng.ts'
import type { DungeonDef, HeroRecord, ItemInstance } from '../src/types/content.ts'

const content = loadContentDir('content')
const t = content.tuning
const dungeon = content.dungeons.get('gravehollow-keep') as DungeonDef
const layout = content.floorLayouts.get('floor-1')!
const floor1 = dungeon.floors.find((f) => f.floor === 1)!
const floor2 = dungeon.floors.find((f) => f.floor === 2)!

function hero(id: string, classId: string, level = 1): HeroRecord {
  const h = createHero(content, t, Rng.fromSeed(7), { id, name: id, speciesId: 'dwarf', classId, freePoints: { strength: 2, endurance: 2, vitality: 2 } })
  return { ...h, level }
}
const party = (level = 1) => [hero('w', 'warden', level), hero('m', 'mender', level)]
const options = (over: Partial<DelveOptions> = {}): DelveOptions => ({ dungeonId: 'gravehollow-keep', floor: 1, lastFloor: 1, floorLayoutId: 'floor-1', seed: 17, difficulty: 'normal', pactIds: [], auto: false, policy: 'textbook', light: 100, ...over })
const delve = (over: Partial<DelveOptions> = {}, heroes = party()) => createDelve(content, options(over), heroes)
const walk = (s: DelveState, seconds: number) => stepDelve(content, s, { kind: 'walk', seconds })
const smoke = (itemId: string): ItemInstance => ({ instanceId: `inst-${itemId}`, itemId, quantity: 1, affixes: [], plusN: 0, itemLevel: 1, itemXp: 0, affinities: [], durability: 1, maxDurability: 1 })
const withBag = (h: HeroRecord, ...items: ItemInstance[]): HeroRecord => ({ ...h, bag: [...h.bag, ...items] })

/** Walks in 5 s steps until a fight starts or the cap is reached; the seconds walked. */
function walkUntilFight(s: DelveState, cap = 600): number {
  let sec = 0
  while (s.phase.kind === 'room' && sec < cap) {
    walk(s, 5)
    sec += 5
  }
  return sec
}
/** Plays the fight out on the policy and continues past the result card. */
function finishFight(s: DelveState): void {
  for (let i = 0; i < 400 && s.phase.kind !== 'room' && s.phase.kind !== 'over'; i++) stepDelve(content, s, { kind: 'auto' })
}

describe("the delve plays Floor 1's own rooms (D-150)", () => {
  it('the layout is the graph: every room, the entry, the stairs, the key room, the rest room', () => {
    const s = delve()
    expect(s.floor.layoutId).toBe('floor-1')
    expect(s.floor.graph.rooms.length).toBe(layout.rooms.length)
    expect(s.floor.graph.entryId).toBe(roomId(0))
    expect(s.floor.graph.exitId).toBe(roomId(10))
    expect(s.floor.graph.keyRoomId).toBe(roomId(4))
    expect(s.floor.graph.restId).toBe(roomId(14))
    expect(s.floor.currentRoomId).toBe(roomId(0))
    expect(s.floor.exitRooms).toEqual(exitRoomIds(layout))
    expect(s.floor.walk).toBeTruthy()
  })

  it('every join is a door both ways; the secret and locked ones keep their flags', () => {
    const s = delve()
    const room = (i: number) => s.floor.graph.rooms.find((r) => r.id === roomId(i))!
    for (const j of layout.joins) {
      const ab = room(j.a).doors.find((d) => d.to === roomId(j.b))!
      const ba = room(j.b).doors.find((d) => d.to === roomId(j.a))!
      expect(ab, `${j.a} to ${j.b}`).toBeTruthy()
      expect(ba, `${j.b} to ${j.a}`).toBeTruthy()
      expect(ab.secret).toBe(j.kind === 'secret')
      expect(ba.secret).toBe(j.kind === 'secret')
      expect(ab.locked).toBe(j.kind === 'locked')
    }
  })

  it('an encounter spot draws a placed encounter by the seed; a spotless hall starts cleared', () => {
    const s = delve()
    for (const spot of layout.spots.filter((x) => x.kind === 'encounter')) {
      const r = s.floor.graph.rooms.find((x) => x.id === roomId(spot.room))!
      expect(r.encounterId, `room ${spot.room}`).toBeTruthy()
      expect(s.floor.rooms[r.id]!.cleared).toBe(false)
    }
    const hall = layout.rooms.find((r) => r.id !== 0 && spotsOf(layout, r.id).length === 0)!
    expect(s.floor.rooms[roomId(hall.id)]!.cleared).toBe(true)
    // Another seed draws other encounters, the same rooms.
    const other = delve({ seed: 99 })
    expect(other.floor.graph.rooms.map((r) => r.id)).toEqual(s.floor.graph.rooms.map((r) => r.id))
    const picks = (x: DelveState) => x.floor.graph.rooms.map((r) => r.encounterId).join(',')
    expect(picks(other)).not.toBe(picks(s))
  })
})

describe('random encounters by walking (D-149)', () => {
  const w = t.exploration.walk

  it('the first budget is drawn from the tuned range and a fight comes when it runs out', () => {
    const s = delve()
    const budget = s.floor.walk!.budget
    expect(budget).toBeGreaterThanOrEqual(w.secondsMin)
    expect(budget).toBeLessThanOrEqual(w.secondsMax)
    const sec = walkUntilFight(s)
    expect(s.phase.kind).toBe('fight')
    expect(sec).toBeGreaterThanOrEqual(budget)
    expect(sec).toBeLessThan(budget + 5)
    expect(s.floor.walk!.randomFights).toBe(1)
    expect(s.stats.fights).toBe(1)
    expect(s.log.some((e) => e.kind === 'wander')).toBe(true)
  })

  it('after a fight the grace seconds do not count, then the next budget does', () => {
    const s = delve()
    walkUntilFight(s)
    finishFight(s)
    expect(s.phase.kind).toBe('room')
    const before = s.floor.walk!.budget
    walk(s, w.graceSeconds)
    expect(s.floor.walk!.budget).toBe(before)
    walk(s, 10)
    expect(s.floor.walk!.budget).toBe(before - 10)
  })

  it('the dark counts the seconds faster (bandScale)', () => {
    const bright = delve({ light: 100 })
    const pitch = delve({ light: 0 })
    const b0 = bright.floor.walk!.budget
    const p0 = pitch.floor.walk!.budget
    walk(bright, 9)
    walk(pitch, 9)
    expect(b0 - bright.floor.walk!.budget).toBe(9)
    expect(p0 - pitch.floor.walk!.budget).toBeCloseTo(9 / w.bandScale.pitch, 6)
  })

  it('Hushsmoke stops the clock for its minutes, burning twice as fast in the pitch dark (D-142)', () => {
    const s = delve({ light: 100 }, [withBag(hero('w', 'warden'), smoke('hushsmoke-small')), hero('m', 'mender')])
    stepDelve(content, s, { kind: 'useItem', heroIndex: 0, instanceId: 'inst-hushsmoke-small' })
    expect(s.floor.walk!.smoke).toEqual({ kind: 'hush', secondsLeft: w.smokeMinutes.small * 60 })
    const before = s.floor.walk!.budget
    walk(s, 60)
    expect(s.floor.walk!.budget).toBe(before)
    expect(s.floor.walk!.smoke!.secondsLeft).toBe(w.smokeMinutes.small * 60 - 60)
    s.light = 1
    walk(s, 15)
    expect(s.floor.walk!.smoke!.secondsLeft).toBe(w.smokeMinutes.small * 60 - 60 - 30)
    walk(s, 15)
    expect(s.floor.walk!.smoke).toBeNull()
    expect(s.log.some((e) => e.kind === 'smoke')).toBe(true)
    expect(s.phase.kind).toBe('room')
  })

  it('Callsmoke halves the budget and skips the grace (D-148)', () => {
    const s = delve({ light: 100 }, [withBag(hero('w', 'warden'), smoke('callsmoke-small')), hero('m', 'mender')])
    stepDelve(content, s, { kind: 'useItem', heroIndex: 0, instanceId: 'inst-callsmoke-small' })
    expect(s.floor.walk!.smoke?.kind).toBe('call')
    const before = s.floor.walk!.budget
    walk(s, 10)
    expect(before - s.floor.walk!.budget).toBeCloseTo(10 / w.callsmokeFactor, 6)
    walkUntilFight(s)
    finishFight(s)
    expect(s.phase.kind).toBe('room')
    const after = s.floor.walk!.budget
    walk(s, 5)
    expect(s.floor.walk!.budget).toBeLessThan(after)
  })
})

describe('secret doors, side exits and the band (D-146, D-151, D-147)', () => {
  it('a secret panel found with A is known from both sides', () => {
    const s = delve()
    const j = layout.joins.find((x) => x.kind === 'secret')!
    s.floor.currentRoomId = roomId(j.a)
    expect(() => stepDelve(content, s, { kind: 'reveal', toRoomId: roomId(j.a === 0 ? 1 : 0) })).toThrow()
    stepDelve(content, s, { kind: 'reveal', toRoomId: roomId(j.b) })
    expect(s.floor.rooms[roomId(j.a)]!.secretRevealed).toBe(true)
    expect(s.floor.rooms[roomId(j.b)]!.secretRevealed).toBe(true)
  })

  it('the party can leave by a side exit, not from any room', () => {
    const s = delve()
    const side = layout.exits.find((e) => e.kind === 'side')!
    s.floor.currentRoomId = roomId(1)
    expect(() => stepDelve(content, s, { kind: 'retreat' })).toThrow()
    s.floor.currentRoomId = roomId(side.room)
    stepDelve(content, s, { kind: 'retreat' })
    expect(s.phase.kind).toBe('over')
  })

  it("monsters come at the party's level, clamped to the floor's band (D-147, D-152)", () => {
    expect(delve({}, party(1)).floor.monsterLevel).toBe(floor1.monsterLevel)
    const top = Math.max(floor1.monsterLevel, floor2.monsterLevel)
    expect(delve({}, party(40)).floor.monsterLevel).toBe(top)
    const mid = Math.min(top, Math.max(floor1.monsterLevel, Math.round((floor1.monsterLevel + top) / 2)))
    expect(delve({}, party(mid)).floor.monsterLevel).toBe(mid)
    const s = delve({}, party(40))
    walkUntilFight(s)
    expect(s.phase.kind).toBe('fight')
    for (const a of s.fight!.actors.filter((x) => x.side === 'enemy')) expect(a.level).toBe(top)
  })
})

describe('determinism', () => {
  const script = (s: DelveState) => {
    walkUntilFight(s)
    finishFight(s)
    stepDelve(content, s, { kind: 'move', toRoomId: roomId(1) })
    walkUntilFight(s)
    finishFight(s)
    return hashDelve(s)
  }
  it('the same seed walks the same floor; another seed another', () => {
    expect(script(delve({ seed: 5 }))).toBe(script(delve({ seed: 5 })))
    expect(script(delve({ seed: 5 }))).not.toBe(script(delve({ seed: 6 })))
  })
})
