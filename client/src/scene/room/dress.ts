import * as THREE from 'three'
import { MeshBuilder, trs, within, type Tint } from './builder.ts'
import { PALETTE, type Kit } from './kit.ts'
import {
  CUTAWAY_HEIGHT,
  DOOR_WIDTH,
  WALL_HEIGHT,
  WALL_THICK,
  cameraDir,
  facesCamera,
  floorTiles,
  freeSpot,
  placedRect,
  propYaw,
  roomCamera,
  roomFrame,
  rotatePoint,
  scenicRandom,
  sideNormal,
  wallRuns,
  type CameraSpec,
  type Doorway,
  type Obstacle,
  type Rect,
  type RoomFrame,
  type RoomLike,
  type Side,
} from './layout.ts'
import * as P from './props.ts'

/**
 * Dressing a room (Phase 4 grey box): the static set — floor tiles, brick walls cut down on the camera's side,
 * door frames, the template's props — built once per room; and the dynamic dressing — chests, gold, revealed
 * traps, the lit doorways, the curio, the pedlar, the key — rebuilt when the room's state changes. Everything is
 * merged per material: a room is about eight draw calls.
 */
export interface TemplateLike {
  readonly camera: CameraSpec | { readonly position: readonly number[]; readonly lookAt: readonly number[]; readonly fov: number }
  readonly props: readonly { readonly meshId: string; readonly position: readonly number[]; readonly rotationY: number; readonly lightSource?: boolean }[]
}

export interface Placed {
  x: number
  y: number
  z: number
  yaw: number
}

export interface Sockets {
  chestSmall: Placed[]
  chestLarge: Placed[]
  gold: Placed[]
  trapPlates: Placed[]
  cask: Placed[]
  nest: Placed[]
  cage: Placed[]
}

export interface StaticRoomInput {
  room: RoomLike
  kind: string
  template: TemplateLike | null
  /** Doorways drawn as openings (a secret one only once found). */
  openDoors: readonly Doorway[]
  isEntry: boolean
  variation: number
}

export interface StaticRoom {
  group: THREE.Group
  frame: RoomFrame
  camera: CameraSpec
  camDir: { x: number; z: number }
  /** The brazier or campfire flame, when the room has one. */
  fire: THREE.Vector3 | null
  /** Visible sconce flames. */
  sconces: THREE.Vector3[]
  /** Where a party arriving on the floor stands from (the stairs, the Waystone). */
  arrival: { x: number; z: number } | null
  sockets: Sockets
  /** Floor spots already used by props (for placing the dynamic dressing). */
  taken: { x: number; z: number }[]
  /** Points to frame the room with (floor corners and wall tops). */
  framePoints: THREE.Vector3[]
  /** Stair pits: nothing else is placed there. */
  holes: Rect[]
  /** Furniture footprints (the party and the fights keep clear of them). */
  obstacles: Obstacle[]
  dispose(): void
}

function wallTint(height: number): Tint {
  const damp = new THREE.Color(PALETTE.damp)
  return (_x, y, _z, out) => {
    const low = Math.max(0, 1 - y / 1.1)
    out.lerp(damp, 0.35 * low)
    const k = 0.5 + 0.5 * Math.min(1, y / Math.max(0.5, height * 0.7))
    out.multiplyScalar(y >= height - 0.001 ? k * 0.75 : k)
  }
}

function nearestSide(frame: RoomFrame, x: number, z: number): Side {
  const dx = frame.width / 2 - Math.abs(x)
  const dz = frame.depth / 2 - Math.abs(z)
  if (dx < dz) return x > 0 ? 'east' : 'west'
  return z > 0 ? 'south' : 'north'
}

function meshOf(geo: THREE.BufferGeometry | null, mat: THREE.Material, geos: THREE.BufferGeometry[], renderOrder = 0): THREE.Mesh | null {
  if (!geo) return null
  geos.push(geo)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.matrixAutoUpdate = false
  mesh.renderOrder = renderOrder
  return mesh
}

