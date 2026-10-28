import * as THREE from 'three'
import type { Stage } from '../stage.ts'
import { VfxLayer } from './layer.ts'
import { CLASS_FX_COLOUR, emit, SCHOOL_SHAPE, type FxKind, type SpriteName } from './recipes.ts'

/**
 * The effects sheet (Phase 6, `#viewer=fx`): every effect of the fight on rows of stand-ins — the hit sparks, the six
 * element marks, heal, the status rings, the death puff, and the six classes' Ultimate flourishes. Live, each replays
 * every 1.6 s, timed so they all reach their peak together; `#viewer=fx&still=1` holds that moment for a still picture
 * (each effect aged to its own peak, then frozen).
 */
export interface FxSheetEntry {
  label: string
  kind: FxKind
  color?: number
  shape?: SpriteName
}

const ULTIMATE_SCHOOL: Readonly<Record<string, string>> = { warden: 'bulwark', blade: 'bloodletter', ranger: 'marksman', shade: 'shadow', arcanist: 'evocation', mender: 'benediction' }

export const FX_SHEET: readonly FxSheetEntry[] = [
  { label: 'Slash', kind: 'slash' },
  { label: 'Pierce', kind: 'pierce' },
  { label: 'Blunt', kind: 'blunt' },
  { label: 'Bleed', kind: 'bleed' },
  { label: 'Fire', kind: 'fire' },
  { label: 'Frost', kind: 'frost' },
  { label: 'Lightning', kind: 'lightning' },
  { label: 'Poison', kind: 'poison' },
  { label: 'Holy', kind: 'holy' },
  { label: 'Shadow', kind: 'shadow' },
  { label: 'Heal', kind: 'heal' },
  { label: 'Buff', kind: 'buff' },
  { label: 'Debuff', kind: 'debuff' },
  { label: 'Death', kind: 'death' },
  ...Object.entries(ULTIMATE_SCHOOL).map(([cls, school]) => ({ label: `${cls[0]!.toUpperCase()}${cls.slice(1)} Ultimate`, kind: 'ultimate' as const, color: CLASS_FX_COLOUR[cls]!, shape: SCHOOL_SHAPE[school]! })),
]

const PER_ROW = 7
const STEP = 2.5
const ROW = 4.4
const CYCLE_S = 1.6
const HEIGHT = 1.8

/**
 * When an effect looks most like itself: a third into each of its sprites' lives, averaged (seconds after it spawns).
 * The roll is fixed, so the sheet's timing is the same on every visit.
 */
export function fxPeak(e: FxSheetEntry): number {
  let seed = 7
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const ps = emit(e.kind, { height: HEIGHT, ...(e.color !== undefined ? { color: e.color } : {}), ...(e.shape ? { shape: e.shape } : {}) }, rnd)
  if (!ps.length) return 0
  return ps.reduce((t, p) => t + p.delay + p.life / 3, 0) / ps.length
}

export class FxSheetScene {
  private readonly stage: Stage
  private readonly vfx = new VfxLayer(1024)
  private readonly group = new THREE.Group()
  private readonly owned: { dispose(): void }[] = []
  private readonly spots: THREE.Vector3[] = []
  private readonly timers: number[] = []
  private readonly removeUpdater: () => void
  private readonly still: boolean
  private disposed = false

