/**
 * Room kits as data (Phase 6; tools/blender/README.md → *Phase 6 → Environments* is the contract): the zone file
 * `models/env/<zone>.json` read tolerantly, which kit a room's zone draws with, how a kit vertex's `gv` code is read
 * (R = palette slot, G = variation, B = baked ambient occlusion), each zone's fog and flame look, and which pieces a
 * room draws as one InstancedMesh. Pure (no three.js), tested in node.
 */
import { hexToRgb } from '../characters/palette.ts'

export type KitZone = 'cellars' | 'crypts' | 'vault'
export const KIT_ZONES: readonly KitZone[] = ['cellars', 'crypts', 'vault']
/** The pieces every zone shares (chests, the torch sconce, the Waystone …) live in `kit_shared.glb`. */
export const SHARED_KIT = 'shared'

/** The environment palette slots (the contract's list). */
export const ENV_SLOT = {
  stone: 0,
  darkStone: 1,
  wood: 2,
  darkWood: 3,
  iron: 4,
  ink: 5,
  cloth1: 6,
  cloth2: 7,
  leather: 8,
  brightMetal: 9,
  brass: 10,
  glow: 11,
  moss: 12,
  bone: 13,
  crystal: 14,
  water: 15,
} as const
/** Slots that glow (fire, runes, lit spirals; crystal and gems). */
export const ENV_EMISSIVE: readonly number[] = [ENV_SLOT.glow, ENV_SLOT.crystal]

/**
 * Each zone's 16 colours when its JSON has not landed (07 §2.2's palettes spread over the contract's slots): the
 * Cellars' brick ochre, mortar grey, damp green and lantern amber; the Crypts' bone, slate, grave-moss teal and
 * corpse-candle green; the Vault's wet basalt, verdigris, brine foam and deep-lantern cyan.
 */
export const FALLBACK_PALETTE: Readonly<Record<KitZone, readonly string[]>> = {
  cellars: ['#7a5230', '#5b5650', '#6b4a2b', '#4e3520', '#3d3d45', '#120d0c', '#7a2420', '#a08a4a', '#7a5a3a', '#a8a39a', '#b08d57', '#e8a33c', '#3f5a3a', '#d9d0b8', '#ffc94a', '#1d3436'],
  crypts: ['#8a8578', '#3c4048', '#6a5640', '#3e3228', '#454a52', '#0c0d10', '#4a3a5a', '#2f5f5a', '#5a4a3a', '#b8bcc4', '#9a8a5a', '#8fe3a1', '#2f5f5a', '#d9cbb0', '#b0f0c0', '#1c2a2a'],
  vault: ['#2f3d48', '#23303a', '#4a3a2a', '#2e241c', '#3a4a4e', '#060b0e', '#2a4a6a', '#3f8c7e', '#4a3e30', '#a9c5cc', '#c9a44c', '#58d3e0', '#3f8c7e', '#cfc8b4', '#7fe6f0', '#16303a'],
}

/** A zone's fog, sky and floor bounce, and how much denser its fog is than the Cellars' (07 §2.2: 10–40 m, 6–28 m, 4–20 m). */
export interface ZoneLook {
  fog: number
  fogScale: number
  sky: number
  ground: number
}

export const ZONE_LOOK: Readonly<Record<KitZone, ZoneLook>> = {
  cellars: { fog: 0x17110e, fogScale: 1, sky: 0x8a786a, ground: 0x1e1612 },
  crypts: { fog: 0x111917, fogScale: 1.15, sky: 0x93a29c, ground: 0x1a201e },
  vault: { fog: 0x08161b, fogScale: 1.45, sky: 0x7398a4, ground: 0x0c1a20 },
}

/** How much of a flame's colour its point light keeps (the rest is white): a corpse-candle lights a room pale green, not green. */
export const LIGHT_TINT = 0.6

/** The warm torch every zone's sconces, braziers and campfires burn with (2,700 K, 07 §2.2). */
export const TORCH_COLOUR = 0xffa040

