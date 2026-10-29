/**
 * Pass C1 (Phase 7): Gravehollow at 8 floors (07 §2.3, D-104) on the real content — the floor table, the bands as
 * data (08's R table), Dunmore Quist's stock from tuning (07 §2.7, D-099), the generator's boss-floor merchant and
 * fixed boss rooms (07 §2.10, §8.1), the role mix a floor can meet, the Vault's joiner, the Waystones (07 §1.1,
 * D-083), and whole Crypts and Vault delves replaying to the same hash.
 */
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import type { Content } from '../src/content.ts'
import { createDelve, hashDelve, replayDelve, runDelveAuto } from '../src/delve.ts'
import type { DelveOptions, DelveState } from '../src/delve-types.ts'
import { chestBandGrade, rForFloor, rForGrade } from '../src/economy.ts'
import { encountersFor, floorDef, isBeforeFinalBoss, isWaystoneFloor, meetsRoleMix, merchantStock, spawnEncounter } from '../src/explore.ts'
import { SHIPPED_BANDS, bandForFloor } from '../src/grades.ts'
import { createHero } from '../src/hero.ts'
import { Rng } from '../src/rng.ts'
import { litWaystones, waystoneFloors, type Profile } from '../src/town.ts'
import type { DungeonDef, HeroRecord } from '../src/types/content.ts'

const content = loadContentDir('content')
const t = content.tuning
const dungeon = content.dungeons.get('gravehollow-keep') as DungeonDef

function strong(id: string, classId: string): HeroRecord {
  const h = createHero(content, t, Rng.fromSeed(7), { id, name: id, speciesId: 'human', classId, freePoints: { strength: 2, endurance: 2, vitality: 2 } })
  const attributes = Object.fromEntries(Object.keys(h.attributes).map((k) => [k, k === 'luck' ? 10 : 60])) as HeroRecord['attributes']
  return { ...h, level: 20, attributes }
}
const party = () => [strong('w', 'warden'), strong('m', 'mender'), strong('b', 'blade'), strong('a', 'arcanist')]
const options = (over: Partial<DelveOptions> = {}): DelveOptions => ({ dungeonId: 'gravehollow-keep', seed: 17, difficulty: 'normal', pactIds: [], auto: true, policy: 'textbook', ...over })

describe('Gravehollow at 8 floors (07 §2.3, D-104)', () => {
  it('three zones, eight floors, the band levels and the levelRange', () => {
    expect(dungeon.zones.map((z) => `${z.id} ${z.floors.from}-${z.floors.to}`)).toEqual(['the-cellars 1-3', 'the-crypts 4-6', 'the-drowned-vault 7-8'])
    expect(dungeon.floors.map((f) => f.monsterLevel)).toEqual([1, 2, 4, 5, 7, 8, 11, 13])
    expect(dungeon.levelRange).toEqual({ min: 1, max: 13 })
    expect(dungeon.generator.minRooms).toBe(4)
    expect(dungeon.zones.map((z) => z.bossIds)).toEqual([['captain-vexa-marrow'], ['barrow-warden'], ['sister-naesa', 'hollow-king']])
  })

  it('merchants on F2, F5, F6 and F7; no hunter clock on the boss floors; the throne is four rooms', () => {
    expect(dungeon.floors.filter((f) => f.merchant).map((f) => f.floor)).toEqual([2, 5, 6, 7])
    expect(dungeon.floors.filter((f) => f.hunterClock === null).map((f) => f.floor)).toEqual([3, 6, 7, 8])
    expect(dungeon.floors.filter((f) => f.bossId).map((f) => `${f.floor}:${f.bossId}`)).toEqual(['3:captain-vexa-marrow', '6:barrow-warden', '7:sister-naesa', '8:hollow-king'])
    const f8 = floorDef(dungeon, 8)
    expect([f8.roomsMin, f8.roomsMax, f8.secretChance]).toEqual([4, 4, 0])
  })

  it('the Vault keeps its Leech with no clock, the Hag\'s Snare at 34, and every zone its curios, traps and secrets', () => {
    expect(dungeon.zones[2]!.hunterId).toBe('vault-leech')
    expect(dungeon.traps.find((tr) => tr.id === 'hags-snare')?.difficulty).toBe(34)
    const byZone = (list: readonly { zoneId: string | null }[]) => ['the-cellars', 'the-crypts', 'the-drowned-vault'].map((z) => list.filter((x) => x.zoneId === z).length)
    expect(byZone(dungeon.curios)).toEqual([8, 8, 8])
    expect(byZone(dungeon.traps)).toEqual([6, 6, 6])
    expect(byZone(dungeon.secrets ?? [])).toEqual([3, 3, 3])
    expect(dungeon.templates.length).toBe(30)
  })

  it('Waystones stand on each zone\'s first floor (F1, F4, F7)', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].filter((f) => isWaystoneFloor(dungeon, f))).toEqual([1, 4, 7])
  })
})

