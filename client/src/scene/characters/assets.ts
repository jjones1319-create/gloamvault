import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { BodyFrame } from '../../../../sim/src/types/enums.ts'
import { ClipLibrary } from './animator.ts'
import { clipsHipsHeight, parseClipsJson, parseManifest, type HeroManifest } from './manifest.ts'
import { frameTemplate, meshesOf, type FrameTemplate } from './template.ts'
import MODEL_INDEX from './modelIndex.json'

/**
 * The hero files (tools/blender/README.md §Exports), loaded once each and shared by every character: URLs from
 * `import.meta.env.BASE_URL` with the content hash of `modelIndex.json` (the service worker caches models CacheFirst,
 * so a rebuilt model needs a new URL). A file the index does not list is never requested — the passes that build it
 * may not have landed yet — and everything that needs it degrades: no gear file for a class, the nearest set of the
 * same armor family (else a bare body); no weapons file, empty hands; no clips, a breathing idle; no hero file, the
 * placeholder capsule stays.
 */
const INDEX = MODEL_INDEX as Readonly<Record<string, string>>

export function hasModel(path: string): boolean {
  return INDEX[path] !== undefined
}

export function modelUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/'
  return `${base}models/${path}?v=${INDEX[path] ?? '0'}`
}

const gltfCache = new Map<string, Promise<GLTF | null>>()
const jsonCache = new Map<string, Promise<unknown>>()
let loader: GLTFLoader | null = null

export function loadGltf(path: string): Promise<GLTF | null> {
  let p = gltfCache.get(path)
  if (!p) {
    if (!hasModel(path)) p = Promise.resolve(null)
    else {
      loader ??= new GLTFLoader()
      p = loader.loadAsync(modelUrl(path)).catch((e: unknown) => {
        console.warn(`model ${path} did not load`, e)
        return null
      })
    }
    gltfCache.set(path, p)
  }
  return p
}

export function loadJson(path: string): Promise<unknown> {
  let p = jsonCache.get(path)
  if (!p) {
    p = hasModel(path)
      ? fetch(modelUrl(path))
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      : Promise.resolve(null)
    jsonCache.set(path, p)
  }
  return p
}

/** The hero files, loaded on first use and kept for the session (they are CPU-side templates, never drawn). */
export class HeroLibrary {
  private readonly frames = new Map<BodyFrame, Promise<FrameTemplate | null>>()
  private readonly gearMeshes = new Map<string, Promise<Map<string, THREE.Mesh> | null>>()
  private weaponMeshes: Promise<Map<string, THREE.Mesh> | null> | null = null
  private manifestP: Promise<HeroManifest | null> | null = null
  private clipsP: Promise<ClipLibrary | null> | null = null

  frame(frame: BodyFrame): Promise<FrameTemplate | null> {
    let p = this.frames.get(frame)
    if (!p) {
      p = loadGltf(`hero/hero_${frame}.glb`).then((g) => (g ? frameTemplate(frame, g) : null))
      this.frames.set(frame, p)
    }
    return p
  }

  hasGear(classId: string, frame: BodyFrame): boolean {
    return hasModel(`hero/gear_${classId}_${frame}.glb`)
  }

  gear(classId: string, frame: BodyFrame): Promise<Map<string, THREE.Mesh> | null> {
    const key = `${classId}:${frame}`
    let p = this.gearMeshes.get(key)
    if (!p) {
      p = loadGltf(`hero/gear_${classId}_${frame}.glb`).then((g) => (g ? meshesOf(g) : null))
      this.gearMeshes.set(key, p)
    }
    return p
  }

  weapons(): Promise<Map<string, THREE.Mesh> | null> {
    this.weaponMeshes ??= loadGltf('hero/weapons.glb').then((g) => (g ? meshesOf(g) : null))
    return this.weaponMeshes
  }

  manifest(): Promise<HeroManifest | null> {
    this.manifestP ??= loadJson('hero/manifest.json').then((j) => (j ? parseManifest(j) : null))
    return this.manifestP
  }

  /** The shared clips (hero_clips.glb + clips.json), or null while the clips pass has not landed. */
  clips(): Promise<ClipLibrary | null> {
    this.clipsP ??= Promise.all([loadGltf('hero/hero_clips.glb'), loadJson('hero/clips.json'), this.frame('broad')]).then(([g, json, broad]) => {
      if (!g || g.animations.length === 0) return null
      const info = parseClipsJson(json)
      // The clips were authored on the broad rig: its Hips rest is the reference the Hips track is scaled from.
      let srcHips: THREE.Vector3 | null = null
      g.scene.traverse((o) => {
        if (o.name === 'Hips' && !srcHips) srcHips = o.position.clone()
      })
      const bones = new Set<string>(broad?.boneNames ?? [])
      if (bones.size === 0) g.scene.traverse((o) => (o as THREE.Bone).isBone && bones.add(o.name))
      const height = clipsHipsHeight(json)
      const fallback = broad?.hipsRest.clone() ?? new THREE.Vector3(0, 0.885, 0)
      if (height) fallback.y = height
      return new ClipLibrary(g.animations, info, srcHips ?? fallback, bones)
    })
    return this.clipsP
  }
}

/** The app's one library: every screen shares the loaded files. */
export const heroLibrary = new HeroLibrary()
