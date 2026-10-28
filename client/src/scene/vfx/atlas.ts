import * as THREE from 'three'
import { SPRITE } from './recipes.ts'

/**
 * The effects' one texture, drawn in code (CLAUDE.md rule 8; 11 §6 as built): a 256 × 256 atlas of sixteen white
 * sprites with soft alpha — glow, spark, ring, star, burst, flame, smoke, crescent, snowflake, bolt, bubble, glint,
 * hexagon, rune, drop, shard — tinted per particle. Cell `i` sits at column i % 4, row ⌊i / 4⌋ counted from the bottom.
 */
export const ATLAS_SIZE = 256
export const ATLAS_CELLS = 4
const CELL_PX = ATLAS_SIZE / ATLAS_CELLS

type Shape = (u: number, v: number) => number

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

function gauss(d: number, w: number): number {
  return Math.exp(-(d / w) * (d / w))
}

/** A cheap repeatable value noise for the smoke. */
function noise(u: number, v: number): number {
  const s = Math.sin(u * 12.9898 + v * 78.233) * 43758.5453
  const n1 = s - Math.floor(s)
  const t = Math.sin(u * 5.1 + 1.7) * Math.cos(v * 4.3 - 0.6)
  return 0.5 + 0.35 * t + 0.15 * (n1 - 0.5)
}

const SHAPES: Record<number, Shape> = {
  [SPRITE.glow]: (u, v) => Math.pow(Math.max(0, 1 - Math.hypot(u, v)), 2),
  [SPRITE.spark]: (u, v) => gauss(v, 0.12) * Math.pow(Math.max(0, 1 - Math.abs(u)), 1.4) + 0.6 * gauss(Math.hypot(u, v), 0.18),
  [SPRITE.ring]: (u, v) => gauss(Math.hypot(u, v) - 0.78, 0.09),
  [SPRITE.star]: (u, v) => {
    const r = Math.hypot(u, v)
    const arms = Math.max(gauss(u, 0.07) * Math.max(0, 1 - Math.abs(v)), gauss(v, 0.07) * Math.max(0, 1 - Math.abs(u)))
    return Math.min(1, arms + 0.8 * gauss(r, 0.2))
  },
  [SPRITE.burst]: (u, v) => {
    const r = Math.hypot(u, v)
    const a = Math.atan2(v, u)
    const rays = Math.pow(Math.abs(Math.cos(a * 4)), 14) * Math.max(0, 1 - r)
    return Math.min(1, rays + 0.9 * gauss(r, 0.28))
  },
  [SPRITE.flame]: (u, v) => {
    // A teardrop: round at the bottom, pointed at the top.
    const t = (v + 1) / 2
    const width = 0.62 * Math.pow(Math.max(0, 1 - t), 0.75) + 0.02
    const d = Math.hypot(u / width, (t - 0.32) / 0.68)
    return smooth(1, 0.55, d) * (t < 0.06 ? t / 0.06 : 1)
  },
  [SPRITE.smoke]: (u, v) => {
    const r = Math.hypot(u, v)
    return Math.pow(Math.max(0, 1 - r), 1.4) * noise(u, v)
  },
  [SPRITE.crescent]: (u, v) => {
    const r = Math.hypot(u, v)
    const a = Math.atan2(v, u)
    // An arc over the top half that thins toward its ends.
    const along = Math.max(0, Math.sin(a))
    return gauss(r - 0.72, 0.05 + 0.13 * along) * smooth(0, 0.35, along)
  },
  [SPRITE.snowflake]: (u, v) => {
    const r = Math.hypot(u, v)
    if (r > 0.95) return 0
    let best = 0
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3
      const c = Math.cos(a)
      const s = Math.sin(a)
      const along = u * c + v * s
      const across = -u * s + v * c
      if (along < 0) continue
      best = Math.max(best, gauss(across, 0.06) * (1 - along * 0.6))
      // Two little branches on each arm.
      for (const at of [0.45, 0.7]) {
        const bx = along - at
        if (bx < 0) continue
        best = Math.max(best, gauss(Math.abs(across) - bx * 1.2, 0.05) * smooth(0.25, 0, bx))
      }
    }
    return Math.min(1, best + 0.5 * gauss(r, 0.15))
  },
  [SPRITE.bolt]: (u, v) => {
    const t = (v + 1) * 1.6
    const zig = (Math.abs(((t % 2) + 2) % 2 - 1) - 0.5) * 0.55
    return gauss(u - zig, 0.08) * (1 - Math.pow(Math.abs(v), 6)) + 0.4 * gauss(u - zig, 0.22) * (1 - Math.abs(v))
  },
  [SPRITE.bubble]: (u, v) => {
    const r = Math.hypot(u, v)
    return Math.min(1, 0.85 * gauss(r - 0.78, 0.1) + 0.25 * Math.max(0, 1 - r) + 0.9 * gauss(Math.hypot(u + 0.32, v - 0.34), 0.12))
  },
  [SPRITE.glint]: (u, v) => {
    // Four tapered rays round a bright core: holy light, the heal motes and the Mender's Ultimate (not a church cross).
    const ray = (along: number, across: number) => {
      const w = 0.03 + 0.17 * (1 - along)
      return smooth(w + 0.06, w, across) * smooth(0.95, 0.8, along)
    }
    const au = Math.abs(u)
    const av = Math.abs(v)
    return Math.min(1, Math.max(ray(av, au), ray(au, av)) + 0.6 * gauss(Math.hypot(u, v), 0.2))
  },
  [SPRITE.hexagon]: (u, v) => {
    const d = Math.max(Math.abs(v), Math.abs(u) * 0.866 + Math.abs(v) * 0.5)
    return Math.min(1, gauss(d - 0.74, 0.07) + 0.18 * smooth(0.74, 0.3, d))
  },
  [SPRITE.rune]: (u, v) => {
    const r = Math.hypot(u, v)
    const a = Math.atan2(v, u)
    const ticks = Math.pow(Math.abs(Math.cos(a * 6)), 30) * gauss(r - 0.68, 0.08)
    return Math.min(1, gauss(r - 0.86, 0.045) + 0.8 * gauss(r - 0.52, 0.035) + ticks)
  },
  [SPRITE.drop]: (u, v) => {
    // A drop: round at the bottom, pointed at the top (the flame turned soft and solid).
    const t = (v + 1) / 2
    const width = 0.5 * Math.pow(Math.max(0, 1 - t), 0.9) + 0.02
    const d = Math.hypot(u / width, (t - 0.3) / 0.62)
    return smooth(1, 0.8, d)
  },
  [SPRITE.shard]: (u, v) => smooth(1, 0.75, Math.abs(u) / 0.26 + Math.abs(v) / 0.96),
}

