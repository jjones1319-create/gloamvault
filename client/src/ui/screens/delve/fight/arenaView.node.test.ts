import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../../../../../tools/sim/loadContent.ts'
import type { ArenaState, FightEvent, FightState, LegalFightAction } from '../../../../../../sim/src/fight-types.ts'
import { arenaChips, arenaRows, bandOf, tellPills, tellingIds, torchNote } from './arenaView.ts'

/** The arena HUD's pure side (07 §2.8, D-099): chips, tells with their first-time words, the Arena rows, the Torch line. */
const c = loadContentDir(path.resolve('content'))

function arena(over: Partial<ArenaState> = {}): ArenaState {
  return {
    bossId: 'sister-naesa',
    bossActorId: 'boss',
    templateId: 'vlt-t-drowned-chapel',
    phase: 1,
    phaseStartRound: 1,
    lightSet: 40,
    meleeBlocked: [],
    barricade: false,
    candles: null,
    doorsOpen: false,
    tide: { level: 2, max: 4, nextRound: 6, stopped: false },
    props: [{ id: 'sluice', kind: 'sluice', name: 'the sluice wheel', hitsLeft: 0, done: false }],
    tells: [],
    hintsShown: [],
    fallen: [],
    struckBy: [],
    oathHolderId: null,
    hunterWaves: 0,
    partsBroken: [],
    hits: [],
    swapped: [],
    rows: {},
    flags: {},
    stats: { lightMin: 40, lanternsOut: 0, candlesOut: 0, doorsOpened: false, tideMax: 2, sluiceTurns: 0, braziersLit: 0, torchesUsed: 0, recalls: 0, huntersReturned: 0, huntersSkipped: 0, pulls: 0, tells: 0, tellsBroken: 0 },
    ...over,
  }
}

function fight(a: ArenaState | null, log: FightEvent[] = [], actors: FightState['actors'] = []): FightState {
  return { arena: a, light: 40, log, actors, options: {} } as unknown as FightState
}

describe('the arena chips', () => {
  it("show the boss's phase, the light's band, the tide's steps; nothing outside an arena", () => {
    const chips = arenaChips(c, fight(arena()))
    expect(chips.map((x) => x.key)).toEqual(['phase', 'light', 'tide'])
    expect(chips[0]!.value).toBe('1/2')
    expect(chips[1]!.value).toBe('40 · Shadowy')
    expect(chips[2]!.pips).toEqual({ on: 2, of: 4 })
    expect(arenaChips(c, fight(null))).toEqual([])
    expect(bandOf(c, 0)).toBe('pitch')
  })

  it('count the braziers relit this phase, the candles, the barricade and the bone piles', () => {
    const throne = arena({ bossId: 'hollow-king', tide: { level: 0, max: 4, nextRound: null, stopped: false }, props: [0, 1, 2, 3].map((i) => ({ id: `brazier-${i + 1}`, kind: 'brazier' as const, name: 'a brazier', hitsLeft: 0, done: i < 2 })) })
    const chips = arenaChips(c, fight(throne))
    expect(chips.find((x) => x.key === 'braziers')!.value).toBe('2/4')
    expect(chips.some((x) => x.key === 'tide')).toBe(false)
    const vigil = arena({ bossId: 'barrow-warden', tide: null, candles: { lit: 5, of: 12 }, doorsOpen: true, props: [{ id: 'pile-1', kind: 'pile', name: 'a bone pile', hitsLeft: 0, done: true }, { id: 'pile-2', kind: 'pile', name: 'a bone pile', hitsLeft: 3, done: false }] })
    const v = arenaChips(c, fight(vigil))
    expect(v.find((x) => x.key === 'candles')).toMatchObject({ value: '5/12', tone: 'warn' })
    expect(v.find((x) => x.key === 'piles')!.value).toBe('1/2')
    expect(v.some((x) => x.key === 'doors')).toBe(true)
  })
})

describe('the tells (D-099)', () => {
  it('show their two words the first time they fire, the mark alone afterwards; a wound-up blow is a tell too', () => {
    const a = arena({ tells: [{ id: 'tide-rising', hint: 'Tide rising', cue: 'the sub-bass boom', firesAtRound: 3, actorId: 'boss', targetId: null }] })
    const first: FightEvent = { tick: 0, round: 2, kind: 'tell', actorId: 'boss', text: 'Tide rising', data: { hint: 'Tide rising', cue: 'the sub-bass boom', source: 'arena', ref: 'tide-rising', first: true, boss: 'sister-naesa' } }
    expect(tellPills(fight(a, [first]))[0]).toMatchObject({ hint: 'Tide rising', words: true })
    const again: FightEvent = { ...first, round: 5, data: { ...first.data, first: false } }
    expect(tellPills(fight(a, [first, again]))[0]!.words).toBe(false)
    const naesa = { id: 'boss', name: 'Sister Naesa', gone: false, fled: false, monster: { windup: { attackId: 'tidal-call', targetId: null, hint: 'Conch raised', sinceLog: 0 } } }
    const call: FightEvent = { tick: 0, round: 2, kind: 'tell', actorId: 'boss', text: 'Conch raised', data: { hint: 'Conch raised', cue: 'She raises the conch', source: 'attack', ref: 'tidal-call', first: true, boss: 'sister-naesa' } }
    const pills = tellPills(fight(arena(), [call], [naesa as never]))
    expect(pills).toHaveLength(1)
    expect(pills[0]).toMatchObject({ hint: 'Conch raised', words: true })
    expect(tellingIds(fight(arena(), [], [naesa as never]))).toEqual(new Set(['boss']))
  })
})

describe('the Arena rows and the Torch line', () => {
  it('list the arena commands of the legal list; say what a Torch does in a throne', () => {
    const legal: LegalFightAction[] = [
      { command: { kind: 'guard' }, label: 'Guard', targets: [], enabled: true },
      { command: { kind: 'arena', propId: 'sluice' }, label: 'Turn the sluice wheel (water 2/4)', targets: [], enabled: false, reason: 'needs strength 12' },
    ]
    expect(arenaRows(legal)).toEqual([{ propId: 'sluice', label: 'Turn the sluice wheel (water 2/4)', enabled: false, reason: 'needs strength 12' }])
    const throne = arena({ props: [0, 1, 2, 3].map((i) => ({ id: `brazier-${i + 1}`, kind: 'brazier' as const, name: 'a brazier', hitsLeft: 0, done: i === 0 })) })
    expect(torchNote(fight(throne), 20)).toBe('Relights a brazier: +20 light (1 of 4 relit this phase)')
    expect(torchNote(fight(arena()), 25)).toBeNull()
  })
})
