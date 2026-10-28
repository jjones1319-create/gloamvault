/**
 * The monster pipeline's sidecars (tools/blender/README.md → *Phase 6 → Monsters*): `models/monsters/manifest.json`, the
 * variant table — per monster id (and per pet) `{ base, scale, parts, shapes, palette, clipSpeed, clips?, instances? }` —
 * and `models/monsters/clips.json`, each base's clips with their event times (`hit`, `release`, `down`). Both are read
 * tolerantly (a missing field falls back, an odd one is skipped, nothing throws), and which monster or pet gets which
 * variant is decided here: the manifest's entry, else the content's `visual` (base mesh, scale, palette) on the base's
 * body alone. Pure, tested in node.
 */
import { clipEntry, type ClipInfo } from '../characters/manifest.ts'

/** One copy of the base round the monster: where it stands (metres, the monster's own space, glTF axes), how it is turned. */
export interface InstanceSpot {
  x: number
  y: number
  z: number
  /** A quaternion [x, y, z, w] when the manifest gives one; else `yaw` about +y. */
  quaternion: [number, number, number, number] | null
  yaw: number
  scale: number
  /** Seconds its clips run ahead of the others (so the copies do not move in step). */
  clipOffset: number
  /** The base's mesh the copy shows (its body when unnamed). */
  mesh: string | null
}

/** Copies of the base around the monster (the Deep Maw's tentacles round its maw plate). */
export interface MonsterInstances {
  spots: InstanceSpot[]
}

export interface MonsterVariant {
  /** The monster (or pet) id. */
  id: string
  /** `models/monsters/<base>.glb`. */
  base: string
  scale: number
  /** The parts shown (`<base>_<part>`, or the full mesh name); null when the entry names none (every part shows). */
  parts: string[] | null
  /** Shape keys baked at assembly (`var_*` → weight). */
  shapes: Record<string, number>
  /** Slots 0, 1, 2: main, secondary, accent (#rrggbb). */
  palette: string[]
  /** The entry's own colours for other slots (`slots: { "11": "#c8f08a" }`: a leech's glowing mouth; `glow` is slot 11). */
  slots: Record<number, string>
  /** A full 16-colour palette (the humanoid costumes give one), used as it is. */
  colors: string[] | null
  /** Its clips on the hero rig by its own names (`clipMap: { Attack1: "Shoot", Rise: "Revive" }`). */
  clipMap: Record<string, string> | null
  /** Hero-rig bone-group scales (a Ghoul's long arms), as a species' are. */
  boneScales: Record<string, number> | null
  /** A posture over every clip: bone → quaternion [x, y, z, w] turned on after the clip (`poseAdd`), or held from rest (`poseHold`). */
  poseAdd: Record<string, [number, number, number, number]> | null
  poseHold: Record<string, [number, number, number, number]> | null
  /** Drawn see-through (the Warden's Hound). */
  ghost: boolean
  /** Added to the Hips joint after every clip (glTF axes, metres at scale 1): the Hollow King seated. */
  hipsOffset: [number, number, number] | null
  /** Unskinned meshes drawn at the monster's origin, scaled with it (the Hollow King's throne and its column). */
  rigidProps: string[]
  /** The throne's column and how far a later phase raises the seat on it (metres at scale 1); null without a throne. */
  throne: { column: string | null; columnHeight: number; raised: boolean } | null
  /** Which of the boss's phases this look is (1 unless the fight has moved on). */
  phase: number
  /** The manifest's entry as written (a later phase's look is built from it). */
  raw: Record<string, unknown> | null
  /** Its standing height in metres when the manifest says (scale included). */
  height: number | null
  /** Plays every clip this much faster (a big beast slower). */
  clipSpeed: number
  /** The base lives on the hero rig and plays the hero clips (`clips: "hero"`). */
  heroClips: boolean
  instances: MonsterInstances | null
  /** The zone the manifest files it under, when it says. */
  zone: string | null
  /** A display name, when the manifest gives one. */
  name: string | null
  pet: boolean
}

export interface MonsterManifest {
  monsters: Map<string, MonsterVariant>
  pets: Map<string, MonsterVariant>
}

export const EMPTY_MANIFEST: MonsterManifest = { monsters: new Map(), pets: new Map() }

