import { describe, expect, it } from 'vitest'
import { createDelve, legalDelveActions, stepDelve } from '../../../sim/src/delve.ts'
import type { DelveState } from '../../../sim/src/delve-types.ts'
import { legalFightActions, turnForecast } from '../../../sim/src/fight.ts'
import type { Actor, FightEvent, FightState } from '../../../sim/src/fight-types.ts'
import { choosePolicyCommand } from '../../../sim/src/policies.ts'
import { Rng } from '../../../sim/src/rng.ts'
import { addHero, newProfile } from '../../../sim/src/town.ts'
import { loadContent } from '../content/load.ts'
import type { SceneCue } from '../scene/sceneBus.ts'
import { FightPlayback } from '../ui/screens/delve/fight/playback.ts'
import {
  beatCues,
  beatFloaters,
  beatLine,
  beatMs,
  beatsOf,
  candidatesFor,
  describeConsumable,
  firstSentence,
  hpBehind,
  initials,
  isQuietBeat,
  nameBook,
  onStage,
  outcomeLine,
  planTargets,
  presenceAhead,
  pushFeed,
  reconcileCues,
  resumeIndex,
  shownHp,
  statusChips,
  stripChips,
  weightHint,
  withTarget,
  type StageState,
} from './fightView.ts'

const content = loadContent()

/** The deep link's walk (`#delve=…&auto=1`): the scripted player goes to the first fight and stops on a hero's turn. */
function firstFight(seed: number, classes: string[]): DelveState {
  let p = newProfile(seed)
  const egg = [...content.pets.values()].find((x) => x.creationChoice)
  for (const cls of classes) p = addHero(content, p, { name: cls[0]!.toUpperCase() + cls.slice(1), speciesId: 'human', classId: cls, eggPetId: egg?.id ?? null }).profile
  const state = createDelve(content, { dungeonId: 'gravehollow-keep', floor: 1, seed, difficulty: 'normal', pactIds: [], auto: false, policy: 'textbook' }, p.heroes)
  const rng = new Rng({ a: seed >>> 0, b: 7, c: 11, d: 13 })
  for (let i = 0; i < 400 && state.phase.kind !== 'fight' && state.phase.kind !== 'over'; i++) {
    const cmd = choosePolicyCommand('textbook', state, legalDelveActions(content, state), rng)
    if (!cmd) break
    stepDelve(content, state, cmd)
  }
  return state
}

/** Plays the pending hero's turns with Auto until the fight ends; returns the finished fight. */
function playOut(state: DelveState): FightState {
  const fight = state.fight!
  for (let i = 0; i < 200 && state.phase.kind === 'fight' && state.fight?.pendingActorId; i++) stepDelve(content, state, { kind: 'fight', command: { kind: 'auto' } })
  return fight
}

const ev = (kind: string, more: Partial<FightEvent> = {}): FightEvent => ({ tick: 0, round: 1, kind, text: more.text ?? kind, ...more })

function actor(id: string, more: Partial<Actor> = {}): Actor {
  return { id, name: id, side: 'enemy', kind: 'monster', row: 'front', hp: 10, maxHp: 10, statuses: [], gone: false, fled: false, fallen: false, downed: false, ...more } as Actor
}

