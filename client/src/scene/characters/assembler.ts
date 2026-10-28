import * as THREE from 'three'
import type { Content } from '../../../../sim/src/content.ts'
import { CharacterAnimator, type ClipLibrary } from './animator.ts'
import type { FrameTemplate } from './template.ts'
import { bakeMorphs, compactPart, keepTriangles, localBoneScales, mergeParts, morphWeights, parseRegions, remapJoints, rigidPart, rootScale, vertexCount, type PartData } from './geometry.ts'
import type { HeroManifest } from './manifest.ts'
import { createCharacterMaterials, SLOT_ATTRIBUTE, type CharacterMaterials } from './material.ts'
import { paletteFor, specKey, type CharacterSpec, type OutfitPiece, type OutfitWeapon } from './outfit.ts'
import { regionOf, slotOf } from './palette.ts'

/**
 * The assembler (Phase 5; tools/blender/README.md is the contract): one hero = ONE merged SkinnedMesh on a cloned
 * skeleton plus its outline, so two draw calls. Into the merge go: the body with the species key at 1.0 and the face
 * preset's weights baked into the positions (the morph data is then dropped, so morphs cost nothing per frame), minus
 * the triangles whose three vertices sit in regions the worn gear covers; the species' and the preset's parts; the
 * gear pieces (the item's class set, tier F for grades F–C and S from B up); the weapons, rigid on their socket's bone
 * at world size (× 1 / the hand's world scale). Joints are remapped to the character's skeleton by bone name; the
 * species' bone-group scales go on the cloned bones, the uniform `root` scale on the character, and the Hips drop so
 * the soles stay on the floor.
 */

export interface AssemblyInputs {
  template: FrameTemplate
  /** Gear meshes by set (class id) for this frame. */
  gear: ReadonlyMap<string, ReadonlyMap<string, THREE.Mesh>>
  weapons: ReadonlyMap<string, THREE.Mesh> | null
  manifest: HeroManifest | null
  clips: ClipLibrary | null
}

/** Weapon meshes to try, in order, when a type has no mesh of its own yet. */
const WEAPON_FALLBACK: Readonly<Record<string, readonly string[]>> = {
  greataxe: ['greataxe', 'axe'],
  greatsword: ['greatsword', 'sword'],
  maul: ['maul', 'mace'],
  censer: ['censer', 'mace'],
  longbow: ['longbow', 'bow', 'shortbow'],
  shortbow: ['shortbow', 'bow', 'longbow'],
  bow: ['bow', 'shortbow', 'longbow'],
  crossbow: ['crossbow', 'bow', 'shortbow'],
  throwingKnife: ['throwingKnife', 'dagger'],
  staff: ['staff', 'wand'],
  wand: ['wand', 'staff'],
  focus: ['focus', 'orb', 'tome'],
}
const BOW_TYPES = new Set(['bow', 'shortbow', 'longbow', 'crossbow'])
/** Parts a helmet covers by name (see hiddenByHelmet). */
const UNDER_HELMET = /^hair_|^spc_orc_topknot|^spc_draconid_(horns|crest)|^spc_(elf|orc)_ears|_curls$/

const IDENTITY = new THREE.Matrix4()

export class CharacterModel {
  readonly root = new THREE.Group()
  readonly mesh: THREE.SkinnedMesh
  readonly outline: THREE.SkinnedMesh
  readonly skeleton: THREE.Skeleton
  readonly bones: ReadonlyMap<string, THREE.Bone>
  readonly animator: CharacterAnimator
  readonly materials: CharacterMaterials
  readonly triangles: number
  /** Standing height in metres (for bars and framing). */
  readonly height: number
  /** Leg length against the rig the clips were authored on (× the species' scale): walk cycles are paced by it. */
  readonly stride: number
  /** A shield is in the off hand (its bearer guards with `Guard_Shield` when the clips have it). */
  readonly hasShield: boolean
  readonly key: string
  private disposed = false

