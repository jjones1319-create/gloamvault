/**
 * `node tools/content/gen-floor-1.ts` — writes content/dungeons/gravehollow-keep/floors/floor-1.json from the table
 * below: Gravehollow's first floor laid out by hand (D-150, Phase 15; the shape is content/schemas/floor-layout.schema.json).
 * Re-runnable and idempotent: edit the table, never the generated JSON. The script checks the layout as it goes —
 * footprints inside the grid and apart, every join door to door, every room reached from the entry without passing
 * a secret (07 §2.6: secrets reward, never gate), the key's room reached without passing a locked door — and fails
 * loudly on a mistake, so the linter's rule 90 only ever confirms what this saw.
 *
 * The floor (07 §2.3, Floor 1 — the Cellars): the keep's gate at the west, a spine of halls and rooms east to the
 * stair down, a north wing with the cold hearth (the rest room) whose lever lifts the kennels' portcullis and the
 * Hearth Shrine behind a secret panel, a south wing with the storeroom's key, the wine vault behind the locked door,
 * the Smuggler's Cache behind its secret, and the Company's Bolt-hole — a secret crawl that comes out in the stairs
 * room; two side exits found from inside: a rope shaft in the north-east and a collapsed tunnel past the stairs (D-151).
 */
import fs from 'node:fs'
import path from 'node:path'
import { isMain, REPO_ROOT } from './gen-class-lib.ts'

type Side = 'north' | 'east' | 'south' | 'west'
type JoinKind = 'open' | 'wood' | 'locked' | 'secret' | 'lever'
type Role = 'entry' | 'stairs' | 'rest' | 'key' | 'treasure' | 'secret-room' | 'plain'

interface RoomRow { t: string; gx: number; gy: number; role?: Role; name?: string }
interface JoinRow { a: number; b: number; kind: JoinKind }

const DUNGEON = 'gravehollow-keep'
const KIT = 'cellars'
const GRID = { w: 28, h: 20 }

// The rooms, by index (the id). Templates are the Cellars'; halls are hall-cellars-h<n> (east–west) / v<n> (north–south).
const ROOMS: RoomRow[] = [
  /* 0 */ { t: 'cel-t-stairwell', gx: 1, gy: 10, role: 'entry', name: "the keep's gate" },
  /* 1 */ { t: 'hall-cellars-h2', gx: 2, gy: 10 },
  /* 2 */ { t: 'cel-t-guardpost', gx: 4, gy: 10, name: 'the crossing' },
  /* 3 */ { t: 'cel-t-gallery', gx: 5, gy: 10, name: 'the long gallery' },
  /* 4 */ { t: 'cel-t-storeroom', gx: 8, gy: 10, role: 'key', name: 'the storeroom' },
  /* 5 */ { t: 'hall-cellars-h3', gx: 9, gy: 10 },
  /* 6 */ { t: 'cel-t-tap-room', gx: 12, gy: 10, name: 'the tap room' },
  /* 7 */ { t: 'hall-cellars-h2', gx: 14, gy: 10 },
  /* 8 */ { t: 'cel-t-guardpost', gx: 16, gy: 10, name: 'the east guardpost' },
  /* 9 */ { t: 'hall-cellars-h2', gx: 17, gy: 10 },
  /* 10 */ { t: 'cel-t-stairwell', gx: 19, gy: 10, role: 'stairs', name: 'the stair down' },
  /* 11 */ { t: 'hall-cellars-h2', gx: 20, gy: 10 },
  /* 12 */ { t: 'cel-t-guardpost', gx: 22, gy: 10, name: 'the fallen post' },
  // North wing.
  /* 13 */ { t: 'hall-cellars-v2', gx: 4, gy: 8 },
  /* 14 */ { t: 'cel-t-cold-hearth', gx: 4, gy: 7, role: 'rest', name: 'the cold hearth' },
  /* 15 */ { t: 'hall-cellars-h2', gx: 5, gy: 7 },
  /* 16 */ { t: 'cel-t-kennels', gx: 7, gy: 7, name: 'the kennels' },
  /* 17 */ { t: 'cel-t-storeroom', gx: 9, gy: 7, name: "the kennel-master's store" },
  /* 18 */ { t: 'cel-t-strongroom', gx: 3, gy: 7, role: 'secret-room', name: 'the Hearth Shrine' },
  // South wing.
  /* 19 */ { t: 'hall-cellars-v3', gx: 4, gy: 11 },
  /* 20 */ { t: 'cel-t-guardpost', gx: 4, gy: 14, name: 'the south post' },
  /* 21 */ { t: 'hall-cellars-h3', gx: 5, gy: 14 },
  /* 22 */ { t: 'cel-t-wine-vault', gx: 8, gy: 14, role: 'treasure', name: 'the wine vault' },
  /* 23 */ { t: 'cel-t-strongroom', gx: 9, gy: 13, role: 'secret-room', name: "the Smuggler's Cache" },
  /* 24 */ { t: 'hall-cellars-h2', gx: 10, gy: 14 },
  /* 25 */ { t: 'cel-t-guardpost', gx: 12, gy: 14, name: 'the under-post' },
  /* 26 */ { t: 'hall-cellars-v2', gx: 12, gy: 12 },
  /* 27 */ { t: 'hall-cellars-v2', gx: 4, gy: 15 },
  /* 28 */ { t: 'cel-t-cistern', gx: 4, gy: 17, name: 'the cistern' },
  /* 29 */ { t: 'hall-cellars-h3', gx: 13, gy: 14 },
  /* 30 */ { t: 'cel-t-kennels', gx: 16, gy: 14, name: 'the old kennels' },
  /* 31 */ { t: 'hall-cellars-h1', gx: 18, gy: 14 },
  /* 32 */ { t: 'cel-t-storeroom', gx: 19, gy: 14, name: 'the bolt-hole store' },
  /* 33 */ { t: 'hall-cellars-v3', gx: 19, gy: 11, role: 'secret-room', name: "the Company's Bolt-hole" },
  // North-east.
  /* 34 */ { t: 'hall-cellars-v2', gx: 16, gy: 8 },
  /* 35 */ { t: 'cel-t-storeroom', gx: 16, gy: 7, name: 'the rope store' },
]