describe('beats: the fight log as moments', () => {
  const state = firstFight(17, ['warden', 'mender'])
  const fight = state.fight!

  it('the deep link stops on a hero turn with a log to play', () => {
    expect(state.phase.kind).toBe('fight')
    expect(fight.pendingActorId).toMatch(/^hero-/)
    expect(fight.log[0]?.kind).toBe('start')
  })

  it('covers every event once, in order, each action opening its own beat', () => {
    const beats = beatsOf(fight.log, 0)
    expect(beats[0]?.actorId).toBeNull()
    let at = 0
    for (const b of beats) {
      expect(b.start).toBe(at)
      expect(b.end).toBe(b.start + b.events.length)
      at = b.end
    }
    expect(at).toBe(fight.log.length)
    const actions = fight.log.filter((e) => e.kind === 'action').length
    expect(beats.filter((b) => b.events[0]?.kind === 'action')).toHaveLength(actions)
  })

  it('writes a feed line with the numbers, cues the scene and raises floaters', () => {
    const book = nameBook(fight, content.statuses)
    const beats = beatsOf(fight.log, 0)
    const hit = beats.find((b) => b.events.some((e) => e.kind === 'damage'))!
    const dmg = hit.events.find((e) => e.kind === 'damage')!
    expect(beatLine(hit, book)).toContain(String(dmg.amount))
    const cues = beatCues(hit)
    expect(cues[0]).toEqual({ kind: 'turn', actorId: hit.actorId })
    expect(cues).toContainEqual({ kind: dmg.data?.crit ? 'crit' : 'hit', actorId: dmg.targetId, amount: dmg.amount })
    expect(beatFloaters(hit, book)).toContainEqual({ actorId: dmg.targetId, text: dmg.data?.crit ? `Crit! ${dmg.amount}` : String(dmg.amount), tone: dmg.data?.crit ? 'crit' : 'damage' })
    expect(beatLine(beats[0]!, book)).toMatch(/^Fight begins/)
  })

  it('tells the scene where each hit and heal leaves the HP when asked (Phase 6: bars set, never counted twice)', () => {
    const log = [
      ev('action', { actorId: 'a', targetId: 'b', text: 'A attacks B' }),
      ev('damage', { actorId: 'a', targetId: 'b', amount: 4 }),
      ev('action', { actorId: 'c', targetId: 'b', text: 'C uses Mend' }),
      ev('heal', { actorId: 'c', targetId: 'b', amount: 2 }),
      ev('action', { actorId: 'a', targetId: 'b', text: 'A attacks B' }),
      ev('damage', { actorId: 'a', targetId: 'b', amount: 3 }),
    ]
    // Now: 10 − 4 + 2 − 3 = 5.
    const b = actor('b', { hp: 5, maxHp: 10 })
    const beats = beatsOf(log, 0)
    const after = (end: number) => (id: string) => (id === 'b' ? { hp: shownHp(b, hpBehind(log, end)), maxHp: b.maxHp } : undefined)
    expect(beatCues(beats[0]!, after(beats[0]!.end))).toContainEqual({ kind: 'hit', actorId: 'b', amount: 4, hp: 6, maxHp: 10 })
    expect(beatCues(beats[1]!, after(beats[1]!.end))).toContainEqual({ kind: 'heal', actorId: 'b', amount: 2, hp: 8, maxHp: 10 })
    expect(beatCues(beats[2]!, after(beats[2]!.end))).toContainEqual({ kind: 'hit', actorId: 'b', amount: 3, hp: 5, maxHp: 10 })
    // Without the reckoning the cues carry the amounts alone (as before).
    expect(beatCues(beats[0]!)).toContainEqual({ kind: 'hit', actorId: 'b', amount: 4 })
  })

  it('merges a Fortune note into its action and one actor’s ticks into one beat; a pet’s mend is its own moment', () => {
    const log = [
      ev('action', { actorId: 'a', targetId: 'b', text: 'A attacks B' }),
      ev('damage', { actorId: 'a', targetId: 'b', amount: 5 }),
      ev('fortune', { actorId: 'c' }),
      ev('action', { actorId: 'c', text: 'C uses Mend' }),
      ev('heal', { actorId: 'c', targetId: 'a', amount: 4 }),
      ev('dot', { actorId: 'b', amount: 2, data: { status: 'bleed' } }),
      ev('dot', { actorId: 'b', amount: 3, data: { status: 'poison' } }),
      ev('heal', { actorId: 'pet-0', targetId: 'a', amount: 6 }),
      ev('round'),
      ev('statusEnd', { actorId: 'b' }),
    ]
    const beats = beatsOf(log, 0)
    expect(beats.map((b) => [b.start, b.end])).toEqual([
      [0, 2],
      [2, 5],
      [5, 7],
      [7, 10],
    ])
    const book = { actor: (id: string | null | undefined) => (id ?? '').toUpperCase(), status: (id: string | null | undefined) => id ?? '' }
    expect(beatLine(beats[1]!, book)).toBe('C uses Mend: A +4, free (Fortune)')
    expect(beatLine(beats[2]!, book)).toBe('B takes 2 from bleed, 3 from poison')
    expect(isQuietBeat(beatsOf(log, 8)[0]!)).toBe(true)
  })

  it('folds a guard pet stepping in into the hit it took', () => {
    const book = { actor: (id: string | null | undefined) => (id ?? '').toUpperCase(), status: (id: string | null | undefined) => id ?? '' }
    const log = [
      ev('action', { actorId: 's', targetId: 'w', text: 'S uses Bite on W' }),
      ev('intercept', { actorId: 'p', targetId: 'w', text: 'P takes the hit meant for W' }),
      ev('damage', { actorId: 's', targetId: 'p', amount: 9 }),
    ]
    expect(beatLine(beatsOf(log, 0)[0]!, book)).toBe('S uses Bite on W: P takes the hit (9)')
  })

  it('puts the numbers first and counts a status that spreads to several', () => {
    const book = { actor: (id: string | null | undefined) => (id ?? '').toUpperCase(), status: (id: string | null | undefined) => id ?? '' }
    const log = [
      ev('action', { actorId: 'a', targetId: 'r1', text: 'A attacks R1' }),
      ev('status', { targetId: 'r2', data: { status: 'haste' } }),
      ev('status', { targetId: 'r3', data: { status: 'haste' } }),
      ev('damage', { actorId: 'a', targetId: 'r1', amount: 61, data: { killed: true } }),
      ev('partBreak', { targetId: 'r1', text: "R1's tail breaks" }),
    ]
    expect(beatLine(beatsOf(log, 0)[0]!, book)).toBe("A attacks R1: 61, haste on 2, R1's tail breaks — R1 falls")
  })

  it('says how the fight ended', () => {
    expect(outcomeLine('victory')).toBe('Victory!')
    expect(outcomeLine('fled')).toBe('The party got away')
    expect(pushFeed(['a', 'b', 'c'], 'd')).toEqual(['b', 'c', 'd'])
    expect(pushFeed(['a'], null)).toEqual(['a'])
  })
})

