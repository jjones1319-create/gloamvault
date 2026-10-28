import type { Actor, FightCommand, FightEvent, FightState } from '../../../sim/src/fight-types.ts'
import type { ItemDef, StatusDef } from '../../../sim/src/types/content.ts'
import type { Target } from '../../../sim/src/types/enums.ts'
import type { SceneCue } from '../scene/sceneBus.ts'

/**
 * The fight HUD's pure side (Phase 4; 03 §3, D-085). It turns the sim's fight log into what the HUD plays back —
 * **beats** (one actor's moment: the action and what it did), feed lines, floating numbers and scene cues — and
 * answers the small questions the screen asks: who is on stage and at what HP while the log is still playing, which
 * targets a command needs, a status's chip, the strip of the next turns. No DOM and no timers: the playback
 * (`ui/screens/delve/fight/playback.ts`) paces what this module computes.
 */

/* ---------- beats ---------- */

/** One moment of the fight: an actor's action and its results, a DoT tick, a phase change, the end. */
export interface Beat {
  /** Index of the first event in `fight.log`. */
  start: number
  /** One past the last event. */
  end: number
  /** Whose moment it is (the attacker, the guard, the one ticking); null for fight-wide lines (start, end). */
  actorId: string | null
  events: FightEvent[]
}

/** Never shown as a line of their own: developer notes and bookkeeping (the round counter shows in the strip). */
const HIDDEN_KINDS: ReadonlySet<string> = new Set(['hookStub', 'round', 'statusEnd'])

/** Kinds that open a new beat (everything else belongs to the beat before it). */
const BEAT_STARTERS: ReadonlySet<string> = new Set([
  'start',
  'action',
  'guard',
  'charge',
  'swapRow',
  'flee',
  'fleeFail',
  'freeAlly',
  'stance',
  'skip',
  'held',
  'monsterFlee',
  'phase',
  'crewFlees',
  'fallen',
  'freed',
  'dot',
  'hot',
  'fortune',
  'end',
])

/** Results that, logged by someone other than the beat's actor, are a moment of their own (a pet's mend, a riposte). */
const RESULT_KINDS: ReadonlySet<string> = new Set(['damage', 'miss', 'heal'])

function leadOf(events: readonly FightEvent[]): FightEvent | undefined {
  return events.find((e) => e.kind !== 'fortune') ?? events[0]
}

function startsBeat(e: FightEvent, cur: Beat | null): boolean {
  if (!cur) return true
  const actor = e.actorId ?? null
  const lead = leadOf(cur.events)
  // A Fortune note ("costs nothing") leads into the action it paid for.
  if (e.kind === 'action' && cur.events.every((x) => x.kind === 'fortune') && cur.actorId === actor) return false
  // One actor's DoT and HoT ticks at the same turn start are one moment.
  if ((e.kind === 'dot' || e.kind === 'hot') && (lead?.kind === 'dot' || lead?.kind === 'hot') && cur.actorId === actor) return false
  if (BEAT_STARTERS.has(e.kind)) return true
  return RESULT_KINDS.has(e.kind) && actor !== null && cur.actorId !== actor
}

/** Groups `log[from, to)` into beats. The log is append-only, so the indexes stay valid as the fight goes on. */
export function beatsOf(log: readonly FightEvent[], from: number, to = log.length): Beat[] {
  const out: Beat[] = []
  let cur: Beat | null = null
  for (let i = Math.max(0, from); i < Math.min(to, log.length); i++) {
    const e = log[i]!
    if (startsBeat(e, cur)) {
      cur = { start: i, end: i + 1, actorId: e.kind === 'start' || e.kind === 'end' || e.kind === 'crewFlees' ? null : (e.actorId ?? null), events: [e] }
      out.push(cur)
    } else if (cur) {
      cur.events.push(e)
      cur.end = i + 1
    }
  }
  return out
}

/** A beat with nothing to show or cue (only bookkeeping): the playback passes it without a pause. */
export function isQuietBeat(beat: Beat): boolean {
  return beat.events.every((e) => HIDDEN_KINDS.has(e.kind))
}

/* ---------- names ---------- */

export interface NameBook {
  actor(id: string | null | undefined): string
  status(id: string | null | undefined): string
}

export function capitalise(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s
}

