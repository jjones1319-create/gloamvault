/**
 * The floor generator: 07-DUNGEONS.md §2.10 (grammar G1–G15, template selection, layout, decoration) and
 * 03-GAME-DESIGN.md §11.1, held to 07 §8.1's guarantees by sim/test/generator.test.ts.
 *
 * Pure and deterministic (CLAUDE.md): no DOM, no Math.random, no Date.now, integer cells, a seeded Rng whose
 * forks ('graph' · 'encounters' · 'layout' · 'decor') keep one sub-system's draws from shifting another's.
 *
 * Pipeline per floor: mission graph (a tree: the Spine from Entry to the exit, side Branches off spine rooms,
 * one optional Secret leaf) → ids in walk order → encounters (G14) → layout on the cell grid with templates →
 * decoration → hash. A layout that exhausts its placement budget bumps the seed's low word and regenerates the
 * whole floor (§2.10: "floor seed +1 and regenerate, logged with the original seed").
 */
import { Rng, hashString } from './rng.ts'
import type { RngState } from './rng.ts'

// ─── Vocabulary ──────────────────────────────────────────────────────────────────────────────────────────────

export type RoomKind =
  | 'entry'
  | 'fight'
  | 'elite'
  | 'rest'
  | 'merchant'
  | 'treasure'
  | 'curio'
  | 'trapGauntlet'
  | 'secret'
  | 'stairs'
  | 'boss'
  | 'keyRoom'
export type DoorSide = 'north' | 'east' | 'south' | 'west'
export type FloorKind = 'normal' | 'zoneBoss' | 'throne' | 'tutorial'
export type Rotation = 0 | 90 | 180 | 270

export interface Cell {
  readonly x: number
  readonly y: number
}

// ─── Input (structural: the dungeon JSON satisfies these without importing the content types) ───────────────

/** The schema's `generator` object (content/schemas/dungeon.schema.json). */
export interface GeneratorKnobs {
  /** G9 roll weights for the rolled kinds; fixed kinds are left out or 0. Read by fixed key, never by key order. */
  readonly roomWeights: Readonly<Partial<Record<RoomKind, number>>>
  /** The rewrite rules as text — informational; the rules are code (§2.10 G1–G15). */
  readonly grammar?: readonly string[]
  readonly keyLockChance: number
  /** The default secret chance when a floor does not carry one. */
  readonly secretChance: number
  readonly minRooms: number
  readonly maxRooms: number
  /** §2.10 G5 "at most 3 Forks per floor" — read as the Fork cap. */
  readonly maxBranches: number
  readonly bossFarthest?: boolean
  readonly grid: { readonly w: number; readonly h: number }
}

/** The schema's `floor` fields the generator reads. */
export interface FloorSpec {
  readonly floor: number
  readonly zoneId: string
  readonly roomsMin: number
  readonly roomsMax: number
  readonly secretChance?: number
  readonly merchant: boolean
  readonly bossId: string | null
  readonly hunterClock?: number | null
  /**
   * The boss's arena room (07 §2.8; the boss's `arena.room`): §2.10's "Boss templates are fixed" — the Boss node is
   * laid out from this template alone when the zone has it (the Vault holds two boss rooms: Naesa's chapel on F7, the
   * throne on F8). Absent or null: any of the zone's boss templates.
   */
  readonly bossTemplateId?: string | null
}

export interface TemplateDoorSpec {
  /** 'north' | 'east' | 'south' | 'west' (typed loosely so JSON-derived types fit; unknown sides are ignored). */
  readonly side: string
  /** Cells from the side's left/top corner. */
  readonly offset: number
}

/** The schema's `template`: `kinds` are §2.10's hosts and `doors` its sockets. */
export interface TemplateSpec {
  readonly id: string
  readonly zoneId: string
  readonly footprint: { readonly w: number; readonly h: number }
  readonly doors: readonly TemplateDoorSpec[]
  readonly kinds: readonly string[]
}

export interface GeneratorOverrides {
  /** Replaces the Elite weight; the difference comes out of Fight (presets and Pacts, 07 §6). */
  readonly eliteRoomWeight?: number
  readonly keyLockChance?: number
  readonly secretChance?: number
  /** The Every Door Locked Pact (07 §6.2): a Key-and-Lock pair on every floor. */
  readonly everyDoorLocked?: boolean
}

export interface EncounterContext {
  readonly roomIndex: number
  readonly previousEncounterId: string | null
  readonly rng: Rng
}

/** §2.10's literal numbers, overridable so they can be wired to content/tuning.json without a code change. */
export interface GrammarNumbers {
  /** G4 Spine → Seg{3–5}. */
  readonly spineSegsMin: number
  readonly spineSegsMax: number
  /** G5 Fork on 45% of segments. */
  readonly forkChance: number
  /** G6 Fork → Branch{1–2}. */
  readonly branchesMin: number
  readonly branchesMax: number
  /** G7 Branch → Room{0–2} · Cap. */
  readonly branchRoomsMin: number
  readonly branchRoomsMax: number
  /** G8 Cap weights. */
  readonly capWeights: Readonly<Record<'treasure' | 'curio' | 'fight' | 'elite', number>>
  /** G14 re-rolls of the last Fight room before the floor is accepted as is. */
  readonly roleMixRerolls: number
  /** Layout placements before the seed is bumped. */
  readonly placementBudget: number
  /** Layout alternatives tried per room before its parent's choice is revisited (limited discrepancy search). */
  readonly placementAlternatives: number
  /** Seed bumps after which the "no template three times" rule is relaxed (a template-starved zone). */
  readonly relaxAfterRetries: number
  /** Seed bumps before the generator gives up with an Error (a content problem the runner must surface). */
  readonly maxRetries: number
}

export const DEFAULT_GRAMMAR: GrammarNumbers = {
  spineSegsMin: 3,
  spineSegsMax: 5,
  forkChance: 45,
  branchesMin: 1,
  branchesMax: 2,
  branchRoomsMin: 0,
  branchRoomsMax: 2,
  capWeights: { treasure: 40, curio: 30, fight: 20, elite: 10 },
  roleMixRerolls: 20,
  placementBudget: 200,
  placementAlternatives: 2,
  relaxAfterRetries: 16,
  maxRetries: 64,
}

