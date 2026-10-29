import * as THREE from 'three'
import type { Content } from '../../../../sim/src/content.ts'
import type { Stage } from '../stage.ts'
import { lineupEntries, lineupSpots, type LineupEntry, type LineupZone } from './lineup.ts'
import { monsterLibrary, type MonsterModel } from './model.ts'

/**
 * The monster lineup (Phase 6, `#viewer=monsters[&zone=cellars|crypts|vault|pets]`): every monster of the manifest for
 * the zone, side by side at their scales on a dark floor, each playing Idle under its name; a tap on one plays its next
 * clip (Idle, Move, Attack1, Attack2, Hit, Death, Flee and its own). A near-orthographic long lens keeps sizes honest.
 */

const BG = 0x15121a
const DISTANCE = 60
/** Monsters in a row, and how far behind one row stands the next. */
const PER_ROW = 9
const ROW_M = 4.6

export interface LineupLabel {
  id: string
  name: string
  clip: string
  x: number
  y: number
  /** Every other label in a row drops a line, so neighbours' names do not overlap. */
  lower: boolean
}

interface Slot {
  entry: LineupEntry
  model: MonsterModel
  holder: THREE.Group
  clips: string[]
  clip: number
  row: number
  col: number
  /** Where it stands, measured from its posed model (a throne, a ring of tentacles and a halo included). */
  box: THREE.Box3
}

/** How far a label reaches below the feet (CSS px at 100% text; viewer.css: 2 px down, two lines; a lowered one 26). */
const LABEL_PX = 28
const LABEL_LOW_PX = 52

/** Settings → Text size, as the CSS reads it (--ts on <html>; 1 outside a page). */
function textScale(): number {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return 1
  const k = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ts'))
  return Number.isFinite(k) && k > 0 ? k : 1
}

/** About half a label's width on screen (CSS px): bold 11 px, a little under 7 px a letter. */
function labelHalf(name: string): number {
  return name.length * 3.4 + 8
}

/** A model's own clip names worth cycling, in the contract's order (then anything else it has). */
function cycleOf(model: MonsterModel): string[] {
  const order = ['Idle', 'Move', 'Attack1', 'Attack2', 'Hit', 'Death', 'Flee']
  const names = model.animator.names()
  const own = order.filter((n) => model.animator.has(n))
  const extra = names.filter((n) => !order.includes(n) && !['Walk', 'Run', 'Attack_Light', 'Attack_Heavy', 'Attack_Dual', 'Shoot', 'Cast', 'Defeat', 'Downed', 'Dodge', 'Guard', 'Guard_Shield', 'Victory', 'Revive', 'Interact', 'SitRest', 'Breath', 'Roar'].includes(n))
  return [...own, ...extra]
}

export class MonsterLineupScene {
  private readonly stage: Stage
  private readonly content: Content
  private readonly zone: LineupZone
  private readonly group = new THREE.Group()
  private readonly owned: { dispose(): void }[] = []
  private slots: Slot[] = []
  private readonly removeUpdater: () => void
  private disposed = false

  constructor(stage: Stage, content: Content, zone: LineupZone) {
    this.stage = stage
    this.content = content
    this.zone = zone
    const { scene } = stage
    scene.background = new THREE.Color(BG)
    scene.fog = null
    const hemi = new THREE.HemisphereLight(0xd8d0e8, 0x2a2228, 1.25)
    const key = new THREE.DirectionalLight(0xffe6cc, 2.2)
    key.position.set(-3, 6, 8)
    const rim = new THREE.DirectionalLight(0x9fb8ff, 1.1)
    rim.position.set(4, 3, -6)
    const floorGeo = new THREE.PlaneGeometry(400, 400)
    floorGeo.rotateX(-Math.PI / 2)
    const floorMat = new THREE.MeshToonMaterial({ color: 0x2a2430 })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.position.y = -0.01
    this.owned.push(floorGeo, floorMat)
    scene.add(hemi, key, rim, floor, this.group)
    this.removeUpdater = stage.addUpdater((_t, dt) => {
      for (const s of this.slots) s.model.update(dt)
    })
    stage.own(() => this.dispose())
  }

  /** Builds every monster of the zone (one after another); resolves with how many stand. */
  async build(): Promise<number> {
    const manifest = await monsterLibrary.manifest()
    const entries = lineupEntries(manifest, this.zone, (id) => {
      const m = this.content.monsters.get(id)
      const p = this.content.pets.get(id)
      const size = m ? ({ small: 0.6, medium: 1, large: 1.6, huge: 2.4 } as Record<string, number>)[m.size] : undefined
      return m ? { name: m.name, zone: m.zoneId, ...(size !== undefined ? { size } : {}) } : p ? { name: p.name } : undefined
    })
    for (const entry of entries) {
      if (this.disposed) return this.slots.length
      if (!monsterLibrary.available(entry.variant.base)) continue
      const model = await monsterLibrary.build(entry.variant)
      if (!model) continue
      if (this.disposed) {
        model.dispose()
        return this.slots.length
      }
      const holder = new THREE.Group()
      holder.add(model.root)
      // A three-quarter turn toward the camera, so a long body reads.
      holder.rotation.y = -0.5
      this.group.add(holder)
      const clips = cycleOf(model)
      model.animator.loopClip('Idle')
      model.update(0)
      this.slots.push({ entry, model, holder, clips, clip: Math.max(0, clips.indexOf('Idle')), row: 0, col: 0, box: new THREE.Box3() })
    }
    this.layout()
    return this.slots.length
  }

