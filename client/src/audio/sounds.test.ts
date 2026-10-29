import { describe, expect, it } from 'vitest'
import { createDelve, legalDelveActions, stepDelve } from '../../../sim/src/delve.ts'
import type { DelveEvent, DelveState } from '../../../sim/src/delve-types.ts'
import type { Actor, FightEvent, FightState } from '../../../sim/src/fight-types.ts'
import { choosePolicyCommand } from '../../../sim/src/policies.ts'
import { Rng } from '../../../sim/src/rng.ts'
import { addHero, newProfile } from '../../../sim/src/town.ts'
import { loadContent } from '../content/load.ts'
import { beatsOf, type Beat } from '../game/fightView.ts'
import { allSfx } from './recipes/sfx.ts'
import { beatMusicCues, beatSounds, delveEventSound, hunterNear, thin, type SoundCue } from './sounds.ts'

const content = loadContent()
const known = allSfx()

const ev = (kind: string, more: Partial<FightEvent> = {}): FightEvent => ({ tick: 0, round: 1, kind, text: more.text ?? kind, ...more })
const actor = (id: string, side: 'party' | 'enemy'): Actor => ({ id, name: id, side, kind: side === 'party' ? 'hero' : 'monster', row: 'front', hp: 10, maxHp: 10, statuses: [], gone: false, fled: false, fallen: false, downed: false }) as unknown as Actor
const fakeFight = { actors: [actor('hero-0', 'party'), actor('rat-1', 'enemy')], log: [] } as unknown as FightState
const beat = (events: FightEvent[]): Beat => ({ start: 0, end: events.length, actorId: events[0]?.actorId ?? null, events })

describe('fight beats as sounds', () => {
  it('a blow, a crit kill, a miss and a tell each make their sound, panned by side', () => {
    const s = beatSounds(beat([ev('action', { actorId: 'hero-0', targetId: 'rat-1' }), ev('damage', { actorId: 'hero-0', targetId: 'rat-1', amount: 9, data: { killed: true } }), ev('miss', { targetId: 'hero-0' })]), fakeFight, null, 1)
    expect(s.map((c) => c.id)).toEqual(['hit-blunt', 'kill', 'miss'])
    expect(s[0]!.pan).toBeGreaterThan(0)
    expect(s[2]!.pan).toBeLessThan(0)
    expect(beatSounds(beat([ev('tell', { actorId: 'rat-1', data: { hint: 'Winding up' } })]), fakeFight, null, 1).map((c) => c.id)).toEqual(['tell'])
  })

  it('the arena speaks: light down, the tide, a hunter answering (and not one the party killed)', () => {
    const s = beatSounds(beat([ev('arena', { data: { what: 'light', from: 60, to: 30 } }), ev('arena', { data: { what: 'tide', from: 1, to: 2 } }), ev('arena', { data: { what: 'hunterReturns', hunter: 'old-gnaw', skipped: true } })]), fakeFight, null, 1)
    expect(s.map((c) => c.id)).toEqual(['arena-light-down', 'arena-tide'])
    const cues = beatMusicCues(beat([ev('arena', { actorId: 'rat-1', data: { what: 'phase', phase: 2 } }), ev('arena', { data: { what: 'hunterReturns', hunter: 'vault-leech', skipped: false } })]))
    expect(cues).toEqual({ phase: 2, hunters: ['vault-leech'] })
  })

  it('at 2× and 3× a beat keeps fewer, bigger sounds: deaths and blows stay, misses and statuses go', () => {
    const many: SoundCue[] = [
      { id: 'miss', kind: 'miss', pan: 0 },
      { id: 'debuff', kind: 'status', pan: 0 },
      { id: 'hit-slash', kind: 'impact', pan: 0 },
      { id: 'hit-slash', kind: 'impact', pan: 0 },
      { id: 'hit-slash', kind: 'impact', pan: 0 },
      { id: 'kill', kind: 'death', pan: 0 },
      { id: 'heal', kind: 'heal', pan: 0 },
    ]
    expect(thin(many, 1).map((c) => c.id)).toEqual(['miss', 'debuff', 'hit-slash', 'hit-slash', 'kill', 'heal'])
    expect(thin(many, 2).map((c) => c.id)).toEqual(['hit-slash', 'hit-slash', 'kill', 'heal'])
    expect(thin(many, 3).map((c) => c.id)).toEqual(['hit-slash', 'hit-slash', 'kill'])
  })

  it('a real Cellars fight from the sim: every beat maps to sounds that exist, and the fight is not silent', () => {
    let p = newProfile(17)
    const egg = [...content.pets.values()].find((x) => x.creationChoice)
    for (const cls of ['warden', 'arcanist', 'mender']) p = addHero(content, p, { name: cls, speciesId: 'human', classId: cls, eggPetId: egg?.id ?? null }).profile
    const state = createDelve(content, { dungeonId: 'gravehollow-keep', floor: 1, seed: 17, difficulty: 'normal', pactIds: [], auto: false, policy: 'textbook' }, p.heroes)
    const rng = new Rng({ a: 17, b: 7, c: 11, d: 13 })
    for (let i = 0; i < 400 && state.phase.kind !== 'fight' && state.phase.kind !== 'over'; i++) {
      const cmd = choosePolicyCommand('textbook', state, legalDelveActions(content, state), rng)
      if (!cmd) break
      stepDelve(content, state, cmd)
    }
    expect(state.phase.kind).toBe('fight')
    const fight = state.fight!
    for (let i = 0; i < 200 && state.phase.kind === 'fight' && state.fight?.pendingActorId; i++) stepDelve(content, state, { kind: 'fight', command: { kind: 'auto' } })
    const ids: string[] = []
    for (const b of beatsOf(fight.log, 0)) for (const speed of [1, 2, 3]) for (const c of beatSounds(b, fight, content, speed)) ids.push(c.id)
    expect(ids.length).toBeGreaterThan(5)
    for (const id of ids) expect(known[id], id).toBeTruthy()
    expect(ids.some((id) => id.startsWith('hit-'))).toBe(true)
  })
})