  constructor(parts: {
    rig: THREE.Object3D
    mesh: THREE.SkinnedMesh
    outline: THREE.SkinnedMesh
    skeleton: THREE.Skeleton
    bones: Map<string, THREE.Bone>
    animator: CharacterAnimator
    materials: CharacterMaterials
    triangles: number
    height: number
    stride: number
    hasShield: boolean
    scale: number
    key: string
  }) {
    this.mesh = parts.mesh
    this.outline = parts.outline
    this.skeleton = parts.skeleton
    this.bones = parts.bones
    this.animator = parts.animator
    this.materials = parts.materials
    this.triangles = parts.triangles
    this.height = parts.height
    this.stride = parts.stride
    this.hasShield = parts.hasShield
    this.key = parts.key
    this.root.name = 'character'
    this.root.scale.setScalar(parts.scale)
    this.root.add(parts.rig, parts.mesh, parts.outline)
  }

  /** The body material's colour (white = the palette as is; the actor layer greys a downed hero with it). */
  setTint(c: THREE.Color): void {
    this.materials.body.color.copy(c)
  }

  setFlash(c: THREE.Color | null, intensity = 0): void {
    const m = this.materials.body
    if (c && intensity > 0) {
      m.emissive.copy(c)
      m.emissiveIntensity = intensity
    } else {
      m.emissive.setRGB(0, 0, 0)
      m.emissiveIntensity = 0
    }
  }

  setOpacity(o: number): void {
    this.materials.setOpacity(o)
  }

  update(dtMs: number): void {
    if (!this.disposed) this.animator.update(dtMs / 1000)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.animator.dispose()
    this.root.removeFromParent()
    this.mesh.geometry.dispose()
    this.materials.dispose()
    this.skeleton.dispose()
    this.root.clear()
  }
}

/* ---------- reading meshes into parts ---------- */

function readPositions(attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): Float32Array {
  const n = attr.count
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    out[i * 3] = attr.getX(i)
    out[i * 3 + 1] = attr.getY(i)
    out[i * 3 + 2] = attr.getZ(i)
  }
  return out
}

/** A template mesh as a part: positions with the wanted morphs baked, normals, decoded palette codes, skinning, index. */
function readPart(mesh: THREE.Mesh, morphs: Readonly<Record<string, number>>): PartData {
  const g = mesh.geometry
  const pos = g.getAttribute('position')
  const n = pos.count
  let positions = readPositions(pos)
  const nor = g.getAttribute('normal')
  const normals = nor ? readPositions(nor) : new Float32Array(n * 3).fill(0)
  if (!nor) for (let i = 0; i < n; i++) normals[i * 3 + 1] = 1
  const col = g.getAttribute('color')
  const slots = new Uint8Array(n)
  const regions = new Uint8Array(n)
  if (col) {
    for (let i = 0; i < n; i++) {
      slots[i] = slotOf(col.getX(i))
      regions[i] = regionOf(col.getY(i))
    }
  }
  const joints = new Uint16Array(n * 4)
  const weights = new Float32Array(n * 4)
  const si = g.getAttribute('skinIndex')
  const sw = g.getAttribute('skinWeight')
  if (si && sw) {
    for (let i = 0; i < n; i++) {
      joints[i * 4] = si.getX(i)
      joints[i * 4 + 1] = si.getY(i)
      joints[i * 4 + 2] = si.getZ(i)
      joints[i * 4 + 3] = si.getW(i)
      weights[i * 4] = sw.getX(i)
      weights[i * 4 + 1] = sw.getY(i)
      weights[i * 4 + 2] = sw.getZ(i)
      weights[i * 4 + 3] = sw.getW(i)
    }
  }
  const targets = g.morphAttributes.position
  if (targets && targets.length > 0) {
    const w = morphWeights(mesh.morphTargetDictionary, morphs, targets.length)
    if (w.some((x) => x !== 0)) {
      const deltas = targets.map((t, i) => {
        if (w[i] === 0) return null
        const d = readPositions(t)
        // glTF morph targets are relative; an absolute target becomes a delta.
        if (!g.morphTargetsRelative) for (let k = 0; k < d.length; k++) d[k] = d[k]! - positions[k]!
        return d
      })
      positions = bakeMorphs(positions, deltas, w)
    }
  }
  let index: Uint32Array
  if (g.index) {
    index = new Uint32Array(g.index.count)
    for (let i = 0; i < g.index.count; i++) index[i] = g.index.getX(i)
  } else {
    index = new Uint32Array(n)
    for (let i = 0; i < n; i++) index[i] = i
  }
  const skinned = (mesh as THREE.SkinnedMesh).isSkinnedMesh ? (mesh as THREE.SkinnedMesh) : null
  return { name: mesh.name, positions, normals, slots, regions, joints, weights, boneNames: skinned ? skinned.skeleton.bones.map((b) => b.name) : [], index }
}

