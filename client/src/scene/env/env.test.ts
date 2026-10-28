import { describe, expect, it } from 'vitest'
import { roomFrame } from '../room/layout.ts'
import { AO_FLOOR, envColour, envShade, envSlot, FALLBACK_PALETTE, flameColourFor, instanceGroups, isTranslucent, kitZoneOf, lightKind, parseEnvZone, pickVariant, pickWeighted, readPalette, TORCH_COLOUR, translucencyOf, turnSide } from './envData.ts'
import { inwardYaw, shellLayout, subtractIntervals, type ShellPlacement } from './shell.ts'

const ONE = roomFrame({ cells: [{ x: 0, y: 0 }] })
const WIDE = roomFrame({ cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] })
/** The camera south of the room looking north: the south wall is the cut-away one. */
const FROM_SOUTH = { x: 0, z: 1 }

function of(list: ShellPlacement[], role: ShellPlacement['role'], side?: string): ShellPlacement[] {
  return list.filter((p) => p.role === role && (side === undefined || p.side === side))
}

describe('a room shell from its footprint and doors (07 §2.2 grid)', () => {
  it('a closed 1×1 room: sixteen 2 m floor tiles, four 2 m segments a side, four corners', () => {
    const s = shellLayout(ONE, [], FROM_SOUTH)
    expect(of(s, 'floor')).toHaveLength(16)
    for (const side of ['north', 'east', 'south', 'west']) expect(of(s, 'wall', side).map((w) => w.sx)).toEqual([1, 1, 1, 1])
    expect(of(s, 'corner')).toHaveLength(4)
    expect(of(s, 'doorway')).toHaveLength(0)
  })

  it('walls face into the room: north 0, east −π/2, south π, west π/2, standing on the edge line', () => {
    expect(inwardYaw('north')).toBe(0)
    expect(inwardYaw('east')).toBeCloseTo(-Math.PI / 2)
    expect(inwardYaw('south')).toBeCloseTo(Math.PI)
    expect(inwardYaw('west')).toBeCloseTo(Math.PI / 2)
    const s = shellLayout(ONE, [], FROM_SOUTH)
    expect(of(s, 'wall', 'north').every((w) => w.z === -4 && w.yaw === 0)).toBe(true)
    expect(of(s, 'wall', 'east').every((w) => w.x === 4)).toBe(true)
    expect(of(s, 'wall', 'north').map((w) => w.x)).toEqual([-3, -1, 1, 3])
  })

  it('a 4 m doorway piece (2 m opening + jambs) takes the middle two segments of its cell edge', () => {
    const s = shellLayout(ONE, [{ side: 'north', offset: 0, to: 'r2' }], FROM_SOUTH, { doorwayWidth: 4 })
    expect(of(s, 'wall', 'north').map((w) => [w.x, w.sx])).toEqual([
      [-3, 1],
      [3, 1],
    ])
    expect(of(s, 'doorway')).toEqual([expect.objectContaining({ x: 0, z: -4, yaw: 0, to: 'r2', low: false })])
  })

  it('a 2 m doorway trims the two middle segments to 1 m each', () => {
    const s = shellLayout(ONE, [{ side: 'east', offset: 0 }], FROM_SOUTH, { doorwayWidth: 2 })
    expect(of(s, 'wall', 'east').map((w) => [w.z, w.sx])).toEqual([
      [-3, 1],
      [-1.5, 0.5],
      [1.5, 0.5],
      [3, 1],
    ])
  })

  it('the side facing the camera is cut down; its doorway is an open 2 m gap unless the kit has a cut doorway', () => {
    const s = shellLayout(ONE, [{ side: 'south', offset: 0 }], FROM_SOUTH, { doorwayWidth: 4, cutaway: 0.55 / 3.5 })
    const south = of(s, 'wall', 'south')
    expect(south.every((w) => w.low && Math.abs(w.sy - 0.55 / 3.5) < 1e-9)).toBe(true)
    expect(south.map((w) => w.sx)).toEqual([1, 0.5, 0.5, 1])
    expect(of(s, 'doorway')).toHaveLength(0)
    const cut = shellLayout(ONE, [{ side: 'south', offset: 0 }], FROM_SOUTH, { doorwayWidth: 4, cutDoorways: true })
    expect(of(cut, 'doorway')).toEqual([expect.objectContaining({ low: true, x: 0, z: 4 })])
    expect(of(cut, 'wall', 'south').map((w) => w.sx)).toEqual([1, 1])
    expect(of(s, 'wall', 'north').every((w) => !w.low && w.sy === 1)).toBe(true)
  })

  it('corners turn like the walls they start (NW 0, NE −π/2, SE π, SW π/2) and are low beside the cut-away side', () => {
    const c = of(shellLayout(ONE, [], FROM_SOUTH), 'corner')
    expect(c.map((k) => [k.x, k.z])).toEqual([
      [-4, -4],
      [4, -4],
      [4, 4],
      [-4, 4],
    ])
    expect(c.map((k) => k.yaw)).toEqual([0, -Math.PI / 2, Math.PI, Math.PI / 2])
    expect(c.map((k) => k.low)).toEqual([false, false, true, true])
  })

  it('a 2×1 room puts each door at its own cell’s mid-edge', () => {
    const s = shellLayout(WIDE, [{ side: 'north', offset: 1 }, { side: 'west', offset: 0 }], FROM_SOUTH, { doorwayWidth: 4 })
    expect(of(s, 'floor')).toHaveLength(32)
    expect(of(s, 'doorway').map((d) => [d.side, d.x, d.z])).toEqual([
      ['north', 4, -4],
      ['west', -8, 0],
    ])
    expect(of(s, 'wall', 'north')).toHaveLength(6)
  })

  it('a template’s own wall or door piece on the edge takes its slot (and the doorway there) out of the shell', () => {
    const s = shellLayout(ONE, [{ side: 'north', offset: 0 }], FROM_SOUTH, { doorwayWidth: 4, blocked: [{ side: 'north', from: -2, to: 2 }, { side: 'east', from: -4, to: -2 }] })
    expect(of(s, 'doorway')).toHaveLength(0)
    expect(of(s, 'wall', 'north').map((w) => w.x)).toEqual([-3, 3])
    expect(of(s, 'wall', 'east').map((w) => w.z)).toEqual([-1, 1, 3])
  })

  it('a stair pit takes its floor tiles out', () => {
    const s = shellLayout(ONE, [], FROM_SOUTH, { holes: [{ x0: -2, z0: -2, x1: 2, z1: 2 }] })
    expect(of(s, 'floor')).toHaveLength(12)
  })

  it('the same seed gives the same rolls and turns', () => {
    const a = shellLayout(ONE, [], FROM_SOUTH, { seed: 7 })
    const b = shellLayout(ONE, [], FROM_SOUTH, { seed: 7 })
    expect(a).toEqual(b)
    expect(of(a, 'floor').every((f) => [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].some((y) => Math.abs(f.yaw - y) < 1e-9))).toBe(true)
  })

  it('interval subtraction keeps what a door does not cover and drops slivers', () => {
    expect(subtractIntervals(0, 2, [[1, 3]])).toEqual([[0, 1]])
    expect(subtractIntervals(0, 2, [[0.5, 1]])).toEqual([
      [0, 0.5],
      [1, 2],
    ])
    expect(subtractIntervals(0, 2, [[-1, 1.98]])).toEqual([])
  })
})

