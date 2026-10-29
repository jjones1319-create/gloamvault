/**
 * The room's geometry in plain numbers (Phase 4, placeholder 3D): no three.js here, so it is tested in Node.
 *
 * Conventions (07 §2.2): one grid cell is 8 m × 8 m; a room is centred on the origin; +x is east and +z is south
 * (the grid's y grows southward); a template prop's front is its local +z; a doorway is 2 m wide at a cell's
 * mid-edge; walls are 3.5 m high and stand outside the room's edge so the floor is exactly the footprint. The
 * generator rotates a template clockwise on the grid, which is three.js `rotation.y = −θ`.
 */
export const CELL = 8
export const DOOR_WIDTH = 2
export const WALL_HEIGHT = 3.5
export const WALL_THICK = 0.4
/** A wall facing the camera is cut down to this so the room reads like a diorama. */
export const CUTAWAY_HEIGHT = 0.55

export type Side = 'north' | 'east' | 'south' | 'west'

export interface CellLike {
  readonly x: number
  readonly y: number
}

export interface DoorLike {
  readonly to: string
  readonly side: Side
  readonly offset: number
  readonly locked: boolean
  readonly secret: boolean
}

export interface RoomLike {
  readonly id: string
  readonly cells: readonly CellLike[]
  readonly doors: readonly DoorLike[]
  readonly rotation: number
}

/** The room's footprint on the grid and in metres. */
export interface RoomFrame {
  gx: number
  gy: number
  w: number
  h: number
  width: number
  depth: number
}

export function roomFrame(room: Pick<RoomLike, 'cells'>): RoomFrame {
  if (room.cells.length === 0) return { gx: 0, gy: 0, w: 1, h: 1, width: CELL, depth: CELL }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const c of room.cells) {
    minX = Math.min(minX, c.x)
    minY = Math.min(minY, c.y)
    maxX = Math.max(maxX, c.x)
    maxY = Math.max(maxY, c.y)
  }
  const w = maxX - minX + 1
  const h = maxY - minY + 1
  return { gx: minX, gy: minY, w, h, width: w * CELL, depth: h * CELL }
}

/** The centre of a grid cell in room space. */
export function cellCentre(frame: RoomFrame, cell: CellLike): { x: number; z: number } {
  return { x: (cell.x - frame.gx + 0.5) * CELL - frame.width / 2, z: (cell.y - frame.gy + 0.5) * CELL - frame.depth / 2 }
}

/** Outward unit normal of a side. */
export function sideNormal(side: Side): { x: number; z: number } {
  switch (side) {
    case 'north':
      return { x: 0, z: -1 }
    case 'south':
      return { x: 0, z: 1 }
    case 'east':
      return { x: 1, z: 0 }
    case 'west':
      return { x: -1, z: 0 }
  }
}

/** Where a door sits on the room's edge, and the way into the room from it. */
export interface Doorway {
  to: string
  side: Side
  offset: number
  locked: boolean
  secret: boolean
  /** The midpoint of the doorway on the edge line. */
  x: number
  z: number
  /** Unit vector pointing into the room. */
  nx: number
  nz: number
}

export function doorway(frame: RoomFrame, door: DoorLike): Doorway {
  const n = sideNormal(door.side)
  const along = (door.offset + 0.5) * CELL
  let x = 0
  let z = 0
  if (door.side === 'north' || door.side === 'south') {
    x = along - frame.width / 2
    z = (n.z * frame.depth) / 2
  } else {
    z = along - frame.depth / 2
    x = (n.x * frame.width) / 2
  }
  return { to: door.to, side: door.side, offset: door.offset, locked: door.locked, secret: door.secret, x, z, nx: 0 - n.x, nz: 0 - n.z }
}

/** One straight run of wall: its centre on the edge line, its length, and which side it closes. */
export interface WallRun {
  side: Side
  /** Centre on the edge line (the wall's box stands outside it). */
  x: number
  z: number
  length: number
  /** True when the run lies along x (a north or south wall). */
  alongX: boolean
  low: boolean
}

/** True when a side's outward face looks toward the camera (that wall is cut down). */
export function facesCamera(side: Side, camDir: { x: number; z: number }): boolean {
  const n = sideNormal(side)
  return n.x * camDir.x + n.z * camDir.z > 0.5
}

