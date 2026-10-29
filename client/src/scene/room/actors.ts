import * as THREE from 'three'
import type { CharacterAnimator } from '../characters/animator.ts'
import type { SceneCue } from '../sceneBus.ts'
import { isFxKind, type FxKind, type SpriteName } from '../vfx/recipes.ts'
import { MeshBuilder, trs } from './builder.ts'
import type { Kit } from './kit.ts'
import type { Mark } from './layout.ts'

/**
 * The actors: humanoid monsters as capsules in their colours with a face patch (Phase 4 placeholders until Phase 6);
 * rats, spiders and hounds as low beasts; heroes as their assembled 3D characters (Phase 5) — the capsule stands in
 * while the model loads, and stays if it cannot. A floating HP bar each; a blob shadow; one ring for whose turn it is
 * and one arrow for the target. The fight HUD's cues (sceneBus) flash, shake and topple them, and play a hero's clips
 * (attack, cast, shoot, hit, dodge, downed, revive, victory); the sim's state, read a moment later, settles what the
 * cues did not say. Every effect has a still version for Reduce motion.
 *
 * Phase 6: monsters and pets are their 3D models too (monsters/model.ts) — a monster walks in to its mark (Move),
 * swings Attack1 or Attack2, flinches (Hit), falls (Death), stays down a moment, then fades in a puff of smoke; one that
 * flees plays its Flee and leaves the room. The fight's effects (vfx/) are spawned on the actors here, at their feet or
 * their chest.
 */
export type ActorShape = 'biped' | 'rat' | 'spider' | 'hound'

/** A 3D character on stage: a hero (characters/assembler.ts) or a monster or pet (monsters/model.ts). */
export interface ActorModel {
  readonly root: THREE.Object3D
  readonly animator: CharacterAnimator
  /** Standing height in metres. */
  readonly height: number
  /** Leg length against the rig its walk was authored on: walk cycles are paced by it. */
  readonly stride: number
  readonly hasShield: boolean
  update(dtMs: number): void
  setTint(c: THREE.Color): void
  setFlash(c: THREE.Color | null, intensity?: number): void
  setOpacity(o: number): void
  /** A tell's shape, 0 at rest to 1 at full (the Bursting Corpse's swell, monsters/wear.ts); absent without one. */
  setTell?(k: number): void
  dispose(): void
}

/** Where the actor layer sends the fight's effects (the room's VfxLayer). */
export interface FxSink {
  spawn(kind: FxKind, feet: THREE.Vector3, opts: { height: number; color?: number; shape?: SpriteName; crit?: boolean }): void
}

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
  /** The actor's 3D model (heroes Phase 5, monsters and pets Phase 6); its key changes when anything it shows changes. */
  model?: { key: string; build: () => Promise<ActorModel | null> }
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
  /** A telegraphed attack is wound up (the sim's `monster.windup`): its model shows the tell (a swelling belly). */
  tell?: boolean
}

export interface ActorInput {
  look: ActorLook
  state: ActorState
  mark: Mark
  /**
   * The HP the fight HUD shows now, when its playback is behind the sim (a fight that opens with the monsters' blows
   * already in the sim's HP): a new bar starts there, and the sim's word follows once the beats have played.
   */
  shownHp?: number
  /** Already on its mark when the fight begins (a boss on his throne or dais, room/arena.ts): it does not walk in. */
  stand?: boolean
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
  /** The 3D model once built (the capsule hides then). */
  model: ActorModel | null
  modelToken: number
  /** Walking or running to a new mark, and which. */
  moving: boolean
  gait: 'Walk' | 'Run'
  /** The model is in its Downed hold. */
  modelDown: boolean
  /** A monster's death: ms it stays down before it fades (its Death clip plays meanwhile). */
  dyingMs: number
  /** Fleeing out of the room. */
  fleeing: boolean
  /** How far its tell shows (0–1), eased toward the state's `tell`. */
  tell: number
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
const sTint = new THREE.Color()
/** How fast a hero with a 3D model walks and runs between marks (m/s); a long way is run. */
const WALK_MPS = 1.7
const RUN_MPS = 3.2
const RUN_OVER_M = 2.5
/** An attack clip starts this long before its hit frame (clips.json) so the blow lands with the beat. */
const STRIKE_LEAD_S = 0.12
/** A monster walks in to its mark from this far behind it when a fight begins (Move on approach). */
const APPROACH_M = 2.2
/** A fallen monster stays down this long after its Death clip ends, then fades. */
const DEATH_REST_MS = 650
/** A tell's shape grows over this long once its wind-up shows (the turn before the blow), and goes in this long. */
const TELL_RISE_MS = 900
const TELL_FALL_MS = 300

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
  private readonly fx: FxSink | null
  private readonly pendingBuilds = new Set<Promise<void>>()
  private builds = 0
  private disposed = false
  /** Called after the layer changed something outside an animation frame (Reduce motion keeps updaters off). */
  onChange: (() => void) | null = null
  /** Called when a model arrives whose height differs from the stand-in's (the scene re-frames once they settle). */
  onModel: (() => void) | null = null

