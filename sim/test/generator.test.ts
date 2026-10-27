import { describe, expect, it } from 'vitest'
import { generateFloor } from '../src/generator.ts'
import type { DoorSide, FloorGraph, FloorKind, FloorRoom, FloorSpec, GeneratorInput, GeneratorKnobs } from '../src/generator.ts'
import { doorCell, renderFloorAscii } from '../src/generator-ascii.ts'

// ─── A test template set for the Cellars, in the schema's template shape (07 §2.2's table, trimmed) ──────────

const camera = { position: [0, 8, 10] as [number, number, number], lookAt: [0, 1, 0] as [number, number, number], fov: 40 }
const tpl = (id: string, w: number, h: number, doors: readonly [DoorSide, number][], kinds: readonly string[]) => ({
  id,
  zoneId: 'the-cellars',
  footprint: { w, h },
  doors: doors.map(([side, offset]) => ({ side, offset })),
  kinds,
  camera,
  props: [],
  triBudget: 30000,
  drawCallBudget: 60,
})

const TEMPLATES = [
  tpl('cel-t-storeroom', 1, 1, [['north', 0], ['east', 0], ['south', 0], ['west', 0]], ['entry', 'fight', 'curio']),
  tpl('cel-t-wine-vault', 2, 1, [['west', 0], ['east', 0], ['north', 1]], ['fight', 'elite', 'treasure']),
  tpl('cel-t-cistern', 1, 1, [['north', 0], ['south', 0]], ['fight', 'trapGauntlet', 'curio']),
  tpl('cel-t-guardpost', 1, 1, [['north', 0], ['east', 0], ['south', 0], ['west', 0]], ['fight', 'elite', 'merchant']),
  tpl('cel-t-kennels', 2, 1, [['west', 0], ['east', 0]], ['fight', 'elite', 'trapGauntlet']),
  tpl('cel-t-cold-hearth', 1, 1, [['south', 0], ['east', 0], ['west', 0]], ['rest']),
  tpl('cel-t-stairwell', 1, 1, [['south', 0]], ['stairs', 'entry']),
  tpl('cel-t-strongroom', 1, 1, [['south', 0]], ['treasure', 'secret']),
  tpl('cel-t-gallery', 3, 1, [['west', 0], ['east', 0]], ['trapGauntlet', 'fight']),
  tpl('cel-t-tap-room', 2, 2, [['south', 0], ['east', 0], ['west', 0]], ['boss']),
  tpl('cel-t-crossing', 1, 1, [['north', 0], ['east', 0], ['south', 0], ['west', 0]], ['fight', 'curio', 'treasure', 'merchant']),
  tpl('cel-t-niche', 1, 1, [['north', 0]], ['treasure', 'secret', 'curio']),
]

// ─── Knobs and floors copied from content/examples/dungeon.example.json ↔ 07 §2.3 ────────────────────────────

const KNOBS: GeneratorKnobs = {
  roomWeights: { fight: 50, elite: 8, rest: 10, merchant: 5, treasure: 7, curio: 15, trapGauntlet: 5 },
  grammar: ['START -> entry PATH stairs'],
  keyLockChance: 30,
  secretChance: 25,
  minRooms: 5,
  maxRooms: 14,
  maxBranches: 3,
  bossFarthest: true,
  grid: { w: 8, h: 6 },
}

const F1: FloorSpec = { floor: 1, zoneId: 'the-cellars', roomsMin: 5, roomsMax: 7, secretChance: 10, merchant: false, bossId: null, hunterClock: 40 }
const F2: FloorSpec = { floor: 2, zoneId: 'the-cellars', roomsMin: 8, roomsMax: 10, secretChance: 25, merchant: true, bossId: null, hunterClock: 40 }
const F3: FloorSpec = { floor: 3, zoneId: 'the-cellars', roomsMin: 8, roomsMax: 11, secretChance: 25, merchant: false, bossId: 'captain-vexa-marrow', hunterClock: null }
// The Throne is its own zone in the content; the test set has Cellars templates only, so the spec points at them.
const F10: FloorSpec = { floor: 10, zoneId: 'the-cellars', roomsMin: 4, roomsMax: 4, secretChance: 0, merchant: false, bossId: 'the-hollow-king', hunterClock: null }