const JOINS: JoinRow[] = [
  { a: 0, b: 1, kind: 'open' }, { a: 1, b: 2, kind: 'open' }, { a: 2, b: 3, kind: 'wood' }, { a: 3, b: 4, kind: 'open' },
  { a: 4, b: 5, kind: 'open' }, { a: 5, b: 6, kind: 'wood' }, { a: 6, b: 7, kind: 'open' }, { a: 7, b: 8, kind: 'open' },
  { a: 8, b: 9, kind: 'wood' }, { a: 9, b: 10, kind: 'open' }, { a: 10, b: 11, kind: 'wood' }, { a: 11, b: 12, kind: 'open' },
  // North wing: the hearth, its lever's portcullis to the kennels, the shrine behind its panel.
  { a: 2, b: 13, kind: 'open' }, { a: 13, b: 14, kind: 'open' }, { a: 14, b: 15, kind: 'open' }, { a: 15, b: 16, kind: 'lever' },
  { a: 16, b: 17, kind: 'open' }, { a: 14, b: 18, kind: 'secret' },
  // South wing: the key before the lock, the cache behind its panel, the loop back to the tap room.
  { a: 2, b: 19, kind: 'open' }, { a: 19, b: 20, kind: 'open' }, { a: 20, b: 21, kind: 'wood' }, { a: 21, b: 22, kind: 'locked' },
  { a: 22, b: 23, kind: 'secret' }, { a: 22, b: 24, kind: 'open' }, { a: 24, b: 25, kind: 'open' }, { a: 6, b: 26, kind: 'open' },
  { a: 25, b: 26, kind: 'open' }, { a: 20, b: 27, kind: 'open' }, { a: 27, b: 28, kind: 'open' },
  { a: 25, b: 29, kind: 'open' }, { a: 29, b: 30, kind: 'wood' }, { a: 30, b: 31, kind: 'open' }, { a: 31, b: 32, kind: 'open' },
  { a: 32, b: 33, kind: 'open' }, { a: 10, b: 33, kind: 'secret' },
  // North-east: the rope store.
  { a: 8, b: 34, kind: 'open' }, { a: 34, b: 35, kind: 'wood' },
]

const LEVERS = [{ id: 'hearth-lever', room: 14, at: [-2.4, -2.6] as [number, number], opensJoin: { a: 15, b: 16 } }]

const EXITS = [
  { id: 'the-gate', kind: 'entrance' as const, room: 0, side: 'west' as Side, name: "the keep's gate" },
  { id: 'stair-down', kind: 'stairs' as const, room: 10, name: 'the stair to Floor 2' },
  { id: 'rope-shaft', kind: 'side' as const, room: 35, side: 'north' as Side, name: 'a rope shaft to the yard' },
  { id: 'collapsed-tunnel', kind: 'side' as const, room: 12, side: 'east' as Side, name: 'a collapsed tunnel to the moat bank' },
]

