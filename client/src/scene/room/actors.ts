import * as THREE from 'three'
import type { SceneCue } from '../sceneBus.ts'
import { MeshBuilder, trs } from './builder.ts'
import type { Kit } from './kit.ts'
import type { Mark } from './layout.ts'

/**
 * The actors (Phase 4 placeholders): heroes and humanoid monsters as capsules in their colours with a face patch;
 * rats, spiders and hounds as low beasts; a floating HP bar each; a blob shadow; one ring for whose turn it is and
 * one arrow for the target. The fight HUD's cues (sceneBus) flash, shake and topple them; the sim's state, read a
 * moment later, settles what the cues did not say. Every effect has a still version for Reduce motion.
 */
export type ActorShape = 'biped' | 'rat' | 'spider' | 'hound'

export interface ActorLook {
  id: string
  side: 'party' | 'enemy'
  kind: 'hero' | 'pet' | 'monster' | 'summon'
  /** Standing height, metres. */
  height: number
  /** Body radius, metres. */
  radius: number
  shape: ActorShape
  body: number
  trim: number
  face: number
  eyes: number
}

export interface ActorState {
  hp: number
  maxHp: number
  down: boolean
  gone: boolean
  /** Dead under the Mortal rule (D-088): lies greyer than a downed hero. */
  dead?: boolean
  /** A body the party carries, not in this fight: no HP bar. */
  body?: boolean
}

export interface ActorInput {
  look: ActorLook
  state: ActorState
  mark: Mark
}

export interface SetOptions {
  /** Skip the walk (a new room, Reduce motion). */
  instant: boolean
  /** Apply HP, downs and departures now rather than after the HUD's cues. */
  stateNow: boolean
  showBars: boolean
  /** The actor waiting for a command (the sim's pendingActorId). */
  turnId: string | null
}

interface View {
  look: ActorLook
  root: THREE.Group
  pose: THREE.Group
  mesh: THREE.Mesh
  mat: THREE.MeshToonMaterial
  geo: THREE.BufferGeometry
  pos: THREE.Vector3
  target: THREE.Vector3
  yaw: number
  hp: number
  hpTarget: number
  lie: number
  lieTarget: number
  fade: number
  fadeTarget: number
  flash: THREE.Color
  flashT: number
  flashLen: number
  shakeT: number
  dodgeT: number
  hopT: number
  leaving: boolean
  state: ActorState
}

const STATUS_TINT: Record<string, number> = {
  poison: 0x7bd36a,
  burn: 0xff7a2a,
  bleed: 0xd8343a,
  chill: 0x7fc8ff,
  freeze: 0x9fe0ff,
  shock: 0xfff06a,
  stun: 0xffe08a,
  blind: 0x9a9a9a,
  curse: 0xb070ff,
}