  constructor(stage: Stage, opts: { still?: boolean } = {}) {
    this.still = opts.still === true
    this.stage = stage
    const { scene } = stage
    scene.background = new THREE.Color(0x120f16)
    scene.fog = null
    const hemi = new THREE.HemisphereLight(0xc8c0d8, 0x201a24, 1.2)
    scene.add(hemi, this.group, this.vfx.mesh)
    const stand = new THREE.CapsuleGeometry(0.28, 1.1, 4, 10)
    stand.translate(0, 0.83, 0)
    const mat = new THREE.MeshToonMaterial({ color: 0x4a4458 })
    const floor = new THREE.CircleGeometry(0.7, 24)
    floor.rotateX(-Math.PI / 2)
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x241e2c })
    this.owned.push(stand, mat, floor, floorMat)
    const rows = Math.ceil(FX_SHEET.length / PER_ROW)
    FX_SHEET.forEach((_, i) => {
      const row = Math.floor(i / PER_ROW)
      const inRow = Math.min(PER_ROW, FX_SHEET.length - row * PER_ROW)
      // The first row nearest the camera (the small hit sparks), the Ultimates behind.
      const at = new THREE.Vector3((i % PER_ROW - (inRow - 1) / 2) * STEP, 0, ((rows - 1) / 2 - row) * ROW)
      this.spots.push(at)
      const m = new THREE.Mesh(stand, mat)
      m.position.copy(at)
      const disc = new THREE.Mesh(floor, floorMat)
      disc.position.copy(at)
      this.group.add(m, disc)
    })
    // When each effect peaks (the picture below and every round after are timed by it).
    const peaks = FX_SHEET.map(fxPeak)
    this.removeUpdater = stage.addUpdater((_t, dt) => this.frame(dt))
    stage.own(() => this.dispose())
    this.place()
    // The first picture (the still, and Reduce motion, which keeps the updaters off): every effect aged to its own
    // peak — the slowest set off first, the layer run on between, so all of them stand at their best at once.
    const order = FX_SHEET.map((_, i) => i).sort((a, b) => peaks[b]! - peaks[a]!)
    order.forEach((i, k) => {
      this.burst(i)
      const next = order[k + 1]
      this.age(peaks[i]! - (next !== undefined ? peaks[next]! : 0))
    })
    // Live, the next round: each effect set off again so that it peaks one cycle after this picture.
    for (const p of peaks) this.timers.push(CYCLE_S - p)
  }

  /** Runs the layer on by some seconds (in its own steps of at most a tenth). */
  private age(seconds: number): void {
    let left = Math.max(0, seconds) * 1000
    while (left > 0.5) {
      const step = Math.min(90, left)
      this.vfx.update(step)
      left -= step
    }
    this.vfx.update(0)
  }

  private burst(i: number): void {
    const e = FX_SHEET[i]!
    this.vfx.spawn(e.kind, this.spots[i]!, { height: HEIGHT, ...(e.color !== undefined ? { color: e.color } : {}), ...(e.shape ? { shape: e.shape } : {}) })
  }

  private frame(dt: number): void {
    if (this.still) return
    for (let i = 0; i < this.timers.length; i++) {
      this.timers[i]! -= dt / 1000
      if (this.timers[i]! <= 0) {
        this.timers[i]! += CYCLE_S
        this.burst(i)
      }
    }
    this.vfx.update(dt)
  }

  /** A camera from the front and a little above, its field widened until every stand-in, its effect and its label fit. */
  place(): void {
    const cam = this.stage.camera
    const el = this.stage.renderer.domElement
    cam.aspect = Math.max(1, el.clientWidth) / Math.max(1, el.clientHeight)
    const rows = Math.ceil(FX_SHEET.length / PER_ROW)
    const halfW = ((PER_ROW - 1) * STEP) / 2 + 1.1
    const halfD = ((rows - 1) * ROW) / 2 + 0.9
    const dist = Math.max(halfW, halfD) * 2.4
    cam.position.set(0, dist * 0.5, dist * 0.87)
    cam.lookAt(0, 0.9, 0)
    cam.updateMatrixWorld(true)
    let tx = 0.01
    let ty = 0.01
    const v = new THREE.Vector3()
    for (const x of [-halfW, halfW]) {
      for (const z of [-halfD, halfD + 0.6]) {
        for (const y of [-0.3, 2.9]) {
          v.set(x, y, z).applyMatrix4(cam.matrixWorldInverse)
          const d = Math.max(0.5, -v.z)
          tx = Math.max(tx, Math.abs(v.x) / d)
          ty = Math.max(ty, Math.abs(v.y) / d)
        }
      }
    }
    cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(ty, tx / cam.aspect) * 1.04))
    cam.near = 0.5
    cam.far = dist * 4
    cam.zoom = 1
    cam.clearViewOffset()
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld(true)
  }

  labels(): { id: string; x: number; y: number; lower: boolean }[] {
    const el = this.stage.renderer.domElement
    const w = Math.max(1, el.clientWidth)
    const h = Math.max(1, el.clientHeight)
    const v = new THREE.Vector3()
    return this.spots.map((s, i) => {
      v.copy(s).project(this.stage.camera)
      return { id: FX_SHEET[i]!.label, x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, lower: (i % PER_ROW) % 2 === 1 }
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.removeUpdater()
    this.vfx.dispose()
    for (const o of this.owned) o.dispose()
    this.group.clear()
  }
}
