import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { Content } from '../../../../sim/src/content.ts'
import type { FightState } from '../../../../sim/src/fight-types.ts'
import type { EnvSet, KitPiece } from '../env/envKit.ts'
import type { FlamePoint } from '../vfx/layer.ts'
import { ArenaDressing, arenaPins, bossLampStrength, brazierOrder, braziersLit, candleOrder, candlesOut, markAt, tideHeight, tideShore, viewMark } from './arena.ts'
import { trs } from './builder.ts'
import type { LightPoint, StaticRoom, TemplateLike } from './dress.ts'
import { roomFrame } from './layout.ts'

/**
 * The boss arenas in 3D (room/arena.ts) in node: the marks the bosses stand on, the Warden's ring going out
 * counter-clockwise from the far side, the tide's height and shore, the throne's braziers, and the dressing over a
 * small fake room (its flames, lights, smoke, water and the throne's empty seat).
 */

/** The kit's candle ring (crypts.json `cry_candle_ring`): 12 candles 1.85 m round, from east going north. */
const RING: [number, number, number][] = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6
  return [1.85 * Math.cos(a), 0.6, -1.85 * Math.sin(a)]
})

describe('the arena marks (07 §2.2, §2.8)', () => {
  const fight = (templateBoss: string, phase: number, extra: Partial<FightState> = {}) =>
    ({
      actors: [
        { id: 'hero-0', side: 'party', kind: 'hero', fled: false, monster: null },
        { id: templateBoss, side: 'enemy', kind: 'monster', fled: false, monster: { monsterId: templateBoss, champion: null, phaseIndex: phase - 1 } },
        { id: 'rat-1', side: 'enemy', kind: 'monster', fled: false, monster: { monsterId: 'giant-rat', champion: null } },
      ],
      arena: { bossActorId: templateBoss, phase },
      ...extra,
    }) as unknown as FightState

  it('the King on his throne, raised 2 m, in phase 1 only; turned with the room', () => {
    const p1 = arenaPins('vlt-t-throne', 0, fight('hollow-king', 1))
    expect([...p1.keys()]).toEqual(['hollow-king'])
    expect(p1.get('hollow-king')).toEqual({ x: 0, y: 2, z: -5, yaw: 0 })
    expect(arenaPins('vlt-t-throne', 0, fight('hollow-king', 2)).size).toBe(0)
    const turned = arenaPins('vlt-t-throne', 90, fight('hollow-king', 1)).get('hollow-king')!
    expect(turned.x).toBeCloseTo(5)
    expect(turned.z).toBeCloseTo(0)
    expect(turned.y).toBe(2)
    expect(turned.yaw).toBeCloseTo(-Math.PI / 2)
  })

  it('Vexa on the dais and Naesa at the altar in phase 1; nothing in a room without marks or outside a fight', () => {
    expect(arenaPins('cel-t-tap-room', 0, fight('captain-vexa-marrow', 1)).get('captain-vexa-marrow')?.y).toBeCloseTo(0.25)
    expect(arenaPins('vlt-t-drowned-chapel', 0, fight('sister-naesa', 1)).get('sister-naesa')?.y).toBeCloseTo(0.6)
    expect(arenaPins('vlt-t-drowned-chapel', 0, fight('sister-naesa', 2)).size).toBe(0)
    expect(arenaPins('cry-t-wardens-vigil', 0, fight('barrow-warden', 1)).size).toBe(0)
    expect(arenaPins('vlt-t-throne', 0, null).size).toBe(0)
  })

  it('the Crypts chapel’s elite stands on the altar step (EB2, raised 0.6 m)', () => {
    const f = { actors: [{ id: 'bone-knight-1', side: 'enemy', kind: 'monster', fled: false, monster: { monsterId: 'bone-knight', champion: { affixIds: ['vicious'] } } }], arena: null } as unknown as FightState
    expect(arenaPins('cry-t-chapel', 0, f).get('bone-knight-1')).toEqual({ x: 0, y: 0.6, z: -3, yaw: 0 })
    const plain = { actors: [{ id: 'skeleton-1', side: 'enemy', kind: 'monster', fled: false, monster: { monsterId: 'skeleton-footman', champion: null } }], arena: null } as unknown as FightState
    expect(arenaPins('cry-t-chapel', 0, plain).size).toBe(0)
  })

  it('the room viewer stands a boss on his phase-1 mark when it shows him', () => {
    expect(viewMark('vlt-t-throne', ['hollow-king'])).toEqual({ monster: 'hollow-king', at: [0, 2, -5], skipParts: { vlt_throne_hollow: ['seat'] } })
    expect(viewMark('vlt-t-throne', ['giant-rat'])).toBeNull()
    expect(viewMark('cel-t-tap-room', ['captain-vexa-marrow', 'grinning-cutpurse'])?.at[1]).toBeCloseTo(0.25)
    expect(viewMark('cel-t-storeroom', ['giant-rat'])).toBeNull()
    // Dressed for an Elite fight, the Crypts chapel stands its first monster on the altar step.
    expect(viewMark('cry-t-chapel', ['bone-knight', 'skeleton-footman'], 'elite')).toEqual({ monster: 'bone-knight', at: [0, 0.6, -3], skipParts: {} })
    expect(viewMark('cry-t-chapel', ['bone-knight'], 'curio')).toBeNull()
    expect(markAt([1, 0.5, 2], 0, 180)).toMatchObject({ x: -1, y: 0.5, z: -2 })
  })
})

