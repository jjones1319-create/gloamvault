/**
 * The assembler's pure arithmetic (Phase 5), on plain typed arrays so node tests can run it: baking morph targets,
 * dropping the body triangles worn gear covers, remapping skin joints by bone name, rigid parts on a socket, merging
 * everything into one skinned mesh, the species' bone-group scales and the Hips track scaling for the clips. The
 * three.js side (characters/assembler.ts) only reads glTF attributes into these shapes and back.
 */
import type { Grade } from '../../../../sim/src/types/enums.ts'
import { REGION, REGION_NAMES } from './palette.ts'

/** One mesh's data, ready to merge: every per-vertex array has `positions.length / 3` entries (× 4 for skinning). */
export interface PartData {
  name: string
  positions: Float32Array
  normals: Float32Array
  /** Palette slot per vertex (decoded from COLOR_0's R). */
  slots: Uint8Array
  /** Body region per vertex (COLOR_0's G); 0 for everything but the body. */
  regions: Uint8Array
  /** Four joint indices per vertex, into `boneNames` (or, after `remapJoints`, into the character's skeleton). */
  joints: Uint16Array
  weights: Float32Array
  boneNames: readonly string[]
  /** Triangles, three vertex indices each. */
  index: Uint32Array
}

export function vertexCount(part: { positions: Float32Array }): number {
  return Math.floor(part.positions.length / 3)
}

/* ---------- morphs ---------- */

/**
 * Positions with morph targets baked in: base + Σ weight × delta (glTF morph targets are relative). A null or
 * short delta array is skipped; a zero weight costs nothing.
 */
export function bakeMorphs(base: Float32Array, deltas: readonly (ArrayLike<number> | null | undefined)[], weights: readonly number[]): Float32Array {
  const out = new Float32Array(base)
  for (let t = 0; t < deltas.length; t++) {
    const d = deltas[t]
    const w = weights[t] ?? 0
    if (!d || w === 0 || d.length < out.length) continue
    for (let i = 0; i < out.length; i++) out[i] = out[i]! + w * (d[i] ?? 0)
  }
  return out
}

/** Morph weights by target index from a name → weight map (names the mesh does not carry are ignored). */
export function morphWeights(dictionary: Readonly<Record<string, number>> | undefined, wanted: Readonly<Record<string, number>>, count: number): number[] {
  const out = new Array<number>(count).fill(0)
  if (!dictionary) return out
  for (const [name, w] of Object.entries(wanted)) {
    const i = dictionary[name]
    if (i !== undefined && i >= 0 && i < count && Number.isFinite(w)) out[i] = w
  }
  return out
}

/* ---------- hidden regions ---------- */

/**
 * The regions a gear piece or part covers, from its `hides` custom property: an array or a comma/space separated
 * string of region names (`chest`, `upperArms` …) or ids (0–9). Unknown entries are ignored.
 */
export function parseRegions(v: unknown): Set<number> {
  const out = new Set<number>()
  const items: unknown[] = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[\s,;|]+/) : typeof v === 'number' ? [v] : []
  for (const item of items) {
    if (typeof item === 'number' && Number.isInteger(item) && item >= 0 && item < REGION_NAMES.length) out.add(item)
    else if (typeof item === 'string' && item.trim() !== '') {
      const s = item.trim()
      if (/^\d+$/.test(s) && Number(s) < REGION_NAMES.length) out.add(Number(s))
      else {
        const hit = REGION_NAMES.find((r) => r.toLowerCase() === s.toLowerCase())
        if (hit) out.add(REGION[hit])
      }
    }
  }
  return out
}

