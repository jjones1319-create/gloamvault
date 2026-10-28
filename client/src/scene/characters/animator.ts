import * as THREE from 'three'
import { keepTrack, scaleHipsTrack } from './geometry.ts'
import type { ClipInfo } from './manifest.ts'

/**
 * Animation (Phase 5; 11 §3): one AnimationMixer per character on the shared clips of hero_clips.glb, bound by bone
 * name. Each clip keeps only bone rotations and the Hips position; the Hips track is rescaled per character by its
 * leg length (frame × species) so feet stay planted. A base loop (Idle, Walk, Run) runs under one-shot clips
 * (attacks, hits, casts) that crossfade in and back out; Downed and Defeat hold their last frame. Without the clips
 * file, a small procedural breathing idle keeps the hero from standing frozen.
 */

export const BASE_CLIPS = ['Idle', 'Walk', 'Run'] as const
export type BaseClip = (typeof BASE_CLIPS)[number]
/** Clips that end on the floor and stay there until something else plays. */
const HOLD_CLIPS = new Set(['Downed', 'Defeat', 'SitRest'])
const FADE_S = 0.18

/** The shared clips: tracks filtered once, per-leg-length copies of the Hips track made on demand. */
export class ClipLibrary {
  readonly base = new Map<string, THREE.AnimationClip>()
  readonly info: Map<string, ClipInfo>
  /** The authoring rig's Hips rest position (the broad frame). */
  readonly srcHips: THREE.Vector3
  private readonly scaled = new Map<string, Map<string, THREE.AnimationClip>>()

  constructor(clips: readonly THREE.AnimationClip[], info: Map<string, ClipInfo>, srcHips: THREE.Vector3, bones: ReadonlySet<string>) {
    this.info = info
    this.srcHips = srcHips
    for (const clip of clips) {
      const tracks = clip.tracks.filter((t) => keepTrack(t.name, bones))
      if (tracks.length === 0) continue
      this.base.set(clip.name, new THREE.AnimationClip(clip.name, clip.duration, tracks))
    }
  }

  names(): string[] {
    return [...this.base.keys()]
  }

  /** The clips for a character whose Hips rest is `rest` and whose legs are `k` × the authoring rig's. */
  clipsFor(rest: THREE.Vector3, k: number): Map<string, THREE.AnimationClip> {
    const key = `${rest.x.toFixed(3)},${rest.y.toFixed(3)},${rest.z.toFixed(3)},${k.toFixed(3)}`
    let set = this.scaled.get(key)
    if (set) return set
    set = new Map()
    const src = [this.srcHips.x, this.srcHips.y, this.srcHips.z]
    const dst = [rest.x, rest.y, rest.z]
    for (const [name, clip] of this.base) {
      const tracks = clip.tracks.map((t) => (t.name === 'Hips.position' ? new THREE.VectorKeyframeTrack('Hips.position', Array.from(t.times), Array.from(scaleHipsTrack(t.values, src, dst, k))) : t))
      set.set(name, new THREE.AnimationClip(name, clip.duration, tracks))
    }
    this.scaled.set(key, set)
    return set
  }
}

export interface PlayOptions {
  /** Start this many seconds in (an attack starts just before its hit frame so the blow lands with the beat). */
  offset?: number
  timeScale?: number
  /** Stay on the last frame (Downed, Defeat); otherwise fade back to the base loop. */
  hold?: boolean
}

export class CharacterAnimator {
  readonly mixer: THREE.AnimationMixer | null
  private readonly clips: Map<string, THREE.AnimationClip>
  private readonly info: Map<string, ClipInfo>
  private readonly actions = new Map<string, THREE.AnimationAction>()
  private baseName: string = 'Idle'
  private base: THREE.AnimationAction | null = null
  private oneShot: THREE.AnimationAction | null = null
  private holding = false
  private readonly onFinished: (e: { action: THREE.AnimationAction }) => void
  /** Procedural idle (no clips): rest rotations of the bones it moves. */
  private readonly breath: { bone: THREE.Bone; rest: THREE.Quaternion; axis: THREE.Vector3; amp: number; phase: number }[] = []
  private readonly hips: THREE.Bone | null
  private readonly hipsRest: THREE.Vector3
  private t = Math.random() * 10
  private readonly scratch = new THREE.Quaternion()
  /** The left hand's fist (tools/blender/README.md: fingers 72 · 95 · 55°, thumb 25 · 40 · 35° about +X). */
  private readonly fist: { bone: THREE.Bone; q: THREE.Quaternion }[] = []
  private pinFist = false