/** A flame's light by the piece it burns on: corpse-candles cold green, cult lamps blue, anemones cyan, the Waystone pale. */
export function flameColourFor(meshId: string, zone: KitZone): number {
  const id = meshId.toLowerCase()
  if (/candle/.test(id)) return 0x8fe3a1
  if (/anemone/.test(id)) return 0x58d3e0
  if (/waystone/.test(id)) return 0x7fd4ff
  if (/lamp/.test(id)) return zone === 'vault' ? 0x6fb8ff : 0xe8a33c
  return TORCH_COLOUR
}

/** Which kit a room is built from: by its zone id (`the-cellars`, `the-crypts`, `the-drowned-vault`), else its template id. */
export function kitZoneOf(zoneId?: string | null, templateId?: string | null): KitZone {
  const z = (zoneId ?? '').toLowerCase()
  if (/vault|drown/.test(z)) return 'vault'
  if (/crypt/.test(z)) return 'crypts'
  if (/cellar/.test(z)) return 'cellars'
  const t = (templateId ?? '').toLowerCase()
  if (/^vlt[-_]/.test(t)) return 'vault'
  if (/^cry[-_]/.test(t)) return 'crypts'
  return 'cellars'
}

/* ---------- the zone file ---------- */

/** The pieces a room's floor and walls are built from (variants: the first is the common one). */
export interface EnvShell {
  floor: string[]
  /** Each floor variant's share (the zone file's `floorAlt`: `[["cel_floor_flag_b", 0.12]]`; the first takes the rest). */
  floorWeights: number[]
  wall: string[]
  wallWeights: number[]
  doorway: string[]
  corner: string[]
  /** The side cut away toward the camera: the kit's cut wall, doorway and corner (`wallCut` …), when it has them. */
  low: string[]
  doorwayCut: string[]
  cornerCut: string[]
  /** The doorway skins (`doorways: { open, wood, locked, secret }`). */
  locked: string[]
  secret: string[]
  /** Floors that cover a whole room or none of it (earth), never mixed tile by tile (`floorWhole`). */
  floorWhole: string[]
}

/** A template's own floor mix (`floorMix: { "cel-t-kennels": [["cel_floor_dirt", 0.72], …] }`). */
export interface FloorMix {
  ids: string[]
  weights: number[]
}

export interface EnvPieceInfo {
  tris: number
  parts: string[]
  lights: number
  /** Where it goes: tile, shell, corner, floor, wall, ceiling (null when the file does not say). */
  mount: string | null
  /** The floor it opens ([x0, z0, x1, z1] in its own space: the stairs down's pit), when the file gives one. */
  hole: [number, number, number, number] | null
  /** Its slot-15 faces are water whose COLOR_0.A is their opacity (the Vault's `water: true`). */
  water: boolean
  /** Drawn see-through at this opacity (the Crypts' mist 0.22, webs 0.5), when the file says. */
  translucent: number | null
  /** What it is to a room: shell, wall-hung, decal, prop … (null when the file does not say). */
  role: string | null
}

/** `[x0, z0, x1, z1]` of four finite numbers, else null. */
export function readHole(v: unknown): [number, number, number, number] | null {
  return Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === 'number' && Number.isFinite(n)) ? (v as [number, number, number, number]) : null
}

export interface EnvZoneInfo {
  zone: string
  /** 16 colours in slot order (#rrggbb). */
  palette: string[]
  shell: EnvShell
  pieces: Map<string, EnvPieceInfo>
  /** Per template: its own floor variants. */
  floorMix: Map<string, FloorMix>
  /** Per template: pieces drawn as others (`substitute: { "cel-t-guardpost": { "shr_campfire": "shr_brazier" } }`). */
  substitute: Map<string, Map<string, string>>
  /** Per template: a doorway's skin by side, or `*` for every door (`doorSkins: { "cry-t-reliquary": { "*": "cry_door_iron" } }`). */
  doorSkins: Map<string, Map<string, string>>
}

export const EMPTY_SHELL: EnvShell = { floor: [], floorWeights: [], wall: [], wallWeights: [], doorway: [], corner: [], low: [], doorwayCut: [], cornerCut: [], locked: [], secret: [], floorWhole: [] }