/** The triangles to keep: a triangle goes only when all three of its vertices sit in hidden regions. */
export function keepTriangles(index: Uint32Array, regions: Uint8Array, hidden: ReadonlySet<number>): Uint32Array {
  if (hidden.size === 0) return index
  const out = new Uint32Array(index.length)
  let n = 0
  for (let t = 0; t + 2 < index.length; t += 3) {
    const a = index[t]!
    const b = index[t + 1]!
    const c = index[t + 2]!
    if (hidden.has(regions[a]!) && hidden.has(regions[b]!) && hidden.has(regions[c]!)) continue
    out[n++] = a
    out[n++] = b
    out[n++] = c
  }
  return out.slice(0, n)
}

/** The part with only the vertices `index` uses (re-indexed), so dropped triangles cost no vertex work either. */
export function compactPart(part: PartData, index: Uint32Array): PartData {
  const count = vertexCount(part)
  const map = new Int32Array(count).fill(-1)
  let n = 0
  for (let i = 0; i < index.length; i++) {
    const v = index[i]!
    if (map[v] === -1) map[v] = n++
  }
  const positions = new Float32Array(n * 3)
  const normals = new Float32Array(n * 3)
  const slots = new Uint8Array(n)
  const regions = new Uint8Array(n)
  const joints = new Uint16Array(n * 4)
  const weights = new Float32Array(n * 4)
  for (let v = 0; v < count; v++) {
    const m = map[v]!
    if (m < 0) continue
    for (let k = 0; k < 3; k++) {
      positions[m * 3 + k] = part.positions[v * 3 + k]!
      normals[m * 3 + k] = part.normals[v * 3 + k] ?? 0
    }
    slots[m] = part.slots[v]!
    regions[m] = part.regions[v]!
    for (let k = 0; k < 4; k++) {
      joints[m * 4 + k] = part.joints[v * 4 + k]!
      weights[m * 4 + k] = part.weights[v * 4 + k]!
    }
  }
  const out = new Uint32Array(index.length)
  for (let i = 0; i < index.length; i++) out[i] = map[index[i]!]!
  return { ...part, positions, normals, slots, regions, joints, weights, index: out }
}

/* ---------- joints ---------- */

/**
 * A bone name as the character's skeleton spells it: three.js's GLTFLoader makes duplicate node names unique with
 * `_1`, `_2` (a gear file with its own copy of the rig), so a name that is not found is retried without that suffix.
 */
export function resolveBone(name: string, dst: ReadonlyMap<string, number>): number | undefined {
  const exact = dst.get(name)
  if (exact !== undefined) return exact
  const m = /^(.*)_\d+$/.exec(name)
  return m ? dst.get(m[1]!) : undefined
}

/**
 * Skin joints re-pointed from a source skeleton (`srcNames`, the order of its bones) to the character's skeleton by
 * bone name. An influence on a bone the character does not have moves to `fallback` (the Hips).
 */
export function remapJoints(joints: Uint16Array, srcNames: readonly string[], dst: ReadonlyMap<string, number>, fallback: number): Uint16Array {
  const table = srcNames.map((n) => resolveBone(n, dst) ?? fallback)
  const out = new Uint16Array(joints.length)
  for (let i = 0; i < joints.length; i++) out[i] = table[joints[i]!] ?? fallback
  return out
}

/** A rigid mesh (a weapon) as a part skinned 100% to one bone, its vertices moved by `m` (column-major 4×4). */
export function rigidPart(name: string, positions: Float32Array, normals: Float32Array | null, slots: Uint8Array, index: Uint32Array, m: ArrayLike<number>, bone: number): PartData {
  const n = vertexCount({ positions })
  const p = new Float32Array(n * 3)
  const q = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3]!
    const y = positions[i * 3 + 1]!
    const z = positions[i * 3 + 2]!
    p[i * 3] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!
    p[i * 3 + 1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!
    p[i * 3 + 2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!
    if (normals) {
      const a = normals[i * 3]!
      const b = normals[i * 3 + 1]!
      const c = normals[i * 3 + 2]!
      // Rotation and uniform scale only: the upper 3×3 then renormalise.
      const nx = m[0]! * a + m[4]! * b + m[8]! * c
      const ny = m[1]! * a + m[5]! * b + m[9]! * c
      const nz = m[2]! * a + m[6]! * b + m[10]! * c
      const len = Math.hypot(nx, ny, nz) || 1
      q[i * 3] = nx / len
      q[i * 3 + 1] = ny / len
      q[i * 3 + 2] = nz / len
    } else q[i * 3 + 1] = 1
  }
  const joints = new Uint16Array(n * 4)
  const weights = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    joints[i * 4] = bone
    weights[i * 4] = 1
  }
  return { name, positions: p, normals: q, slots, regions: new Uint8Array(n), joints, weights, boneNames: [], index }
}

