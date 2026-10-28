import * as THREE from 'three'
import type { Content } from '../../../../sim/src/content.ts'
import type { Stage } from '../stage.ts'
import type { CharacterModel } from './assembler.ts'
import { buildCharacter } from './factory.ts'
import { specKey, type CharacterSpec } from './outfit.ts'

/**
 * The character viewer's 3D (Phase 5): one hero on a lit plinth, turned by dragging (a turntable), zoomed by pinch
 * or wheel between a full-body view and a **minimum distance** — the duel close-up, never a screen-filling portrait
 * (11 §1, Ascend D-068). Used full screen by the viewer route and small by the new hero's Look step. Changing the
 * spec rebuilds the hero (the old one is disposed once the new one is in).
 */

export interface ViewerSceneOptions {
  /** Closest the camera comes, metres from the hero's axis (the close-up). */
  minDistance: number
  maxDistance: number
  /** The starting distance; null frames the whole hero (the default). */
  distance: number | null
  /** Degrees; 0 faces the camera. */
  yaw: number
  /** Canvas pixels the UI covers on the right (the hero is framed in what is left). */
  rightInset: number
}

export const VIEWER_DEFAULTS: ViewerSceneOptions = { minDistance: 1.7, maxDistance: 5.5, distance: null, yaw: -24, rightInset: 0 }

const BG = 0x17121b

export class ViewerScene {
  private readonly stage: Stage
  private readonly content: Content
  private readonly opts: ViewerSceneOptions
  private readonly turntable = new THREE.Group()
  private readonly owned: { dispose(): void }[] = []
  private model: CharacterModel | null = null
  private modelKey = ''
  private building: Promise<void> | null = null
  private wanted: CharacterSpec | null = null
  /** The camera's distance, or null to frame the whole hero whatever their height. */
  private distance: number | null
  private yaw: number
  private clip: string | null = null
  private readonly removeUpdater: () => void
  private disposed = false
  /** Called whenever a hero finished building (or failed to): the screen's ready flag. */
  onShown: ((model: CharacterModel | null) => void) | null = null

