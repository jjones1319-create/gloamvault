import * as THREE from 'three'
import { pickWeighted, TORCH_COLOUR, turnSide, type KitZone } from '../env/envData.ts'
import type { EnvSet, KitPiece } from '../env/envKit.ts'
import { KitRoomBuilder, movingPart, movingPiece, type AddOptions, type KitBuild, type KitMaterials } from '../env/kitRoom.ts'
import type { FlamePoint, MotePoint } from '../vfx/layer.ts'
import { shellLayout } from '../env/shell.ts'
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
 * Dressing a room: the static set — floor, walls cut down on the camera's side, doorways, the template's props — built
 * once per room; and the dynamic dressing — chests, gold, revealed traps, the lit doorways, the curio, the pedlar, the
 * key — rebuilt when the room's state changes.
 *
 * Phase 6: with the zone's kit loaded (`env`), the floor, walls, doorways and corners come from the zone's shell pieces
 * (env/shell.ts lays them out from the footprint and doors) and each prop is its kit piece by meshId, every repeated
 * piece one InstancedMesh on the zone's one material (env/kitRoom.ts). Whatever the kit lacks is drawn in the Phase 4
 * grey box, piece by piece, so a half-built kit still makes a whole room. The grey box is merged per material: about
 * eight draw calls.
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

/** The zone's kit and the materials it draws with (solid; see-through by opacity for mist and webs; water). */
export interface RoomEnv {
  set: EnvSet
  materials: KitMaterials
}

export interface StaticRoomInput {
  room: RoomLike
  kind: string
  template: TemplateLike | null
  /** Doorways drawn as openings (a secret one only once found). */
  openDoors: readonly Doorway[]
  isEntry: boolean
  /**
   * 07 §1.1: the entry room of a zone's first floor holds its Waystone (Gravehollow F1, F4, F7; sim/src/explore.ts
   * isWaystoneFloor). True: the Waystone stands here, stairs or not; false: no Waystone — an entry without stairs gets
   * the stairs the party came down. Absent (the gallery, the room viewer): Phase 4's reading, an entry without stairs
   * shows the Waystone.
   */
  waystone?: boolean
  variation: number
  /** Phase 6: the zone's kit; null or missing draws the grey box. */
  env?: RoomEnv | null
  /** The template's id (the zone file's per-template floor mix and substitutions). */
  templateId?: string
  /** Parts of a piece left out, by meshId (the throne's empty seat while the Hollow King sits on his own). */
  skipParts?: Readonly<Record<string, readonly string[]>>
}

/** A fire in the room: the point lights go to the two nearest the party. */
export interface LightPoint {
  x: number
  y: number
  z: number
  color: number
  /** 1 a campfire or brazier, less for a sconce or a candle. */
  strength: number
}