  constructor(root: THREE.Object3D, bones: ReadonlyMap<string, THREE.Bone>, library: ClipLibrary | null, hips: { rest: THREE.Vector3; k: number }) {
    this.hips = bones.get('Hips') ?? null
    this.hipsRest = hips.rest.clone()
    this.info = library?.info ?? new Map()
    this.clips = library ? library.clipsFor(hips.rest, hips.k) : new Map()
    this.mixer = this.clips.size > 0 ? new THREE.AnimationMixer(root) : null
    this.onFinished = (e) => this.finished(e.action)
    this.mixer?.addEventListener('finished', this.onFinished as never)
    if (!this.mixer) {
      for (const [name, amp, phase] of [
        ['Spine', 0.018, 0],
        ['Chest', 0.022, 0.3],
        ['UpperChest', 0.016, 0.6],
        ['Neck', -0.02, 0.9],
      ] as const) {
        const bone = bones.get(name)
        if (bone) this.breath.push({ bone, rest: bone.quaternion.clone(), axis: new THREE.Vector3(1, 0, 0), amp, phase })
      }
    }
    const curl: Record<string, number> = { Proximal: 72, Intermediate: 95, Distal: 55 }
    const thumb: Record<string, number> = { Proximal: 25, Intermediate: 40, Distal: 35 }
    for (const finger of ['Thumb', 'Index', 'Middle', 'Ring', 'Little']) {
      for (const joint of ['Proximal', 'Intermediate', 'Distal']) {
        const bone = bones.get(`Left${finger}${joint}`)
        const deg = (finger === 'Thumb' ? thumb : curl)[joint] ?? 0
        if (bone) this.fist.push({ bone, q: bone.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(deg))) })
      }
    }
    this.setBase('Idle', true)
  }

  /** The clip's length in seconds (0 when there is no such clip). */
  durationOf(name: string): number {
    return this.clips.get(name)?.duration ?? 0
  }

  /**
   * Stops on one frame of a clip (the acceptance matrix: every hero at the same instant): `seconds` into it, held,
   * at full weight with nothing blended in. False when there is no such clip.
   */
  freeze(name: string, seconds: number): boolean {
    if (!this.mixer) return false
    const a = this.action(name)
    if (!a) return false
    this.mixer.stopAllAction()
    this.oneShot = null
    this.holding = false
    a.reset()
    a.setLoop(THREE.LoopRepeat, Infinity)
    a.setEffectiveWeight(1)
    a.play()
    a.time = Math.max(0, Math.min(seconds, a.getClip().duration))
    a.paused = true
    this.base = a
    this.baseName = name
    this.mixer.update(0)
    if (this.pinFist) this.applyFist()
    return true
  }

  /** Holds the left fingers in a fist whatever the clip does (an off-hand item is equipped). */
  setLeftFist(on: boolean): void {
    this.pinFist = on
    if (on) this.applyFist()
  }

  private applyFist(): void {
    for (const f of this.fist) f.bone.quaternion.copy(f.q)
  }

  hasClips(): boolean {
    return this.mixer !== null
  }

  has(name: string): boolean {
    return this.clips.has(name)
  }

  names(): string[] {
    return [...this.clips.keys()]
  }

  /** Seconds from a clip's start to one of its events (clips.json), or null. */
  eventTime(clip: string, event: string): number | null {
    const t = this.info.get(clip)?.events[event]
    return typeof t === 'number' ? t : null
  }

  /** A locomotion loop's ground speed on the authoring rig (clips.json `speed`, m/s), or null. */
  speedOf(clip: string): number | null {
    return this.info.get(clip)?.speed ?? null
  }

  /** The current base loop's name. */
  baseClip(): string {
    return this.baseName
  }

  /** Plays the base loop faster or slower (a walk matched to how fast the hero actually moves). */
  setBaseTimeScale(k: number): void {
    if (this.base) this.base.timeScale = Math.max(0.1, Math.min(4, k))
  }

  private action(name: string): THREE.AnimationAction | null {
    if (!this.mixer) return null
    let a = this.actions.get(name)
    if (!a) {
      const clip = this.clips.get(name)
      if (!clip) return null
      a = this.mixer.clipAction(clip)
      this.actions.set(name, a)
    }
    return a
  }

  /** The loop under everything (Idle, Walk, Run); a missing Walk or Run falls back to the nearest one there is. */
  setBase(name: BaseClip, instant = false): void {
    if (!this.mixer) return
    const pick = this.clips.has(name) ? name : name === 'Run' && this.clips.has('Walk') ? 'Walk' : this.clips.has('Idle') ? 'Idle' : null
    if (!pick) return
    if (this.base && this.baseName === pick) return
    const next = this.action(pick)
    if (!next) return
    const prev = this.base
    next.reset()
    next.setLoop(THREE.LoopRepeat, Infinity)
    next.clampWhenFinished = false
    if (this.oneShot) {
      // A one-shot is on top: the new base waits under it at no weight and fades in when the one-shot ends.
      next.setEffectiveWeight(0).play()
      prev?.stop()
    } else if (prev && !instant) {
      next.setEffectiveWeight(1).play()
      prev.crossFadeTo(next, FADE_S, false)
    } else {
      prev?.stop()
      next.setEffectiveWeight(1).play()
    }
    // Heroes standing together should not breathe in step.
    if (instant) next.time = Math.random() * (next.getClip().duration || 1)
    this.base = next
    this.baseName = pick
  }

  /** Loops any clip as the base (the viewer: a one-shot replays so it can be watched). False when there is none. */
  loopClip(name: string): boolean {
    if (!this.mixer) return false
    const next = this.action(name)
    if (!next) return false
    if (this.oneShot && this.oneShot !== next) this.oneShot.stop()
    this.oneShot = null
    this.holding = false
    const prev = this.base
    next.reset()
    next.setLoop(THREE.LoopRepeat, Infinity)
    next.clampWhenFinished = false
    next.setEffectiveWeight(1).play()
    if (prev && prev !== next) prev.crossFadeTo(next, FADE_S, false)
    this.base = next
    this.baseName = name
    return true
  }

  /** Plays a clip once over the base (or holds it). False when there is no such clip. */
  play(name: string, opts: PlayOptions = {}): boolean {
    const a = this.action(name)
    if (!a) return false
    const hold = opts.hold ?? HOLD_CLIPS.has(name)
    if (this.oneShot && this.oneShot !== a) this.oneShot.fadeOut(FADE_S)
    a.reset()
    a.setLoop(THREE.LoopOnce, 1)
    a.clampWhenFinished = true
    a.timeScale = opts.timeScale ?? 1
    a.time = Math.max(0, Math.min(opts.offset ?? 0, a.getClip().duration - 0.05))
    a.setEffectiveWeight(1)
    a.fadeIn(FADE_S).play()
    if (this.base && this.base !== a) this.base.fadeOut(FADE_S)
    this.oneShot = a
    this.holding = hold
    return true
  }

  /** Lets go of a held clip (a revive): back to the base loop. */
  release(): void {
    if (!this.oneShot) return
    this.holding = false
    this.backToBase(this.oneShot)
  }

  isHolding(): boolean {
    return this.holding && this.oneShot !== null
  }

  private finished(action: THREE.AnimationAction): void {
    if (action !== this.oneShot) return
    if (this.holding) return
    this.backToBase(action)
  }

  private backToBase(from: THREE.AnimationAction): void {
    const base = this.base
    if (base && base !== from) {
      base.enabled = true
      base.play()
      base.setEffectiveWeight(1)
      base.fadeIn(FADE_S)
    }
    from.fadeOut(FADE_S)
    this.oneShot = null
    this.holding = false
  }

  update(dt: number): void {
    if (this.mixer) {
      this.mixer.update(dt)
      if (this.pinFist) this.applyFist()
      return
    }
    // Breathing: a slow rise and fall through the spine, a few millimetres at the hips.
    this.t += dt
    const s = Math.sin(this.t * 1.9)
    for (const b of this.breath) {
      this.scratch.setFromAxisAngle(b.axis, b.amp * Math.sin(this.t * 1.9 + b.phase))
      b.bone.quaternion.copy(b.rest).multiply(this.scratch)
    }
    if (this.hips) this.hips.position.set(this.hipsRest.x, this.hipsRest.y + s * 0.004, this.hipsRest.z)
    if (this.pinFist) this.applyFist()
  }

  dispose(): void {
    if (!this.mixer) return
    this.mixer.removeEventListener('finished', this.onFinished as never)
    this.mixer.stopAllAction()
    for (const clip of this.clips.values()) this.mixer.uncacheClip(clip)
    this.actions.clear()
  }
}
