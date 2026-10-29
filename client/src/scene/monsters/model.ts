import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { CharacterAnimator, type ClipSource } from '../characters/animator.ts'
import { assembleRigged, type CharacterModel } from '../characters/assembler.ts'
import { hasModel, heroLibrary, loadGltf, loadJson } from '../characters/assets.ts'
import { bakeMorphs, morphWeights } from '../characters/geometry.ts'
import type { ClipInfo } from '../characters/manifest.ts'
import { createCharacterMaterials, SLOT_ATTRIBUTE, type CharacterMaterials } from '../characters/material.ts'
import { slotOf } from '../characters/palette.ts'
import type { FrameTemplate } from '../characters/template.ts'
import { EMPTY_MANIFEST, HERO_CLIP_FOR, parseMonsterClips, parseMonsterManifest, partShown, resolveMonsterVariant, variantKey, variantPalette, type MonsterManifest, type MonsterVariant } from './manifest.ts'
import { attachmentFor, attachTransform, readAttach, TELL_SHAPES, tellDelta, type TellShape } from './wear.ts'

/**
 * The monsters in 3D (Phase 6; tools/blender/README.md → *Monsters*): a base file per body plan, a variant per monster
 * (scale, parts on, shape keys baked, three colours into palette slots 0–2), assembled once per variant and cloned
 * per monster, drawn with the heroes' palette toon material and outline, animated by one AnimationMixer each.
 *
 * Two kinds of base: those with **their own rig and clips** (rat, spider, hound, bat, wraith, wisp, tentacle, ooze,
 * leech — skeletal, shape-key or node animation alike) are cloned with SkeletonUtils, every mesh sharing the variant's
 * geometry; the **humanoid bases** (`clips: "hero"`) are meshes on a copy of the hero rig, merged like gear onto the
 * broad frame's skeleton (characters/assembler.ts `assembleRigged`) and played with the hero clips. Either answers to
 * both vocabularies — Move, Attack1, Attack2, Death, Flee and Walk, Attack_Light, Attack_Heavy, Defeat, Run — so the
 * actor layer drives a monster as it drives a hero. The Deep Maw's tentacles are copies of its base round it, each
 * with its own mixer. A missing file or a failure resolves to null: the capsule stays.
 */

/** How the actor layer animates a model (a hero's CharacterAnimator, a monster's — the same class). */
export type ModelAnimator = CharacterAnimator

/** Aliases that let an own-rig monster answer to the heroes' clip names. */
const OWN_ALIASES: Readonly<Record<string, string>> = {
  Walk: 'Move',
  Run: 'Move',
  Attack_Light: 'Attack1',
  Attack_Heavy: 'Attack2',
  Attack_Dual: 'Attack2',
  Shoot: 'Attack2',
  Cast: 'Attack2',
  Defeat: 'Death',
  Downed: 'Death',
}
/** And the other way, for a monster on the hero rig: Move is its Walk, Death its Defeat … */
const HERO_ALIASES: Readonly<Record<string, string>> = { ...HERO_CLIP_FOR, Downed: 'Defeat' }

function hasMorphTracks(clips: readonly THREE.AnimationClip[]): boolean {
  return clips.some((c) => c.tracks.some((t) => t.name.endsWith('.morphTargetInfluences')))
}

function readPositions(attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): Float32Array {
  const out = new Float32Array(attr.count * 3)
  for (let i = 0; i < attr.count; i++) {
    out[i * 3] = attr.getX(i)
    out[i * 3 + 1] = attr.getY(i)
    out[i * 3 + 2] = attr.getZ(i)
  }
  return out
}