export function buildStaticRoom(kit: Kit, input: StaticRoomInput): StaticRoom {
  const frame = roomFrame(input.room)
  const tplCam = input.template?.camera
  const camera = roomCamera(frame, tplCam ? { position: [tplCam.position[0] ?? 0, tplCam.position[1] ?? 8, tplCam.position[2] ?? 10], lookAt: [tplCam.lookAt[0] ?? 0, tplCam.lookAt[1] ?? 1, tplCam.lookAt[2] ?? 0], fov: tplCam.fov } : null, input.room.rotation)
  const camDir = cameraDir(camera)
  const rotation = input.room.rotation
  const rnd = scenicRandom(input.variation * 7919 + frame.w * 31 + frame.h)
  const pieces: P.Pieces = { kit, props: new MeshBuilder('none'), walls: new MeshBuilder('box', 2), cloth: new MeshBuilder('keep'), glow: new MeshBuilder('none'), rnd }
  const sockets: Sockets = { chestSmall: [], chestLarge: [], gold: [], trapPlates: [], cask: [], nest: [], cage: [] }
  const taken: { x: number; z: number }[] = []
  const obstacles: Obstacle[] = []
  const sconces: THREE.Vector3[] = []
  let fire: THREE.Vector3 | null = null
  let arrival: { x: number; z: number } | null = null

  // Template props in room space.
  const props = (input.template?.props ?? []).map((p) => {
    const at = rotatePoint(p.position[0] ?? 0, p.position[2] ?? 0, rotation)
    return { kind: P.propKind(p.meshId), x: at.x, y: p.position[1] ?? 0, z: at.z, yaw: propYaw(p.rotationY, rotation), lightSource: p.lightSource === true }
  })
  // A Stairs room always shows its stairs (a cistern can host the stairs without a stair prop).
  if (input.kind === 'stairs' && !props.some((p) => p.kind === 'stairs')) {
    const at = rotatePoint(0, -1.5, rotation)
    props.push({ kind: 'stairs', x: at.x, y: 0, z: at.z, yaw: propYaw(0, rotation), lightSource: false })
  }
  const holes: Rect[] = []
  for (const p of props) if (p.kind === 'stairs' && !input.isEntry) holes.push(placedRect(P.STAIRS_PIT, p.x, p.z, p.yaw))
  const inHole = (x: number, z: number) => holes.some((r) => x > r.x0 - 0.4 && x < r.x1 + 0.4 && z > r.z0 - 0.4 && z < r.z1 + 0.4)

  for (const p of props) {
    if (p.kind !== 'stairs' && inHole(p.x, p.z)) continue
    const m = trs(p.x, p.y, p.z, p.yaw)
    const spot: Placed = { x: p.x, y: p.y, z: p.z, yaw: p.yaw }
    switch (p.kind) {
      case 'stairs':
        if (input.isEntry) P.addStairsUp(pieces, m)
        else P.addStairsDown(pieces, m)
        arrival = { x: p.x, z: p.z }
        break
      case 'fire': {
        const f = input.kind === 'rest' ? P.addCampfire(pieces, m) : P.addBrazier(pieces, m)
        fire ??= f
        break
      }
      case 'sconce': {
        const show = !facesCamera(nearestSide(frame, p.x, p.z), camDir)
        const f = P.addSconce(pieces, m, show)
        if (show) sconces.push(f)
        break
      }
      case 'chestSmall':
        sockets.chestSmall.push(spot)
        break
      case 'chestLarge':
        sockets.chestLarge.push(spot)
        break
      case 'gold':
        sockets.gold.push(spot)
        break
      case 'trapPlate':
        P.addTrapPlate(pieces, m)
        sockets.trapPlates.push(spot)
        break
      case 'cask':
        P.addCask(pieces, m)
        sockets.cask.push(spot)
        break
      case 'nest':
        P.addNest(pieces, m)
        sockets.nest.push(spot)
        break
      case 'cage':
        P.addCage(pieces, m, false)
        sockets.cage.push(spot)
        break
      case 'barrel':
        P.addBarrel(pieces, m)
        break
      case 'crate':
        P.addCrates(pieces, m)
        break
      case 'table':
        P.addTable(pieces, m)
        break
      case 'banner':
        P.addBanner(pieces, m)
        break
      case 'grate':
        P.addGrate(pieces, m)
        break
      case 'puddle':
        P.addPuddle(pieces, m)
        break
      case 'beam':
        P.addBeam(pieces, m)
        break
      case 'pillar':
        P.addPillar(pieces, m)
        break
      case 'lowWall':
        P.addLowWall(pieces, m)
        break
      case 'shelf':
        P.addShelf(pieces, m)
        break
      case 'waystone':
        P.addWaystone(pieces, m)
        arrival ??= { x: p.x, z: p.z }
        break
      case 'tablet':
        P.addTablet(pieces, m)
        break
      case 'other':
        P.addOther(pieces, m)
        break
    }
    if (p.kind !== 'sconce' && p.kind !== 'banner' && p.kind !== 'beam' && p.kind !== 'puddle' && p.y < 1.5) taken.push({ x: p.x, z: p.z })
    const r = P.PROP_FOOTPRINT[p.kind]
    if (r > 0 && p.y < 1.5) {
      // A long table is a row of circles along its length (its local x).
      if (p.kind === 'table' || p.kind === 'shelf' || p.kind === 'lowWall') {
        const half = p.kind === 'table' ? 1.5 : p.kind === 'shelf' ? 1.4 : 0.6
        for (const t of [-half, 0, half]) obstacles.push({ x: p.x + Math.cos(p.yaw) * t, z: p.z - Math.sin(p.yaw) * t, r: p.kind === 'table' ? 0.85 : r * 0.6 })
      } else obstacles.push({ x: p.x, z: p.z, r })
    }
  }
  for (const h of holes) {
    // A stair pit is a no-go square.
    const cx = (h.x0 + h.x1) / 2
    const cz = (h.z0 + h.z1) / 2
    for (const fx of [-0.25, 0.25]) for (const fz of [-0.25, 0.25]) obstacles.push({ x: cx + fx * (h.x1 - h.x0), z: cz + fz * (h.z1 - h.z0), r: Math.max(h.x1 - h.x0, h.z1 - h.z0) * 0.36 })
  }

  // The entrance without stairs holds the Waystone (07 §2.2): on the far side, facing the camera.
  if (input.isEntry && !arrival) {
    const far = { x: -camDir.x, z: -camDir.z }
    const lat = { x: -far.z, z: far.x }
    const reach = (Math.abs(far.x) > 0.5 ? frame.width : frame.depth) / 2 - 1.3
    const cands = [-2.2, 0, 2.2].map((o) => ({ x: far.x * reach + lat.x * o, z: far.z * reach + lat.z * o }))
    const at = freeSpot(cands, taken)
    P.addWaystone(pieces, trs(at.x, 0, at.z, Math.atan2(camDir.x, camDir.z)))
    taken.push(at)
    obstacles.push({ x: at.x, z: at.z, r: 0.6 })
    arrival = at
  }

  const geos: THREE.BufferGeometry[] = []
  const group = new THREE.Group()

  // The floor: 2 m flagstone tiles, instanced; darker along the walls, a damp tile here and there.
  const tiles = floorTiles(frame, holes)
  if (tiles.length > 0) {
    const tileGeo = new THREE.PlaneGeometry(2, 2)
    tileGeo.rotateX(-Math.PI / 2)
    geos.push(tileGeo)
    const floor = new THREE.InstancedMesh(tileGeo, kit.mat.floor, tiles.length)
    const m4 = new THREE.Matrix4()
    const c = new THREE.Color()
    const damp = new THREE.Color(PALETTE.damp)
    tiles.forEach((t, i) => {
      m4.makeRotationY((Math.floor(rnd() * 4) * Math.PI) / 2)
      m4.setPosition(t.x, 0, t.z)
      floor.setMatrixAt(i, m4)
      const edge = Math.min(frame.width / 2 - Math.abs(t.x), frame.depth / 2 - Math.abs(t.z))
      c.setHex(PALETTE.floor).multiplyScalar(0.82 + rnd() * 0.22)
      if (edge < 1.5) c.multiplyScalar(0.78)
      if (rnd() < 0.12) c.lerp(damp, 0.3)
      floor.setColorAt(i, c)
    })
    floor.instanceMatrix.needsUpdate = true
    if (floor.instanceColor) floor.instanceColor.needsUpdate = true
    floor.matrixAutoUpdate = false
    group.add(floor)
  }

  // Walls, caps, corner posts and door frames.
  const runs = wallRuns(frame, input.openDoors, camDir)
  const trimTint: Tint = (_x, y, _z, out) => out.multiplyScalar(0.7 + 0.3 * Math.min(1, y / 2))
  for (const r of runs) {
    const h = r.low ? CUTAWAY_HEIGHT : WALL_HEIGHT
    const n = sideNormal(r.side)
    const cx = r.x + n.x * (WALL_THICK / 2)
    const cz = r.z + n.z * (WALL_THICK / 2)
    const sx = r.alongX ? r.length : WALL_THICK
    const sz = r.alongX ? WALL_THICK : r.length
    pieces.walls.add(kit.geo.box, trs(cx, h / 2, cz, 0, sx, h, sz), 0xffffff, wallTint(h))
    pieces.props.add(kit.geo.box, trs(cx, h + 0.05, cz, 0, sx + (r.alongX ? 0 : 0.12), 0.1, sz + (r.alongX ? 0.12 : 0)), PALETTE.trim)
  }
  for (const [sxn, szn] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const sideA: Side = szn < 0 ? 'north' : 'south'
    const sideB: Side = sxn < 0 ? 'west' : 'east'
    const low = facesCamera(sideA, camDir) || facesCamera(sideB, camDir)
    const h = (low ? CUTAWAY_HEIGHT : WALL_HEIGHT) + 0.12
    pieces.props.add(kit.geo.box, trs(sxn * (frame.width / 2 + WALL_THICK / 2), h / 2, szn * (frame.depth / 2 + WALL_THICK / 2), 0, WALL_THICK + 0.14, h, WALL_THICK + 0.14), PALETTE.trimDark, trimTint)
  }
  for (const d of input.openDoors) {
    const low = facesCamera(d.side, camDir)
    const h = low ? CUTAWAY_HEIGHT + 0.25 : WALL_HEIGHT
    const yaw = Math.atan2(d.nx, d.nz)
    const out = { x: -d.nx * (WALL_THICK / 2), z: -d.nz * (WALL_THICK / 2) }
    for (const s of [-1, 1]) {
      const lateral = s * (DOOR_WIDTH / 2 + 0.16)
      // The lateral axis is the inward normal turned a quarter.
      const lx = -d.nz * lateral
      const lz = d.nx * lateral
      pieces.props.add(kit.geo.box, trs(d.x + out.x + lx, h / 2, d.z + out.z + lz, yaw, 0.32, h, WALL_THICK + 0.24), PALETTE.trim, trimTint)
    }
    if (!low) pieces.props.add(kit.geo.box, trs(d.x + out.x, WALL_HEIGHT - 0.3, d.z + out.z, yaw, DOOR_WIDTH + 0.64, 0.6, WALL_THICK + 0.24), PALETTE.trim, trimTint)
    // A threshold stone.
    pieces.props.add(kit.geo.box, trs(d.x + out.x, 0.02, d.z + out.z, yaw, DOOR_WIDTH, 0.04, WALL_THICK), PALETTE.stoneDark)
  }

  for (const mesh of [
    meshOf(pieces.walls.build(), kit.mat.wall, geos),
    meshOf(pieces.props.build(), kit.mat.prop, geos),
    meshOf(pieces.cloth.build(), kit.mat.banner, geos),
    meshOf(pieces.glow.build(), kit.mat.flame, geos, 2),
  ])
    if (mesh) group.add(mesh)

  const framePoints: THREE.Vector3[] = []
  for (const [x, z] of [
    [-frame.width / 2, -frame.depth / 2],
    [frame.width / 2, -frame.depth / 2],
    [-frame.width / 2, frame.depth / 2],
    [frame.width / 2, frame.depth / 2],
  ] as const) {
    framePoints.push(new THREE.Vector3(x, 0, z))
    // The far walls' upper part, so the room reads as a room and not a floor plan.
    if (x * camDir.x + z * camDir.z < 0.5) framePoints.push(new THREE.Vector3(x, 1.8, z))
  }

  return {
    group,
    frame,
    camera,
    camDir,
    fire,
    sconces,
    arrival,
    sockets,
    taken,
    framePoints,
    holes,
    obstacles,
    dispose() {
      for (const g of geos) g.dispose()
      group.clear()
    },
  }
}