/** `[["id", 0.12], …]` (or `{ id: 0.12 }`) → ids and weights. */
function weighted(v: unknown): { ids: string[]; weights: number[] } {
  const ids: string[] = []
  const weights: number[] = []
  const push = (id: unknown, w: unknown) => {
    if (typeof id === 'string' && id && typeof w === 'number' && Number.isFinite(w) && w > 0) {
      ids.push(id)
      weights.push(w)
    }
  }
  if (Array.isArray(v)) for (const e of v) Array.isArray(e) ? push(e[0], e[1]) : obj(e) ? push(obj(e)!.id ?? obj(e)!.meshId, obj(e)!.weight ?? obj(e)!.p) : undefined
  else if (obj(v)) for (const [id, w] of Object.entries(obj(v)!)) push(id, w)
  return { ids, weights }
}

/** A main piece and its weighted alternatives as one list (the main takes what the others leave, at least 5%). */
function withAlts(main: string[], alts: unknown): { ids: string[]; weights: number[] } {
  const a = weighted(alts)
  if (main.length === 0) return a
  const rest = Math.max(0.05, 1 - a.weights.reduce((s, w) => s + w, 0))
  const extra = main.slice(1).map(() => 0)
  return { ids: [...main, ...a.ids], weights: [rest, ...extra, ...a.weights] }
}

const HEX = /^#?[0-9a-f]{6}$/i

function obj(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function names(v: unknown): string[] {
  if (typeof v === 'string') return v.trim() ? v.split(/[\s,]+/).filter(Boolean) : []
  if (Array.isArray(v)) {
    const out: string[] = []
    for (const x of v) {
      if (typeof x === 'string' && x.trim()) out.push(x.trim())
      else {
        const o = obj(x)
        const id = o ? (o.meshId ?? o.id ?? o.name) : undefined
        if (typeof id === 'string' && id.trim()) out.push(id.trim())
      }
    }
    return out
  }
  const o = obj(v)
  const id = o ? (o.meshId ?? o.id ?? o.name) : undefined
  return typeof id === 'string' && id.trim() ? [id.trim()] : []
}

function count(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.round(v))
  if (Array.isArray(v)) return v.length
  return 0
}

/** The palette as 16 hex strings: a list of hex strings (or `{hex}` objects), padded from the zone's fallback. */
export function readPalette(v: unknown, fallback: readonly string[]): string[] {
  const out = [...fallback]
  const o = obj(v)
  const list: unknown[] = Array.isArray(v) ? v : o ? Object.values(o) : []
  list.slice(0, 16).forEach((c, i) => {
    const co = obj(c)
    const s = (typeof c === 'string' ? c : co && typeof co.hex === 'string' ? co.hex : '').trim()
    if (HEX.test(s)) out[i] = (s.startsWith('#') ? s : `#${s}`).toLowerCase()
  })
  while (out.length < 16) out.push('#808080')
  return out.slice(0, 16)
}

