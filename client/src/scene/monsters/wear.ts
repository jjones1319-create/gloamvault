import * as THREE from 'three'
import { intoSkeleton, readPart } from '../characters/assembler.ts'
import type { FrameTemplate } from '../characters/template.ts'

/**
 * What a monster wears on its own bones and what it swells when it winds up (Phase 7, pass C2; the monster passes'
 * notes in `models/monsters/manifest.json`):
 *
 * - **Attachments.** Sister Naesa's Ascension (06 §3.3: "her arms become tentacles") wears the tentacle base's
 *   `naesa-arm` on her upper arms in place of the costume pass's built-in tentacle sleeves. The arm's manifest entry
 *   says how (`attach`: the sockets, the root and tip bones): its rig root at the bone's head, its +Y (the chain) turned
 *   onto the bone's line by the shortest turn — as `build_tentacle.py` rendered `naesa_attach.png` — at 0.6 × the
 *   wearer; the arm keeps its own rig and plays the tentacle clips on it. Which boss wears which arm is this table's
 *   (the manifest names the arm's sockets, not its wearer).
 * - **Tell shapes.** The Bursting Corpse's swell (06 §3.2: "it swells for one turn first"; the manifest's note: raise
 *   `var_belly` 1.0 → 1.35 over the tell): the shape key's extra as a live morph target on the merged mesh, its weight
 *   0 → 1 while the Burst is wound up (room/actors.ts eases it).
 */

/** A boss phase that wears another variant on its bones. */
export interface Attachment {
  /** The worn variant's id in the manifest. */
  variant: string
  /** The wearer's meshes it replaces (the costume's built-in arms). */
  replaces: readonly string[]
  /** The first phase it is worn in (1-based). */
  fromPhase: number
}

export const ATTACHMENTS: Readonly<Record<string, Attachment>> = {
  'sister-naesa': { variant: 'naesa-arm', replaces: ['humanoid_naesa2_tentacle_L', 'humanoid_naesa2_tentacle_R'], fromPhase: 2 },
}

/** The attachment a variant wears at its phase, or null. */
export function attachmentFor(id: string, phase: number): Attachment | null {
  const a = ATTACHMENTS[id]
  return a && phase >= a.fromPhase ? a : null
}

/** A worn variant's `attach` block: the wearer's bones it goes on (`LeftUpperArm`, `RightUpperArm`), its root and tip. */
export interface AttachSpec {
  sockets: string[]
  rootBone: string | null
  tipBone: string | null
}

/** `attach: { sockets: [...], rootBone, tipBone }` read tolerantly; null without sockets. */
export function readAttach(raw: Readonly<Record<string, unknown>> | null | undefined): AttachSpec | null {
  const a = raw?.attach
  if (typeof a !== 'object' || a === null || Array.isArray(a)) return null
  const o = a as Record<string, unknown>
  const sockets = Array.isArray(o.sockets) ? o.sockets.filter((s): s is string => typeof s === 'string' && s.length > 0) : []
  if (sockets.length === 0) return null
  return { sockets, rootBone: typeof o.rootBone === 'string' ? o.rootBone : null, tipBone: typeof o.tipBone === 'string' ? o.tipBone : null }
}

const UP = new THREE.Vector3(0, 1, 0)

/**
 * Where a worn rig's root goes under a wearer's bone (call with the skeleton at rest and its world matrices current):
 * at the bone's head, turned so the worn rig's +Y runs from the bone's head toward its child's (the shortest turn in
 * the wearer's space), scaled so the worn rig's world scale is the wearer's. Null for a bone with no child bone.
 */
export function attachTransform(bone: THREE.Object3D, wearerScale: number): { quaternion: THREE.Quaternion; scale: number } | null {
  const child = bone.children.find((c) => (c as THREE.Bone).isBone)
  if (!child) return null
  const head = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld)
  const tail = new THREE.Vector3().setFromMatrixPosition(child.matrixWorld)
  const dir = tail.sub(head)
  if (dir.lengthSq() < 1e-10) return null
  dir.normalize()
  const world = new THREE.Quaternion().setFromUnitVectors(UP, dir)
  const boneWorld = bone.getWorldQuaternion(new THREE.Quaternion())
  const quaternion = boneWorld.invert().multiply(world)
  const boneScale = new THREE.Vector3().setFromMatrixScale(bone.matrixWorld).x
  return { quaternion, scale: boneScale > 1e-6 ? wearerScale / boneScale : 1 }
}

/** A tell's shape key and the weight it swells to (from 1, the variant's own). */
export interface TellShape {
  key: string
  to: number
}

export const TELL_SHAPES: Readonly<Record<string, TellShape>> = {
  'bursting-corpse': { key: 'var_belly', to: 1.35 },
}

/**
 * The tell's extra for a hero-rig monster's merged mesh: each mesh read with the key at `to` less read at its own
 * weight, carried into the skeleton the way the assembler carries it, end to end in the merge's order. Null when the
 * key moves nothing.
 */
export function tellDelta(meshes: readonly THREE.Mesh[], tpl: FrameTemplate, shapes: Readonly<Record<string, number>>, tell: TellShape): Float32Array | null {
  const boneIndex = new Map(tpl.boneNames.map((n, i) => [n, i]))
  const parts: Float32Array[] = []
  let total = 0
  let moved = false
  for (const mesh of meshes) {
    const lo = intoSkeleton(readPart(mesh, shapes), mesh, tpl, boneIndex).positions
    const hi = intoSkeleton(readPart(mesh, { ...shapes, [tell.key]: tell.to }), mesh, tpl, boneIndex).positions
    const d = new Float32Array(lo.length)
    for (let i = 0; i < d.length; i++) {
      d[i] = (hi[i] ?? 0) - (lo[i] ?? 0)
      if (Math.abs(d[i]!) > 1e-6) moved = true
    }
    parts.push(d)
    total += d.length
  }
  if (!moved) return null
  const out = new Float32Array(total)
  let at = 0
  for (const d of parts) {
    out.set(d, at)
    at += d.length
  }
  return out
}
