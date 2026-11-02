/**
 * Cross-file rule 90 (Phase 15, D-150): a hand-laid floor (content/dungeons/<d>/floors/<id>.json) is sound —
 * its templates exist, its footprints lie apart inside the grid, its joins meet door to door, every room is reached
 * without passing a secret (07 §2.6), the key before the lock, a lever for every lever gate, exits in unjoined doors.
 * Same contract as rules.ts: `{ file, rule, message }[]`; what the schema reports is skipped.
 */
import type { Ctx, Failure } from './rules.ts'
import { isObj, num, objs, str, type JsonObject } from './json.ts'

function fail(file: string, message: string): Failure {
  return { file, rule: 90, message }
}

type Side = 'north' | 'east' | 'south' | 'west'
type Tpl = { w: number; h: number; doors: { side: Side; offset: number }[] }
const OPPOSITE: Record<Side, Side> = { north: 'south', south: 'north', east: 'west', west: 'east' }

function hall(id: string): Tpl | null {
  const m = /^hall-[a-z]+-([hv])(\d)$/.exec(id)
  if (!m) return null
  const n = Number(m[2])
  if (n < 1 || n > 3) return null
  return m[1] === 'v'
    ? { w: 1, h: n, doors: [{ side: 'north', offset: 0 }, { side: 'south', offset: 0 }] }
    : { w: n, h: 1, doors: [{ side: 'west', offset: 0 }, { side: 'east', offset: 0 }] }
}

function templatesOf(ctx: Ctx, dungeonId: string): Map<string, Tpl> {
  const out = new Map<string, Tpl>()
  const take = (t: JsonObject) => {
    const id = str(t.id)
    const fp = isObj(t.footprint) ? t.footprint : {}
    if (id === undefined) return
    out.set(id, {
      w: num(fp.w) ?? 1, h: num(fp.h) ?? 1,
      doors: objs(t.doors).map((d) => ({ side: str(d.side) as Side, offset: num(d.offset) ?? 0 })),
    })
  }
  for (const f of ctx.corpus.content) {
    if (f.kind === 'template' && f.segments[1] === dungeonId && isObj(f.json)) take(f.json)
    if (f.kind === 'dungeon' && f.segments[1] === dungeonId && isObj(f.json)) for (const t of objs(f.json.templates)) take(t)
  }
  return out
}

function beyond(r: { gx: number; gy: number }, t: Tpl, side: Side, offset: number): [number, number] {
  switch (side) {
    case 'north': return [r.gx + offset, r.gy - 1]
    case 'south': return [r.gx + offset, r.gy + t.h]
    case 'east': return [r.gx + t.w, r.gy + offset]
    default: return [r.gx - 1, r.gy + offset]
  }
}

function own(r: { gx: number; gy: number }, t: Tpl, side: Side, offset: number): [number, number] {
  switch (side) {
    case 'north': return [r.gx + offset, r.gy]
    case 'south': return [r.gx + offset, r.gy + t.h - 1]
    case 'east': return [r.gx + t.w - 1, r.gy + offset]
    default: return [r.gx, r.gy + offset]
  }
}