export function nameBook(fight: FightState, statuses?: ReadonlyMap<string, StatusDef>): NameBook {
  const names = new Map(fight.actors.map((a) => [a.id, a.name]))
  return {
    actor: (id) => (id ? (names.get(id) ?? id) : ''),
    status: (id) => (id ? (statuses?.get(id)?.name ?? capitalise(id)) : ''),
  }
}

/* ---------- feed lines ---------- */

export function outcomeLine(outcome: string): string {
  switch (outcome) {
    case 'victory':
      return 'Victory!'
    case 'defeat':
      return 'The party has fallen'
    case 'fled':
      return 'The party got away'
    case 'cap':
      return 'The fight drags on — the party backs away'
    default:
      return 'The fight is over'
  }
}

function statusOf(e: FightEvent): string | null {
  const s = e.data?.status
  return typeof s === 'string' ? s : null
}

/**
 * The action's line, the numbers first so a narrow feed keeps them: "Warden uses Shield Slam on Cellar Spider 1: 12
 * crit, Stun, Haste on 3 — Cellar Spider 1 falls". A status that lands on several others is counted, not listed.
 */
function actionLine(lead: FightEvent, events: readonly FightEvent[], book: NameBook): string {
  const hits: string[] = []
  const notes: string[] = []
  const falls: string[] = []
  const downs: string[] = []
  /** Status name → who else got it (the main target and the actor are said by the name alone). */
  const spread = new Map<string, string[]>()
  const own: string[] = []
  const wasted: string[] = []
  let fortune = false
  /** A guard who stepped in front of the blow (a Guard-stance pet, an Intercept): the next hit on it says so. */
  let guardian: string | null = null
  const on = lead.targetId ?? null
  const who = (id: string | undefined, what: string) => (id && id !== on ? `${book.actor(id)} ${what}` : what)
  for (const e of events) {
    if (e === lead) continue
    switch (e.kind) {
      case 'damage': {
        const amount = `${e.amount ?? 0}${e.data?.crit ? ' crit' : ''}${e.data?.blocked ? ' (blocked)' : ''}`
        if (guardian && e.targetId === guardian) {
          hits.push(`${book.actor(guardian)} takes the hit (${amount})`)
          guardian = null
        } else hits.push(who(e.targetId, amount))
        if (e.data?.killed) falls.push(book.actor(e.targetId))
        if (e.data?.downed) downs.push(book.actor(e.targetId))
        break
      }
      case 'miss':
        if (guardian && e.targetId === guardian) {
          hits.push(`${book.actor(guardian)} steps in; miss`)
          guardian = null
        } else hits.push(e.targetId && e.targetId !== on ? `${book.actor(e.targetId)} dodges` : 'miss')
        break
      case 'intercept':
        if (guardian) notes.push(`${book.actor(guardian)} steps in`)
        guardian = e.actorId ?? null
        break
      case 'heal':
        // A heal on someone already full says "+0": worth saying only when it is all the action did.
        if ((e.amount ?? 0) > 0) hits.push(who(e.targetId ?? e.actorId, `+${e.amount ?? 0}`))
        else wasted.push(who(e.targetId ?? e.actorId, '+0'))
        break
      case 'revive':
        hits.push(`${book.actor(e.targetId)} is back up`)
        break
      case 'status': {
        const s = book.status(statusOf(e))
        if (!s) break
        if (!e.targetId || e.targetId === on || e.targetId === lead.actorId) {
          if (!own.includes(s)) own.push(s)
        } else spread.set(s, [...(spread.get(s) ?? []), book.actor(e.targetId)])
        break
      }
      case 'interrupt':
        notes.push(`${book.actor(e.targetId)}'s cast is pushed back`)
        break
      case 'fortune':
        fortune = true
        break
      case 'partBreak':
      case 'summon':
        notes.push(e.text)
        break
      default:
        break
    }
  }
  if (guardian) notes.push(`${book.actor(guardian)} steps in`)
  const effects = [...own, ...[...spread].map(([s, names]) => (names.length === 1 ? `${names[0]}: ${s}` : `${s} on ${names.length}`))]
  if (hits.length === 0 && effects.length === 0) hits.push(...wasted)
  const parts = [...hits, ...effects, ...notes, ...(fortune ? ['free (Fortune)'] : [])]
  let line = lead.text
  if (parts.length) line += `: ${parts.join(', ')}`
  if (falls.length) line += ` — ${falls.join(', ')} ${falls.length > 1 ? 'fall' : 'falls'}`
  if (downs.length) line += ` — ${downs.join(', ')} ${downs.length > 1 ? 'are' : 'is'} down`
  return line
}