/** Moves a part's vertices and normals by a matrix (rotation, translation, uniform scale). */
function transformPart(part: PartData, m: THREE.Matrix4): void {
  const e = m.elements
  const n = vertexCount(part)
  for (let i = 0; i < n; i++) {
    const x = part.positions[i * 3]!
    const y = part.positions[i * 3 + 1]!
    const z = part.positions[i * 3 + 2]!
    part.positions[i * 3] = e[0]! * x + e[4]! * y + e[8]! * z + e[12]!
    part.positions[i * 3 + 1] = e[1]! * x + e[5]! * y + e[9]! * z + e[13]!
    part.positions[i * 3 + 2] = e[2]! * x + e[6]! * y + e[10]! * z + e[14]!
    const a = part.normals[i * 3]!
    const b = part.normals[i * 3 + 1]!
    const c = part.normals[i * 3 + 2]!
    const nx = e[0]! * a + e[4]! * b + e[8]! * c
    const ny = e[1]! * a + e[5]! * b + e[9]! * c
    const nz = e[2]! * a + e[6]! * b + e[10]! * c
    const len = Math.hypot(nx, ny, nz) || 1
    part.normals[i * 3] = nx / len
    part.normals[i * 3 + 1] = ny / len
    part.normals[i * 3 + 2] = nz / len
  }
}

function nearlyEqual(a: THREE.Matrix4, b: THREE.Matrix4): boolean {
  for (let i = 0; i < 16; i++) if (Math.abs(a.elements[i]! - b.elements[i]!) > 1e-4) return false
  return true
}

/**
 * A part from another file (a gear piece on its own copy of the rig, a part) in the character's skeleton: joints
 * re-pointed by bone name and, if that file's bind pose differs from the body's (a moved node), vertices moved into
 * the body's bind space. A mesh that is not skinned rides its nearest bone rigidly.
 */
function intoSkeleton(part: PartData, mesh: THREE.Mesh, tpl: FrameTemplate, boneIndex: ReadonlyMap<string, number>): PartData {
  const hips = boneIndex.get('Hips') ?? 0
  const skinned = (mesh as THREE.SkinnedMesh).isSkinnedMesh ? (mesh as THREE.SkinnedMesh) : null
  if (!skinned || part.boneNames.length === 0) {
    let bone: THREE.Object3D | null = mesh.parent
    while (bone && !(bone as THREE.Bone).isBone) bone = bone.parent
    const idx = bone ? (boneIndex.get(bone.name) ?? hips) : hips
    const out = rigidPart(part.name, part.positions, part.normals, part.slots, part.index, mesh.matrixWorld.elements, idx)
    return { ...out, regions: part.regions }
  }
  const srcHips = skinned.skeleton.bones.findIndex((b) => b.name === 'Hips')
  const bodyHips = tpl.boneNames.indexOf('Hips')
  const srcIb = srcHips >= 0 ? skinned.skeleton.boneInverses[srcHips] : undefined
  const bodyIb = bodyHips >= 0 ? tpl.boneInverses[bodyHips] : undefined
  if (srcIb && bodyIb && !nearlyEqual(srcIb, bodyIb)) transformPart(part, bodyIb.clone().invert().multiply(srcIb))
  return { ...part, joints: remapJoints(part.joints, part.boneNames, boneIndex, hips), boneNames: [] }
}

/* ---------- choosing what goes in ---------- */