  constructor(stage: Stage, content: Content, opts: Partial<ViewerSceneOptions> = {}) {
    this.stage = stage
    this.content = content
    this.opts = { ...VIEWER_DEFAULTS, ...opts }
    this.distance = this.opts.distance
    this.yaw = THREE.MathUtils.degToRad(this.opts.yaw)
    const { scene, camera } = stage
    scene.background = new THREE.Color(BG)
    scene.fog = new THREE.Fog(BG, 7, 16)
    camera.fov = 32
    camera.near = 0.1
    camera.far = 40

    // Light: a warm key from the front left, a cool rim from behind, a dim hemisphere fill (toon ramps per light).
    const hemi = new THREE.HemisphereLight(0xcfc6e0, 0x2a2026, 1.15)
    const key = new THREE.DirectionalLight(0xffe2c4, 2.3)
    key.position.set(-2.2, 3.4, 3.2)
    const rim = new THREE.DirectionalLight(0x9fb8ff, 1.3)
    rim.position.set(2.6, 2.2, -2.8)
    scene.add(hemi, key, rim)

    // A plinth and a soft contact shadow.
    const plinthGeo = new THREE.CylinderGeometry(0.85, 0.95, 0.12, 40)
    const plinthMat = new THREE.MeshToonMaterial({ color: 0x3a3140 })
    const plinth = new THREE.Mesh(plinthGeo, plinthMat)
    plinth.position.y = -0.06
    const floorGeo = new THREE.CircleGeometry(9, 48)
    floorGeo.rotateX(-Math.PI / 2)
    const floorMat = new THREE.MeshToonMaterial({ color: 0x241d29 })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.position.y = -0.12
    const shadowTex = blobTexture()
    const shadowGeo = new THREE.PlaneGeometry(1.2, 1.2)
    shadowGeo.rotateX(-Math.PI / 2)
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false })
    const shadow = new THREE.Mesh(shadowGeo, shadowMat)
    shadow.position.y = 0.002
    shadow.renderOrder = 1
    scene.add(plinth, floor, shadow, this.turntable)
    this.owned.push(plinthGeo, plinthMat, floorGeo, floorMat, shadowGeo, shadowMat, shadowTex)

    this.removeUpdater = stage.addUpdater((_t, dt) => this.frame(dt))
    stage.own(() => this.dispose())
    this.placeCamera()
  }

  /** Shows a hero; returns when it is on the plinth (a newer call supersedes an older one still building). */
  show(spec: CharacterSpec): Promise<void> {
    this.wanted = spec
    if (specKey(spec) === this.modelKey && this.model) return Promise.resolve()
    if (!this.building) this.building = this.buildLoop().finally(() => (this.building = null))
    return this.building
  }

  private async buildLoop(): Promise<void> {
    while (this.wanted && !this.disposed) {
      const spec = this.wanted
      const key = specKey(spec)
      if (key === this.modelKey && this.model) break
      const model = await buildCharacter(this.content, spec)
      if (this.disposed) {
        model?.dispose()
        return
      }
      if (this.wanted && specKey(this.wanted) !== key) {
        // Superseded while building: try again with the newest spec.
        model?.dispose()
        continue
      }
      this.model?.dispose()
      this.model = model
      this.modelKey = key
      if (model) {
        this.turntable.add(model.root)
        this.turntable.rotation.y = this.yaw
        if (this.clip) this.applyClip(this.clip)
        // Pose the first frame now (with Reduce motion no updater will).
        model.update(0)
      }
      this.placeCamera()
      this.onShown?.(model)
      break
    }
  }

  current(): CharacterModel | null {
    return this.model
  }

  /** The clips this hero can play (empty while the clips file is missing). */
  clipNames(): string[] {
    return this.model?.animator.names() ?? []
  }

  /** Loops a clip so it can be watched (one-shots replay); null returns to the idle. */
  setClip(name: string | null): void {
    this.clip = name
    this.applyClip(name)
  }

  private applyClip(name: string | null): void {
    const a = this.model?.animator
    if (!a) return
    if (!name || name === 'Idle') a.loopClip('Idle')
    else a.loopClip(name)
  }

  /** Turns the hero by a drag of `dx` CSS pixels. */
  turnBy(dx: number): void {
    this.yaw += dx * 0.012
    // Applied now as well as per frame: with Reduce motion the stage runs no updaters.
    this.turntable.rotation.y = this.yaw
  }

  /** Zooms by a factor (< 1 closer), clamped to the minimum and maximum distance. */
  zoomBy(factor: number): void {
    this.setDistance((this.distance ?? this.fullDistance()) * factor)
  }

  /** A distance in metres, clamped; null frames the whole hero. */
  setDistance(d: number | null): void {
    this.distance = d === null ? null : THREE.MathUtils.clamp(d, this.opts.minDistance, Math.max(this.opts.maxDistance, this.fullDistance() * 1.2))
    this.placeCamera()
  }

  /** The distance at which the whole hero fits the view with a margin (taller heroes stand further off). */
  private fullDistance(): number {
    const h = this.model?.height ?? 1.75
    const half = THREE.MathUtils.degToRad(this.stage.camera.fov / 2)
    return Math.max(this.opts.minDistance + 0.6, (h * 1.42) / (2 * Math.tan(half)))
  }

  setRightInset(px: number): void {
    this.opts.rightInset = px
    this.placeCamera()
  }

  distanceNow(): number {
    return this.distance ?? this.fullDistance()
  }

  private placeCamera(): void {
    const cam = this.stage.camera
    const h = this.model?.height ?? 1.75
    const full = this.fullDistance()
    const d = this.distance ?? full
    // The whole hero at the full-body distance; the head and shoulders at the minimum distance (the duel close-up).
    const t = THREE.MathUtils.clamp((d - this.opts.minDistance) / Math.max(0.01, full - this.opts.minDistance), 0, 1)
    // At full body the view centres a little above the waist, so the head stays clear of the screen's top bar.
    const targetY = THREE.MathUtils.lerp(h * 0.84, h * 0.57, t)
    const camY = targetY + THREE.MathUtils.lerp(0.04, 0.26, t)
    cam.position.set(0, camY, d)
    cam.lookAt(0, targetY, 0)
    const el = this.stage.renderer.domElement
    const w = Math.max(1, el.clientWidth)
    const hh = Math.max(1, el.clientHeight)
    cam.aspect = w / hh
    if (this.opts.rightInset > 0) cam.setViewOffset(w, hh, this.opts.rightInset / 2, 0, w, hh)
    else cam.clearViewOffset()
    cam.updateProjectionMatrix()
  }

  private frame(dt: number): void {
    this.turntable.rotation.y = this.yaw
    this.model?.update(dt)
  }

  /** Re-frames after the canvas changed size. */
  refit(): void {
    this.placeCamera()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.removeUpdater()
    this.model?.dispose()
    this.model = null
    for (const o of this.owned) o.dispose()
    this.stage.scene.fog = null
  }
}

/** A soft round shadow (a radial gradient). */
function blobTexture(): THREE.Texture {
  const size = 64
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5
      const dy = (y + 0.5) / size - 0.5
      const r = Math.min(1, Math.hypot(dx, dy) * 2)
      const a = Math.round(255 * Math.pow(1 - r, 1.6))
      const i = (y * size + x) * 4
      data[i] = 255
      data[i + 1] = 255
      data[i + 2] = 255
      data[i + 3] = a
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  t.needsUpdate = true
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearFilter
  return t
}