describe('the Warden’s ring of candles (07 §2.8)', () => {
  it('goes out counter-clockwise seen from above, from the candle farthest from the camera', () => {
    const order = candleOrder(RING.map(([x, , z]) => ({ x, z })), { x: 0, z: 0 }, { x: 0, z: 1 })
    // Camera to the south: the far candle is the north one (index 3), then north-west, west …
    expect(order.slice(0, 4)).toEqual([3, 4, 5, 6])
    expect(order).toHaveLength(12)
    expect(new Set(order).size).toBe(12)
    // Camera to the east: the far side is west (index 6), then south-west.
    expect(candleOrder(RING.map(([x, , z]) => ({ x, z })), { x: 0, z: 0 }, { x: 1, z: 0 }).slice(0, 2)).toEqual([6, 7])
  })

  it('shows lit of of the drawn candles', () => {
    expect(candlesOut(12, 12, 12)).toBe(0)
    expect(candlesOut(12, 7, 12)).toBe(5)
    expect(candlesOut(12, 0, 12)).toBe(12)
    expect(candlesOut(8, 6, 12)).toBe(4)
    expect(candlesOut(0, 3, 12)).toBe(0)
    expect(candlesOut(12, 20, 12)).toBe(0)
  })
})

describe('the tide and the braziers', () => {
  it('the water rises from the knee-deep 0.45 m to the throne’s fourth step, and creeps to the wall behind the party', () => {
    expect(tideHeight(0, 4)).toBeCloseTo(0.45)
    expect(tideHeight(2, 4)).toBeCloseTo(0.725)
    expect(tideHeight(4, 4)).toBeCloseTo(1)
    expect(tideHeight(9, 4)).toBeCloseTo(1)
    expect(tideHeight(1, 0)).toBeCloseTo(0.45)
    expect(tideShore(0, 4, 5, 8)).toBe(5)
    expect(tideShore(4, 4, 5, 8)).toBe(8)
    expect(tideShore(2, 4, 5, 8)).toBe(6.5)
  })

  it('the boss lamp lights a dark boss harder than a pale one', () => {
    expect(bossLampStrength(0x1f2226)).toBeGreaterThan(1)
    expect(bossLampStrength(0x999999)).toBeLessThan(0.6)
    expect(bossLampStrength(0xffffff)).toBe(0.4)
    expect(bossLampStrength(undefined)).toBe(1.1)
  })

  it('braziers in the arena’s order: the nearest the camera first, left to right; lit when relit this phase', () => {
    expect(brazierOrder([{ x: -5.6, z: -1.4 }, { x: 5.6, z: -1.4 }, { x: -5.6, z: 2.6 }, { x: 5.6, z: 2.6 }])).toEqual([2, 3, 0, 1])
    expect(braziersLit([{ kind: 'brazier', done: true }, { kind: 'keg', done: true }, { kind: 'brazier', done: false }])).toEqual([true, false])
  })
})