const HEX = /^#?[0-9a-f]{6}$/i
/** The bases built on the hero rig (the contract's list), which play the hero clips even when an entry forgets to say so. */
export const HERO_RIG_BASES: ReadonlySet<string> = new Set(['humanoid', 'skeleton', 'zombie', 'sentinel', 'hollow-king'])
/** 06 §9: pet babies reuse their family's base at a reduced scale. */
export const PET_SCALE: Readonly<Record<string, number>> = { hound: 0.7, rat: 0.6, spider: 0.3, bat: 0.6, wisp: 0.8, crab: 0.5, imp: 0.6 }

function obj(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function num(v: unknown, fallback: number, min = 0.01, max = 100): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
}

function hexes(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const c of v) {
    const s = typeof c === 'string' ? c.trim() : obj(c) && typeof obj(c)!.hex === 'string' ? String(obj(c)!.hex).trim() : ''
    if (HEX.test(s)) out.push((s.startsWith('#') ? s : `#${s}`).toLowerCase())
  }
  return out
}

function strings(v: unknown): string[] | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') return v.split(/[\s,]+/).filter(Boolean)
  if (Array.isArray(v)) return v.filter((s): s is string => typeof s === 'string' && s.length > 0)
  const o = obj(v)
  // `{ crown: true, ears: false }`: the parts switched on.
  if (o) return Object.entries(o).filter(([, on]) => on === true || (typeof on === 'number' && on > 0)).map(([k]) => k)
  return null
}

function weights(v: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  const o = obj(v)
  if (o) for (const [k, w] of Object.entries(o)) if (typeof w === 'number' && Number.isFinite(w)) out[k] = w
  if (Array.isArray(v)) for (const k of v) if (typeof k === 'string') out[k] = 1
  return out
}

/**
 * `instances`: a count (a ring), `{ count, radius }`, or a list of `{ mesh, position: [x, y, z], rotation: [qx, qy, qz,
 * qw] | rotationY (degrees), scale, clipOffset }` (the monster pass writes the list).
 */
export function readInstances(v: unknown): MonsterInstances | null {
  const ring = (count: number, radius: number, scale: number): MonsterInstances => ({
    spots: Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2
      // Each copy leans out from the centre, facing away from it.
      return { x: Math.sin(a) * radius, y: 0, z: Math.cos(a) * radius, quaternion: null, yaw: a, scale, clipOffset: i * 0.37, mesh: null }
    }),
  })
  if (typeof v === 'number' && Number.isFinite(v) && v >= 1) return ring(Math.min(12, Math.round(v)), 1.1, 1)
  const o = obj(v)
  if (o) {
    const count = num(o.count ?? o.n, 0, 0, 12)
    if (count >= 1) return ring(Math.round(count), num(o.radius ?? o.r, 1.1, 0, 20), num(o.scale, 1))
  }
  if (Array.isArray(v)) {
    const spots: MonsterInstances['spots'] = []
    for (const e of v.slice(0, 12)) {
      const eo = obj(e)
      if (!eo) continue
      const p = Array.isArray(eo.position) ? eo.position : [eo.x, eo.y, eo.z]
      const at = (i: number) => (typeof p[i] === 'number' && Number.isFinite(p[i]) ? (p[i] as number) : 0)
      const r = eo.rotation
      const quaternion = Array.isArray(r) && r.length === 4 && r.every((n) => typeof n === 'number' && Number.isFinite(n)) ? (r as [number, number, number, number]) : null
      const deg = typeof eo.rotationY === 'number' ? eo.rotationY : typeof eo.yaw === 'number' ? eo.yaw : 0
      spots.push({ x: at(0), y: at(1), z: at(2), quaternion, yaw: (deg * Math.PI) / 180, scale: num(eo.scale, 1), clipOffset: num(eo.clipOffset, 0, 0, 30), mesh: typeof eo.mesh === 'string' ? eo.mesh : null })
    }
    return spots.length ? { spots } : null
  }
  return null
}

/** `slots: { "11": "#c8f08a" }` → slot index → colour (indexes 0–15, hex colours only). */
function slotColours(v: unknown): Record<number, string> {
  const out: Record<number, string> = {}
  const o = obj(v)
  if (!o) return out
  for (const [k, c] of Object.entries(o)) {
    const i = Number(k)
    const s = typeof c === 'string' ? c.trim() : ''
    if (Number.isInteger(i) && i >= 0 && i < 16 && HEX.test(s)) out[i] = (s.startsWith('#') ? s : `#${s}`).toLowerCase()
  }
  return out
}