  private rows = 1

  private layout(): void {
    // Each model's own extent as it stands (its holder still at the origin): widths for the row, depth for the gap
    // between rows, and its middle, which goes on the spot (a throne or a ring of tentacles is not centred on the origin).
    const boxes = this.slots.map((s) => {
      s.holder.position.set(0, 0, 0)
      s.holder.updateMatrixWorld(true)
      const b = new THREE.Box3().setFromObject(s.holder)
      if (b.isEmpty()) {
        const r = Math.max(0.35, s.model.radius)
        b.set(new THREE.Vector3(-r, 0, -r), new THREE.Vector3(r, s.model.height, r))
      }
      return b
    })
    const bodies = boxes.map((b) => Math.max(0.7, b.max.x - b.min.x))
    const depth = Math.max(0, ...boxes.map((b) => b.max.z - b.min.z))
    // A slot is as wide as its monster or half its name, whichever is more (names alternate lines, so a name may
    // reach over its neighbours' but not the next one's on its line). How many metres a name needs depends on the
    // camera, which depends on the row: settled in a few rounds.
    let widths = bodies
    // Phase 8: rows stand far enough apart that a back row's names clear the front row's heads on screen (the Vault's
    // two rows of eight put the back row's names over the front row's monsters).
    let rowGap = Math.max(ROW_M, depth + 1)
    for (let round = 0; round < 6; round++) {
      const spots = lineupSpots(widths, 0.8, PER_ROW, rowGap)
      this.slots.forEach((s, i) => {
        const at = spots[i]!
        const b = boxes[i]!
        const shift = new THREE.Vector3(at.x - (b.min.x + b.max.x) / 2, 0, at.z - (b.min.z + b.max.z) / 2)
        s.holder.position.copy(shift)
        s.holder.updateMatrixWorld(true)
        s.box = b.clone().translate(shift)
        s.row = at.row
        s.col = at.col
      })
      this.rows = Math.max(1, ...spots.map((s) => s.row + 1))
      this.place()
      const perM = this.pxPerMetre()
      const next = this.slots.map((s, i) => Math.max(bodies[i]!, (labelHalf(s.entry.name) * 2 * 0.55) / Math.max(1e-3, perM(s))))
      const gap = this.rowGapFor(rowGap)
      if (next.every((w, i) => Math.abs(w - widths[i]!) < 0.05) && Math.abs(gap - rowGap) < 0.05) break
      widths = next
      rowGap = gap
    }
  }

  /**
   * The gap between rows (metres) at which every back row's names (two lines under its feet, every other one a line
   * lower) end above the highest head of the row in front, on screen with the camera as placed.
   */
  private rowGapFor(gap: number): number {
    if (this.rows < 2) return gap
    const cam = this.stage.camera
    const h = Math.max(1, this.stage.renderer.domElement.clientHeight)
    const y = (v: THREE.Vector3) => ((1 - v.project(cam).y) / 2) * h
    const pxPerDepthM = Math.abs(y(new THREE.Vector3(0, 0, 0)) - y(new THREE.Vector3(0, 0, -1)))
    if (pxPerDepthM < 1e-3) return gap
    const ts = textScale()
    const v = new THREE.Vector3()
    let need = 0
    for (let r = 0; r + 1 < this.rows; r++) {
      let headTop = Infinity
      for (const s of this.slots) if (s.row === r) headTop = Math.min(headTop, y(v.set((s.box.min.x + s.box.max.x) / 2, s.box.max.y, (s.box.min.z + s.box.max.z) / 2)))
      let labelBottom = -Infinity
      for (const s of this.slots) if (s.row === r + 1) labelBottom = Math.max(labelBottom, y(this.feet(s, v)) + (s.col % 2 === 1 ? LABEL_LOW_PX : LABEL_PX) * ts)
      need = Math.max(need, labelBottom + 6 - headTop)
    }
    return need > 0.5 ? gap + need / pxPerDepthM : gap
  }

  /** How many CSS px a metre across is, at a monster's feet, with the camera as placed. */
  private pxPerMetre(): (s: Slot) => number {
    const el = this.stage.renderer.domElement
    const w = Math.max(1, el.clientWidth)
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    return (s) => {
      this.feet(s, a)
      b.copy(a).add(new THREE.Vector3(1, 0, 0))
      a.project(this.stage.camera)
      b.project(this.stage.camera)
      return (Math.abs(b.x - a.x) / 2) * w
    }
  }

