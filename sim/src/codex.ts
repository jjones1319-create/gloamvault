import type { DelveEvent } from './delve-types.ts'
import type { FightState } from './fight-types.ts'

/**
 * The codex (12 Phase 8; pass B): what the player has met and found, filled by play. Each fight of a delve leaves one
 * `codex` log line — the monsters that stood on the enemy side, the ones that fell, the attacks they used and the
 * tells they showed — and the town folds a finished delve's lines, with the materials it brought home, into the
 * profile's optional `codex` at settlement (town.ts settleDelve). Pure: the delve log is not part of the delve's hash,
 * so recording changes no replay.
 */

export interface CodexMonsterRecord {
  /** Individuals met in fights (a pack of three rats counts three). */
  seen: number
  /** Individuals killed (fled ones are not). */
  killed: number
  /** Attack ids seen used, first seen first. */
  attacks: string[]
  /** The tells seen (their two-word hints), first seen first. */
  tells: string[]
}

export interface CodexRecord {
  /** Monster id → what the player has seen of it. */
  monsters: Record<string, CodexMonsterRecord>
  /** Material and part item ids → units brought home from delves. */
  materials: Record<string, number>
}

/** The caps the save clamps to (client/src/save/profile.ts reads them too). */
export const CODEX_LIMITS = { attacksPerMonster: 24, tellsPerMonster: 16, tellLength: 60, count: 9_999_999 } as const

/** One fight's codex lines (the payload of a `codex` log event). */
export interface FightCodex {
  seen: Record<string, number>
  killed: Record<string, number>
  attacks: Record<string, string[]>
  tells: Record<string, string[]>
}

export function emptyCodex(): CodexRecord {
  return { monsters: {}, materials: {} }
}

function emptyFightCodex(): FightCodex {
  return { seen: {}, killed: {}, attacks: {}, tells: {} }
}

function addUnique(map: Record<string, string[]>, key: string, value: string, cap: number): void {
  const list = map[key] ?? (map[key] = [])
  if (!list.includes(value) && list.length < cap) list.push(value)
}

/**
 * What a fight showed: every enemy monster actor (adds and summons included) is seen, those gone without fleeing are
 * killed; an `action` line carrying `attackId` is an attack seen; a `tell` line is a tell seen — a boss arena's tell
 * that names no actor belongs to the boss (`data.boss`).
 */
export function fightCodex(fight: Pick<FightState, 'actors' | 'log'>): FightCodex {
  const out = emptyFightCodex()
  const monsterOf = new Map<string, string>()
  for (const a of fight.actors) {
    if (a.side !== 'enemy' || !a.monster) continue
    const id = a.monster.monsterId
    monsterOf.set(a.id, id)
    out.seen[id] = (out.seen[id] ?? 0) + 1
    if (a.gone && !a.fled) out.killed[id] = (out.killed[id] ?? 0) + 1
  }
  for (const e of fight.log) {
    const actorMonster = e.actorId ? monsterOf.get(e.actorId) : undefined
    if (e.kind === 'action' && actorMonster && typeof e.data?.attackId === 'string') addUnique(out.attacks, actorMonster, e.data.attackId, CODEX_LIMITS.attacksPerMonster)
    if (e.kind === 'tell' && typeof e.data?.hint === 'string') {
      const owner = actorMonster ?? (typeof e.data.boss === 'string' ? e.data.boss : undefined)
      if (owner) addUnique(out.tells, owner, e.data.hint.slice(0, CODEX_LIMITS.tellLength), CODEX_LIMITS.tellsPerMonster)
    }
  }
  return out
}

/** The `codex` log event's data: one fight's lines as a JSON string (the log's data holds scalars only). */
export function codexEventData(fight: Pick<FightState, 'actors' | 'log'>): { codex: string; monsters: number } {
  const lines = fightCodex(fight)
  return { codex: JSON.stringify(lines), monsters: Object.values(lines.seen).reduce((s, n) => s + n, 0) }
}

function isStringArrayRecord(v: unknown): v is Record<string, string[]> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every((x) => Array.isArray(x) && x.every((s) => typeof s === 'string'))
}

function isCountRecord(v: unknown): v is Record<string, number> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every((x) => typeof x === 'number' && Number.isFinite(x) && x >= 0)
}

/** Every `codex` line of a delve's log, summed (a line that does not parse is skipped, never thrown on). */
export function codexFromLog(log: readonly DelveEvent[]): FightCodex {
  const out = emptyFightCodex()
  for (const e of log) {
    if (e.kind !== 'codex' || typeof e.data?.codex !== 'string') continue
    let lines: unknown
    try {
      lines = JSON.parse(e.data.codex)
    } catch {
      continue
    }
    const l = lines as Partial<FightCodex>
    if (isCountRecord(l.seen)) for (const [id, n] of Object.entries(l.seen)) out.seen[id] = (out.seen[id] ?? 0) + Math.round(n)
    if (isCountRecord(l.killed)) for (const [id, n] of Object.entries(l.killed)) out.killed[id] = (out.killed[id] ?? 0) + Math.round(n)
    if (isStringArrayRecord(l.attacks)) for (const [id, list] of Object.entries(l.attacks)) for (const a of list) addUnique(out.attacks, id, a, CODEX_LIMITS.attacksPerMonster)
    if (isStringArrayRecord(l.tells)) for (const [id, list] of Object.entries(l.tells)) for (const h of list) addUnique(out.tells, id, h.slice(0, CODEX_LIMITS.tellLength), CODEX_LIMITS.tellsPerMonster)
  }
  return out
}

/** The profile's codex with a delve's lines and the materials it brought home added (a new object; nothing mutated). */
export function mergeCodex(prev: CodexRecord | undefined, delve: FightCodex, materials: Readonly<Record<string, number>>): CodexRecord {
  const monsters: Record<string, CodexMonsterRecord> = {}
  for (const [id, m] of Object.entries(prev?.monsters ?? {})) monsters[id] = { seen: m.seen, killed: m.killed, attacks: [...m.attacks], tells: [...m.tells] }
  const ids = new Set([...Object.keys(delve.seen), ...Object.keys(delve.killed), ...Object.keys(delve.attacks), ...Object.keys(delve.tells)])
  for (const id of ids) {
    const m = monsters[id] ?? (monsters[id] = { seen: 0, killed: 0, attacks: [], tells: [] })
    m.seen = Math.min(CODEX_LIMITS.count, m.seen + (delve.seen[id] ?? 0))
    m.killed = Math.min(CODEX_LIMITS.count, m.killed + (delve.killed[id] ?? 0))
    for (const a of delve.attacks[id] ?? []) if (!m.attacks.includes(a) && m.attacks.length < CODEX_LIMITS.attacksPerMonster) m.attacks.push(a)
    for (const h of delve.tells[id] ?? []) if (!m.tells.includes(h) && m.tells.length < CODEX_LIMITS.tellsPerMonster) m.tells.push(h)
  }
  const found: Record<string, number> = { ...(prev?.materials ?? {}) }
  for (const [id, n] of Object.entries(materials)) if (n > 0) found[id] = Math.min(CODEX_LIMITS.count, (found[id] ?? 0) + n)
  return { monsters, materials: found }
}