/** A variant's copy of a base mesh's geometry: shape keys baked, the palette slot decoded, morphs kept only if clips move them. */
function variantGeometry(mesh: THREE.Mesh, shapes: Readonly<Record<string, number>>, keepMorphs: boolean): THREE.BufferGeometry {
  const src = mesh.geometry
  const g = new THREE.BufferGeometry()
  for (const name of ['position', 'normal', 'skinIndex', 'skinWeight']) {
    const a = src.getAttribute(name)
    if (a) g.setAttribute(name, a)
  }
  if (src.index) g.setIndex(src.index)
  const pos = src.getAttribute('position')
  const col = src.getAttribute('color')
  const slots = new Uint8Array(pos.count)
  if (col) for (let i = 0; i < pos.count; i++) slots[i] = slotOf(col.getX(i))
  g.setAttribute(SLOT_ATTRIBUTE, new THREE.BufferAttribute(slots, 1))
  const targets = src.morphAttributes.position
  if (targets && targets.length && Object.keys(shapes).length) {
    const w = morphWeights(mesh.morphTargetDictionary, shapes, targets.length)
    if (w.some((x) => x !== 0)) {
      const base = readPositions(pos)
      const deltas = targets.map((t, i) => {
        if (w[i] === 0) return null
        const d = readPositions(t)
        if (!src.morphTargetsRelative) for (let k = 0; k < d.length; k++) d[k] = d[k]! - base[k]!
        return d
      })
      g.setAttribute('position', new THREE.BufferAttribute(bakeMorphs(base, deltas, w), 3))
    }
  }
  if (keepMorphs && targets && targets.length) {
    g.morphAttributes = src.morphAttributes
    g.morphTargetsRelative = src.morphTargetsRelative
  }
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

/** A variant ready to clone: its scene (own rig) or its meshes (hero rig), its clips and its size. */
export interface Proto {
  variant: MonsterVariant
  heroRig: boolean
  /** Own rig: the base scene with this variant's geometry; parts it does not show are gone. */
  scene: THREE.Object3D | null
  /** Hero rig: the meshes to merge. */
  meshes: THREE.Mesh[]
  /** Hero rig: unskinned props drawn at the monster's origin (the Hollow King's throne). */
  props: THREE.Mesh[]
  clips: THREE.AnimationClip[]
  info: Map<string, ClipInfo>
  /** Height and footprint at scale 1 (metres). */
  height: number
  radius: number
}

/** The monsters' files, loaded once each; variants prepared once each. */
export class MonsterLibrary {
  private manifestP: Promise<MonsterManifest> | null = null
  private manifestNow: MonsterManifest | null = null
  private clipsP: Promise<Map<string, Map<string, ClipInfo>>> | null = null
  private readonly protos = new Map<string, Promise<Proto | null>>()
  /** Tell shapes' extras by variant (wear.ts tellDelta), worked out once each. */
  private readonly tells = new Map<string, Float32Array | null>()

  /** True when a base's file is there to load. */
  available(base: string): boolean {
    return hasModel(`monsters/${base}.glb`)
  }

  /** True when any monster file has landed (otherwise nothing is asked for and the capsules stand). */
  any(): boolean {
    return hasModel('monsters/manifest.json') || ['rat', 'spider', 'hound', 'humanoid', 'skeleton', 'zombie', 'bat', 'wraith', 'wisp', 'tentacle', 'sentinel', 'ooze', 'leech', 'hollow-king'].some((b) => this.available(b))
  }

  manifest(): Promise<MonsterManifest> {
    this.manifestP ??= loadJson('monsters/manifest.json').then((j) => {
      this.manifestNow = j ? parseMonsterManifest(j) : EMPTY_MANIFEST
      return this.manifestNow
    })
    return this.manifestP
  }

  /** The manifest if it has loaded (null before). */
  peekManifest(): MonsterManifest | null {
    return this.manifestNow
  }

  clips(): Promise<Map<string, Map<string, ClipInfo>>> {
    this.clipsP ??= loadJson('monsters/clips.json').then((j) => parseMonsterClips(j))
    return this.clipsP
  }

  private proto(v: MonsterVariant): Promise<Proto | null> {
    const key = variantKey(v)
    let p = this.protos.get(key)
    if (!p) {
      p = Promise.all([loadGltf(`monsters/${v.base}.glb`), this.clips()])
        .then(([gltf, clips]) => (gltf ? prepareVariant(v, gltf, clips.get(v.base) ?? new Map()) : null))
        .catch((e: unknown) => {
          console.warn(`monster ${v.base} could not be prepared`, e)
          return null
        })
      this.protos.set(key, p)
    }
    return p
  }

  /**
   * A monster (or pet) of this variant; null when its base is missing or fails. A boss phase that wears another variant
   * (Naesa's tentacle arms, wear.ts) wears it on its bones instead of its costume's stand-ins; a tell shape (the
   * Bursting Corpse's swell) rides as a live morph; a throne risen on its column (the Hollow King from phase 2) is left
   * on its dais for the arena to draw (`buildProps`, room/arena.ts) while he descends without it.
   */
  async build(v: MonsterVariant): Promise<MonsterModel | null> {
    try {
      const worn = await this.wornFor(v)
      const body = worn && v.parts ? { ...v, parts: v.parts.filter((p) => !worn.replaces.includes(p)) } : v
      const proto = await this.proto(body)
      if (!proto) return null
      // The Deep Maw's ring: copies of the base's body alone, each with its own mixer.
      const copies = v.instances ? await this.proto({ ...v, parts: v.instances.spots[0]?.mesh ? [v.instances.spots[0].mesh] : [], instances: null, shapes: {} }) : null
      if (proto.heroRig) {
        const [tpl, clips] = await Promise.all([heroLibrary.frame('broad'), heroLibrary.clips()])
        if (!tpl) return null
        const inner = assembleRigged(proto.meshes, tpl, clips, { palette: variantPalette(v), morphs: v.shapes, scale: v.scale, key: variantKey(body), boneScales: v.boneScales })
        const m = MonsterModel.fromCharacter(v, inner, v.throne?.raised ? [] : proto.props)
        const tell = TELL_SHAPES[v.id]
        if (tell) m.setTellShape(this.tellOf(body, proto, tpl, tell))
        if (worn) m.wear(await Promise.all(worn.spec.sockets.map(() => this.build(worn.variant))), worn.spec.sockets)
        return m
      }
      return MonsterModel.fromProto(v, proto, copies)
    } catch (e) {
      console.warn('monster assembly failed', e)
      return null
    }
  }

  /** What a variant wears at its phase (wear.ts), when the worn variant's file and `attach` block are there. */
  private async wornFor(v: MonsterVariant): Promise<{ variant: MonsterVariant; spec: NonNullable<ReturnType<typeof readAttach>>; replaces: readonly string[] } | null> {
    const a = attachmentFor(v.id, v.phase)
    if (!a) return null
    const variant = resolveMonsterVariant(a.variant, await this.manifest(), null, (b) => this.available(b))
    const spec = readAttach(variant?.raw)
    return variant && spec ? { variant, spec, replaces: a.replaces } : null
  }

  private tellOf(v: MonsterVariant, proto: Proto, tpl: FrameTemplate, tell: TellShape): Float32Array | null {
    const key = `${variantKey(v)}~${tell.key}=${tell.to}`
    if (!this.tells.has(key)) this.tells.set(key, tellDelta(proto.meshes, tpl, v.shapes, tell))
    return this.tells.get(key) ?? null
  }

  /**
   * A boss's rigid props on their own, in its colours: the Hollow King's throne risen on its column, which stays on its
   * dais when he descends (room/arena.ts). Null without props or files.
   */
  async buildProps(v: MonsterVariant): Promise<PropModel | null> {
    try {
      const proto = await this.proto({ ...v, parts: [] })
      return proto && proto.props.length > 0 ? PropModel.of(v, proto.props) : null
    } catch (e) {
      console.warn('monster props failed', e)
      return null
    }
  }
}

/** A base file read for one variant (exported for the node tests on the real files). */
export function prepareVariant(v: MonsterVariant, gltf: GLTF, info: Map<string, ClipInfo>): Proto {
  const own = gltf.animations ?? []
  const heroRig = v.heroClips || (gltf.scene.userData.clips === 'hero' && own.length === 0)
  const keepMorphs = hasMorphTracks(own)
  if (heroRig) {
    const meshes: THREE.Mesh[] = []
    const props: THREE.Mesh[] = []
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return
      const name = o.name.replace(/_\d+$/, '')
      if (v.rigidProps.includes(name)) props.push(o as THREE.Mesh)
      // Exactly the meshes the entry lists (the body is one of them, cut to what the costume leaves visible).
      else if (partShown(o.name, v.base, v.parts, true)) meshes.push(o as THREE.Mesh)
    })
    const box = new THREE.Box3()
    for (const m of meshes) box.expandByObject(m)
    return { variant: v, heroRig, scene: null, meshes, props, clips: [], info, height: box.isEmpty() ? 1.8 : box.max.y, radius: box.isEmpty() ? 0.3 : Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2 }
  }
  const scene = cloneSkinned(gltf.scene)
  // A part the variant does not show stays in the tree, hidden (its clips' tracks still find their nodes).
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    if (!partShown(m.name, v.base, v.parts)) {
      m.visible = false
      return
    }
    m.geometry = variantGeometry(m, v.shapes, keepMorphs)
    if (keepMorphs) m.updateMorphTargets()
  })
  scene.updateMatrixWorld(true)
  const box = new THREE.Box3()
  scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.visible) box.expandByObject(o)
  })
  return {
    variant: v,
    heroRig,
    scene,
    meshes: [],
    props: [],
    clips: own,
    info,
    height: box.isEmpty() ? 1 : Math.max(0.2, box.max.y),
    radius: box.isEmpty() ? 0.3 : Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2,
  }
}