/** The feed's line for a beat, or null for a quiet one. */
export function beatLine(beat: Beat, book: NameBook): string | null {
  const shown = beat.events.filter((e) => !HIDDEN_KINDS.has(e.kind))
  const lead = leadOf(shown)
  if (!lead) return null
  switch (lead.kind) {
    case 'action':
      return actionLine(lead, shown, book)
    case 'end':
      return outcomeLine(String(lead.data?.outcome ?? ''))
    case 'start': {
      const extra = shown.filter((e) => e.kind === 'status').map((e) => `${book.actor(e.targetId)}: ${book.status(statusOf(e))}`)
      return extra.length ? `${lead.text} — ${extra.join(', ')}` : lead.text
    }
    case 'dot':
    case 'hot': {
      const ticks = shown.filter((e) => e.kind === 'dot' || e.kind === 'hot')
      const hurt = ticks.filter((e) => e.kind === 'dot').map((e) => `${e.amount ?? 0} from ${book.status(statusOf(e))}`)
      const mend = ticks.filter((e) => e.kind === 'hot').map((e) => `+${e.amount ?? 0} from ${book.status(statusOf(e))}`)
      const name = book.actor(lead.actorId)
      if (hurt.length && mend.length) return `${name} takes ${hurt.join(', ')}; ${mend.join(', ')}`
      return hurt.length ? `${name} takes ${hurt.join(', ')}` : `${name} gains ${mend.join(', ')}`
    }
    case 'skip':
      return `${book.actor(lead.actorId)} loses the turn (${book.status(statusOf(lead))})`
    case 'held':
      return `${book.actor(lead.actorId)} is held and cannot act`
    case 'guard':
      return `${book.actor(lead.actorId)} guards`
    default:
      return lead.text
  }
}

/** Keeps the last `max` lines, oldest first. */
export function pushFeed(feed: readonly string[], line: string | null, max = 3): string[] {
  return line ? [...feed, line].slice(-max) : [...feed]
}

/* ---------- floating numbers ---------- */

export type FloaterTone = 'damage' | 'crit' | 'heal' | 'miss' | 'status' | 'info'

export interface FloaterSpec {
  actorId: string
  text: string
  tone: FloaterTone
}

/** What rises over each card when the beat plays: damage red, heals green, "Miss", "Crit!", a status's name. */
export function beatFloaters(beat: Beat, book: NameBook): FloaterSpec[] {
  const out: FloaterSpec[] = []
  for (const e of beat.events) {
    switch (e.kind) {
      case 'damage':
        if (e.targetId) out.push({ actorId: e.targetId, text: e.data?.crit ? `Crit! ${e.amount ?? 0}` : `${e.amount ?? 0}`, tone: e.data?.crit ? 'crit' : 'damage' })
        break
      case 'dot':
        if (e.actorId) out.push({ actorId: e.actorId, text: `${e.amount ?? 0}`, tone: 'damage' })
        break
      case 'miss':
        if (e.targetId) out.push({ actorId: e.targetId, text: 'Miss', tone: 'miss' })
        break
      case 'heal': {
        const id = e.targetId ?? e.actorId
        if (id) out.push({ actorId: id, text: `+${e.amount ?? 0}`, tone: 'heal' })
        break
      }
      case 'hot':
        if (e.actorId) out.push({ actorId: e.actorId, text: `+${e.amount ?? 0}`, tone: 'heal' })
        break
      case 'revive':
        if (e.targetId) out.push({ actorId: e.targetId, text: 'Back up!', tone: 'heal' })
        break
      case 'status': {
        const id = e.targetId ?? e.actorId
        if (id) out.push({ actorId: id, text: book.status(statusOf(e)), tone: 'status' })
        break
      }
      case 'guard':
        if (e.actorId) out.push({ actorId: e.actorId, text: 'Guard', tone: 'info' })
        break
      case 'interrupt':
        if (e.targetId) out.push({ actorId: e.targetId, text: 'Pushed back', tone: 'info' })
        break
      default:
        break
    }
  }
  return out
}

