import { describe, expect, it } from 'vitest'
import { fitView, lerpFit, NO_INSETS } from './fit.ts'
import {
  approachFor,
  CELL,
  doorway,
  fightFormation,
  floorTiles,
  freeSpot,
  placedRect,
  previousRoomId,
  propYaw,
  roomCamera,
  roomFormation,
  roomFrame,
  rotatePoint,
  scenicRandom,
  spread,
  wallRuns,
  type FormationActor,
} from './layout.ts'
import { lightLook } from './look.ts'

describe('room frame and doorways', () => {
  it('a 1×2 room is 8 m wide and 16 m deep, centred on the origin', () => {
    const f = roomFrame({ cells: [{ x: 2, y: 2 }, { x: 2, y: 3 }] })
    expect(f).toEqual({ gx: 2, gy: 2, w: 1, h: 2, width: CELL, depth: 2 * CELL })
  })

  it('places a door at its cell mid-edge with the inward normal', () => {
    const f = roomFrame({ cells: [{ x: 2, y: 2 }, { x: 2, y: 3 }] })
    expect(doorway(f, { to: 'r3', side: 'west', offset: 0, locked: false, secret: false })).toMatchObject({ x: -4, z: -4, nx: 1, nz: 0 })
    expect(doorway(f, { to: 'r4', side: 'south', offset: 0, locked: false, secret: false })).toMatchObject({ x: 0, z: 8, nx: 0, nz: -1 })
    expect(doorway(f, { to: 'r1', side: 'north', offset: 0, locked: false, secret: false })).toMatchObject({ x: 0, z: -8, nx: 0, nz: 1 })
  })
})

describe('walls', () => {
  const f = roomFrame({ cells: [{ x: 0, y: 0 }] })

  it('a door splits its edge into two 3 m runs; the other edges stay whole', () => {
    const runs = wallRuns(f, [{ side: 'north', offset: 0 }], { x: 0, z: 1 })
    const north = runs.filter((r) => r.side === 'north')
    expect(north.map((r) => r.length)).toEqual([3, 3])
    expect(north.map((r) => r.x)).toEqual([-2.5, 2.5])
    expect(runs.filter((r) => r.side === 'east').map((r) => r.length)).toEqual([8])
  })

  it('the wall facing the camera is low, the others full height', () => {
    const runs = wallRuns(f, [], { x: 0, z: 1 })
    expect(runs.find((r) => r.side === 'south')!.low).toBe(true)
    expect(runs.find((r) => r.side === 'north')!.low).toBe(false)
    expect(runs.find((r) => r.side === 'east')!.low).toBe(false)
  })
})

describe('rotation (the generator turns templates clockwise)', () => {
  it('a quarter turn sends north to east', () => {
    // A point on the north edge's middle ends on the east edge's middle.
    expect(rotatePoint(0, -4, 90)).toEqual({ x: 4, z: 0 })
    expect(rotatePoint(0, -4, 180)).toEqual({ x: -0, z: 4 })
    expect(rotatePoint(0, -4, 270)).toEqual({ x: -4, z: -0 })
    expect(rotatePoint(3, 1, 0)).toEqual({ x: 3, z: 1 })
  })

  it("the wine vault's north door on its east cell lands on the west side's top cell at 270°", () => {
    // Template: 2×1, door N offset 1 → (+4, −4). The generator reports it as west offset 0 on a 1×2 room.
    const p = rotatePoint(4, -4, 270)
    const f = roomFrame({ cells: [{ x: 2, y: 2 }, { x: 2, y: 3 }] })
    const d = doorway(f, { to: 'r3', side: 'west', offset: 0, locked: false, secret: false })
    expect(p).toEqual({ x: d.x, z: d.z })
  })

  it('a prop yaw subtracts the room rotation', () => {
    expect(propYaw(90, 90)).toBeCloseTo(0)
    expect(propYaw(0, 90)).toBeCloseTo(-Math.PI / 2)
  })

  it('the camera turns with the room', () => {
    const f = roomFrame({ cells: [{ x: 0, y: 0 }] })
    const cam = roomCamera(f, { position: [0, 8, 10], lookAt: [0, 1, 0], fov: 40 }, 90)
    expect(cam.position[0]).toBeCloseTo(-10)
    expect(cam.position[1]).toBe(8)
    expect(cam.position[2]).toBeCloseTo(0)
  })
})