/** `env/<zone>.json` → the palette, the shell pieces and the piece list; null for anything that is not an object. */
export function parseEnvZone(json: unknown, zone: string): EnvZoneInfo | null {
  const o = obj(json)
  if (!o) return null
  const fallback = (KIT_ZONES as readonly string[]).includes(zone) ? FALLBACK_PALETTE[zone as KitZone] : FALLBACK_PALETTE.cellars
  const shellRaw = obj(o.shell) ?? {}
  const doorways = obj(shellRaw.doorways)
  const floor = withAlts(names(shellRaw.floor ?? shellRaw.floors), shellRaw.floorAlt)
  const wall = withAlts(names(shellRaw.wall ?? shellRaw.walls), shellRaw.wallAlt)
  const shell: EnvShell = {
    floor: floor.ids,
    floorWeights: floor.weights,
    wall: wall.ids,
    wallWeights: wall.weights,
    doorway: names(shellRaw.doorway ?? shellRaw.door ?? doorways?.open ?? (Array.isArray(shellRaw.doorways) ? shellRaw.doorways : undefined)),
    corner: names(shellRaw.corner ?? shellRaw.corners),
    low: names(shellRaw.wallCut ?? shellRaw.low ?? shellRaw.wallLow ?? shellRaw.lowWall),
    doorwayCut: names(shellRaw.doorwayCut),
    cornerCut: names(shellRaw.cornerCut),
    locked: names(doorways?.locked ?? shellRaw.locked),
    secret: names(doorways?.secret ?? shellRaw.secret),
    floorWhole: names(shellRaw.floorWhole),
  }
  const floorMix = new Map<string, FloorMix>()
  const mix = obj(o.floorMix)
  if (mix) {
    for (const [tpl, v] of Object.entries(mix)) {
      const m = withAlts(shell.floor.slice(0, 1), v)
      if (m.ids.length) floorMix.set(tpl, m)
    }
  }
  const pairsByTemplate = (v: unknown): Map<string, Map<string, string>> => {
    const out = new Map<string, Map<string, string>>()
    const all = obj(v)
    if (!all) return out
    for (const [tpl, raw] of Object.entries(all)) {
      const pairs = obj(raw)
      if (!pairs) continue
      const m = new Map<string, string>()
      for (const [from, to] of Object.entries(pairs)) if (typeof to === 'string' && to) m.set(from, to)
      if (m.size) out.set(tpl, m)
    }
    return out
  }
  const substitute = pairsByTemplate(o.substitute)
  const doorSkins = pairsByTemplate(o.doorSkins ?? shellRaw.doorSkins)
  const pieces = new Map<string, EnvPieceInfo>()
  const rawPieces = o.pieces
  if (Array.isArray(rawPieces)) {
    for (const p of rawPieces) {
      const po = obj(p)
      const raw = po ? (po.meshId ?? po.id ?? po.name) : p
      if (typeof raw === 'string' && raw) pieces.set(raw, { tris: count(po?.tris), parts: names(po?.parts), lights: count(po?.lights), mount: typeof po?.mount === 'string' ? po.mount : null, hole: readHole(po?.hole), water: po?.water === true, translucent: opacity(po?.translucent), role: typeof po?.role === 'string' ? po.role : null })
    }
  } else {
    const po = obj(rawPieces)
    if (po) {
      for (const [id, p] of Object.entries(po)) {
        const e = obj(p)
        pieces.set(id, { tris: count(e ? e.tris : p), parts: names(e?.parts), lights: count(e?.lights), mount: typeof e?.mount === 'string' ? e.mount : null, hole: readHole(e?.hole), water: e?.water === true, translucent: opacity(e?.translucent), role: typeof e?.role === 'string' ? e.role : null })
      }
    }
  }
  return { zone: typeof o.zone === 'string' ? o.zone : zone, palette: readPalette(o.palette, fallback), shell, pieces, floorMix, substitute, doorSkins }
}

/** An opacity in (0, 1), else null. */
function opacity(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1 ? v : null
}

/* ---------- the gv code ---------- */

/**
 * How far the variation channel moves a colour (G 0.5 is neutral; the kit pass's formula, × (1 + 0.36·(G − 0.5)):
 * ±18%), and the darkest the baked AO makes a surface (mix(0.45, 1, B)).
 */
export const VARIATION_RANGE = 0.36
export const AO_FLOOR = 0.45

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0
}

/** COLOR_0's R → the zone palette slot (round(R × 15), clamped). */
export function envSlot(r: number): number {
  return Number.isFinite(r) ? Math.min(15, Math.max(0, Math.round(r * 15))) : 0
}

/**
 * The brightness a kit vertex gets on top of its slot's colour: G is weathering — 0.5 is the slot's own colour, 0 a
 * little darker, 1 a little lighter (±18%, the kit pass's 1 + 0.36·(G − 0.5)) — and B the baked occlusion, multiplied
 * in (1 open, 0 deep in a recess, never darker than AO_FLOOR). The material's shader does the same sum.
 */
export function envShade(g: number, b: number): number {
  const variation = 1 + (clamp01(g) - 0.5) * VARIATION_RANGE
  const ao = AO_FLOOR + (1 - AO_FLOOR) * clamp01(b)
  return variation * ao
}

