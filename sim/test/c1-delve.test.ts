/**
 * Pass C1 (Phase 7): the Crypts' and the Vault's curios, traps and secrets in the delve (07 §2.4–§2.6) on the real
 * content — the trap triggers of 07 §2.5 ("Unrevealed, it fires on the lowest-Perception hero"; only a revealed trap
 * shuts its door), a target-less status landing on the victim alone, the curio outcomes' further lines, the Leech
 * Jar's hunter fight and the hunters killed this delve.
 */
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import type { Content } from '../src/content.ts'
import { createDelve, legalDelveActions, stepDelve } from '../src/delve.ts'
import type { DelveOptions, DelveState, TrapState } from '../src/delve-types.ts'
import { goldFor, rForFloor } from '../src/economy.ts'
import { createHero } from '../src/hero.ts'
import { Rng } from '../src/rng.ts'
import type { CurioDef, DungeonDef, HeroRecord } from '../src/types/content.ts'

const content = loadContentDir('content')
const t = content.tuning
const base = content.dungeons.get('gravehollow-keep') as DungeonDef

function strong(id: string, classId: string, perception = 60): HeroRecord {
  const h = createHero(content, t, Rng.fromSeed(7), { id, name: id, speciesId: 'human', classId, freePoints: { strength: 2, endurance: 2, vitality: 2 } })
  const attributes = Object.fromEntries(Object.keys(h.attributes).map((k) => [k, k === 'luck' ? 10 : 60])) as HeroRecord['attributes']
  return { ...h, level: 20, attributes: { ...attributes, perception } }
}
/** Warden and Blade stand in front, Mender and Arcanist behind (tuning floors.frontRowClasses); the Mender sees least. */
const party = () => [strong('w', 'warden'), strong('m', 'mender', 12), strong('b', 'blade'), strong('a', 'arcanist')]
const melee = () => [strong('w', 'warden', 3), strong('b', 'blade', 3)]
/** A party that sees no trap coming (Perception 3; the Mender, 1, the lowest — the trap's victim). */
const dim = () => [strong('w', 'warden', 3), strong('m', 'mender', 1), strong('b', 'blade', 3), strong('a', 'arcanist', 3)]
const options = (over: Partial<DelveOptions> = {}): DelveOptions => ({ dungeonId: 'gravehollow-keep', seed: 17, difficulty: 'normal', pactIds: [], auto: false, policy: 'textbook', lastFloor: 8, ...over })

/** Content with the dungeon changed (a curio outcome forced to certain, a trap moved). */
function withDungeon(mutate: (d: DungeonDef & Record<string, any>) => void): Content {
  const d = structuredClone(base) as DungeonDef & Record<string, any>
  mutate(d)
  const dungeons = new Map(content.dungeons)
  dungeons.set(d.id, d)
  return { ...content, dungeons }
}
/** Content where one curio choice always rolls its outcome `index` (with its further lines). */
function forced(curioId: string, choice: number, index: number): Content {
  return withDungeon((d) => {
    const c = d.curios.find((x: CurioDef) => x.id === curioId)!
    const o = c.choices[choice]!.outcomes[index]!
    ;(c.choices[choice] as unknown as { outcomes: unknown[] }).outcomes = [{ ...o, chance: 100 }]
  })
}

function delve(c: Content, floor: number, heroes = party(), over: Partial<DelveOptions> = {}): DelveState {
  const s = createDelve(c, options({ floor, ...over }), heroes)
  expect(s.phase.kind).toBe('room')
  return s
}
const room = (s: DelveState) => s.floor.rooms[s.floor.currentRoomId]!
const graphRoom = (s: DelveState, id = s.floor.currentRoomId) => s.floor.graph.rooms.find((r) => r.id === id)!
function openDoor(s: DelveState) {
  return graphRoom(s).doors.find((d) => !d.secret && !d.locked)!
}
function useCurio(c: Content, s: DelveState, curioId: string, choice: number): void {
  const rs = room(s)
  rs.curioId = curioId
  rs.curioUsed = false
  s.phase = { kind: 'curio', curioId }
  stepDelve(c, s, { kind: 'curio', choice })
}
const trap = (trapId: string, over: Partial<TrapState> = {}): TrapState => ({ trapId, revealed: false, disarmed: false, triggered: false, blocksDoorTo: null, ...over })