/**
 * The walls of a room: every cell edge on the boundary, split around the doorways that are open to the party.
 * `openDoors` are the doorways drawn as gaps (a secret one only once found); a wall whose outward side faces the
 * camera (`camDir`, the horizontal direction from the room's centre to the camera) is low.
 */
export function wallRuns(frame: RoomFrame, openDoors: readonly Pick<DoorLike, 'side' | 'offset'>[], camDir: { x: number; z: number }): WallRun[] {
  const out: WallRun[] = []
  const sides: Side[] = ['north', 'east', 'south', 'west']
  for (const side of sides) {
    const n = sideNormal(side)
    const low = facesCamera(side, camDir)
    const alongX = side === 'north' || side === 'south'
    const count = alongX ? frame.w : frame.h
    const fixed = alongX ? (n.z * frame.depth) / 2 : (n.x * frame.width) / 2
    const start = alongX ? -frame.width / 2 : -frame.depth / 2
    for (let i = 0; i < count; i++) {
      const a = start + i * CELL
      const b = a + CELL
      const hasDoor = openDoors.some((d) => d.side === side && d.offset === i)
      const pieces: [number, number][] = hasDoor
        ? [
            [a, (a + b) / 2 - DOOR_WIDTH / 2],
            [(a + b) / 2 + DOOR_WIDTH / 2, b],
          ]
        : [[a, b]]
      for (const [p, q] of pieces) {
        const mid = (p + q) / 2
        out.push({ side, x: alongX ? mid : fixed, z: alongX ? fixed : mid, length: q - p, alongX, low })
      }
    }
  }
  return out
}

/** A template-space point turned by the room's clockwise grid rotation (three.js rotation.y = −θ). */
export function rotatePoint(x: number, z: number, rotation: number): { x: number; z: number } {
  const q = (((Math.round(rotation / 90) % 4) + 4) % 4) as 0 | 1 | 2 | 3
  switch (q) {
    case 0:
      return { x, z }
    case 1:
      return { x: -z, z: x }
    case 2:
      return { x: -x, z: -z }
    case 3:
      return { x: z, z: -x }
  }
}

/** A template prop's yaw (degrees, three.js convention) after the room's rotation, in radians. */
export function propYaw(rotationYDeg: number, roomRotation: number): number {
  return ((rotationYDeg - roomRotation) * Math.PI) / 180
}

export interface CameraSpec {
  position: [number, number, number]
  lookAt: [number, number, number]
  fov: number
}

/** The template's fixed camera turned with the room; a default three-quarter view when the template is missing. */
export function roomCamera(frame: RoomFrame, camera: CameraSpec | null, rotation: number): CameraSpec {
  if (!camera) {
    const span = Math.max(frame.width, frame.depth)
    return { position: [0, span * 0.95, span * 1.15], lookAt: [0, 1, 0], fov: 40 }
  }
  const p = rotatePoint(camera.position[0], camera.position[2], rotation)
  const l = rotatePoint(camera.lookAt[0], camera.lookAt[2], rotation)
  return { position: [p.x, camera.position[1], p.z], lookAt: [l.x, camera.lookAt[1], l.z], fov: camera.fov }
}

/** The horizontal unit direction from the room's look-at point to the camera. */
export function cameraDir(camera: CameraSpec): { x: number; z: number } {
  const dx = camera.position[0] - camera.lookAt[0]
  const dz = camera.position[2] - camera.lookAt[2]
  const len = Math.hypot(dx, dz)
  return len < 1e-6 ? { x: 0, z: 1 } : { x: dx / len, z: dz / len }
}

/* ---------- where the party came in ---------- */

export interface LogLike {
  readonly floor: number
  readonly roomId: string
  readonly kind: string
}

/**
 * The room the party came from, read from the delve's log (a reload replays the log, so this survives it): the
 * last `room` event on this floor names the current room after a move and the one before it is where the party
 * was. After a flight the sim walks the party back without a `room` event, so then the last one is the room fled.
 */
export function previousRoomId(log: readonly LogLike[], floor: number, currentRoomId: string): string | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]!
    if (e.floor !== floor) {
      if (e.floor < floor) break
      continue
    }
    if (e.kind !== 'room') continue
    if (e.roomId !== currentRoomId) return e.roomId
  }
  return null
}