/** One actor's geometry, merged and vertex-coloured: one draw call each. */
function actorGeometry(kit: Kit, look: ActorLook): THREE.BufferGeometry {
  const b = new MeshBuilder('none')
  const { box, cyl, ball, cone } = kit.geo
  const H = look.height
  if (look.shape === 'biped') {
    const r = look.radius
    const cap = new THREE.CapsuleGeometry(r, Math.max(0.05, H - 2 * r), 4, 12)
    b.add(cap, trs(0, H / 2, 0), look.body)
    cap.dispose()
    b.add(cyl, trs(0, H * 0.5, 0, 0, r * 1.09, 0.11, r * 1.09), look.trim)
    b.add(cyl, trs(0, H * 0.75, 0, 0, r * 1.05, 0.08, r * 1.05), look.trim)
    b.add(box, trs(0, H - r * 1.05, r * 0.8, 0, r * 1.25, Math.max(0.12, H * 0.085), 0.12), look.face)
    b.add(box, trs(-r * 0.28, H - r * 1.02, r * 0.87, 0, 0.06, 0.05, 0.02), 0x1a1414)
    b.add(box, trs(r * 0.28, H - r * 1.02, r * 0.87, 0, 0.06, 0.05, 0.02), 0x1a1414)
    return b.build()!
  }
  // Beasts: a body along +z on legs, a head in front, the eyes in their colour.
  const rb = Math.max(0.12, look.radius)
  const L = Math.max(rb * 2.6, H * 1.55)
  const bodyY = H - rb
  if (look.shape === 'spider') {
    b.add(ball, trs(0, bodyY, -L * 0.18, 0, rb * 1.25, rb * 1.05, rb * 1.4), look.body)
    b.add(ball, trs(0, bodyY - rb * 0.1, L * 0.22, 0, rb * 0.8, rb * 0.7, rb * 0.8), look.trim)
    for (let i = 0; i < 4; i++) {
      for (const s of [-1, 1]) {
        const z = L * 0.22 - i * rb * 0.45
        b.add(cyl, trs(s * rb * 1.25, bodyY * 0.55, z, s * (0.5 - i * 0.22), rb * 0.08, bodyY * 1.3, rb * 0.08, 0, s * 0.95), look.body)
      }
    }
    for (const x of [-0.25, 0, 0.25]) b.add(box, trs(x * rb, bodyY, L * 0.22 + rb * 0.75, 0, rb * 0.16, rb * 0.16, 0.04), look.eyes)
    return b.build()!
  }
  const cap = new THREE.CapsuleGeometry(rb, Math.max(0.05, L - 2 * rb), 4, 10)
  b.add(cap, trs(0, bodyY, 0, 0, 1, 1, 1, Math.PI / 2), look.body)
  cap.dispose()
  const legH = Math.max(0.08, bodyY)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(cyl, trs(sx * rb * 0.55, legH / 2, sz * L * 0.28, 0, rb * 0.22, legH, rb * 0.22), look.body)
  const headR = rb * (look.shape === 'hound' ? 0.8 : 0.72)
  const hz = L / 2 + headR * 0.15
  const hy = H - headR * (look.shape === 'hound' ? 0.2 : 0.55)
  b.add(ball, trs(0, hy, hz, 0, headR, headR, headR * 1.1), look.body)
  b.add(cone, trs(0, hy - headR * 0.15, hz + headR * 1.05, 0, headR * 0.45, headR * 0.9, headR * 0.45, Math.PI / 2), look.trim)
  for (const s of [-1, 1]) {
    b.add(box, trs(s * headR * 0.42, hy + headR * 0.22, hz + headR * 0.8, 0, headR * 0.22, headR * 0.2, 0.05), look.eyes)
    b.add(cone, trs(s * headR * 0.5, hy + headR * 0.95, hz - headR * 0.1, 0, headR * 0.28, headR * 0.6, headR * 0.18), look.trim)
  }
  if (look.shape === 'rat') b.add(cyl, trs(0, bodyY * 0.75, -L / 2 - L * 0.3, 0, rb * 0.08, L * 0.7, rb * 0.08, Math.PI / 2 - 0.35), look.trim)
  else b.add(cyl, trs(0, bodyY + rb * 0.3, -L / 2 - rb * 0.2, 0, rb * 0.12, rb * 1.4, rb * 0.12, -0.6), look.body)
  return b.build()!
}

const MAX_BARS = 40
const BAR_W = 0.9
const BAR_H = 0.11
const PARTY_BAR = new THREE.Color(0x5fc46a)
const ENEMY_BAR = new THREE.Color(0xe0483a)
const DOWN_TINT = new THREE.Color(0.48, 0.5, 0.58)
const DEAD_TINT = new THREE.Color(0.3, 0.3, 0.34)
const WHITE = new THREE.Color(1, 1, 1)
// Scratch objects for apply(), which runs every animation frame: no garbage per actor per frame.
const UP = new THREE.Vector3(0, 1, 0)
const sM = new THREE.Matrix4()
const sP = new THREE.Vector3()
const sP2 = new THREE.Vector3()
const sS = new THREE.Vector3()
const sQ = new THREE.Quaternion()
const sRight = new THREE.Vector3()
const sBack = new THREE.Vector3()
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)