/** A rigid prop's geometry with its palette slot decoded (no skinning, no morphs). */
function rigidGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  const src = mesh.geometry
  const g = new THREE.BufferGeometry()
  for (const name of ['position', 'normal']) {
    const a = src.getAttribute(name)
    if (a) g.setAttribute(name, a)
  }
  if (src.index) g.setIndex(src.index)
  const pos = src.getAttribute('position')
  const col = src.getAttribute('color')
  const slots = new Uint8Array(pos.count)
  if (col) for (let i = 0; i < pos.count; i++) slots[i] = slotOf(col.getX(i))
  g.setAttribute(SLOT_ATTRIBUTE, new THREE.BufferAttribute(slots, 1))
  g.computeBoundingSphere()
  return g
}

/**
 * A variant's rigid props as meshes with their outlines, at the monster's unscaled size (a parent scales them): its
 * throne, the column only once a later phase raises the seat on it.
 */
function rigidMeshes(v: MonsterVariant, props: readonly THREE.Mesh[], materials: CharacterMaterials): { meshes: THREE.Mesh[]; geometries: THREE.BufferGeometry[]; triangles: number } {
  const size = new THREE.Vector2()
  const meshes: THREE.Mesh[] = []
  const geometries: THREE.BufferGeometry[] = []
  let triangles = 0
  for (const p of props) {
    const name = p.name.replace(/_\d+$/, '')
    const column = v.throne?.column === name
    if (column && !v.throne?.raised) continue
    const body = new THREE.Mesh(rigidGeometry(p), materials.body)
    body.name = p.name
    p.updateWorldMatrix(true, false)
    p.matrixWorld.decompose(body.position, body.quaternion, body.scale)
    if (!column && v.throne?.raised) body.position.y += v.throne.columnHeight
    body.frustumCulled = false
    const outline = new THREE.Mesh(body.geometry, materials.outline)
    outline.onBeforeRender = (renderer) => {
      renderer.getDrawingBufferSize(size)
      materials.setViewportHeight(size.y)
    }
    body.add(outline)
    meshes.push(body)
    geometries.push(body.geometry)
    triangles += body.geometry.index ? body.geometry.index.count / 3 : body.geometry.getAttribute('position').count / 3
  }
  return { meshes, geometries, triangles }
}