/* ---------- scene cues ---------- */

/** The cues a beat sends the 3D scene: whose turn it is, then each hit, miss, heal, status, fall. */
export function beatCues(beat: Beat, after?: (actorId: string) => { hp: number; maxHp: number } | undefined): SceneCue[] {
  const out: SceneCue[] = []
  // Where the beat leaves the actor's HP (Phase 6): the scene sets its bar there.
  const at = (id: string): { hp?: number; maxHp?: number } => after?.(id) ?? {}
  if (beat.actorId && !isQuietBeat(beat)) out.push({ kind: 'turn', actorId: beat.actorId })
  for (const e of beat.events) {
    switch (e.kind) {
      case 'damage':
        if (!e.targetId) break
        out.push({ kind: e.data?.crit ? 'crit' : 'hit', actorId: e.targetId, amount: e.amount ?? 0, ...at(e.targetId) })
        if (e.data?.killed) out.push({ kind: 'gone', actorId: e.targetId })
        else if (e.data?.downed) out.push({ kind: 'down', actorId: e.targetId })
        break
      case 'dot':
        if (e.actorId) out.push({ kind: 'hit', actorId: e.actorId, amount: e.amount ?? 0, ...at(e.actorId) })
        break
      case 'miss':
        if (e.targetId) out.push({ kind: 'miss', actorId: e.targetId })
        break
      case 'heal': {
        const id = e.targetId ?? e.actorId
        if (id) out.push({ kind: 'heal', actorId: id, amount: e.amount ?? 0, ...at(id) })
        break
      }
      case 'hot':
        if (e.actorId) out.push({ kind: 'heal', actorId: e.actorId, amount: e.amount ?? 0, ...at(e.actorId) })
        break
      case 'status': {
        const id = e.targetId ?? e.actorId
        const s = statusOf(e)
        if (id && s) out.push({ kind: 'status', actorId: id, status: s })
        break
      }
      case 'revive':
        if (e.targetId) out.push({ kind: 'revive', actorId: e.targetId, amount: e.amount ?? 0, ...at(e.targetId) })
        break
      case 'fallen':
        if (e.actorId) out.push({ kind: 'gone', actorId: e.actorId })
        break
      case 'monsterFlee':
        // Phase 6: a monster that runs plays its Flee and leaves the room, rather than falling.
        if (e.actorId) out.push({ kind: 'flee', actorId: e.actorId })
        break
      default:
        break
    }
  }
  return out
}

export type StageState = 'up' | 'down' | 'gone'

export function stageStateOf(a: Actor): StageState {
  if (a.gone || a.fallen || a.fled) return 'gone'
  if (a.downed || a.hp <= 0) return 'down'
  return 'up'
}

/**
 * Brings the scene in line with the fight after a playback ends or is skipped: a monster killed by a DoT, a crew
 * that fled with its boss, a hero revived — whatever the beats did not cue. `known` is what the scene was last told;
 * actors it has not heard of count as up.
 */
export function reconcileCues(fight: FightState, known: Map<string, StageState>): SceneCue[] {
  const out: SceneCue[] = []
  for (const a of fight.actors) {
    const now = stageStateOf(a)
    const before = known.get(a.id) ?? 'up'
    if (now === before) continue
    known.set(a.id, now)
    if (now === 'gone') out.push({ kind: 'gone', actorId: a.id })
    else if (now === 'down') out.push({ kind: 'down', actorId: a.id })
    else if (before === 'down') out.push({ kind: 'revive', actorId: a.id })
  }
  return out
}

/** Records what a list of cues told the scene, so `reconcileCues` does not repeat it. */
export function noteCues(cues: readonly SceneCue[], known: Map<string, StageState>): void {
  for (const c of cues) {
    if (c.kind === 'gone' || c.kind === 'flee') known.set(c.actorId, 'gone')
    else if (c.kind === 'down') known.set(c.actorId, 'down')
    else if (c.kind === 'revive') known.set(c.actorId, 'up')
  }
}

/* ---------- the stage while the log plays ---------- */

/**
 * HP to add back to each actor's current HP to see it as it was before `log[from…]` happened (damage still to show
 * is added back, heals still to show taken off), so the meters fall in step with the feed instead of jumping ahead.
 */