describe('the bands are data (08 R table, tuning bands)', () => {
  it('the pinned copy is the tuning\'s, row for row', () => {
    expect(SHIPPED_BANDS).toEqual(t.bands.floors)
  })

  it('D 7–8, C 9–13; R and the chest band read the tuning', () => {
    expect(bandForFloor(8, t)).toMatchObject({ grade: 'D', r: 770 })
    expect(bandForFloor(9, t)).toMatchObject({ grade: 'C', r: 1230 })
    expect(rForFloor(7, t)).toBe(770)
    expect(rForGrade(t, 'C')).toBe(1230)
    expect(chestBandGrade(8, t)).toBe('D')
    expect(chestBandGrade(33, t)).toBe('A')
  })
})

describe("Dunmore Quist's cart from tuning (07 §2.7, D-099)", () => {
  const input = (floor: number) => ({ r: rForFloor(floor, t), hagglingRank: 0, centreGrade: 'E', classIds: ['warden', 'ranger'], zoneId: floorDef(dungeon, floor).zoneId, beforeFinalBoss: isBeforeFinalBoss(dungeon, floor) })
  const qty = (offers: { itemId: string; quantity: number }[], id: string) => offers.find((o) => o.itemId === id)?.quantity ?? 0

  it('three Torches on F5, four on F7 — the last merchant before the throne', () => {
    expect(isBeforeFinalBoss(dungeon, 7)).toBe(true)
    expect(isBeforeFinalBoss(dungeon, 6)).toBe(false)
    expect(qty(merchantStock(content, t, Rng.fromSeed(1), input(5)), 'torch')).toBe(3)
    expect(qty(merchantStock(content, t, Rng.fromSeed(1), input(7)), 'torch')).toBe(4)
  })

  it('arrows and bolts on every cart, and the zone\'s own safe items', () => {
    for (const floor of [2, 5, 6, 7]) {
      const offers = merchantStock(content, t, Rng.fromSeed(floor), input(floor))
      expect(qty(offers, 'arrows')).toBeGreaterThan(0)
      expect(qty(offers, 'bolts')).toBeGreaterThan(0)
      const zone = floorDef(dungeon, floor).zoneId
      const safe = offers.filter((o) => content.items.get(o.itemId)?.tags?.includes('safe-item'))
      expect(safe.length).toBeGreaterThan(0)
      for (const s of safe) expect(content.items.get(s.itemId)?.tags).toContain(`zone:${zone}`)
    }
  })
})

describe('the generator on the new floors (07 §2.10, §8.1)', () => {
  const graphAt = (floor: number, seed: number) => createDelve(content, options({ floor, seed, auto: false }), party()).floor.graph

  it('F6 and F7 put the merchant on the spine just before the anteroom', () => {
    for (const floor of [6, 7]) {
      for (let seed = 1; seed <= 12; seed++) {
        const g = graphAt(floor, seed)
        const merchant = g.rooms.find((r) => r.kind === 'merchant')!
        const ante = g.rooms.find((r) => r.id === g.restId)!
        expect(merchant.onSpine, `F${floor} seed ${seed}`).toBe(true)
        expect(ante.doors.some((d) => d.to === merchant.id), `F${floor} seed ${seed}`).toBe(true)
        expect(merchant.hop).toBe(ante.hop - 1)
      }
    }
  })

  it('the boss rooms are fixed: the chapel on F7, the throne on F8 (Entry · Antechamber · Rest · Throne)', () => {
    for (let seed = 1; seed <= 8; seed++) {
      expect(graphAt(7, seed).rooms.find((r) => r.kind === 'boss')?.templateId).toBe('vlt-t-drowned-chapel')
      const throne = graphAt(8, seed)
      expect(throne.rooms.map((r) => r.kind)).toEqual(['entry', 'fight', 'rest', 'boss'])
      expect(throne.rooms.find((r) => r.kind === 'boss')?.templateId).toBe('vlt-t-throne')
      expect(throne.rooms.find((r) => r.kind === 'fight')?.encounterId).toBe('throne-antechamber')
    }
  })

  it('the role mix asks only for the roles a floor\'s encounters can field (F4 has no role-Elite)', () => {
    const f4 = floorDef(dungeon, 4)
    const pool = encountersFor(content, f4, dungeon.id)
    const ids = ['grave-watch', 'shamblers', 'belfry']
    expect(meetsRoleMix(content, ids, 4)).toBe(false)
    expect(meetsRoleMix(content, ids, 4, pool)).toBe(true)
    expect(meetsRoleMix(content, ['grave-watch', 'belfry', 'belfry'], 4, pool)).toBe(false)
  })
})