describe('the delve as sounds', () => {
  it('each logged moment has its sound', () => {
    const e = (kind: string, more: Partial<DelveEvent> = {}): DelveEvent => ({ floor: 1, roomId: 'r1', kind, text: more.text ?? kind, ...more })
    expect(delveEventSound(e('room'))).toBe('door')
    expect(delveEventSound(e('trapRevealed'))).toBe('trap-spotted')
    expect(delveEventSound(e('trap'))).toBe('trap')
    expect(delveEventSound(e('chest'))).toBe('chest')
    expect(delveEventSound(e('lockFail'))).toBe('lock-fail')
    expect(delveEventSound(e('gold'))).toBe('gold')
    expect(delveEventSound(e('curio'))).toBe('curio')
    expect(delveEventSound(e('stairs'))).toBe('stairs')
    expect(delveEventSound(e('waystone'))).toBe('waystone')
    expect(delveEventSound(e('hunter'))).toBe('hunter-enters')
    expect(delveEventSound(e('fightStart', { data: { surprised: 2 } }))).toBe('ambush')
    expect(delveEventSound(e('fightStart', { data: { surprised: 0 } }))).toBe('fight-start')
    expect(delveEventSound(e('item', { text: 'Orrin uses Small HP Potion' }))).toBe('potion')
    expect(delveEventSound(e('kills'))).toBeNull()
    for (const k of ['room', 'trapRevealed', 'trap', 'disarm', 'disarmFail', 'secret', 'key', 'gold', 'chest', 'lockFail', 'curio', 'stairs', 'waystone', 'hunter', 'rest', 'repair', 'item', 'raise', 'firstAid', 'buy', 'relic', 'fightStart', 'floor']) {
      const id = delveEventSound(e(k))
      expect(id && known[id], k).toBeTruthy()
    }
  })

  it('the hunter is near when it is in the room or through one of its doors', () => {
    const d = (hunterRoom: string | null, entered = true, killed = false) =>
      ({ floor: { currentRoomId: 'a', graph: { rooms: [{ id: 'a', doors: [{ to: 'b' }] }, { id: 'b', doors: [{ to: 'a' }, { to: 'c' }] }, { id: 'c', doors: [{ to: 'b' }] }] }, hunter: { monsterId: 'old-gnaw', entered, roomId: hunterRoom, moveProgress: 0, killed } } }) as unknown as DelveState
    expect(hunterNear(d('a'))).toBe(true)
    expect(hunterNear(d('b'))).toBe(true)
    expect(hunterNear(d('c'))).toBe(false)
    expect(hunterNear(d('b', false))).toBe(false)
    expect(hunterNear(d('b', true, true))).toBe(false)
    expect(hunterNear(d(null))).toBe(false)
  })
})