/* ---------- the dynamic dressing ---------- */

export interface DoorState {
  doorway: Doorway
  /** Shown at all (a secret door appears once found). */
  shown: boolean
  /** A legal move through it: true lit, false barred, null no move now (a fight, a result). */
  move: boolean | null
}

export interface DynamicInput {
  kind: string
  doors: readonly DoorState[]
  hasKey: boolean
  chests: readonly { size: string; locked: boolean; opened: boolean }[]
  goldPiles: readonly number[]
  traps: readonly { revealed: boolean; disarmed: boolean; triggered: boolean; blocksDoorTo: string | null }[]
  curio: { id: string; used: boolean } | null
  merchant: boolean
  keyHere: boolean
  /** Where the party stands (kept clear). */
  partySpots: readonly { x: number; z: number }[]
  variation: number
}

export interface DynamicDressing {
  group: THREE.Group
  /** Spots the scene can point at (the curio, for a ring). */
  dispose(): void
}

/** Candidate floor spots: against the walls the camera can see, or in the room's middle. */
function wallSpots(frame: RoomFrame, camDir: { x: number; z: number }): Placed[] {
  const out: Placed[] = []
  const sides: Side[] = ['north', 'east', 'south', 'west']
  for (const side of sides) {
    if (facesCamera(side, camDir)) continue
    const n = sideNormal(side)
    const alongX = side === 'north' || side === 'south'
    const count = alongX ? frame.w : frame.h
    for (let i = 0; i < count; i++) {
      for (const o of [-2.4, 2.4]) {
        const along = (i + 0.5) * 8 - (alongX ? frame.width : frame.depth) / 2 + o
        const x = alongX ? along : n.x * (frame.width / 2 - 1.3)
        const z = alongX ? n.z * (frame.depth / 2 - 1.3) : along
        out.push({ x, y: 0, z, yaw: Math.atan2(-n.x, -n.z) })
      }
    }
  }
  return out
}