export interface GeneratorInput {
  readonly knobs: GeneratorKnobs
  readonly floor: FloorSpec
  readonly templates: readonly TemplateSpec[]
  /** The floor seed as two u32 halves (hash(matchSeed, dungeonId, floorNumber)) or an Rng state to draw one from. */
  readonly seed: readonly [number, number] | RngState
  /** Carried for the floor's identity (07 §8.1 #9); the map itself does not change with the party size. */
  readonly partySize: number
  readonly kind: FloorKind
  readonly overrides?: GeneratorOverrides
  readonly grammar?: Partial<GrammarNumbers>
  /** G14: the encounter for a fight/elite room, in walk order; never the same id twice in a row. */
  readonly pickEncounter?: (ctx: EncounterContext) => string | null
  /** G14: 06 §8.2's role mix over the floor's encounter ids; the last Fight room is re-rolled until true. */
  readonly meetsRoleMix?: (encounterIds: readonly string[]) => boolean
}

// ─── Output ──────────────────────────────────────────────────────────────────────────────────────────────────

export interface FloorDoor {
  readonly to: string
  readonly side: DoorSide
  /** Cells from the placed room's left/top corner on that side (after rotation). */
  readonly offset: number
  readonly locked: boolean
  readonly secret: boolean
}

export interface FloorRoom {
  readonly id: string
  readonly kind: RoomKind
  readonly templateId: string
  /** The template's clockwise rotation on the grid; `doors` and `cells` are already in grid space. */
  readonly rotation: Rotation
  readonly cells: readonly Cell[]
  readonly doors: readonly FloorDoor[]
  /** BFS distance from the Entry. */
  readonly hop: number
  readonly onSpine: boolean
  /** 0 on the Spine, 1+ down a Branch (the Secret counts as one deeper than its host). */
  readonly branchDepth: number
  readonly encounterId: string | null
  readonly hasKey: boolean
  /** The decoration pass's seed for this room, 0–100 (§2.10's tile-variation pass; the client dresses it). */
  readonly variation: number
}

export interface FloorGraph {
  readonly floor: number
  readonly kind: FloorKind
  /** The seed the floor was asked for (retries bump a copy, never this). */
  readonly seed: readonly [number, number]
  readonly grid: { readonly w: number; readonly h: number }
  /** Walk order: Entry, then each room followed by its Secret, its Branches and the next Spine room. */
  readonly rooms: readonly FloorRoom[]
  readonly entryId: string
  /** The Stairs, or the Boss on boss floors. */
  readonly exitId: string
  /** Null only on the tutorial floor, which has no Rest (03 §13). */
  readonly restId: string | null
  readonly merchantId: string | null
  readonly keyRoomId: string | null
  readonly lockedEdge: { readonly from: string; readonly to: string } | null
  readonly secretId: string | null
  readonly forks: number
  readonly retries: number
  /** FNV-1a over the canonical room list (ids, kinds, templates, rotations, cells, doors). */
  readonly hash: number
}

// ─── Constants ───────────────────────────────────────────────────────────────────────────────────────────────

const ROLLED: readonly RoomKind[] = ['fight', 'elite', 'rest', 'merchant', 'treasure', 'curio', 'trapGauntlet']
const CAP_KINDS: readonly ('treasure' | 'curio' | 'fight' | 'elite')[] = ['treasure', 'curio', 'fight', 'elite']
const SIDES: readonly DoorSide[] = ['north', 'east', 'south', 'west']
const OPPOSITE: Readonly<Record<DoorSide, DoorSide>> = { north: 'south', east: 'west', south: 'north', west: 'east' }
const DX: Readonly<Record<DoorSide, number>> = { north: 0, east: 1, south: 0, west: -1 }
const DY: Readonly<Record<DoorSide, number>> = { north: -1, east: 0, south: 1, west: 0 }

function isSide(s: string): s is DoorSide {
  return s === 'north' || s === 'east' || s === 'south' || s === 'west'
}

// ─── The mission graph ───────────────────────────────────────────────────────────────────────────────────────

interface Node {
  readonly serial: number
  kind: RoomKind
  parent: Node | null
  /** The Spine successor (spine rooms only). */
  next: Node | null
  /** Side children: Branch heads on a spine room, the continuation on a branch room. */
  readonly children: Node[]
  secret: Node | null
  hasKey: boolean
}

interface Graph {
  readonly entry: Node
  readonly exit: Node
  readonly anteroom: Node | null
  readonly rest: Node | null
  readonly merchant: Node | null
  readonly keyRoom: Node | null
  readonly lockFrom: Node | null
  readonly secret: Node | null
  /** Rooms in walk order (ids follow it). */
  readonly order: readonly Node[]
}

/** Pre-order walk: a room, its Secret, its Branches, then the next Spine room (the §2.10 worked example's order). */
function walk(entry: Node): Node[] {
  const out: Node[] = []
  const visit = (n: Node): void => {
    out.push(n)
    if (n.secret) visit(n.secret)
    for (const c of n.children) visit(c)
    if (n.next) visit(n.next)
  }
  visit(entry)
  return out
}

function spineOf(entry: Node): Node[] {
  const out: Node[] = []
  for (let n: Node | null = entry; n; n = n.next) out.push(n)
  return out
}

/** Hop counts are a property of the tree: corridors are implicit and only graph edges become doors. */
function hopsOf(entry: Node): Map<Node, number> {
  const hops = new Map<Node, number>()
  for (const n of walk(entry)) hops.set(n, n.parent ? (hops.get(n.parent) ?? 0) + 1 : 0)
  return hops
}

function degree(n: Node): number {
  return (n.parent ? 1 : 0) + (n.next ? 1 : 0) + n.children.length + (n.secret ? 1 : 0)
}

function subtreeHasKey(n: Node): boolean {
  if (n.hasKey) return true
  if (n.secret && subtreeHasKey(n.secret)) return true
  for (const c of n.children) if (subtreeHasKey(c)) return true
  return n.next ? subtreeHasKey(n.next) : false
}

function detachSide(n: Node): void {
  const p = n.parent
  if (!p) return
  if (p.secret === n) p.secret = null
  else {
    const i = p.children.indexOf(n)
    if (i >= 0) p.children.splice(i, 1)
  }
  n.parent = null
}

/** The spine room a node hangs from (itself when on the Spine). */
function spineAnchor(n: Node, onSpine: ReadonlySet<Node>): Node {
  let cur: Node = n
  while (!onSpine.has(cur) && cur.parent) cur = cur.parent
  return cur
}