/** A gear mesh's slot and tier: its custom properties, else its name (`gear_<class>_<slot>_<tier>`). */
function slotTier(name: string, mesh: THREE.Mesh): { slot: string; tier: string } {
  const m = /^gear_[^_]+_([^_]+)_([FS])/.exec(name)
  const slot = typeof mesh.userData.slot === 'string' ? mesh.userData.slot : (m?.[1] ?? '')
  const tier = typeof mesh.userData.tier === 'string' ? mesh.userData.tier : (m?.[2] ?? '')
  return { slot, tier }
}

/**
 * Every mesh a set has for a slot at a tier (the other tier when it has none): the slot's piece and any extra piece
 * filed under the same slot (the Shade's knife belt goes with its legs).
 */
function gearMeshes(meshes: ReadonlyMap<string, THREE.Mesh>, slot: string, tier: 'F' | 'S'): THREE.Mesh[] {
  const pick = (t: string) =>
    [...meshes.entries()]
      .filter(([name, m]) => name.startsWith('gear_') && slotTier(name, m).slot === slot && slotTier(name, m).tier === t)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, m]) => m)
  const here = pick(tier)
  return here.length ? here : pick(tier === 'F' ? 'S' : 'F')
}

function gearPieces(piece: OutfitPiece, gear: AssemblyInputs['gear']): THREE.Mesh[] {
  for (const setClass of [piece.setClass, ...piece.fallbacks]) {
    const meshes = gear.get(setClass)
    if (!meshes) continue
    const main = gearMeshes(meshes, piece.slot, piece.tier)
    // A chest is worn with the set's robe skirt or cloak where the class sheet calls for one.
    const extra = piece.slot === 'chest' ? (['robe', 'cloak'] as const).flatMap((s) => gearMeshes(meshes, s, piece.tier)) : []
    if (main.length || extra.length) return [...main, ...extra]
  }
  return []
}

/**
 * The class sheets' species notes for held things (docs/classes: Warden "shield capped at 70% … so it does not cover
 * the body", Blade "greatsword capped at 85%", Ranger "longbow and crossbow scaled to 80%", "bow scaled to 0.9 so the
 * lower limb clears the ground"): a share of world size; everything else is held at full world size (05 §5).
 */
const HELD_SCALE: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  halfling: { shield: 0.7, greatsword: 0.85, greataxe: 0.85, maul: 0.85, longbow: 0.8, crossbow: 0.8 },
  dwarf: { shortbow: 0.9, longbow: 0.9 },
}

/** Parts that sit on a hand or a foot go under gloves and boots that cover it (Draconid claws in gauntlets). */
const PART_ON: ReadonlyArray<readonly [RegExp, number]> = [
  [/_claws_hand/, 6],
  [/_claws_foot/, 9],
]

/** weapons.glb's meshes by the item `visual.meshId` they serve (their `meshIds` custom property) and tier. */
const byMeshId = new WeakMap<ReadonlyMap<string, THREE.Mesh>, Map<string, THREE.Mesh>>()

function meshIdIndex(weapons: ReadonlyMap<string, THREE.Mesh>): Map<string, THREE.Mesh> {
  let index = byMeshId.get(weapons)
  if (!index) {
    index = new Map()
    for (const [name, m] of weapons) {
      const tier = typeof m.userData.tier === 'string' ? m.userData.tier : name.slice(-1)
      for (const id of String(m.userData.meshIds ?? '').split(',')) if (id.trim()) index.set(`${id.trim()}:${tier}`, m)
    }
    byMeshId.set(weapons, index)
  }
  return index
}