const FLOORS: readonly { spec: FloorSpec; kind: FloorKind; merchants: number }[] = [
  { spec: F1, kind: 'normal', merchants: 0 },
  { spec: F2, kind: 'normal', merchants: 1 },
  { spec: F3, kind: 'zoneBoss', merchants: 0 },
  { spec: F10, kind: 'throne', merchants: 0 },
]

const SEEDS = 500

function input(spec: FloorSpec, kind: FloorKind, seed: number, extra: Partial<GeneratorInput> = {}): GeneratorInput {
  return { knobs: KNOBS, floor: spec, templates: TEMPLATES, seed: [spec.floor * 7919, seed], partySize: 3, kind, ...extra }
}

// ─── 07 §8.1's guarantees as checks ──────────────────────────────────────────────────────────────────────────

const DX: Record<DoorSide, number> = { north: 0, east: 1, south: 0, west: -1 }
const DY: Record<DoorSide, number> = { north: -1, east: 0, south: 1, west: 0 }
const OPPOSITE: Record<DoorSide, DoorSide> = { north: 'south', east: 'west', south: 'north', west: 'east' }

/** BFS hop counts over the doors, optionally skipping one edge and/or one room. */
function bfs(graph: FloorGraph, skipEdge: { from: string; to: string } | null = null, skipRoom: string | null = null): Map<string, number> {
  const byId = new Map(graph.rooms.map((r) => [r.id, r]))
  const hops = new Map<string, number>()
  hops.set(graph.entryId, 0)
  const queue = [graph.entryId]
  while (queue.length > 0) {
    const id = queue.shift() as string
    const room = byId.get(id) as FloorRoom
    for (const d of room.doors) {
      if (d.to === skipRoom) continue
      if (skipEdge && ((id === skipEdge.from && d.to === skipEdge.to) || (id === skipEdge.to && d.to === skipEdge.from))) continue
      if (!hops.has(d.to)) {
        hops.set(d.to, (hops.get(id) ?? 0) + 1)
        queue.push(d.to)
      }
    }
  }
  return hops
}