interface BuildContext {
  readonly input: GeneratorInput
  readonly g: GrammarNumbers
  readonly capacity: ReadonlyMap<string, number>
  readonly weights: ReadonlyMap<RoomKind, number>
  serial: number
}

function newNode(ctx: BuildContext, kind: RoomKind): Node {
  return { serial: ctx.serial++, kind, parent: null, next: null, children: [], secret: null, hasKey: false }
}

function linkSpine(a: Node, b: Node): void {
  a.next = b
  b.parent = a
}

function attachSide(p: Node, c: Node): void {
  p.children.push(c)
  c.parent = p
}

/** G9: a rolled Room kind, skipping kinds whose templates cannot offer `minDoors` sockets (never a dead node).
 *  Branch rooms skip Rest and Merchant: the floor's one of each lives on the Spine (G10/G11's fallbacks, G12's
 *  "edge after the Rest", 07 §2.7), so a cut Branch can never take it away. */
function rollRoom(ctx: BuildContext, rng: Rng, minDoors: number, onBranch = false): RoomKind {
  const pool = ROLLED.filter(
    (k) =>
      (ctx.weights.get(k) ?? 0) > 0 &&
      (ctx.capacity.get(k) ?? 0) >= minDoors &&
      !(onBranch && (k === 'rest' || k === 'merchant')),
  )
  if (pool.length === 0) return 'fight'
  return rng.weighted(pool, (k) => ctx.weights.get(k) ?? 0)
}

/** G8: a Branch's Cap. */
function rollCap(ctx: BuildContext, rng: Rng): RoomKind {
  const pool = CAP_KINDS.filter((k) => ctx.g.capWeights[k] > 0 && (ctx.capacity.get(k) ?? 0) >= 1)
  if (pool.length === 0) return 'fight'
  return rng.weighted(pool, (k) => ctx.g.capWeights[k])
}