/** The way into the room a formation is built from: a point on (or in) the room and the direction inward. */
export interface Approach {
  x: number
  z: number
  nx: number
  nz: number
}

/**
 * Where the party stands from: the door it came through; else (a new floor, a crawlway) the `arrival` point (the
 * stairs or the Waystone) looking toward the centre; else the middle of the edge nearest the camera.
 */
export function approachFor(frame: RoomFrame, doors: readonly Doorway[], fromRoomId: string | null, arrival: { x: number; z: number } | null, camDir: { x: number; z: number }): Approach {
  const d = fromRoomId ? doors.find((x) => x.to === fromRoomId) : undefined
  if (d) return { x: d.x, z: d.z, nx: d.nx, nz: d.nz }
  if (arrival) {
    const len = Math.hypot(arrival.x, arrival.z)
    if (len > 0.5) return { x: arrival.x, z: arrival.z, nx: -arrival.x / len, nz: -arrival.z / len }
  }
  // The edge whose outward side faces the camera: the party stands with its back to the viewer.
  if (Math.abs(camDir.x) > Math.abs(camDir.z)) {
    const s = Math.sign(camDir.x) || 1
    return { x: (s * frame.width) / 2, z: 0, nx: -s, nz: 0 }
  }
  const s = Math.sign(camDir.z) || 1
  return { x: 0, z: (s * frame.depth) / 2, nx: 0, nz: -s }
}

/* ---------- formations ---------- */

export interface FormationActor {
  id: string
  side: 'party' | 'enemy'
  /** front / back for heroes and monsters; pets (and the party's summons) stand in their own line. */
  line: 'front' | 'back' | 'pet'
  /** Footprint diameter in metres. */
  girth: number
  /** A pet's hero: outside a fight the pet keeps to its hero's side. */
  owner?: string
}

export interface Mark {
  x: number
  z: number
  /** three.js rotation.y so the actor's local +z faces its foes (or into the room). */
  yaw: number
  /** Standing above the floor (a boss on a dais or a throne platform), metres; 0 when absent. */
  y?: number
}

/** Lateral offsets for a line of `count` actors, squeezed to fit the room's half-width. */
export function spread(count: number, girth: number, halfRoom: number): number[] {
  if (count === 0) return []
  let step = Math.max(1.25, girth + 0.45)
  const maxHalf = Math.max(0.5, halfRoom - 0.7)
  if (((count - 1) * step) / 2 > maxHalf) step = (2 * maxHalf) / Math.max(1, count - 1)
  return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * step)
}

function yawOf(x: number, z: number): number {
  return Math.atan2(x, z)
}

/**
 * Places a formation: each line is a row across the approach axis at the distance `depthOf` gives it (positive =
 * deeper into the room) from `origin`.
 */
function place(
  actors: readonly FormationActor[],
  origin: { x: number; z: number },
  axis: { x: number; z: number },
  lateralHalf: number,
  depthOf: (a: FormationActor, maxGirth: ReadonlyMap<string, number>) => number,
  yawFor: (a: FormationActor) => number,
): Map<string, Mark> {
  const out = new Map<string, Mark>()
  const groups = new Map<string, FormationActor[]>()
  for (const a of actors) {
    const k = `${a.side}:${a.line}`
    const g = groups.get(k)
    if (g) g.push(a)
    else groups.set(k, [a])
  }
  const maxGirth = new Map<string, number>()
  for (const [k, g] of groups) maxGirth.set(k, Math.max(...g.map((a) => a.girth)))
  // The lateral axis: the approach axis turned a quarter.
  const lat = { x: -axis.z, z: axis.x }
  for (const [k, g] of groups) {
    const offs = spread(g.length, maxGirth.get(k) ?? 1, lateralHalf)
    // Stagger the lines behind the front one by half a step, so a camera looking down the approach sees everyone.
    const stagger = k.endsWith(':back') ? 0.75 : k.endsWith(':pet') ? -0.6 : 0
    const room = Math.max(0, lateralHalf - 0.8)
    g.forEach((a, i) => {
      // Three or more in a line zig-zag a little, so a camera looking along the line sees each one (and its bar).
      const d = depthOf(a, maxGirth) + (g.length >= 3 ? (i % 2 === 0 ? -0.35 : 0.35) : 0)
      const o = Math.max(-room, Math.min(room, (offs[i] ?? 0) + stagger))
      out.set(a.id, { x: origin.x + axis.x * d + lat.x * o, z: origin.z + axis.z * d + lat.z * o, yaw: yawFor(a) })
    })
  }
  return out
}

