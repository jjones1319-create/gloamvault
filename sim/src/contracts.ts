import { compareIds, type Content } from './content.ts'
import type { DelveEvent, DelveState } from './delve-types.ts'
import { bandRows } from './grades.ts'
import { Rng, seedFor } from './rng.ts'
import { roundHalfUp } from './stats.ts'
import type { Tuning } from './tuning.ts'
import type { ContractDef, DungeonDef } from './types/content.ts'
import type { Difficulty } from './types/enums.ts'

/**
 * The Quest Board (07 §7, 03 §8.2; Phase 7). Three dailies (they turn over at the reset hour, 04:00 local) and one
 * weekly (Monday), drawn from the contracts the player can do now and templated with the player's band: a daily's
 * gold is R at the band the board was posted at. Progress counts in any party on any difficulty: when a delve comes
 * home, `delveContractProgress` reads its log — the fights' kills, the stairs reached and their light, the chests
 * opened and theirs, the curios used, the parts sold — and its boss arenas (C2's `stats.bossArenas`). A claim pays
 * gold, chest keys (at most 3 Standard and 1 Grand a week), items and a chest. The day and week come from the
 * client's clock (`boardClock`); the sim never reads one.
 */

/** The conditions the sim checks by name (lint rule 56 checks every contract's against this list). */
export const CONTRACT_CONDITIONS = ['zone-hunter', 'at-stairs', 'chests-opened-one-floor', 'parts-sold-one-delve', 'no-curio-opened', 'tide-below-step-4'] as const
export type ContractCondition = (typeof CONTRACT_CONDITIONS)[number]

export interface ContractSlot {
  contractId: string
  /** The band the board filled in when it posted the contract (07 §7: templated with the player's band; 1 = F). */
  band: number
  progress: number
  /** What `progress` must reach: the target count, or 1. */
  goal: number
  claimed: boolean
}

/** The board as the profile keeps it (Profile.contracts, optional; Phase 7). */
export interface ContractBoard {
  /** The day the dailies were posted for (`boardClock`). */
  day: number
  /** The week the weekly was posted for. */
  week: number
  dailies: ContractSlot[]
  weekly: ContractSlot | null
  /** The week the key counts belong to, and the keys claims have paid in it (07 §7: 3 Standard, 1 Grand). */
  keysWeek: number
  keysStandard: number
  keysGrand: number
}

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
/** 1970-01-01 was a Thursday (0 Sunday … 6 Saturday). */
const EPOCH_WEEKDAY = 4

/**
 * The board's day and week from the client's local time: `localMs` is the wall clock read as UTC milliseconds
 * (Date.now() − the time-zone offset). A day starts at the reset hour; a week on `weekStartsOn` at the reset hour.
 */
export function boardClock(t: Tuning, localMs: number): { day: number; week: number } {
  const day = Math.floor((localMs - t.contracts.resetHour * HOUR_MS) / DAY_MS)
  const offset = (((EPOCH_WEEKDAY - t.contracts.weekStartsOn.value) % 7) + 7) % 7
  return { day, week: Math.floor((day + offset) / 7) }
}

/** Milliseconds until the next daily board and the next weekly, for the board's "new contracts in …" line. */
export function boardTurnsOver(t: Tuning, localMs: number): { dailyMs: number; weeklyMs: number } {
  const { day, week } = boardClock(t, localMs)
  const nextDayAt = (day + 1) * DAY_MS + t.contracts.resetHour * HOUR_MS
  const offset = (((EPOCH_WEEKDAY - t.contracts.weekStartsOn.value) % 7) + 7) % 7
  const nextWeekAt = ((week + 1) * 7 - offset) * DAY_MS + t.contracts.resetHour * HOUR_MS
  return { dailyMs: Math.max(0, nextDayAt - localMs), weeklyMs: Math.max(0, nextWeekAt - localMs) }
}

/** The band index (1 = F) of a global floor (08's band table: tuning.json → bands.floors, sim/src/grades.ts bandRows). */
export function bandOfFloor(floor: number, t?: Tuning): number {
  const rows = bandRows(t)
  const i = rows.findIndex((b) => floor >= b.from && floor <= b.to)
  return i < 0 ? rows.length : i + 1
}

/** R at a band (03 §8.1). */
export function rForBand(band: number, t?: Tuning): number {
  const rows = bandRows(t)
  const row = rows[Math.max(1, Math.min(rows.length, Math.floor(band))) - 1]
  return row?.r ?? rows[0]?.r ?? 0
}