/** The glowing slots' strength at rest (characters/material.ts), and how much a full tell adds. */
const GLOW_AT_REST = 0.85
const TELL_GLOW = 2.2

/** A worn variant's own names for the clips its wearer plays (Naesa's Embrace is the arm's grab-wrap). */
const WORN_ALIASES: Readonly<Record<string, string>> = { Embrace: 'Attack2', Undertow: 'Attack2', Call: 'Attack2', Ascend: 'Rise', Roar: 'Attack1' }

/** A clone of an own-rig prototype on shared materials: each mesh with its outline (sharing its morph weights). */
function dress(scene: THREE.Object3D, materials: CharacterMaterials): { root: THREE.Object3D; triangles: number } {
  const root = cloneSkinned(scene)
  let triangles = 0
  const meshes: THREE.Mesh[] = []
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh)
  })
  const size = new THREE.Vector2()
  for (const m of meshes) {
    if (!m.visible) continue
    m.material = materials.body
    m.frustumCulled = false
    triangles += m.geometry.index ? m.geometry.index.count / 3 : m.geometry.getAttribute('position').count / 3
    const skinned = (m as THREE.SkinnedMesh).isSkinnedMesh ? (m as THREE.SkinnedMesh) : null
    let outline: THREE.Mesh
    if (skinned) {
      const so = new THREE.SkinnedMesh(m.geometry, materials.outline)
      so.bind(skinned.skeleton, skinned.bindMatrix)
      outline = so
    } else outline = new THREE.Mesh(m.geometry, materials.outline)
    outline.name = `${m.name}-outline`
    outline.frustumCulled = false
    if (m.morphTargetInfluences) {
      // One array for both, so a shape-key clip moves the outline with the body.
      outline.morphTargetInfluences = m.morphTargetInfluences
      outline.morphTargetDictionary = m.morphTargetDictionary
    }
    outline.onBeforeRender = (renderer) => {
      renderer.getDrawingBufferSize(size)
      materials.setViewportHeight(size.y)
    }
    m.add(outline)
  }
  return { root, triangles }
}