function middleSpots(frame: RoomFrame): Placed[] {
  const out: Placed[] = []
  for (let x = -frame.width / 2 + 1.8; x <= frame.width / 2 - 1.8 + 1e-9; x += 1.1) for (let z = -frame.depth / 2 + 1.8; z <= frame.depth / 2 - 1.8 + 1e-9; z += 1.1) out.push({ x, y: 0, z, yaw: 0 })
  return out
}

export function buildDynamic(kit: Kit, room: StaticRoom, input: DynamicInput): DynamicDressing {
  const rnd = scenicRandom(input.variation * 104729 + 17)
  const pieces: P.Pieces = { kit, props: new MeshBuilder('none'), walls: new MeshBuilder('box', 2), cloth: new MeshBuilder('keep'), glow: new MeshBuilder('none'), rnd }
  const { frame, camDir } = room
  const taken = [...room.taken, ...input.partySpots]
  const pick = (cands: readonly Placed[], fallback: readonly Placed[]): Placed => {
    const pool = cands.length > 0 ? cands : fallback
    const at = freeSpot(pool, taken)
    const found = pool.find((p) => p.x === at.x && p.z === at.z) ?? { x: at.x, y: 0, z: at.z, yaw: 0 }
    taken.push({ x: found.x, z: found.z })
    return found
  }
  const toCamera = Math.atan2(camDir.x, camDir.z)
  const outOfPit = (p: Placed) => !room.holes.some((r) => p.x > r.x0 - 1 && p.x < r.x1 + 1 && p.z > r.z0 - 1 && p.z < r.z1 + 1)
  const clear = (p: Placed) => outOfPit(p) && !input.partySpots.some((q) => Math.hypot(p.x - q.x, p.z - q.z) < 1.6)
  // Prefer spots clear of the pit and the party; fall back to anywhere out of the pit.
  const prefer = (list: Placed[]) => (list.some(clear) ? list.filter(clear) : list.filter(outOfPit))
  const walls = prefer(wallSpots(frame, camDir))
  const middle = prefer(middleSpots(frame))

  // Doorways: lit when the party can go through, barred when locked.
  for (const d of input.doors) {
    if (!d.shown) continue
    const w = d.doorway
    const low = facesCamera(w.side, camDir)
    const yaw = Math.atan2(w.nx, w.nz)
    const m = trs(w.x, 0, w.z, yaw)
    if (w.locked) P.addPortcullis(pieces, trs(w.x - w.nx * 0.12, 0, w.z - w.nz * 0.12, yaw), input.hasKey, low ? CUTAWAY_HEIGHT + 0.35 : WALL_HEIGHT - 0.6)
    // On a cut-away wall (nearest the camera) only the threshold glows; a curtain of light there would fill the view.
    if (d.move !== null) P.addDoorGlow(pieces, m, d.move ? PALETTE.doorGlow : PALETTE.doorShut, low ? 0 : 2.6)
  }

  // Chests on their sockets (by size), else against a wall the camera sees.
  const smalls = [...room.sockets.chestSmall]
  const larges = [...room.sockets.chestLarge]
  for (const c of input.chests) {
    const large = c.size === 'large' || c.size === 'grand'
    const socket = (large ? larges.shift() : smalls.shift()) ?? (large ? smalls.shift() : larges.shift())
    const at = socket ?? pick(walls, middle)
    if (socket) taken.push({ x: socket.x, z: socket.z })
    P.addChest(pieces, trs(at.x, 0, at.z, socket ? at.yaw : toCamera), large, c.opened, c.locked)
  }

  // Gold piles.
  const goldSockets = [...room.sockets.gold]
  for (const amount of input.goldPiles) {
    const socket = goldSockets.shift()
    const at = socket ?? pick(middle, walls)
    P.addGold(pieces, trs(at.x, 0, at.z, at.yaw), amount)
  }

  // Revealed traps: on the door they block, on a trap plate, or in the room's middle.
  const plates = [...room.sockets.trapPlates]
  for (const t of input.traps) {
    if (!t.revealed) continue
    const state = t.disarmed ? 'disarmed' : t.triggered ? 'sprung' : 'armed'
    const door = t.blocksDoorTo ? input.doors.find((d) => d.doorway.to === t.blocksDoorTo) : undefined
    let at: Placed
    if (door) at = { x: door.doorway.x + door.doorway.nx * 1.4, y: 0, z: door.doorway.z + door.doorway.nz * 1.4, yaw: 0 }
    else at = plates.shift() ?? pick(middle, walls)
    P.addTrapMark(pieces, trs(at.x, 0, at.z), state)
  }

  // The curio (07 §2.4): on a matching socket when the template has one, else in the room; ringed until used.
  if (input.curio) {
    const id = input.curio.id
    const used = input.curio.used
    const socketFor = /cask/.test(id) ? room.sockets.cask[0] : /nest/.test(id) ? room.sockets.nest[0] : /cage/.test(id) ? room.sockets.cage[0] : undefined
    const at = socketFor ?? pick(middle, walls)
    const m = trs(at.x, at.y, at.z, socketFor ? at.yaw : toCamera)
    const ground = trs(at.x, 0, at.z)
    if (!socketFor) {
      if (/cask/.test(id)) P.addCask(pieces, m)
      else if (/dice/.test(id)) P.addDiceTable(pieces, m)
      else if (/nest/.test(id)) P.addNest(pieces, m)
      else if (/cage/.test(id)) P.addCage(pieces, trs(at.x, 2.4, at.z, at.yaw), !used)
      else if (/larder/.test(id)) P.addLarder(pieces, m)
      else if (/shrine/.test(id)) P.addShrine(pieces, m)
      else if (/lantern/.test(id)) P.addLantern(pieces, m, !used)
      else if (/gallows/.test(id)) P.addGallows(pieces, m)
      else P.addTablet(pieces, m)
    } else if (/cage/.test(id) && !used) P.addCage(pieces, m, true)
    if (!used) P.addFloorRing(pieces, ground, /cask/.test(id) ? 1.5 : 1.1, PALETTE.doorGlow)
  }

  // The pedlar and the cart.
  if (input.merchant) {
    const at = pick(walls, middle)
    // Parallel to the wall (the cart's length is its local x), the pedlar at its front corner.
    const m = trs(at.x, 0, at.z, at.yaw)
    P.addCart(pieces, m)
    P.addFigure(pieces, within(m, trs(1.55, 0, 0.55, -0.4)), 0x4f5a3a, 0xd9a98c)
  }

  // The floor's key, where it waits to be picked up.
  if (input.keyHere) {
    const at = pick(middle, walls)
    P.addKey(pieces, trs(at.x, 0, at.z, rnd() * Math.PI))
  }

  const geos: THREE.BufferGeometry[] = []
  const group = new THREE.Group()
  for (const mesh of [
    meshOf(pieces.walls.build(), kit.mat.wall, geos),
    meshOf(pieces.props.build(), kit.mat.prop, geos),
    meshOf(pieces.glow.build(), kit.mat.glow, geos, 3),
  ])
    if (mesh) group.add(mesh)
  return {
    group,
    dispose() {
      for (const g of geos) g.dispose()
      group.clear()
    },
  }
}
