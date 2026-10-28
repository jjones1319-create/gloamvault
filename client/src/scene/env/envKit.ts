import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { hasModel, loadJson, modelUrl } from '../characters/assets.ts'
import { ENV_ALPHA, ENV_ATTRIBUTE } from './envMaterial.ts'
import { EMPTY_SHELL, envSlot, FALLBACK_PALETTE, lightKind, parseEnvZone, readHole, SHARED_KIT, type EnvZoneInfo, type KitZone } from './envData.ts'

/**
 * The room kits (Phase 6; tools/blender/README.md → *Environments*): `models/env/kit_<zone>.glb` read once into pieces
 * by meshId — the static geometry in the piece's own space with its `gv` code decoded into one vec3 attribute (slot,
 * variation, occlusion), its moving parts (`<meshId>.<part>`, origin at the hinge) and its `light_*` / `fx_*` points.
 * The decoded kits stay cached for the session (CPU side); a room's GPU copies are freed when the party leaves it for a
 * room that does not use them. A missing file is never requested (the model index lists what exists); the room falls
 * back to the grey box, piece by piece.
 */

export interface KitPart {
  /** The part's name after the piece's (`lid`, `gate`). */
  name: string
  geometry: THREE.BufferGeometry
  /** The part's transform in the piece's space at rest (its origin is the hinge). */
  rest: THREE.Matrix4
}

export interface KitLight {
  /** In the piece's space. */
  position: THREE.Vector3
  /** The empty's own `color` extra, if it has one. */
  color: number | null
  /** The empty's own `size` extra (the flame's height, metres), if it has one. */
  size: number | null
}

export interface KitPiece {
  meshId: string
  /** Where it goes (the kit's `mount` extra): tile, shell, corner, floor, wall, ceiling; null when it does not say. */
  mount: string | null
  /** The floor it opens, [x0, z0, x1, z1] in its own space (the stairs down's pit), when the kit says. */
  hole: [number, number, number, number] | null
  /** Drawn see-through at this opacity (mist, webs), when the kit says. */
  translucent: number | null
  /** What it is to a room (the kit's `role`: shell, wall-hung, decal, prop …), null when it does not say. */
  role: string | null
  /** The static geometry (null for a piece that is only parts and points). */
  geometry: THREE.BufferGeometry | null
  /** Its water: slot-15 faces with their opacity in the `gvAlpha` attribute (the Vault's pools, falls and basins). */
  water: THREE.BufferGeometry | null
  parts: KitPart[]
  lights: KitLight[]
  fx: THREE.Vector3[]
  /** Each fx point's kind (`motes`, `drip`, `vent`, `moonbeam`), in the same order. */
  fxKinds: string[]
  /** Of the static geometry and the parts at rest, in the piece's space. */
  bounds: THREE.Box3
  triangles: number
}

export interface ZoneKit {
  zone: string
  pieces: Map<string, KitPiece>
}

/** Blender's duplicate suffix (`.001`) is not part of a name. */
function cleanName(o: THREE.Object3D): string {
  const raw = typeof o.userData.name === 'string' && o.userData.name ? o.userData.name : o.name
  return raw.replace(/\.\d{3}$/, '')
}

const PIECE_NAME = /^(shr|cel|cry|vlt)_[a-z0-9_]+$/i

const LIGHT_NAME = /^light([_.-]|$)/i
const FX_NAME = /^fx([_.-]|$)/i

function hasMesh(o: THREE.Object3D): boolean {
  let found = false
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) found = true
  })
  return found
}

interface Acc {
  pos: number[]
  nor: number[]
  gv: number[]
  /** COLOR_0.A per vertex (water's opacity; 1 everywhere else). */
  alpha: number[]
  idx: number[]
  count: number
}

/** The palette slot of water and liquid (the contract's slot 15). */
const WATER_SLOT = 15