function buildGraph(ctx: BuildContext, rng: Rng): Graph {
  const { input, g } = ctx
  const { knobs, floor, overrides } = input
  const entry = newNode(ctx, 'entry')

  // G3 and the tutorial are fixed: no further rules.
  if (input.kind === 'tutorial') {
    const fight = newNode(ctx, 'fight')
    const trap = newNode(ctx, 'trapGauntlet')
    const stairs = newNode(ctx, 'stairs')
    linkSpine(entry, fight)
    linkSpine(fight, trap)
    linkSpine(trap, stairs)
    return finish(entry, stairs, null, null, null, null, null, null)
  }
  if (input.kind === 'throne') {
    const fight = newNode(ctx, 'fight')
    const rest = newNode(ctx, 'rest')
    const boss = newNode(ctx, 'boss')
    linkSpine(entry, fight)
    linkSpine(fight, rest)
    linkSpine(rest, boss)
    return finish(entry, boss, null, rest, null, null, null, null)
  }

  const isBossFloor = input.kind === 'zoneBoss'
  // G12's chance is rolled first so the Spine can keep a cell of the room budget for the Key room.
  const keyLockChance = overrides?.keyLockChance ?? knobs.keyLockChance
  const wantLock = overrides?.everyDoorLocked === true || rng.pct(keyLockChance)

  // G1/G2 + G4: Entry · Seg{3–5} · (Anteroom · Boss | Stairs), the Spine capped so the floor can stay ≤ roomsMax.
  const fixedRooms = isBossFloor ? 3 : 2
  const segCap = Math.max(1, floor.roomsMax - fixedRooms - (wantLock ? 1 : 0))
  const segCount = Math.min(rng.range(g.spineSegsMin, g.spineSegsMax), segCap)
  const segs: Node[] = []
  let prev = entry
  for (let i = 0; i < segCount; i++) {
    const seg = newNode(ctx, rollRoom(ctx, rng, 2))
    linkSpine(prev, seg)
    segs.push(seg)
    prev = seg
  }
  let anteroom: Node | null = null
  let exit: Node
  if (isBossFloor) {
    anteroom = newNode(ctx, 'rest')
    exit = newNode(ctx, 'boss')
    linkSpine(prev, anteroom)
    linkSpine(anteroom, exit)
  } else {
    exit = newNode(ctx, 'stairs')
    linkSpine(prev, exit)
  }

  // G5–G8: Forks on 45% of segments (≤ maxBranches per floor), 1–2 Branches of 0–2 Rooms and a Cap. A Branch is
  // bounded by the host's sockets and by the hops left to the exit, so every Cap stays strictly nearer the Entry
  // than the Stairs/Boss (G15 by construction).
  const exitHop = segCount + (isBossFloor ? 2 : 1)
  let forks = 0
  for (let i = 1; i <= segCount; i++) {
    if (forks >= knobs.maxBranches) break
    if (!rng.pct(g.forkChance)) continue
    const seg = segs[i - 1]
    if (!seg) break
    const byDoors = Math.min(g.branchesMax, (ctx.capacity.get(seg.kind) ?? 0) - 2)
    const roomsLeft = exitHop - 2 - i // Cap hop = i + rooms + 1 ≤ exitHop − 1
    if (byDoors < 1 || roomsLeft < 0) continue
    const branches = Math.min(rng.range(g.branchesMin, g.branchesMax), byDoors)
    for (let b = 0; b < branches; b++) {
      const roomCount = Math.min(rng.range(g.branchRoomsMin, g.branchRoomsMax), roomsLeft)
      let p = seg
      for (let r = 0; r < roomCount; r++) {
        const room = newNode(ctx, rollRoom(ctx, rng, 2, true))
        attachSide(p, room)
        p = room
      }
      attachSide(p, newNode(ctx, rollCap(ctx, rng)))
    }
    forks++
  }

  const onSpine = new Set(spineOf(entry))
  const inWalkOrder = (kind: RoomKind, except: Node | null): Node[] =>
    walk(entry)
      .filter((n) => n.kind === kind && n !== except)
      .sort((a, b) => Number(!onSpine.has(a)) - Number(!onSpine.has(b)) || a.serial - b.serial)

  // G10: exactly one Rest. On boss floors the Anteroom is it; otherwise the first rolled stays, a second re-rolls
  // as Fight, and none promotes the Spine's middle Room (or the nearest one whose sockets allow it).
  let rest: Node | null = anteroom
  const rolledRests = inWalkOrder('rest', anteroom)
  if (anteroom) {
    for (const r of rolledRests) r.kind = 'fight'
  } else if (rolledRests.length > 0) {
    rest = rolledRests[0] ?? null
    for (const r of rolledRests.slice(1)) r.kind = 'fight'
  } else {
    const restCap = ctx.capacity.get('rest') ?? 0
    const mid = Math.floor(segCount / 2)
    let chosen: Node | null = null
    for (const off of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
      const cand = segs[mid + off]
      if (cand && degree(cand) <= restCap) {
        chosen = cand
        break
      }
    }
    if (!chosen) {
      chosen = segs[mid] ?? segs[0] ?? null
      if (chosen) for (const c of chosen.children.slice()) detachSide(c)
    }
    if (chosen) {
      chosen.kind = 'rest'
      rest = chosen
    }
  }

  // G11: a Merchant exactly once when the floor says so (the last Spine Room before the Stairs if none rolled);
  // none otherwise — the floor table (07 §2.3) owns which floors have one. On a boss floor it is the Spine Room just
  // before the Anteroom (07 §2.7, §8.1 #4: F6's barrow, F7's raft), whatever rolled.
  let merchant: Node | null = null
  const rolledMerchants = inWalkOrder('merchant', null)
  if (floor.merchant && anteroom) {
    for (const m of rolledMerchants) m.kind = 'fight'
    const last = segs[segs.length - 1] ?? null
    if (last) {
      if (degree(last) > (ctx.capacity.get('merchant') ?? 0)) for (const c of last.children.slice()) detachSide(c)
      last.kind = 'merchant'
      merchant = last
    }
  } else if (floor.merchant) {
    if (rolledMerchants.length > 0) {
      merchant = rolledMerchants[0] ?? null
      for (const m of rolledMerchants.slice(1)) m.kind = 'fight'
    } else {
      const merchantCap = ctx.capacity.get('merchant') ?? 0
      for (let i = segs.length - 1; i >= 0; i--) {
        const cand = segs[i]
        if (cand && cand !== rest && degree(cand) <= merchantCap) {
          merchant = cand
          break
        }
      }
      if (!merchant) merchant = segs.filter((s) => s !== rest).at(-1) ?? null
      if (merchant) merchant.kind = 'merchant'
    }
  } else {
    for (const m of rolledMerchants) m.kind = 'fight'
  }

  // G12: Key-and-Lock. A Spine edge after the Rest is locked; the Key is the loot of a room on a Branch rooted
  // before it (hop ≤ the lock's from-room, so the Key's hop count is less than the lock's), inserting
  // Fork → Branch(Fight · Cap(Fight)) at the nearest Room before the lock when no such room exists.
  let keyRoom: Node | null = null
  let lockFrom: Node | null = null
  if (wantLock && rest) {
    const spine = spineOf(entry)
    const hops = hopsOf(entry)
    const restIdx = spine.indexOf(rest)
    const lastIdx = spine.length - 1
    /** Branch rooms the Key may drop in (hop ≤ f): a Fight or Elite when one exists ("a Fight whose loot holds the
     *  key", §2.10's example), else any Branch room (Treasure, Curio, Gauntlet). */
    const keyCandidates = (f: number): Node[] => {
      const side = walk(entry).filter((n) => !onSpine.has(n) && n.kind !== 'secret' && (hops.get(n) ?? 0) <= f)
      const fights = side.filter((n) => n.kind === 'fight' || n.kind === 'elite')
      return fights.length > 0 ? fights : side
    }
    const hosts = (f: number): Node[] => {
      const out: Node[] = []
      for (let k = 1; k < f && k <= segs.length; k++) {
        const seg = spine[k]
        if (seg && segs.includes(seg) && (ctx.capacity.get(seg.kind) ?? 0) >= degree(seg) + 1) out.push(seg)
      }
      return out
    }
    const feasible: number[] = []
    for (let f = Math.max(1, restIdx); f < lastIdx; f++) {
      if (keyCandidates(f).length > 0 || hosts(f).length > 0) feasible.push(f)
    }
    if (feasible.length > 0) {
      const f = rng.pick(feasible)
      const existing = keyCandidates(f)
      if (existing.length > 0) {
        keyRoom = rng.pick(existing)
      } else {
        const all = hosts(f)
        const forked = all.filter((h) => h.children.length > 0)
        const host = (forks >= knobs.maxBranches && forked.length > 0 ? forked : all).at(-1)
        if (host) {
          const hostIdx = spine.indexOf(host)
          if (host.children.length === 0) forks++
          let p = host
          if (f - hostIdx >= 2) {
            const fight = newNode(ctx, 'fight')
            attachSide(p, fight)
            p = fight
          }
          const cap = newNode(ctx, 'fight')
          attachSide(p, cap)
          keyRoom = cap
        }
      }
      if (keyRoom) {
        keyRoom.hasKey = true
        lockFrom = spine[f] ?? null
      }
    }
  }

  // Room-count clamp (§2.10, with the floor table's own range): over the max cut the last Branch (the Key's
  // branch last, and only down to the Key room); under the min append a Seg before the Stairs/Anteroom.
  const roomCount = (): number => walk(entry).length
  const cutLastBranch = (): boolean => {
    const spine = spineOf(entry)
    for (let i = spine.length - 1; i >= 0; i--) {
      const s = spine[i]
      if (!s) continue
      for (let c = s.children.length - 1; c >= 0; c--) {
        const head = s.children[c]
        if (head && !subtreeHasKey(head)) {
          detachSide(head)
          return true
        }
      }
    }
    return false
  }
  const shortenKeyBranch = (): boolean => {
    if (!keyRoom) return false
    const anchor = spineAnchor(keyRoom, new Set(spineOf(entry)))
    const head = anchor.children.find((c) => subtreeHasKey(c))
    if (!head || (head === keyRoom && keyRoom.children.length === 0)) return false
    const at = anchor.children.indexOf(head)
    keyRoom.children.length = 0
    keyRoom.next = null
    keyRoom.secret = null
    keyRoom.parent = anchor
    anchor.children.splice(at, 1, keyRoom)
    return true
  }
  const dropSeg = (): boolean => {
    const spine = spineOf(entry)
    for (let i = spine.length - 2; i >= 1; i--) {
      const s = spine[i]
      if (!s || !segs.includes(s) || s.children.length > 0 || s === rest || s === merchant || s === lockFrom) continue
      const p = s.parent
      const nx = s.next
      if (!p || !nx) continue
      p.next = nx
      nx.parent = p
      segs.splice(segs.indexOf(s), 1)
      return true
    }
    return false
  }
  while (roomCount() > floor.roomsMax) {
    if (!cutLastBranch() && !shortenKeyBranch() && !dropSeg()) break
  }
  while (roomCount() < floor.roomsMin) {
    // A boss floor's Merchant stays the room just before the Anteroom (G11): a new Seg goes in before the Merchant.
    const tail = anteroom && merchant && merchant.next === anteroom ? merchant : (anteroom ?? exit)
    const before = tail.parent
    if (!before) break
    const seg = newNode(ctx, rollRoom(ctx, rng, 2))
    if (seg.kind === 'rest' || seg.kind === 'merchant') seg.kind = 'fight'
    before.next = seg
    seg.parent = before
    seg.next = tail
    tail.parent = seg
    segs.push(seg)
  }

  // G13: a Secret on a random Room with a free socket, never gating and never as far as the exit (07 §2.6).
  let secret: Node | null = null
  const secretChance = overrides?.secretChance ?? floor.secretChance ?? knobs.secretChance
  if (rng.pct(secretChance)) {
    const hops = hopsOf(entry)
    const exitDepth = hops.get(exit) ?? 0
    const hostsForSecret = walk(entry).filter(
      (n) =>
        n !== entry &&
        n !== exit &&
        n !== anteroom &&
        (hops.get(n) ?? 0) <= exitDepth - 2 &&
        (ctx.capacity.get(n.kind) ?? 0) >= degree(n) + 1,
    )
    if (hostsForSecret.length > 0) {
      const host = rng.pick(hostsForSecret)
      secret = newNode(ctx, 'secret')
      host.secret = secret
      secret.parent = host
    }
  }

  // G15: the exit is the unique farthest room. Branches and the Secret are bounded above, so this is a guard:
  // anything that still reaches the exit's hop count is cut (the Boss keeps its Anteroom, the lock its Key when
  // it can; a cut Key drops the lock).
  for (let pass = 0; pass < 8; pass++) {
    const hops = hopsOf(entry)
    const exitDepth = hops.get(exit) ?? 0
    const bad = walk(entry).filter((n) => n !== exit && !onSpineNow(n, entry) && (hops.get(n) ?? 0) >= exitDepth)
    if (bad.length === 0) break
    for (const n of bad) {
      if (!n.parent) continue
      if (subtreeHasKey(n)) {
        keyRoom = null
        lockFrom = null
      }
      if (n === secret) secret = null
      detachSide(n)
    }
  }

  return finish(entry, exit, anteroom, rest, merchant, keyRoom, lockFrom, secret)
}