export function hpBehind(log: readonly FightEvent[], from: number): Map<string, number> {
  const out = new Map<string, number>()
  const add = (id: string | undefined, n: number) => {
    if (id) out.set(id, (out.get(id) ?? 0) + n)
  }
  for (let i = Math.max(0, from); i < log.length; i++) {
    const e = log[i]!
    const n = e.amount ?? 0
    if (e.kind === 'damage') add(e.targetId, n)
    else if (e.kind === 'dot') add(e.actorId, n)
    else if (e.kind === 'heal') add(e.targetId ?? e.actorId, -n)
    else if (e.kind === 'hot') add(e.actorId, -n)
    else if (e.kind === 'revive') add(e.targetId, -n)
  }
  return out
}

export function shownHp(a: Actor, behind: ReadonlyMap<string, number>): number {
  return Math.max(0, Math.min(a.maxHp, a.hp + (behind.get(a.id) ?? 0)))
}

/** Who is still to arrive or still to leave in `log[from…]`. */
export interface Presence {
  /** Summoned at or after `from`: not on stage yet. */
  arrivesAt: Map<string, number>
  /** The last event at or after `stay` that names the actor: it stays on stage until that one has played. */
  lastMention: Map<string, number>
  /** A crew that broke with its boss (D-081): every monster that fled leaves at this index (−1: none ahead). */
  crewFleesAt: number
  /** Revived or fallen later in the log: shown as still down until then. */
  revivedAhead: Set<string>
  fallsAhead: Set<string>
}

/**
 * `from` is what has played; `stay` (≤ from) keeps a monster on stage through the beat that kills it — the beat on
 * screen starts there — so its bar is seen to empty before the card goes.
 */
export function presenceAhead(log: readonly FightEvent[], from: number, stay = from): Presence {
  const p: Presence = { arrivesAt: new Map(), lastMention: new Map(), crewFleesAt: -1, revivedAhead: new Set(), fallsAhead: new Set() }
  for (let i = Math.max(0, Math.min(from, stay)); i < log.length; i++) {
    const e = log[i]!
    if (i >= stay) {
      if (e.kind === 'crewFlees') p.crewFleesAt = i
      if (e.actorId) p.lastMention.set(e.actorId, i)
      if (e.targetId && e.kind !== 'summon') p.lastMention.set(e.targetId, i)
    }
    if (i < from) continue
    if (e.kind === 'summon' && e.targetId && !p.arrivesAt.has(e.targetId)) p.arrivesAt.set(e.targetId, i)
    if (e.kind === 'revive' && e.targetId) p.revivedAhead.add(e.targetId)
    if (e.kind === 'fallen' && e.actorId) p.fallsAhead.add(e.actorId)
  }
  return p
}

/** Is this actor's card on the HUD at this point of the playback? Heroes and pets always are. */
export function onStage(a: Actor, p: Presence): boolean {
  if (a.side === 'party') return true
  if (p.arrivesAt.has(a.id)) return false
  if (!a.gone) return true
  if (p.lastMention.has(a.id)) return true
  return a.fled && p.crewFleesAt >= 0
}

/** Where a fresh HUD starts playing: from the last hero action (a reload mid-fight), else from the fight's start. */
export function resumeIndex(fight: FightState): number {
  const heroes = new Set(fight.actors.filter((a) => a.kind === 'hero').map((a) => a.id))
  for (let i = fight.log.length - 1; i >= 0; i--) {
    const e = fight.log[i]!
    if (e.kind === 'action' && e.actorId && heroes.has(e.actorId)) return i
  }
  return 0
}

/** Pacing: one beat every 450 ms at 1×, 225 at 2×, 150 at 3× (03 §3.6: an action resolves in ≤ 1.5 s at 1×). */
export const BEAT_MS_AT_1X = 450

export function beatMs(speed: number): number {
  return Math.round(BEAT_MS_AT_1X / Math.max(1, speed))
}

/* ---------- the strip ---------- */

export type StripSide = 'hero' | 'pet' | 'enemy'

export interface StripChip {
  id: string
  /** The name for the tooltip (a pet's says whose it is). */
  name: string
  /** What the chip shows: a hero's or monster's initials; a pet shows its owner's initial. */
  initials: string
  side: StripSide
  boss: boolean
}