function check(graph: FloorGraph, spec: FloorSpec, kind: FloorKind, merchants: number, label: string): void {
  const rooms = graph.rooms
  const byId = new Map(rooms.map((r) => [r.id, r]))
  const ctx = (what: string): string => `${label}: ${what}`

  // Ids follow the walk order.
  rooms.forEach((r, i) => expect(r.id, ctx('ids')).toBe(`r${i}`))

  // 5 Shape: cells inside the grid, no overlaps.
  const seen = new Set<number>()
  for (const r of rooms) {
    expect(r.cells.length, ctx(`${r.id} has cells`)).toBeGreaterThan(0)
    for (const c of r.cells) {
      expect(c.x >= 0 && c.y >= 0 && c.x < graph.grid.w && c.y < graph.grid.h, ctx(`${r.id} cell inside grid`)).toBe(true)
      expect(Number.isInteger(c.x) && Number.isInteger(c.y), ctx('integer cells')).toBe(true)
      const key = c.y * graph.grid.w + c.x
      expect(seen.has(key), ctx(`overlap at ${c.x},${c.y}`)).toBe(false)
      seen.add(key)
    }
  }

  // 5 Shape: every door pair meets across a shared edge, with matching flags.
  for (const r of rooms) {
    for (const d of r.doors) {
      const other = byId.get(d.to)
      expect(other, ctx(`${r.id} door to ${d.to}`)).toBeDefined()
      if (!other) continue
      const here = doorCell(r, d)
      const there = { x: here.x + DX[d.side], y: here.y + DY[d.side] }
      expect(r.cells.some((c) => c.x === here.x && c.y === here.y), ctx(`${r.id} door on its own cell`)).toBe(true)
      expect(other.cells.some((c) => c.x === there.x && c.y === there.y), ctx(`${r.id}→${d.to} door meets a cell`)).toBe(true)
      const back = other.doors.filter((b) => b.to === r.id && b.side === OPPOSITE[d.side])
      expect(back.length, ctx(`${d.to} has a door back to ${r.id}`)).toBe(1)
      const b = back[0] as (typeof back)[number]
      const backCell = doorCell(other, b)
      expect(backCell, ctx('back door on the shared edge')).toEqual(there)
      expect(b.locked, ctx('locked flag mirrored')).toBe(d.locked)
      expect(b.secret, ctx('secret flag mirrored')).toBe(d.secret)
    }
  }

  // 1 Solvable: every room reachable; hops match the BFS; 2 Farthest: the exit is the unique farthest room.
  const hops = bfs(graph)
  expect(hops.size, ctx('every room reachable')).toBe(rooms.length)
  for (const r of rooms) expect(r.hop, ctx(`${r.id} hop`)).toBe(hops.get(r.id))
  const exit = byId.get(graph.exitId) as FloorRoom
  expect(exit.kind, ctx('exit kind')).toBe(kind === 'zoneBoss' || kind === 'throne' ? 'boss' : 'stairs')
  for (const r of rooms) if (r.id !== exit.id) expect(r.hop, ctx(`${r.id} nearer than the exit`)).toBeLessThan(exit.hop)

  // Spine flags: exactly the Entry→exit path.
  const spine = new Set<string>()
  {
    const parent = new Map<string, string>()
    const queue = [graph.entryId]
    const visited = new Set(queue)
    while (queue.length > 0) {
      const id = queue.shift() as string
      for (const d of (byId.get(id) as FloorRoom).doors) {
        if (!visited.has(d.to)) {
          visited.add(d.to)
          parent.set(d.to, id)
          queue.push(d.to)
        }
      }
    }
    for (let id: string | undefined = exit.id; id !== undefined; id = parent.get(id)) spine.add(id)
  }
  for (const r of rooms) expect(r.onSpine, ctx(`${r.id} onSpine`)).toBe(spine.has(r.id))
  for (const r of rooms) expect(r.branchDepth === 0, ctx(`${r.id} depth`)).toBe(spine.has(r.id))

  // 3 Exactly one Rest; adjacent to the Boss on boss floors.
  const rests = rooms.filter((r) => r.kind === 'rest')
  if (kind === 'tutorial') {
    expect(rests.length, ctx('tutorial has no rest')).toBe(0)
    expect(graph.restId).toBeNull()
  } else {
    expect(rests.length, ctx('one rest')).toBe(1)
    expect(graph.restId, ctx('restId')).toBe((rests[0] as FloorRoom).id)
    if (kind === 'zoneBoss' || kind === 'throne') {
      expect((rests[0] as FloorRoom).doors.some((d) => d.to === exit.id), ctx('rest adjacent to the boss')).toBe(true)
      expect(exit.encounterId, ctx('boss encounter')).toBe(spec.bossId)
    }
  }

  // 4 Merchant: exactly one where the floor says so, none elsewhere.
  const merchantRooms = rooms.filter((r) => r.kind === 'merchant')
  expect(merchantRooms.length, ctx('merchant count')).toBe(merchants)
  expect(graph.merchantId, ctx('merchantId')).toBe(merchants === 1 ? (merchantRooms[0] as FloorRoom).id : null)

  // 5 Shape: the room count inside the floor's range (secrets do not count), ≤ 3 Forks, no template three times.
  const counted = rooms.filter((r) => r.kind !== 'secret').length
  expect(counted, ctx('rooms ≥ min')).toBeGreaterThanOrEqual(spec.roomsMin)
  expect(counted, ctx('rooms ≤ max')).toBeLessThanOrEqual(spec.roomsMax)
  let forks = 0
  for (const r of rooms) {
    if (!spine.has(r.id)) continue
    const side = r.doors.filter((d) => {
      const o = byId.get(d.to) as FloorRoom
      return !spine.has(o.id) && o.kind !== 'secret'
    })
    if (side.length > 0) forks++
  }
  expect(forks, ctx('forks')).toBeLessThanOrEqual(KNOBS.maxBranches)
  expect(graph.forks, ctx('forks field')).toBe(forks)
  const uses = new Map<string, number>()
  for (const r of rooms) uses.set(r.templateId, (uses.get(r.templateId) ?? 0) + 1)
  for (const [id, n] of uses) expect(n, ctx(`template ${id} used ${n}×`)).toBeLessThanOrEqual(2)
  for (const r of rooms) {
    const t = TEMPLATES.find((x) => x.id === r.templateId)
    expect(t, ctx(`${r.id} template exists`)).toBeDefined()
    expect(t?.kinds.includes(r.kind), ctx(`${r.templateId} hosts ${r.kind}`)).toBe(true)
    expect(r.cells.length, ctx('footprint size')).toBe((t?.footprint.w ?? 0) * (t?.footprint.h ?? 0))
    expect(r.doors.length, ctx('doors within the template')).toBeLessThanOrEqual(t?.doors.length ?? 0)
  }

  // 1 Solvable (Key-and-Lock): the Key room is reachable without the locked door and sits nearer than the lock.
  const keyRooms = rooms.filter((r) => r.hasKey)
  const lockedDoors = rooms.flatMap((r) => r.doors.filter((d) => d.locked).map((d) => [r.id, d.to] as const))
  if (graph.lockedEdge) {
    expect(graph.keyRoomId, ctx('lock has a key room')).not.toBeNull()
    expect(keyRooms.length, ctx('one key room')).toBe(1)
    expect((keyRooms[0] as FloorRoom).id).toBe(graph.keyRoomId)
    expect(lockedDoors.length, ctx('two locked door halves')).toBe(2)
    for (const [from, to] of lockedDoors) {
      expect(
        (from === graph.lockedEdge.from && to === graph.lockedEdge.to) || (from === graph.lockedEdge.to && to === graph.lockedEdge.from),
        ctx('locked doors are the locked edge'),
      ).toBe(true)
    }
    const from = byId.get(graph.lockedEdge.from) as FloorRoom
    const to = byId.get(graph.lockedEdge.to) as FloorRoom
    expect(spine.has(from.id) && spine.has(to.id), ctx('lock on the spine')).toBe(true)
    expect(to.hop, ctx('lock points away from the entry')).toBe(from.hop + 1)
    const restRoom = byId.get(graph.restId as string) as FloorRoom
    expect(from.hop, ctx('lock after the rest')).toBeGreaterThanOrEqual(restRoom.hop - restRoom.branchDepth)
    const withoutLock = bfs(graph, graph.lockedEdge)
    expect(withoutLock.has(graph.keyRoomId as string), ctx('key reachable before the lock')).toBe(true)
    expect((keyRooms[0] as FloorRoom).hop, ctx('key hop < lock hop')).toBeLessThan(to.hop)
    expect(withoutLock.has(exit.id), ctx('exit is behind the lock')).toBe(false)
    expect((keyRooms[0] as FloorRoom).kind === 'fight' || (keyRooms[0] as FloorRoom).kind === 'elite' || !spine.has((keyRooms[0] as FloorRoom).id), ctx('key off the spine')).toBe(true)
    expect(spine.has((keyRooms[0] as FloorRoom).id), ctx('key room on a branch')).toBe(false)
  } else {
    expect(keyRooms.length, ctx('no key without a lock')).toBe(0)
    expect(lockedDoors.length, ctx('no locked doors without a lock')).toBe(0)
    expect(graph.keyRoomId).toBeNull()
  }

  // 7 Secrets never gate: a leaf with one door whose removal changes no other room's reachability.
  const secrets = rooms.filter((r) => r.kind === 'secret')
  expect(secrets.length, ctx('at most one secret')).toBeLessThanOrEqual(1)
  expect(graph.secretId, ctx('secretId')).toBe(secrets.length === 1 ? (secrets[0] as FloorRoom).id : null)
  if (secrets.length === 1) {
    const s = secrets[0] as FloorRoom
    expect(s.doors.length, ctx('secret has one door')).toBe(1)
    expect(s.doors.every((d) => d.secret), ctx('secret door flagged')).toBe(true)
    const without = bfs(graph, null, s.id)
    expect(without.size, ctx('every other room reachable without the secret')).toBe(rooms.length - 1)
    for (const r of rooms) if (r.id !== s.id) expect(without.get(r.id), ctx(`${r.id} hop unchanged without the secret`)).toBe(r.hop)
    expect(s.hop, ctx('secret nearer than the exit')).toBeLessThan(exit.hop)
  }
  const secretDoors = rooms.flatMap((r) => r.doors.filter((d) => d.secret))
  expect(secretDoors.length, ctx('secret door halves')).toBe(secrets.length * 2)

  // Decoration and encounters.
  for (const r of rooms) {
    expect(r.variation >= 0 && r.variation <= 100 && Number.isInteger(r.variation), ctx('variation 0–100')).toBe(true)
    expect(r.rotation === 0 || r.rotation === 90 || r.rotation === 180 || r.rotation === 270, ctx('rotation')).toBe(true)
  }
  expect(graph.floor).toBe(spec.floor)
  expect(graph.kind).toBe(kind)
  expect(graph.grid).toEqual(KNOBS.grid)
}