/** The player's band: the band of the deepest floor finished anywhere (a new save is band 1), as the town's R reads it. */
export function playerBand(deepest: Readonly<Record<string, number>>, t?: Tuning): number {
  return bandOfFloor(Math.max(1, ...Object.values(deepest)), t)
}

/** What progress must reach. */
export function contractGoal(k: ContractDef): number {
  return Math.max(1, k.target.count ?? 1)
}

/** What the board needs to know about the player to post contracts they can do (town.ts builds it from the profile). */
export interface BoardContext {
  band: number
  /** The floors the Waystone offers in a dungeon (empty for a dungeon not open yet). */
  openFloors(dungeonId: string): readonly number[]
  /** Is a preset open in that dungeon (07 §6.1)? */
  difficultyOpen(dungeonId: string, difficulty: Difficulty): boolean
}

function zoneFloors(dungeon: DungeonDef | undefined, zoneId: string | undefined): number[] | null {
  if (!dungeon || !zoneId) return null
  const z = dungeon.zones.find((x) => x.id === zoneId)
  if (!z) return []
  const out: number[] = []
  for (let f = z.floors.from; f <= z.floors.to; f++) out.push(f)
  return out
}

/** Can the player do this contract now: its dungeon, zone and boss reachable, its preset open, its hunter met somewhere? */
export function contractEligible(content: Content, k: ContractDef, ctx: BoardContext): boolean {
  const target = k.target
  const dungeonIds = target.dungeonId ? [target.dungeonId] : [...content.dungeons.keys()]
  return dungeonIds.some((dungeonId) => {
    const dungeon = content.dungeons.get(dungeonId)
    if (!dungeon) return false
    const open = new Set(ctx.openFloors(dungeonId))
    if (open.size === 0) return false
    const zf = zoneFloors(dungeon, target.zoneId)
    if (zf && !zf.some((f) => open.has(f))) return false
    if (target.floor !== undefined && !open.has(target.floor)) return false
    if (target.monsterId) {
      const bossFloor = dungeon.floors.find((f) => f.bossId === target.monsterId)
      if (bossFloor && !open.has(bossFloor.floor)) return false
      if (!bossFloor && !content.monsters.has(target.monsterId)) return false
    }
    if (target.difficultyMin && target.difficultyMin !== 'normal' && !ctx.difficultyOpen(dungeonId, target.difficultyMin)) return false
    if (target.curioId && !dungeon.curios.some((c) => c.id === target.curioId)) return false
    if (target.condition === 'zone-hunter') {
      const hunted = dungeon.zones.some((z) => z.hunterId !== null && dungeon.floors.some((f) => f.zoneId === z.id && open.has(f.floor)))
      if (!hunted) return false
    }
    return true
  })
}

function slotFor(k: ContractDef, band: number): ContractSlot {
  return { contractId: k.id, band: k.band ?? band, progress: 0, goal: contractGoal(k), claimed: false }
}

/**
 * Posts (or keeps) the board for a day and a week: the dailies are redrawn when the day changes, the weekly and the
 * key counts when the week does. Dailies are three of the eligible dailies drawn from the day's seed (everyone sees
 * the same draw from the same choices); the weekly turns through the eligible weeklies by the week's number.
 */
export function syncBoard(content: Content, board: ContractBoard | null | undefined, ctx: BoardContext, clock: { day: number; week: number }): ContractBoard {
  const t = content.tuning
  if (board && board.day === clock.day && board.week === clock.week && board.keysWeek === clock.week) return board
  const all = [...content.contracts.values()].sort((a, b) => compareIds(a.id, b.id))
  const eligible = all.filter((k) => contractEligible(content, k, ctx))
  let next: ContractBoard = board ? { ...board } : { day: clock.day - 1, week: clock.week - 1, dailies: [], weekly: null, keysWeek: clock.week, keysStandard: 0, keysGrand: 0 }
  if (!board || board.day !== clock.day) {
    const pool = eligible.filter((k) => k.cadence === 'daily')
    const rng = Rng.fromSeed(...seedFor('quest-board-daily', clock.day))
    const picked: ContractDef[] = []
    while (picked.length < Math.min(t.contracts.dailies, pool.length)) {
      const k = rng.pick(pool)
      if (!picked.includes(k)) picked.push(k)
    }
    next = { ...next, day: clock.day, dailies: picked.map((k) => slotFor(k, ctx.band)) }
  }
  if (!board || board.week !== clock.week) {
    const weeklies = eligible.filter((k) => k.cadence === 'weekly').sort((a, b) => (a.band ?? 0) - (b.band ?? 0) || compareIds(a.id, b.id))
    const k = weeklies.length > 0 && t.contracts.weeklies > 0 ? weeklies[((clock.week % weeklies.length) + weeklies.length) % weeklies.length]! : null
    next = { ...next, week: clock.week, weekly: k ? slotFor(k, ctx.band) : null }
  }
  if (next.keysWeek !== clock.week) next = { ...next, keysWeek: clock.week, keysStandard: 0, keysGrand: 0 }
  return next
}