describe('the stage while the log plays', () => {
  it('shows HP as it was before the unplayed events and keeps a dying monster until its blow plays', () => {
    const state = firstFight(17, ['warden', 'mender'])
    const before = state.fight!.log.length
    const fight = playOut(state)
    expect(fight.over).not.toBeNull()
    const behind = hpBehind(fight.log, 0)
    for (const m of fight.actors.filter((a) => a.side === 'enemy' && !a.monster?.summonedBy)) expect(shownHp(m, behind)).toBe(m.maxHp)
    const killed = fight.actors.find((a) => a.side === 'enemy' && a.gone && fight.log.some((e) => e.kind === 'damage' && e.targetId === a.id && e.data?.killed))
    if (killed) {
      const blow = fight.log.findIndex((e) => e.kind === 'damage' && e.targetId === killed.id && e.data?.killed)
      expect(onStage(killed, presenceAhead(fight.log, blow))).toBe(true)
      expect(onStage(killed, presenceAhead(fight.log, fight.log.length))).toBe(false)
      // While the killing beat is on screen (it starts at the blow), the card stays; its bar is already empty.
      expect(onStage(killed, presenceAhead(fight.log, blow + 1, blow))).toBe(true)
      expect(shownHp(killed, hpBehind(fight.log, blow + 1))).toBe(0)
    }
    expect(resumeIndex(fight)).toBeGreaterThanOrEqual(before)
  })

  it('holds a summon back until it arrives and a fled crew until it breaks', () => {
    const log = [ev('summon', { actorId: 'boss', targetId: 'add-1' }), ev('crewFlees')]
    const add = actor('add-1')
    expect(onStage(add, presenceAhead(log, 0))).toBe(false)
    expect(onStage(add, presenceAhead(log, 1))).toBe(true)
    const fled = actor('rat', { gone: true, fled: true })
    expect(onStage(fled, presenceAhead(log, 1))).toBe(true)
    expect(onStage(fled, presenceAhead(log, 2))).toBe(false)
  })

  it('tells the scene what the beats did not: a DoT kill, a revive', () => {
    const known = new Map<string, StageState>()
    const f = { actors: [actor('rat', { gone: true, hp: 0 }), actor('hero-0', { side: 'party', kind: 'hero', downed: true, hp: 0 })] } as unknown as FightState
    expect(reconcileCues(f, known)).toEqual([
      { kind: 'gone', actorId: 'rat' },
      { kind: 'down', actorId: 'hero-0' },
    ])
    expect(reconcileCues(f, known)).toEqual([])
    ;(f.actors[1] as Actor).downed = false
    ;(f.actors[1] as Actor).hp = 30
    expect(reconcileCues(f, known)).toEqual([{ kind: 'revive', actorId: 'hero-0' }])
  })
})

