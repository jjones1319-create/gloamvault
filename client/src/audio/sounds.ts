/**
 * What the game already logs, as sounds (Phase 8). Pure: the runtime plays what these return.
 *
 * - A fight beat (game/fightView.ts) → its blows by damage type or element (the same reading the effects use,
 *   game/fightFx.ts), crits, misses, heals, statuses (a buff or a debuff), a tell's wind-up, the arena's events (light,
 *   tide, sluice, braziers, candles, doors, the hunters), deaths, an Ultimate's flourish. Panned by side (the party
 *   left, the enemies right). At 2× and 3× a beat keeps fewer, bigger sounds (tuning `speedThinning`) so fast playback
 *   stays readable rather than a din.
 * - A delve log entry (sim DelveEvent) → doors, traps, curios, chests, gold, stairs, the Waystone, the hunter.
 */
import type { Content } from '../../../sim/src/content.ts'
import type { DelveEvent, DelveState } from '../../../sim/src/delve-types.ts'
import type { FightState } from '../../../sim/src/fight-types.ts'
import { beatFx } from '../game/fightFx.ts'
import type { Beat } from '../game/fightView.ts'
import TUNING from './tuning.json'

export type SoundKind = 'impact' | 'crit' | 'miss' | 'heal' | 'status' | 'status-hero' | 'death' | 'revive' | 'guard' | 'tell' | 'arena' | 'ultimate' | 'move'

export interface SoundCue {
  id: string
  kind: SoundKind
  pan: number
  gainDb?: number
}

const HIT_KINDS: ReadonlySet<string> = new Set(['slash', 'pierce', 'blunt', 'fire', 'frost', 'lightning', 'poison', 'holy', 'shadow', 'bleed'])

const ARENA_SOUNDS: Readonly<Record<string, string>> = {
  tide: 'arena-tide',
  sluice: 'arena-sluice',
  brazier: 'arena-brazier',
  candle: 'arena-candle',
  doors: 'arena-doors',
  hunterReturns: 'arena-hunter',
  recall: 'arena-recall',
  pulse: 'arena-pulse',
  pull: 'arena-pull',
  frenzy: 'arena-frenzy',
  slick: 'arena-slick',
  barricade: 'arena-barricade',
  partBreak: 'arena-break',
  oath: 'arena-oath',
}

/** Which sounds win when a beat has more than it may keep. */
const PRIORITY: Readonly<Record<SoundKind, number>> = { death: 0, ultimate: 1, crit: 2, tell: 3, arena: 4, revive: 5, impact: 6, heal: 7, 'status-hero': 8, guard: 9, miss: 10, status: 11, move: 12 }

function panOf(fight: FightState, id: string | null | undefined): number {
  const a = id ? fight.actors.find((x) => x.id === id) : undefined
  return a ? (a.side === 'enemy' ? 0.35 : -0.35) : 0
}

function isHero(fight: FightState, id: string | null | undefined): boolean {
  return !!id && fight.actors.some((a) => a.id === id && a.side === 'party')
}

/** The sounds a beat makes, thinned for the playback speed (1, 2 or 3). */
export function beatSounds(beat: Beat, fight: FightState, content: Content | null, speed = 1): SoundCue[] {
  const out: SoundCue[] = []
  const dot = beat.events[0]?.kind === 'dot'
  // The blows, heals, statuses and Ultimates, read the same way the effects are.
  if (content) {
    for (const c of beatFx(beat, fight, content)) {
      const pan = panOf(fight, c.actorId)
      if (c.fx && HIT_KINDS.has(c.fx)) {
        out.push({ id: `hit-${c.fx}`, kind: 'impact', pan, ...(dot ? { gainDb: -6 } : {}) })
        if (c.crit) out.push({ id: 'crit', kind: 'crit', pan })
      } else if (c.fx === 'heal') out.push({ id: 'heal', kind: 'heal', pan })
      else if (c.fx === 'buff' || c.fx === 'debuff') out.push({ id: c.fx, kind: isHero(fight, c.actorId) ? 'status-hero' : 'status', pan })
      else if (c.fx === 'ultimate') out.push({ id: 'ultimate', kind: 'ultimate', pan })
    }
  }
  for (const e of beat.events) {
    switch (e.kind) {
      case 'damage':
        if (!content) out.push({ id: 'hit-blunt', kind: 'impact', pan: panOf(fight, e.targetId) })
        if (e.data?.killed) out.push({ id: 'kill', kind: 'death', pan: panOf(fight, e.targetId) })
        else if (e.data?.downed) out.push({ id: 'downed', kind: 'death', pan: panOf(fight, e.targetId) })
        break
      case 'miss':
        out.push({ id: 'miss', kind: 'miss', pan: panOf(fight, e.targetId) })
        break
      case 'fallen':
        out.push({ id: 'fallen', kind: 'death', pan: panOf(fight, e.actorId) })
        break
      case 'revive':
        out.push({ id: 'revive', kind: 'revive', pan: panOf(fight, e.targetId) })
        break
      case 'guard':
        out.push({ id: 'guard', kind: 'guard', pan: panOf(fight, e.actorId) })
        break
      case 'tell':
        out.push({ id: 'tell', kind: 'tell', pan: panOf(fight, e.actorId) })
        break
      case 'tellBroken':
        out.push({ id: 'tell-broken', kind: 'tell', pan: panOf(fight, e.actorId) })
        break
      case 'monsterFlee':
        out.push({ id: 'monster-flee', kind: 'move', pan: panOf(fight, e.actorId) })
        break
      case 'flee':
        out.push({ id: 'flee', kind: 'move', pan: -0.3 })
        break
      case 'arena': {
        const what = String(e.data?.what ?? '')
        if (what === 'light') {
          const from = Number(e.data?.from ?? 0)
          const to = Number(e.data?.to ?? 0)
          if (to !== from) out.push({ id: to < from ? 'arena-light-down' : 'arena-light-up', kind: 'arena', pan: 0 })
        } else if (what === 'hunterReturns' && e.data?.skipped) {
          break
        } else {
          const id = ARENA_SOUNDS[what]
          if (id) out.push({ id, kind: 'arena', pan: panOf(fight, e.targetId ?? e.actorId) })
        }
        break
      }
      default:
        break
    }
  }
  return thin(out, speed)
}

