/**
 * The floor map's layout (03 §4.1, §4.3): which rooms the party knows, how, and where the doors are, in grid cells.
 * Unknown rooms stay hidden; a room behind a known door is glimpsed (an outline with "?"); a scouted room shows its
 * kind; visited rooms are filled; the current room is lit. Legal moves make the current room's neighbours tappable.
 * Pure, tested in Node.
 */
export type RoomStatus = 'current' | 'visited' | 'scouted' | 'glimpsed'

export interface MapRoomView {
  id: string
  /** The room kind, or null while only glimpsed. */
  kind: string | null
  status: RoomStatus
  x: number
  y: number
  w: number
  h: number
  /** Where its icon goes (cells, a cell centre): the cell nearest the party, so a big room's icon stays in view. */
  icon: { x: number; y: number }
  /** A legal move into it from here: enabled, or the reason it is not. */
  move: { enabled: boolean; reason?: string } | null
  hunter: boolean
  key: boolean
  cleared: boolean
  exit: boolean
  entry: boolean
  /** The threat of the fight it holds, when the party knows of one (D-092); null otherwise. */
  threat: 'easy' | 'even' | 'dangerous' | 'deadly' | null
}

export interface MapDoorView {
  /** Centre of the doorway on the shared edge, in cells. */
  x: number
  y: number
  /** True on an east/west edge (the door mark stands upright). */
  vertical: boolean
  locked: boolean
  secret: boolean
}

export interface MapView {
  rooms: MapRoomView[]
  doors: MapDoorView[]
  grid: { w: number; h: number }
  /** Centre of the current room, in cells. */
  centre: { x: number; y: number }
}

type Side = 'north' | 'east' | 'south' | 'west'

export interface MapStateLike {
  floor: {
    currentRoomId: string
    hasKey: boolean
    graph: {
      grid: { w: number; h: number }
      entryId: string
      exitId: string
      rooms: readonly {
        id: string
        kind: string
        hasKey: boolean
        cells: readonly { x: number; y: number }[]
        doors: readonly { to: string; side: Side; offset: number; locked: boolean; secret: boolean }[]
      }[]
    }
    rooms: Readonly<Record<string, { visited: boolean; scouted: boolean; cleared: boolean; secretRevealed: boolean } | undefined>>
    hunter: { entered: boolean; killed: boolean; roomId: string | null } | null
  }
}

export interface MoveLike {
  command: { kind: string; toRoomId?: string }
  enabled: boolean
  reason?: string
  /** The sim's threat read on a move into a known fight (D-092). */
  threat?: { band: 'easy' | 'even' | 'dangerous' | 'deadly' }
}

export type ThreatBandLike = 'easy' | 'even' | 'dangerous' | 'deadly'

function box(cells: readonly { x: number; y: number }[]): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const c of cells) {
    x0 = Math.min(x0, c.x)
    y0 = Math.min(y0, c.y)
    x1 = Math.max(x1, c.x)
    y1 = Math.max(y1, c.y)
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 1, h: 1 }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

export function doorMark(b: { x: number; y: number; w: number; h: number }, side: Side, offset: number): { x: number; y: number; vertical: boolean } {
  switch (side) {
    case 'north':
      return { x: b.x + offset + 0.5, y: b.y, vertical: false }
    case 'south':
      return { x: b.x + offset + 0.5, y: b.y + b.h, vertical: false }
    case 'west':
      return { x: b.x, y: b.y + offset + 0.5, vertical: true }
    case 'east':
      return { x: b.x + b.w, y: b.y + offset + 0.5, vertical: true }
  }
}

/**
 * `threats` gives the threat band of every room whose fight the party knows (sim `roomThreat`); a legal move's own
 * threat read wins for a neighbour.
 */