describe('commands and targets', () => {
  const state = firstFight(17, ['warden', 'mender'])
  const fight = state.fight!
  const t = content.tuning
  const legal = legalFightActions(content, t, fight)

  it('sends at once when there is nothing to choose, asks when there are several, refuses when there are none', () => {
    expect(planTargets('allEnemies', ['a', 'b'], 'a')).toEqual({ kind: 'send', targetId: 'a' })
    expect(planTargets('self', [], null)).toEqual({ kind: 'send', targetId: null })
    expect(planTargets('enemy', ['a'], 'a')).toEqual({ kind: 'send', targetId: 'a' })
    expect(planTargets('enemy', ['a', 'b'], 'a')).toEqual({ kind: 'pick', ids: ['a', 'b'] })
    expect(planTargets('downedAlly', [], null)).toEqual({ kind: 'blocked', reason: 'No one is down' })
    expect(planTargets(null, [], null).kind).toBe('blocked')
  })

  it('fills the target into the command the legal list gave', () => {
    const basic = legal.find((l) => l.command.kind === 'basic')!
    expect(withTarget(basic.command, 'x')).toEqual({ kind: 'basic', targetId: 'x' })
    expect(withTarget({ kind: 'skill', slot: 2, targetId: null }, 'y')).toEqual({ kind: 'skill', slot: 2, targetId: 'y' })
    expect(withTarget({ kind: 'guard' }, 'z')).toEqual({ kind: 'guard' })
  })

  it('aims a revive at the downed only and an ally skill at the standing party', () => {
    const me = fight.pendingActorId!
    expect(candidatesFor('downedAlly', ['hero-0'], fight, me)).toEqual([])
    const allies = candidatesFor('ally', [], fight, me)
    expect(allies).toContain(me)
    expect(allies.every((id) => fight.actors.find((a) => a.id === id)?.side === 'party')).toBe(true)
  })

  it('puts the waiting hero first in the strip of eight', () => {
    const chips = stripChips(fight, turnForecast(content, t, fight, 8), 8)
    expect(chips[0]?.id).toBe(fight.pendingActorId)
    expect(chips.length).toBeLessThanOrEqual(8)
    expect(stripChips({ ...fight, pendingActorId: 'hero-1' }, ['hero-0', 'hero-1'], 8).map((c) => c.id)).toEqual(['hero-1', 'hero-0'])
    const pet = stripChips(fight, ['pet-0'], 8).find((c) => c.id === 'pet-0')
    expect(pet).toMatchObject({ side: 'pet', initials: 'W' })
    expect(pet?.name).toBe("Cellar Hound (Warden's pet)")
  })

  it('reads weights, names and items the way the player does', () => {
    expect(weightHint(800)).toBe('light')
    expect(weightHint(1000)).toBe('normal')
    expect(weightHint(1400)).toBe('heavy')
    expect(weightHint(null)).toBe('normal')
    expect(initials('Cellar Spider 2')).toBe('CS2')
    expect(initials('Warden')).toBe('W')
    expect(initials('Grave Rat (champion)')).toBe('GR')
    const name = (s: string) => content.statuses.get(s as never)?.name ?? s
    expect(describeConsumable(content.items.get('small-hp-potion')!, name)).toBe('Heals 25% of max HP')
    expect(describeConsumable(content.items.get('antidote')!, name)).toMatch(/^Cures Poison and Bleed/)
    expect(describeConsumable(content.items.get('phoenix-feather')!, name)).toBe('Revives a downed ally at 30% HP')
    expect(beatMs(1)).toBe(450)
    expect(beatMs(2)).toBe(225)
    expect(beatMs(3)).toBe(150)
  })

  it('makes a status chip with its stacks, turns left and a one-line description', () => {
    const a = actor('rat', { statuses: [{ id: 'bleed', stacks: 2, turnsLeft: 3, magnitude: 1, sourceId: null, counter: 0 }] })
    const [chip] = statusChips(a, content.statuses)
    expect(chip).toMatchObject({ id: 'bleed', label: 'Bleed', stacks: 2, turns: 3, tone: 'bad' })
    expect(chip!.line).toBe('Bleed ×2: Loses blood at the start of each turn: 25% of the hit that opened the wound, per stack, ignoring Defense. (3 turns left)')
    expect(firstSentence('One. Two.')).toBe('One.')
  })
})