/** An animator over a set of clips (a monster's own), answering to the heroes' names too. */
function ownAnimator(root: THREE.Object3D, clips: readonly THREE.AnimationClip[], info: Map<string, ClipInfo>, speed: number): CharacterAnimator {
  const map = new Map<string, THREE.AnimationClip>()
  for (const c of clips) map.set(c.name, c)
  const source: ClipSource = { info, clipsFor: () => map }
  const a = new CharacterAnimator(root, new Map(), source, { rest: new THREE.Vector3(), k: 1 })
  a.addAliases(OWN_ALIASES)
  a.setSpeed(speed)
  return a
}

/**
 * Every call goes to the main animator and to the copies round it (the Deep Maw's tentacles); a clip started anew
 * starts each copy its `clipOffset` in, so the ring keeps its stagger.
 */
function fanOut(main: CharacterAnimator, copies: readonly { animator: CharacterAnimator; offset: number }[]): CharacterAnimator {
  if (copies.length === 0) return main
  const methods = ['play', 'setBase', 'setBaseTimeScale', 'release', 'loopClip', 'freeze', 'update', 'dispose', 'setSpeed'] as const
  const restart = new Set<string>(['play', 'setBase', 'loopClip'])
  for (const name of methods) {
    const own = (main[name] as (...args: unknown[]) => unknown).bind(main)
    ;(main as unknown as Record<string, unknown>)[name] = (...args: unknown[]) => {
      const r = own(...args)
      for (const c of copies) {
        ;(c.animator[name] as (...a: unknown[]) => unknown).apply(c.animator, args)
        if (restart.has(name) && c.offset > 0) c.animator.update(c.offset)
      }
      return r
    }
  }
  return main
}

let haloTexture: THREE.DataTexture | null = null

/** A soft round glow (the wisp's halo), made once. */
function halo(): THREE.DataTexture {
  if (!haloTexture) {
    const size = 64
    const data = new Uint8Array(size * size * 4)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const r = Math.min(1, Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5) * 2)
        const i = (y * size + x) * 4
        data.set([255, 255, 255, Math.round(255 * Math.pow(1 - r, 2.2))], i)
      }
    }
    haloTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
    haloTexture.magFilter = THREE.LinearFilter
    haloTexture.minFilter = THREE.LinearFilter
    haloTexture.needsUpdate = true
  }
  return haloTexture
}

/** How see-through a variant is drawn: an ooze shows the junk it swallowed, the Warden's Hound is a ghost. */
function baseOpacity(v: MonsterVariant): number {
  if (v.ghost) return 0.55
  if (v.base === 'ooze') return 0.75
  return 1
}