  private readonly kit: Kit
  private readonly camera: THREE.Camera

  constructor(kit: Kit, camera: THREE.Camera, fx: FxSink | null = null) {
    this.kit = kit
    this.camera = camera
    this.fx = fx
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
    const pos = new THREE.Vector3(input.mark.x, input.mark.y ?? 0, input.mark.z)
    root.position.copy(pos)
    root.rotation.y = input.mark.yaw
    this.group.add(root)
    const s = input.state
    const hp0 = input.shownHp ?? s.hp
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
      hp: s.maxHp > 0 ? Math.max(0, Math.min(1, hp0 / s.maxHp)) : 0,
      hpTarget: s.maxHp > 0 ? Math.max(0, Math.min(1, hp0 / s.maxHp)) : 0,
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
      model: null,
      modelToken: 0,
      moving: false,
      gait: 'Walk',
      modelDown: false,
      dyingMs: 0,
      fleeing: false,
      tell: s.tell ? 1 : 0,
    }
    if (s.gone) mat.transparent = true
    this.views.set(input.look.id, view)
    this.pose(view)
    if (input.look.model) this.requestModel(view)
    return view
  }

  /** Builds the actor's model in the background; the capsule stands in until it arrives (and stays if it cannot). */
  private requestModel(view: View): void {
    const build = view.look.model?.build
    if (!build) return
    const token = ++this.builds
    view.modelToken = token
    const p: Promise<void> = build()
      .then((model) => {
        if (!model) return
        if (this.disposed || this.views.get(view.look.id) !== view || view.modelToken !== token) {
          model.dispose()
          return
        }
        view.model = model
        view.pose.add(model.root)
        view.mesh.visible = false
        if (view.lieTarget >= 0.5) this.setModelDown(view, true, true)
        // A model that arrives mid-walk walks the rest of the way.
        if (view.target.distanceTo(view.pos) > 0.005) view.moving = false
        model.setTell?.(view.tell)
        model.update(0)
        this.pose(view)
        this.onChange?.()
        if (Math.abs(this.heightOf(view) - view.look.height) > 0.25) this.onModel?.()
      })
      .catch((e: unknown) => console.warn('actor model failed', e))
      .finally(() => {
        this.pendingBuilds.delete(p)
      })
    this.pendingBuilds.add(p)
  }

  /** Resolves when every hero model asked for so far has arrived (or failed). */
  async modelsSettled(): Promise<void> {
    while (this.pendingBuilds.size > 0) await Promise.all([...this.pendingBuilds])
  }

  /** What a view shows (where it stands, its bar, lying, fading, dying or fleeing) handed to its replacement. */
  private carry(from: View, to: View): void {
    to.pos.copy(from.pos)
    to.root.rotation.y = from.root.rotation.y
    to.hp = from.hp
    to.hpTarget = from.hpTarget
    to.lie = from.lie
    to.lieTarget = from.lieTarget
    to.fade = from.fade
    to.fadeTarget = from.fadeTarget
    to.state = { ...from.state }
    to.dyingMs = from.dyingMs
    to.fleeing = from.fleeing
    to.tell = from.tell
    if (to.fade < 1 || to.fadeTarget < 1) to.mat.transparent = true
  }

  private drop(view: View): void {
    this.group.remove(view.root)
    view.geo.dispose()
    view.mat.dispose()
    view.modelToken = -1
    view.model?.dispose()
    view.model = null
    this.views.delete(view.look.id)
  }

  /** A hero model goes down into its Downed hold (or straight to its last frame), or gets back up. */
  private setModelDown(view: View, down: boolean, instant = false): void {
    const a = view.model?.animator
    if (!a || !a.hasClips() || view.modelDown === down) return
    view.modelDown = down
    if (down) a.play('Downed', { hold: true, ...(instant ? { offset: 99 } : {}) })
    else {
      a.release()
      if (!instant) a.play('Revive')
    }
  }

  /** One of a model's clips for a fight beat, started so its hit (or release) frame lands just after the cue. */
  private playClip(view: View, wanted: string, speed = 1, alt: readonly string[] = []): void {
    const a = view.model?.animator
    // A monster's own clip for the move (a Web, a Howl) first; a shield bearer guards behind the shield.
    const own = a ? alt.find((n) => a.has(n)) : undefined
    const clip = own ?? (wanted === 'Guard' && view.model?.hasShield && a?.has('Guard_Shield') ? 'Guard_Shield' : wanted)
    if (!a || view.modelDown || view.lieTarget >= 0.5 || view.dyingMs > 0 || view.fleeing || !a.has(clip)) return
    const k = Math.max(1, Math.min(3, speed))
    const strike = a.eventTime(clip, 'hit') ?? a.eventTime(clip, 'release')
    a.play(clip, { offset: strike !== null ? Math.max(0, strike - STRIKE_LEAD_S * k) : 0, timeScale: k })
  }

  /** Sets the walk or run loop for a move, matched to how fast the hero actually goes. */
  private gaitOn(view: View): void {
    const m = view.model
    if (!m) return
    const a = m.animator
    a.setBase(view.gait)
    const clipSpeed = a.speedOf(a.baseClip())
    const speed = view.gait === 'Run' ? RUN_MPS : WALK_MPS
    if (clipSpeed) a.setBaseTimeScale(Math.max(0.6, Math.min(2, speed / (clipSpeed * m.stride))))
  }

  /** Who stands where now. New actors appear, missing ones leave, the rest walk to their marks. */
  set(inputs: readonly ActorInput[], opts: SetOptions): void {
    this.showBars = opts.showBars
    const seen = new Set<string>()
    const states = new Map<string, ActorState>()
    const shown = new Map<string, number>()
    for (const input of inputs) {
      seen.add(input.look.id)
      if (input.shownHp !== undefined && input.shownHp !== input.state.hp) shown.set(input.look.id, input.shownHp)
      let view = this.views.get(input.look.id)
      let was: View | undefined
      if (view && !sameLook(view.look, input.look)) {
        was = view
        this.drop(view)
        view = undefined
      }
      if (!view) {
        view = this.create(input)
        const l = input.look
        if (was) {
          // The same actor in a new look (its model's table arrived, a boss moved to its next phase): it stays where it
          // stands and its bar shows what it showed, the sim's word following once the cues go quiet — else the beats
          // still to play would take their hits off a bar that already counts them.
          this.carry(was, view)
          view.target.set(input.mark.x, input.mark.y ?? 0, input.mark.z)
          view.yaw = input.mark.yaw
          if (opts.instant || this.reduceMotion) view.pos.copy(view.target)
          view.root.position.copy(view.pos)
          this.pose(view)
          states.set(l.id, input.state)
        } else if (shown.has(l.id)) {
          // Born behind the sim: the sim's HP waits for the beats.
          states.set(l.id, input.state)
        }
        if (!was && opts.showBars && !this.reduceMotion && !input.state.gone && !input.stand && (l.kind === 'monster' || l.kind === 'summon') && l.side === 'enemy') {
          // Phase 6: a monster joining a fight walks in to its mark (its Move), from a little behind it.
          const back = APPROACH_M * Math.max(1, l.height / 1.8)
          view.pos.set(input.mark.x - Math.sin(input.mark.yaw) * back, input.mark.y ?? 0, input.mark.z - Math.cos(input.mark.yaw) * back)
          view.root.position.copy(view.pos)
          this.pose(view)
        }
      } else {
        view.leaving = false
        view.target.set(input.mark.x, input.mark.y ?? 0, input.mark.z)
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
      if (opts.instant || this.reduceMotion || (view.state.gone && view.dyingMs <= 0)) this.drop(view)
      else {
        view.leaving = true
        if (view.dyingMs <= 0) {
          view.fadeTarget = 0
          view.mat.transparent = true
          view.mat.needsUpdate = true
        }
      }
    }
    this.updateCentre()
    this.pending = states
    this.pendingTurn = opts.turnId
    if (opts.stateNow) {
      // Now — except a bar the HUD has beats still to play down: it shows the HUD's HP until they have played.
      const later = new Map<string, ActorState>()
      for (const [id, s] of states) {
        const hp = shown.get(id)
        if (hp === undefined) continue
        later.set(id, s)
        states.set(id, { ...s, hp })
      }
      this.flush()
      if (later.size > 0) {
        this.pending = later
        this.scheduleFlush(750)
      }
    } else this.scheduleFlush(performance.now() - this.lastCueAt < 900 ? 750 : 280)
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
    this.setModelDown(view, s.down)
    // A monster still showing its fall (or its flight) fades when that is done, not now.
    if (s.gone && (view.dyingMs > 0 || view.fleeing)) {
      if (this.reduceMotion) this.settle(view)
      return
    }
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
    view.tell = view.state.tell && !view.state.gone ? 1 : 0
    view.model?.setTell?.(view.tell)
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
        // Where the beat leaves the bar (Phase 6), else moved by the blow.
        if (c.hp !== undefined) view.hpTarget = Math.max(0, Math.min(1, c.hp / (c.maxHp && c.maxHp > 0 ? c.maxHp : max)))
        else if (c.amount) view.hpTarget = Math.max(0, view.hpTarget - c.amount / max)
        this.flashOn(view, c.kind === 'crit' ? 0xff6a2a : 0xffffff, c.kind === 'crit' ? 420 : 240)
        view.shakeT = c.kind === 'crit' ? 1 : 0.6
        this.playClip(view, 'Hit')
        break
      case 'fx':
        this.spawnFx(view, c)
        break
      case 'flee':
        this.flee(view)
        break
      case 'miss':
        view.dodgeT = 1
        this.playClip(view, 'Dodge')
        break
      case 'anim':
        if (c.clip) this.playClip(view, c.clip, c.speed ?? 1, c.alt ?? [])
        break
      case 'heal':
        if (c.hp !== undefined) view.hpTarget = Math.max(0, Math.min(1, c.hp / (c.maxHp && c.maxHp > 0 ? c.maxHp : max)))
        else if (c.amount) view.hpTarget = Math.min(1, view.hpTarget + c.amount / max)
        this.flashOn(view, 0x5fe07a, 360)
        view.hopT = 1
        break
      case 'status':
        this.flashOn(view, STATUS_TINT[c.status ?? ''] ?? 0xb08cff, 320)
        break
      case 'down':
        view.lieTarget = 1
        this.setModelDown(view, true)
        break
      case 'revive':
        if (c.hp !== undefined) view.hpTarget = Math.max(0, Math.min(1, c.hp / (c.maxHp && c.maxHp > 0 ? c.maxHp : max)))
        view.lieTarget = 0
        this.setModelDown(view, false)
        this.flashOn(view, 0x5fe07a, 420)
        break
      case 'gone':
        this.fall(view)
        break
    }
    if (this.reduceMotion) this.settle(view)
    // The sim's state follows once the cues go quiet.
    if (this.pending || this.pendingTurn !== undefined) this.scheduleFlush(750)
    this.apply()
  }

  /** A model's height (a monster's or a pet's own; a hero's look keeps its species height). */
  private heightOf(view: View): number {
    return view.model && view.look.kind !== 'hero' ? view.model.height : view.look.height
  }

  /** An effect on an actor (vfx/recipes.ts), at its feet; nothing with Reduce motion. */
  private spawnFx(view: View, c: SceneCue): void {
    if (!this.fx || this.reduceMotion || view.fade <= 0.01 || !isFxKind(c.fx)) return
    const opts: { height: number; color?: number; shape?: SpriteName; crit?: boolean } = { height: this.heightOf(view) }
    if (c.color !== undefined) opts.color = c.color
    if (c.shape) opts.shape = c.shape as SpriteName
    if (c.crit) opts.crit = true
    this.fx.spawn(c.fx, view.root.position, opts)
  }

  /**
   * A killed actor goes. A monster with a Death clip falls and stays down for a moment before it fades in a puff of
   * smoke (a hero's Downed, a capsule's fade otherwise).
   */
  private fall(view: View): void {
    const a = view.model?.animator
    if (!this.reduceMotion && view.look.kind !== 'hero' && a?.has('Death') && view.dyingMs <= 0 && view.fade > 0.01) {
      a.play('Death', { hold: true })
      view.dyingMs = a.durationOf('Death') * 1000 + DEATH_REST_MS
      view.hopT = 0
      return
    }
    if (view.fadeTarget > 0 && view.look.kind !== 'hero') this.puff(view)
    view.fadeTarget = 0
    view.mat.transparent = true
    view.mat.needsUpdate = true
  }

  private puff(view: View): void {
    if (!this.fx || this.reduceMotion) return
    this.fx.spawn('death', view.root.position, { height: this.heightOf(view) })
  }

  /** A monster that runs: its Flee (or Move) away from the party, out of the room, fading as it goes. */
  private flee(view: View): void {
    if (this.reduceMotion || view.fleeing) {
      view.fadeTarget = 0
      view.mat.transparent = true
      view.mat.needsUpdate = true
      return
    }
    view.fleeing = true
    const away = new THREE.Vector3(view.pos.x - this.centre.x, 0, view.pos.z - this.centre.z)
    if (away.lengthSq() < 1e-4) away.set(Math.sin(view.yaw + Math.PI), 0, Math.cos(view.yaw + Math.PI))
    away.normalize()
    view.target.copy(view.pos).addScaledVector(away, 3.2)
    view.yaw = Math.atan2(away.x, away.z)
    const a = view.model?.animator
    if (a?.has('Flee')) a.loopClip('Flee')
    view.dyingMs = 900
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
        // A model walks (or, a long way, runs) at its clip's pace; capsules glide; a fleeing monster runs.
        if (view.model && !view.moving && !view.modelDown && !view.fleeing && view.dyingMs <= 0) {
          view.moving = true
          view.gait = d > RUN_OVER_M ? 'Run' : 'Walk'
          this.gaitOn(view)
        }
        const speed = view.fleeing ? RUN_MPS : view.model && view.moving ? (view.gait === 'Run' ? RUN_MPS : WALK_MPS) : 4.2
        const step = Math.min(d, (dt / 1000) * speed)
        view.pos.lerp(view.target, step / d)
        busy = true
      } else if (view.moving) {
        view.moving = false
        view.model?.animator.setBase('Idle')
      }
      // A fallen monster lies still, then fades; a fleeing one fades once out of the light.
      if (view.dyingMs > 0) {
        view.dyingMs -= dt
        busy = true
        if (view.dyingMs <= 0) {
          view.dyingMs = 0
          if (!view.fleeing) this.puff(view)
          view.fadeTarget = 0
          view.mat.transparent = true
          view.mat.needsUpdate = true
        }
      }
      // A tell's shape (the Bursting Corpse's belly) swells over its wind-up and throbs while it holds; it goes with the blow.
      const tellTo = view.state.tell && !view.state.gone ? 1 : 0
      const throb = 0.97 + 0.03 * Math.sin(time * 0.009)
      if (view.tell !== tellTo) {
        view.tell = tellTo > view.tell ? Math.min(tellTo, view.tell + dt / TELL_RISE_MS) : Math.max(tellTo, view.tell - dt / TELL_FALL_MS)
        busy = true
        view.model?.setTell?.(view.tell >= 1 ? throb : view.tell)
      } else if (view.tell >= 1) view.model?.setTell?.(throb)
      view.model?.update(dt)
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
    if (view.model) {
      this.poseModel(view, view.model)
      return
    }
    const shake = view.shakeT > 0 ? Math.sin(view.shakeT * 40) * 0.09 * view.shakeT : 0
    const dodge = view.dodgeT > 0 ? Math.sin(view.dodgeT * Math.PI) * 0.45 : 0
    const hop = view.hopT > 0 ? Math.sin(view.hopT * Math.PI) * 0.18 : 0
    root.position.set(view.pos.x, view.pos.y + hop, view.pos.z)
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

  /** A model: moved like the capsule; it lies down by its Downed (or Death) clip, or tips over without clips. */
  private poseModel(view: View, model: ActorModel): void {
    const { root, pose } = view
    const shake = view.shakeT > 0 ? Math.sin(view.shakeT * 40) * 0.05 * view.shakeT : 0
    const dodge = view.dodgeT > 0 && !model.animator.has('Dodge') ? Math.sin(view.dodgeT * Math.PI) * 0.45 : 0
    const hop = view.hopT > 0 ? Math.sin(view.hopT * Math.PI) * 0.12 : 0
    root.position.set(view.pos.x, view.pos.y + hop, view.pos.z)
    const c = Math.cos(root.rotation.y)
    const s = Math.sin(root.rotation.y)
    root.position.x += (shake + dodge) * c
    root.position.z -= (shake + dodge) * s
    if (model.animator.hasClips()) {
      pose.rotation.set(0, 0, 0)
      pose.position.set(0, 0, 0)
    } else {
      pose.rotation.set(-(Math.PI / 2) * view.lie, 0, 0)
      pose.position.set(0, view.look.radius * view.lie, 0)
    }
    model.setTint(sTint.copy(WHITE).lerp(view.state.dead ? DEAD_TINT : DOWN_TINT, view.lie * 0.8))
    model.setFlash(view.flashT > 0 ? view.flash : null, view.flashT * 1.2)
    model.setOpacity(view.fade)
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
        m.compose(p.set(view.root.position.x, view.pos.y + 0.02, view.root.position.z), sQ.setFromAxisAngle(UP, view.root.rotation.y), scale.set(sx * view.fade, 1, sz * view.fade))
        if (look.shape === 'biped' && lying > 0) {
          // The body lies behind the feet.
          const back = sBack.set(0, 0, -look.height * 0.45 * lying).applyAxisAngle(UP, view.root.rotation.y)
          m.setPosition(view.root.position.x + back.x, 0.02, view.root.position.z + back.z)
        }
      } else m.copy(ZERO)
      this.shadows.setMatrixAt(i, m)
      // HP bar.
      const barVisible = visible && this.showBars && !view.leaving && !view.state.body && view.dyingMs <= 0 && !view.fleeing
      if (barVisible) {
        const h = this.heightOf(view)
        const standTop = look.shape === 'biped' ? h : h + 0.1
        const top = standTop * (1 - lying) + (look.radius * 2 + 0.1) * lying
        const w = Math.max(0.7, Math.min(1.3, look.radius * 3.4)) * BAR_W
        p.set(view.root.position.x, view.pos.y + top + 0.42, view.root.position.z)
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
      this.ring.position.set(ringView.root.position.x, ringView.pos.y + 0.04, ringView.root.position.z)
      this.ring.scale.setScalar(r * pulse)
      this.ring.visible = true
    } else this.ring.visible = false
    if (arrowView) {
      const top = this.heightOf(arrowView) * (1 - arrowView.lie) + 0.5 * arrowView.lie
      const bob = this.reduceMotion ? 0 : Math.sin(time * 0.008) * 0.08
      this.arrow.position.set(arrowView.root.position.x, arrowView.pos.y + top + (this.showBars ? 0.95 : 0.6) + bob, arrowView.root.position.z)
      this.arrow.visible = true
    } else this.arrow.visible = false
  }

  /** Feet and heads at the marks the actors are heading for (to frame the camera on). */
  points(): THREE.Vector3[] {
    const out: THREE.Vector3[] = []
    for (const view of this.views.values()) {
      if (view.leaving || view.state.gone) continue
      const r = Math.max(view.look.radius, 0.3)
      out.push(new THREE.Vector3(view.target.x - r, view.target.y, view.target.z - r))
      out.push(new THREE.Vector3(view.target.x + r, view.target.y, view.target.z + r))
      out.push(new THREE.Vector3(view.target.x, view.target.y + this.heightOf(view) + (this.showBars ? 0.6 : 0.15), view.target.z))
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
      v.set(view.target.x, this.heightOf(view) + 0.5, view.target.z).project(this.camera)
      out[view.look.id] = { x: Math.round(x), y: Math.round(y), top: Math.round(((1 - v.y) / 2) * height) }
    }
    return out
  }

  /** The middle of everyone on stage (where the camera's framing measures a hero's height), or null. */
  actorsCentre(): THREE.Vector3 | null {
    const c = new THREE.Vector3()
    let n = 0
    for (const view of this.views.values()) {
      if (view.leaving || view.state.gone) continue
      c.add(view.target)
      n++
    }
    return n > 0 ? c.divideScalar(n) : null
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
    this.disposed = true
    if (this.flushTimer !== null) clearTimeout(this.flushTimer)
    for (const view of [...this.views.values()]) this.drop(view)
    for (const o of this.owned) o.dispose()
    this.group.clear()
  }
}

function sameLook(a: ActorLook, b: ActorLook): boolean {
  return a.shape === b.shape && a.height === b.height && a.radius === b.radius && a.body === b.body && a.trim === b.trim && a.face === b.face && a.eyes === b.eyes && (a.model?.key ?? '') === (b.model?.key ?? '')
}