describe('where the party came in', () => {
  const log = [
    { floor: 1, roomId: 'r0', kind: 'room' },
    { floor: 1, roomId: 'r0', kind: 'trapRevealed' },
    { floor: 1, roomId: 'r1', kind: 'room' },
    { floor: 1, roomId: 'r1', kind: 'fightStart' },
  ]

  it('is the room of the previous room event', () => {
    expect(previousRoomId(log, 1, 'r1')).toBe('r0')
  })

  it('after a flight back (no room event) it is the room fled', () => {
    expect(previousRoomId(log, 1, 'r0')).toBe('r1')
  })

  it('a new floor has none', () => {
    expect(previousRoomId([...log, { floor: 2, roomId: 'r0', kind: 'room' }], 2, 'r0')).toBeNull()
  })

  it('stands at the door, else the arrival point, else the camera side', () => {
    const f = roomFrame({ cells: [{ x: 0, y: 0 }] })
    const doors = [doorway(f, { to: 'r0', side: 'north', offset: 0, locked: false, secret: false })]
    expect(approachFor(f, doors, 'r0', null, { x: 0, z: 1 })).toEqual({ x: 0, z: -4, nx: 0, nz: 1 })
    const atStairs = approachFor(f, doors, null, { x: 0, z: -2 }, { x: 0, z: 1 })
    expect(atStairs.nz).toBeCloseTo(1)
    expect(approachFor(f, doors, null, null, { x: 1, z: 0 })).toEqual({ x: 4, z: 0, nx: -1, nz: 0 })
  })
})

describe('formations', () => {
  const f = roomFrame({ cells: [{ x: 0, y: 0 }] })
  const fromNorth = { x: 0, z: -4, nx: 0, nz: 1 }
  const party: FormationActor[] = [
    { id: 'hero-0', side: 'party', line: 'front', girth: 0.6 },
    { id: 'hero-1', side: 'party', line: 'back', girth: 0.6 },
    { id: 'pet-0', side: 'party', line: 'pet', girth: 0.6 },
  ]

  it('the party stands inside the door in its lines, facing in', () => {
    const m = roomFormation(f, fromNorth, party)
    expect(m.get('pet-0')!.z).toBeCloseTo(-3)
    expect(m.get('hero-1')!.z).toBeCloseTo(-1.9)
    expect(m.get('hero-0')!.z).toBeCloseTo(-0.8)
    expect(m.get('hero-0')!.yaw).toBeCloseTo(0)
  })

  it('in a fight the enemies face the party across the middle', () => {
    const foes: FormationActor[] = [
      { id: 'rat-1', side: 'enemy', line: 'front', girth: 1 },
      { id: 'rat-2', side: 'enemy', line: 'front', girth: 1 },
      { id: 'boss', side: 'enemy', line: 'back', girth: 2 },
    ]
    const m = fightFormation(f, fromNorth, [...party, ...foes])
    expect(m.get('hero-0')!.z).toBeLessThan(0)
    expect(m.get('rat-1')!.z).toBeGreaterThan(0)
    expect(m.get('boss')!.z).toBeGreaterThan(m.get('rat-1')!.z)
    expect(Math.cos(m.get('rat-1')!.yaw)).toBeCloseTo(-1)
    // Everyone stays inside the room.
    for (const mark of m.values()) {
      expect(Math.abs(mark.x)).toBeLessThan(4)
      expect(Math.abs(mark.z)).toBeLessThan(4)
    }
  })

  it('a crowded line squeezes to fit the room', () => {
    const offs = spread(6, 1.4, 4)
    expect(offs).toHaveLength(6)
    expect(Math.max(...offs)).toBeLessThanOrEqual(3.3 + 1e-9)
    expect(offs[0]).toBeCloseTo(-offs[5]!)
  })
})