/* ---------- progress from a delve ---------- */

const DIFFICULTY_RANK: Readonly<Record<Difficulty, number>> = { normal: 0, hard: 1, dread: 2 }

function eventsOf(state: DelveState, kind: string): DelveEvent[] {
  return state.log.filter((e) => e.kind === kind)
}

function inRange(floor: number, floors: number[] | null, only: number | undefined): boolean {
  return (floors === null || floors.includes(floor)) && (only === undefined || floor === only)
}

/**
 * What one delve did toward a contract: `add` to a running count (kills, floors cleared, stairs reached) or `best`, the
 * best single-delve (or single-floor) figure for the conditions 07 §7 writes "in one delve" or "on one floor".
 */
export function contractContribution(content: Content, k: ContractDef, band: number, state: DelveState): { add: number; best: number } {
  const none = { add: 0, best: 0 }
  const target = k.target
  if (target.dungeonId && target.dungeonId !== state.options.dungeonId) return none
  if (target.difficultyMin && DIFFICULTY_RANK[state.options.difficulty] < DIFFICULTY_RANK[target.difficultyMin]) return none
  if (target.partyMin && state.heroes.length < target.partyMin) return none
  const dungeon = content.dungeons.get(state.options.dungeonId)
  const floors = zoneFloors(dungeon, target.zoneId)
  const lightOk = (light: number) => (target.lightMin === undefined || light >= target.lightMin) && (target.lightMax === undefined || light <= target.lightMax)
  const wiped = state.phase.kind === 'over' && state.phase.outcome === 'wiped'
  switch (k.kind) {
    case 'kill':
    case 'noWipe': {
      if (target.condition === 'tide-below-step-4') {
        // C2's arena rows (stats.bossArenas): the boss beaten with the tide never past step 3.
        const rows = state.stats.bossArenas ?? []
        return { add: rows.filter((r) => r.boss === target.monsterId && r.outcome === 'victory' && r.tideMax < 4).length, best: 0 }
      }
      let n = 0
      for (const e of eventsOf(state, 'kills')) {
        if (!inRange(e.floor, floors, target.floor)) continue
        if (k.kind === 'noWipe' && Number(e.data?.fallen ?? 0) > 0) continue
        for (const id of String(e.data?.monsters ?? '').split(',')) {
          if (!id) continue
          const def = content.monsters.get(id)
          const counts =
            (target.monsterIds?.includes(id) ?? false) ||
            target.monsterId === id ||
            (target.familyId !== undefined && def?.familyId === target.familyId) ||
            (target.condition === 'zone-hunter' && def?.role === 'hunter')
          if (counts) n++
        }
      }
      return { add: n, best: 0 }
    }
    case 'light': {
      if (target.condition === 'chests-opened-one-floor') {
        const perFloor = new Map<number, number>()
        for (const e of eventsOf(state, 'chest')) {
          if (!inRange(e.floor, floors, target.floor) || !lightOk(Number(e.data?.light ?? 100))) continue
          perFloor.set(e.floor, (perFloor.get(e.floor) ?? 0) + 1)
        }
        return { add: 0, best: Math.max(0, ...perFloor.values()) }
      }
      // 'at-stairs' (Lights On): a floor's way down reached in the light, on a floor of the board's band or deeper.
      const n = eventsOf(state, 'stairs').filter((e) => inRange(e.floor, floors, target.floor) && bandOfFloor(e.floor, content.tuning) >= band && lightOk(Number(e.data?.light ?? 0))).length
      return { add: n, best: 0 }
    }
    case 'clear': {
      let n = 0
      for (const e of eventsOf(state, 'stairs')) {
        if (!inRange(e.floor, floors, target.floor)) continue
        if (target.condition === 'no-curio-opened') {
          // C1's curio events: an opening is any use of the curio but its Leave choice ('nothing').
          const opened = state.log.some((c) => c.kind === 'curio' && c.floor === e.floor && c.data?.curio === target.curioId && c.data?.outcome !== 'nothing')
          if (opened) continue
        }
        n++
      }
      return { add: n, best: 0 }
    }
    case 'collect': {
      if (target.condition === 'parts-sold-one-delve') return { add: 0, best: eventsOf(state, 'sell').reduce((s, e) => s + Number(e.data?.quantity ?? 0), 0) }
      if (target.goldR !== undefined) {
        // Bank Run: the gold this delve itself brought home (the purse carried in does not count; a wipe brings none).
        const home = wiped ? 0 : Math.max(0, state.gold - Math.max(0, state.options.purseIn ?? 0))
        return { add: 0, best: home >= roundHalfUp(target.goldR * rForBand(band, content.tuning)) ? 1 : 0 }
      }
      return none
    }
  }
}

