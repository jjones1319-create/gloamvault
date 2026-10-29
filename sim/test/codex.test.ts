import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { CODEX_LIMITS, codexFromLog, emptyCodex, fightCodex, mergeCodex, type FightCodex } from '../src/codex.ts'
import { createDelve, hashDelve, runDelveAuto } from '../src/delve.ts'
import type { DelveEvent } from '../src/delve-types.ts'
import type { Actor, FightEvent } from '../src/fight-types.ts'
import { addHero, newProfile, settleDelve, startDelve } from '../src/town.ts'

/**
 * The codex (Phase 8, pass B): each fight leaves a `codex` log line, and settlement folds a delve's lines and the
 * materials it brought home into the profile's optional `codex`.
 */
const content = loadContentDir(path.resolve('content'))
const DUNGEON = 'gravehollow-keep'

/** The few actor fields fightCodex reads. */
function monster(id: string, monsterId: string, opts: { gone?: boolean; fled?: boolean } = {}): Actor {
  return { id, side: 'enemy', monster: { monsterId }, gone: opts.gone ?? false, fled: opts.fled ?? false } as unknown as Actor
}

function ev(kind: string, actorId: string | undefined, data?: FightEvent['data']): FightEvent {
  return { tick: 0, round: 1, kind, actorId, text: '', data }
}

describe('fightCodex', () => {
  it('counts every enemy met, the killed, the attacks used and the tells shown', () => {
    const actors = [monster('rat-0', 'giant-rat', { gone: true }), monster('rat-1', 'giant-rat', { gone: true, fled: true }), monster('plague-rat-2', 'plague-rat'), { id: 'hero-0', side: 'party' } as unknown as Actor]
    const log = [ev('action', 'rat-0', { attackId: 'bite' }), ev('action', 'rat-0', { attackId: 'bite' }), ev('action', 'plague-rat-2', { attackId: 'plague-bite' }), ev('action', 'hero-0', { attackId: 'nope' }), ev('tell', 'rat-1', { hint: 'Rat bracing' }), ev('tell', undefined, { hint: 'Tide rising', boss: 'sister-naesa' })]
    const c = fightCodex({ actors, log })
    expect(c.seen).toEqual({ 'giant-rat': 2, 'plague-rat': 1 })
    expect(c.killed, 'a fled rat is not a kill').toEqual({ 'giant-rat': 1 })
    expect(c.attacks).toEqual({ 'giant-rat': ['bite'], 'plague-rat': ['plague-bite'] })
    expect(c.tells).toEqual({ 'giant-rat': ['Rat bracing'], 'sister-naesa': ['Tide rising'] })
  })
})