const SPOTS = [
  { kind: 'key', room: 4, at: [2.2, 2.2], id: null },
  { kind: 'encounter', room: 2, at: [0, 0], id: null }, { kind: 'encounter', room: 8, at: [0, 0], id: null },
  { kind: 'encounter', room: 16, at: [0, 0], id: null }, { kind: 'encounter', room: 30, at: [0, 0], id: null },
  { kind: 'encounter', room: 25, at: [0, 0], id: null }, { kind: 'encounter', room: 6, at: [0, 0], id: null },
  { kind: 'chest', room: 23, at: [0, 0], id: null }, { kind: 'chest', room: 18, at: [0, 1.5], id: null }, { kind: 'chest', room: 22, at: [4, 0], id: null },
  { kind: 'curio', room: 22, at: [-3, -2], id: 'sealed-cask' }, { kind: 'curio', room: 28, at: [0, 2], id: 'lost-lantern' },
  { kind: 'trap', room: 3, at: [0, 0], id: null }, { kind: 'trap', room: 21, at: [0, 0], id: null }, { kind: 'trap', room: 29, at: [2, 0], id: null },
]

// ---- the templates' footprints and doors ---------------------------------------------------------------------------
interface Tpl { w: number; h: number; doors: { side: Side; offset: number }[] }

function templateOf(id: string): Tpl {
  const hall = /^hall-([a-z]+)-([hv])(\d)$/.exec(id)
  if (hall) {
    const n = Number(hall[3])
    return hall[2] === 'v'
      ? { w: 1, h: n, doors: [{ side: 'north', offset: 0 }, { side: 'south', offset: 0 }] }
      : { w: n, h: 1, doors: [{ side: 'west', offset: 0 }, { side: 'east', offset: 0 }] }
  }
  const file = path.join(REPO_ROOT, 'content', 'dungeons', DUNGEON, 'templates', `${id}.json`)
  if (!fs.existsSync(file)) throw new Error(`no template ${id}`)
  const t = JSON.parse(fs.readFileSync(file, 'utf8'))
  return { w: t.footprint.w, h: t.footprint.h, doors: t.doors.map((d: { side: Side; offset?: number }) => ({ side: d.side, offset: d.offset ?? 0 })) }
}

const OPPOSITE: Record<Side, Side> = { north: 'south', south: 'north', east: 'west', west: 'east' }

function beyond(r: RoomRow, t: Tpl, side: Side, offset: number): [number, number] {
  switch (side) {
    case 'north': return [r.gx + offset, r.gy - 1]
    case 'south': return [r.gx + offset, r.gy + t.h]
    case 'east': return [r.gx + t.w, r.gy + offset]
    default: return [r.gx - 1, r.gy + offset]
  }
}