export class MonsterModel {
  readonly root = new THREE.Group()
  readonly animator: CharacterAnimator
  /** Standing height in metres (for bars and framing). */
  readonly height: number
  readonly radius: number
  readonly stride: number
  readonly hasShield = false
  readonly triangles: number
  readonly key: string
  readonly variant: MonsterVariant
  private readonly materials: CharacterMaterials
  private readonly inner: CharacterModel | null
  private readonly opacity: number
  private readonly owned: { dispose(): void }[] = []
  /** Models worn on its bones (Naesa's tentacle arms, wear.ts). */
  private readonly worn: MonsterModel[] = []
  /** The tell shape's weight (the merged mesh's morph influences, shared with the outline), when it has one. */
  private tellWeights: number[] | null = null
  private disposed = false

  private constructor(parts: { variant: MonsterVariant; animator: CharacterAnimator; materials: CharacterMaterials; height: number; radius: number; stride: number; triangles: number; inner: CharacterModel | null }) {
    this.variant = parts.variant
    this.animator = parts.animator
    this.materials = parts.materials
    this.height = parts.height
    this.radius = parts.radius
    this.stride = parts.stride
    this.triangles = parts.triangles
    this.inner = parts.inner
    this.key = variantKey(parts.variant)
    this.root.name = `monster:${parts.variant.id}`
    this.opacity = baseOpacity(parts.variant)
    if (this.opacity < 1) this.setOpacity(1)
  }

  /**
   * A humanoid monster: the merged character on the hero rig, its clips answering to Move, Attack1, Death … by its own
   * `clipMap` (a Skeleton Archer's Attack1 is the heroes' Shoot), its walk its Move (a Ghoul runs), its posture over
   * every clip (`poseAdd`, `poseHold`).
   */
  static fromCharacter(v: MonsterVariant, inner: CharacterModel, props: readonly THREE.Mesh[] = []): MonsterModel {
    const a = inner.animator
    a.addAliases({ ...HERO_ALIASES, ...(v.clipMap ?? {}) })
    const move = v.clipMap?.Move
    if (move === 'Run' || move === 'Walk') {
      const setBase = a.setBase.bind(a)
      a.setBase = (name, instant) => setBase(name === 'Walk' || name === 'Run' ? move : name, instant)
    }
    a.setSpeed(v.clipSpeed)
    // The seated King's hips drop (glTF axes, at scale 1: the rig's own space under the character's scale).
    let hips: THREE.Vector3 | null = null
    if (v.hipsOffset) {
      hips = new THREE.Vector3(...v.hipsOffset)
      const parent = inner.bones.get('Hips')?.parent
      if (parent) {
        parent.updateWorldMatrix(true, false)
        hips.applyQuaternion(parent.getWorldQuaternion(new THREE.Quaternion()).invert())
      }
    }
    if (v.poseAdd || v.poseHold || hips) a.setPosture(inner.bones, v.poseAdd, v.poseHold, hips)
    // Seated (a hips drop), the head comes down as far: the King on his throne is 2.9 m, not his standing 3.7 (bars, framing).
    const standing = v.height ?? inner.height
    const height = v.hipsOffset ? Math.max(0.5, standing + v.hipsOffset[1] * v.scale) : standing
    const m = new MonsterModel({ variant: v, animator: a, materials: inner.materials, height, radius: 0.3 * v.scale, stride: inner.stride * v.clipSpeed, triangles: inner.triangles, inner })
    // Rigid props (the throne) at his origin, scaled with him, in his colours, with the outline.
    const rigid = rigidMeshes(v, props, inner.materials)
    for (const body of rigid.meshes) inner.root.add(body)
    m.owned.push(...rigid.geometries)
    m.root.add(inner.root)
    return m
  }

