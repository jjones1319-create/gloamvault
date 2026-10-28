/**
 * The hero palette (tools/blender/palette.json, the contract): every hero, gear, part and weapon mesh carries COLOR_0
 * = (slot / 15, region / 15, 0, 1) per vertex. The client decodes the slot once at assembly and its one toon material
 * per character looks the colour up in a 16-entry palette built here from the hero's look, class, gear grade and
 * weapon element. Pure (no three.js) so it is tested in node.
 */
import type { Grade } from '../../../../sim/src/types/enums.ts'

export const SLOT = {
  skin: 0,
  skin2: 1,
  hair: 2,
  iris: 3,
  sclera: 4,
  ink: 5,
  cloth1: 6,
  cloth2: 7,
  leather: 8,
  metal: 9,
  trim: 10,
  glow: 11,
  wood: 12,
  bone: 13,
  gem: 14,
  cloth3: 15,
} as const
export type SlotName = keyof typeof SLOT
export const SLOT_COUNT = 16
/** Slots that glow (palette.json `emissive`): element lines and runes, gems. */
export const EMISSIVE_SLOTS: readonly number[] = [SLOT.glow, SLOT.gem]

/** Body regions (palette.json): gear lists the ones it covers in `hides` and the client drops those triangles. */
export const REGION = { head: 0, neck: 1, chest: 2, belly: 3, upperArms: 4, forearms: 5, hands: 6, thighs: 7, shins: 8, feet: 9 } as const
export type RegionName = keyof typeof REGION
export const REGION_NAMES = Object.keys(REGION) as RegionName[]

/** COLOR_0's R → the palette slot (round(R × 15), clamped). */
export function slotOf(r: number): number {
  return Number.isFinite(r) ? Math.min(SLOT_COUNT - 1, Math.max(0, Math.round(r * 15))) : 0
}

/** COLOR_0's G → the body region (round(G × 15)). */
export function regionOf(g: number): number {
  return Number.isFinite(g) ? Math.min(15, Math.max(0, Math.round(g * 15))) : 0
}

/**
 * Trim by grade, the same ladder as the UI's grade chips (client/src/ui/kit/kit.css: F grey → God white-gold), so a
 * hero's trim and the item card agree.
 */
export const GRADE_TRIM: Readonly<Record<Grade, string>> = {
  F: '#9b9488',
  E: '#7bd389',
  D: '#5fa8ff',
  C: '#c58cff',
  B: '#ffb347',
  A: '#ff7a59',
  S: '#ffd84d',
  SS: '#ff5ea8',
  God: '#fff4d6',
}
export const GRADE_ORDER: readonly Grade[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'God']

/** Item `visual.trimMetal` → the metal slot's colour. */
export const METAL: Readonly<Record<string, string>> = {
  copper: '#b87333',
  bronze: '#b08d57',
  brass: '#c9a44c',
  iron: '#8a8f98',
  steel: '#a8b0ba',
  silver: '#c8ccd4',
  gold: '#e2b84a',
}
export const DEFAULT_METAL = '#8a8f98'
export const DEFAULT_LEATHER = '#5e3d26'

/** The glow slot by the weapon's element (03 §3.5 elements); physical weapons glow in the class's accent. */
export const ELEMENT_GLOW: Readonly<Record<string, string>> = {
  fire: '#ff8a3d',
  frost: '#8fe3ff',
  lightning: '#fff07a',
  poison: '#8dff6a',
  holy: '#ffe9a8',
  shadow: '#b98cff',
}

/**
 * Hair colours per species when the hero manifest has none, ordered dark to light with grey or silver last (the
 * order the wayfarers' looks were chosen in). The Draconid has no hair: its "hair" is the crest and brow-scale tint.
 */
export const HAIR_FALLBACK: Readonly<Record<string, readonly string[]>> = {
  human: ['#1e1814', '#3b2618', '#6a4428', '#8e3f22', '#c9a15e', '#a8a29a'],
  dwarf: ['#1c1612', '#3d2416', '#6b3a1e', '#a4441e', '#c9803a', '#b4ada4'],
  elf: ['#17141a', '#4a2c1a', '#9a5a2a', '#d4b064', '#e8dcc0', '#c4ccd8'],
  orc: ['#141210', '#2e2218', '#4e3a26', '#7a3c1e', '#8c8678', '#d8d0bc'],
  halfling: ['#2a1c12', '#4e3020', '#7a4a26', '#9a5228', '#c49a5e', '#aaa49a'],
  draconid: ['#e8dcc0', '#d8642a', '#5c6270', '#3f8a6a', '#d8b04a', '#8a5ab4'],
}
export const IRIS_FALLBACK: Readonly<Record<string, readonly string[]>> = {
  human: ['#5a3a22', '#3f7fb8', '#5a7a3a'],
  dwarf: ['#4a2e1a', '#6a7a8a', '#3a5a3a'],
  elf: ['#5aa0b4', '#7ab45a', '#b48a3a'],
  orc: ['#c8a020', '#a03a1e', '#6a4a22'],
  halfling: ['#5a3a22', '#6a8a3a', '#3f6fa0'],
  draconid: ['#ffb020', '#e05a1e', '#9adf4a'],
}