function onSpineNow(n: Node, entry: Node): boolean {
  for (let s: Node | null = entry; s; s = s.next) if (s === n) return true
  return false
}

function finish(
  entry: Node,
  exit: Node,
  anteroom: Node | null,
  rest: Node | null,
  merchant: Node | null,
  keyRoom: Node | null,
  lockFrom: Node | null,
  secret: Node | null,
): Graph {
  return { entry, exit, anteroom, rest, merchant, keyRoom, lockFrom, secret, order: walk(entry) }
}

// ─── G14: encounters ─────────────────────────────────────────────────────────────────────────────────────────

function assignEncounters(input: GeneratorInput, g: GrammarNumbers, graph: Graph, rng: Rng): Map<Node, string | null> {
  const out = new Map<Node, string | null>()
  const pick = input.pickEncounter
  const fightRooms: { node: Node; index: number }[] = []
  graph.order.forEach((node, index) => {
    if (node.kind === 'fight' || node.kind === 'elite') fightRooms.push({ node, index })
  })
  if (!pick) return out

  const draw = (index: number, prev: string | null, avoid: readonly (string | null)[]): string | null => {
    let id: string | null = null
    for (let tries = 0; tries < 8; tries++) {
      id = pick({ roomIndex: index, previousEncounterId: prev, rng })
      if (id === null || !avoid.includes(id)) return id
    }
    return id
  }

  let prev: string | null = null
  for (const { node, index } of fightRooms) {
    const id = draw(index, prev, [prev])
    out.set(node, id)
    prev = id
  }

  const meets = input.meetsRoleMix ?? (() => true)
  const ids = (): string[] => fightRooms.map((f) => out.get(f.node) ?? null).filter((id): id is string => id !== null)
  const lastFightAt = fightRooms.map((f) => f.node.kind).lastIndexOf('fight')
  for (let attempt = 0; ; attempt++) {
    if (meets(ids())) break
    if (attempt >= g.roleMixRerolls || lastFightAt < 0) break
    const target = fightRooms[lastFightAt]
    if (!target) break
    const before = fightRooms[lastFightAt - 1]
    const after = fightRooms[lastFightAt + 1]
    const prevId = before ? (out.get(before.node) ?? null) : null
    const nextId = after ? (out.get(after.node) ?? null) : null
    out.set(target.node, draw(target.index, prevId, [prevId, nextId]))
  }
  return out
}

// ─── Templates and layout ────────────────────────────────────────────────────────────────────────────────────

interface ShapeDoor {
  readonly side: DoorSide
  readonly dx: number
  readonly dy: number
  readonly offset: number
}

/** A template in one rotation: its footprint and doors in grid space, relative to the top-left origin. */
interface Shape {
  readonly tpl: TemplateSpec
  readonly rotation: Rotation
  /** Footprint + doors, independent of the template id: identical geometry is tried once per spot. */
  readonly geometry: string
  readonly w: number
  readonly h: number
  readonly doors: readonly ShapeDoor[]
}