describe('floor tiles and spots', () => {
  it('a stair pit removes the tiles under it', () => {
    const f = roomFrame({ cells: [{ x: 0, y: 0 }] })
    expect(floorTiles(f, [])).toHaveLength(16)
    const pit = placedRect({ x0: -2, z0: -2.5, x1: 2, z1: 1.5 }, 0, -1.5, 0)
    expect(pit).toEqual({ x0: -2, z0: -4, x1: 2, z1: 0 })
    expect(floorTiles(f, [pit])).toHaveLength(12)
  })

  it('a placed rectangle turns with its yaw', () => {
    const r = placedRect({ x0: -2, z0: -1, x1: 2, z1: 1 }, 0, 0, Math.PI / 2)
    expect(r.x0).toBeCloseTo(-1)
    expect(r.z0).toBeCloseTo(-2)
  })

  it('a free spot is the candidate farthest from everything', () => {
    expect(freeSpot([{ x: 0, z: 0 }, { x: 3, z: 0 }], [{ x: 0.5, z: 0 }])).toEqual({ x: 3, z: 0 })
  })

  it('the scenery random is deterministic', () => {
    const a = scenicRandom(5)
    const b = scenicRandom(5)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})

describe('light look (03 §4.2)', () => {
  it('Radiant is brighter and clearer than Pitch, whose torch is out', () => {
    const radiant = lightLook(100)
    const pitch = lightLook(0)
    expect(radiant.hemi).toBeGreaterThan(pitch.hemi)
    expect(radiant.fogK).toBeLessThan(pitch.fogK)
    expect(pitch.torch).toBe(0)
    expect(lightLook(50).torch).toBeGreaterThan(0)
  })
})

describe('framing the camera around the overlay', () => {
  it('centres bounds in the free region and zooms to fit', () => {
    const fit = fitView({ x0: -0.5, x1: 0.5, y0: -0.5, y1: 0.5 }, 800, 400, NO_INSETS, { margin: 0, minZoom: 0.5, maxZoom: 3 })
    expect(fit.zoom).toBeCloseTo(2)
    expect(fit.offsetX).toBeCloseTo(0)
    expect(fit.offsetY).toBeCloseTo(0)
  })

  it('a panel on the right shifts the picture left (a positive view offset)', () => {
    const fit = fitView({ x0: -0.5, x1: 0.5, y0: -0.5, y1: 0.5 }, 800, 400, { top: 0, right: 200, bottom: 0, left: 0 }, { margin: 0, minZoom: 0.5, maxZoom: 1 })
    expect(fit.zoom).toBe(1)
    // The free region is x ∈ [−1, 0.5]: its centre is −0.25 NDC = 100 px left of the middle.
    expect(fit.offsetX).toBeCloseTo(100)
  })

  it('never zooms past its limits, and eases between fits', () => {
    const fit = fitView({ x0: -0.01, x1: 0.01, y0: -0.01, y1: 0.01 }, 800, 400, NO_INSETS, { margin: 0, minZoom: 0.5, maxZoom: 1.5 })
    expect(fit.zoom).toBe(1.5)
    const mid = lerpFit({ zoom: 1, offsetX: 0, offsetY: 0 }, { zoom: 2, offsetX: 100, offsetY: -50 }, 0.5)
    expect(mid).toEqual({ zoom: 1.5, offsetX: 50, offsetY: -25 })
  })
})

describe('keeping clear of the furniture', () => {
  it('slides a formation off a table, the smallest way that works', async () => {
    const { nudgeFormation } = await import('./layout.ts')
    const f = roomFrame({ cells: [{ x: 0, y: 0 }] })
    const marks = new Map([
      ['a', { x: 0, z: 0, yaw: 0 }],
      ['b', { x: 1, z: 0, yaw: 0 }],
    ])
    const girth = new Map([
      ['a', 0.6],
      ['b', 0.6],
    ])
    const out = nudgeFormation(marks, girth, [{ x: 0.5, z: 0, r: 1 }], f, { x: 0, z: 1 }, { along: [0, 1, -1, 2, -2], across: [0, 1.5, -1.5] })
    for (const m of out.values()) expect(Math.hypot(m.x - 0.5, m.z)).toBeGreaterThanOrEqual(1.3 - 1e-9)
    // Nothing in the way: nothing moves.
    expect(nudgeFormation(marks, girth, [{ x: 3, z: 3, r: 0.4 }], f, { x: 0, z: 1 }, { along: [0, 1], across: [0, 1] })).toEqual(marks)
  })
})