/** A card's name split so the part that tells two monsters apart never gets cut: "Grinning Cutpurse 2" → base + "2"; "Rat (champion)" → base + champion. */
export function splitName(name: string): { base: string; num: string | null; champion: boolean } {
  const champion = /\s*\(champion\)\s*$/i.test(name)
  const rest = name.replace(/\s*\(champion\)\s*$/i, '')
  const m = /^(.*\S)\s+(\d+)$/.exec(rest)
  return m ? { base: m[1]!, num: m[2]!, champion } : { base: rest, num: null, champion }
}

/** "Cellar Spider 2" → "CS2", "Warden" → "W": the first letters of up to two words, then a trailing number. */
export function initials(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const num = words.length > 1 && /^\d+$/.test(words[words.length - 1]!) ? words.pop()! : ''
  const letters = words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
  return `${letters}${num}` || '?'
}

/** The next turns with the hero waiting for a command first (03 §3.1: the strip of 8). */
export function stripChips(fight: FightState, forecast: readonly string[], count = 8): StripChip[] {
  const ids = [...forecast]
  const pending = fight.pendingActorId
  if (pending && ids[0] !== pending) {
    const at = ids.indexOf(pending)
    if (at >= 0) ids.splice(at, 1)
    ids.unshift(pending)
  }
  const out: StripChip[] = []
  for (const id of ids.slice(0, count)) {
    const a = fight.actors.find((x) => x.id === id)
    if (!a) continue
    const owner = a.kind === 'pet' && a.pet ? fight.actors.find((x) => x.id === a.pet?.ownerId) : undefined
    out.push({
      id,
      name: owner ? `${a.name} (${owner.name}'s pet)` : a.name,
      initials: owner ? initials(owner.name).slice(0, 1) : initials(a.name),
      side: a.side === 'enemy' ? 'enemy' : a.kind === 'pet' ? 'pet' : 'hero',
      boss: a.monster?.isBoss ?? false,
    })
  }
  return out
}

/* ---------- commands and targets ---------- */

/** Target kinds where the player has nothing to choose: the sim picks (self, everyone, the lowest ally, a random enemy). */
export const NO_CHOICE_TARGETS: ReadonlySet<Target> = new Set<Target>([
  'self',
  'allAllies',
  'allyLowest',
  'allyRow',
  'partyFront',
  'partyBack',
  'enemyRandom',
  'allEnemies',
  'enemyRowBack',
  'pet',
  'summon',
  'allDowned',
  'fallenAlly',
  'room',
])

export type TargetPlan = { kind: 'send'; targetId: string | null } | { kind: 'pick'; ids: string[] } | { kind: 'blocked'; reason: string }

/**
 * What tapping a command does: send it now (no choice, or one candidate), ask for a target among `candidates`, or
 * refuse (nobody to aim at). `target` is the skill's or item's target kind; null for Attack and Free ally.
 */
export function planTargets(target: Target | null, candidates: readonly string[], fallbackId: string | null): TargetPlan {
  if (target && NO_CHOICE_TARGETS.has(target)) return { kind: 'send', targetId: fallbackId }
  if (candidates.length === 0) return { kind: 'blocked', reason: target === 'downedAlly' ? 'No one is down' : 'Nothing to aim at' }
  if (candidates.length === 1) return { kind: 'send', targetId: candidates[0]! }
  return { kind: 'pick', ids: [...candidates] }
}

/** The command with its target filled in. */
export function withTarget(command: FightCommand, targetId: string | null): FightCommand {
  switch (command.kind) {
    case 'basic':
      return { kind: 'basic', targetId: targetId ?? command.targetId }
    case 'freeAlly':
      return { kind: 'freeAlly', targetId: targetId ?? command.targetId }
    case 'skill':
    case 'ultimate':
    case 'item':
      return { ...command, targetId }
    default:
      return command
  }
}

function isUp(a: Actor): boolean {
  return !a.gone && !a.fallen && !a.fled && !a.downed && a.hp > 0
}

/** The actor's side, standing (heroes and pets): who a potion or an ally skill can reach. */
export function standingAllies(fight: FightState, actorId: string): string[] {
  const me = fight.actors.find((a) => a.id === actorId)
  return me ? fight.actors.filter((a) => a.side === me.side && isUp(a)).map((a) => a.id) : []
}