/** Keeps the kinds the speed allows, at most two of one sound, then the most important few. */
export function thin(sounds: readonly SoundCue[], speed: number): SoundCue[] {
  const s = speed >= 3 ? 3 : speed >= 2 ? 2 : 1
  const allowed = s === 1 ? null : new Set<string>((TUNING.speedThinning as unknown as Record<string, string[]>)[String(s)] ?? [])
  const max = (TUNING.maxSoundsPerBeat as Record<string, number>)[String(s)] ?? 6
  const count = new Map<string, number>()
  const kept: SoundCue[] = []
  for (const c of sounds) {
    if (allowed && !allowed.has(c.kind)) continue
    const n = count.get(c.id) ?? 0
    if (n >= 2) continue
    count.set(c.id, n + 1)
    kept.push(c)
  }
  return kept
    .map((c, i) => ({ c, i }))
    .sort((a, b) => PRIORITY[a.c.kind] - PRIORITY[b.c.kind] || a.i - b.i)
    .slice(0, max)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.c)
}

/** The arena events in a beat that the music answers: a boss's new phase, a hunter that answered the King. */
export function beatMusicCues(beat: Beat): { phase: number | null; hunters: string[] } {
  let phase: number | null = null
  const hunters: string[] = []
  for (const e of beat.events) {
    if (e.kind !== 'arena') continue
    if (e.data?.what === 'phase') phase = Number(e.data.phase ?? 1)
    if (e.data?.what === 'hunterReturns' && !e.data.skipped && typeof e.data.hunter === 'string') hunters.push(e.data.hunter)
  }
  return { phase, hunters }
}

/* ---------- the delve ---------- */

/** The sound of one delve log entry, or null. */
export function delveEventSound(e: DelveEvent): string | null {
  switch (e.kind) {
    case 'room':
    case 'crawlway':
      return 'door'
    case 'trapRevealed':
      return 'trap-spotted'
    case 'trap':
      return 'trap'
    case 'disarm':
      return 'disarm'
    case 'disarmFail':
      return 'disarm-fail'
    case 'secret':
      return 'secret'
    case 'key':
      return 'key'
    case 'gold':
    case 'cache':
    case 'hidden':
      return 'gold'
    case 'chest':
      return 'chest'
    case 'lockFail':
      return 'lock-fail'
    case 'curio':
      return 'curio'
    case 'stairs':
      return 'stairs'
    case 'waystone':
      return 'waystone'
    case 'hunter':
      return 'hunter-enters'
    case 'rest':
      return 'rest'
    case 'repair':
      return 'repair'
    case 'item':
      return /potion|draught|tonic|elixir/i.test(e.text) ? 'potion' : 'item'
    case 'raise':
      return 'raise'
    case 'firstAid':
      return 'first-aid'
    case 'buy':
    case 'sell':
      return 'coins'
    case 'relic':
      return 'relic'
    case 'fightStart':
      return Number(e.data?.surprised ?? 0) > 0 ? 'ambush' : 'fight-start'
    case 'floor':
      return 'floor'
    default:
      return null
  }
}

/** Is a hunter (or the Twin Hunter) in the party's room or the next one through a door? */
export function hunterNear(d: DelveState): boolean {
  const here = d.floor.currentRoomId
  const room = d.floor.graph.rooms.find((r) => r.id === here)
  for (const h of [d.floor.hunter, d.floor.twinHunter]) {
    if (!h || !h.entered || h.killed || !h.roomId) continue
    if (h.roomId === here) return true
    if (room?.doors.some((door) => door.to === h.roomId)) return true
  }
  return false
}