function stringMap(v: unknown): Record<string, string> | null {
  const o = obj(v)
  if (!o) return null
  const out: Record<string, string> = {}
  for (const [k, s] of Object.entries(o)) if (typeof s === 'string' && s) out[k] = s
  return Object.keys(out).length ? out : null
}

function quaternions(v: unknown): Record<string, [number, number, number, number]> | null {
  const o = obj(v)
  if (!o) return null
  const out: Record<string, [number, number, number, number]> = {}
  for (const [bone, q] of Object.entries(o)) {
    if (Array.isArray(q) && q.length === 4 && q.every((n) => typeof n === 'number' && Number.isFinite(n))) out[bone] = q as [number, number, number, number]
  }
  return Object.keys(out).length ? out : null
}

function scales(v: unknown): Record<string, number> | null {
  const o = obj(v)
  if (!o) return null
  const out: Record<string, number> = {}
  for (const [k, n] of Object.entries(o)) if (typeof n === 'number' && Number.isFinite(n) && n > 0.2 && n < 5) out[k] = n
  return Object.keys(out).length ? out : null
}

function vec3(v: unknown): [number, number, number] | null {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n)) ? (v as [number, number, number]) : null
}

/** `props: { throne: { parts: [...], column: "…" } }` → every rigid mesh name. */
function rigidProps(v: unknown): string[] {
  const out: string[] = []
  const o = obj(v)
  if (!o) return out
  for (const p of Object.values(o)) {
    const po = obj(p)
    if (!po) continue
    for (const name of strings(po.parts) ?? []) out.push(name)
    if (typeof po.column === 'string' && po.column) out.push(po.column)
  }
  return out
}

/** The fields a boss phase may change. */
const PHASE_FIELDS = ['parts', 'scale', 'poseHold', 'poseAdd', 'hipsOffset', 'shapes', 'palette', 'clipSpeed']

/**
 * A boss's look at a phase: its entry with phases 1…n laid over it in turn — parts, scale, posture, clip speed; full
 * palettes (`colors: [16]`) replace, partial ones (`colors: { "2": "#6fa8ff" }`, the Warden's lantern turning blue)
 * colour single slots; `pose: "standing"` lets go of a seated posture (the Hollow King rises).
 */
export function phaseLook(raw: Record<string, unknown>, phase: number): Record<string, unknown> {
  const phases = obj(raw.phases)
  let o: Record<string, unknown> = { ...raw }
  if (!phases) return o
  for (let p = 1; p <= Math.max(1, phase); p++) {
    const ph = obj(phases[String(p)])
    if (!ph) continue
    o = { ...o, ...Object.fromEntries(Object.entries(ph).filter(([k]) => PHASE_FIELDS.includes(k))) }
    if (Array.isArray(ph.colors)) o.colors = ph.colors
    else if (obj(ph.colors)) o.slots = { ...(obj(o.slots) ?? {}), ...obj(ph.colors)! }
    if (ph.pose === 'standing') {
      delete o.poseHold
      delete o.hipsOffset
    }
  }
  return o
}

function entry(id: string, v: unknown, pet: boolean, phase = 1): MonsterVariant | null {
  const raw = obj(v)
  if (!raw) return null
  // A boss with phases shows its first look by default (the Hollow King seated on his throne).
  const o = phaseLook(raw, phase)
  const throneRaw = obj(obj(o.props)?.throne)
  const base = o.base ?? o.baseMesh
  if (typeof base !== 'string' || !base) return null
  const clips = o.clips
  const zone = o.zone
  const name = o.name
  const slots = slotColours(o.slots)
  const glow = typeof o.glow === 'string' && HEX.test(o.glow.trim()) ? o.glow.trim().toLowerCase() : null
  if (glow && slots[11] === undefined) slots[11] = glow.startsWith('#') ? glow : `#${glow}`
  const colors = hexes(o.colors)
  return {
    id,
    base,
    scale: num(o.scale, 1),
    parts: strings(o.parts),
    shapes: weights(o.shapes ?? o.shapeKeys),
    palette: hexes(o.palette),
    slots,
    colors: colors.length === 16 ? colors : null,
    clipMap: stringMap(o.clipMap),
    boneScales: scales(o.boneScales),
    poseAdd: quaternions(o.poseAdd),
    poseHold: quaternions(o.poseHold),
    ghost: o.ghost === true,
    hipsOffset: vec3(o.hipsOffset),
    rigidProps: rigidProps(o.props),
    throne: throneRaw ? { column: typeof throneRaw.column === 'string' ? throneRaw.column : null, columnHeight: num(throneRaw.columnHeight, 1, 0, 20), raised: phase >= 2 } : null,
    phase: Math.max(1, phase),
    raw,
    height: typeof o.height === 'number' && Number.isFinite(o.height) && o.height > 0.1 ? o.height : null,
    clipSpeed: num(o.clipSpeed, 1, 0.1, 4),
    heroClips: clips === 'hero' || HERO_RIG_BASES.has(base),
    instances: readInstances(o.instances),
    zone: typeof zone === 'string' ? zone : null,
    name: typeof name === 'string' ? name : null,
    pet: pet || o.pet === true || (typeof o.pet === 'string' && o.pet.length > 0) || o.kind === 'pet',
  }
}