function shapesOf(tpl: TemplateSpec): Shape[] {
  let w = Math.max(1, Math.trunc(tpl.footprint.w))
  let h = Math.max(1, Math.trunc(tpl.footprint.h))
  let doors: { side: DoorSide; x: number; y: number }[] = []
  for (const d of tpl.doors) {
    if (!isSide(d.side)) continue
    const o = Math.max(0, Math.trunc(d.offset))
    const along = d.side === 'north' || d.side === 'south' ? Math.min(o, w - 1) : Math.min(o, h - 1)
    if (d.side === 'north') doors.push({ side: d.side, x: along, y: 0 })
    else if (d.side === 'south') doors.push({ side: d.side, x: along, y: h - 1 })
    else if (d.side === 'west') doors.push({ side: d.side, x: 0, y: along })
    else doors.push({ side: d.side, x: w - 1, y: along })
  }
  const out: Shape[] = []
  const seen = new Set<string>()
  const rotations: readonly Rotation[] = [0, 90, 180, 270]
  for (const rotation of rotations) {
    if (rotation !== 0) {
      // 90° clockwise: (x, y) in a w×h box → (h − 1 − y, x) in an h×w box; sides advance N→E→S→W.
      const nh = w
      doors = doors.map((d) => ({ side: SIDES[(SIDES.indexOf(d.side) + 1) % 4] ?? d.side, x: h - 1 - d.y, y: d.x }))
      w = h
      h = nh
    }
    const shaped: ShapeDoor[] = doors.map((d) => ({
      side: d.side,
      dx: d.x,
      dy: d.y,
      offset: d.side === 'north' || d.side === 'south' ? d.x : d.y,
    }))
    const key = `${w}x${h}:` + shaped.map((d) => `${d.side}${d.dx},${d.dy}`).sort().join(';')
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ tpl, rotation, geometry: key, w, h, doors: shaped })
  }
  return out
}

interface Placement {
  readonly node: Node
  readonly shape: Shape
  readonly ox: number
  readonly oy: number
  /** Per shape door: the room joined through it, or null for a sealed socket. */
  readonly use: (Node | null)[]
  /** The seeded order in which this room offers its sockets to its children. */
  readonly doorOrder: readonly number[]
  readonly parentPl: Placement | null
  readonly parentDoor: number
}

interface LayoutContext {
  readonly zoneTemplates: readonly TemplateSpec[]
  readonly shapes: ReadonlyMap<string, readonly Shape[]>
  readonly grid: { readonly w: number; readonly h: number }
  readonly budget: number
  /** Placements tried per child per level before the failure is handed back up. */
  readonly alternatives: number
  readonly relaxed: boolean
  /** The pinned boss room (FloorSpec.bossTemplateId), when the zone has it. */
  readonly bossTemplateId: string | null
}

/** A template may host a node: its kinds, and the pinned boss room for the Boss (07 §2.10 "Boss templates are fixed"). */
function hostsNode(ctx: LayoutContext, t: TemplateSpec, node: Node): boolean {
  if (!t.kinds.includes(node.kind)) return false
  return node.kind !== 'boss' || ctx.bossTemplateId === null || t.id === ctx.bossTemplateId
}