/* ---------- the dressing over a fake room ---------- */

function piece(meshId: string, lights: [number, number, number][], extra: Partial<KitPiece> = {}): KitPiece {
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  geometry.computeBoundingBox()
  return {
    meshId,
    mount: null,
    hole: null,
    translucent: null,
    role: null,
    geometry,
    water: null,
    parts: [],
    lights: lights.map(([x, y, z]) => ({ position: new THREE.Vector3(x, y, z), color: null, size: null })),
    fx: [],
    fxKinds: [],
    bounds: geometry.boundingBox!.clone(),
    triangles: 12,
    ...extra,
  }
}

const PIECES = new Map<string, KitPiece>([
  ['cry_candle_ring', piece('cry_candle_ring', RING)],
  ['vlt_brazier', piece('vlt_brazier', [[0, 1.5, 0]])],
  ['cel_dais', piece('cel_dais', [])],
  ['cel_chair_captain', piece('cel_chair_captain', [])],
])

/** A room as dress.ts builds it, just enough of it: its flames and lights from the template's props, its kit water. */
function fakeRoom(template: TemplateLike, cells: { x: number; y: number }[], water: string[] = [], seat = false): StaticRoom {
  const flames: FlamePoint[] = []
  for (const p of template.props) {
    const kp = PIECES.get(p.meshId)
    const m = trs(p.position[0] ?? 0, p.position[1] ?? 0, p.position[2] ?? 0, ((p.rotationY ?? 0) * Math.PI) / 180)
    for (const l of kp?.lights ?? []) {
      const at = l.position.clone().applyMatrix4(m)
      flames.push({ x: at.x, y: at.y, z: at.z, color: 0xffa040, size: p.meshId === 'vlt_brazier' ? 0.85 : 0.16 })
    }
  }
  const lights: LightPoint[] = flames.map((f) => ({ x: f.x, y: f.y + f.size * 0.4, z: f.z, color: f.color, strength: 1 }))
  const group = new THREE.Group()
  for (const name of water) group.add(Object.assign(new THREE.Mesh(), { name }))
  if (seat) group.add(Object.assign(new THREE.Mesh(), { name: 'vlt_throne_hollow.seat' }))
  const set = { zone: 'vault', piece: (id: string) => PIECES.get(id) ?? null, info: {} } as unknown as EnvSet
  return {
    group: new THREE.Group(),
    frame: roomFrame({ cells }),
    camera: { position: [0, 10, 18], lookAt: [0, 1, 0], fov: 44 },
    camDir: { x: 0, z: 1 },
    lights,
    flames,
    motes: [],
    arrival: null,
    sockets: { chestSmall: [], chestLarge: [], gold: [], trapPlates: [], cask: [], nest: [], cage: [] },
    taken: [],
    framePoints: [],
    landmarks: [],
    doorPanels: [],
    holes: [],
    obstacles: [],
    kit: { group, geometries: new Set(), triangles: 0, drawCalls: 0, dispose() {} },
    env: { set, materials: { solid: new THREE.MeshBasicMaterial(), water: new THREE.MeshBasicMaterial() } },
    kitShare: 'kit',
    dispose() {},
  }
}

const CONTENT = { monsters: new Map() } as unknown as Content
const prop = (meshId: string, x: number, y: number, z: number) => ({ meshId, position: [x, y, z], rotationY: 0 })
const TEMPLATE_CAM = { position: [0, 10, 18], lookAt: [0, 1, 0], fov: 44 }