describe('trap triggers (07 §2.5)', () => {
  it("a 'step' trap fires as the party crosses the room: the Bone Scythe hits both front-row heroes", () => {
    const s = delve(content, 4, dim())
    room(s).traps = [trap('bone-scythe')]
    stepDelve(content, s, { kind: 'move', toRoomId: openDoor(s).to })
    expect(s.log.some((e) => e.kind === 'trap' && e.data?.trap === 'bone-scythe')).toBe(true)
    const hp = s.heroes.map((h) => `${h.record.classId} ${h.hpPercent < 100}`)
    expect(hp).toEqual(['warden true', 'mender false', 'blade true', 'arcanist false'])
    expect(s.pendingStatuses.some((p) => p.status === 'bleed' && p.target === 'partyFront')).toBe(true)
  })

  it('an unrevealed trap on a door fires when the door is opened; a revealed one shuts it', () => {
    const s = delve(content, 2, dim())
    const door = openDoor(s)
    room(s).traps = [trap('rat-cage-drop', { blocksDoorTo: door.to })]
    const here = s.floor.currentRoomId
    expect(legalDelveActions(content, s).find((a) => a.command.kind === 'move' && a.command.toRoomId === door.to)?.enabled).toBe(true)
    stepDelve(content, s, { kind: 'move', toRoomId: door.to })
    expect(s.phase.kind).toBe('fight')
    expect(s.floor.currentRoomId).toBe(here)

    const r = delve(content, 2, party(), { seed: 18 })
    const d2 = openDoor(r)
    room(r).traps = [trap('rat-cage-drop', { blocksDoorTo: d2.to, revealed: true })]
    const move = legalDelveActions(content, r).find((a) => a.command.kind === 'move' && a.command.toRoomId === d2.to)
    expect(move?.enabled).toBe(false)
    expect(() => stepDelve(content, r, { kind: 'move', toRoomId: d2.to })).toThrow(/trap blocks/)
  })

  it("a 'loot' trap springs on the room's treasure: the Hag's Snare webs the picker and brings the Hag", () => {
    const s = delve(content, 7, dim())
    room(s).goldPiles = [50]
    room(s).traps = [trap('hags-snare')]
    stepDelve(content, s, { kind: 'takeGold' })
    expect(s.phase.kind).toBe('fight')
    expect(s.fight!.actors.some((a) => a.monster?.monsterId === 'brine-hag')).toBe(true)
    expect(room(s).goldPiles).toEqual([50])
  })

  it('the Drowning Bell rings only when the party walks in Shadowy or darker; the Warding Glyph only for a caster', () => {
    for (const [light, fires] of [[40, true], [80, false]] as const) {
      const s = delve(content, 7, dim())
      const door = openDoor(s)
      s.floor.rooms[door.to]!.traps = [trap('drowning-bell')]
      s.light = light + 5
      stepDelve(content, s, { kind: 'move', toRoomId: door.to })
      expect(s.log.some((e) => e.kind === 'trap' && e.data?.trap === 'drowning-bell'), `light ${light}`).toBe(fires)
    }
    for (const [heroes, fires] of [[melee(), false], [dim(), true]] as const) {
      const s = delve(content, 5, heroes)
      room(s).traps = [trap('warding-glyph')]
      stepDelve(content, s, { kind: 'move', toRoomId: openDoor(s).to })
      expect(s.log.some((e) => e.kind === 'trap' && e.data?.trap === 'warding-glyph')).toBe(fires)
    }
  })

  it('the Sentinel Eye wakes two Sentinels when the party uses a curio in its room', () => {
    const c = forced('brine-pool', 0, 0)
    // Three heroes: the pack is written for three (03 §11.2 scales it for two or four).
    const s = delve(c, 7, dim().slice(0, 3))
    room(s).traps = [trap('sentinel-eye')]
    useCurio(c, s, 'brine-pool', 0)
    expect(s.phase.kind).toBe('fight')
    expect(s.fight!.actors.filter((a) => a.monster?.monsterId === 'vault-sentinel').length).toBe(2)
  })

  it('the Falling Portcullis catches the back row and every pet: Stun 2 for the fight that follows', () => {
    const s = delve(content, 4, dim())
    const door = openDoor(s)
    const next = s.floor.rooms[door.to]!
    next.traps = [trap('falling-portcullis')]
    next.cleared = true // no fight in the room itself, so the Stun waits for the next one
    stepDelve(content, s, { kind: 'move', toRoomId: door.to })
    expect(s.log.some((e) => e.kind === 'trap' && e.data?.trap === 'falling-portcullis')).toBe(true)
    const stuns = s.pendingStatuses.filter((p) => p.status === 'stun' && p.sourceId === 'falling-portcullis')
    expect(stuns.map((p) => `${p.target}:${p.duration}:${p.fightsLeft}`).sort()).toEqual(['partyBack:2:1', 'pet:2:1'])
  })

  it('a target-less trap status lands on the victim alone (the lowest-Perception hero)', () => {
    const s = delve(content, 7, dim())
    room(s).traps = [trap('anemone-floor')]
    stepDelve(content, s, { kind: 'move', toRoomId: openDoor(s).to })
    if (s.phase.kind === 'fight') {
      // The next room held a fight: the Poison landed there, on the Mender (hero-1) alone.
      const poisoned = s.fight!.actors.filter((a) => a.statuses.some((x) => x.id === 'poison' && x.sourceId === 'anemone-floor')).map((a) => a.id)
      expect(poisoned).toEqual(['hero-1'])
    } else expect(s.pendingStatuses.find((p) => p.status === 'poison')?.heroIndex).toBe(1)
  })
})