/** Keys that are the file's own bookkeeping, never a monster. */
const META = new Set(['version', 'generated', 'bases', 'files', 'fps', 'note', 'notes', 'zones'])

function readSection(raw: unknown, pet: boolean, into: MonsterManifest): void {
  const add = (id: string, v: unknown, asPet: boolean) => {
    let key = id
    let isPet = asPet
    const m = /^pet[:/-](.+)$/.exec(id)
    if (m && !asPet) {
      key = m[1]!
      isPet = true
    }
    // `pet: "rat-prince"` names the pet the entry is.
    const named = obj(v)?.pet
    if (typeof named === 'string' && named) {
      key = named
      isPet = true
    }
    const e = entry(key, v, isPet)
    if (!e) return
    if (e.pet) into.pets.set(key, e)
    else into.monsters.set(key, e)
  }
  if (Array.isArray(raw)) {
    for (const v of raw) {
      const id = obj(v)?.id
      if (typeof id === 'string') add(id, v, pet)
    }
  } else {
    const o = obj(raw)
    if (o) for (const [id, v] of Object.entries(o)) if (!META.has(id)) add(id, v, pet)
  }
}

/** manifest.json → the variants by id: `{ id: entry }`, `{ monsters, pets }` (objects or lists), `pet:<id>` keys. */
export function parseMonsterManifest(json: unknown): MonsterManifest {
  const out: MonsterManifest = { monsters: new Map(), pets: new Map() }
  const root = obj(json)
  if (!root && !Array.isArray(json)) return out
  if (root && (root.monsters !== undefined || root.pets !== undefined)) {
    readSection(root.monsters, false, out)
    readSection(root.pets, true, out)
  } else readSection(json, false, out)
  return out
}

/* ---------- clips.json ---------- */

/** clips.json → clip info by base, then by clip name: `{ base: [clip…] }`, `{ base: { clip: {…} } }`, a flat list with `base`, or `"base/clip"` keys. */
export function parseMonsterClips(json: unknown): Map<string, Map<string, ClipInfo>> {
  const out = new Map<string, Map<string, ClipInfo>>()
  const put = (base: string, c: ClipInfo | null) => {
    if (!c) return
    let m = out.get(base)
    if (!m) out.set(base, (m = new Map()))
    m.set(c.name, c)
  }
  const fromList = (list: unknown[], base?: string) => {
    for (const e of list) {
      const b = base ?? (typeof obj(e)?.base === 'string' ? String(obj(e)!.base) : null)
      if (b) put(b, clipEntry(e))
    }
  }
  const root = obj(json)
  if (Array.isArray(json)) fromList(json)
  else if (root && Array.isArray(root.clips)) fromList(root.clips)
  else if (root) {
    const bases = obj(root.bases) ?? root
    for (const [key, v] of Object.entries(bases)) {
      if (META.has(key) || key === 'hipsHeight') continue
      const slash = /^([^/.]+)[/.](.+)$/.exec(key)
      if (slash) put(slash[1]!, clipEntry(v, slash[2]!))
      else if (Array.isArray(v)) fromList(v, key)
      else {
        const o = obj(v)
        if (!o) continue
        const inner = Array.isArray(o.clips) ? o.clips : obj(o.clips) ?? o
        if (Array.isArray(inner)) fromList(inner, key)
        else for (const [name, c] of Object.entries(inner)) put(key, clipEntry(c, name))
      }
    }
  }
  return out
}

/* ---------- which variant ---------- */

/** What the content says about a monster's or a pet's look (`visual`). */
export interface VisualLike {
  readonly baseMesh?: string
  readonly scale?: number
  readonly palette?: readonly string[]
}