export interface StaticRoom {
  group: THREE.Group
  frame: RoomFrame
  camera: CameraSpec
  camDir: { x: number; z: number }
  /** Every fire the room has (kit flames and grey-box sconces and braziers). */
  lights: LightPoint[]
  /** Kit flames, drawn as sprites by the effects layer (the grey box draws its own). */
  flames: FlamePoint[]
  /** Kit `fx_*` points: motes, drips, bubbles, fog … */
  motes: MotePoint[]
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
  /** The kit meshes, when the room has any. */
  kit: KitBuild | null
  env: RoomEnv | null
  /** How the room was built: every piece from the kit, some, or none (the overlay and the shots say so). */
  kitShare: 'kit' | 'mixed' | 'grey'
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

/** The pieces of a shell list the kit has. */
function firstOf(kb: KitRoomBuilder | null, ids: readonly string[] | undefined): string[] {
  return kb && ids ? ids.filter((id) => kb.has(id)) : []
}

/** A shell list and its weights, keeping only the pieces the kit has. */
function kitList(kb: KitRoomBuilder | null, ids: readonly string[] | undefined, weights: readonly number[] | undefined): { ids: string[]; weights: number[] } {
  const out = { ids: [] as string[], weights: [] as number[] }
  if (!kb || !ids) return out
  ids.forEach((id, i) => {
    if (!kb.has(id)) return
    out.ids.push(id)
    out.weights.push(weights?.[i] ?? 1)
  })
  return out
}

/** A kit piece's flames as light points (a campfire carries more light than a candle). */
function flameLights(flames: readonly FlamePoint[]): LightPoint[] {
  return flames.map((f) => ({ x: f.x, y: f.y + f.size * 0.4, z: f.z, color: f.color, strength: Math.max(0.6, Math.min(1, f.size / 0.85)) }))
}

/** The room edge a point stands on (within `tol` metres of its line), or null. */
function edgeSide(frame: RoomFrame, x: number, z: number, tol = 0.4): Side | null {
  if (Math.abs(z + frame.depth / 2) < tol) return 'north'
  if (Math.abs(z - frame.depth / 2) < tol) return 'south'
  if (Math.abs(x - frame.width / 2) < tol) return 'east'
  if (Math.abs(x + frame.width / 2) < tol) return 'west'
  return null
}

/** The floor a descending piece opens: the hole the kit declares, else its bounds where it goes below the floor. */
function pitOf(piece: KitPiece | null): Rect | null {
  if (!piece) return null
  if (piece.hole) return { x0: piece.hole[0], z0: piece.hole[1], x1: piece.hole[2], z1: piece.hole[3] }
  if (piece.bounds.min.y > -0.2) return null
  const b = piece.bounds
  return { x0: b.min.x, z0: b.min.z, x1: b.max.x, z1: b.max.z }
}

export function buildStaticRoom(kit: Kit, input: StaticRoomInput): StaticRoom {
  const frame = roomFrame(input.room)
  const tplCam = input.template?.camera
  const camera = roomCamera(frame, tplCam ? { position: [tplCam.position[0] ?? 0, tplCam.position[1] ?? 8, tplCam.position[2] ?? 10], lookAt: [tplCam.lookAt[0] ?? 0, tplCam.lookAt[1] ?? 1, tplCam.lookAt[2] ?? 0], fov: tplCam.fov } : null, input.room.rotation)
  const camDir = cameraDir(camera)
  const rotation = input.room.rotation
  const rnd = scenicRandom(input.variation * 7919 + frame.w * 31 + frame.h)
  const pieces: P.Pieces = { kit, props: new MeshBuilder('none'), walls: new MeshBuilder('box', 2), cloth: new MeshBuilder('keep'), glow: new MeshBuilder('none'), rnd }
  const env = input.env ?? null
  const kb = env ? new KitRoomBuilder(env.set, env.materials) : null
  // The zone file's per-template substitutions (the guardpost's campfire is a brazier).
  const substitute = env?.set.info.substitute.get(input.templateId ?? '')
  let kitPieces = 0
  let greyPieces = 0
  const sockets: Sockets = { chestSmall: [], chestLarge: [], gold: [], trapPlates: [], cask: [], nest: [], cage: [] }
  const taken: { x: number; z: number }[] = []
  const obstacles: Obstacle[] = []
  const lights: LightPoint[] = []
  let arrival: { x: number; z: number } | null = null

  // Template props in room space.
  const props = (input.template?.props ?? []).map((p) => {
    const at = rotatePoint(p.position[0] ?? 0, p.position[2] ?? 0, rotation)
    const meshId = substitute?.get(p.meshId) ?? p.meshId
    return { meshId, kind: P.propKind(p.meshId), x: at.x, y: p.position[1] ?? 0, z: at.z, yaw: propYaw(p.rotationY, rotation), lightSource: p.lightSource === true }
  })
  // A Stairs room always shows its stairs (a cistern can host the stairs without a stair prop).
  if (input.kind === 'stairs' && !props.some((p) => p.kind === 'stairs')) {
    const at = rotatePoint(0, -1.5, rotation)
    props.push({ meshId: 'shr_stairs_down', kind: 'stairs', x: at.x, y: 0, z: at.z, yaw: propYaw(0, rotation), lightSource: false })
  }
  // Holes in the floor: the stairs down's pit, and every piece that opens its own (deep water, a bone grate, an open
  // slab, a sluice channel): the flagstones under them are left out.
  const holes: Rect[] = []
  const holeOwners = new Set<number>()
  props.forEach((p, i) => {
    const piece = kb?.piece(p.meshId) ?? null
    if (p.kind === 'stairs' && !input.isEntry) {
      holes.push(placedRect(pitOf(piece) ?? P.STAIRS_PIT, p.x, p.z, p.yaw))
      holeOwners.add(i)
    } else if (piece?.hole) {
      holes.push(placedRect({ x0: piece.hole[0], z0: piece.hole[1], x1: piece.hole[2], z1: piece.hole[3] }, p.x, p.z, p.yaw))
      holeOwners.add(i)
    }
  })
  const inHole = (x: number, z: number) => holes.some((r) => x > r.x0 - 0.4 && x < r.x1 + 0.4 && z > r.z0 - 0.4 && z < r.z1 + 0.4)
  // Templates never replace shell pieces (the kit passes' rule): wall-hung facings, shelves and banners hang in front
  // of the shell's wall, and on the side cut away toward the camera they are not drawn, like its walls.
  const blocked: { side: Side; from: number; to: number }[] = []
  const wallHung = (meshId: string, piece: KitPiece | null): boolean => {
    const role = piece?.role ?? ''
    const mount = piece?.mount ?? ''
    return mount === 'wall' || mount === 'shell' || role === 'wall-hung' || /_wall_|_door_|sconce|banner|bracket|shelf|niche/.test(meshId)
  }

  for (const [i, p] of props.entries()) {
    if (!holeOwners.has(i) && inHole(p.x, p.z)) continue
    const m = trs(p.x, p.y, p.z, p.yaw)
    const spot: Placed = { x: p.x, y: p.y, z: p.z, yaw: p.yaw }
    // Sockets for the dynamic dressing (chests and gold are drawn there only when the room has them).
    if (p.kind === 'chestSmall' || p.kind === 'chestLarge' || p.kind === 'gold') {
      sockets[p.kind === 'gold' ? 'gold' : p.kind].push(spot)
      continue
    }
    if (p.kind === 'trapPlate') sockets.trapPlates.push(spot)
    if (p.kind === 'cask') sockets.cask.push(spot)
    if (p.kind === 'nest') sockets.nest.push(spot)
    if (p.kind === 'cage') sockets.cage.push(spot)
    if (p.kind === 'stairs') arrival = { x: p.x, z: p.z }
    if (p.kind === 'waystone') arrival ??= { x: p.x, z: p.z }
    // A sconce (or any wall-hung piece) on the wall cut away toward the camera is not drawn (nor lit).
    const nearEdge = edgeSide(frame, p.x, p.z, 0.9) !== null
    const wallMounted = p.kind === 'sconce' || (nearEdge && wallHung(p.meshId, kb?.piece(p.meshId) ?? null))
    const cutWall = wallMounted && facesCamera(nearestSide(frame, p.x, p.z), camDir)
    // The entrance's stairs rise (the way the party came down): the shared kit's stairs up, when it has them.
    const kitId = p.kind === 'stairs' && input.isEntry ? 'shr_stairs_up' : p.meshId
    const kitDraws = !cutWall && kb?.has(kitId) === true
    if (kitDraws) {
      const before = kb!.flames.length
      const skip = input.skipParts?.[kitId]
      kb!.add(kitId, m, skip ? { skipParts: skip } : {})
      lights.push(...flameLights(kb!.flames.slice(before)))
      kitPieces++
    } else if (!cutWall) {
      greyPieces++
      switch (p.kind) {
        case 'stairs':
          if (input.isEntry) P.addStairsUp(pieces, m)
          else P.addStairsDown(pieces, m)
          break
        case 'fire': {
          const f = input.kind === 'rest' ? P.addCampfire(pieces, m) : P.addBrazier(pieces, m)
          lights.push({ x: f.x, y: f.y, z: f.z, color: TORCH_COLOUR, strength: 1 })
          break
        }
        case 'sconce': {
          const f = P.addSconce(pieces, m, true)
          lights.push({ x: f.x, y: f.y, z: f.z, color: TORCH_COLOUR, strength: 0.85 })
          break
        }
        case 'trapPlate':
          P.addTrapPlate(pieces, m)
          break
        case 'cask':
          P.addCask(pieces, m)
          break
        case 'nest':
          P.addNest(pieces, m)
          break
        case 'cage':
          P.addCage(pieces, m, false)
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
          break
        case 'tablet':
          P.addTablet(pieces, m)
          break
        default:
          P.addOther(pieces, m)
          break
      }
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

  // The entrance holds the Waystone on a zone's first floor (07 §1.1, input.waystone), else an entrance without stairs
  // shows the stairs the party came down; on the far side, facing the camera. Without the flag (the gallery), the
  // entrance without stairs holds the Waystone, as in Phase 4.
  const stoneHere = input.isEntry && (input.waystone === true || (input.waystone === undefined && !arrival))
  const stairsHere = input.isEntry && input.waystone === false && !arrival
  if (stoneHere || stairsHere) {
    const far = { x: -camDir.x, z: -camDir.z }
    const lat = { x: -far.z, z: far.x }
    const reach = (Math.abs(far.x) > 0.5 ? frame.width : frame.depth) / 2 - 1.3
    // Stairs on the far side already: the Waystone stands a step into the room beside them, where the landscape HUD
    // and the stairs' own walls cannot hide it.
    const stairsFar = arrival !== null && arrival.x * far.x + arrival.z * far.z > reach / 2
    const latHalf = (Math.abs(far.x) > 0.5 ? frame.depth : frame.width) / 2 - 1.0
    const beside = stairsFar ? [-2.8, 2.8, -3.6, 3.6].filter((o) => Math.abs(o) <= latHalf) : []
    const line = beside.length > 0 ? Math.max(0, reach - 1.8) : reach
    const offsets = beside.length > 0 ? beside : [-2.2, 0, 2.2]
    const cands = offsets.map((o) => ({ x: far.x * line + lat.x * o, z: far.z * line + lat.z * o }))
    const at = freeSpot(cands, taken)
    const m = trs(at.x, 0, at.z, Math.atan2(camDir.x, camDir.z))
    const id = stoneHere ? 'shr_waystone' : 'shr_stairs_up'
    if (kb?.has(id)) {
      const before = kb.flames.length
      kb.add(id, m)
      lights.push(...flameLights(kb.flames.slice(before)))
      kitPieces++
    } else if (stoneHere) P.addWaystone(pieces, m)
    else P.addStairsUp(pieces, m)
    taken.push(at)
    obstacles.push({ x: at.x, z: at.z, r: stoneHere ? 0.6 : 1.4 })
    arrival = at
  }

  const geos: THREE.BufferGeometry[] = []
  const ownedInstanced: THREE.InstancedMesh[] = []
  const group = new THREE.Group()

  // The shell: the zone's floor, walls, doorways and corners from the kit, or the grey box (piece by piece).
  const shell = env?.set.info.shell
  const mix = env?.set.info.floorMix.get(input.templateId ?? '')
  const floor = kitList(kb, mix?.ids ?? shell?.floor, mix?.weights ?? shell?.floorWeights)
  const walls = kitList(kb, shell?.wall, shell?.wallWeights)
  const lowIds = firstOf(kb, shell?.low)
  const doorwayId = firstOf(kb, shell?.doorway)[0]
  const doorwayCutId = firstOf(kb, shell?.doorwayCut)[0]
  const cornerId = firstOf(kb, shell?.corner)[0]
  const cornerCutId = firstOf(kb, shell?.cornerCut)[0]
  const doorwayPiece = doorwayId ? kb!.piece(doorwayId) : null
  // A template's own doorway skins (`doorSkins`: the reliquary's iron gate, the well's portcullises, the Vigil's secret
  // doors), by the template's side turned with the room.
  const skins = env?.set.info.doorSkins.get(input.templateId ?? '')
  const skinFor = (side: Side | undefined): string | undefined => {
    if (!skins || !side) return undefined
    for (const [k, id] of skins) if (k === '*' || (k !== '*' && turnSide(k as Side, rotation) === side)) return kb?.has(id) ? id : undefined
    return undefined
  }
  const doorwayWidth = doorwayPiece ? Math.min(6, Math.max(DOOR_WIDTH, doorwayPiece.bounds.max.x - doorwayPiece.bounds.min.x)) : DOOR_WIDTH
  const layout =
    kb && (floor.ids.length || walls.ids.length)
      ? shellLayout(frame, input.openDoors.map((d) => ({ side: d.side, offset: d.offset, to: d.to })), camDir, { doorwayWidth: doorwayId ? doorwayWidth : DOOR_WIDTH, holes, blocked, seed: input.variation + 1, cutDoorways: !!doorwayId && !!doorwayCutId })
      : []

  if (floor.ids.length) {
    // An earth floor covers the whole room or none of it (the kit's `floorWhole`): one roll for the room, then the
    // flagstones' own variants tile by tile.
    const whole = new Set(shell?.floorWhole ?? [])
    const tiled = { ids: floor.ids.filter((id) => !whole.has(id)), weights: floor.weights.filter((_, i) => !whole.has(floor.ids[i]!)) }
    const roomRoll = scenicRandom(input.variation * 131 + 7)()
    const wholePick = whole.size ? pickWeighted(floor.ids, floor.weights, roomRoll) : undefined
    const everywhere = wholePick && whole.has(wholePick) ? wholePick : undefined
    for (const s of layout) {
      if (s.role !== 'floor') continue
      const id = everywhere ?? pickWeighted(tiled.ids.length ? tiled.ids : floor.ids, tiled.ids.length ? tiled.weights : floor.weights, s.roll)!
      kb!.add(id, trs(s.x, 0, s.z, s.yaw))
    }
    kitPieces++
  } else {
    greyPieces++
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
      ownedInstanced.push(floor)
    }
  }

  const trimTint: Tint = (_x, y, _z, out) => out.multiplyScalar(0.7 + 0.3 * Math.min(1, y / 2))
  if (walls.ids.length) {
    kitPieces++
    for (const s of layout) {
      if (s.role === 'wall') {
        // The camera's side: the kit's cut wall when it has one, else its plain wall cut down.
        if (s.low && lowIds.length) kb!.add(lowIds[0]!, trs(s.x, 0, s.z, s.yaw, s.sx, 1, 1), { lights: false })
        else kb!.add(s.low ? walls.ids[0]! : pickWeighted(walls.ids, walls.weights, s.roll)!, trs(s.x, 0, s.z, s.yaw, s.sx, s.sy, 1), { lights: !s.low })
      } else if (s.role === 'doorway') {
        const skin = s.low ? undefined : skinFor(s.side)
        if (s.low && doorwayCutId) kb!.add(doorwayCutId, trs(s.x, 0, s.z, s.yaw), { lights: false })
        else if (skin) kb!.add(skin, trs(s.x, 0, s.z, s.yaw), skinOptions(skin))
        else if (!s.low && doorwayId) kb!.add(doorwayId, trs(s.x, 0, s.z, s.yaw))
      } else if (s.role === 'corner') {
        if (s.low && cornerCutId) kb!.add(cornerCutId, trs(s.x, 0, s.z, s.yaw), { lights: false })
        else if (cornerId) kb!.add(cornerId, trs(s.x, 0, s.z, s.yaw, 1, s.sy, 1), { lights: !s.low })
      }
    }
    if (!doorwayId) greyDoorFrames(pieces, input.openDoors, camDir, trimTint)
    if (!cornerId) greyCorners(pieces, frame, camDir, trimTint)
  } else {
    greyPieces++
    // Walls, caps, corner posts and door frames.
    for (const r of wallRuns(frame, input.openDoors, camDir)) {
      const h = r.low ? CUTAWAY_HEIGHT : WALL_HEIGHT
      const n = sideNormal(r.side)
      const cx = r.x + n.x * (WALL_THICK / 2)
      const cz = r.z + n.z * (WALL_THICK / 2)
      const sx = r.alongX ? r.length : WALL_THICK
      const sz = r.alongX ? WALL_THICK : r.length
      pieces.walls.add(kit.geo.box, trs(cx, h / 2, cz, 0, sx, h, sz), 0xffffff, wallTint(h))
      pieces.props.add(kit.geo.box, trs(cx, h + 0.05, cz, 0, sx + (r.alongX ? 0 : 0.12), 0.1, sz + (r.alongX ? 0.12 : 0)), PALETTE.trim)
    }
    greyCorners(pieces, frame, camDir, trimTint)
    greyDoorFrames(pieces, input.openDoors, camDir, trimTint)
  }

  for (const mesh of [
    meshOf(pieces.walls.build(), kit.mat.wall, geos),
    meshOf(pieces.props.build(), kit.mat.prop, geos),
    meshOf(pieces.cloth.build(), kit.mat.banner, geos),
    meshOf(pieces.glow.build(), kit.mat.flame, geos, 2),
  ])
    if (mesh) group.add(mesh)

  const kitBuild = kb ? kb.build() : null
  if (kitBuild) group.add(kitBuild.group)

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
    lights,
    flames: kb ? [...kb.flames] : [],
    motes: kb ? [...kb.motes] : [],
    arrival,
    sockets,
    taken,
    framePoints,
    holes,
    obstacles,
    kit: kitBuild,
    env,
    kitShare: kitPieces === 0 ? 'grey' : greyPieces === 0 ? 'kit' : 'mixed',
    dispose() {
      for (const g of geos) g.dispose()
      for (const m of ownedInstanced.splice(0)) m.dispose()
      kitBuild?.dispose()
      group.clear()
    },
  }
}

/**
 * How a doorway skin stands open in a room the party walks through: an iron gate's leaves swung back, a portcullis's
 * gate raised out of sight (the Well of Bones' trap drops it, Phase 7); a secret door stays shut (its panel opens with
 * the Vigil's second phase).
 */
function skinOptions(meshId: string): AddOptions {
  if (/portcullis|sluice/.test(meshId)) return { skipParts: ['gate'] }
  if (/door_iron|door_wood/.test(meshId)) return { turnParts: { leaf_l: { axis: 'y', angle: 1.55 }, leaf_r: { axis: 'y', angle: -1.55 }, leaf: { axis: 'y', angle: 1.55 } } }
  return {}
}

/** The grey box's corner posts (when the kit has no corner piece). */
function greyCorners(pieces: P.Pieces, frame: RoomFrame, camDir: { x: number; z: number }, trimTint: Tint): void {
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
    pieces.props.add(pieces.kit.geo.box, trs(sxn * (frame.width / 2 + WALL_THICK / 2), h / 2, szn * (frame.depth / 2 + WALL_THICK / 2), 0, WALL_THICK + 0.14, h, WALL_THICK + 0.14), PALETTE.trimDark, trimTint)
  }
}