describe('the Crypts\' and the Vault\'s curios (07 §2.4)', () => {
  it('the Leech Jar brings the Vault Leech: a hunter\'s fight in the room, L14, never fled — and it is remembered', () => {
    const c = forced('leech-jar', 0, 1)
    const s = delve(c, 7, party(), { auto: true })
    useCurio(c, s, 'leech-jar', 0)
    const leechKilled = s.huntersKilled ?? []
    // With auto on, the fight ran to its end; the hunter fight's record shows on the stats and the kill list.
    expect(s.stats.roundsByKind.hunter?.length).toBe(1)
    expect(leechKilled).toContain('vault-leech')
  })

  it('the Leech fight itself: no surprise, the hunter level and no flight', () => {
    const c = forced('leech-jar', 0, 1)
    const s = delve(c, 7)
    useCurio(c, s, 'leech-jar', 0)
    expect(s.fightContext?.kind).toBe('hunter')
    const leech = s.fight!.actors.find((a) => a.monster?.monsterId === 'vault-leech')!
    expect(leech.level).toBe(14)
    expect(leech.monster?.cannotFlee).toBe(true)
    expect(s.fight!.surprised).toBeNull()
  })

  it('the Sealed Sarcophagus can raise a Ghoul to fight', () => {
    const c = forced('sealed-sarcophagus', 0, 1)
    const s = delve(c, 4)
    useCurio(c, s, 'sealed-sarcophagus', 0)
    expect(s.phase.kind).toBe('fight')
    expect(s.fight!.actors.filter((a) => a.side === 'enemy').map((a) => a.monster?.monsterId)).toEqual(['ghoul'])
  })

  it('the Grave Bell: a Large chest and the clock +20; muffled with Linen from the delve\'s materials, a Small chest', () => {
    const s = delve(content, 5)
    const clock = s.floor.clock
    useCurio(content, s, 'grave-bell', 0)
    expect(room(s).chests.map((x) => x.size)).toEqual(['large'])
    expect(s.floor.clock).toBe(clock + 20)
    const r = delve(content, 5)
    r.materials.linen = 1
    useCurio(content, r, 'grave-bell', 1)
    expect(room(r).chests.map((x) => x.size)).toEqual(['small'])
    expect(r.materials.linen).toBe(0)
  })

  it('the Bone Reliquary\'s skull pays 0.06 R and runs the clock +10 (an outcome\'s further line)', () => {
    const s = delve(content, 4)
    const gold = s.gold
    const clock = s.floor.clock
    useCurio(content, s, 'bone-reliquary', 1)
    expect(s.gold).toBe(gold + goldFor(0.06, rForFloor(4, t)))
    expect(s.floor.clock).toBe(clock + 10)
  })

  it('the Reliquary\'s blessing: Fear immunity and +15% Holy damage on every hero for the floor', () => {
    const c = forced('bone-reliquary', 0, 0)
    const s = delve(c, 4)
    useCurio(c, s, 'bone-reliquary', 0)
    expect(s.pendingStatuses.map((p) => `${p.kind}:${p.status ?? p.line?.customId}:${p.fightsLeft}`)).toEqual(['resist:fear:null', 'hook:element-damage-percent:null'])
  })

  it('the Funeral Urns pay per urn (tuning floors.funeralUrns)', () => {
    const u = t.floors.funeralUrns
    const rich = { ...content, tuning: { ...t, floors: { ...t.floors, funeralUrns: { ...u, goldChance: 100, blindChance: 0, eggChance: 0 } } } } as Content
    const s = delve(rich, 5)
    const gold = s.gold
    useCurio(rich, s, 'funeral-urns', 0)
    expect(s.gold).toBe(gold + u.urns * goldFor(u.goldR, rForFloor(5, t)))
  })

  it('the Priestess\'s Hymnal: Silence immunity for the reader alone', () => {
    const c = forced('the-priestess-hymnal', 0, 0)
    const s = delve(c, 7)
    useCurio(c, s, 'the-priestess-hymnal', 0)
    expect(s.pendingStatuses).toEqual([expect.objectContaining({ kind: 'resist', status: 'silence', heroIndex: 0, fightsLeft: null })])
  })

  it('the Sluice Wheel drains the next flooded room; a Tide Gate otherwise floods the fight for both sides', () => {
    const drain = forced('rusted-sluice-wheel', 0, 0)
    const s = delve(drain, 7, dim())
    const gold = s.gold
    useCurio(drain, s, 'rusted-sluice-wheel', 0)
    expect(s.gold).toBe(gold + goldFor(0.1, rForFloor(7, t)))
    expect(s.floor.sluiceDrained).toBe(true)
    const door = openDoor(s)
    s.floor.rooms[door.to]!.traps = [trap('tide-gate')]
    stepDelve(drain, s, { kind: 'move', toRoomId: door.to })
    expect(s.floor.sluiceDrained).toBe(false)
    expect(s.pendingStatuses.some((p) => p.kind === 'modifier')).toBe(false)

    const r = delve(content, 7, dim())
    const d2 = openDoor(r)
    r.floor.rooms[d2.to]!.traps = [trap('tide-gate')]
    stepDelve(content, r, { kind: 'move', toRoomId: d2.to })
    const wading = r.pendingStatuses.filter((p) => p.kind === 'modifier')
    if (r.phase.kind === 'fight') {
      // The room held a fight: the wading landed on every actor of both sides.
      for (const a of r.fight!.actors.filter((x) => !x.gone)) expect(a.modifiers.some((m) => m.stat === 'speed' && m.amount === -10)).toBe(true)
    } else expect(wading.map((p) => `${p.stat}:${p.amount}:${p.bothSides}`)).toEqual(['speed:-10:true', 'accuracy:-10:true'])
  })

  it('Mourner\'s Candles: +20 light, and the next 4 new rooms cannot surprise the party', () => {
    const s = delve(content, 6)
    s.heroes[0]!.record = { ...s.heroes[0]!.record, bag: [...s.heroes[0]!.record.bag, { ...s.heroes[0]!.record.bag[0]!, instanceId: 'torch-x', itemId: 'torch', quantity: 1 }] }
    const light = s.light
    useCurio(content, s, 'mourners-candles', 0)
    expect(s.light).toBe(Math.min(100, light + 20))
    expect(s.floor.quietRooms).toBe(4)
    stepDelve(content, s, { kind: 'move', toRoomId: openDoor(s).to })
    expect(s.floor.quietRooms).toBe(3)
    expect(s.floor.ambushShiftHere).toBeLessThanOrEqual(-100)
  })

  it('the Tide Altar with a Brine Pearl from the delve\'s parts: a Shield of 30% max HP for 3 fights and +15 light', () => {
    const s = delve(content, 7)
    s.materials['brine-pearl'] = 2
    useCurio(content, s, 'tide-altar', 1)
    expect(s.materials['brine-pearl']).toBe(1)
    expect(s.pendingStatuses).toEqual([expect.objectContaining({ kind: 'status', status: 'shield', maxHpPercent: 30, fightsLeft: 3 })])
  })

  it('the Weeping Statue heals the party 30%', () => {
    const c = forced('weeping-statue', 0, 0)
    const s = delve(c, 4)
    for (const h of s.heroes) h.hpPercent = 50
    useCurio(c, s, 'weeping-statue', 0)
    expect(s.heroes.map((h) => h.hpPercent)).toEqual([80, 80, 80, 80])
  })
})