const DEFAULT_PALETTE = ['#6a5a4a', '#d9d2c2', '#c8a040']

function fallbackVariant(id: string, visual: VisualLike, pet: boolean): MonsterVariant | null {
  const base = visual.baseMesh
  if (!base) return null
  return {
    id,
    base,
    scale: pet ? (PET_SCALE[base] ?? 0.6) : num(visual.scale, 1),
    // Without the manifest's word, the base's body alone (a costume base would otherwise wear every costume at once).
    parts: [],
    shapes: {},
    palette: hexes(visual.palette ?? []),
    slots: {},
    colors: null,
    clipMap: null,
    boneScales: null,
    poseAdd: null,
    poseHold: null,
    ghost: false,
    hipsOffset: null,
    rigidProps: [],
    throne: null,
    phase: 1,
    raw: null,
    height: null,
    clipSpeed: 1,
    heroClips: HERO_RIG_BASES.has(base),
    instances: null,
    zone: null,
    name: null,
    pet,
  }
}

function withPalette(v: MonsterVariant, visual: VisualLike | null | undefined): MonsterVariant {
  const own = v.palette.length ? v.palette : hexes(visual?.palette ?? [])
  const palette = [0, 1, 2].map((i) => own[i] ?? own[0] ?? DEFAULT_PALETTE[i]!)
  return { ...v, palette }
}

/**
 * The variant a monster is drawn as: the manifest's entry (its palette, else the content's), else the content's
 * `visual` on the base's body; null when neither names a base whose file exists (`available`) — the capsule stays.
 */
export function resolveMonsterVariant(id: string, manifest: MonsterManifest | null, visual: VisualLike | null | undefined, available: (base: string) => boolean, phase = 1): MonsterVariant | null {
  let m = manifest?.monsters.get(id) ?? manifest?.monsters.get(id.replace(/^the-/, '')) ?? null
  // A boss past its first phase: its look at that phase (the manifest's `phases`).
  if (m && phase > 1 && m.raw && obj(m.raw.phases)) m = entry(m.id, m.raw, m.pet, phase) ?? m
  const v = m ?? (visual ? fallbackVariant(id, visual, false) : null)
  if (!v || !available(v.base)) return null
  return withPalette(v, visual)
}

/** The variant a pet is drawn as: the manifest's pet entry, else its species' `visual` base at 06 §9's baby scale. */
export function resolvePetVariant(petId: string, manifest: MonsterManifest | null, visual: VisualLike | null | undefined, available: (base: string) => boolean): MonsterVariant | null {
  const m = manifest?.pets.get(petId) ?? null
  const v = m ?? (visual ? fallbackVariant(petId, visual, true) : null)
  if (!v || !available(v.base)) return null
  return withPalette(v, visual)
}

/** A stable key for everything about a variant that changes its geometry (instances of one variant share it). */
export function variantKey(v: MonsterVariant): string {
  const parts = v.parts === null ? '*' : [...v.parts].sort().join('+')
  const shapes = Object.keys(v.shapes)
    .sort()
    .map((k) => `${k}=${v.shapes[k]!.toFixed(3)}`)
    .join('+')
  const look = v.phase > 1 ? `|p${v.phase}` : ''
  const bones = v.boneScales
    ? Object.keys(v.boneScales)
        .sort()
        .map((k) => `${k}=${v.boneScales![k]!.toFixed(3)}`)
        .join('+')
    : ''
  return `${v.base}|${parts}|${shapes}${bones ? `|${bones}` : ''}${look}`
}

/**
 * Whether a mesh of the base file shows in this variant. An own-rig base: its `<base>_body` always, a part when the
 * variant lists it (every part when it lists none). A hero-rig base (`exact`): exactly the meshes the entry lists — its
 * body is a per-variant mesh among them, already cut to what the costume leaves visible.
 */
export function partShown(meshName: string, base: string, parts: readonly string[] | null, exact = false): boolean {
  const name = meshName.replace(/_\d+$/, '')
  const short = name.startsWith(`${base}_`) ? name.slice(base.length + 1) : name
  if (exact && parts !== null) return parts.includes(name) || parts.includes(short)
  if (name === `${base}_body` || name === base || name === 'body') return true
  if (parts === null) return true
  return parts.includes(short) || parts.includes(name)
}

/* ---------- clips ---------- */