function weaponMesh(weapons: ReadonlyMap<string, THREE.Mesh>, w: OutfitWeapon): THREE.Mesh | null {
  const tiers = w.tier === 'F' ? ['F', 'S'] : ['S', 'F']
  // The item's own mesh first (a holy symbol is not an orb), then by weapon type.
  if (w.meshId) {
    const index = meshIdIndex(weapons)
    for (const t of tiers) {
      const m = index.get(`${w.meshId}:${t}`)
      if (m) return m
    }
  }
  if (w.kind === 'shield') {
    const short = w.weaponType.replace(/^shield/, '')
    const types = [w.weaponType, short.charAt(0).toLowerCase() + short.slice(1)]
    for (const t of tiers) for (const type of types) {
      const m = weapons.get(`shd_${type}_${t}`) ?? weapons.get(`wpn_${type}_${t}`)
      if (m) return m
    }
    return null
  }
  for (const type of WEAPON_FALLBACK[w.weaponType] ?? [w.weaponType]) for (const t of tiers) {
    const m = weapons.get(`wpn_${type}_${t}`)
    if (m) return m
  }
  return null
}

function socketFor(w: OutfitWeapon, mesh: THREE.Mesh): string {
  if (w.hand === 'off' || w.kind === 'shield') return 'Socket_HandL'
  const s = mesh.userData.socket
  return typeof s === 'string' && s.startsWith('Socket_') ? s : 'Socket_HandR'
}

/** The top of the head (the highest head-region vertex of the body), in the bind pose. */
function crownOf(body: PartData): [number, number, number] {
  let best = -1
  for (let i = 0; i < body.positions.length / 3; i++) if (body.regions[i] === 0 && (best < 0 || body.positions[i * 3 + 1]! > body.positions[best * 3 + 1]!)) best = i
  return best < 0 ? [0, 1.75, 0] : [body.positions[best * 3]!, body.positions[best * 3 + 1]!, body.positions[best * 3 + 2]!]
}

/** True when some vertex of a piece sits on the crown: within 6 cm across, from 3 cm under to 6 cm over the top. */
function coversCrown(part: PartData, crown: readonly [number, number, number]): boolean {
  const [cx, cy, cz] = crown
  for (let i = 0; i < part.positions.length / 3; i++) {
    const y = part.positions[i * 3 + 1]!
    if (y < cy - 0.03 || y > cy + 0.06) continue
    if (Math.abs(part.positions[i * 3]! - cx) < 0.06 && Math.abs(part.positions[i * 3 + 2]! - cz) < 0.06) return true
  }
  return false
}

/**
 * What a worn helmet hides (the coordinator's rule for the gear passes): hair styles (family `hair`), the Orc
 * topknot, the Draconid horns and crest, and — until species helmet variants exist — the Elf and Orc ears; the
 * Halfling's curls are its hair. Brows, beards and tusks stay.
 */
function hiddenByHelmet(name: string, mesh: THREE.Mesh): boolean {
  const by = mesh.userData.hiddenBy
  if (by === 'helmet' || (Array.isArray(by) && by.includes('helmet'))) return true
  const family = typeof mesh.userData.family === 'string' ? mesh.userData.family : ''
  return family === 'hair' || UNDER_HELMET.test(name)
}

/* ---------- the assembly ---------- */