/** The room phase: the party a few steps inside the way it came in, facing into the room. */
export function roomFormation(frame: RoomFrame, approach: Approach, actors: readonly FormationActor[]): Map<string, Mark> {
  const axis = { x: approach.nx, z: approach.nz }
  const alongX = Math.abs(axis.x) > 0.5
  const lateralHalf = alongX ? frame.depth / 2 : frame.width / 2
  // Keep the door's own lateral position, but not so near a wall that the line pokes through it.
  const inset = (v: number, half: number) => Math.max(-half + 1.6, Math.min(half - 1.6, v))
  const origin = { x: alongX ? approach.x : inset(approach.x, frame.width / 2), z: alongX ? inset(approach.z, frame.depth / 2) : approach.z }
  const depth = (a: FormationActor) => (a.line === 'pet' ? 1.0 : a.line === 'back' ? 2.1 : 3.2)
  const yaw = yawOf(axis.x, axis.z)
  const owned = actors.filter((a) => a.owner && actors.some((o) => o.id === a.owner))
  const marks = place(
    actors.filter((a) => !owned.includes(a)),
    origin,
    axis,
    Math.min(lateralHalf, 3.4),
    depth,
    () => yaw,
  )
  // A pet stands at its hero's side, half a step ahead, where the camera can see it.
  const right = { x: -axis.z, z: axis.x }
  for (const a of owned) {
    const o = marks.get(a.owner!)
    if (!o) continue
    marks.set(a.id, { x: o.x - right.x * 0.8 + axis.x * 0.45, z: o.z - right.z * 0.8 + axis.z * 0.45, yaw })
  }
  return marks
}

/**
 * A fight: the party's lines on the side it came in by, the enemies' lines across the room's middle from them
 * (07 §2.2's marks compressed to an 8 m cell); a big front line pushes the enemies' back line further.
 */
export function fightFormation(frame: RoomFrame, approach: Approach, actors: readonly FormationActor[]): Map<string, Mark> {
  const axis = { x: approach.nx, z: approach.nz }
  const alongX = Math.abs(axis.x) > 0.5
  const along = alongX ? frame.width / 2 : frame.depth / 2
  const lateralHalf = alongX ? frame.depth / 2 : frame.width / 2
  const lim = Math.max(2, along - 0.7)
  const clampD = (d: number) => Math.max(-lim, Math.min(lim, d))
  const depth = (a: FormationActor, maxGirth: ReadonlyMap<string, number>) => {
    if (a.side === 'party') return clampD(a.line === 'front' ? -1.3 : a.line === 'back' ? -2.45 : -3.35)
    const front = maxGirth.get('enemy:front') ?? 1
    const firstRow = 1.0 + front / 2
    if (a.line === 'front') return clampD(firstRow)
    const back = maxGirth.get('enemy:back') ?? 1
    return clampD(firstRow + front / 2 + 0.55 + back / 2)
  }
  const yaw = (a: FormationActor) => (a.side === 'party' ? yawOf(axis.x, axis.z) : yawOf(-axis.x, -axis.z))
  return place(actors, { x: 0, z: 0 }, axis, lateralHalf, depth, yaw)
}

/** The screen's right as a floor direction for a camera looking along −camDir. */
export function cameraRight(camDir: { x: number; z: number }): { x: number; z: number } {
  return { x: camDir.z, z: -camDir.x }
}

/**
 * A fight seen from the side (Phase 5, so real heroes read on the phone): the party on the left of the room's fixed
 * camera, the enemies on its right, facing each other across the room's middle and turned a little toward the camera.
 * Each line steps back from the camera in a short diagonal (the further, the further out), so every actor and its
 * bar shows; pets stand in front of their party, low in the picture. Lines are squeezed to stay inside the room.
 */