describe('the zone file and the gv code', () => {
  it('reads the shell, the weighted variants, the cut pieces, the per-template mixes and substitutions', () => {
    const info = parseEnvZone(
      {
        zone: 'cellars',
        palette: ['#7A5230', '5b5650'],
        shell: { floor: 'cel_floor_flag_a', floorWhole: ['cel_floor_dirt'], floorAlt: [['cel_floor_flag_b', 0.12]], wall: 'cel_wall_brick_2m', wallAlt: [['cel_wall_brick_dmg', 0.06]], doorway: 'cel_door_arch', corner: 'cel_wall_corner_in', wallCut: 'cel_wall_brick_cut', doorwayCut: 'cel_door_arch_cut', cornerCut: 'cel_wall_corner_cut', doorways: { locked: 'cel_door_portcullis', secret: 'cel_door_secret' } },
        pieces: { cel_barrel: { tris: 170, parts: [], lights: [] }, cry_pillar_cluster: { tris: 190, mount: 'floor', lights: [{ name: 'light_0' }, { name: 'light_1' }] }, shr_stairs_down: { hole: [-2, -2.5, 2, 1.5] } },
        floorMix: { 'cel-t-kennels': [['cel_floor_dirt', 0.72], ['cel_floor_flag_b', 0.1]] },
        substitute: { 'cel-t-guardpost': { shr_campfire: 'shr_brazier' } },
      },
      'cellars',
    )!
    expect(info.palette[0]).toBe('#7a5230')
    expect(info.palette[1]).toBe('#5b5650')
    expect(info.palette[2]).toBe(FALLBACK_PALETTE.cellars[2])
    expect(info.palette).toHaveLength(16)
    expect(info.shell.floor).toEqual(['cel_floor_flag_a', 'cel_floor_flag_b'])
    expect(info.shell.floorWeights[0]).toBeCloseTo(0.88)
    expect(info.shell.wall).toEqual(['cel_wall_brick_2m', 'cel_wall_brick_dmg'])
    expect(info.shell.low).toEqual(['cel_wall_brick_cut'])
    expect(info.shell.doorwayCut).toEqual(['cel_door_arch_cut'])
    expect(info.shell.cornerCut).toEqual(['cel_wall_corner_cut'])
    expect(info.shell.locked).toEqual(['cel_door_portcullis'])
    expect(info.shell.floorWhole).toEqual(['cel_floor_dirt'])
    expect(info.pieces.get('cel_barrel')).toEqual({ tris: 170, parts: [], lights: 0, mount: null, hole: null, water: false, translucent: null, role: null })
    expect(info.pieces.get('cry_pillar_cluster')?.lights).toBe(2)
    expect(info.pieces.get('cry_pillar_cluster')?.mount).toBe('floor')
    expect(info.floorMix.get('cel-t-kennels')?.ids).toEqual(['cel_floor_flag_a', 'cel_floor_dirt', 'cel_floor_flag_b'])
    expect(info.floorMix.get('cel-t-kennels')?.weights[0]).toBeCloseTo(0.18)
    expect(info.substitute.get('cel-t-guardpost')?.get('shr_campfire')).toBe('shr_brazier')
    expect(info.pieces.get('shr_stairs_down')?.hole).toEqual([-2, -2.5, 2, 1.5])
    expect(parseEnvZone('nope', 'cellars')).toBeNull()
  })

  it('reads a plain shell (the Crypts file) and a palette given as objects', () => {
    const info = parseEnvZone({ shell: { floor: 'cry_floor_slab', wall: 'cry_wall_plain_2m', doorway: 'cry_door_arch', corner: 'cry_wall_corner_in' }, palette: [{ hex: '#8F958F' }] }, 'crypts')!
    expect(info.shell.floor).toEqual(['cry_floor_slab'])
    expect(info.shell.floorWeights).toEqual([1])
    expect(info.shell.low).toEqual([])
    expect(info.palette[0]).toBe('#8f958f')
    expect(readPalette(undefined, FALLBACK_PALETTE.vault)).toEqual([...FALLBACK_PALETTE.vault])
  })

  it('decodes R as the slot, G as a light/dark shift (the kit pass’s 1 + 0.36·(G − 0.5)) and B as occlusion, mix(0.45, 1, B)', () => {
    expect(envSlot(0)).toBe(0)
    expect(envSlot(11 / 15)).toBe(11)
    expect(envSlot(1)).toBe(15)
    expect(envSlot(Number.NaN)).toBe(0)
    expect(envShade(0.5, 1)).toBeCloseTo(1)
    expect(envShade(0, 1)).toBeCloseTo(0.82)
    expect(envShade(1, 1)).toBeCloseTo(1.18)
    expect(envShade(0.5, 0)).toBeCloseTo(0.45)
    expect(AO_FLOOR).toBe(0.45)
    const [r, g, b] = envColour(['#ff0000', '#00ff00'], 1 / 15, 0.5, 0.5)
    expect(r).toBeCloseTo(0)
    expect(g).toBeCloseTo(AO_FLOOR + (1 - AO_FLOOR) * 0.5)
    expect(b).toBeCloseTo(0)
  })

  it('a room’s zone: by its zone id, else its template id', () => {
    expect(kitZoneOf('the-cellars', 'x')).toBe('cellars')
    expect(kitZoneOf('the-crypts')).toBe('crypts')
    expect(kitZoneOf('the-drowned-vault')).toBe('vault')
    expect(kitZoneOf(null, 'cry-t-ossuary')).toBe('crypts')
    expect(kitZoneOf(undefined, 'vlt_t_throne')).toBe('vault')
    expect(kitZoneOf()).toBe('cellars')
  })

  it('flames and lights by kind: torches warm, corpse-candles green, the Vault’s lamps blue', () => {
    expect(lightKind('torch', 'cellars')).toEqual({ color: TORCH_COLOUR, size: 0.42 })
    expect(lightKind('corpse', 'crypts')?.color).toBe(0x8fe3a1)
    expect(lightKind('lamp', 'vault')?.color).toBe(0x6fb8ff)
    expect(lightKind('lamp', 'cellars')?.color).toBe(0xe8a33c)
    expect(lightKind('??', 'cellars')).toBeNull()
    expect(flameColourFor('cry_candle_ring', 'crypts')).toBe(0x8fe3a1)
    expect(flameColourFor('shr_torch_sconce', 'vault')).toBe(TORCH_COLOUR)
    expect(isTranslucent('cry_floor_mist')).toBe(true)
    expect(isTranslucent('cry_web_sheet')).toBe(true)
    expect(isTranslucent('cel_barrel')).toBe(false)
    expect(translucencyOf('cry_floor_mist')).toBe(0.22)
    expect(translucencyOf('cry_web_sheet')).toBe(0.5)
  })

  it('reads the per-template door skins and turns a template side with its room', () => {
    const info = parseEnvZone({ doorSkins: { 'cry-t-reliquary': { '*': 'cry_door_iron' }, 'cry-t-well-of-bones': { north: 'cry_door_portcullis' } }, pieces: { cry_floor_mist: { translucent: 0.22, role: 'decal' } } }, 'crypts')!
    expect(info.doorSkins.get('cry-t-reliquary')?.get('*')).toBe('cry_door_iron')
    expect(info.doorSkins.get('cry-t-well-of-bones')?.get('north')).toBe('cry_door_portcullis')
    expect(info.pieces.get('cry_floor_mist')).toMatchObject({ translucent: 0.22, role: 'decal' })
    expect(turnSide('north', 0)).toBe('north')
    expect(turnSide('north', 90)).toBe('east')
    expect(turnSide('west', 180)).toBe('east')
    expect(turnSide('south', -90)).toBe('east')
  })
})

