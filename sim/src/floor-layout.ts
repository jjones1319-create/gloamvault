/**
 * A hand-laid floor (D-150, Phase 17): content/dungeons/<d>/floors/<id>.json as the sim reads it, and its turning
 * into the room graph the delve plays (`FloorGraph`). The layout fixes the rooms, the joins and the spots; the seed
 * draws what fills the spots each delve (the encounters here; chests, curios and traps through the room dressing).
 * Rooms are `r<index>`; a join is a door on each side; a lever gate is an open door to the rules (the client gates
 * the walking); a locked join is the floor's key-and-lock; secret joins are secret doors found with A or Perception.
 */
import type { Cell, DoorSide, FloorDoor, FloorGraph, FloorRoom, RoomKind } from './generator.ts'

export interface FloorLayoutSpot {
  readonly kind: string
  readonly room: number
  readonly at: readonly [number, number]
  readonly id?: string | null
  readonly axis?: string
  readonly length?: number
}

export interface FloorLayoutDef {
  readonly id: string
  readonly dungeonId: string
  readonly floor: number
  readonly zoneId: string
  readonly kit: string
  readonly grid: { readonly w: number; readonly h: number }
  readonly rooms: readonly { readonly id: number; readonly templateId: string; readonly gx: number; readonly gy: number; readonly variation: number; readonly role?: string; readonly name?: string }[]
  readonly joins: readonly { readonly a: number; readonly b: number; readonly sideA: DoorSide; readonly offsetA: number; readonly kind: string }[]
  readonly levers: readonly { readonly id: string; readonly room: number; readonly opens: number }[]
  readonly exits: readonly { readonly id: string; readonly kind: string; readonly room: number; readonly side?: string; readonly name: string }[]
  readonly spots: readonly FloorLayoutSpot[]
}

/** The templates' footprints and doors the layout needs (a dungeon's templates, or halls made here). */
export interface LayoutTemplate {
  readonly id: string
  readonly w: number
  readonly h: number
  readonly doors: readonly { readonly side: DoorSide; readonly offset: number }[]
}

const OPPOSITE: Record<DoorSide, DoorSide> = { north: 'south', south: 'north', east: 'west', west: 'east' }

export function hallTemplate(id: string): LayoutTemplate | null {
  const m = /^hall-[a-z]+-([hv])(\d)$/.exec(id)
  if (!m) return null
  const n = Number(m[2])
  return m[1] === 'v'
    ? { id, w: 1, h: n, doors: [{ side: 'north', offset: 0 }, { side: 'south', offset: 0 }] }
    : { id, w: n, h: 1, doors: [{ side: 'west', offset: 0 }, { side: 'east', offset: 0 }] }
}

export const roomId = (index: number): string => `r${index}`

/** The spots of a room by kind. */
export function spotsOf(layout: FloorLayoutDef, room: number, kind?: string): FloorLayoutSpot[] {
  return layout.spots.filter((s) => s.room === room && (kind === undefined || s.kind === kind))
}

/** True for a kind the rules fill at a spot (the traversal kinds are the client's). */
export const RULE_SPOT_KINDS = new Set(['encounter', 'chest', 'curio', 'trap', 'key'])

function beyond(r: { gx: number; gy: number }, t: LayoutTemplate, side: DoorSide, offset: number): [number, number] {
  switch (side) {
    case 'north': return [r.gx + offset, r.gy - 1]
    case 'south': return [r.gx + offset, r.gy + t.h]
    case 'east': return [r.gx + t.w, r.gy + offset]
    default: return [r.gx - 1, r.gy + offset]
  }
}

function own(r: { gx: number; gy: number }, t: LayoutTemplate, side: DoorSide, offset: number): [number, number] {
  switch (side) {
    case 'north': return [r.gx + offset, r.gy]
    case 'south': return [r.gx + offset, r.gy + t.h - 1]
    case 'east': return [r.gx + t.w - 1, r.gy + offset]
    default: return [r.gx, r.gy + offset]
  }
}

/** The room kind the rules play a laid-out room as (D-150): its role first, else what its spots hold. */
export function kindOf(layout: FloorLayoutDef, index: number, firstSecret: number | null): RoomKind {
  const r = layout.rooms[index]!
  switch (r.role) {
    case 'entry': return 'entry'
    case 'stairs': return 'stairs'
    case 'rest': return 'rest'
    case 'key': return 'keyRoom'
    case 'treasure': return 'treasure'
    case 'secret-room': return index === firstSecret ? 'secret' : 'treasure'
  }
  if (spotsOf(layout, index, 'encounter').length > 0) return 'fight'
  if (spotsOf(layout, index, 'curio').length > 0) return 'curio'
  if (spotsOf(layout, index, 'trap').length > 0) return 'trapGauntlet'
  return 'fight'
}

export interface LayoutGraphInput {
  readonly layout: FloorLayoutDef
  readonly templates: readonly LayoutTemplate[]
  readonly seed: readonly [number, number]
  /** Draws the placed encounter of a fight or key room (the floor's tables, by the seed). */
  readonly pickEncounter: (roomIndex: number, previousId: string | null) => string | null
}