/* ---------- merge ---------- */

export interface MergedData {
  positions: Float32Array
  normals: Float32Array
  slots: Uint8Array
  joints: Uint8Array | Uint16Array
  weights: Float32Array
  index: Uint16Array | Uint32Array
  vertexCount: number
  triangleCount: number
}

/**
 * Parts whose joints already index the character's skeleton, concatenated into one mesh. Weights are renormalised
 * to sum to 1 (a part exported with 3 influences, or rounding, never shrinks a vertex toward the origin).
 */
export function mergeParts(parts: readonly PartData[], boneCount: number): MergedData {
  let verts = 0
  let idx = 0
  for (const p of parts) {
    verts += vertexCount(p)
    idx += p.index.length
  }
  const positions = new Float32Array(verts * 3)
  const normals = new Float32Array(verts * 3)
  const slots = new Uint8Array(verts)
  const joints = boneCount <= 256 ? new Uint8Array(verts * 4) : new Uint16Array(verts * 4)
  const weights = new Float32Array(verts * 4)
  const index = verts <= 65535 ? new Uint16Array(idx) : new Uint32Array(idx)
  let vo = 0
  let io = 0
  for (const p of parts) {
    const n = vertexCount(p)
    positions.set(p.positions.subarray(0, n * 3), vo * 3)
    normals.set(p.normals.subarray(0, n * 3), vo * 3)
    slots.set(p.slots.subarray(0, n), vo)
    for (let v = 0; v < n; v++) {
      let sum = 0
      for (let k = 0; k < 4; k++) sum += Math.max(0, p.weights[v * 4 + k] ?? 0)
      for (let k = 0; k < 4; k++) {
        const j = p.joints[v * 4 + k] ?? 0
        joints[(vo + v) * 4 + k] = j < boneCount ? j : 0
        weights[(vo + v) * 4 + k] = sum > 0 ? Math.max(0, p.weights[v * 4 + k] ?? 0) / sum : k === 0 ? 1 : 0
      }
    }
    for (let i = 0; i < p.index.length; i++) index[io + i] = p.index[i]! + vo
    vo += n
    io += p.index.length
  }
  return { positions, normals, slots, joints, weights, index, vertexCount: verts, triangleCount: idx / 3 }
}

/* ---------- gear tiers ---------- */

/** Grades F–C wear the crude (F) meshes, B and above the fine (S) ones; the grade itself colours the trim. */
export function tierForGrade(grade: Grade | string | null | undefined): 'F' | 'S' {
  return grade === 'B' || grade === 'A' || grade === 'S' || grade === 'SS' || grade === 'God' ? 'S' : 'F'
}

/* ---------- species bone scales ---------- */

/**
 * The group a bone's scale comes from, and whether it takes its parent's absolute scale instead (tools/blender/README:
 * the eyes and the chain bones — tail, ears, beard, hair — inherit; every other body bone is `root` × its group's
 * factor, 1 when the species gives none).
 */