const tv = new THREE.Vector3()
const tn = new THREE.Vector3()
const nm = new THREE.Matrix3()

/** Appends a mesh's triangles to `acc`, moved by `m`, its COLOR_0 decoded to (slot, variation, occlusion). */
function append(acc: Acc, mesh: THREE.Mesh, m: THREE.Matrix4): void {
  const g = mesh.geometry
  const pos = g.getAttribute('position') as THREE.BufferAttribute | undefined
  if (!pos) return
  const nor = g.getAttribute('normal') as THREE.BufferAttribute | undefined
  const col = (g.getAttribute('color') ?? g.getAttribute('color_0')) as THREE.BufferAttribute | undefined
  nm.getNormalMatrix(m)
  const start = acc.count
  for (let i = 0; i < pos.count; i++) {
    tv.fromBufferAttribute(pos, i).applyMatrix4(m)
    acc.pos.push(tv.x, tv.y, tv.z)
    if (nor) tn.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize()
    else tn.set(0, 1, 0)
    acc.nor.push(tn.x, tn.y, tn.z)
    if (col) acc.gv.push(envSlot(col.getX(i)), col.getY(i), col.itemSize >= 3 ? col.getZ(i) : 1)
    else acc.gv.push(0, 0.5, 1)
    acc.alpha.push(col && col.itemSize >= 4 ? col.getW(i) : 1)
  }
  const flip = m.determinant() < 0
  const tri = (a: number, b: number, c: number) => (flip ? acc.idx.push(start + a, start + c, start + b) : acc.idx.push(start + a, start + b, start + c))
  if (g.index) for (let i = 0; i + 2 < g.index.count; i += 3) tri(g.index.getX(i), g.index.getX(i + 1), g.index.getX(i + 2))
  else for (let i = 0; i + 2 < pos.count; i += 3) tri(i, i + 1, i + 2)
  acc.count += pos.count
}

/** The accumulated triangles (`only` of them, when given) as a geometry: positions, normals, the gv code, and the alpha when asked. */
function build(acc: Acc, only: readonly number[] | null = null, withAlpha = false): THREE.BufferGeometry | null {
  const tris = only ?? acc.idx
  if (acc.count === 0 || tris.length === 0) return null
  // Only the vertices these triangles use, re-indexed.
  const map = new Int32Array(acc.count).fill(-1)
  const pos: number[] = []
  const nor: number[] = []
  const gv: number[] = []
  const alpha: number[] = []
  const idx: number[] = []
  for (const v of tris) {
    let m = map[v]!
    if (m < 0) {
      m = map[v] = pos.length / 3
      pos.push(acc.pos[v * 3]!, acc.pos[v * 3 + 1]!, acc.pos[v * 3 + 2]!)
      nor.push(acc.nor[v * 3]!, acc.nor[v * 3 + 1]!, acc.nor[v * 3 + 2]!)
      gv.push(acc.gv[v * 3]!, acc.gv[v * 3 + 1]!, acc.gv[v * 3 + 2]!)
      alpha.push(acc.alpha[v] ?? 1)
    }
    idx.push(m)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute(ENV_ATTRIBUTE, new THREE.Float32BufferAttribute(gv, 3))
  if (withAlpha) g.setAttribute(ENV_ALPHA, new THREE.Float32BufferAttribute(alpha, 1))
  const n = pos.length / 3
  g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1))
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

/**
 * A piece's triangles split: water (slot-15 faces, drawn see-through by their vertex alpha) and the rest. Water is
 * split off when the kit says the piece has it, or when any of its slot-15 vertices is less than opaque.
 */
