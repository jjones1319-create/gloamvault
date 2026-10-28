/**
 * Readers for the hero pipeline's JSON sidecars (tools/blender/README.md): `manifest.json` (the species' face presets,
 * skin tones, hair colours, bone scales — written by the species pass) and `clips.json` (each clip's length, loop
 * flag and event times — written by the clips pass). Both are read tolerantly: a missing or odd field falls back to
 * the content (species skin tones and bone scales) or to nothing, never to a crash. Pure.
 */

/** A face preset: weights over the twelve shared `face_*` keys plus the parts it picks (hair, brows, beard …). */
export interface FacePreset {
  name: string
  face: Record<string, number>
  parts: string[]
  /** The preset's suggested tints, as indexes: skin, hair (or bone, for the Draconid), eye. */
  tint: Record<string, number>
}

export interface ManifestSpecies {
  presets: FacePreset[]
  skinTones: string[]
  hair: string[]
  iris: string[]
  /** Horn, claw, tusk and nail colours (the bone slot); a species with no hair picks among these instead. */
  bone: string[]
  boneScales: Record<string, number> | null
  /** Every part the species has (the presets pick from these). */
  parts: string[]
}

export interface HeroManifest {
  species: Map<string, ManifestSpecies>
}

const HEX = /^#[0-9a-f]{6}$/i

function obj(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function pick(o: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const k of keys) if (o[k] !== undefined) return o[k]
  return undefined
}

function colours(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((c) => (typeof c === 'string' ? c : obj(c) ? (pick(obj(c)!, ['hex', 'colour', 'color', 'value']) as string | undefined) : undefined))
    .filter((c): c is string => typeof c === 'string' && HEX.test(c))
    .map((c) => c.toLowerCase())
}

function strings(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((s): s is string => typeof s === 'string' && s.length > 0)
  if (typeof v === 'string') return v.split(/[\s,]+/).filter(Boolean)
  return []
}

function weights(v: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  const o = obj(v)
  if (o) {
    for (const [k, w] of Object.entries(o)) if (typeof w === 'number' && Number.isFinite(w)) out[k] = w
  } else if (Array.isArray(v)) {
    // [{ key, weight }] or [[key, weight]]
    for (const e of v) {
      if (Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'number') out[e[0]] = e[1]
      const eo = obj(e)
      if (eo) {
        const k = pick(eo, ['key', 'name', 'shapeKey'])
        const w = pick(eo, ['weight', 'value'])
        if (typeof k === 'string' && typeof w === 'number' && Number.isFinite(w)) out[k] = w
      }
    }
  }
  return out
}

function preset(v: unknown, i: number): FacePreset | null {
  const o = obj(v)
  if (!o) return null
  const face = weights(pick(o, ['face', 'weights', 'faceWeights', 'keys', 'shapeKeys', 'morphs']))
  // A flat preset: the face_* weights at the top level.
  if (Object.keys(face).length === 0) for (const [k, w] of Object.entries(o)) if (k.startsWith('face_') && typeof w === 'number') face[k] = w
  const name = pick(o, ['name', 'id', 'label'])
  const tint: Record<string, number> = {}
  const t = obj(o.tint)
  if (t) for (const [k, v] of Object.entries(t)) if (typeof v === 'number' && Number.isInteger(v) && v >= 0) tint[k] = v
  return { name: typeof name === 'string' ? name : `Preset ${i + 1}`, face, parts: strings(pick(o, ['parts', 'partChoices', 'meshes'])), tint }
}

function scales(v: unknown): Record<string, number> | null {
  const o = obj(v)
  if (!o) return null
  const out: Record<string, number> = {}
  for (const [k, w] of Object.entries(o)) if (typeof w === 'number' && Number.isFinite(w)) out[k] = w
  return Object.keys(out).length ? out : null
}