interface Stats {
  floors: number
  retried: number
  retries: number
  hashes: Set<number>
  ms: number
}

function runFloors(spec: FloorSpec, kind: FloorKind, merchants: number, seeds: number): Stats {
  const stats: Stats = { floors: 0, retried: 0, retries: 0, hashes: new Set(), ms: 0 }
  for (let s = 0; s < seeds; s++) {
    const t0 = performance.now()
    const graph = generateFloor(input(spec, kind, s))
    stats.ms += performance.now() - t0
    stats.floors++
    if (graph.retries > 0) stats.retried++
    stats.retries += graph.retries
    stats.hashes.add(graph.hash)
    expect(graph.seed, `F${spec.floor} seed ${s}: seed kept`).toEqual([spec.floor * 7919, s])
    check(graph, spec, kind, merchants, `F${spec.floor} seed ${s}`)
  }
  return stats
}

describe('generateFloor meets 07 §8.1 over many seeds', () => {
  for (const { spec, kind, merchants } of FLOORS) {
    it(`F${spec.floor} (${kind}): ${SEEDS} seeds solvable, farthest exit, one rest, merchant ${merchants}, shape, secrets, retries < 2%`, () => {
      const stats = runFloors(spec, kind, merchants, SEEDS)
      expect(stats.floors).toBe(SEEDS)
      // 10 Retry rate under 2% of floors.
      expect(stats.retried / stats.floors, `F${spec.floor} retry rate ${stats.retried}/${stats.floors}`).toBeLessThan(0.02)
      // 9 Determinism across seeds: different seeds (almost always) give different floors.
      expect(stats.hashes.size, `F${spec.floor} distinct hashes`).toBeGreaterThan(kind === 'throne' ? SEEDS * 0.5 : SEEDS * 0.9)
      // Fast enough for the balance runner (500 floors well under 5 s; generation time only).
      expect(stats.ms, `F${spec.floor} generation took ${Math.round(stats.ms)} ms`).toBeLessThan(5000)
    })
  }

  it('9 Determinism: the same input gives an identical graph and hash; an Rng state seeds the same way twice', () => {
    for (const { spec, kind } of FLOORS) {
      for (let s = 0; s < 25; s++) {
        const a = generateFloor(input(spec, kind, s))
        const b = generateFloor(input(spec, kind, s))
        expect(b.hash).toBe(a.hash)
        expect(b).toEqual(a)
      }
    }
    const state = { a: 1, b: 2, c: 3, d: 4 }
    const a = generateFloor({ ...input(F2, 'normal', 0), seed: state })
    const b = generateFloor({ ...input(F2, 'normal', 0), seed: { ...state } })
    expect(b).toEqual(a)
    check(a, F2, 'normal', 1, 'F2 from an Rng state')
  })

  it('6 Role mix hooks: the stub is called for every fight/elite room in walk order and never repeats an id in a row', () => {
    const IDS = ['rat-pack', 'cellar-dusting', 'toll-collectors', 'dog-handlers']
    for (const { spec, kind, merchants } of FLOORS) {
      for (let s = 0; s < 60; s++) {
        const calls: number[] = []
        const graph = generateFloor(
          input(spec, kind, s, {
            pickEncounter: (ctx) => {
              calls.push(ctx.roomIndex)
              return ctx.rng.pick(IDS.filter((id) => id !== ctx.previousEncounterId))
            },
          }),
        )
        check(graph, spec, kind, merchants, `F${spec.floor} seed ${s} with encounters`)
        const fights = graph.rooms.filter((r) => r.kind === 'fight' || r.kind === 'elite')
        expect(calls).toEqual(fights.map((r) => graph.rooms.indexOf(r)))
        for (const r of fights) expect(r.encounterId, `${r.id} has an encounter`).not.toBeNull()
        for (let i = 1; i < fights.length; i++) {
          expect((fights[i] as FloorRoom).encounterId).not.toBe((fights[i - 1] as FloorRoom).encounterId)
        }
        for (const r of graph.rooms) if (r.kind !== 'fight' && r.kind !== 'elite' && r.kind !== 'boss') expect(r.encounterId).toBeNull()
      }
    }
  })

  it('6 Role mix: meetsRoleMix false 19 times then true re-rolls the last Fight room exactly 19 times', () => {
    let serial = 0
    let checks = 0
    const picked: number[] = []
    const graph = generateFloor(
      input(F2, 'normal', 3, {
        pickEncounter: (ctx) => {
          picked.push(ctx.roomIndex)
          return `enc-${serial++}`
        },
        meetsRoleMix: () => {
          checks++
          return checks > 19
        },
      }),
    )
    const fights = graph.rooms.filter((r) => r.kind === 'fight' || r.kind === 'elite')
    const lastFight = graph.rooms.filter((r) => r.kind === 'fight').at(-1) as FloorRoom
    expect(checks).toBe(20)
    expect(picked.length).toBe(fights.length + 19)
    expect(picked.slice(fights.length).every((i) => i === graph.rooms.indexOf(lastFight))).toBe(true)
    expect(lastFight.encounterId).toBe(`enc-${fights.length + 18}`)
    // A floor that never satisfies the mix stops after 20 re-rolls.
    let stubborn = 0
    generateFloor(
      input(F2, 'normal', 3, {
        pickEncounter: () => `enc-${serial++}`,
        meetsRoleMix: () => {
          stubborn++
          return false
        },
      }),
    )
    expect(stubborn).toBe(21)
  })

  it('G12 with the Every Door Locked Pact: a lock on every floor that can take one', () => {
    for (const { spec, kind, merchants } of FLOORS.filter((f) => f.kind === 'normal' || f.kind === 'zoneBoss')) {
      let noLock = 0
      for (let s = 0; s < 200; s++) {
        const graph = generateFloor(input(spec, kind, s, { overrides: { everyDoorLocked: true } }))
        check(graph, spec, kind, merchants, `F${spec.floor} seed ${s} locked`)
        if (graph.lockedEdge === null) {
          // A floor whose only candidate edges leave no room for a Key room takes no lock (generator reading 7).
          noLock++
          continue
        }
        expect(graph.keyRoomId).not.toBeNull()
      }
      expect(noLock, `F${spec.floor}: floors with no feasible lock`).toBeLessThanOrEqual(4)
    }
    // 30% by default: the rate lands near the knob.
    let locked = 0
    for (let s = 0; s < SEEDS; s++) if (generateFloor(input(F2, 'normal', s)).lockedEdge) locked++
    expect(locked / SEEDS).toBeGreaterThan(0.2)
    expect(locked / SEEDS).toBeLessThan(0.4)
  })

  it('G13 secret chance and G9 overrides are honoured', () => {
    let secrets = 0
    for (let s = 0; s < SEEDS; s++) if (generateFloor(input(F2, 'normal', s, { overrides: { secretChance: 100 } })).secretId) secrets++
    expect(secrets / SEEDS, 'a 100% secret chance places one on almost every floor').toBeGreaterThan(0.95)
    let none = 0
    for (let s = 0; s < 100; s++) if (generateFloor(input(F2, 'normal', s, { overrides: { secretChance: 0 } })).secretId === null) none++
    expect(none).toBe(100)
    let elites = 0
    let fights = 0
    for (let s = 0; s < 200; s++) {
      const g = generateFloor(input(F2, 'normal', s, { overrides: { eliteRoomWeight: 40 } }))
      elites += g.rooms.filter((r) => r.kind === 'elite').length
      fights += g.rooms.filter((r) => r.kind === 'fight').length
    }
    expect(elites, 'elite weight 40 (taken from fight) gives many more elites').toBeGreaterThan(fights * 0.5)
  })

  it('the tutorial floor is exactly Entry · Fight · Gauntlet · Stairs', () => {
    for (let s = 0; s < 50; s++) {
      const graph = generateFloor(input(F1, 'tutorial', s))
      check(graph, { ...F1, roomsMin: 4, roomsMax: 4 }, 'tutorial', 0, `tutorial seed ${s}`)
      expect(graph.rooms.map((r) => r.kind)).toEqual(['entry', 'fight', 'trapGauntlet', 'stairs'])
      expect(graph.rooms.map((r) => r.hop)).toEqual([0, 1, 2, 3])
      expect(graph.lockedEdge).toBeNull()
      expect(graph.secretId).toBeNull()
      expect(graph.merchantId).toBeNull()
    }
  })

  it('the throne floor is exactly Entry · Fight · Rest · Boss', () => {
    for (let s = 0; s < 50; s++) {
      const graph = generateFloor(input(F10, 'throne', s))
      expect(graph.rooms.map((r) => r.kind)).toEqual(['entry', 'fight', 'rest', 'boss'])
      expect(graph.lockedEdge).toBeNull()
      expect(graph.secretId).toBeNull()
    }
  })

  it('renderFloorAscii draws every cell once with one Entry and one exit', () => {
    for (const { spec, kind } of FLOORS) {
      for (let s = 0; s < 40; s++) {
        const graph = generateFloor(input(spec, kind, s))
        const picture = renderFloorAscii(graph)
        expect((picture.match(/\[E\]/g) ?? []).length, `F${spec.floor} seed ${s} one entry`).toBe(1)
        expect((picture.match(/\[[SB]\]/g) ?? []).length, `F${spec.floor} seed ${s} one exit`).toBe(1)
        const tokens = picture.match(/\[[A-Za-z]\]/g) ?? []
        expect(tokens.length, `F${spec.floor} seed ${s} one token per cell`).toBe(graph.rooms.reduce((n, r) => n + r.cells.length, 0))
        if (graph.lockedEdge) expect(picture.includes('#')).toBe(true)
        if (graph.secretId) expect(picture.includes('?')).toBe(true)
        expect(picture.split('\n').length).toBe(1 + 1 + graph.grid.h * 2 - 1 + 2)
      }
    }
    const graph = generateFloor(input(F2, 'normal', 17))
    const picture = renderFloorAscii(graph)
    expect(picture).toContain('col→')
    expect(picture).toContain('row 1')
    expect(picture).toContain('E Entry')
  })
})