function variationOf(index: number, id: string): number {
  let h = 2166136261
  for (const c of `${index}:${id}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  return h % 101
}

export function buildFloor1() {
  const tpls = ROOMS.map((r) => templateOf(r.t))
  // Footprints: inside the grid and apart.
  const occ = new Map<string, number>()
  ROOMS.forEach((r, i) => {
    const t = tpls[i]!
    if (r.gx < 0 || r.gy < 0 || r.gx + t.w > GRID.w || r.gy + t.h > GRID.h) throw new Error(`room ${i} (${r.t}) outside the grid`)
    for (let y = r.gy; y < r.gy + t.h; y++) for (let x = r.gx; x < r.gx + t.w; x++) {
      const k = `${x},${y}`
      if (occ.has(k)) throw new Error(`rooms ${occ.get(k)} and ${i} overlap at ${k}`)
      occ.set(k, i)
    }
  })
  // Joins: a's door whose beyond-cell is b's, and b's door facing back.
  const joins = JOINS.map((j, ji) => {
    const a = ROOMS[j.a]!; const ta = tpls[j.a]!; const b = ROOMS[j.b]!; const tb = tpls[j.b]!
    for (const d of ta.doors) {
      const [bx, by] = beyond(a, ta, d.side, d.offset)
      if (occ.get(`${bx},${by}`) !== j.b) continue
      const back = tb.doors.find((e) => e.side === OPPOSITE[d.side] && beyond(b, tb, e.side, e.offset)[0] === (d.side === 'north' || d.side === 'south' ? a.gx + d.offset : (d.side === 'east' ? a.gx + ta.w - 1 : a.gx)) && beyond(b, tb, e.side, e.offset)[1] === (d.side === 'east' || d.side === 'west' ? a.gy + d.offset : (d.side === 'south' ? a.gy + ta.h - 1 : a.gy)))
      if (!back) throw new Error(`join ${ji}: room ${j.b} (${b.t}) has no door facing room ${j.a}'s ${d.side} door`)
      return { a: j.a, b: j.b, sideA: d.side, offsetA: d.offset, kind: j.kind }
    }
    throw new Error(`join ${ji}: room ${j.a} (${a.t}) has no door onto room ${j.b} (${b.t})`)
  })
  // One join per door.
  const used = new Set<string>()
  joins.forEach((j, ji) => {
    const kb = `${j.b}:${OPPOSITE[j.sideA]}`; const ka = `${j.a}:${j.sideA}`
    if (used.has(ka) || used.has(kb)) throw new Error(`join ${ji}: a door is joined twice`)
    used.add(ka); used.add(kb)
  })
  // Reachability from the entry without secrets; the key's room without locked doors.
  const reach = (skip: (k: JoinKind) => boolean) => {
    const seen = new Set<number>([0]); const queue = [0]
    while (queue.length) {
      const r = queue.shift()!
      for (const j of joins) {
        if (skip(j.kind)) continue
        const other = j.a === r ? j.b : j.b === r ? j.a : -1
        if (other >= 0 && !seen.has(other)) { seen.add(other); queue.push(other) }
      }
    }
    return seen
  }
  const noSecret = reach((k) => k === 'secret')
  ROOMS.forEach((r, i) => { if (r.role !== 'secret-room' && !noSecret.has(i)) throw new Error(`room ${i} (${r.t}) is only reached through a secret`) })
  const keySpot = SPOTS.find((s) => s.kind === 'key')
  if (joins.some((j) => j.kind === 'locked') && !keySpot) throw new Error('a locked door without a key spot')
  if (keySpot && !reach((k) => k === 'secret' || k === 'locked').has(keySpot.room)) throw new Error('the key lies behind a locked or secret door')
  const levers = LEVERS.map((l) => {
    const opens = joins.findIndex((j) => (j.a === l.opensJoin.a && j.b === l.opensJoin.b) || (j.a === l.opensJoin.b && j.b === l.opensJoin.a))
    if (opens < 0 || joins[opens]!.kind !== 'lever') throw new Error(`lever ${l.id} opens no lever join`)
    return { id: l.id, room: l.room, at: l.at, opens }
  })
  joins.forEach((j, ji) => { if (j.kind === 'lever' && !levers.some((l) => l.opens === ji)) throw new Error(`join ${ji} is a lever join with no lever`) })
  EXITS.forEach((e) => {
    if (e.kind === 'stairs') return
    const t = tpls[e.room]!
    if (!t.doors.some((d) => d.side === e.side)) throw new Error(`exit ${e.id}: room ${e.room} has no ${e.side} door`)
    if (used.has(`${e.room}:${e.side}`)) throw new Error(`exit ${e.id}: that door is joined`)
  })
  return {
    id: 'floor-1', dungeonId: DUNGEON, floor: 1, zoneId: 'the-cellars', kit: KIT, grid: GRID,
    rooms: ROOMS.map((r, i) => ({ id: i, templateId: r.t, gx: r.gx, gy: r.gy, variation: variationOf(i, r.t), ...(r.role ? { role: r.role } : {}), ...(r.name ? { name: r.name } : {}) })),
    joins, levers,
    exits: EXITS.map((e) => ({ id: e.id, kind: e.kind, room: e.room, ...(e.kind === 'stairs' ? {} : { side: e.side }), name: e.name })),
    spots: SPOTS,
  }
}

if (isMain(import.meta.url)) {
  const floor = buildFloor1()
  const dir = path.join(REPO_ROOT, 'content', 'dungeons', DUNGEON, 'floors')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'floor-1.json')
  fs.writeFileSync(file, `${JSON.stringify(floor, null, 2)}\n`)
  const cells = ROOMS.reduce((n, r) => { const t = templateOf(r.t); return n + t.w * t.h }, 0)
  console.log(`wrote ${path.relative(REPO_ROOT, file)}: ${floor.rooms.length} rooms (${ROOMS.filter((r) => r.t.startsWith('hall-')).length} halls), ${cells} cells, ${floor.joins.length} joins, ${floor.levers.length} lever, ${floor.exits.length} exits, ${floor.spots.length} spots`)
}
