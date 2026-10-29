import { signal } from '@preact/signals'
import type { DelveState } from '../../../sim/src/delve-types.ts'
import type { Profile, TutorialProgress } from '../../../sim/src/town.ts'

/**
 * The lesson's coach marks (D-038, 03 §13; Phase 8, pass B): short notes at each step of the first delve — the
 * Waystone, moving, the timeline, your turn, the trap your Perception reveals, the chest, the stairs or teleporting
 * out — plus one in town after it and one on the hero screen for the stat tips. Each shows once per profile
 * (`profile.tutorial.seen`), "Skip the lesson" hides them all, and Settings → Replay the tutorial shows them again and
 * makes the next delve that starts on floor 1 the lesson floor again. Pure: the screens read `coachFor` and save what
 * `markCoachSeen` / `skipCoach` / `replayTutorial` return.
 */

export type CoachId = 'town-first' | 'delve-move' | 'fight-strip' | 'fight-act' | 'trap' | 'chest' | 'stairs' | 'town-home' | 'hero-tips'

/** A deep link with `&tutorial=1` (screenshots of the lesson) shows the marks in an ephemeral session, which shows none otherwise. */
export const coachDemo = signal(false)

/** Where a mark sits: inline among the town's notices, or over the room, the fight or the hero screen. */
export type CoachPlace = 'town' | 'room' | 'fight' | 'hero'

export interface CoachMark {
  id: CoachId
  place: CoachPlace
  title: string
  text: string
}

export const COACH_MARKS: Readonly<Record<CoachId, CoachMark>> = {
  'town-first': { id: 'town-first', place: 'town', title: 'Your first delve', text: 'Emberfall is home between delves. Tap the Waystone to go into Gravehollow Keep: floor 1 is a short lesson of three rooms.' },
  'delve-move': { id: 'delve-move', place: 'room', title: 'Moving', text: 'This is the floor’s entrance: you can always walk out to town from here. Tap the lit room on the map to walk in.' },
  'fight-strip': { id: 'fight-strip', place: 'fight', title: 'The timeline', text: 'The strip at the top shows who acts next. Rats are quick, so they act more often than you: Speed sets how often everyone gets a turn.' },
  'fight-act': { id: 'fight-act', place: 'fight', title: 'Your turn', text: 'Tap Attack or a skill, then an enemy. Guard halves the damage you take until your next turn; Auto fights for you.' },
  trap: { id: 'trap', place: 'room', title: 'A trap!', text: 'Your Perception spotted it, so it will not spring. Step around it, or disarm it for a small reward: a fumble sets it off.' },
  chest: { id: 'chest', place: 'room', title: 'A chest', text: 'Open it: whatever you find goes home with you, even if the delve goes badly.' },
  stairs: { id: 'stairs', place: 'room', title: 'The way on', text: 'Take the stairs to floor 2, or teleport out to Emberfall with everything you carry. Finish a floor and the tower remembers it: next time you can start one floor deeper.' },
  'town-home': { id: 'town-home', place: 'town', title: 'Welcome back', text: 'The Blacksmith repairs worn gear, the Skill Hall teaches skills, the Curio Merchant sells chests and the Stables hatch eggs. Tap a hero to see what grew.' },
  'hero-tips': { id: 'hero-tips', place: 'hero', title: 'Ask any number', text: 'Tap or hold a stat to hear what it does, with this hero’s own numbers. Scroll down to see how each one grows.' },
}

/** The order the marks come in when more than one could show. */
export const COACH_ORDER: readonly CoachId[] = ['town-first', 'delve-move', 'fight-strip', 'fight-act', 'trap', 'chest', 'stairs', 'town-home', 'hero-tips']

export interface CoachContext {
  screen: string
  params: Readonly<Record<string, string>>
  profile: Profile | null
  delve: DelveState | null
  /** A hero's turn waits for the player's command in the fight (Auto off). */
  heroTurn: boolean
}

export interface CoachHit {
  id: CoachId
  /** A CSS selector for the thing the mark is about (ringed on screen), or null. */
  target: string | null
}