describe('codexFromLog and mergeCodex', () => {
  const line = (c: FightCodex): DelveEvent => ({ floor: 1, roomId: 'r1', kind: 'codex', text: 'codex', data: { codex: JSON.stringify(c) } })

  it('sums a delve’s lines and skips one that does not parse', () => {
    const a: FightCodex = { seen: { 'giant-rat': 2 }, killed: { 'giant-rat': 2 }, attacks: { 'giant-rat': ['bite'] }, tells: {} }
    const b: FightCodex = { seen: { 'giant-rat': 1, 'cellar-spider': 2 }, killed: { 'cellar-spider': 1 }, attacks: { 'giant-rat': ['bite', 'scurry-nip'] }, tells: { 'cellar-spider': ['Weaver spinning'] } }
    const broken: DelveEvent = { floor: 1, roomId: 'r2', kind: 'codex', text: 'codex', data: { codex: '{not json' } }
    const sum = codexFromLog([line(a), broken, { floor: 1, roomId: 'r1', kind: 'room', text: 'x' }, line(b)])
    expect(sum.seen).toEqual({ 'giant-rat': 3, 'cellar-spider': 2 })
    expect(sum.killed).toEqual({ 'giant-rat': 2, 'cellar-spider': 1 })
    expect(sum.attacks['giant-rat']).toEqual(['bite', 'scurry-nip'])
    expect(sum.tells['cellar-spider']).toEqual(['Weaver spinning'])
  })

  it('adds to what the profile knew, keeps lists unique and capped, and counts materials', () => {
    const prev = { monsters: { 'giant-rat': { seen: 5, killed: 4, attacks: ['bite'], tells: [] } }, materials: { rawhide: 3 } }
    const many = Array.from({ length: CODEX_LIMITS.attacksPerMonster + 5 }, (_, i) => `a${i}`)
    const next = mergeCodex(prev, { seen: { 'giant-rat': 2 }, killed: { 'giant-rat': 2 }, attacks: { 'giant-rat': ['bite', ...many] }, tells: {} }, { rawhide: 2, 'rat-tail-charm': 1, nothing: 0 })
    expect(next.monsters['giant-rat']!.seen).toBe(7)
    expect(next.monsters['giant-rat']!.killed).toBe(6)
    expect(next.monsters['giant-rat']!.attacks).toHaveLength(CODEX_LIMITS.attacksPerMonster)
    expect(next.monsters['giant-rat']!.attacks[0]).toBe('bite')
    expect(next.materials).toEqual({ rawhide: 5, 'rat-tail-charm': 1 })
    expect(prev.monsters['giant-rat'].seen, 'the old record is untouched').toBe(5)
    expect(mergeCodex(undefined, { seen: {}, killed: {}, attacks: {}, tells: {} }, {})).toEqual(emptyCodex())
  })
})

describe('a delve fills the codex at settlement', () => {
  it('logs one codex line per fight, and the town folds them in with the materials', () => {
    let p = addHero(content, newProfile(9, 'sheltered'), { name: 'Orrin', speciesId: 'dwarf', classId: 'warden', eggPetId: null }).profile
    p = addHero(content, p, { name: 'Ilse', speciesId: 'human', classId: 'mender', eggPetId: null }).profile
    const started = startDelve(content, p, { dungeonId: DUNGEON, floor: 1, auto: true })
    const s = runDelveAuto(content, started.state)
    const lines = s.log.filter((e) => e.kind === 'codex')
    expect(lines.length).toBe(s.stats.fights)
    expect(s.stats.fights).toBeGreaterThan(0)
    const settled = settleDelve(content, started.profile, s).profile
    const codex = settled.codex!
    expect(Object.keys(codex.monsters).length).toBeGreaterThan(0)
    for (const [id, m] of Object.entries(codex.monsters)) {
      const def = content.monsters.get(id)
      expect(def, `${id} is a monster`).toBeDefined()
      expect(m.killed).toBeLessThanOrEqual(m.seen)
      for (const a of m.attacks) expect(def!.attacks.some((x) => x.id === a), `${id} uses ${a}`).toBe(true)
    }
    for (const [id, n] of Object.entries(s.materials)) if (n > 0) expect(codex.materials[id]).toBe(n)
    // A second delve adds to the first.
    const again = startDelve(content, settled, { dungeonId: DUNGEON, floor: 1, auto: true })
    const s2 = runDelveAuto(content, again.state)
    const twice = settleDelve(content, again.profile, s2).profile.codex!
    const rat = Object.keys(codex.monsters)[0]!
    expect(twice.monsters[rat]!.seen).toBeGreaterThanOrEqual(codex.monsters[rat]!.seen)
  })

  it('changes no delve hash: the same seed hashes the same with or without the codex lines', () => {
    const heroes = addHero(content, newProfile(3), { name: 'Orrin', speciesId: 'human', classId: 'blade', eggPetId: null }).profile.heroes
    const make = () => createDelve(content, { dungeonId: DUNGEON, floor: 1, seed: 77, difficulty: 'normal', pactIds: [], auto: true, policy: 'textbook' }, heroes)
    const a = runDelveAuto(content, make())
    const b = runDelveAuto(content, make())
    b.log = b.log.filter((e) => e.kind !== 'codex')
    expect(hashDelve(a)).toBe(hashDelve(b))
  })
})
