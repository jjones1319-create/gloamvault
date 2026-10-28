import * as THREE from 'three'
import type { Stage } from '../stage.ts'
import { ZONE_LOOK, type KitZone } from './envData.ts'
import { envLibrary, type KitPiece } from './envKit.ts'
import { createEnvMaterial, type EnvMaterial } from './envMaterial.ts'
import { movingPiece } from './kitRoom.ts'

/**
 * The kit sheet in the game (Phase 6, `#viewer=kit&zone=cellars`): every piece of a zone's kit and the shared kit on
 * a grid, drawn with the zone's environment material under a torch and the zone's ambient, each labelled by its meshId —
 * the client's half of the Blender pass's kit sheet, so the two can be compared.
 */
export interface KitLabel {
  id: string
  x: number
  y: number
  /** Every other column’s label sits a line lower, so long names side by side do not run into each other. */
  lower: boolean
}

const CELL = 4.4

export class KitLineupScene {
  private readonly stage: Stage
  private readonly zone: KitZone
  private readonly group = new THREE.Group()
  private material: EnvMaterial | null = null
  private translucent: EnvMaterial | null = null
  private water: EnvMaterial | null = null
  private pieces: { piece: KitPiece; at: THREE.Vector3; col: number }[] = []
  private disposed = false
  private cols = 6
  private rows = 1

  constructor(stage: Stage, zone: KitZone) {
    this.stage = stage
    this.zone = zone
    const { scene } = stage
    const look = ZONE_LOOK[zone]
    scene.background = new THREE.Color(look.fog).lerp(new THREE.Color(0x2a2430), 0.5)
    scene.fog = null
    // A neutral review light (the zone's own air is the rooms'): every piece's colours read as the palette has them.
    const hemi = new THREE.HemisphereLight(new THREE.Color(look.sky).lerp(new THREE.Color(0xffffff), 0.5), 0x3a3438, 1.7)
    const key = new THREE.DirectionalLight(0xfff0e0, 2.2)
    key.position.set(-6, 10, 12)
    scene.add(hemi, key, this.group)
    stage.own(() => this.dispose())
  }

  /** Loads the zone's kit and lays every piece out; resolves with how many. */
  async build(): Promise<number> {
    const set = await envLibrary.load(this.zone)
    if (!set || this.disposed) return 0
    this.material = createEnvMaterial(set.info.palette)
    this.translucent = createEnvMaterial(set.info.palette, { translucent: true })
    this.water = createEnvMaterial(set.info.palette, { water: true })
    const list: KitPiece[] = []
    for (const kit of [set.kit, set.shared]) if (kit) for (const p of kit.pieces.values()) list.push(p)
    list.sort((a, b) => a.meshId.localeCompare(b.meshId))
    this.cols = Math.max(4, Math.ceil(Math.sqrt(list.length * 2)))
    this.rows = Math.max(1, Math.ceil(list.length / this.cols))
    list.forEach((piece, i) => {
      const c = i % this.cols
      const r = Math.floor(i / this.cols)
      const b = piece.bounds
      const size = Math.max(b.max.x - b.min.x, b.max.z - b.min.z, b.max.y - b.min.y, 0.5)
      // Big pieces (a timber beam, the throne) are shown smaller to fit their cell.
      const s = Math.min(1, (CELL * 0.82) / size)
      const at = new THREE.Vector3((c - (this.cols - 1) / 2) * CELL, 0, (r - (this.rows - 1) / 2) * CELL * 0.9)
      const m = new THREE.Matrix4().compose(at.clone().add(new THREE.Vector3(-(b.min.x + b.max.x) / 2 * s, -Math.min(0, b.min.y) * s, -(b.min.z + b.max.z) / 2 * s)), new THREE.Quaternion(), new THREE.Vector3(s, s, s))
      const mp = movingPiece(piece, { solid: this.material!.material, translucent: () => this.translucent!.material, water: this.water!.material }, m)
      this.group.add(mp.root)
      this.pieces.push({ piece, at, col: c })
    })
    this.place()
    return this.pieces.length
  }

  /** A camera from the front and above, widened until every cell (and its label) is in frame. */
  place(): void {
    const cam = this.stage.camera
    const el = this.stage.renderer.domElement
    const w = Math.max(1, el.clientWidth)
    const h = Math.max(1, el.clientHeight)
    cam.aspect = w / h
    const halfW = (this.cols * CELL) / 2
    const halfD = (this.rows * CELL * 0.9) / 2
    const pts: THREE.Vector3[] = []
    for (const x of [-halfW, halfW]) for (const z of [-halfD, halfD + CELL * 0.3]) for (const y of [0, 2.5]) pts.push(new THREE.Vector3(x, y, z))
    const dist = Math.max(halfW, halfD) * 3
    cam.position.set(0, dist * 0.8, dist * 0.6)
    cam.lookAt(0, 0.6, 0)
    cam.updateMatrixWorld(true)
    let tx = 0.01
    let ty = 0.01
    const v = new THREE.Vector3()
    for (const p of pts) {
      v.copy(p).applyMatrix4(cam.matrixWorldInverse)
      const d = Math.max(0.5, -v.z)
      tx = Math.max(tx, Math.abs(v.x) / d)
      ty = Math.max(ty, Math.abs(v.y) / d)
    }
    cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(ty, tx / cam.aspect) * 1.06))
    cam.near = 0.5
    cam.far = dist * 4
    cam.zoom = 1
    cam.clearViewOffset()
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld(true)
  }

  labels(): KitLabel[] {
    const el = this.stage.renderer.domElement
    const w = Math.max(1, el.clientWidth)
    const h = Math.max(1, el.clientHeight)
    const v = new THREE.Vector3()
    return this.pieces.map(({ piece, at, col }) => {
      v.set(at.x, 0, at.z + CELL * 0.36).project(this.stage.camera)
      return { id: piece.meshId, x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, lower: col % 2 === 1 }
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.group.clear()
    this.material?.dispose()
    this.translucent?.dispose()
    this.water?.dispose()
  }
}