describe('the arena dressing over a room', () => {
  it('the Vigil: the ring’s candles go out with the fight, the fight keeps off the ring, and the room remembers', () => {
    const tpl: TemplateLike = { camera: TEMPLATE_CAM, props: [prop('cry_candle_ring', 0, 0, -1.5)] }
    const room = fakeRoom(tpl, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }])
    const a = new ArenaDressing(CONTENT, { reduceMotion: true })
    a.setRoom(room, { templateId: 'cry-t-wardens-vigil', template: tpl, rotation: 0, place: 'r1' })
    expect(room.obstacles.some((o) => o.r > 2)).toBe(true)
    expect(a.flames(room.flames)).toHaveLength(12)
    const fight = { actors: [], arena: { bossActorId: 'w', bossId: 'barrow-warden', phase: 1, candles: { lit: 7, of: 12 }, tide: null, props: [] } } as unknown as FightState
    expect(a.sync(fight).flames).toBe(true)
    const shown = a.flames(room.flames)
    expect(shown).toHaveLength(7)
    // The north candle (the far side from a camera in the south) went first; the east one is still lit.
    expect(shown.some((f) => Math.abs(f.z + 1.5 + 1.85) < 0.01)).toBe(false)
    expect(shown.some((f) => Math.abs(f.x - 1.85) < 0.01)).toBe(true)
    expect(a.lights(room.lights)).toHaveLength(7)
    expect(a.sync(fight).flames).toBe(false)
    // The fight is over: the candles stay out in this room …
    a.sync(null)
    expect(a.flames(room.flames)).toHaveLength(7)
    // … but not in the next.
    a.setRoom(room, { templateId: 'cry-t-wardens-vigil', template: tpl, rotation: 0, place: 'r2' })
    expect(a.flames(room.flames)).toHaveLength(12)
    a.dispose()
  })

  it('the throne: braziers smoulder until a Torch relights them, the empty seat goes, the tide rises over the floor', () => {
    const tpl: TemplateLike = { camera: TEMPLATE_CAM, props: [prop('vlt_brazier', -5.6, 0, -1.4), prop('vlt_brazier', 5.6, 0, -1.4), prop('vlt_brazier', -5.6, 0, 2.6), prop('vlt_brazier', 5.6, 0, 2.6), prop('vlt_floor_water_knee', 0, 0, 3), prop('vlt_floor_water_edge', 0, 0, 4)] }
    const cells = [0, 1, 2].flatMap((x) => [0, 1].map((y) => ({ x, y })))
    const room = fakeRoom(tpl, cells, ['vlt_floor_water_knee~water', 'vlt_floor_water_edge~water'], true)
    const a = new ArenaDressing(CONTENT, { reduceMotion: true })
    a.setRoom(room, { templateId: 'vlt-t-throne', template: tpl, rotation: 0, place: 'throne' })
    const seat = room.kit!.group.getObjectByName('vlt_throne_hollow.seat')!
    const kneeWater = room.kit!.group.getObjectByName('vlt_floor_water_knee~water')!
    const sheet = a.group.getObjectByName('arena-tide')!
    expect(seat.visible).toBe(true)
    expect(sheet.visible).toBe(false)
    const fight = (level: number, lit: boolean[]) =>
      ({ actors: [{ id: 'hollow-king', monster: { phaseIndex: 0 } }], arena: { bossActorId: 'hollow-king', bossId: 'hollow-king', phase: 1, candles: null, tide: { level, max: 4, nextRound: null, stopped: false }, props: lit.map((done, i) => ({ id: `brazier-${i + 1}`, kind: 'brazier', done })) } }) as unknown as FightState
    a.sync(fight(0, [true, false, false, false]))
    expect(seat.visible).toBe(false)
    // brazier-1 is the front-left one (template x −5.6, z 2.6): it burns; the other three are embers.
    const flames = a.flames(room.flames)
    const big = flames.filter((f) => f.size > 0.5)
    expect(big).toHaveLength(1)
    expect(big[0]!.x).toBeCloseTo(-5.6)
    expect(big[0]!.z).toBeCloseTo(2.6)
    expect(flames.filter((f) => f.size < 0.3)).toHaveLength(3)
    expect(a.motes()).toHaveLength(3)
    expect(a.motes().every((m) => m.kind === 'smoke')).toBe(true)
    expect(a.lights(room.lights).filter((l) => l.strength < 0.5)).toHaveLength(3)
    // Phase 3: the water at the fourth step, the template's own water hidden under the sheet.
    a.sync(fight(4, [false, true, true, false]))
    expect(sheet.visible).toBe(true)
    expect(kneeWater.visible).toBe(false)
    expect(sheet.position.y).toBeCloseTo(1)
    const pos = (sheet as THREE.Mesh).geometry.getAttribute('position')
    expect(Math.max(pos.getZ(4), pos.getZ(5))).toBeCloseTo(8)
    a.sync(fight(0, [false, false, false, false]))
    expect(sheet.visible).toBe(false)
    expect(kneeWater.visible).toBe(true)
    a.dispose()
  })

  it('the tide eases when motion is allowed (an animation frame at a time)', () => {
    const tpl: TemplateLike = { camera: TEMPLATE_CAM, props: [prop('vlt_floor_water_knee', 0, 0, 3)] }
    const room = fakeRoom(tpl, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], ['vlt_floor_water_knee~water'])
    const a = new ArenaDressing(CONTENT, { reduceMotion: false })
    a.setRoom(room, { templateId: 'vlt-t-drowned-chapel', template: tpl, rotation: 90, place: 'chapel' })
    const fight = { actors: [], arena: { bossActorId: 'n', bossId: 'sister-naesa', phase: 1, candles: null, tide: { level: 2, max: 4, nextRound: 3, stopped: false }, props: [] } } as unknown as FightState
    a.sync(fight)
    const sheet = a.group.getObjectByName('arena-tide')!
    expect(sheet.visible).toBe(false)
    a.frame(300)
    const y1 = sheet.position.y
    expect(sheet.visible).toBe(true)
    expect(y1).toBeGreaterThan(0.45)
    expect(y1).toBeLessThan(0.725)
    for (let i = 0; i < 60; i++) a.frame(100)
    expect(sheet.position.y).toBeCloseTo(0.725, 2)
    // The room is turned a quarter: so is the sheet.
    expect(sheet.rotation.y).toBeCloseTo(-Math.PI / 2)
    a.setReduceMotion(true)
    a.dispose()
  })

  it('the tap room gets its dais and the Captain’s chair, which the party keeps off', () => {
    const tpl: TemplateLike = { camera: TEMPLATE_CAM, props: [prop('cel_table_long', 0, 0, -5)] }
    const room = fakeRoom(tpl, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }])
    const a = new ArenaDressing(CONTENT, { reduceMotion: true })
    a.setRoom(room, { templateId: 'cel-t-tap-room', template: tpl, rotation: 0, place: 'tap' })
    const kit = a.group.getObjectByName('kit')!
    expect(kit.children.map((c) => c.name).sort()).toEqual(['cel_chair_captain', 'cel_dais'])
    expect(room.obstacles).toHaveLength(3)
    expect(room.taken).toHaveLength(1)
    // A template that places its own dais gets no second one.
    const own: TemplateLike = { camera: TEMPLATE_CAM, props: [prop('cel_dais', 0, 0, -6)] }
    a.setRoom(fakeRoom(own, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]), { templateId: 'cel-t-tap-room', template: own, rotation: 0, place: 'tap' })
    expect(a.group.getObjectByName('kit')).toBeUndefined()
    a.dispose()
  })
})