function splitWater(acc: Acc, water: boolean): { solid: THREE.BufferGeometry | null; water: THREE.BufferGeometry | null } {
  const slot = (v: number) => Math.round(acc.gv[v * 3]!)
  let has = water
  if (!has) for (let v = 0; v < acc.count; v++) if (slot(v) === WATER_SLOT && (acc.alpha[v] ?? 1) < 0.999) has = true
  if (!has) return { solid: build(acc), water: null }
  const solid: number[] = []
  const wet: number[] = []
  for (let t = 0; t + 2 < acc.idx.length; t += 3) {
    const a = acc.idx[t]!
    const b = acc.idx[t + 1]!
    const c = acc.idx[t + 2]!
    ;(slot(a) === WATER_SLOT && slot(b) === WATER_SLOT && slot(c) === WATER_SLOT ? wet : solid).push(a, b, c)
  }
  return { solid: build(acc, solid), water: build(acc, wet, true) }
}

function newAcc(): Acc {
  return { pos: [], nor: [], gv: [], alpha: [], idx: [], count: 0 }
}

function hexOf(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v.trim())) return Number.parseInt(v.trim().replace('#', ''), 16)
  if (Array.isArray(v) && v.length >= 3 && v.every((x) => typeof x === 'number')) return new THREE.Color(v[0] as number, v[1] as number, v[2] as number).getHex()
  return null
}

/**
 * A loaded kit file read into pieces. A piece is an object named by its meshId (`kind: "kit"` in its extras, or a
 * `shr_ / cel_ / cry_ / vlt_` name, or a name the zone file lists); its parts are the objects named `<meshId>.<part>`
 * (children or not); its points the `light_*` and `fx_*` empties under it.
 */