  /**
   * Puts worn models on this one's bones (wear.ts; call once, with the skeleton at rest): each at its bone's head on
   * the bone's line, moving with it, playing this model's clips on its own rig (a little out of step with the other),
   * tinted, flashed and faded with it, and let go with it.
   */
  wear(models: readonly (MonsterModel | null)[], sockets: readonly string[]): void {
    const inner = this.inner
    const copies: { animator: CharacterAnimator; offset: number }[] = []
    if (inner) inner.root.updateMatrixWorld(true)
    models.forEach((w, i) => {
      const bone = inner?.bones.get(sockets[i] ?? '')
      const t = bone ? attachTransform(bone, this.variant.scale) : null
      if (!w || !bone || !t) {
        w?.dispose()
        return
      }
      w.root.position.set(0, 0, 0)
      w.root.quaternion.copy(t.quaternion)
      w.root.scale.setScalar(t.scale)
      bone.add(w.root)
      w.animator.addAliases(WORN_ALIASES)
      this.worn.push(w)
      copies.push({ animator: w.animator, offset: i * 0.35 })
    })
    if (copies.length > 0) fanOut(this.animator, copies)
  }

  /** The tell's live shape (wear.ts tellDelta) as a morph target on the merged mesh, at no weight until `setTell`. */
  setTellShape(delta: Float32Array | null): void {
    const inner = this.inner
    const pos = inner?.mesh.geometry.getAttribute('position')
    if (!inner || !delta || !pos || pos.count * 3 !== delta.length) return
    const g = inner.mesh.geometry
    g.morphAttributes.position = [new THREE.BufferAttribute(delta, 3)]
    g.morphTargetsRelative = true
    inner.mesh.updateMorphTargets()
    const weights = inner.mesh.morphTargetInfluences
    if (!weights) return
    // One array for both, so the outline swells with the body.
    inner.outline.morphTargetInfluences = weights
    inner.outline.morphTargetDictionary = inner.mesh.morphTargetDictionary
    this.tellWeights = weights
  }

  /**
   * How far a tell has swollen it (0 at rest, 1 at the tell shape's full weight), its glowing slots flaring with it (the
   * Bursting Corpse's gas-lit belly: 06's "must read"); nothing without a tell shape.
   */
  setTell(k: number): void {
    if (!this.tellWeights) return
    const w = Math.max(0, Math.min(1, k))
    this.tellWeights[0] = w
    this.materials.setGlow(GLOW_AT_REST + TELL_GLOW * w)
  }

  /** True when it has a tell shape (the actor layer eases it while a telegraphed attack is wound up). */
  hasTell(): boolean {
    return this.tellWeights !== null
  }