/** The hero clip each monster clip is on the hero rig (the contract's mapping). */
export const HERO_CLIP_FOR: Readonly<Record<string, string>> = { Idle: 'Idle', Move: 'Walk', Attack1: 'Attack_Light', Attack2: 'Attack_Heavy', Hit: 'Hit', Death: 'Defeat', Flee: 'Run' }

/**
 * The clips to try, in order, when the scene asks a monster for a clip by the heroes' names (Walk, Attack_Light,
 * Downed …) or by its own (Move, Attack1, Death …). Special clips (Web, Howl) are asked for by name.
 */
export function monsterClipCandidates(wanted: string, heroRig: boolean): string[] {
  if (heroRig) {
    const hero = HERO_CLIP_FOR[wanted]
    if (hero) return [hero]
    if (wanted === 'Downed') return ['Defeat', 'Downed']
    return [wanted]
  }
  switch (wanted) {
    case 'Walk':
    case 'Move':
      return ['Move', 'Walk']
    case 'Run':
      return ['Run', 'Move', 'Walk']
    case 'Attack_Light':
    case 'Attack1':
      return ['Attack1', 'Attack']
    case 'Attack_Heavy':
    case 'Attack_Dual':
    case 'Attack2':
      return ['Attack2', 'Attack1', 'Attack']
    case 'Shoot':
    case 'Cast':
      return [wanted, 'Attack2', 'Attack1']
    case 'Downed':
    case 'Defeat':
    case 'Death':
      return ['Death', 'Defeat']
    case 'Flee':
      return ['Flee', 'Run', 'Move']
    default:
      return [wanted]
  }
}

/** PascalCase of an attack id (`web-shot` → `WebShot`) and of its first word (`Web`): a special clip's likely names. */
export function specialClipNames(attackId: string): string[] {
  const words = attackId.split(/[-_\s]+/).filter(Boolean)
  if (words.length === 0) return []
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)
  const full = words.map(cap).join('')
  const first = cap(words[0]!)
  return full === first ? [full] : [full, first]
}

/**
 * A monster's attack as a clip (06: Attack1 / Attack2 by the move's weight): heavier than a normal action swings
 * Attack2, the rest Attack1; a move that hits nothing (a howl, a web) asks for its own clip first, else Attack2.
 */
export function monsterAttackClip(attack: { id: string; weight: number; multiplier: number }, normalWeight: number): { clip: string; alt: string[] } {
  const alt = specialClipNames(attack.id)
  if (attack.multiplier <= 0) return { clip: 'Attack2', alt }
  return { clip: attack.weight > normalWeight ? 'Attack2' : 'Attack1', alt }
}

/** A variant's 16 colours: its full palette when it gives one, else `monsterPaletteHexes`; its own slots over either. */
export function variantPalette(v: Pick<MonsterVariant, 'palette' | 'slots' | 'colors'>): string[] {
  if (!v.colors) return monsterPaletteHexes(v.palette, v.slots)
  const out = [...v.colors]
  for (const [k, c] of Object.entries(v.slots)) {
    const i = Number(k)
    if (Number.isInteger(i) && i >= 0 && i < 16) out[i] = c
  }
  return out
}

/** The 16 palette slots for a monster: its three colours in 0–2, the contract's fixed slots for the rest, the entry's own slots over them. */
export function monsterPaletteHexes(three: readonly string[], slots: Readonly<Record<number, string>> = {}): string[] {
  const p = [0, 1, 2].map((i) => three[i] ?? three[0] ?? DEFAULT_PALETTE[i]!)
  const out = [
    p[0]!, // 0 main
    p[1]!, // 1 secondary
    p[2]!, // 2 accent
    '#ffd24a', // 3 iris: a beast's eye
    '#f2ece2', // 4 sclera
    '#1a1218', // 5 ink
    '#5a4636', // 6 cloth1 (costumes)
    '#7a6a52', // 7 cloth2
    '#5e3d26', // 8 leather
    '#8a8f98', // 9 metal
    p[2]!, // 10 trim follows the accent
    '#ffe08a', // 11 glow: eyes, runes
    '#7a5432', // 12 wood
    '#e8dcc0', // 13 bone: teeth, claws
    p[2]!, // 14 gem
    '#3a3440', // 15 cloth3
  ]
  for (const [k, c] of Object.entries(slots)) {
    const i = Number(k)
    if (Number.isInteger(i) && i >= 0 && i < 16) out[i] = c
  }
  return out
}