/** A kit vertex's colour before lighting: its slot's colour × the shade. */
export function envColour(palette: readonly string[], r: number, g: number, b: number): [number, number, number] {
  const [cr, cg, cb] = hexToRgb(palette[envSlot(r)] ?? '#808080')
  const k = envShade(g, b)
  return [cr * k, cg * k, cb * k]
}

/* ---------- instancing ---------- */

export interface InstanceGroup<T> {
  meshId: string
  items: T[]
  /** Two or more of a piece are one InstancedMesh; a single piece is a plain mesh. */
  instanced: boolean
}

/** Placements grouped by piece (sorted by meshId, placement order kept within a piece): one draw call per group. */
export function instanceGroups<T extends { meshId: string }>(list: readonly T[]): InstanceGroup<T>[] {
  const by = new Map<string, T[]>()
  for (const p of list) {
    const g = by.get(p.meshId)
    if (g) g.push(p)
    else by.set(p.meshId, [p])
  }
  return [...by.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([meshId, items]) => ({ meshId, items, instanced: items.length >= 2 }))
}

/** Picks one of a shell list's variants from a 0–1 roll: the first most of the time, the others shared out. */
export function pickVariant(list: readonly string[], roll: number, common = 0.7): string | undefined {
  if (list.length <= 1) return list[0]
  const r = clamp01(roll)
  if (r < common) return list[0]
  const rest = list.length - 1
  const i = 1 + Math.min(rest - 1, Math.floor(((r - common) / (1 - common)) * rest))
  return list[i]
}

/** Picks a variant by its weight from a 0–1 roll (weights need not sum to 1); without weights, `pickVariant`. */
export function pickWeighted(list: readonly string[], weights: readonly number[], roll: number): string | undefined {
  if (list.length <= 1 || weights.length !== list.length) return pickVariant(list, roll)
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0)
  if (!(total > 0)) return list[0]
  let at = clamp01(roll) * total
  for (let i = 0; i < list.length; i++) {
    at -= Math.max(0, weights[i]!)
    if (at < 0) return list[i]
  }
  return list[list.length - 1]
}

/** A light empty's kind (`light: torch | fire | brazier | lamp | candle`, or a `tone`) → its colour and its flame's height. */
export function lightKind(kind: string | null | undefined, zone: KitZone): { color: number; size: number } | null {
  switch ((kind ?? '').toLowerCase()) {
    case 'fire':
    case 'campfire':
      return { color: TORCH_COLOUR, size: 0.85 }
    case 'brazier':
      return { color: TORCH_COLOUR, size: 0.62 }
    case 'torch':
    case 'flame':
      return { color: TORCH_COLOUR, size: 0.42 }
    case 'lamp':
    case 'lantern':
      return { color: zone === 'vault' ? 0x6fb8ff : 0xe8a33c, size: 0.24 }
    case 'cult':
      return { color: 0x6fb8ff, size: 0.26 }
    case 'candle':
      return { color: 0xffc070, size: 0.16 }
    case 'corpse':
      return { color: 0x8fe3a1, size: 0.16 }
    case 'moon':
      return { color: 0xcfe0ff, size: 0.3 }
    case 'anemone':
      return { color: 0x58d3e0, size: 0.2 }
    default:
      return null
  }
}

/** Pieces drawn see-through when the kit does not say (mist, webs, puddles, a fog sheet): their opacity, else 1. */
export function translucencyOf(meshId: string): number {
  const id = meshId.toLowerCase()
  if (/mist|fog/.test(id)) return 0.22
  if (/web/.test(id)) return 0.5
  if (/puddle|waterfall|caustic/.test(id)) return 0.6
  return 1
}

/** True for a see-through piece (`translucencyOf` below 1). */
export function isTranslucent(meshId: string): boolean {
  return translucencyOf(meshId) < 1
}

/** A template's side turned with its room (the generator turns templates clockwise by quarter turns). */
export function turnSide(side: 'north' | 'east' | 'south' | 'west', rotation: number): 'north' | 'east' | 'south' | 'west' {
  const order = ['north', 'east', 'south', 'west'] as const
  const q = (((Math.round(rotation / 90) % 4) + 4) % 4) as 0 | 1 | 2 | 3
  return order[(order.indexOf(side) + q) % 4]!
}