/** Heroes on the actor's side who are down but not fallen: who a Phoenix Feather or a revive can reach. */
export function downedAllies(fight: FightState, actorId: string): string[] {
  const me = fight.actors.find((a) => a.id === actorId)
  return me ? fight.actors.filter((a) => a.side === me.side && a.downed && !a.fallen && !a.gone).map((a) => a.id) : []
}

/** The candidates for a target kind, from the legal list's own targets where it has them. */
export function candidatesFor(target: Target | null, legalTargets: readonly string[], fight: FightState, actorId: string): string[] {
  if (target === 'downedAlly') return downedAllies(fight, actorId)
  if (target === 'ally' && legalTargets.length === 0) return standingAllies(fight, actorId)
  return [...legalTargets]
}

export type WeightHint = 'light' | 'normal' | 'heavy'

/** A skill's or weapon's weight as the player reads it: light comes round sooner, heavy later (03 §3.1). */
export function weightHint(weight: number | null | undefined, normal = 1000): WeightHint {
  if (weight === null || weight === undefined || weight === normal) return 'normal'
  return weight < normal ? 'light' : 'heavy'
}

/** The count at the end of a legal item label ("Small HP Potion ×2" → 2). */
export function itemCount(label: string): number {
  const m = /×(\d+)$/.exec(label)
  return m ? Number(m[1]) : 1
}

/** One plain line for a consumable from its effect lines (items carry no description of their own). */
export function describeConsumable(def: ItemDef, statusName: (id: string) => string): string {
  const bits: string[] = []
  const cured: string[] = []
  for (const e of def.consumable?.effects ?? []) {
    switch (e.kind) {
      case 'heal':
        bits.push(e.percent !== undefined ? `heals ${e.percent}% of max HP` : `heals ${e.amount ?? 0} HP`)
        break
      case 'pool':
        bits.push(`restores ${e.percent ?? 0}% of the drinker's ${/mana/i.test(e.note ?? '') ? 'Mana' : /stamina/i.test(e.note ?? '') ? 'Stamina' : 'pool'}`)
        break
      case 'revive':
        bits.push(`revives a downed ally at ${e.percent ?? 30}% HP`)
        break
      case 'removeStatus':
        if (e.status) cured.push(statusName(e.status))
        break
      case 'dispel':
        bits.push('cleanses every debuff')
        break
      case 'applyStatus':
        if (e.status) bits.push(`${statusName(e.status)}${e.duration ? ` for ${e.duration} turns` : ''}`)
        break
      case 'shield':
        bits.push('a Shield')
        break
      default:
        break
    }
  }
  if (cured.length) bits.unshift(`cures ${cured.join(' and ')}`)
  const text = bits.join('; ')
  return text ? capitalise(text) : 'Use it in the fight'
}

/* ---------- statuses ---------- */

export interface StatusChipView {
  id: string
  label: string
  stacks: number | null
  turns: number | null
  tone: 'good' | 'bad' | 'note'
  tint: string | null
  /** One line for the tap: the name, the first sentence of the description, the turns left. */
  line: string
}

/** The first sentence of a description (statuses' records run to several). */
export function firstSentence(text: string): string {
  const m = /^(.+?[.!?])(\s|$)/.exec(text.trim())
  return (m ? m[1]! : text.trim()).trim()
}

const GOOD_KINDS: ReadonlySet<string> = new Set(['buff', 'hot'])

export function statusChips(a: Actor, defs?: ReadonlyMap<string, StatusDef>): StatusChipView[] {
  return a.statuses.map((s) => {
    const def = defs?.get(s.id)
    const name = def?.name ?? capitalise(s.id)
    const turns = s.turnsLeft === null || s.turnsLeft === undefined ? null : Math.max(0, s.turnsLeft)
    const stacks = s.stacks > 1 ? s.stacks : null
    const left = turns === null ? '' : ` (${turns} ${turns === 1 ? 'turn' : 'turns'} left)`
    return {
      id: s.id,
      label: name,
      stacks,
      turns,
      tone: def ? (GOOD_KINDS.has(def.kind) ? 'good' : def.kind === 'state' ? 'note' : 'bad') : 'note',
      tint: def?.visual.tint ?? null,
      line: `${name}${stacks ? ` ×${stacks}` : ''}: ${def ? firstSentence(def.description) : 'a status'}${left}`,
    }
  })
}