function layoutFloor(ctx: LayoutContext, graph: Graph, rng: Rng): Map<Node, Placement> | null {
  const { w, h } = ctx.grid
  const occ = new Array<number>(w * h).fill(0)
  const placed: Placement[] = []
  const byNode = new Map<Node, Placement>()
  const useCount = new Map<string, number>()
  let placements = 0
  let exhausted = false

  // The least cells a room can take (its smallest hosting template) and the sum over a subtree: a parent door whose
  // free region cannot hold the child's subtree is skipped before anything is placed behind it.
  const minCells = new Map<Node, number>()
  const subtreeCells = new Map<Node, number>()
  for (const node of graph.order) {
    const deg = degree(node)
    let least = Infinity
    for (const t of ctx.zoneTemplates) {
      if (hostsNode(ctx, t, node) && t.doors.length >= deg) least = Math.min(least, t.footprint.w * t.footprint.h)
    }
    minCells.set(node, Number.isFinite(least) ? Math.max(1, least) : 1)
  }
  for (let i = graph.order.length - 1; i >= 0; i--) {
    const node = graph.order[i]
    if (!node) continue
    let sum = minCells.get(node) ?? 1
    if (node.next) sum += subtreeCells.get(node.next) ?? 1
    if (node.secret) sum += subtreeCells.get(node.secret) ?? 1
    for (const c of node.children) sum += subtreeCells.get(c) ?? 1
    subtreeCells.set(node, sum)
  }
  const regionStack: number[] = []
  const regionSeen = new Array<number>(w * h).fill(0)
  let regionStamp = 0
  /** Free in-bounds cells among the eight neighbours of (x, y). */
  const openness = (x: number, y: number): number => {
    let count = 0
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && !occ[ny * w + nx]) count++
      }
    }
    return count
  }
  /** Free cells connected to (x, y), counted up to `cap`. */
  const regionSize = (x: number, y: number, cap: number): number => {
    if (x < 0 || y < 0 || x >= w || y >= h || occ[y * w + x]) return 0
    regionStamp++
    regionStack.length = 0
    regionStack.push(y * w + x)
    regionSeen[y * w + x] = regionStamp
    let count = 0
    while (regionStack.length > 0 && count < cap) {
      const idx = regionStack.pop() as number
      count++
      const cx = idx % w
      const cy = (idx - cx) / w
      for (const side of SIDES) {
        const nx = cx + DX[side]
        const ny = cy + DY[side]
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const ni = ny * w + nx
        if (occ[ni] || regionSeen[ni] === regionStamp) continue
        regionSeen[ni] = regionStamp
        regionStack.push(ni)
      }
    }
    return count
  }

  const fits = (shape: Shape, ox: number, oy: number): boolean => {
    if (ox < 0 || oy < 0 || ox + shape.w > w || oy + shape.h > h) return false
    for (let y = 0; y < shape.h; y++) for (let x = 0; x < shape.w; x++) if (occ[(oy + y) * w + ox + x]) return false
    return true
  }
  const place = (node: Node, shape: Shape, ox: number, oy: number, parentPl: Placement | null, parentDoor: number, childDoor: number): void => {
    for (let y = 0; y < shape.h; y++) for (let x = 0; x < shape.w; x++) occ[(oy + y) * w + ox + x] = 1
    const use = new Array<Node | null>(shape.doors.length).fill(null)
    if (parentPl) {
      use[childDoor] = parentPl.node
      parentPl.use[parentDoor] = node
    }
    const order = rng.shuffle(shape.doors.map((_, i) => i))
    const pl: Placement = { node, shape, ox, oy, use, doorOrder: order, parentPl, parentDoor }
    placed.push(pl)
    byNode.set(node, pl)
    useCount.set(shape.tpl.id, (useCount.get(shape.tpl.id) ?? 0) + 1)
    placements++
    if (placements > ctx.budget) exhausted = true
  }
  const unplaceTo = (mark: number): void => {
    while (placed.length > mark) {
      const pl = placed.pop()
      if (!pl) break
      for (let y = 0; y < pl.shape.h; y++) for (let x = 0; x < pl.shape.w; x++) occ[(pl.oy + y) * w + pl.ox + x] = 0
      byNode.delete(pl.node)
      useCount.set(pl.shape.tpl.id, (useCount.get(pl.shape.tpl.id) ?? 1) - 1)
      if (pl.parentPl) pl.parentPl.use[pl.parentDoor] = null
    }
  }

  /** §2.10 template selection: hosts the kind, sockets ≥ degree, weight 10 (−6 if used in the previous two rooms),
   *  never a third use; a seeded weighted order so backtracking falls through to the next-best pick. */
  const candidates = (node: Node): TemplateSpec[] => {
    const deg = degree(node)
    const recent = placed.slice(-2).map((p) => p.shape.tpl.id)
    const pool = ctx.zoneTemplates.filter(
      (t) => hostsNode(ctx, t, node) && t.doors.length >= deg && (ctx.relaxed || (useCount.get(t.id) ?? 0) < 2),
    )
    const out: TemplateSpec[] = []
    const left = pool.slice()
    while (left.length > 0) {
      const t = rng.weighted(left, (c) => 10 - (recent.includes(c.id) ? 6 : 0))
      out.push(t)
      left.splice(left.indexOf(t), 1)
    }
    return out
  }
  const shapes = (t: TemplateSpec): readonly Shape[] => ctx.shapes.get(t.id) ?? []
  /** Layout order per room: the Spine first (the long path claims the grid), then Branches and the Secret. */
  const kidsOf = (n: Node): Node[] => {
    const kids: Node[] = []
    if (n.next) kids.push(n.next)
    kids.push(...n.children)
    if (n.secret) kids.push(n.secret)
    return kids
  }

  const placeKids = (node: Node, kids: readonly Node[], i: number): boolean => {
    if (exhausted) return false
    const child = kids[i]
    if (!child) return true
    const pl = byNode.get(node)
    if (!pl) return false
    const tpls = candidates(child)
    const need = subtreeCells.get(child) ?? 1
    // Free sockets in seeded order, the roomiest first; a socket whose free region cannot hold the subtree is skipped.
    const doors: { pd: number; region: number; open: number }[] = []
    for (const pd of pl.doorOrder) {
      if (pl.use[pd] !== null) continue
      const door = pl.shape.doors[pd]
      if (!door) continue
      const nx = pl.ox + door.dx + DX[door.side]
      const ny = pl.oy + door.dy + DY[door.side]
      const region = regionSize(nx, ny, need + 8)
      if (region >= need) doors.push({ pd, region, open: openness(nx, ny) })
    }
    // Roomiest region first, then the most open neighbourhood (keeps the Spine off the walls), then the seeded order.
    doors.sort((a, b) => b.region - a.region || b.open - a.open)
    const tried = new Set<string>()
    // Alternatives per child are capped so a failure deep in the tree climbs back to the early choices instead of
    // spending the whole budget on the tail (limited discrepancy; the budget stays the global cut-off).
    let attempts = 0
    for (const { pd } of doors) {
      const door = pl.shape.doors[pd]
      if (!door) continue
      const nx = pl.ox + door.dx + DX[door.side]
      const ny = pl.oy + door.dy + DY[door.side]
      const want = OPPOSITE[door.side]
      for (const tpl of tpls) {
        for (const shape of rng.shuffle(shapes(tpl))) {
          for (let cd = 0; cd < shape.doors.length; cd++) {
            const d = shape.doors[cd]
            if (!d || d.side !== want) continue
            const ox = nx - d.dx
            const oy = ny - d.dy
            if (!fits(shape, ox, oy)) continue
            const spot = `${shape.geometry}@${ox},${oy}/${cd}`
            if (tried.has(spot)) continue
            tried.add(spot)
            if (attempts >= ctx.alternatives) return false
            attempts++
            const mark = placed.length
            place(child, shape, ox, oy, pl, pd, cd)
            if (exhausted) return false
            if (placeKids(child, kidsOf(child), 0) && placeKids(node, kids, i + 1)) return true
            if (exhausted) return false
            unplaceTo(mark)
          }
        }
      }
    }
    return false
  }

  // The Entry on a seeded border cell.
  const border: Cell[] = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border.push({ x, y })
  for (const cell of rng.shuffle(border)) {
    for (const tpl of candidates(graph.entry)) {
      for (const shape of rng.shuffle(shapes(tpl))) {
        if (!fits(shape, cell.x, cell.y)) continue
        place(graph.entry, shape, cell.x, cell.y, null, -1, -1)
        if (exhausted) return null
        if (placeKids(graph.entry, kidsOf(graph.entry), 0)) return byNode
        if (exhausted) return null
        unplaceTo(0)
      }
    }
  }
  return null
}

// ─── Assembly ────────────────────────────────────────────────────────────────────────────────────────────────

const SIDE_ORDER: Readonly<Record<DoorSide, number>> = { north: 0, east: 1, south: 2, west: 3 }