function rule60(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const f of ctx.corpus.content) {
    if (f.kind !== 'floor-layout' || !isObj(f.json)) continue
    const file = f.path
    const j = f.json
    const dungeonId = str(j.dungeonId) ?? ''
    const tpls = templatesOf(ctx, dungeonId)
    const grid = isObj(j.grid) ? j.grid : {}
    const gw = num(grid.w) ?? 0, gh = num(grid.h) ?? 0
    const rooms = objs(j.rooms)
    const resolved: (Tpl | null)[] = []
    const occ = new Map<string, number>()
    let entries = 0, stairs = 0
    rooms.forEach((r, i) => {
      const id = str(r.templateId) ?? ''
      const t = tpls.get(id) ?? hall(id)
      resolved.push(t)
      if (num(r.id) !== i) out.push(fail(file, `rooms[${i}].id must be ${i} (its index)`))
      if (!t) { out.push(fail(file, `rooms[${i}]: no template '${id}' in ${dungeonId} (nor a hall hall-<kit>-h<n>/v<n>, n 1–3)`)); return }
      const gx = num(r.gx) ?? 0, gy = num(r.gy) ?? 0
      if (gx + t.w > gw || gy + t.h > gh) out.push(fail(file, `rooms[${i}] (${id}) lies outside the ${gw}×${gh} grid`))
      for (let y = gy; y < gy + t.h; y++) for (let x = gx; x < gx + t.w; x++) {
        const k = `${x},${y}`
        const other = occ.get(k)
        if (other !== undefined) out.push(fail(file, `rooms[${i}] and rooms[${other}] overlap at cell ${k}`))
        else occ.set(k, i)
      }
      if (str(r.role) === 'entry') entries++
      if (str(r.role) === 'stairs') stairs++
    })
    if (entries !== 1) out.push(fail(file, `exactly one room with role entry (found ${entries})`))
    if (stairs !== 1) out.push(fail(file, `exactly one room with role stairs (found ${stairs})`))

    const joins = objs(j.joins)
    const used = new Set<string>()
    const edges: { a: number; b: number; kind: string }[] = []
    joins.forEach((jn, ji) => {
      const a = num(jn.a) ?? -1, b = num(jn.b) ?? -1
      const sideA = str(jn.sideA) as Side, offsetA = num(jn.offsetA) ?? 0, kind = str(jn.kind) ?? 'open'
      const ra = rooms[a], rb = rooms[b], ta = resolved[a], tb = resolved[b]
      if (!ra || !rb || !ta || !tb) { out.push(fail(file, `joins[${ji}]: rooms ${a} and ${b} must exist`)); return }
      if (a >= b) out.push(fail(file, `joins[${ji}]: a (${a}) must be less than b (${b}) — the lower id owns the leaf`))
      const A = { gx: num(ra.gx) ?? 0, gy: num(ra.gy) ?? 0 }, B = { gx: num(rb.gx) ?? 0, gy: num(rb.gy) ?? 0 }
      if (!ta.doors.some((d) => d.side === sideA && d.offset === offsetA)) out.push(fail(file, `joins[${ji}]: room ${a} has no ${sideA} door at offset ${offsetA}`))
      const [bx, by] = beyond(A, ta, sideA, offsetA)
      if (occ.get(`${bx},${by}`) !== b) out.push(fail(file, `joins[${ji}]: the cell beyond room ${a}'s ${sideA} door is not room ${b}`))
      const mine = own(A, ta, sideA, offsetA)
      const back = tb.doors.find((d) => d.side === OPPOSITE[sideA] && beyond(B, tb, d.side, d.offset)[0] === mine[0] && beyond(B, tb, d.side, d.offset)[1] === mine[1])
      if (!back) out.push(fail(file, `joins[${ji}]: room ${b} has no ${OPPOSITE[sideA]} door facing room ${a}'s`))
      for (const k of [`${a}:${sideA}`, `${b}:${OPPOSITE[sideA]}`]) {
        if (used.has(k)) out.push(fail(file, `joins[${ji}]: door ${k} is joined twice`))
        used.add(k)
      }
      edges.push({ a, b, kind })
    })

    const entry = rooms.findIndex((r) => str(r.role) === 'entry')
    const reach = (skip: (k: string) => boolean) => {
      const seen = new Set<number>(entry >= 0 ? [entry] : [])
      const queue = [...seen]
      while (queue.length) {
        const r = queue.shift()!
        for (const e of edges) {
          if (skip(e.kind)) continue
          const o = e.a === r ? e.b : e.b === r ? e.a : -1
          if (o >= 0 && !seen.has(o)) { seen.add(o); queue.push(o) }
        }
      }
      return seen
    }
    if (entry >= 0) {
      const noSecret = reach((k) => k === 'secret')
      rooms.forEach((r, i) => { if (str(r.role) !== 'secret-room' && !noSecret.has(i)) out.push(fail(file, `rooms[${i}] is only reached through a secret join (secrets reward, never gate)`)) })
      const spots = objs(j.spots)
      const key = spots.find((s) => str(s.kind) === 'key')
      if (edges.some((e) => e.kind === 'locked') && !key) out.push(fail(file, 'a locked join needs a key spot'))
      if (key && !reach((k) => k === 'secret' || k === 'locked').has(num(key.room) ?? -1)) out.push(fail(file, 'the key spot lies behind a locked or secret join'))
    }

    const levers = objs(j.levers)
    levers.forEach((l, li) => {
      const opens = num(l.opens) ?? -1
      if (!joins[opens] || str(joins[opens]!.kind) !== 'lever') out.push(fail(file, `levers[${li}] (${str(l.id)}) opens no lever join`))
      if (!rooms[num(l.room) ?? -1]) out.push(fail(file, `levers[${li}]: room must exist`))
    })
    joins.forEach((jn, ji) => { if (str(jn.kind) === 'lever' && !levers.some((l) => num(l.opens) === ji)) out.push(fail(file, `joins[${ji}] is a lever join with no lever`)) })

    const exits = objs(j.exits)
    const kinds = exits.map((e) => str(e.kind))
    if (kinds.filter((k) => k === 'entrance').length !== 1) out.push(fail(file, 'exactly one entrance exit'))
    if (kinds.filter((k) => k === 'stairs').length !== 1) out.push(fail(file, 'exactly one stairs exit'))
    exits.forEach((e, ei) => {
      const room = num(e.room) ?? -1
      const t = resolved[room]
      if (!rooms[room] || !t) { out.push(fail(file, `exits[${ei}]: room must exist`)); return }
      if (str(e.kind) === 'stairs') { if (str(rooms[room]!.role) !== 'stairs') out.push(fail(file, `exits[${ei}]: the stairs exit must sit in the stairs room`)); return }
      const side = str(e.side) as Side | undefined
      if (!side || !t.doors.some((d) => d.side === side)) out.push(fail(file, `exits[${ei}] (${str(e.id)}): room ${room} has no ${side ?? '?'} door`))
      else if (used.has(`${room}:${side}`)) out.push(fail(file, `exits[${ei}] (${str(e.id)}): that door is joined to a room`))
    })
    objs(j.spots).forEach((s, si) => {
      const room = num(s.room) ?? -1
      if (!rooms[room]) { out.push(fail(file, `spots[${si}]: room must exist`)); return }
      const kind = str(s.kind) ?? ''
      if (!['crawl', 'squeeze', 'jump', 'climb'].includes(kind)) return
      // Phase 16: a traversal spot on its axis with 2.6 m clear each side (the ends, the doors' approaches).
      const t = resolved[room]
      const axis = str(s.axis), length = num(s.length)
      if (!t || (axis !== 'ns' && axis !== 'ew') || length === undefined) { out.push(fail(file, `spots[${si}] (${kind}): needs axis ns|ew and length`)); return }
      const at = Array.isArray(s.at) ? s.at.map((v) => (typeof v === 'number' ? v : 0)) : [0, 0]
      const half = (axis === 'ew' ? t.w : t.h) * 4
      const along = axis === 'ew' ? at[0]! : at[1]!
      if (Math.abs(along) + length / 2 + 2.6 > half) out.push(fail(file, `spots[${si}] (${kind}): too close to the room's ends along its axis`))
    })
  }
  return out
}

export const RULES_FLOORS: ReadonlyArray<{ n: number; run: (ctx: Ctx) => Failure[] }> = [{ n: 90, run: rule60 }]