export function boneGroup(name: string): { group: string | null; inherit: boolean } {
  if (/^(Left|Right)(Thumb|Index|Middle|Ring|Little)(Proximal|Intermediate|Distal)$/.test(name)) return { group: 'fingers', inherit: false }
  if (/^(Left|Right)Toes$/.test(name)) return { group: 'toes', inherit: false }
  const limb = /^(?:Left|Right)(Shoulder|UpperArm|LowerArm|Hand|UpperLeg|LowerLeg|Foot)$/.exec(name)
  if (limb) return { group: limb[1]!.charAt(0).toLowerCase() + limb[1]!.slice(1), inherit: false }
  if (name === 'Chest') return { group: 'chest', inherit: false }
  if (name === 'UpperChest') return { group: 'upperChest', inherit: false }
  if (name === 'Neck') return { group: 'neck', inherit: false }
  if (name === 'Head') return { group: 'head', inherit: false }
  if (/^(Left|Right)Eye$|^(Tail|Ear|Beard|Hair)_/.test(name)) return { group: null, inherit: true }
  // Hips, Spine and any other body bone without a group: 1 × root.
  return { group: null, inherit: false }
}

const SCALE_MIN = 0.5
const SCALE_MAX = 2

/**
 * Each bone's local scale so its *world* scale is root × its own group's factor — absolute, not compounded down the
 * chain (tools/blender/README.md; 05 §3: an Orc's hands 1.12 × 1.15 = 1.29): `own(bone) / own(parent)`. A Dwarf's
 * lower leg is 0.85 like its thigh, not 0.85². `root` is not a bone: it scales the whole character.
 */
export function localBoneScales(bones: readonly { name: string; parent: string | null }[], scales: Readonly<Record<string, number>>): Map<string, number> {
  const byName = new Map(bones.map((b) => [b.name, b]))
  const own = new Map<string, number>()
  const ownOf = (name: string, depth = 0): number => {
    const known = own.get(name)
    if (known !== undefined) return known
    const b = byName.get(name)
    const { group, inherit } = boneGroup(name)
    const factor = group !== null ? scales[group] : undefined
    let v: number
    if (factor !== undefined && Number.isFinite(factor)) v = Math.min(SCALE_MAX, Math.max(SCALE_MIN, factor))
    else if (inherit && b?.parent && depth < 80) v = ownOf(b.parent, depth + 1)
    else v = 1
    own.set(name, v)
    return v
  }
  const out = new Map<string, number>()
  for (const b of bones) {
    const parentOwn = b.parent && byName.has(b.parent) ? ownOf(b.parent) : 1
    out.set(b.name, ownOf(b.name) / parentOwn)
  }
  return out
}

/** The species' uniform scale (`root`), clamped. */
export function rootScale(scales: Readonly<Record<string, number>>): number {
  const r = scales.root
  return r !== undefined && Number.isFinite(r) ? Math.min(SCALE_MAX, Math.max(SCALE_MIN, r)) : 1
}

/* ---------- clips ---------- */

/** Which clip tracks a character keeps: bone rotations, and the Hips position (05 §5: rotations only plus Hips.loc). */
export function keepTrack(trackName: string, bones: ReadonlySet<string>): boolean {
  const dot = trackName.lastIndexOf('.')
  if (dot <= 0) return false
  const node = trackName.slice(0, dot)
  const prop = trackName.slice(dot + 1)
  if (!bones.has(node)) return false
  return prop === 'quaternion' || (prop === 'position' && node === 'Hips')
}

/**
 * The Hips position track for a character whose legs differ from the rig the clips were authored on: each key keeps
 * its offset from the authoring rest, scaled by the leg ratio `k`, around this character's own rest — so feet stay
 * planted and strides scale with the legs.
 */
export function scaleHipsTrack(values: ArrayLike<number>, srcRest: readonly number[], dstRest: readonly number[], k: number): Float32Array {
  const out = new Float32Array(values.length)
  for (let i = 0; i + 2 < values.length; i += 3) {
    for (let c = 0; c < 3; c++) out[i + c] = (dstRest[c] ?? 0) + ((values[i + c] ?? 0) - (srcRest[c] ?? 0)) * k
  }
  return out
}