function assemble(
  input: GeneratorInput,
  graph: Graph,
  placements: ReadonlyMap<Node, Placement>,
  encounters: ReadonlyMap<Node, string | null>,
  seed: readonly [number, number],
  retries: number,
  decor: Rng,
): FloorGraph {
  const ids = new Map<Node, string>()
  graph.order.forEach((n, i) => ids.set(n, `r${i}`))
  const idOf = (n: Node): string => ids.get(n) ?? '?'
  const hops = hopsOf(graph.entry)
  const spine = new Set(spineOf(graph.entry))
  const lockTo = graph.lockFrom?.next ?? null
  const isLocked = (a: Node, b: Node): boolean =>
    graph.lockFrom !== null && lockTo !== null && ((a === graph.lockFrom && b === lockTo) || (b === graph.lockFrom && a === lockTo))

  const rooms: FloorRoom[] = graph.order.map((node) => {
    const pl = placements.get(node)
    if (!pl) throw new Error('generateFloor: a room was not placed')
    const cells: Cell[] = []
    for (let y = 0; y < pl.shape.h; y++) for (let x = 0; x < pl.shape.w; x++) cells.push({ x: pl.ox + x, y: pl.oy + y })
    const doors: FloorDoor[] = []
    pl.shape.doors.forEach((d, i) => {
      const other = pl.use[i]
      if (!other) return
      doors.push({
        to: idOf(other),
        side: d.side,
        offset: d.offset,
        locked: isLocked(node, other),
        secret: node.kind === 'secret' || other.kind === 'secret',
      })
    })
    doors.sort((a, b) => SIDE_ORDER[a.side] - SIDE_ORDER[b.side] || a.offset - b.offset)
    let depth = 0
    for (let n: Node | null = node; n && !spine.has(n); n = n.parent) depth++
    const encounterId = node.kind === 'boss' ? input.floor.bossId : (encounters.get(node) ?? null)
    return {
      id: idOf(node),
      kind: node.kind,
      templateId: pl.shape.tpl.id,
      rotation: pl.shape.rotation,
      cells,
      doors,
      hop: hops.get(node) ?? 0,
      onSpine: spine.has(node),
      branchDepth: depth,
      encounterId,
      hasKey: node.hasKey,
      variation: decor.int(101),
    }
  })

  let forks = 0
  for (const s of spine) if (s.children.length > 0) forks++

  return {
    floor: input.floor.floor,
    kind: input.kind,
    seed: [seed[0], seed[1]],
    grid: { w: input.knobs.grid.w, h: input.knobs.grid.h },
    rooms,
    entryId: idOf(graph.entry),
    exitId: idOf(graph.exit),
    restId: graph.rest ? idOf(graph.rest) : null,
    merchantId: graph.merchant ? idOf(graph.merchant) : null,
    keyRoomId: graph.keyRoom ? idOf(graph.keyRoom) : null,
    lockedEdge: graph.lockFrom && lockTo ? { from: idOf(graph.lockFrom), to: idOf(lockTo) } : null,
    secretId: graph.secret ? idOf(graph.secret) : null,
    forks,
    retries,
    hash: hashFloor(input.floor.floor, rooms),
  }
}

/** FNV-1a (hashString) folded over the canonical room list; compared across clients at floor start (07 §8.1 #9). */
export function hashFloor(floor: number, rooms: readonly FloorRoom[]): number {
  let hsh = hashString(`floor:${floor}`)
  for (const r of rooms) {
    const cells = r.cells.map((c) => `${c.x},${c.y}`).join(';')
    const doors = r.doors.map((d) => `${d.to}:${d.side}:${d.offset}${d.locked ? '#' : ''}${d.secret ? '?' : ''}`).join(';')
    hsh = hashString(`${r.id}|${r.kind}|${r.templateId}|${r.rotation}|${cells}|${doors}|${r.hasKey ? 1 : 0}`, hsh)
  }
  return hsh >>> 0
}

// ─── Entry point ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A fresh xoshiro128** stream's first output is a function of state word b alone, which seedState derives from the
 * seed's hi word only; two discarded draws mix all four words so the first decision depends on the whole seed.
 */
function warm(rng: Rng): Rng {
  rng.next()
  rng.next()
  return rng
}

function seedPair(seed: readonly [number, number] | RngState): [number, number] {
  if (Array.isArray(seed)) return [(seed[0] ?? 0) >>> 0, (seed[1] ?? 0) >>> 0]
  const r = new Rng(seed as RngState)
  return [r.next(), r.next()]
}

/** G9's weights with the Elite override taking its difference out of Fight. */
function resolveWeights(knobs: GeneratorKnobs, overrides: GeneratorOverrides | undefined): Map<RoomKind, number> {
  const weights = new Map<RoomKind, number>()
  for (const k of ROLLED) weights.set(k, Math.max(0, Math.trunc(knobs.roomWeights[k] ?? 0)))
  if (overrides?.eliteRoomWeight !== undefined) {
    const elite = Math.max(0, Math.trunc(overrides.eliteRoomWeight))
    const diff = elite - (weights.get('elite') ?? 0)
    weights.set('elite', elite)
    weights.set('fight', Math.max(0, (weights.get('fight') ?? 0) - diff))
  }
  return weights
}

/**
 * Generates one floor: the mission graph of §2.10 laid out on the knobs' grid with the zone's templates.
 * Throws only when the zone's templates cannot host the floor at all (after `maxRetries` seed bumps).
 */
export function generateFloor(input: GeneratorInput): FloorGraph {
  const g: GrammarNumbers = { ...DEFAULT_GRAMMAR, ...input.grammar }
  const first = seedPair(input.seed)
  const zoneTemplates0 = input.templates.filter((t) => t.zoneId === input.floor.zoneId)
  const zoneTemplates = zoneTemplates0.length > 0 ? zoneTemplates0 : input.templates
  const capacity = new Map<string, number>()
  const shapes = new Map<string, readonly Shape[]>()
  for (const t of zoneTemplates) {
    shapes.set(t.id, shapesOf(t))
    for (const k of t.kinds) capacity.set(k, Math.max(capacity.get(k) ?? 0, t.doors.length))
  }
  const weights = resolveWeights(input.knobs, input.overrides)
  const grid = { w: Math.max(1, Math.trunc(input.knobs.grid.w)), h: Math.max(1, Math.trunc(input.knobs.grid.h)) }

  let lo = first[1]
  for (let retries = 0; ; retries++) {
    const rng = Rng.fromSeed(first[0], lo)
    const graphRng = warm(rng.fork('graph'))
    const encounterRng = warm(rng.fork('encounters'))
    const layoutRng = warm(rng.fork('layout'))
    const decorRng = warm(rng.fork('decor'))

    const ctx: BuildContext = { input, g, capacity, weights, serial: 0 }
    const graph = buildGraph(ctx, graphRng)
    const layout = layoutFloor(
      {
        zoneTemplates,
        shapes,
        grid,
        budget: g.placementBudget,
        alternatives: Math.max(1, g.placementAlternatives),
        relaxed: retries >= g.relaxAfterRetries,
        bossTemplateId: input.floor.bossTemplateId && zoneTemplates.some((t) => t.id === input.floor.bossTemplateId) ? input.floor.bossTemplateId : null,
      },
      graph,
      layoutRng,
    )
    if (layout) {
      const encounters = assignEncounters(input, g, graph, encounterRng)
      return assemble(input, graph, layout, encounters, first, retries, decorRng)
    }
    if (retries >= g.maxRetries) {
      throw new Error(
        `generateFloor: no layout for floor ${input.floor.floor} (zone ${input.floor.zoneId}) from seed ${first[0]},${first[1]} after ${retries} retries`,
      )
    }
    lo = (lo + 1) >>> 0
  }
}