/** The atlas's RGBA bytes (white, with each sprite's alpha), exported for a test. */
export function atlasPixels(): Uint8Array {
  const data = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE * 4)
  for (let cell = 0; cell < ATLAS_CELLS * ATLAS_CELLS; cell++) {
    const shape = SHAPES[cell]
    if (!shape) continue
    const cx = (cell % ATLAS_CELLS) * CELL_PX
    const cy = Math.floor(cell / ATLAS_CELLS) * CELL_PX
    for (let y = 0; y < CELL_PX; y++) {
      for (let x = 0; x < CELL_PX; x++) {
        // −1…1 across the cell, with a pixel of margin so mipmaps never borrow from a neighbour.
        const u = ((x + 0.5) / CELL_PX) * 2.12 - 1.06
        const v = ((y + 0.5) / CELL_PX) * 2.12 - 1.06
        const edge = Math.max(Math.abs(u), Math.abs(v)) > 1 ? 0 : 1
        const a = Math.max(0, Math.min(1, shape(u, v))) * edge
        const i = ((cy + y) * ATLAS_SIZE + cx + x) * 4
        data[i] = 255
        data[i + 1] = 255
        data[i + 2] = 255
        data[i + 3] = Math.round(a * 255)
      }
    }
  }
  return data
}

let atlas: THREE.DataTexture | null = null
let users = 0

/** The shared atlas (made on first use, freed with its last user). */
export function acquireAtlas(): THREE.DataTexture {
  if (!atlas) {
    atlas = new THREE.DataTexture(atlasPixels(), ATLAS_SIZE, ATLAS_SIZE, THREE.RGBAFormat)
    atlas.colorSpace = THREE.NoColorSpace
    atlas.magFilter = THREE.LinearFilter
    atlas.minFilter = THREE.LinearMipmapLinearFilter
    atlas.generateMipmaps = true
    atlas.needsUpdate = true
  }
  users++
  return atlas
}

export function releaseAtlas(): void {
  users = Math.max(0, users - 1)
  if (users === 0 && atlas) {
    atlas.dispose()
    atlas = null
  }
}
