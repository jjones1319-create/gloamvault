import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { describe, expect, it } from 'vitest'
import { roomFrame } from '../room/layout.ts'
import { parseEnvZone } from './envData.ts'
import { readKit, type EnvSet } from './envKit.ts'
import { ENV_ATTRIBUTE } from './envMaterial.ts'
import { KitRoomBuilder } from './kitRoom.ts'
import { shellLayout } from './shell.ts'

/**
 * The kit reader on hand-made scenes (pieces, parts, light and fx empties as the contract writes them) and, when the
 * kit passes' files are there, on the real kits: every piece decoded into one geometry with the gv code, parts at
 * their hinges, flames at their empties, and a whole room built under the 40-draw-call bar.
 */
const ENV = path.resolve('client/public/models/env')

function parseGlb(file: string): Promise<GLTF> {
  const buf = readFileSync(file)
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
  return new Promise((resolve, reject) => new GLTFLoader().parse(ab, '', resolve, reject))
}

/** A box mesh painted with one gv code (slot, variation, occlusion). */
function box(name: string, slot: number, at: [number, number, number], size = 1): THREE.Mesh {
  const g = new THREE.BoxGeometry(size, size, size)
  const n = g.getAttribute('position').count
  const col = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) col.set([slot / 15, 0.5, i % 2 ? 1 : 0.5, 1], i * 4)
  g.setAttribute('color', new THREE.BufferAttribute(col, 4))
  const m = new THREE.Mesh(g)
  m.name = name
  m.position.set(...at)
  return m
}

function handmade(): THREE.Group {
  const root = new THREE.Group()
  // A chest laid out away from the origin (the kit sheet's grid): its lid a child at the hinge, a light under it.
  const chest = box('shr_chest_small', 2, [10, 0, 0])
  chest.userData = { kind: 'kit', zone: 'shared', mount: 'floor' }
  const lid = box('shr_chest_smalllid', 3, [0, 0.5, -0.3], 0.5)
  lid.userData = { name: 'shr_chest_small.lid', kind: 'part', part: 'lid', piece: 'shr_chest_small' }
  chest.add(lid)
  const torch = box('shr_torch_sconce', 4, [-5, 2, 0], 0.2)
  torch.userData = { kind: 'kit' }
  const flame = new THREE.Object3D()
  flame.name = 'light_1'
  flame.userData = { kind: 'light', light: 'torch' }
  flame.position.set(0, 0.5, 0.3)
  torch.add(flame)
  const drip = new THREE.Object3D()
  drip.name = 'fx_0'
  drip.userData = { kind: 'fx', fx: 'drip' }
  torch.add(drip)
  root.add(chest, torch)
  return root
}

describe('reading a kit', () => {
  it('finds the pieces, decodes the gv code, keeps parts at their hinge and the empties as flames and motes', () => {
    const kit = readKit(handmade(), 'shared')
    expect([...kit.pieces.keys()].sort()).toEqual(['shr_chest_small', 'shr_torch_sconce'])
    const chest = kit.pieces.get('shr_chest_small')!
    expect(chest.mount).toBe('floor')
    expect(chest.parts.map((p) => p.name)).toEqual(['lid'])
    // The piece's geometry is in its own space (its layout position in the file is gone).
    chest.geometry!.computeBoundingBox()
    expect(chest.geometry!.boundingBox!.getCenter(new THREE.Vector3()).length()).toBeLessThan(1e-6)
    expect(new THREE.Vector3().setFromMatrixPosition(chest.parts[0]!.rest).toArray()).toEqual([0, 0.5, -0.3])
    const gv = chest.geometry!.getAttribute(ENV_ATTRIBUTE)
    expect(gv.getX(0)).toBe(2)
    expect(gv.getY(0)).toBeCloseTo(0.5)
    expect(chest.geometry!.getAttribute('color')).toBeUndefined()
    const torch = kit.pieces.get('shr_torch_sconce')!
    expect(torch.lights).toHaveLength(1)
    expect(torch.lights[0]!.position.toArray()).toEqual([0, 0.5, 0.3])
    expect(torch.lights[0]!.color).toBe(0xffa040)
    expect(torch.lights[0]!.size).toBeCloseTo(0.42)
    expect(torch.fx).toHaveLength(1)
    expect(torch.fxKinds).toEqual(['drip'])
  })

  it('a room builder draws repeated pieces as one InstancedMesh and turns empties into world-space flames', () => {
    const kit = readKit(handmade(), 'shared')
    const set: EnvSet = { zone: 'cellars', kit: null, shared: kit, info: parseEnvZone({}, 'cellars')!, piece: (id) => kit.pieces.get(id) ?? null }
    const kb = new KitRoomBuilder(set, { solid: new THREE.MeshBasicMaterial() })
    for (const x of [-2, 0, 2]) kb.add('shr_torch_sconce', new THREE.Matrix4().makeTranslation(x, 2, -3.9))
    kb.add('shr_chest_small', new THREE.Matrix4().makeTranslation(1, 0, 1))
    expect(kb.add('cel_nothing', new THREE.Matrix4())).toBeNull()
    const built = kb.build()
    const kinds = built.group.children.map((c) => [c.name, (c as THREE.InstancedMesh).isInstancedMesh === true])
    expect(kinds).toEqual([
      ['shr_chest_small', false],
      ['shr_chest_small.lid', false],
      ['shr_torch_sconce', true],
    ])
    expect(built.drawCalls).toBe(3)
    expect(kb.flames.map((f) => [f.x, f.y, f.z])).toEqual([
      [-2, 2.5, -3.6],
      [0, 2.5, -3.6],
      [2, 2.5, -3.6],
    ])
    expect(kb.motes.every((m) => m.kind === 'drip')).toBe(true)
    built.dispose()
  })
})