export class ActorLayer {
  readonly group = new THREE.Group()
  private readonly views = new Map<string, View>()
  private readonly barBg: THREE.InstancedMesh
  private readonly barFill: THREE.InstancedMesh
  private readonly shadows: THREE.InstancedMesh
  private readonly ring: THREE.Mesh
  private readonly arrow: THREE.Mesh
  private readonly owned: { dispose(): void }[] = []
  private ringId: string | null = null
  private arrowId: string | null = null
  private showBars = false
  private pending: Map<string, ActorState> | null = null
  private pendingTurn: string | null | undefined = undefined
  private lastCueAt = -1e9
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private reduceMotion = false
  private readonly centre = new THREE.Vector3()
  private centreKnown = false
  /** Called after the layer changed something outside an animation frame (Reduce motion keeps updaters off). */
  onChange: (() => void) | null = null

  private readonly kit: Kit
  private readonly camera: THREE.Camera

  constructor(kit: Kit, camera: THREE.Camera) {
    this.kit = kit
    this.camera = camera
    const plane = new THREE.PlaneGeometry(1, 1)
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x0b090d, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false, toneMapped: false })
    const fillMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })
    this.barBg = new THREE.InstancedMesh(plane, bgMat, MAX_BARS)
    this.barFill = new THREE.InstancedMesh(plane, fillMat, MAX_BARS)
    this.barBg.renderOrder = 20
    this.barFill.renderOrder = 21
    this.barBg.frustumCulled = false
    this.barFill.frustumCulled = false
    this.barFill.setColorAt(0, PARTY_BAR)
    const shadowGeo = new THREE.PlaneGeometry(1, 1)
    shadowGeo.rotateX(-Math.PI / 2)
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, map: kit.tex.blob, transparent: true, opacity: 0.55, depthWrite: false })
    this.shadows = new THREE.InstancedMesh(shadowGeo, shadowMat, MAX_BARS)
    this.shadows.frustumCulled = false
    this.shadows.renderOrder = 1
    const ringGeo = new THREE.RingGeometry(0.62, 0.8, 40)
    ringGeo.rotateX(-Math.PI / 2)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    this.ring = new THREE.Mesh(ringGeo, ringMat)
    this.ring.renderOrder = 4
    this.ring.visible = false
    const arrowGeo = new THREE.ConeGeometry(0.17, 0.42, 10)
    arrowGeo.rotateX(Math.PI)
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xff7a3d, depthTest: false, depthWrite: false, transparent: true, toneMapped: false })
    this.arrow = new THREE.Mesh(arrowGeo, arrowMat)
    this.arrow.renderOrder = 22
    this.arrow.visible = false
    this.owned.push(plane, bgMat, fillMat, shadowGeo, shadowMat, ringGeo, ringMat, arrowGeo, arrowMat)
    this.group.add(this.shadows, this.ring, this.barBg, this.barFill, this.arrow)
    this.clearInstances()
  }

  setReduceMotion(on: boolean): void {
    this.reduceMotion = on
  }

  private clearInstances(): void {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0)
    for (let i = 0; i < MAX_BARS; i++) {
      this.barBg.setMatrixAt(i, zero)
      this.barFill.setMatrixAt(i, zero)
      this.shadows.setMatrixAt(i, zero)
    }
    this.barBg.count = 0
    this.barFill.count = 0
    this.shadows.count = 0
  }

  private create(input: ActorInput): View {
    const geo = actorGeometry(this.kit, input.look)
    const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: this.kit.tex.ramp })
    const mesh = new THREE.Mesh(geo, mat)
    const pose = new THREE.Group()
    pose.add(mesh)
    const root = new THREE.Group()
    root.add(pose)
    const pos = new THREE.Vector3(input.mark.x, 0, input.mark.z)
    root.position.copy(pos)
    root.rotation.y = input.mark.yaw
    this.group.add(root)
    const s = input.state
    const view: View = {
      look: input.look,
      root,
      pose,
      mesh,
      mat,
      geo,
      pos,
      target: pos.clone(),
      yaw: input.mark.yaw,
      hp: s.maxHp > 0 ? s.hp / s.maxHp : 0,
      hpTarget: s.maxHp > 0 ? s.hp / s.maxHp : 0,
      lie: s.down ? 1 : 0,
      lieTarget: s.down ? 1 : 0,
      fade: s.gone ? 0 : 1,
      fadeTarget: s.gone ? 0 : 1,
      flash: new THREE.Color(),
      flashT: 0,
      flashLen: 1,
      shakeT: 0,
      dodgeT: 0,
      hopT: 0,
      leaving: false,
      state: { ...s },
    }
    if (s.gone) mat.transparent = true
    this.views.set(input.look.id, view)
    this.pose(view)
    return view
  }

  private drop(view: View): void {
    this.group.remove(view.root)
    view.geo.dispose()
    view.mat.dispose()
    this.views.delete(view.look.id)
  }

  /** Who stands where now. New actors appear, missing ones leave, the rest walk to their marks. */
  set(inputs: readonly ActorInput[], opts: SetOptions): void {
    this.showBars = opts.showBars
    const seen = new Set<string>()
    const states = new Map<string, ActorState>()
    for (const input of inputs) {
      seen.add(input.look.id)
      let view = this.views.get(input.look.id)
      if (view && !sameLook(view.look, input.look)) {
        this.drop(view)
        view = undefined
      }
      if (!view) {
        view = this.create(input)
      } else {
        view.leaving = false
        view.target.set(input.mark.x, 0, input.mark.z)
        view.yaw = input.mark.yaw
        if (opts.instant || this.reduceMotion) {
          view.pos.copy(view.target)
          view.root.position.copy(view.pos)
          view.root.rotation.y = view.yaw
        }
        states.set(input.look.id, input.state)
      }
    }
    for (const view of [...this.views.values()]) {
      if (seen.has(view.look.id)) continue
      if (opts.instant || this.reduceMotion || view.state.gone) this.drop(view)
      else {
        view.leaving = true
        view.fadeTarget = 0
        view.mat.transparent = true
        view.mat.needsUpdate = true
      }
    }
    this.updateCentre()
    this.pending = states
    this.pendingTurn = opts.turnId
    if (opts.stateNow) this.flush()
    else this.scheduleFlush(performance.now() - this.lastCueAt < 900 ? 750 : 280)
    this.apply()
  }

  private scheduleFlush(ms: number): void {
    if (this.flushTimer !== null) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      this.flush()
      this.onChange?.()
    }, ms)
  }

  /** The sim's word on HP, downs and departures, after the HUD has played its cues. */
  private flush(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    if (this.pending) {
      for (const [id, s] of this.pending) {
        const view = this.views.get(id)
        if (!view) continue
        this.applyState(view, s)
      }
      this.pending = null
    }
    if (this.pendingTurn !== undefined) {
      this.ringId = this.pendingTurn
      this.pendingTurn = undefined
    }
    this.apply()
  }

  private applyState(view: View, s: ActorState): void {
    view.state = { ...s }
    view.hpTarget = s.maxHp > 0 ? Math.max(0, Math.min(1, s.hp / s.maxHp)) : 0
    view.lieTarget = s.down ? 1 : 0
    if (s.gone && view.fadeTarget > 0) {
      view.fadeTarget = 0
      view.mat.transparent = true
      view.mat.needsUpdate = true
    } else if (!s.gone && !view.leaving && view.fadeTarget < 1) {
      view.fadeTarget = 1
      view.root.visible = true
    }
    if (this.reduceMotion) this.settle(view)
  }

  /** Jumps every tween to its end (Reduce motion: no updaters run). */
  private settle(view: View): void {
    view.hp = view.hpTarget
    view.lie = view.lieTarget
    view.fade = view.fadeTarget
    view.flashT = 0
    view.shakeT = 0
    view.dodgeT = 0
    view.hopT = 0
    view.pos.copy(view.target)
    this.pose(view)
  }

  cue(c: SceneCue): void {
    this.lastCueAt = performance.now()
    if (c.kind === 'clear') {
      this.ringId = null
      this.arrowId = null
      this.apply()
      return
    }
    const view = this.views.get(c.actorId)
    if (!view) return
    const max = view.state.maxHp > 0 ? view.state.maxHp : 1
    switch (c.kind) {
      case 'turn':
        this.ringId = c.actorId
        this.arrowId = null
        break
      case 'target':
        this.arrowId = c.actorId
        break
      case 'hit':
      case 'crit':
        if (c.amount) view.hpTarget = Math.max(0, view.hpTarget - c.amount / max)
        this.flashOn(view, c.kind === 'crit' ? 0xff6a2a : 0xffffff, c.kind === 'crit' ? 420 : 240)
        view.shakeT = c.kind === 'crit' ? 1 : 0.6
        break
      case 'miss':
        view.dodgeT = 1
        break
      case 'heal':
        if (c.amount) view.hpTarget = Math.min(1, view.hpTarget + c.amount / max)
        this.flashOn(view, 0x5fe07a, 360)
        view.hopT = 1
        break
      case 'status':
        this.flashOn(view, STATUS_TINT[c.status ?? ''] ?? 0xb08cff, 320)
        break
      case 'down':
        view.lieTarget = 1
        break
      case 'revive':
        view.lieTarget = 0
        this.flashOn(view, 0x5fe07a, 420)
        break
      case 'gone':
        view.fadeTarget = 0
        view.mat.transparent = true
        view.mat.needsUpdate = true
        break
    }
    if (this.reduceMotion) this.settle(view)
    // The sim's state follows once the cues go quiet.
    if (this.pending || this.pendingTurn !== undefined) this.scheduleFlush(750)
    this.apply()
  }

  private flashOn(view: View, hex: number, ms: number): void {
    if (this.reduceMotion) return
    view.flash.setHex(hex)
    view.flashT = 1
    view.flashLen = ms
  }

  /** True while something is still moving. */
  update(dt: number, time: number): boolean {
    let busy = false
    const k = 1 - Math.exp(-dt / 140)
    for (const view of [...this.views.values()]) {
      const d = view.target.distanceTo(view.pos)
      if (d > 0.005) {
        const step = Math.min(d, (dt / 1000) * 4.2)
        view.pos.lerp(view.target, step / d)
        busy = true
      }
      let dy = view.yaw - view.root.rotation.y
      dy = Math.atan2(Math.sin(dy), Math.cos(dy))
      if (Math.abs(dy) > 0.002) {
        view.root.rotation.y += dy * Math.min(1, k * 1.6)
        busy = true
      }
      for (const [key, tkey] of [
        ['hp', 'hpTarget'],
        ['lie', 'lieTarget'],
        ['fade', 'fadeTarget'],
      ] as const) {
        const t = view[tkey]
        const cur = view[key]
        if (Math.abs(t - cur) > 0.002) {
          view[key] = cur + (t - cur) * (key === 'hp' ? k * 1.4 : k)
          busy = true
        } else view[key] = t
      }
      if (view.flashT > 0) {
        view.flashT = Math.max(0, view.flashT - dt / view.flashLen)
        busy = true
      }
      for (const key of ['shakeT', 'dodgeT', 'hopT'] as const) {
        if (view[key] > 0) {
          view[key] = Math.max(0, view[key] - dt / 320)
          busy = true
        }
      }
      if (view.leaving && view.fade <= 0.01) {
        this.drop(view)
        continue
      }
      this.pose(view)
    }
    this.apply(time)
    return busy || this.ringId !== null || this.arrowId !== null
  }

  private pose(view: View): void {
    const { root, pose, mat, look } = view
    const shake = view.shakeT > 0 ? Math.sin(view.shakeT * 40) * 0.09 * view.shakeT : 0
    const dodge = view.dodgeT > 0 ? Math.sin(view.dodgeT * Math.PI) * 0.45 : 0
    const hop = view.hopT > 0 ? Math.sin(view.hopT * Math.PI) * 0.18 : 0
    root.position.set(view.pos.x, hop, view.pos.z)
    // Shake and dodge sideways in the actor's own frame.
    const c = Math.cos(root.rotation.y)
    const s = Math.sin(root.rotation.y)
    root.position.x += (shake + dodge) * c
    root.position.z -= (shake + dodge) * s
    if (look.shape === 'biped') {
      pose.rotation.set(-(Math.PI / 2) * view.lie, 0, 0)
      pose.position.set(0, look.radius * view.lie, 0)
    } else {
      pose.rotation.set(0, 0, (Math.PI / 2) * view.lie * 0.9)
      pose.position.set(0, look.radius * 0.4 * view.lie, 0)
    }
    mat.color.copy(WHITE).lerp(view.state.dead ? DEAD_TINT : DOWN_TINT, view.lie)
    if (view.flashT > 0) {
      mat.emissive.copy(view.flash)
      mat.emissiveIntensity = view.flashT * 1.4
    } else {
      mat.emissive.setRGB(0, 0, 0)
      mat.emissiveIntensity = 0
    }
    mat.opacity = view.fade
    root.visible = view.fade > 0.01
  }

  /** Writes the bars, shadows, ring and arrow (each frame while animating, and after any change). */
  apply(time = performance.now()): void {
    const m = sM
    const q = this.camera.quaternion
    const right = sRight.set(1, 0, 0).applyQuaternion(q)
    const p = sP
    const scale = sS
    let i = 0
    let ringView: View | undefined
    let arrowView: View | undefined
    for (const view of this.views.values()) {
      if (i >= MAX_BARS) break
      const look = view.look
      const visible = view.fade > 0.01
      // Shadow.
      const lying = view.lie
      const sx = look.shape === 'biped' ? look.radius * 3.2 + lying * 0.4 : look.radius * 3.2
      const sz = look.shape === 'biped' ? look.radius * 3.2 + lying * look.height * 0.9 : Math.max(look.radius * 3.2, look.height * 2)
      if (visible) {
        m.compose(p.set(view.root.position.x, 0.02, view.root.position.z), sQ.setFromAxisAngle(UP, view.root.rotation.y), scale.set(sx * view.fade, 1, sz * view.fade))
        if (look.shape === 'biped' && lying > 0) {
          // The body lies behind the feet.
          const back = sBack.set(0, 0, -look.height * 0.45 * lying).applyAxisAngle(UP, view.root.rotation.y)
          m.setPosition(view.root.position.x + back.x, 0.02, view.root.position.z + back.z)
        }
      } else m.copy(ZERO)
      this.shadows.setMatrixAt(i, m)
      // HP bar.
      const barVisible = visible && this.showBars && !view.leaving && !view.state.body
      if (barVisible) {
        const standTop = look.shape === 'biped' ? look.height : look.height + 0.1
        const top = standTop * (1 - lying) + (look.radius * 2 + 0.1) * lying
        const w = Math.max(0.7, Math.min(1.3, look.radius * 3.4)) * BAR_W
        p.set(view.root.position.x, top + 0.42, view.root.position.z)
        m.compose(p, q, scale.set(w, BAR_H, 1))
        this.barBg.setMatrixAt(i, m)
        const frac = Math.max(0, Math.min(1, view.hp))
        const fw = (w - 0.05) * frac
        sP2.copy(right).multiplyScalar(-((w - 0.05) - fw) / 2).add(p)
        m.compose(sP2, q, scale.set(Math.max(0.0001, fw), BAR_H * 0.62, 1))
        this.barFill.setMatrixAt(i, m)
        this.barFill.setColorAt(i, look.side === 'party' ? PARTY_BAR : ENEMY_BAR)
      } else {
        this.barBg.setMatrixAt(i, ZERO)
        this.barFill.setMatrixAt(i, ZERO)
      }
      if (look.id === this.ringId && visible) ringView = view
      if (look.id === this.arrowId && visible) arrowView = view
      i++
    }
    this.barBg.count = i
    this.barFill.count = i
    this.shadows.count = i
    this.barBg.instanceMatrix.needsUpdate = true
    this.barFill.instanceMatrix.needsUpdate = true
    if (this.barFill.instanceColor) this.barFill.instanceColor.needsUpdate = true
    this.shadows.instanceMatrix.needsUpdate = true
    // Whose turn: a ring on the floor; the target: an arrow overhead.
    if (ringView) {
      const r = Math.max(0.6, ringView.look.shape === 'biped' ? ringView.look.radius * 2.6 : ringView.look.height * 1.2)
      const pulse = this.reduceMotion ? 1 : 1 + Math.sin(time * 0.006) * 0.06
      this.ring.position.set(ringView.root.position.x, 0.04, ringView.root.position.z)
      this.ring.scale.setScalar(r * pulse)
      this.ring.visible = true
    } else this.ring.visible = false
    if (arrowView) {
      const top = arrowView.look.height * (1 - arrowView.lie) + 0.5 * arrowView.lie
      const bob = this.reduceMotion ? 0 : Math.sin(time * 0.008) * 0.08
      this.arrow.position.set(arrowView.root.position.x, top + (this.showBars ? 0.95 : 0.6) + bob, arrowView.root.position.z)
      this.arrow.visible = true
    } else this.arrow.visible = false
  }

  /** Feet and heads at the marks the actors are heading for (to frame the camera on). */
  points(): THREE.Vector3[] {
    const out: THREE.Vector3[] = []
    for (const view of this.views.values()) {
      if (view.leaving || view.state.gone) continue
      const r = Math.max(view.look.radius, 0.3)
      out.push(new THREE.Vector3(view.target.x - r, 0, view.target.z - r))
      out.push(new THREE.Vector3(view.target.x + r, 0, view.target.z + r))
      out.push(new THREE.Vector3(view.target.x, view.look.height + (this.showBars ? 0.6 : 0.15), view.target.z))
    }
    return out
  }

  /** Each actor's place on screen in CSS px (for UI that wants to point at one). */
  anchors(width: number, height: number): Record<string, { x: number; y: number; top: number }> {
    const out: Record<string, { x: number; y: number; top: number }> = {}
    const v = new THREE.Vector3()
    for (const view of this.views.values()) {
      if (view.leaving) continue
      v.set(view.target.x, 0, view.target.z).project(this.camera)
      const x = ((v.x + 1) / 2) * width
      const y = ((1 - v.y) / 2) * height
      v.set(view.target.x, view.look.height + 0.5, view.target.z).project(this.camera)
      out[view.look.id] = { x: Math.round(x), y: Math.round(y), top: Math.round(((1 - v.y) / 2) * height) }
    }
    return out
  }

  /** The party's centre (for the torch light); worked out when the marks change, read every frame. */
  partyCentre(): THREE.Vector3 | null {
    return this.centreKnown ? this.centre : null
  }

  private updateCentre(): void {
    this.centre.set(0, 0, 0)
    let n = 0
    for (const view of this.views.values()) {
      if (view.look.side !== 'party' || view.leaving) continue
      this.centre.add(view.target)
      n++
    }
    if (n) this.centre.divideScalar(n)
    this.centreKnown = n > 0
  }

  dispose(): void {
    if (this.flushTimer !== null) clearTimeout(this.flushTimer)
    for (const view of [...this.views.values()]) this.drop(view)
    for (const o of this.owned) o.dispose()
    this.group.clear()
  }
}

function sameLook(a: ActorLook, b: ActorLook): boolean {
  return a.shape === b.shape && a.height === b.height && a.radius === b.radius && a.body === b.body && a.trim === b.trim && a.face === b.face && a.eyes === b.eyes
}