/** The grey box's door frames (when the kit has no doorway piece). */
function greyDoorFrames(pieces: P.Pieces, openDoors: readonly Doorway[], camDir: { x: number; z: number }, trimTint: Tint): void {
  const { box } = pieces.kit.geo
  for (const d of openDoors) {
    const low = facesCamera(d.side, camDir)
    const h = low ? CUTAWAY_HEIGHT + 0.25 : WALL_HEIGHT
    const yaw = Math.atan2(d.nx, d.nz)
    const out = { x: -d.nx * (WALL_THICK / 2), z: -d.nz * (WALL_THICK / 2) }
    for (const s of [-1, 1]) {
      const lateral = s * (DOOR_WIDTH / 2 + 0.16)
      // The lateral axis is the inward normal turned a quarter.
      const lx = -d.nz * lateral
      const lz = d.nx * lateral
      pieces.props.add(box, trs(d.x + out.x + lx, h / 2, d.z + out.z + lz, yaw, 0.32, h, WALL_THICK + 0.24), PALETTE.trim, trimTint)
    }
    if (!low) pieces.props.add(box, trs(d.x + out.x, WALL_HEIGHT - 0.3, d.z + out.z, yaw, DOOR_WIDTH + 0.64, 0.6, WALL_THICK + 0.24), PALETTE.trim, trimTint)
    // A threshold stone.
    pieces.props.add(box, trs(d.x + out.x, 0.02, d.z + out.z, yaw, DOOR_WIDTH, 0.04, WALL_THICK), PALETTE.stoneDark)
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

/** A kit chest's lid (it opens by turning on its hinge; the room scene eases it there). */
export interface ChestLid {
  index: number
  object: THREE.Object3D
  restQuaternion: THREE.Quaternion
  open: boolean
}

export interface DynamicDressing {
  group: THREE.Group
  lids: ChestLid[]
  flames: FlamePoint[]
  lights: LightPoint[]
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

/** A curio's kit piece by its id (07 §2.4's curios on their zone's pieces), when the kit has one. */
export function curioPiece(curioId: string, zone: KitZone): string[] {
  const id = curioId.toLowerCase()
  if (/cask/.test(id)) return ['cel_cask_large']
  if (/nest/.test(id)) return ['cel_rat_nest']
  if (/thrall/.test(id)) return ['vlt_cage_thrall']
  if (/cage/.test(id)) return zone === 'vault' ? ['vlt_cage_thrall', 'cel_cage_hanging'] : ['cel_cage_hanging']
  if (/sarcophag/.test(id)) return ['cry_sarcophagus']
  // The Crypts' and the Vault's own pieces (C1, Phase 7): the reliquary niche, the embalmer's table, the ledger's
  // lectern, the Sentinel's plinth.
  if (/reliquary/.test(id)) return ['cry_reliquary_niche']
  if (/embalm/.test(id)) return ['cry_embalmer_table']
  if (/ledger/.test(id)) return ['cry_ledger_lectern']
  if (/plinth/.test(id)) return ['vlt_plinth_sentinel']
  // Candles before urns: "mourners-candles" holds "urn".
  if (/candle/.test(id)) return ['cry_candle_ring']
  if (/urn/.test(id)) return ['cry_urn_row']
  if (/statue|weeping/.test(id)) return ['cry_statue_weeping']
  if (/bell/.test(id)) return ['cry_bell_grave']
  if (/altar/.test(id)) return ['vlt_altar_tide']
  if (/wheel|sluice/.test(id)) return ['vlt_wheel_sluice']
  if (/leech|jar/.test(id)) return ['vlt_jar_leech']
  if (/chest/.test(id)) return ['vlt_chest_drowned']
  if (/tablet|lore|inscri|hymnal/.test(id)) return ['shr_lore_tablet']
  return []
}

/** The zone's pedlar: the Cellars' handcart, the Vault's raft; the Crypts' barrow is the grey box until it has one. */
const MERCHANT_PIECE: Readonly<Record<KitZone, readonly string[]>> = { cellars: ['cel_merchant_cart'], crypts: ['cry_merchant_barrow', 'cel_merchant_cart'], vault: ['vlt_raft_merchant', 'cel_merchant_cart'] }
/** The zone's locked-door skin: a portcullis that lifts, or the Vault's round door that swings. */
const LOCK_PIECE: Readonly<Record<KitZone, readonly string[]>> = { cellars: ['cel_door_portcullis'], crypts: ['cry_door_portcullis', 'cel_door_portcullis'], vault: ['vlt_door_vault', 'cel_door_portcullis'] }

export function buildDynamic(kit: Kit, room: StaticRoom, input: DynamicInput): DynamicDressing {
  const rnd = scenicRandom(input.variation * 104729 + 17)
  const pieces: P.Pieces = { kit, props: new MeshBuilder('none'), walls: new MeshBuilder('box', 2), cloth: new MeshBuilder('keep'), glow: new MeshBuilder('none'), rnd }
  const env = room.env
  const kb = env ? new KitRoomBuilder(env.set, env.materials) : null
  const zone: KitZone = env?.set.zone ?? 'cellars'
  const has = (ids: readonly string[]) => (kb ? ids.find((id) => kb.has(id)) : undefined)
  const group = new THREE.Group()
  const lids: ChestLid[] = []
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
    if (w.locked) {
      const lockId = low ? undefined : has([...(env?.set.info.shell.locked ?? []), ...LOCK_PIECE[zone]])
      const lock = lockId ? kb!.piece(lockId) : null
      if (lock && env) {
        // Only the part that moves stands in the doorway (the arch is the shell's); raised (2.2 m clears a hero) or
        // swung open with the key.
        const mp = movingPiece(lock.parts.length ? { ...lock, geometry: null } : lock, env.materials, m)
        const gate = movingPart(mp, /gate|bars|grate|door|portcullis|leaf/i)
        if (gate && input.hasKey) {
          if (zone === 'vault' && /door|vault/i.test(lockId ?? '')) gate.object.quaternion.copy(gate.rest.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -1.7))
          else gate.object.position.y = gate.rest.position.y + 2.2
        } else if (!gate && input.hasKey) mp.root.position.y += 2.2
        group.add(mp.root)
      } else P.addPortcullis(pieces, trs(w.x - w.nx * 0.12, 0, w.z - w.nz * 0.12, yaw), input.hasKey, low ? CUTAWAY_HEIGHT + 0.35 : WALL_HEIGHT - 0.6)
    }
    // On a cut-away wall (nearest the camera) only the threshold glows; a curtain of light there would fill the view.
    if (d.move !== null) {
      const frameFx = d.move && !low ? has(['shr_door_frame_fx']) : undefined
      if (frameFx) kb!.add(frameFx, m)
      P.addDoorGlow(pieces, m, d.move ? PALETTE.doorGlow : PALETTE.doorShut, low || frameFx ? 0 : 2.6)
    }
  }

  // Chests on their sockets (by size), else against a wall the camera sees.
  const smalls = [...room.sockets.chestSmall]
  const larges = [...room.sockets.chestLarge]
  input.chests.forEach((c, index) => {
    const large = c.size === 'large' || c.size === 'grand'
    const socket = (large ? larges.shift() : smalls.shift()) ?? (large ? smalls.shift() : larges.shift())
    const at = socket ?? pick(walls, middle)
    if (socket) taken.push({ x: socket.x, z: socket.z })
    const m = trs(at.x, 0, at.z, socket ? at.yaw : toCamera)
    const chestId = has(large ? ['shr_chest_large', 'shr_chest_small'] : ['shr_chest_small', 'shr_chest_large'])
    const piece = chestId ? kb!.piece(chestId) : null
    if (piece && env) {
      const mp = movingPiece(piece, env.materials, m)
      group.add(mp.root)
      const lid = movingPart(mp, /lid/i)
      if (lid) lids.push({ index, object: lid.object, restQuaternion: lid.rest.quaternion.clone(), open: c.opened })
    } else P.addChest(pieces, m, large, c.opened, c.locked)
  })

  // Gold piles: the kit's heaps scaled by the amount, else the grey box's.
  const goldSockets = [...room.sockets.gold]
  const goldId = has(['shr_gold_pile'])
  for (const amount of input.goldPiles) {
    const socket = goldSockets.shift()
    const at = socket ?? pick(middle, walls)
    if (goldId) {
      const s = Math.max(0.7, Math.min(1.5, 0.7 + amount / 120))
      kb!.add(goldId, trs(at.x, 0, at.z, at.yaw, s, s, s))
    } else P.addGold(pieces, trs(at.x, 0, at.z, at.yaw), amount)
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
      const kitId = has(curioPiece(id, zone))
      if (kitId) kb!.add(kitId, /cage/.test(id) && /hanging/.test(kitId) ? trs(at.x, 2.4, at.z, at.yaw) : m)
      else if (/cask/.test(id)) P.addCask(pieces, m)
      else if (/dice/.test(id)) P.addDiceTable(pieces, m)
      else if (/nest/.test(id)) P.addNest(pieces, m)
      else if (/cage/.test(id)) P.addCage(pieces, trs(at.x, 2.4, at.z, at.yaw), !used)
      else if (/larder/.test(id)) P.addLarder(pieces, m)
      else if (/shrine/.test(id)) P.addShrine(pieces, m)
      else if (/lantern/.test(id)) P.addLantern(pieces, m, !used)
      else if (/gallows/.test(id)) P.addGallows(pieces, m)
      else if (/pool/.test(id)) P.addPuddle(pieces, m)
      else P.addTablet(pieces, m)
    } else if (/cage/.test(id) && !used && !kb?.has('cel_cage_hanging')) P.addCage(pieces, m, true)
    if (!used) P.addFloorRing(pieces, ground, /cask/.test(id) ? 1.5 : 1.1, PALETTE.doorGlow)
  }

  // The pedlar and the cart.
  if (input.merchant) {
    const at = pick(walls, middle)
    // Parallel to the wall (the cart's length is its local x), the pedlar at its front corner.
    const m = trs(at.x, 0, at.z, at.yaw)
    const cartId = has(MERCHANT_PIECE[zone])
    if (cartId) kb!.add(cartId, m)
    else P.addCart(pieces, m)
    P.addFigure(pieces, within(m, trs(1.55, 0, 0.55, -0.4)), 0x4f5a3a, 0xd9a98c)
  }

  // The floor's key, where it waits to be picked up.
  if (input.keyHere) {
    const at = pick(middle, walls)
    P.addKey(pieces, trs(at.x, 0, at.z, rnd() * Math.PI))
  }

  const geos: THREE.BufferGeometry[] = []
  for (const mesh of [
    meshOf(pieces.walls.build(), kit.mat.wall, geos),
    meshOf(pieces.props.build(), kit.mat.prop, geos),
    meshOf(pieces.glow.build(), kit.mat.glow, geos, 3),
  ])
    if (mesh) group.add(mesh)
  const kitBuild = kb ? kb.build() : null
  if (kitBuild) group.add(kitBuild.group)
  const flames = kb ? [...kb.flames] : []
  return {
    group,
    lids,
    flames,
    lights: flameLights(flames),
    dispose() {
      for (const g of geos) g.dispose()
      kitBuild?.dispose()
      group.clear()
    },
  }
}
