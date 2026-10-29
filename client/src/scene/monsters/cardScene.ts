import * as THREE from 'three'
import type { Stage } from '../stage.ts'
import { monsterLibrary, type MonsterModel } from './model.ts'

/**
 * One monster on a small dark plinth for the codex's card (12 Phase 8, pass B): the monster's own model from the
 * library the fights and the lineup use, playing Idle, framed head to feet by a long lens, turning slowly (still when
 * Reduce motion is on). `show` swaps the monster; everything it built is freed on the next show and on dispose.
 */

const BG = 0x17131c
const DISTANCE = 30
const TURN_PER_SECOND = 0.35

export class MonsterCardScene {
  private readonly stage: Stage
  private readonly holder = new THREE.Group()
  private readonly owned: { dispose(): void }[] = []
  private model: MonsterModel | null = null
  private token = 0
  private disposed = false
  private readonly removeUpdater: () => void
  /** Called once a monster stands (or none could be built): the canvas's ready flag. */
  onShown: ((shown: boolean) => void) | null = null

  constructor(stage: Stage, opts: { reduceMotion: boolean }) {
    this.stage = stage
    const { scene } = stage
    scene.background = new THREE.Color(BG)
    scene.fog = null
    const hemi = new THREE.HemisphereLight(0xd8d0e8, 0x2a2228, 1.3)
    const key = new THREE.DirectionalLight(0xffe6cc, 2.2)
    key.position.set(-3, 6, 8)
    const rim = new THREE.DirectionalLight(0x9fb8ff, 1.1)
    rim.position.set(4, 3, -6)
    const plinthGeo = new THREE.CylinderGeometry(1, 1, 0.08, 40)
    const plinthMat = new THREE.MeshToonMaterial({ color: 0x2a2430 })
    const plinth = new THREE.Mesh(plinthGeo, plinthMat)
    plinth.position.y = -0.04
    this.owned.push(plinthGeo, plinthMat)
    this.holder.add(plinth)
    scene.add(hemi, key, rim, this.holder)
    let reduce = opts.reduceMotion
    this.removeUpdater = stage.addUpdater((_t, dt) => {
      this.model?.update(dt)
      if (!reduce) this.holder.rotation.y += (TURN_PER_SECOND * dt) / 1000
    })
    this.setReduceMotion = (on: boolean) => {
      reduce = on
      if (on) this.holder.rotation.y = -0.5
    }
    this.holder.rotation.y = -0.5
    stage.own(() => this.dispose())
  }

  setReduceMotion: (on: boolean) => void

  /** Stands the monster of this content id (the manifest's entry); a missing model leaves the plinth bare. */
  async show(monsterId: string): Promise<boolean> {
    const token = ++this.token
    this.clearModel()
    const manifest = await monsterLibrary.manifest()
    const variant = manifest.monsters.get(monsterId) ?? manifest.pets.get(monsterId)
    if (!variant || !monsterLibrary.available(variant.base)) return this.done(token, false)
    const model = await monsterLibrary.build(variant)
    if (!model) return this.done(token, false)
    if (this.disposed || token !== this.token) {
      model.dispose()
      return false
    }
    this.model = model
    model.animator.loopClip('Idle')
    model.update(0)
    this.holder.add(model.root)
    this.frame()
    return this.done(token, true)
  }

  private done(token: number, shown: boolean): boolean {
    if (token === this.token && !this.disposed) this.onShown?.(shown)
    return shown
  }

  /** Head to feet in the middle of the canvas, the plinth sized to the monster's footprint. */
  frame(): void {
    const cam = this.stage.camera
    const el = this.stage.renderer.domElement
    cam.aspect = Math.max(1, el.clientWidth) / Math.max(1, el.clientHeight)
    const m = this.model
    const box = m ? new THREE.Box3().setFromObject(m.root) : new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1.6, 1))
    if (box.isEmpty()) box.set(new THREE.Vector3(-0.6, 0, -0.6), new THREE.Vector3(0.6, Math.max(0.6, m?.height ?? 1.6), 0.6))
    const size = box.getSize(new THREE.Vector3())
    const centre = box.getCenter(new THREE.Vector3())
    const plinth = this.holder.children[0]
    const r = Math.max(0.5, Math.max(size.x, size.z) * 0.62)
    if (plinth) plinth.scale.set(r, 1, r)
    const height = Math.max(0.6, size.y)
    const across = Math.max(size.x, size.z) * 1.1
    const half = Math.max(height * 0.62, across / (2 * cam.aspect)) / DISTANCE
    cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(half * 1.05))
    cam.near = DISTANCE - 15
    cam.far = DISTANCE + 15
    cam.position.set(0, centre.y + DISTANCE * 0.18, DISTANCE)
    cam.lookAt(0, centre.y, 0)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld(true)
  }

  private clearModel(): void {
    if (!this.model) return
    this.holder.remove(this.model.root)
    this.model.dispose()
    this.model = null
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.token++
    this.removeUpdater()
    this.clearModel()
    for (const o of this.owned) o.dispose()
    this.holder.clear()
  }
}