describe("the Vault's joiner (06 §3.3: a Pearl Ooze joins any Vault fight at 5%)", () => {
  function withJoinerChance(chance: number): Content {
    const d = structuredClone(dungeon) as DungeonDef & { zones: { joiners?: { chancePercent: number }[] }[] }
    for (const z of d.zones) for (const j of z.joiners ?? []) j.chancePercent = chance
    const dungeons = new Map(content.dungeons)
    dungeons.set(d.id, d)
    return { ...content, dungeons }
  }
  const opts = { level: 11, partySize: 3, enemyHpPercent: 100, enemyCountPercent: 100 }

  it('joins at its chance, never in the Cellars or the Crypts', () => {
    const always = withJoinerChance(100)
    const never = withJoinerChance(0)
    const procession = content.encounters.get('tide-procession')!
    const ids = (c: Content, e = procession) => spawnEncounter(c, t, Rng.fromSeed(3), e, opts).map((a) => a.monster?.monsterId)
    expect(ids(always)).toContain('pearl-ooze')
    expect(ids(never)).not.toContain('pearl-ooze')
    expect(ids(always, content.encounters.get('grave-watch')!)).not.toContain('pearl-ooze')
    // The Cellars' and the Crypts' encounters draw nothing for a joiner: the rng is untouched.
    const a = Rng.fromSeed(9)
    spawnEncounter(always, t, a, content.encounters.get('rat-pack')!, { ...opts, level: 1 })
    expect(a.state).toEqual(Rng.fromSeed(9).state)
  })
})

describe('the Waystone (07 §1.1, D-083)', () => {
  const profile = (deepest: number, bossKills: Record<string, number> = {}) => ({ progress: { deepest: { 'gravehollow-keep': deepest }, bossKills, delves: 0, clears: 0, wipes: 0 } }) as unknown as Profile
  it('lights a zone\'s stone once the zone before it is finished; offers every remembered floor', () => {
    expect(litWaystones(content, profile(0), 'gravehollow-keep')).toEqual([1])
    expect(litWaystones(content, profile(3), 'gravehollow-keep')).toEqual([1, 4])
    expect(litWaystones(content, profile(6), 'gravehollow-keep')).toEqual([1, 4, 7])
    expect(litWaystones(content, profile(0, { 'captain-vexa-marrow': 1 }), 'gravehollow-keep')).toEqual([1, 4])
    expect(waystoneFloors(content, profile(0), 'gravehollow-keep')).toEqual([1])
    expect(waystoneFloors(content, profile(3), 'gravehollow-keep')).toEqual([1, 2, 3, 4])
    expect(waystoneFloors(content, profile(7), 'gravehollow-keep')).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(waystoneFloors(content, profile(0, { 'barrow-warden': 1 }), 'gravehollow-keep')).toEqual([1, 7])
  })
})

describe('whole delves of the Crypts and the Vault', () => {
  function run(zone: number, seed: number): DelveState {
    const opts = options({ zone, seed })
    const s = createDelve(content, opts, party())
    runDelveAuto(content, s, 4000)
    const replay = replayDelve(content, opts, party(), s.commandLog)
    expect(hashDelve(replay)).toBe(hashDelve(s))
    return s
  }

  it('the Crypts (F4–6) begin at the Crypt Waystone and play to an outcome, deterministically', () => {
    const s = run(2, 17)
    expect(s.log.find((e) => e.kind === 'floor')?.floor).toBe(4)
    expect(s.log.some((e) => e.kind === 'waystone' && e.floor === 4)).toBe(true)
    expect(s.phase.kind).toBe('over')
  })

  it('the Drowned Vault (F7–8) begins at its Waystone and plays to an outcome, deterministically', () => {
    const s = run(3, 17)
    expect(s.log.some((e) => e.kind === 'waystone' && e.floor === 7)).toBe(true)
    expect(s.phase.kind).toBe('over')
  })
})