/** The lesson floor waits for this profile: its first delve, or a replay asked for in Settings. */
export function lessonPending(p: Profile): boolean {
  return p.progress.delves === 0 || p.tutorial?.replay === true
}

export function coachSeen(p: Profile, id: CoachId): boolean {
  return p.tutorial?.skipped === true || (p.tutorial?.seen ?? []).includes(id)
}

function onLesson(d: DelveState | null): d is DelveState {
  return d !== null && d.floor?.graph.kind === 'tutorial' && d.phase.kind !== 'over'
}

/** The mark that should show now, or null (each once, in COACH_ORDER). */
export function coachFor(ctx: CoachContext): CoachHit | null {
  const p = ctx.profile
  if (!p || p.tutorial?.skipped) return null
  for (const id of COACH_ORDER) {
    if (coachSeen(p, id)) continue
    const target = targetFor(id, ctx)
    if (target !== undefined) return { id, target }
  }
  return null
}

/** The mark's target selector when the mark applies now (null: no ring), else undefined. */
function targetFor(id: CoachId, ctx: CoachContext): string | null | undefined {
  const p = ctx.profile!
  const d = ctx.delve
  const inTown = ctx.screen === 'town' && !ctx.params.place && !p.activeDelve
  const room = onLesson(d) && d.phase.kind === 'room' ? d.floor.rooms[d.floor.currentRoomId] : undefined
  switch (id) {
    case 'town-first':
      return inTown && p.heroes.length > 0 && lessonPending(p) ? '[data-testid="town-place-waystone"]' : undefined
    case 'delve-move': {
      if (ctx.screen !== 'delve' || !room || d!.floor.currentRoomId !== d!.floor.graph.entryId) return undefined
      const next = d!.floor.graph.rooms.find((r) => r.kind === 'fight')
      return next ? `[data-testid="dv-move-${next.id}"]` : null
    }
    case 'fight-strip':
      return ctx.screen === 'delve' && onLesson(d) && d.phase.kind === 'fight' ? '[data-testid="fx-strip"]' : undefined
    case 'fight-act':
      return ctx.screen === 'delve' && onLesson(d) && d.phase.kind === 'fight' && ctx.heroTurn ? '.fx-bar' : undefined
    case 'trap':
      return ctx.screen === 'delve' && room?.traps.some((t) => t.revealed && !t.disarmed && !t.triggered) ? '[data-testid="dv-action-disarm"]' : undefined
    case 'chest':
      return ctx.screen === 'delve' && room?.chests.some((c) => !c.opened) ? '[data-testid="dv-action-openChest"]' : undefined
    case 'stairs':
      return ctx.screen === 'delve' && room && d!.floor.currentRoomId === d!.floor.graph.exitId ? '[data-testid="dv-action-descend"]' : undefined
    case 'town-home':
      return inTown && !lessonPending(p) && p.progress.delves > 0 && (p.tutorial?.seen ?? []).includes('town-first') ? null : undefined
    case 'hero-tips':
      return ctx.screen === 'hero' && (ctx.params.tab ?? 'status') === 'status' ? null : undefined
  }
}

function withTutorial(p: Profile, next: TutorialProgress): Profile {
  return { ...p, tutorial: next }
}

/** "Got it": the mark never shows again for this profile. */
export function markCoachSeen(p: Profile, id: CoachId): Profile {
  const t = p.tutorial ?? { seen: [] }
  if (t.seen.includes(id)) return p
  return withTutorial(p, { ...t, seen: [...t.seen, id] })
}

/** "Skip the lesson": no mark shows until a replay. */
export function skipCoach(p: Profile): Profile {
  return withTutorial(p, { ...(p.tutorial ?? { seen: [] }), skipped: true })
}

/** Settings → Replay the tutorial: every mark again, and the next delve that starts on floor 1 is the lesson floor. */
export function replayTutorial(p: Profile): Profile {
  return withTutorial(p, { seen: [], replay: true })
}

/** The lesson floor has begun: a replay asked for is used up. */
export function lessonStarted(p: Profile): Profile {
  if (!p.tutorial?.replay) return p
  const { replay: _done, ...rest } = p.tutorial
  void _done
  return withTutorial(p, rest)
}
