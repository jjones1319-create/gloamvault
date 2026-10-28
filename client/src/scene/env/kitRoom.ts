import * as THREE from 'three'
import { flameColourFor, instanceGroups, translucencyOf, type InstanceGroup } from './envData.ts'
import type { EnvSet, KitPiece } from './envKit.ts'
import type { FlamePoint, MotePoint } from '../vfx/layer.ts'

/**
 * A room's kit pieces as meshes (Phase 6): placements collected by meshId, then each piece drawn once — an
 * InstancedMesh when it repeats (the floor tiles, the wall segments, the barrels), a plain mesh when it does not — on
 * the zone's materials: the solid one for nearly everything, a see-through one per opacity for mist and webs (the kit's
 * `translucent`), the water one for the slot-15 faces the Vault's pieces carry (their own geometry, see-through by
 * vertex alpha). A static piece's moving parts are drawn at rest with it (or turned, a gate swung open); its `light_*`
 * points become the room's flames (and light candidates) and its `fx_*` points its motes. Pieces the kit lacks are the
 * caller's to draw in grey box.
 */

export type KitLayer = 'solid' | 'translucent' | 'water'

export interface KitPlacement {
  meshId: string
  /** The kit piece (or one of its parts, or its water) to draw. */
  geometry: THREE.BufferGeometry
  matrix: THREE.Matrix4
  layer: KitLayer
  /** A see-through piece's opacity. */
  opacity: number
}

export interface KitMaterials {
  solid: THREE.Material
  /** The see-through material for an opacity (mist 0.22, webs 0.5). */
  translucent?: ((opacity: number) => THREE.Material) | undefined
  water?: THREE.Material | undefined
}

/** A flame's default height by the piece it burns on. */
function flameSize(meshId: string): number {
  const id = meshId.toLowerCase()
  if (/campfire|brazier|hearth/.test(id)) return 0.85
  if (/candle/.test(id)) return 0.16
  if (/lamp|lantern/.test(id)) return 0.28
  if (/waystone|door_frame/.test(id)) return 0.35
  return 0.42
}

export interface KitBuild {
  group: THREE.Group
  /** The kit geometries this room draws (their GPU copies are freed when a room that does not use them is built). */
  geometries: Set<THREE.BufferGeometry>
  triangles: number
  drawCalls: number
  dispose(): void
}

export interface AddOptions {
  /** Its flames and motes too (not for a sconce on a cut-away wall). */
  lights?: boolean
  /** Its moving parts at rest (default yes). */
  parts?: boolean
  /** Parts left out (the throne's empty seat while the Hollow King sits on his own; a portcullis gate raised out of sight). */
  skipParts?: readonly string[]
  /** Parts turned from rest about their own axis (radians): an iron gate's leaves swung open. */
  turnParts?: Readonly<Record<string, { axis: 'x' | 'y' | 'z'; angle: number }>>
}

const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) } as const

export class KitRoomBuilder {
  readonly set: EnvSet
  private readonly solid: THREE.Material
  private readonly translucentFor: (opacity: number) => THREE.Material
  private readonly water: THREE.Material
  private readonly placements: KitPlacement[] = []
  readonly flames: FlamePoint[] = []
  readonly motes: MotePoint[] = []

  constructor(set: EnvSet, materials: KitMaterials) {
    this.set = set
    this.solid = materials.solid
    this.translucentFor = materials.translucent ?? (() => materials.solid)
    this.water = materials.water ?? this.translucentFor(0.6)
  }

  piece(meshId: string): KitPiece | null {
    return this.set.piece(meshId)
  }

  has(meshId: string | undefined): boolean {
    return !!meshId && this.set.piece(meshId) !== null
  }

  /**
   * Places a piece (its parts at rest with it, its water in the water batch) and records its flames and motes; null
   * when the kit lacks it (the caller draws the grey box).
   */
  add(meshId: string, matrix: THREE.Matrix4, opts: AddOptions = {}): KitPiece | null {
    const piece = this.set.piece(meshId)
    if (!piece) return null
    const opacity = piece.translucent ?? translucencyOf(meshId)
    if (piece.geometry) this.placements.push({ meshId, geometry: piece.geometry, matrix: matrix.clone(), layer: opacity < 1 ? 'translucent' : 'solid', opacity })
    if (piece.water) this.placements.push({ meshId: `${meshId}~water`, geometry: piece.water, matrix: matrix.clone(), layer: 'water', opacity: 1 })
    if (opts.parts !== false) {
      for (const part of piece.parts) {
        if (opts.skipParts?.includes(part.name)) continue
        const m = new THREE.Matrix4().multiplyMatrices(matrix, part.rest)
        const turn = opts.turnParts?.[part.name]
        if (turn) m.multiply(new THREE.Matrix4().makeRotationAxis(AXES[turn.axis], turn.angle))
        this.placements.push({ meshId: `${meshId}.${part.name}${turn ? `@${turn.axis}${turn.angle.toFixed(2)}` : ''}`, geometry: part.geometry, matrix: m, layer: 'solid', opacity: 1 })
      }
    }
    if (opts.lights !== false) {
      for (const l of piece.lights) {
        const p = l.position.clone().applyMatrix4(matrix)
        this.flames.push({ x: p.x, y: p.y, z: p.z, color: l.color ?? flameColourFor(meshId, this.set.zone), size: l.size ?? flameSize(meshId) })
      }
      piece.fx.forEach((f, i) => {
        const p = f.clone().applyMatrix4(matrix)
        this.motes.push({ x: p.x, y: p.y, z: p.z, kind: piece.fxKinds[i] ?? 'motes' })
      })
    }
    return piece
  }