/** What the palette is built from (hex colours, #rrggbb). */
export interface PaletteInput {
  skin: string
  hair: string
  iris: string
  cloth1: string
  cloth2: string
  cloth3: string
  leather: string
  metal: string
  trim: string
  glow: string
  /** Lips, Draconid belly: a shade of the skin when omitted. */
  skin2?: string
  gem?: string
  /** Horns, claws, tusks, nails. */
  bone?: string
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const n = m ? Number.parseInt(m[1]!, 16) : 0x808080
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export function rgbToHex(rgb: readonly number[]): string {
  const c = (v: number | undefined) =>
    Math.round(Math.min(1, Math.max(0, v ?? 0)) * 255)
      .toString(16)
      .padStart(2, '0')
  return '#' + c(rgb[0]) + c(rgb[1]) + c(rgb[2])
}

export function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  return rgbToHex([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * t))
}

export function scaleHex(a: string, k: number): string {
  return rgbToHex(hexToRgb(a).map((v) => v * k))
}

/** Relative luminance in linear light. */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Near-black cloth vanishes in a torch-lit cellar (Ascend's "dark on dark"): lift it toward a cool grey. */
export function readableCloth(hex: string): string {
  return luminance(hex) < 0.016 ? mixHex(hex, '#6a6878', 0.32) : hex
}

/** The 16 colours in slot order. */
export function paletteHexes(p: PaletteInput): string[] {
  const out = new Array<string>(SLOT_COUNT).fill('#808080')
  out[SLOT.skin] = p.skin
  out[SLOT.skin2] = p.skin2 ?? mixHex(scaleHex(p.skin, 0.86), '#a0403c', 0.18)
  out[SLOT.hair] = p.hair
  out[SLOT.iris] = p.iris
  out[SLOT.sclera] = '#f2ece2'
  out[SLOT.ink] = '#1a1218'
  out[SLOT.cloth1] = readableCloth(p.cloth1)
  out[SLOT.cloth2] = readableCloth(p.cloth2)
  out[SLOT.leather] = p.leather
  out[SLOT.metal] = p.metal
  out[SLOT.trim] = p.trim
  out[SLOT.glow] = p.glow
  out[SLOT.wood] = '#7a5432'
  out[SLOT.bone] = p.bone ?? '#e8dcc0'
  out[SLOT.gem] = p.gem ?? p.glow
  out[SLOT.cloth3] = readableCloth(p.cloth3)
  return out
}

/** sRGB → linear (three.js's ColorManagement curve), for the shader's palette uniform. */
export function srgbToLinear(c: number): number {
  return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4)
}

/** The palette as the shader's `vec3 uPalette[16]`, in linear colour. */
export function paletteUniform(hexes: readonly string[], out: Float32Array = new Float32Array(SLOT_COUNT * 3)): Float32Array {
  for (let i = 0; i < SLOT_COUNT; i++) {
    const [r, g, b] = hexToRgb(hexes[i] ?? '#808080')
    out[i * 3] = srgbToLinear(r)
    out[i * 3 + 1] = srgbToLinear(g)
    out[i * 3 + 2] = srgbToLinear(b)
  }
  return out
}

/** The highest grade of a list (the trim follows the best piece worn). */
export function bestGrade(grades: readonly (Grade | null | undefined)[]): Grade {
  let best = 0
  for (const g of grades) if (g) best = Math.max(best, GRADE_ORDER.indexOf(g))
  return GRADE_ORDER[best] ?? 'F'
}

/** A palette list (hair, iris) read with a wrapped index, so any saved index shows something. */
export function wrapPick(list: readonly string[] | undefined, index: number, fallback: string): string {
  if (!list || list.length === 0) return fallback
  const i = ((Math.round(index) % list.length) + list.length) % list.length
  return list[i] ?? fallback
}