function speciesEntry(v: unknown): ManifestSpecies | null {
  const o = obj(v)
  if (!o) return null
  const rawPresets = pick(o, ['presets', 'facePresets', 'faces'])
  const presets = Array.isArray(rawPresets) ? rawPresets.map(preset).filter((p): p is FacePreset => p !== null) : []
  return {
    presets,
    skinTones: colours(pick(o, ['skinTones', 'skin', 'skins'])),
    hair: colours(pick(o, ['hair', 'hairColours', 'hairColors', 'hairTones'])),
    iris: colours(pick(o, ['iris', 'irisColours', 'irisColors', 'eyes', 'eyeColours', 'eyeColors'])),
    bone: colours(pick(o, ['boneColors', 'boneColours', 'bone', 'horn', 'hornColors'])),
    boneScales: scales(pick(o, ['boneScales', 'bones'])),
    parts: strings(pick(o, ['parts'])),
  }
}

/** manifest.json → species by id. Accepts `species` as an object keyed by id or as a list of `{ id, … }`. */
export function parseManifest(json: unknown): HeroManifest {
  const species = new Map<string, ManifestSpecies>()
  const root = obj(json)
  const raw = root ? root.species : undefined
  if (Array.isArray(raw)) {
    for (const e of raw) {
      const id = obj(e)?.id
      const entry = speciesEntry(e)
      if (typeof id === 'string' && entry) species.set(id, entry)
    }
  } else if (obj(raw)) {
    for (const [id, e] of Object.entries(obj(raw)!)) {
      const entry = speciesEntry(e)
      if (entry) species.set(id, entry)
    }
  }
  return { species }
}

/** One clip's sidecar line (clips.json: `{name, seconds, loop, events: {hit: 0.42, …}}`). */
export interface ClipInfo {
  name: string
  seconds: number
  loop: boolean
  /** Event name → seconds from the clip's start (hit, release, footfalls …). */
  events: Record<string, number>
  /** Ground speed of a locomotion loop (m/s on the authoring rig), when given. */
  speed?: number
}

function clipEntry(v: unknown, fallbackName?: string): ClipInfo | null {
  const o = obj(v)
  if (!o) return null
  const name = typeof o.name === 'string' ? o.name : fallbackName
  if (!name) return null
  const seconds = typeof o.seconds === 'number' ? o.seconds : typeof o.duration === 'number' ? o.duration : 0
  const events: Record<string, number> = {}
  const ev = o.events
  if (obj(ev)) {
    for (const [k, t] of Object.entries(obj(ev)!)) {
      if (typeof t === 'number' && Number.isFinite(t)) events[k] = t
      else if (Array.isArray(t) && typeof t[0] === 'number') events[k] = t[0]
    }
  } else if (Array.isArray(ev)) {
    for (const e of ev) {
      const eo = obj(e)
      const k = eo ? pick(eo, ['name', 'event', 'kind']) : undefined
      const t = eo ? pick(eo, ['seconds', 'time', 't', 'at']) : undefined
      if (typeof k === 'string' && typeof t === 'number' && events[k] === undefined) events[k] = t
    }
  }
  const out: ClipInfo = { name, seconds: Math.max(0, seconds), loop: o.loop === true, events }
  if (typeof o.speed === 'number' && Number.isFinite(o.speed) && o.speed > 0) out.speed = o.speed
  return out
}

/** clips.json's `hipsHeight`: the authoring rig's Hips rest height, when given. */
export function clipsHipsHeight(json: unknown): number | null {
  const h = obj(json)?.hipsHeight
  return typeof h === 'number' && Number.isFinite(h) && h > 0.1 ? h : null
}

/** clips.json → clip info by name. Accepts a list, `{ clips: [...] }` or an object keyed by clip name. */
export function parseClipsJson(json: unknown): Map<string, ClipInfo> {
  const out = new Map<string, ClipInfo>()
  const root = obj(json)
  const list = Array.isArray(json) ? json : root && Array.isArray(root.clips) ? root.clips : null
  if (list) {
    for (const e of list) {
      const c = clipEntry(e)
      if (c) out.set(c.name, c)
    }
  } else {
    const keyed = root && obj(root.clips) ? obj(root.clips)! : root
    if (keyed) {
      for (const [name, e] of Object.entries(keyed)) {
        const c = clipEntry(e, name)
        if (c) out.set(c.name, c)
      }
    }
  }
  return out
}