export function mapView(state: MapStateLike, legal: readonly MoveLike[], threats: ReadonlyMap<string, ThreatBandLike> = new Map()): MapView {
  const f = state.floor
  const g = f.graph
  const moves = new Map<string, { enabled: boolean; reason?: string }>()
  const moveThreat = new Map<string, ThreatBandLike>()
  for (const a of legal) {
    if (a.command.kind !== 'move' || !a.command.toRoomId) continue
    moves.set(a.command.toRoomId, { enabled: a.enabled, reason: a.reason })
    if (a.threat) moveThreat.set(a.command.toRoomId, a.threat.band)
  }
  const glimpsed = new Set<string>()
  const doors = new Map<string, MapDoorView>()
  for (const r of g.rooms) {
    const rs = f.rooms[r.id]
    if (!rs?.visited) continue
    const b = box(r.cells)
    for (const d of r.doors) {
      const known = !d.secret || rs.secretRevealed || f.rooms[d.to]?.visited === true
      if (!known) continue
      glimpsed.add(d.to)
      const m = doorMark(b, d.side, d.offset)
      doors.set(`${m.x},${m.y}`, { ...m, locked: d.locked && !f.hasKey, secret: d.secret })
    }
  }
  for (const id of moves.keys()) glimpsed.add(id)
  const rooms: MapRoomView[] = []
  let centre = { x: g.grid.w / 2, y: g.grid.h / 2 }
  const here = g.rooms.find((r) => r.id === f.currentRoomId)
  if (here) {
    const b = box(here.cells)
    centre = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
  }
  const iconOf = (r: (typeof g.rooms)[number], current: boolean): { x: number; y: number } => {
    const b = box(r.cells)
    if (current || r.cells.length === 0) return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
    let best = r.cells[0]!
    let bestD = Infinity
    for (const c of r.cells) {
      const d = Math.hypot(c.x + 0.5 - centre.x, c.y + 0.5 - centre.y)
      if (d < bestD - 1e-9) {
        bestD = d
        best = c
      }
    }
    return { x: best.x + 0.5, y: best.y + 0.5 }
  }
  for (const r of g.rooms) {
    const rs = f.rooms[r.id]
    const current = r.id === f.currentRoomId
    const status: RoomStatus | null = current ? 'current' : rs?.visited ? 'visited' : rs?.scouted ? 'scouted' : glimpsed.has(r.id) ? 'glimpsed' : null
    if (!status) continue
    const b = box(r.cells)
    const known = status !== 'glimpsed'
    rooms.push({
      id: r.id,
      kind: known ? r.kind : null,
      status,
      ...b,
      icon: iconOf(r, current),
      move: moves.get(r.id) ?? null,
      hunter: f.hunter !== null && f.hunter.entered && !f.hunter.killed && f.hunter.roomId === r.id,
      key: known && r.hasKey && !f.hasKey,
      cleared: rs?.cleared === true,
      exit: known && r.id === g.exitId,
      entry: r.id === g.entryId,
      threat: known && rs?.cleared !== true ? (moveThreat.get(r.id) ?? threats.get(r.id) ?? null) : null,
    })
  }
  // A hunter in a room the map does not show yet still shows (03 §4.5: "made fair and visible").
  if (f.hunter?.entered && !f.hunter.killed && f.hunter.roomId && !rooms.some((x) => x.id === f.hunter!.roomId)) {
    const r = g.rooms.find((x) => x.id === f.hunter!.roomId)
    if (r) rooms.push({ id: r.id, kind: null, status: 'glimpsed', ...box(r.cells), icon: iconOf(r, false), move: moves.get(r.id) ?? null, hunter: true, key: false, cleared: false, exit: false, entry: false, threat: null })
  }
  return { rooms, doors: [...doors.values()], grid: { w: g.grid.w, h: g.grid.h }, centre }
}

/** The top-left cell of a `cols × rows` window centred on the current room, kept inside the grid. */
export function mapWindow(view: Pick<MapView, 'grid' | 'centre'>, cols: number, rows: number): { x0: number; y0: number } {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  const x0 = view.grid.w <= cols ? (view.grid.w - cols) / 2 : clamp(Math.round(view.centre.x - cols / 2), 0, view.grid.w - cols)
  const y0 = view.grid.h <= rows ? (view.grid.h - rows) / 2 : clamp(Math.round(view.centre.y - rows / 2), 0, view.grid.h - rows)
  return { x0, y0 }
}
