/**
 * A room's shell from its footprint and doors (Phase 6; 07 §2.2 owns the grid): where the zone's floor tiles, wall
 * segments, doorways and corner posts go. Pure numbers in room space (+x east, +z south, the room centred on the
 * origin), tested in node; `kitRoom.ts` turns them into instanced kit pieces.
 *
 * A piece's front faces +z and its origin is at floor level in the middle of its footprint; a wall's origin is the
 * middle of its base on the room-side face, so it stands on the room's edge and its thickness lies outside — the floor
 * is exactly the footprint. A wall faces into the room: north 0, east −π/2, south π, west π/2 (three.js rotation.y),
 * and the corner posts turn with the walls they start (NW 0, NE −π/2, SE π, SW π/2).
 *
 * Every side is cut into `wallLength` (2 m) segments. A doorway sits at its cell's mid-edge and takes out what it
 * covers — its own width when the kit's doorway piece is wider or narrower than the 2 m opening — and the segments it
 * cuts into are trimmed (scaled along their length). The side facing the camera is cut away (07 §2.2's diorama view):
 * its walls are low and its doorways are open gaps.
 */
import { CELL, DOOR_WIDTH, facesCamera, floorTiles, sideNormal, type Rect, type RoomFrame, type Side } from '../room/layout.ts'

export type ShellRole = 'floor' | 'wall' | 'doorway' | 'corner'

export interface ShellPlacement {
  role: ShellRole
  x: number
  z: number
  /** three.js rotation.y. */
  yaw: number
  /** Scale along the piece's length (local x) — a trimmed wall — and its height (a cut-away wall). */
  sx: number
  sy: number
  /** On the side cut away toward the camera. */
  low: boolean
  side?: Side
  /** A doorway's room on the other side. */
  to?: string
  /** A 0–1 roll for picking a variant (floors and walls). */
  roll: number
}

export interface ShellOptions {
  /** A wall segment's length (2 m). */
  wallLength: number
  /** The kit doorway piece's width along its x (what it covers); the 2 m opening when unknown. */
  doorwayWidth: number
  /** Floor tile size (2 m). */
  tile: number
  /** A cut-away wall's height as a share of the full one. */
  cutaway: number
  /** Floor tiles not drawn (a stair pit). */
  holes?: readonly Rect[]
  /**
   * Stretches of wall a template's own wall or door piece stands in (the kit's rule: "a wall or door piece placed on a
   * room edge line replaces the shell piece in that slot"), along the side's x (north, south) or z (east, west).
   */
  blocked?: readonly { side: Side; from: number; to: number }[]
  /** For the variant rolls and the floor tiles' turns. */
  seed: number
  /** The kit has a cut doorway for the camera's side: its doorways there are pieces too, as wide as the others. */
  cutDoorways?: boolean
}

export const SHELL_DEFAULTS: ShellOptions = { wallLength: 2, doorwayWidth: DOOR_WIDTH, tile: 2, cutaway: 0.55 / 3.5, seed: 1 }

export interface ShellDoor {
  side: Side
  offset: number
  to?: string
}

const SIDES: readonly Side[] = ['north', 'east', 'south', 'west']

/** The yaw that turns a piece's +z front into the room from a side. */
export function inwardYaw(side: Side): number {
  const n = sideNormal(side)
  return Math.atan2(0 - n.x, 0 - n.z)
}

/** A small deterministic roll generator (never the sim's RNG). */
function rolls(seed: number): () => number {
  let a = (seed | 0) ^ 0x2545f491
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** [a, b] minus the holes, as intervals at least `min` long. */
export function subtractIntervals(a: number, b: number, holes: readonly (readonly [number, number])[], min = 0.05): [number, number][] {
  let parts: [number, number][] = [[a, b]]
  for (const [h0, h1] of holes) {
    const next: [number, number][] = []
    for (const [p, q] of parts) {
      if (h1 <= p || h0 >= q) {
        next.push([p, q])
        continue
      }
      if (h0 > p) next.push([p, h0])
      if (h1 < q) next.push([h1, q])
    }
    parts = next
  }
  return parts.filter(([p, q]) => q - p >= min)
}

export function shellLayout(frame: RoomFrame, doors: readonly ShellDoor[], camDir: { x: number; z: number }, options: Partial<ShellOptions> = {}): ShellPlacement[] {
  const o: ShellOptions = { ...SHELL_DEFAULTS, ...options }
  const roll = rolls(o.seed * 7919 + frame.w * 31 + frame.h)
  const out: ShellPlacement[] = []

  // Floor tiles, each turned a random quarter so the flagstones do not repeat.
  for (const t of floorTiles(frame, o.holes ?? [])) {
    const turn = Math.floor(roll() * 4)
    out.push({ role: 'floor', x: t.x, z: t.z, yaw: (turn * Math.PI) / 2, sx: 1, sy: 1, low: false, roll: roll() })
  }

  for (const side of SIDES) {
    const n = sideNormal(side)
    const low = facesCamera(side, camDir)
    const alongX = side === 'north' || side === 'south'
    const length = alongX ? frame.width : frame.depth
    const edge = alongX ? (n.z * frame.depth) / 2 : (n.x * frame.width) / 2
    const yaw = inwardYaw(side)
    const at = (along: number) => (alongX ? { x: along, z: edge } : { x: edge, z: along })
    // The doorways on this side, and the stretch of wall each one takes out (a template's own piece stands in some).
    const blocked = (o.blocked ?? []).filter((b) => b.side === side).map((b): [number, number] => [Math.min(b.from, b.to), Math.max(b.from, b.to)])
    const gaps: [number, number][] = [...blocked]
    for (const d of doors) {
      if (d.side !== side) continue
      const c = -length / 2 + (d.offset + 0.5) * CELL
      const piece = !low || o.cutDoorways === true
      const half = (piece ? Math.max(0.5, o.doorwayWidth) : DOOR_WIDTH) / 2
      gaps.push([c - half, c + half])
      const taken = blocked.some(([p, q]) => c > p - 0.01 && c < q + 0.01)
      if (piece && !taken) out.push({ role: 'doorway', ...at(c), yaw, sx: 1, sy: 1, low, side, ...(d.to ? { to: d.to } : {}), roll: roll() })
    }
    const segments = Math.max(1, Math.round(length / o.wallLength))
    const seg = length / segments
    for (let i = 0; i < segments; i++) {
      const a = -length / 2 + i * seg
      for (const [p, q] of subtractIntervals(a, a + seg, gaps)) {
        const mid = (p + q) / 2
        out.push({ role: 'wall', ...at(mid), yaw, sx: (q - p) / o.wallLength, sy: low ? o.cutaway : 1, low, side, roll: roll() })
      }
    }
  }

  // Corner posts: NW, NE, SE, SW, each turned like the wall it starts; low when either side it joins is.
  const corners: [number, number, Side, Side, number][] = [
    [-1, -1, 'north', 'west', 0],
    [1, -1, 'north', 'east', -Math.PI / 2],
    [1, 1, 'south', 'east', Math.PI],
    [-1, 1, 'south', 'west', Math.PI / 2],
  ]
  for (const [sx, sz, a, b, yaw] of corners) {
    const low = facesCamera(a, camDir) || facesCamera(b, camDir)
    out.push({ role: 'corner', x: (sx * frame.width) / 2, z: (sz * frame.depth) / 2, yaw, sx: 1, sy: low ? o.cutaway : 1, low, roll: roll() })
  }
  return out
}