/** The board after a delve came home: each open contract's progress moved by what the delve did. */
export function delveContractProgress(content: Content, board: ContractBoard, state: DelveState): ContractBoard {
  const step = (slot: ContractSlot | null): ContractSlot | null => {
    if (!slot || slot.claimed || slot.progress >= slot.goal) return slot
    const k = content.contracts.get(slot.contractId)
    if (!k) return slot
    const c = contractContribution(content, k, slot.band, state)
    const progress = Math.min(slot.goal, Math.max(slot.progress + c.add, c.best > 0 ? Math.max(slot.progress, c.best) : slot.progress))
    return progress === slot.progress ? slot : { ...slot, progress }
  }
  return { ...board, dailies: board.dailies.map((s) => step(s)!), weekly: step(board.weekly) }
}

/* ---------- claims ---------- */

export interface ContractPayout {
  gold: number
  /** Keys paid (after the weekly cap) and keys the cap held back. */
  keys: { standard: number; grand: number }
  capped: { standard: number; grand: number }
  items: { itemId: string; amount: number }[]
  chestId: string | null
}

/** What claiming a finished contract pays now: gold at its band, keys up to the week's caps, items, the chest. */
export function contractPayout(content: Content, board: ContractBoard, slot: ContractSlot): ContractPayout {
  const t = content.tuning
  const k = content.contracts.get(slot.contractId)
  if (!k) return { gold: 0, keys: { standard: 0, grand: 0 }, capped: { standard: 0, grand: 0 }, items: [], chestId: null }
  const want = { standard: 0, grand: 0 }
  for (const key of k.reward.keys) want[key.kind] += key.amount
  const room = { standard: Math.max(0, t.contracts.keyCapPerWeek.standard - board.keysStandard), grand: Math.max(0, t.contracts.keyCapPerWeek.grand - board.keysGrand) }
  const keys = { standard: Math.min(want.standard, room.standard), grand: Math.min(want.grand, room.grand) }
  return {
    gold: roundHalfUp(k.reward.goldR * rForBand(slot.band, t)),
    keys,
    capped: { standard: want.standard - keys.standard, grand: want.grand - keys.grand },
    items: k.reward.items.map((i) => ({ itemId: i.itemId, amount: i.amount })),
    chestId: k.reward.chestId,
  }
}

/** The slot a claim names: a daily by index, or the weekly. */
export function boardSlot(board: ContractBoard, which: number | 'weekly'): ContractSlot | null {
  return which === 'weekly' ? board.weekly : (board.dailies[which] ?? null)
}

/** The board with a slot claimed and its keys counted against the week's caps. */
export function markClaimed(board: ContractBoard, which: number | 'weekly', payout: ContractPayout): ContractBoard {
  const done = (s: ContractSlot): ContractSlot => ({ ...s, claimed: true })
  return {
    ...board,
    dailies: which === 'weekly' ? board.dailies : board.dailies.map((s, i) => (i === which ? done(s) : s)),
    weekly: which === 'weekly' && board.weekly ? done(board.weekly) : board.weekly,
    keysStandard: board.keysStandard + payout.keys.standard,
    keysGrand: board.keysGrand + payout.keys.grand,
  }
}