  /** An own-rig monster: a clone of the variant's scene on fresh materials, and its ring of copies if it has one. */
  static fromProto(v: MonsterVariant, proto: Proto, copies: Proto | null): MonsterModel {
    const palette = variantPalette(v)
    const materials = createCharacterMaterials(palette, { invScale: 1 / v.scale })
    const holder = new THREE.Group()
    holder.scale.setScalar(v.scale)
    const main = dress(proto.scene!, materials)
    holder.add(main.root)
    let triangles = main.triangles
    const ring: { animator: CharacterAnimator; offset: number }[] = []
    if (v.instances && copies?.scene) {
      // A body with a plate at its centre shows only the plate there; the tentacles stand round it.
      if (v.parts && v.parts.length > 0) main.root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && /_body$/.test(o.name.replace(/_\d+$/, ''))) o.visible = false
      })
      for (const s of v.instances.spots) {
        const c = dress(copies.scene, materials)
        c.root.position.set(s.x, s.y, s.z)
        if (s.quaternion) c.root.quaternion.set(s.quaternion[0], s.quaternion[1], s.quaternion[2], s.quaternion[3]).normalize()
        else c.root.rotation.y = s.yaw
        c.root.scale.setScalar(s.scale)
        holder.add(c.root)
        triangles += c.triangles
        const a = ownAnimator(c.root, copies.clips, copies.info, v.clipSpeed)
        // Each copy runs `clipOffset` ahead of the first, so the ring does not move as one.
        a.restartBase()
        if (s.clipOffset > 0) a.update(s.clipOffset)
        ring.push({ animator: a, offset: s.clipOffset })
      }
    }
    const own = ownAnimator(main.root, proto.clips, proto.info, v.clipSpeed)
    // Its own clips by the names the content uses (`clipMap`: Pin, Lunge, BoltHole, Drop, Reel …).
    if (v.clipMap) own.addAliases(v.clipMap)
    if (ring.length) own.restartBase()
    const animator = fanOut(own, ring)
    const reach = v.instances ? Math.max(...v.instances.spots.map((s) => Math.hypot(s.x, s.z))) : 0
    // A walk loop covers clips.json's `speed` × scale × clipSpeed metres a second: the layer paces it by this stride.
    const m = new MonsterModel({ variant: v, animator, materials, height: v.height ?? proto.height * v.scale, radius: (proto.radius + reach) * v.scale, stride: v.scale * v.clipSpeed, triangles, inner: null })
    m.root.add(holder)
    // A wisp carries a halo on its floating node (it bobs with it): a soft additive glow in its glow colour.
    let float: THREE.Object3D | null = null
    main.root.traverse((o) => {
      if (!float && /_float$/.test(o.name.replace(/_\d+$/, ''))) float = o
    })
    if (float) {
      const mat = new THREE.SpriteMaterial({ map: halo(), color: new THREE.Color(palette[11] ?? '#ffe08a'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 })
      const sprite = new THREE.Sprite(mat)
      sprite.name = 'halo'
      sprite.scale.setScalar(1.1)
      sprite.renderOrder = 4
      ;(float as THREE.Object3D).add(sprite)
      m.owned.push(mat)
    }
    if (v.poseAdd || v.poseHold) {
      const bones = new Map<string, THREE.Bone>()
      main.root.traverse((o) => {
        if ((o as THREE.Bone).isBone) bones.set(o.name, o as THREE.Bone)
      })
      own.setPosture(bones, v.poseAdd, v.poseHold)
    }
    return m
  }

  /** The body material's colour (the actor layer greys a body with it). */
  setTint(c: THREE.Color): void {
    this.materials.body.color.copy(c)
    for (const w of this.worn) w.setTint(c)
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
    for (const w of this.worn) w.setFlash(c, intensity)
  }

  setOpacity(o: number): void {
    this.materials.setOpacity(o * this.opacity)
    for (const w of this.worn) w.setOpacity(o)
  }

  update(dtMs: number): void {
    if (!this.disposed) this.animator.update(dtMs / 1000)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.root.removeFromParent()
    if (this.inner) {
      for (const w of this.worn.splice(0)) w.dispose()
      // Its props' geometry is its own (the throne's, rigidGeometry), not the variant's.
      for (const o of this.owned) o.dispose()
      this.inner.dispose()
      return
    }
    this.animator.dispose()
    // The geometry is the variant's (shared by every monster of it); only this monster's materials and bones go.
    this.root.traverse((o) => {
      const s = o as THREE.SkinnedMesh
      if (s.isSkinnedMesh && !s.name.endsWith('-outline')) s.skeleton.dispose()
    })
    this.materials.dispose()
    for (const o of this.owned) o.dispose()
    this.root.clear()
  }
}

/** A boss's rigid props drawn on their own (the Hollow King's risen throne on its dais): one root in its colours. */
export class PropModel {
  readonly root = new THREE.Group()
  readonly triangles: number
  private readonly materials: CharacterMaterials
  private readonly geometries: THREE.BufferGeometry[]
  private disposed = false

  private constructor(materials: CharacterMaterials, geometries: THREE.BufferGeometry[], triangles: number) {
    this.materials = materials
    this.geometries = geometries
    this.triangles = triangles
  }

  static of(v: MonsterVariant, props: readonly THREE.Mesh[]): PropModel {
    const materials = createCharacterMaterials(variantPalette(v), { invScale: 1 / v.scale })
    const rigid = rigidMeshes(v, props, materials)
    const m = new PropModel(materials, rigid.geometries, rigid.triangles)
    m.root.name = `props:${v.id}`
    m.root.scale.setScalar(v.scale)
    for (const body of rigid.meshes) m.root.add(body)
    return m
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.root.removeFromParent()
    for (const g of this.geometries) g.dispose()
    this.materials.dispose()
    this.root.clear()
  }
}

/** The app's one monster library. */
export const monsterLibrary = new MonsterLibrary()