export function fightSideFormation(frame: RoomFrame, camDir: { x: number; z: number }, actors: readonly FormationActor[]): Map<string, Mark> {
  const right = cameraRight(camDir)
  const away = { x: -camDir.x, z: -camDir.z }
  // How far the room reaches along the screen's right and into the picture (the room is axis-aligned).
  const halfX = Math.abs(right.x) * (frame.width / 2) + Math.abs(right.z) * (frame.depth / 2)
  const halfD = Math.abs(away.x) * (frame.width / 2) + Math.abs(away.z) * (frame.depth / 2)
  const limX = Math.max(1.5, halfX - 0.7)
  const limD = Math.max(1, halfD - 0.9)
  const groups = new Map<string, FormationActor[]>()
  for (const a of actors) {
    const k = `${a.side}:${a.line}`
    const g = groups.get(k)
    if (g) g.push(a)
    else groups.set(k, [a])
  }
  const girthOf = (k: string) => Math.max(0.6, ...(groups.get(k) ?? []).map((a) => a.girth))
  const enemyFront = girthOf('enemy:front')
  const lineX = (side: string, line: string): number => {
    if (side === 'party') return line === 'front' ? -1.35 : line === 'back' ? -2.55 : -0.55
    const first = 0.85 + enemyFront / 2
    return line === 'front' ? first : first + enemyFront / 2 + 0.5 + girthOf('enemy:back') / 2
  }
  const turn = 0.55
  const faceParty = Math.atan2(right.x + camDir.x * turn, right.z + camDir.z * turn)
  const faceEnemy = Math.atan2(-right.x + camDir.x * turn, -right.z + camDir.z * turn)
  const out = new Map<string, Mark>()
  for (const [k, g] of groups) {
    const [side, line] = k.split(':') as [string, string]
    const outward = side === 'party' ? -1 : 1
    const step = Math.max(0.95, girthOf(k) * 0.85)
    const span = Math.min(((g.length - 1) * step) / 2, limD)
    const each = g.length > 1 ? (2 * span) / (g.length - 1) : 0
    // Pets come toward the camera, so they stand low in the picture in front of their heroes.
    const pull = line === 'pet' ? -0.6 : 0
    g.forEach((a, i) => {
      const d = (g.length > 1 ? -span + i * each : 0) + pull
      const zig = g.length >= 3 ? (i % 2 === 0 ? -0.22 : 0.22) : 0
      const x = Math.max(-limX, Math.min(limX, lineX(side, line) + outward * (d * 0.35 + zig)))
      const dd = Math.max(-limD, Math.min(limD, d))
      out.set(a.id, { x: right.x * x + away.x * dd, z: right.z * x + away.z * dd, yaw: side === 'party' ? faceParty : faceEnemy })
    })
  }
  return out
}

/**
 * How far in front of a boss's arena mark the fight's middle stands once it has come to him (metres), and how much
 * further for each metre his mark is raised (the dais in front of a raised throne: the King's 2 m keep the fight off
 * the steps, where it stood before).
 */
export const BOSS_STANDOFF_M = 2.2
export const BOSS_STANDOFF_PER_M = 2.5

/**
 * Phase 8: the fight comes to a boss who keeps an arena mark at the back of the room (Vexa's dais, Naesa's altar, the
 * Hollow King's throne). Laid out in the room's middle, the fight put the boss 5–7 m behind it, and the framing — a
 * band 166 px tall between the HUD's strip and its feed — showed him at 28–49 px. Every mark moves the same distance
 * straight into the picture (the camera's depth axis; left and right stay as they were) until the formation's middle
 * stands `standoff` in front of the boss; a formation already that close, or a boss in front of it, is left alone.
 */
export function advanceToward(marks: ReadonlyMap<string, Mark>, boss: { x: number; y?: number; z: number }, camDir: { x: number; z: number }, standoff = BOSS_STANDOFF_M + BOSS_STANDOFF_PER_M * Math.max(0, boss.y ?? 0)): Map<string, Mark> {
  if (marks.size === 0) return new Map(marks)
  const away = { x: -camDir.x, z: -camDir.z }
  const len = Math.hypot(away.x, away.z) || 1
  away.x /= len
  away.z /= len
  let depth = 0
  for (const m of marks.values()) depth += m.x * away.x + m.z * away.z
  depth /= marks.size
  const shift = boss.x * away.x + boss.z * away.z - standoff - depth
  if (!(shift > 0)) return new Map(marks)
  const out = new Map<string, Mark>()
  for (const [id, m] of marks) out.set(id, { ...m, x: m.x + away.x * shift, z: m.z + away.z * shift })
  return out
}

/* ---------- the floor: which 2 m tiles a pit removes ---------- */