export function readKit(root: THREE.Object3D, zone: string, info: EnvZoneInfo | null = null): ZoneKit {
  root.updateMatrixWorld(true)
  const all: THREE.Object3D[] = []
  root.traverse((o) => all.push(o))
  const isPieceRoot = (o: THREE.Object3D): boolean => {
    const name = cleanName(o)
    if (!name || name.includes('.')) return false
    if (o.userData.kind === 'kit') return true
    if (info?.pieces.has(name)) return true
    return PIECE_NAME.test(name) && hasMesh(o)
  }
  const roots = all.filter((o) => {
    if (!isPieceRoot(o)) return false
    // The outermost wins: a piece inside a piece is part of it.
    for (let p = o.parent; p; p = p.parent) if (isPieceRoot(p)) return false
    return true
  })
  const byName = new Map<string, THREE.Object3D[]>()
  for (const o of all) {
    const n = cleanName(o)
    const list = byName.get(n)
    if (list) list.push(o)
    else byName.set(n, [o])
  }
  const pieces = new Map<string, KitPiece>()
  for (const r of roots) {
    const meshId = cleanName(r)
    if (pieces.has(meshId)) continue
    const inv = new THREE.Matrix4().copy(r.matrixWorld).invert()
    // Parts: objects named `<meshId>.<part>` anywhere (a child of the piece, or beside it), or marked `kind: part, of: <meshId>`.
    const partRoots: { name: string; obj: THREE.Object3D }[] = []
    for (const [n, objs] of byName) {
      if (!n.startsWith(`${meshId}.`)) continue
      const part = n.slice(meshId.length + 1)
      if (part && objs[0]) partRoots.push({ name: part, obj: objs[0] })
    }
    for (const o of all) {
      if (o.userData.kind !== 'part' || (o.userData.of !== meshId && o.userData.piece !== meshId) || partRoots.some((p) => p.obj === o)) continue
      partRoots.push({ name: typeof o.userData.part === 'string' ? o.userData.part : cleanName(o), obj: o })
    }
    const partSet = new Set(partRoots.map((p) => p.obj))
    const acc = newAcc()
    const lights: KitLight[] = []
    const fx: THREE.Vector3[] = []
    const fxKinds: string[] = []
    const visit = (o: THREE.Object3D) => {
      const n = cleanName(o)
      if (o !== r && (LIGHT_NAME.test(n) || o.userData.kind === 'light')) {
        const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)
        // Its tone (`tone: corpse`: a cold green candle) or else its kind (`light: torch …`) says its colour and its flame's height.
        const toned = typeof o.userData.tone === 'string' ? lightKind(o.userData.tone, zone as KitZone) : null
        const kinded = typeof o.userData.light === 'string' ? lightKind(o.userData.light, zone as KitZone) : null
        const kind = toned ? { color: toned.color, size: kinded?.size ?? toned.size } : kinded
        const size = typeof o.userData.size === 'number' && Number.isFinite(o.userData.size) ? o.userData.size : (kind?.size ?? null)
        lights.push({ position: new THREE.Vector3().setFromMatrixPosition(m), color: hexOf(o.userData.color) ?? kind?.color ?? null, size })
      } else if (o !== r && (FX_NAME.test(n) || o.userData.kind === 'fx')) {
        const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)
        fx.push(new THREE.Vector3().setFromMatrixPosition(m))
        fxKinds.push(typeof o.userData.fx === 'string' ? o.userData.fx : 'motes')
      } else if ((o as THREE.Mesh).isMesh) {
        append(acc, o as THREE.Mesh, new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld))
      }
      // A part is read on its own below (its geometry in its hinge's space).
      for (const c of o.children) if (!partSet.has(c)) visit(c)
    }
    visit(r)
    const parts: KitPart[] = []
    for (const { name, obj } of partRoots) {
      const pInv = new THREE.Matrix4().copy(obj.matrixWorld).invert()
      const pacc = newAcc()
      obj.traverse((o) => {
        const n = cleanName(o)
        if (o !== obj && (LIGHT_NAME.test(n) || FX_NAME.test(n) || o.userData.kind === 'light' || o.userData.kind === 'fx')) {
          const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)
          const kind = (typeof o.userData.tone === 'string' ? lightKind(o.userData.tone, zone as KitZone) : null) ?? (typeof o.userData.light === 'string' ? lightKind(o.userData.light, zone as KitZone) : null)
          if (LIGHT_NAME.test(n) || o.userData.kind === 'light') lights.push({ position: new THREE.Vector3().setFromMatrixPosition(m), color: hexOf(o.userData.color) ?? kind?.color ?? null, size: kind?.size ?? null })
          else {
            fx.push(new THREE.Vector3().setFromMatrixPosition(m))
            fxKinds.push(typeof o.userData.fx === 'string' ? o.userData.fx : 'motes')
          }
        } else if ((o as THREE.Mesh).isMesh) append(pacc, o as THREE.Mesh, new THREE.Matrix4().multiplyMatrices(pInv, o.matrixWorld))
      })
      const geometry = build(pacc)
      if (geometry) parts.push({ name, geometry, rest: new THREE.Matrix4().multiplyMatrices(inv, obj.matrixWorld) })
    }
    const split = splitWater(acc, r.userData.role === 'water' || info?.pieces.get(meshId)?.water === true)
    const geometry = split.solid
    const water = split.water
    const bounds = new THREE.Box3()
    if (geometry?.boundingBox) bounds.union(geometry.boundingBox)
    if (water?.boundingBox) bounds.union(water.boundingBox)
    for (const p of parts) if (p.geometry.boundingBox) bounds.union(p.geometry.boundingBox.clone().applyMatrix4(p.rest))
    if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5))
    const tris = (g: THREE.BufferGeometry | null) => (g?.index ? g.index.count / 3 : 0)
    const mount = typeof r.userData.mount === 'string' ? r.userData.mount : (info?.pieces.get(meshId)?.mount ?? null)
    const hole = readHole(r.userData.hole) ?? info?.pieces.get(meshId)?.hole ?? null
    const pinfo = info?.pieces.get(meshId)
    const translucent = typeof r.userData.translucent === 'number' && r.userData.translucent > 0 && r.userData.translucent < 1 ? r.userData.translucent : (pinfo?.translucent ?? null)
    const role = typeof r.userData.role === 'string' ? r.userData.role : (pinfo?.role ?? null)
    pieces.set(meshId, { meshId, mount, hole, translucent, role, geometry, water, parts, lights, fx, fxKinds, bounds, triangles: tris(geometry) + tris(water) + parts.reduce((s, p) => s + tris(p.geometry), 0) })
  }
  return { zone, pieces }
}