describe('instancing and variants', () => {
  it('groups placements by piece: a repeated piece is one InstancedMesh, a single one a plain mesh', () => {
    const groups = instanceGroups([{ meshId: 'cel_barrel' }, { meshId: 'cel_crate_stack' }, { meshId: 'cel_barrel' }, { meshId: 'shr_torch_sconce' }, { meshId: 'cel_barrel' }])
    expect(groups.map((g) => [g.meshId, g.items.length, g.instanced])).toEqual([
      ['cel_barrel', 3, true],
      ['cel_crate_stack', 1, false],
      ['shr_torch_sconce', 1, false],
    ])
    expect(instanceGroups([])).toEqual([])
  })

  it('picks variants by weight and keeps the common one common', () => {
    const list = ['a', 'b', 'c']
    expect(pickWeighted(list, [0.8, 0.1, 0.1], 0)).toBe('a')
    expect(pickWeighted(list, [0.8, 0.1, 0.1], 0.85)).toBe('b')
    expect(pickWeighted(list, [0.8, 0.1, 0.1], 0.999)).toBe('c')
    expect(pickWeighted(['x'], [1], 0.7)).toBe('x')
    expect(pickVariant(list, 0.1)).toBe('a')
    expect(pickVariant([], 0.5)).toBeUndefined()
    const counts = { a: 0, b: 0, c: 0 } as Record<string, number>
    for (let i = 0; i < 1000; i++) counts[pickWeighted(list, [0.88, 0.06, 0.06], (i + 0.5) / 1000)!]!++
    expect(counts.a).toBeGreaterThan(850)
  })
})