export function assembleCharacter(content: Content, spec: CharacterSpec, inputs: AssemblyInputs): CharacterModel {
  const tpl = inputs.template
  const species = content.species.get(spec.speciesId)
  const cls = content.classes.get(spec.classId)
  const manifestSpecies = inputs.manifest?.species.get(spec.speciesId) ?? null

  // The skeleton: the template's bones cloned (sockets come along as children), in the body's joint order.
  const hips = tpl.hips.clone(true)
  const rig = new THREE.Group()
  rig.name = 'Rig'
  rig.position.copy(tpl.rig.position)
  rig.quaternion.copy(tpl.rig.quaternion)
  rig.scale.copy(tpl.rig.scale)
  rig.add(hips)
  const bones = new Map<string, THREE.Bone>()
  const parentOf: { name: string; parent: string | null }[] = []
  hips.traverse((o) => {
    if ((o as THREE.Bone).isBone) {
      bones.set(o.name, o as THREE.Bone)
      parentOf.push({ name: o.name, parent: o.parent && (o.parent as THREE.Bone).isBone ? o.parent.name : null })
    }
  })
  const skeletonBones = tpl.boneNames.map((n) => bones.get(n) ?? new THREE.Bone())
  const skeleton = new THREE.Skeleton(skeletonBones, tpl.boneInverses.map((m) => m.clone()))
  const boneIndex = new Map(tpl.boneNames.map((n, i) => [n, i]))

  // What morphs to bake: every species key at 1.0, the preset's face weights.
  const preset = manifestSpecies?.presets[spec.look.face] ?? manifestSpecies?.presets[0] ?? null
  const morphs: Record<string, number> = { ...(preset?.face ?? {}) }
  for (const key of species?.body.shapeKeys ?? []) morphs[key] = 1

  // The gear and the parts first: their `hides` decide what is left of the body.
  // The body first (its triangles are filtered once the gear and parts have said what they cover).
  let body = readPart(tpl.body, morphs)
  const crown = crownOf(body)
  const hidden = new Set<number>()
  const gearParts: { mesh: THREE.Mesh; part: PartData }[] = []
  let wearsHelmet = false
  let helmetHidesNeck = false
  if (spec.gear) {
    for (const piece of spec.outfit.pieces) {
      for (const mesh of gearPieces(piece, inputs.gear)) {
        for (const r of parseRegions(mesh.userData.hides)) hidden.add(r)
        const part = readPart(mesh, morphs)
        gearParts.push({ mesh, part })
        // Hair goes under a helmet that is drawn and covers the crown (a hood, a coif — not a circlet, whose shard
        // may float above it): the piece's `coversHair` custom property when it has one, else whether any of its
        // vertices lies on the crown, just above the top of the head.
        if (piece.slot === 'helmet') {
          const flag = mesh.userData.coversHair
          if (typeof flag === 'boolean' ? flag : coversCrown(part, crown)) wearsHelmet = true
          if (parseRegions(mesh.userData.hides).has(1)) helmetHidesNeck = true
        }
      }
    }
  }
  // The face preset picks the parts (hair and brow styles, beard, tusks, horns, ears …); with no manifest yet, the
  // species' own list from the content.
  const wanted = new Set<string>(preset && preset.parts.length > 0 ? preset.parts : (species?.body.parts ?? []))
  // A beard tucks itself in under a helmet that closes round the neck (05 §3.2: cheek guards — the Blade's coif),
  // by its `beard_tuck` key.
  if (helmetHidesNeck) morphs.beard_tuck = 1
  const partParts: { mesh: THREE.Mesh; part: PartData }[] = []
  for (const name of wanted) {
    const mesh = tpl.parts.get(name)
    if (!mesh) continue
    if (wearsHelmet && hiddenByHelmet(name, mesh)) continue
    const covers = parseRegions(mesh.userData.hides)
    // A part that replaces body geometry (Halfling feet) goes under gear that covers the same place (boots).
    if (covers.size > 0 && [...covers].every((r) => hidden.has(r))) continue
    if (PART_ON.some(([re, region]) => re.test(name) && hidden.has(region))) continue
    for (const r of covers) hidden.add(r)
    partParts.push({ mesh, part: readPart(mesh, morphs) })
  }

  // The body, minus what is covered.
  const kept = keepTriangles(body.index, body.regions, hidden)
  if (kept.length !== body.index.length) body = compactPart(body, kept)
  body = { ...body, joints: remapJoints(body.joints, body.boneNames, boneIndex, boneIndex.get('Hips') ?? 0), boneNames: [] }

  const merged: PartData[] = [body]
  for (const { mesh, part } of [...partParts, ...gearParts]) merged.push(intoSkeleton(part, mesh, tpl, boneIndex))

  // Species proportions on the cloned bones (each bone's world scale = its group's factor), the root on the character.
  // The manifest's scales are what the review renders used; the content's stand in until it is there.
  const scales: Record<string, number> = { ...(species?.body.boneScales ?? {}), ...(manifestSpecies?.boneScales ?? {}) }
  for (const [name, s] of localBoneScales(parentOf, scales)) bones.get(name)?.scale.setScalar(s)
  const characterScale = rootScale(scales)

  // Weapons, rigid in a fist at world size: × 1 / the hand's world scale (root × the hand's group factor). A bow
  // brings its quiver to the back socket.
  rig.updateMatrixWorld(true)
  const placeRigid = (mesh: THREE.Mesh, socket: string, share = 1): void => {
    const rest = tpl.rest.get(socket)
    const boneName = tpl.socketBone.get(socket)
    const bone = boneName ? bones.get(boneName) : undefined
    const idx = boneName ? boneIndex.get(boneName) : undefined
    if (!rest || !bone || idx === undefined) return
    const worldScale = new THREE.Vector3().setFromMatrixScale(bone.matrixWorld).x * characterScale
    const k = share / worldScale
    const m = rest.clone().multiply(new THREE.Matrix4().makeScale(k, k, k))
    const part = readPart(mesh, {})
    merged.push(rigidPart(mesh.name, part.positions, part.normals, part.slots, part.index, m.elements, idx))
  }
  if (spec.gear && inputs.weapons) {
    for (const w of spec.outfit.weapons) {
      const mesh = weaponMesh(inputs.weapons, w)
      const notes = HELD_SCALE[spec.speciesId]
      const share = notes ? (notes[w.kind === 'shield' ? 'shield' : w.weaponType] ?? 1) : 1
      if (mesh) placeRigid(mesh, socketFor(w, mesh), share)
      if (w.hand === 'main' && BOW_TYPES.has(w.weaponType)) {
        for (const name of [`qvr_quiver_${w.tier}`, `qvr_arrowsFull_${w.tier}`]) {
          const q = inputs.weapons.get(name)
          if (q) placeRigid(q, typeof q.userData.socket === 'string' ? q.userData.socket : 'Socket_Back')
        }
      }
    }
  }

  // Feet on the floor: rescaled legs leave the soles above or below it until the Hips move.
  const foot = bones.get('LeftFoot')
  if (foot) {
    const ankleY = new THREE.Vector3().setFromMatrixPosition(foot.matrixWorld).y
    const footScale = new THREE.Vector3().setFromMatrixScale(foot.matrixWorld).x
    const sole = ankleY - tpl.ankleRestY * footScale
    if (Math.abs(sole) < 0.6) hips.position.y -= sole
  }
  const hipsRest = hips.position.clone()

  const data = mergeParts(merged, skeletonBones.length)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3))
  geometry.setAttribute(SLOT_ATTRIBUTE, new THREE.BufferAttribute(data.slots, 1))
  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(data.joints, 4))
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(data.weights, 4))
  geometry.setIndex(new THREE.BufferAttribute(data.index, 1))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  const materials = createCharacterMaterials(paletteFor(spec, species, cls, inputs.manifest), { invScale: 1 / characterScale })
  const mesh = new THREE.SkinnedMesh(geometry, materials.body)
  mesh.name = 'hero'
  mesh.bind(skeleton, IDENTITY)
  mesh.frustumCulled = false
  const outline = new THREE.SkinnedMesh(geometry, materials.outline)
  outline.name = 'hero-outline'
  outline.bind(skeleton, IDENTITY)
  outline.frustumCulled = false
  const size = new THREE.Vector2()
  outline.onBeforeRender = (renderer) => {
    renderer.getDrawingBufferSize(size)
    materials.setViewportHeight(size.y)
  }

  const srcHips = inputs.clips?.srcHips
  const k = srcHips && srcHips.y > 0.1 ? hipsRest.y / srcHips.y : 1
  const animator = new CharacterAnimator(rig, bones, inputs.clips, { rest: hipsRest, k })
  // Something in the off hand (a shield, an orb, a second blade): the left fingers close round it.
  animator.setLeftFist(spec.gear && spec.outfit.weapons.some((w) => w.hand === 'off'))
  const top = geometry.boundingBox?.max.y ?? 1.8
  const height = Math.max(0.6, (top - (tpl.hipsRest.y - hipsRest.y)) * characterScale)

  const hasShield = spec.gear && spec.outfit.weapons.some((w) => w.kind === 'shield')
  return new CharacterModel({ rig, mesh, outline, skeleton, bones, animator, materials, triangles: data.triangleCount, height, stride: k * characterScale, hasShield, scale: characterScale, key: specKey(spec) })
}