/* ---------- the library ---------- */

/** What a room of one zone draws with: its zone's kit, the shared kit, the zone's palette and shell. */
export interface EnvSet {
  zone: KitZone
  kit: ZoneKit | null
  shared: ZoneKit | null
  info: EnvZoneInfo
  piece(meshId: string): KitPiece | null
}

function makeSet(zone: KitZone, kit: ZoneKit | null, shared: ZoneKit | null, info: EnvZoneInfo | null): EnvSet {
  const palette = info?.palette ?? [...FALLBACK_PALETTE[zone]]
  const full: EnvZoneInfo = info ?? { zone, palette, shell: EMPTY_SHELL, pieces: new Map(), floorMix: new Map(), substitute: new Map(), doorSkins: new Map() }
  return {
    zone,
    kit,
    shared,
    info: full,
    piece: (id) => kit?.pieces.get(id) ?? shared?.pieces.get(id) ?? null,
  }
}

export function kitPath(zone: string): string {
  return `env/kit_${zone}.glb`
}

/** Loads (once) and keeps the decoded kits; `peek` answers synchronously for a room being built now. */
export class EnvLibrary {
  private readonly kits = new Map<string, Promise<ZoneKit | null>>()
  private readonly infos = new Map<string, Promise<EnvZoneInfo | null>>()
  private readonly sets = new Map<KitZone, EnvSet | null>()
  private readonly pending = new Map<KitZone, Promise<EnvSet | null>>()
  private loader: GLTFLoader | null = null

  /** True when the zone (or the shared kit) has a file to load at all. */
  available(zone: KitZone): boolean {
    return hasModel(kitPath(zone)) || hasModel(kitPath(SHARED_KIT))
  }

  private kit(zone: string): Promise<ZoneKit | null> {
    let p = this.kits.get(zone)
    if (!p) {
      const path = kitPath(zone)
      if (!hasModel(path)) p = Promise.resolve(null)
      else {
        this.loader ??= new GLTFLoader()
        p = Promise.all([this.loader.loadAsync(modelUrl(path)), this.info(zone)])
          .then(([gltf, info]) => readKit(gltf.scene, zone, info))
          .catch((e: unknown) => {
            console.warn(`kit ${path} did not load`, e)
            return null
          })
      }
      this.kits.set(zone, p)
    }
    return p
  }

  private info(zone: string): Promise<EnvZoneInfo | null> {
    let p = this.infos.get(zone)
    if (!p) {
      p = loadJson(`env/${zone}.json`).then((j) => (j ? parseEnvZone(j, zone) : null))
      this.infos.set(zone, p)
    }
    return p
  }

  /** The zone's set when it has loaded (null: nothing to load), undefined while it loads or before it is asked for. */
  peek(zone: KitZone): EnvSet | null | undefined {
    return this.sets.get(zone)
  }

  /** Loads the zone's set (its kit, the shared kit, its JSON); null when neither kit exists. */
  load(zone: KitZone): Promise<EnvSet | null> {
    const done = this.sets.get(zone)
    if (done !== undefined) return Promise.resolve(done)
    let p = this.pending.get(zone)
    if (!p) {
      p = Promise.all([this.kit(zone), this.kit(SHARED_KIT), this.info(zone)]).then(([kit, shared, info]) => {
        const set = kit || shared ? makeSet(zone, kit, shared, info) : null
        this.sets.set(zone, set)
        this.pending.delete(zone)
        return set
      })
      this.pending.set(zone, p)
    }
    return p
  }
}

/** The app's one kit library. */
export const envLibrary = new EnvLibrary()