/** The layout as the delve's room graph. Deterministic: the same layout and picks give the same graph and hash. */
export function layoutToGraph(input: LayoutGraphInput): FloorGraph {
  const { layout } = input
  const byId = new Map<string, LayoutTemplate>()
  for (const t of input.templates) byId.set(t.id, t)
  const tpl = (id: string): LayoutTemplate => {
    const t = byId.get(id) ?? hallTemplate(id)
    if (!t) throw new Error(`floor layout ${layout.id}: no template ${id}`)
    return t
  }
  const firstSecret = layout.rooms.findIndex((r) => r.role === 'secret-room')
  const doors: FloorDoor[][] = layout.rooms.map(() => [])
  let lockedEdge: { from: string; to: string } | null = null
  for (const j of layout.joins) {
    const a = layout.rooms[j.a]!, b = layout.rooms[j.b]!
    const ta = tpl(a.templateId), tb = tpl(b.templateId)
    const mine = own(a, ta, j.sideA, j.offsetA)
    const back = tb.doors.find((d) => d.side === OPPOSITE[j.sideA] && beyond(b, tb, d.side, d.offset)[0] === mine[0] && beyond(b, tb, d.side, d.offset)[1] === mine[1])
    if (!back) throw new Error(`floor layout ${layout.id}: join ${j.a}-${j.b} has no door back`)
    const locked = j.kind === 'locked'
    const secret = j.kind === 'secret'
    doors[j.a]!.push({ to: roomId(j.b), side: j.sideA, offset: j.offsetA, locked, secret })
    doors[j.b]!.push({ to: roomId(j.a), side: back.side, offset: back.offset, locked, secret })
    if (locked && lockedEdge === null) lockedEdge = { from: roomId(j.a), to: roomId(j.b) }
  }
  const entry = layout.rooms.findIndex((r) => r.role === 'entry')
  const stairs = layout.rooms.findIndex((r) => r.role === 'stairs')
  if (entry < 0 || stairs < 0) throw new Error(`floor layout ${layout.id}: needs an entry and a stairs room`)
  // Hops from the entry over every door, and the spine: the shortest way to the stairs.
  const hop = new Array<number>(layout.rooms.length).fill(-1)
  const parent = new Array<number>(layout.rooms.length).fill(-1)
  hop[entry] = 0
  const queue = [entry]
  while (queue.length) {
    const i = queue.shift()!
    for (const d of doors[i]!) {
      const k = Number(d.to.slice(1))
      if (hop[k] !== -1) continue
      hop[k] = hop[i]! + 1
      parent[k] = i
      queue.push(k)
    }
  }
  const spine = new Set<number>()
  for (let k = stairs; k !== -1; k = parent[k]!) spine.add(k)
  let previous: string | null = null
  const rooms: FloorRoom[] = layout.rooms.map((r, i) => {
    const t = tpl(r.templateId)
    const kind = kindOf(layout, i, firstSecret < 0 ? null : firstSecret)
    const cells: Cell[] = []
    for (let y = r.gy; y < r.gy + t.h; y++) for (let x = r.gx; x < r.gx + t.w; x++) cells.push({ x, y })
    let encounterId: string | null = null
    if (kind === 'fight' && spotsOf(layout, i, 'encounter').length > 0 || kind === 'keyRoom') {
      encounterId = input.pickEncounter(i, previous)
      if (encounterId) previous = encounterId
    }
    return {
      id: roomId(i), kind, templateId: r.templateId, rotation: 0, cells, doors: doors[i]!,
      hop: Math.max(0, hop[i]!), onSpine: spine.has(i), branchDepth: spine.has(i) ? 0 : 1,
      encounterId, hasKey: r.role === 'key', variation: r.variation,
    }
  })
  let h = 2166136261
  const mix = (v: number) => { h ^= v & 0xffff; h = Math.imul(h, 16777619) >>> 0 }
  for (const r of rooms) { for (const c of r.id) mix(c.charCodeAt(0)); mix(r.doors.length); mix(r.encounterId ? r.encounterId.length : 0) }
  const rest = layout.rooms.findIndex((r) => r.role === 'rest')
  const key = layout.rooms.findIndex((r) => r.role === 'key')
  return {
    floor: layout.floor, kind: 'normal', seed: input.seed, grid: { w: layout.grid.w, h: layout.grid.h }, rooms,
    entryId: roomId(entry), exitId: roomId(stairs), restId: rest < 0 ? null : roomId(rest), merchantId: null,
    keyRoomId: key < 0 ? null : roomId(key), lockedEdge, secretId: firstSecret < 0 ? null : roomId(firstSecret),
    forks: 0, retries: 0, hash: h,
  }
}

/** The rooms a party may leave the floor from (D-151): the entrance, the stairs, and every side exit. */
export function exitRoomIds(layout: FloorLayoutDef): string[] {
  const out = new Set<string>()
  for (const e of layout.exits) out.add(roomId(e.room))
  return [...out]
}