  /** The placements so far, by piece (for tests and the overlay). */
  plan(): InstanceGroup<KitPlacement>[] {
    return instanceGroups(this.placements)
  }

  private materialOf(p: KitPlacement): THREE.Material {
    return p.layer === 'water' ? this.water : p.layer === 'translucent' ? this.translucentFor(p.opacity) : this.solid
  }

  build(): KitBuild {
    const group = new THREE.Group()
    group.name = 'kit'
    const owned: THREE.InstancedMesh[] = []
    const geometries = new Set<THREE.BufferGeometry>()
    let triangles = 0
    let drawCalls = 0
    for (const g of instanceGroups(this.placements)) {
      const first = g.items[0]!
      const geometry = first.geometry
      const material = this.materialOf(first)
      geometries.add(geometry)
      const tris = geometry.index ? geometry.index.count / 3 : 0
      triangles += tris * g.items.length
      drawCalls++
      let mesh: THREE.Mesh
      if (g.instanced) {
        const im = new THREE.InstancedMesh(geometry, material, g.items.length)
        g.items.forEach((p, i) => im.setMatrixAt(i, p.matrix))
        im.instanceMatrix.needsUpdate = true
        owned.push(im)
        mesh = im
      } else {
        mesh = new THREE.Mesh(geometry, material)
        mesh.matrix.copy(first.matrix)
      }
      // See-through things draw after the solid room (water last, over the floor it lies on).
      if (first.layer !== 'solid') mesh.renderOrder = first.layer === 'water' ? 3 : 2
      mesh.name = g.meshId
      mesh.matrixAutoUpdate = false
      mesh.frustumCulled = false
      group.add(mesh)
    }
    return {
      group,
      geometries,
      triangles,
      drawCalls,
      dispose() {
        // The geometries are the kit's (cached); only the instance buffers are this room's.
        for (const m of owned) m.dispose()
        group.clear()
      },
    }
  }
}

/** A piece drawn on its own with its parts as children that can move (a chest's lid, a portcullis's gate). */
export interface MovingPiece {
  root: THREE.Group
  /** Each part's object and its rest transform (decomposed), by part name. */
  parts: Map<string, { object: THREE.Object3D; rest: { position: THREE.Vector3; quaternion: THREE.Quaternion } }>
}

export function movingPiece(piece: KitPiece, materials: KitMaterials, matrix: THREE.Matrix4): MovingPiece {
  const root = new THREE.Group()
  root.name = piece.meshId
  matrix.decompose(root.position, root.quaternion, root.scale)
  if (piece.geometry) {
    const opacity = piece.translucent ?? translucencyOf(piece.meshId)
    const body = new THREE.Mesh(piece.geometry, opacity < 1 && materials.translucent ? materials.translucent(opacity) : materials.solid)
    body.frustumCulled = false
    root.add(body)
  }
  if (piece.water) {
    const water = new THREE.Mesh(piece.water, materials.water ?? materials.solid)
    water.frustumCulled = false
    water.renderOrder = 3
    root.add(water)
  }
  const parts = new Map<string, { object: THREE.Object3D; rest: { position: THREE.Vector3; quaternion: THREE.Quaternion } }>()
  for (const part of piece.parts) {
    const mesh = new THREE.Mesh(part.geometry, materials.solid)
    mesh.name = `${piece.meshId}.${part.name}`
    mesh.frustumCulled = false
    part.rest.decompose(mesh.position, mesh.quaternion, mesh.scale)
    root.add(mesh)
    parts.set(part.name, { object: mesh, rest: { position: mesh.position.clone(), quaternion: mesh.quaternion.clone() } })
  }
  return { root, parts }
}

/** The part that moves: one whose name says so (`lid`, `gate` …), else the first. */
export function movingPart(mp: MovingPiece, words: RegExp): { object: THREE.Object3D; rest: { position: THREE.Vector3; quaternion: THREE.Quaternion } } | null {
  for (const [name, p] of mp.parts) if (words.test(name)) return p
  return mp.parts.values().next().value ?? null
}