describe('the playback', () => {
  function harness() {
    const timers: { id: number; fn: () => void; ms: number }[] = []
    const cues: SceneCue[] = []
    let id = 0
    let changes = 0
    const pb = new FightPlayback({
      setTimer: (fn, ms) => {
        timers.push({ id: ++id, fn, ms })
        return id
      },
      clearTimer: (x) => {
        const i = timers.findIndex((tm) => tm.id === x)
        if (i >= 0) timers.splice(i, 1)
      },
      cue: (c) => cues.push(c),
      changed: () => {
        changes++
      },
    })
    const runNext = () => {
      timers.sort((a, b) => a.ms - b.ms)
      const next = timers.findIndex((tm) => tm.ms !== 1100)
      const [tm] = timers.splice(next >= 0 ? next : 0, 1)
      tm?.fn()
      return tm
    }
    return { pb, timers, cues, runNext, changes: () => changes }
  }

  it('plays the log beat by beat, then waits for the hero', () => {
    const state = firstFight(17, ['warden', 'mender'])
    const fight = state.fight!
    const { pb, cues, runNext } = harness()
    pb.sync(fight, content.statuses)
    expect(pb.playing).toBe(true)
    expect(pb.shown).toBe(0)
    pb.kick()
    for (let i = 0; i < 100 && pb.playing; i++) runNext()
    expect(pb.playing).toBe(false)
    expect(pb.shown).toBe(fight.log.length)
    expect(pb.feed.length).toBeGreaterThan(0)
    expect(pb.feed.length).toBeLessThanOrEqual(3)
    expect(cues.some((c) => c.kind === 'hit' || c.kind === 'crit' || c.kind === 'miss')).toBe(true)
  })

  it('skips to the end on a tap and picks up the next command’s events', () => {
    const state = firstFight(5, ['warden', 'mender'])
    const fight = state.fight!
    const { pb } = harness()
    pb.sync(fight, content.statuses)
    pb.kick()
    pb.skip()
    expect(pb.playing).toBe(false)
    expect(pb.shown).toBe(fight.log.length)
    stepDelve(content, state, { kind: 'fight', command: { kind: 'guard' } })
    pb.sync(fight, content.statuses)
    expect(pb.playing).toBe(true)
    expect(pb.shown).toBeLessThan(fight.log.length)
    pb.skip()
    expect(pb.shown).toBe(fight.log.length)
    expect(pb.feed.at(-1)).toBeTruthy()
  })

  it('shows everything at once with Reduce motion, with no floating numbers', () => {
    const state = firstFight(21, ['warden', 'mender'])
    const { pb, timers } = harness()
    pb.reduceMotion = true
    pb.sync(state.fight!, content.statuses)
    pb.kick()
    expect(pb.playing).toBe(false)
    expect(pb.floaters).toEqual([])
    expect(timers).toEqual([])
  })
})