export interface Rect {
  x0: number
  z0: number
  x1: number
  z1: number
}

/** A prop-space rectangle placed at a position with a yaw (three.js rotation about +y), as an axis-aligned box. */
export function placedRect(local: Rect, px: number, pz: number, yawRad: number): Rect {
  const corners: [number, number][] = [
    [local.x0, local.z0],
    [local.x1, local.z0],
    [local.x0, local.z1],
    [local.x1, local.z1],
  ]
  const c = Math.cos(yawRad)
  const s = Math.sin(yawRad)
  let x0 = Infinity
  let z0 = Infinity
  let x1 = -Infinity
  let z1 = -Infinity
  for (const [x, z] of corners) {
    // three.js rotation about +y: x' = x cos + z sin, z' = −x sin + z cos.
    const wx = px + x * c + z * s
    const wz = pz - x * s + z * c
    x0 = Math.min(x0, wx)
    z0 = Math.min(z0, wz)
    x1 = Math.max(x1, wx)
    z1 = Math.max(z1, wz)
  }
  return { x0, z0, x1, z1 }
}

/** The 2 m floor tiles of a room (centres), minus those whose centre falls in a hole. */
export function floorTiles(frame: RoomFrame, holes: readonly Rect[]): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = []
  const tile = 2
  for (let x = -frame.width / 2 + tile / 2; x < frame.width / 2; x += tile) {
    for (let z = -frame.depth / 2 + tile / 2; z < frame.depth / 2; z += tile) {
      if (holes.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1)) continue
      out.push({ x, z })
    }
  }
  return out
}

/** Picks, from candidate spots, the one farthest from everything already standing in the room. */
export function freeSpot(candidates: readonly { x: number; z: number }[], taken: readonly { x: number; z: number }[]): { x: number; z: number } {
  let best = candidates[0] ?? { x: 0, z: 0 }
  let bestD = -1
  for (const c of candidates) {
    let d = Infinity
    for (const t of taken) d = Math.min(d, Math.hypot(c.x - t.x, c.z - t.z))
    if (d > bestD + 1e-9) {
      bestD = d
      best = c
    }
  }
  return best
}

/** A small deterministic generator for the scenery's variety (never the sim's RNG). */
export function scenicRandom(seed: number): () => number {
  let a = (seed | 0) ^ 0x9e3779b9
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---------- keeping formations clear of the furniture ---------- */

export interface Obstacle {
  x: number
  z: number
  /** Footprint radius, metres. */
  r: number
}

/**
 * Shifts a whole formation (across and along its approach axis) to the nearby offset where its actors overlap the
 * room's furniture least, staying inside the room; ties go to the smallest shift. Marks keep their facing.
 */
export function nudgeFormation(
  marks: ReadonlyMap<string, Mark>,
  girth: ReadonlyMap<string, number>,
  obstacles: readonly Obstacle[],
  frame: RoomFrame,
  axis: { x: number; z: number },
  steps: { along: readonly number[]; across: readonly number[] },
): Map<string, Mark> {
  if (marks.size === 0 || obstacles.length === 0) return new Map(marks)
  const lat = { x: -axis.z, z: axis.x }
  const halfW = frame.width / 2 - 0.55
  const halfD = frame.depth / 2 - 0.55
  let best = { dx: 0, dz: 0, cost: Infinity }
  for (const a of steps.along) {
    for (const c of steps.across) {
      const dx = axis.x * a + lat.x * c
      const dz = axis.z * a + lat.z * c
      let cost = 0.04 * (Math.abs(a) + Math.abs(c))
      for (const [id, m] of marks) {
        const x = m.x + dx
        const z = m.z + dz
        const r = (girth.get(id) ?? 0.6) / 2
        cost += 4 * (Math.max(0, Math.abs(x) + r - halfW - 0.3) + Math.max(0, Math.abs(z) + r - halfD - 0.3))
        for (const o of obstacles) {
          const overlap = o.r + r - Math.hypot(x - o.x, z - o.z)
          if (overlap > 0) cost += overlap
        }
      }
      if (cost < best.cost - 1e-9) best = { dx, dz, cost }
    }
  }
  const out = new Map<string, Mark>()
  for (const [id, m] of marks) out.set(id, { x: m.x + best.dx, z: m.z + best.dz, yaw: m.yaw })
  return out
}
