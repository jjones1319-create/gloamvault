import * as THREE from 'three'
import type { Content } from '../../../../sim/src/content.ts'
import type { BodyFrame } from '../../../../sim/src/types/enums.ts'
import type { Stage } from '../stage.ts'
import type { CharacterModel } from './assembler.ts'
import { buildCharacter } from './factory.ts'
import { starterSpec } from './outfit.ts'

/**
 * The acceptance matrix (Phase 5, `#viewer=matrix&clip=Idle&tier=F`): all 36 species × class heroes on one camera —
 * rows are species, columns classes — each built exactly as the game builds it (the class's starter kit, at tier F
 * or S, with the factory the delve uses), all playing one clip, or all frozen on one instant of it (`t` = a fraction
 * of its length, `at` = one of its clips.json events) so a screenshot compares like with like. A near-orthographic
 * camera (a long lens from far off) keeps every hero the same size.
 */
export const MATRIX_SPECIES = ['human', 'dwarf', 'elf', 'orc', 'halfling', 'draconid'] as const
export const MATRIX_CLASSES = ['warden', 'blade', 'ranger', 'shade', 'arcanist', 'mender'] as const

export interface MatrixOptions {
  clip: string
  tier: 'F' | 'S'
  frame: BodyFrame
  /** Freeze at this fraction of the clip's length (0–1), or null to play it. */
  t: number | null
  /** Freeze at this clips.json event (hit, release …), or null. */
  at: string | null
}

/** The screen layout, in CSS px: a label column on the left, a header row, then a 6 × 6 grid of cells. */
export interface MatrixLayout {
  labelW: number
  headerH: number
  cellW: number
  cellH: number
}

export function matrixLayout(width: number, height: number): MatrixLayout {
  const labelW = Math.round(Math.max(64, width * 0.075))
  const headerH = Math.round(Math.max(34, height * 0.085))
  return { labelW, headerH, cellW: (width - labelW) / MATRIX_CLASSES.length, cellH: (height - headerH) / MATRIX_SPECIES.length }
}

/** A cell's height in metres: the tallest hero (an Orc in a crested helmet) with a little headroom. */
const CELL_M = 2.4
const DISTANCE = 220
const YAW = -0.42

export class MatrixScene {
  private readonly stage: Stage
  private readonly content: Content
  private readonly opts: MatrixOptions
  private readonly group = new THREE.Group()
  private readonly models: CharacterModel[] = []
  private readonly removeUpdater: () => void
  private disposed = false
  private frozen = false

  constructor(stage: Stage, content: Content, opts: MatrixOptions) {
    this.stage = stage
    this.content = content
    this.opts = opts
    const { scene } = stage
    scene.background = new THREE.Color(0x17121b)
    scene.fog = null
    const hemi = new THREE.HemisphereLight(0xcfc6e0, 0x2a2026, 1.15)
    const key = new THREE.DirectionalLight(0xffe2c4, 2.3)
    key.position.set(-2.2, 3.4, 3.2)
    const rim = new THREE.DirectionalLight(0x9fb8ff, 1.3)
    rim.position.set(2.6, 2.2, -2.8)
    scene.add(hemi, key, rim, this.group)
    // Sharp pictures for checking: the matrix draws at the device's full pixel ratio (up to 3).
    stage.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3))
    this.removeUpdater = stage.addUpdater((_t, dt) => {
      if (!this.frozen) for (const m of this.models) m.update(dt)
    })
    stage.own(() => this.dispose())
  }

  /** The camera and every cell's place for a canvas of this size (CSS px). */
  place(width: number, height: number): void {
    const L = matrixLayout(width, height)
    const s = L.cellH / CELL_M
    const cx = 0
    // Column c's centre and row r's floor in the picture, then the world point at the screen's centre.
    const colX = (c: number) => (L.labelW + (c + 0.5) * L.cellW - width / 2) / s
    const rowY = (r: number) => -(L.headerH + (r + 0.94) * L.cellH - height / 2) / s
    for (const child of this.group.children) {
      const { row, col } = child.userData as { row: number; col: number }
      child.position.set(cx + colX(col), rowY(row), 0)
    }
    const cam = this.stage.camera
    cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(height / (2 * s * DISTANCE)))
    cam.near = DISTANCE - 20
    cam.far = DISTANCE + 20
    cam.position.set(cx, 0, DISTANCE)
    cam.lookAt(cx, 0, 0)
    cam.zoom = 1
    cam.clearViewOffset()
    cam.aspect = width / height
    cam.updateProjectionMatrix()
  }

  /** Builds the 36 heroes one after another; resolves with how many were built. */
  async build(): Promise<number> {
    let built = 0
    for (const [row, speciesId] of MATRIX_SPECIES.entries()) {
      for (const [col, classId] of MATRIX_CLASSES.entries()) {
        if (this.disposed) return built
        const spec = starterSpec(this.content, { speciesId, classId, look: { frame: this.opts.frame, skin: 1, face: col % 3, hair: 1 }, tier: this.opts.tier })
        const model = await buildCharacter(this.content, spec)
        if (!model) continue
        if (this.disposed) {
          model.dispose()
          return built
        }
        const holder = new THREE.Group()
        holder.userData = { row, col }
        holder.rotation.y = YAW
        holder.add(model.root)
        this.group.add(holder)
        this.models.push(model)
        built++
      }
    }
    this.pose()
    return built
  }

  /** Every hero on the clip: playing, or frozen on one instant of it. */
  private pose(): void {
    const { clip, t, at } = this.opts
    this.frozen = t !== null || at !== null
    for (const m of this.models) {
      const a = m.animator
      if (!a.has(clip)) {
        m.update(0)
        continue
      }
      if (this.frozen) {
        const len = a.durationOf(clip)
        const sec = at !== null ? (a.eventTime(clip, at) ?? len / 2) : (t ?? 0) * len
        a.freeze(clip, sec)
      } else {
        a.loopClip(clip)
        m.update(0)
      }
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.removeUpdater()
    for (const m of this.models) m.dispose()
    this.models.length = 0
    this.group.clear()
  }
}