const ZONES = ['cellars', 'crypts', 'vault', 'shared'].filter((z) => existsSync(path.join(ENV, `kit_${z}.glb`)))

describe.skipIf(ZONES.length === 0)('the real kits', () => {
  it.each(ZONES)('kit_%s.glb: every piece the zone file lists is read, with its parts and lights', async (zone) => {
    const jsonFile = path.join(ENV, `${zone}.json`)
    const info = existsSync(jsonFile) ? parseEnvZone(JSON.parse(readFileSync(jsonFile, 'utf8')), zone) : null
    const kit = readKit((await parseGlb(path.join(ENV, `kit_${zone}.glb`))).scene, zone, info)
    expect(kit.pieces.size).toBeGreaterThan(5)
    for (const [id, p] of info?.pieces ?? []) {
      const piece = kit.pieces.get(id)
      expect(piece, id).toBeDefined()
      expect(piece!.parts.length, `${id} parts`).toBe(p.parts.length)
      expect(piece!.lights.length, `${id} lights`).toBe(p.lights)
    }
    for (const piece of kit.pieces.values()) {
      expect(piece.bounds.isEmpty()).toBe(false)
      if (piece.geometry) expect(piece.geometry.getAttribute(ENV_ATTRIBUTE).count).toBe(piece.geometry.getAttribute('position').count)
    }
  })

  it.skipIf(!ZONES.includes('cellars'))('a Cellars room from its shell: floor, walls, doorways and corners in a handful of draw calls', async () => {
    const info = parseEnvZone(JSON.parse(readFileSync(path.join(ENV, 'cellars.json'), 'utf8')), 'cellars')!
    const kit = readKit((await parseGlb(path.join(ENV, 'kit_cellars.glb'))).scene, 'cellars', info)
    const set: EnvSet = { zone: 'cellars', kit, shared: null, info, piece: (id) => kit.pieces.get(id) ?? null }
    const kb = new KitRoomBuilder(set, { solid: new THREE.MeshBasicMaterial() })
    const frame = roomFrame({ cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] })
    for (const s of shellLayout(frame, [{ side: 'west', offset: 0 }, { side: 'east', offset: 0 }], { x: 0, z: 1 }, { doorwayWidth: 4, cutDoorways: true })) {
      const id = s.role === 'floor' ? info.shell.floor[0]! : s.role === 'wall' ? (s.low ? info.shell.low[0]! : info.shell.wall[0]!) : s.role === 'doorway' ? info.shell.doorway[0]! : s.low ? info.shell.cornerCut[0]! : info.shell.corner[0]!
      expect(kb.add(id, new THREE.Matrix4().makeTranslation(s.x, 0, s.z)), id).not.toBeNull()
    }
    const built = kb.build()
    expect(built.drawCalls).toBeLessThanOrEqual(6)
    expect(built.triangles).toBeLessThan(40_000)
    built.dispose()
  })
})
