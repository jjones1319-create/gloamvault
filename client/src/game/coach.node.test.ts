import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDelve, stepDelve } from '../../../sim/src/delve.ts'
import type { DelveState } from '../../../sim/src/delve-types.ts'
import { addHero, newProfile, type Profile } from '../../../sim/src/town.ts'
import { loadContentDir } from '../../../tools/sim/loadContent.ts'
import { coachFor, lessonPending, lessonStarted, markCoachSeen, replayTutorial, skipCoach, type CoachContext } from './coach.ts'

const c = loadContentDir(path.resolve('content'))

function fresh(): Profile {
  return addHero(c, newProfile(4), { name: 'Orrin', speciesId: 'human', classId: 'warden', eggPetId: null }).profile
}

function lesson(p: Profile, seed = 3): DelveState {
  return createDelve(c, { dungeonId: 'gravehollow-keep', floor: 1, seed, difficulty: 'normal', pactIds: [], auto: false, policy: 'textbook', firstDelve: true }, p.heroes)
}

function ctx(p: Profile, screen: string, delve: DelveState | null = null, extra: Partial<CoachContext> = {}): CoachContext {
  return { screen, params: {}, profile: p, delve, heroTurn: false, ...extra }
}

/** Steps the scripted player until `until` holds. */
function stepUntil(s: DelveState, until: (s: DelveState) => boolean): DelveState {
  for (let i = 0; i < 300 && !until(s) && s.phase.kind !== 'over'; i++) stepDelve(c, s, { kind: 'auto' })
  return s
}

describe('the lesson’s coach marks', () => {
  it('start in town at the Waystone, for a profile’s first delve only', () => {
    const p = fresh()
    expect(lessonPending(p)).toBe(true)
    expect(coachFor(ctx(p, 'town'))).toEqual({ id: 'town-first', target: '[data-testid="town-place-waystone"]' })
    expect(coachFor({ ...ctx(p, 'town'), params: { place: 'waystone' } }), 'not inside a place').toBeNull()
    const seen = markCoachSeen(p, 'town-first')
    expect(coachFor(ctx(seen, 'town'))).toBeNull()
    const veteran = { ...p, progress: { ...p.progress, delves: 3 } }
    expect(coachFor(ctx(veteran, 'town')), 'an old save is not taught the Waystone').toBeNull()
  })

  it('walk through the lesson floor: moving, the timeline, your turn, the trap, the chest, the stairs', () => {
    let p = markCoachSeen(fresh(), 'town-first')
    const d = lesson(p)
    const move = coachFor(ctx(p, 'delve', d))
    expect(move?.id).toBe('delve-move')
    expect(move?.target).toBe(`[data-testid="dv-move-${d.floor.graph.rooms.find((r) => r.kind === 'fight')!.id}"]`)
    p = markCoachSeen(p, 'delve-move')
    stepUntil(d, (s) => s.phase.kind === 'fight')
    expect(coachFor(ctx(p, 'delve', d))?.id).toBe('fight-strip')
    p = markCoachSeen(p, 'fight-strip')
    expect(coachFor(ctx(p, 'delve', d)), 'your turn waits for a hero turn').toBeNull()
    expect(coachFor(ctx(p, 'delve', d, { heroTurn: true }))).toEqual({ id: 'fight-act', target: '.fx-bar' })
    p = markCoachSeen(p, 'fight-act')
    const trapRoom = d.floor.graph.rooms.find((r) => r.kind === 'trapGauntlet')!.id
    stepUntil(d, (s) => s.phase.kind === 'room' && s.floor.currentRoomId === trapRoom)
    expect(coachFor(ctx(p, 'delve', d))).toEqual({ id: 'trap', target: '[data-testid="dv-action-disarm"]' })
    p = markCoachSeen(p, 'trap')
    expect(coachFor(ctx(p, 'delve', d))).toEqual({ id: 'chest', target: '[data-testid="dv-action-openChest"]' })
    p = markCoachSeen(p, 'chest')
    // At the stairs.
    d.floor.currentRoomId = d.floor.graph.exitId
    expect(coachFor(ctx(p, 'delve', d))).toEqual({ id: 'stairs', target: '[data-testid="dv-action-descend"]' })
  })

  it('stay off ordinary floors, and welcome the party home once after the lesson', () => {
    let p = fresh()
    const normal = createDelve(c, { dungeonId: 'gravehollow-keep', floor: 1, seed: 3, difficulty: 'normal', pactIds: [], auto: false, policy: 'textbook' }, p.heroes)
    p = markCoachSeen(p, 'town-first')
    expect(coachFor(ctx(p, 'delve', normal))).toBeNull()
    const home = { ...p, progress: { ...p.progress, delves: 1 } }
    expect(coachFor(ctx(home, 'town'))).toEqual({ id: 'town-home', target: null })
    expect(coachFor(ctx(home, 'hero'))).toEqual({ id: 'hero-tips', target: null })
    expect(coachFor({ ...ctx(home, 'hero'), params: { tab: 'gear' } })).toBeNull()
  })

  it('skip, then replay: every mark again and the next floor-1 delve is the lesson', () => {
    const p = { ...fresh(), progress: { ...fresh().progress, delves: 4 } }
    const skipped = skipCoach(p)
    expect(coachFor(ctx(skipped, 'hero'))).toBeNull()
    const again = replayTutorial(markCoachSeen(skipped, 'hero-tips'))
    expect(again.tutorial).toEqual({ seen: [], replay: true })
    expect(lessonPending(again)).toBe(true)
    expect(coachFor(ctx(again, 'town'))?.id).toBe('town-first')
    const started = lessonStarted(again)
    expect(started.tutorial).toEqual({ seen: [] })
    expect(lessonPending(started)).toBe(false)
    expect(lessonStarted(started)).toBe(started)
  })
})