describe('the Crypts\' and the Vault\'s secrets (07 §2.6)', () => {
  function secretRoom(c: Content, floor: number, secretId: string): DelveState {
    for (let seed = 1; seed < 400; seed++) {
      const s = delve(c, floor, party(), { seed })
      if (!s.floor.graph.secretId) continue
      s.floor.secretId = secretId
      const host = s.floor.graph.rooms.find((r) => r.doors.some((d) => d.to === s.floor.graph.secretId && d.secret))!
      s.floor.currentRoomId = host.id
      s.floor.rooms[host.id]!.visited = true
      s.floor.rooms[host.id]!.secretRevealed = true
      s.floor.rooms[host.id]!.traps = []
      stepDelve(c, s, { kind: 'move', toRoomId: s.floor.graph.secretId })
      return s
    }
    throw new Error('no floor with a secret room')
  }

  it('the Pearl Cache holds a locked Large chest, steel and gold', () => {
    const s = secretRoom(content, 7, 'pearl-cache')
    expect(room(s).chests).toEqual([expect.objectContaining({ size: 'large', locked: true })])
    expect(s.materials.steel).toBeGreaterThanOrEqual(3)
  })

  it('the Drowned Shrine\'s Undertow: a Shield of 20% max HP at every fight of the floor', () => {
    const s = secretRoom(content, 7, 'the-drowned-shrine')
    expect(s.pendingStatuses).toEqual([expect.objectContaining({ status: 'shield', maxHpPercent: 20, fightsLeft: null })])
  })

  it('the Tidebound Confession marks the delve for Sister Naesa\'s arena', () => {
    const s = secretRoom(content, 7, 'the-tidebound-confession')
    expect(s.ruleFlags).toContain('tidebound-confession')
  })
})