  /** The middle of a monster's feet (where its label hangs) and of its body (where a tap finds it). */
  private feet(s: Slot, out: THREE.Vector3): THREE.Vector3 {
    return out.set((s.box.min.x + s.box.max.x) / 2, -0.1, (s.box.min.z + s.box.max.z) / 2)
  }

  /**
   * The camera for the canvas's current size: a long lens from far off (sizes stay honest), a little from above — more
   * when there are rows behind rows — turned and widened until every monster, head to feet, and its label fit.
   */
  place(): void {
    const cam = this.stage.camera
    const el = this.stage.renderer.domElement
    const w = Math.max(1, el.clientWidth)
    const h = Math.max(1, el.clientHeight)
    cam.aspect = w / h
    const pts: THREE.Vector3[] = []
    for (const s of this.slots) {
      const b = s.box
      const z = (b.min.z + b.max.z) / 2
      pts.push(new THREE.Vector3(b.min.x, -0.9, z), new THREE.Vector3(b.max.x, -0.9, z), new THREE.Vector3(b.min.x, b.max.y + 0.1, z), new THREE.Vector3(b.max.x, b.max.y + 0.1, z))
    }
    if (pts.length === 0) pts.push(new THREE.Vector3(-3, 0, 0), new THREE.Vector3(3, 2, 0))
    const box = new THREE.Box3().setFromPoints(pts)
    const centre = box.getCenter(new THREE.Vector3())
    const pitch = this.rows > 1 ? 0.42 : 0.14
    cam.position.set(centre.x, centre.y + Math.sin(pitch) * DISTANCE, centre.z + Math.cos(pitch) * DISTANCE)
    cam.up.set(0, 1, 0)
    cam.lookAt(centre)
    cam.updateMatrixWorld(true)
    // The widest half-angle any point needs, across and up.
    const inv = cam.matrixWorldInverse
    let tx = 0.01
    let ty = 0.01
    const v = new THREE.Vector3()
    for (const p of pts) {
      v.copy(p).applyMatrix4(inv)
      const d = Math.max(1, -v.z)
      tx = Math.max(tx, Math.abs(v.x) / d)
      ty = Math.max(ty, Math.abs(v.y) / d)
    }
    let half = Math.max(ty, tx / cam.aspect) * 1.12
    cam.near = DISTANCE - 40
    cam.far = DISTANCE + 60
    cam.zoom = 1
    cam.clearViewOffset()
    // Widened again while a name would run off the side of the screen (a long name under the end of a row).
    for (let k = 0; k < 8; k++) {
      cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(half))
      cam.updateProjectionMatrix()
      let over = 0
      for (const s of this.slots) {
        this.feet(s, v).project(cam)
        const x = ((v.x + 1) / 2) * w
        const hw = labelHalf(s.entry.name)
        over = Math.max(over, (hw - x) / (w / 2), (x + hw - w) / (w / 2))
      }
      if (over <= 0) break
      half *= 1 + over + 0.02
    }
    cam.updateMatrixWorld(true)
  }

  /** Each monster's name and clip, at its feet on screen (CSS px). */
  labels(): LineupLabel[] {
    const el = this.stage.renderer.domElement
    const w = Math.max(1, el.clientWidth)
    const h = Math.max(1, el.clientHeight)
    const v = new THREE.Vector3()
    return this.slots.map((s) => {
      this.feet(s, v).project(this.stage.camera)
      return { id: s.entry.id, name: s.entry.name, clip: s.clips[s.clip] ?? 'Idle', x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, lower: s.col % 2 === 1 }
    })
  }

  /** The monster nearest a tap (CSS px), or null. */
  pick(x: number, y: number): string | null {
    const el = this.stage.renderer.domElement
    const w = Math.max(1, el.clientWidth)
    const h = Math.max(1, el.clientHeight)
    let best: string | null = null
    let bestD = Infinity
    const v = new THREE.Vector3()
    for (const s of this.slots) {
      this.feet(s, v)
      v.y = (s.box.min.y + s.box.max.y) / 2
      v.project(this.stage.camera)
      const d = Math.hypot(((v.x + 1) / 2) * w - x, ((1 - v.y) / 2) * h - y)
      if (d < bestD) {
        bestD = d
        best = s.entry.id
      }
    }
    return bestD < Math.max(w, h) * 0.25 ? best : null
  }

  /** Plays a monster's next clip (looped, so it can be watched); returns its name. */
  cycle(id: string): string | null {
    const s = this.slots.find((x) => x.entry.id === id)
    if (!s || s.clips.length === 0) return null
    s.clip = (s.clip + 1) % s.clips.length
    const name = s.clips[s.clip]!
    s.model.animator.loopClip(name)
    s.model.update(0)
    return name
  }

  count(): number {
    return this.slots.length
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.removeUpdater()
    for (const s of this.slots) s.model.dispose()
    this.slots = []
    for (const o of this.owned) o.dispose()
    this.group.clear()
  }
}
