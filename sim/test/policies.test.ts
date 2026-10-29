import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { createDelve, legalDelveActions, runDelveAuto } from '../src/delve.ts'
import type { DelveOptions, DelveState } from '../src/delve-types.ts'
import { heroAtLevel } from '../src/hero.ts'
import { carefulRead, choosePolicyCommand, routeToward, type PolicyName } from '../src/policies.ts'
import { Rng } from '../src/rng.ts'
import { addHero, newProfile } from '../src/town.ts'
import type { HeroRecord } from '../src/types/content.ts'

/**
 * The scripted players (sim/src/policies.ts; 12 Phase 7): they never pace between two rooms to the command cap (the
 * Phase 6 soak's Gravehollow F2, seed 101), they clear a revealed trap that shuts the way, a hurt hero drinks their own
 * potion, and the careful player reads the threat (D-092).
 */
const content = loadContentDir(path.resolve('content'))
const t = content.tuning
const DUNGEON = [...content.dungeons.keys()][0]!
const egg = [...content.pets.values()].find((p) => p.creationChoice)
/** `GV_SWEEP=1 npx vitest run sim/test/policies.test.ts`: the big sweep (every floor, ten times the seeds); `npm test` runs the small one. */
const SWEEP = process.env.GV_SWEEP === '1'

function party(seed: number, members: readonly [string, string][], level = 1): HeroRecord[] {
  let p = newProfile(seed, 'mortal')
  for (const [classId, speciesId] of members) p = addHero(content, p, { name: classId, speciesId, classId, eggPetId: egg?.id ?? null }).profile
  return level > 1 ? p.heroes.map((h) => heroAtLevel(content, t, h, level)) : p.heroes
}

function options(seed: number, policy: PolicyName, floor = 1, deathRule: DelveOptions['deathRule'] = 'mortal'): DelveOptions {
  return { dungeonId: DUNGEON, floor, seed, difficulty: 'normal', pactIds: [], auto: true, policy, deathRule }
}

const SOAK: [string, string][] = [
  ['warden', 'dwarf'],
  ['blade', 'orc'],
  ['mender', 'elf'],
  ['arcanist', 'draconid'],
]

describe('the scripted players never pace to the command cap', () => {
  it('the Phase 6 soak delve (seed 101, through Gravehollow F2) ends long before the cap', () => {
    const s = runDelveAuto(content, createDelve(content, options(101, 'textbook'), party(101, SOAK, 4)), 5000)
    expect(s.phase.kind).toBe('over')
    if (s.phase.kind === 'over') expect(s.phase.outcome).not.toBe('capped')
    expect(s.commandLog.length).toBeLessThan(300)
  })

  it('a sweep of seeds, parties, start floors and players: every delve ends, none stuck or capped, all well under the cap', () => {
    const parties: [string, string][][] = [[['warden', 'human']], SOAK, [['mender', 'human'], ['warden', 'human'], ['ranger', 'human']], [['blade', 'halfling'], ['mender', 'human']]]
    const floors = content.dungeons.get(DUNGEON)!.floors.map((f) => f.floor).filter((f) => SWEEP || f <= 3)
    let delves = 0
    let longest = 0
    const bad: string[] = []
    for (const policy of ['textbook', 'cautious', 'greedy', 'careful'] as const) {
      for (const [pi, members] of parties.entries()) {
        for (const floor of floors) {
          for (let seed = 1; seed <= (SWEEP ? 20 : 1); seed++) {
            const s = runDelveAuto(content, createDelve(content, options(seed * 7 + pi, policy, floor), party(seed, members, pi % 2 ? 4 : 1)), 5000)
            delves++
            longest = Math.max(longest, s.commandLog.length)
            if (s.phase.kind !== 'over' || s.phase.outcome === 'capped') bad.push(`${policy} party ${pi} F${floor} seed ${seed}: ${s.phase.kind === 'over' ? s.phase.summary : s.phase.kind}`)
          }
        }
      }
    }
    expect(bad).toEqual([])
    expect(delves).toBeGreaterThanOrEqual(48)
    expect(longest).toBeLessThan(500)
  }, 600_000)
})

describe('the Iron Oath: no way home, so the scripted players push on', () => {
  it('every player but random ends its delve without the cap when retreat is forbidden (07 §6.2)', () => {
    const bad: string[] = []
    for (const policy of ['textbook', 'cautious', 'greedy', 'careful'] as const) {
      for (let seed = 1; seed <= (SWEEP ? 12 : 3); seed++) {
        const s = runDelveAuto(content, createDelve(content, { ...options(seed, policy), pactIds: ['iron-oath'] }, party(seed, [['warden', 'human'], ['mender', 'human']])), 3000)
        expect(s.ruleFlags).toContain('no-retreat')
        if (s.phase.kind !== 'over' || s.phase.outcome === 'capped' || s.phase.outcome === 'retreated') bad.push(`${policy} seed ${seed}: ${s.phase.kind === 'over' ? `${s.phase.outcome}: ${s.phase.summary}` : s.phase.kind}`)
      }
    }
    expect(bad).toEqual([])
  }, 300_000)
})

/** A delve standing in its entry room with a revealed trap shutting the only door on: the textbook case of the loop. */
function trappedAtEntry(policy: PolicyName): DelveState {
  const s = createDelve(content, options(3, policy), party(3, [['mender', 'human']]))
  const entry = s.floor.graph.rooms.find((r) => r.id === s.floor.graph.entryId)!
  const next = entry.doors[0]!.to
  const trapId = content.dungeons.get(DUNGEON)!.traps.reduce((a, b) => (b.difficulty > a.difficulty ? b : a)).id
  s.floor.rooms[entry.id]!.traps = [{ trapId, revealed: true, disarmed: false, triggered: false, blocksDoorTo: next }]
  return s
}

describe('a revealed trap that shuts the way is cleared, never walked around in circles', () => {
  it('routeToward answers the shut door with the best disarm of that trap', () => {
    const s = trappedAtEntry('textbook')
    const enabled = legalDelveActions(content, s).filter((a) => a.enabled)
    expect(enabled.some((a) => a.command.kind === 'move')).toBe(false)
    const unvisited = new Set(s.floor.graph.rooms.filter((r) => !s.floor.rooms[r.id]!.visited).map((r) => r.id))
    const cmd = routeToward(s, enabled, unvisited)
    expect(cmd?.kind === 'disarm' || cmd?.kind === 'walkAround').toBe(true)
    if (cmd?.kind === 'disarm') expect(cmd.trapIndex).toBe(0)
  })

  it('every scripted player but random gets past it within a few commands', () => {
    for (const policy of ['textbook', 'cautious', 'greedy', 'careful'] as const) {
      const s = trappedAtEntry(policy)
      const pick = choosePolicyCommand(policy, s, legalDelveActions(content, s), Rng.fromSeed(1), content)
      expect(pick?.kind === 'disarm' || pick?.kind === 'walkAround', policy).toBe(true)
      // The sim marks the trap in place (disarmed, or triggered by a fumble or by setting it off).
      const trap = s.floor.rooms[s.floor.graph.entryId]!.traps[0]!
      const done = runDelveAuto(content, s, 400)
      expect(trap.disarmed || trap.triggered, policy).toBe(true)
      if (done.phase.kind === 'over') expect(done.phase.outcome, policy).not.toBe('capped')
    }
  })
})

describe('a potion heals the hero who drinks it', () => {
  it('the most hurt hero drinks their own, not a healthy hero', () => {
    const s = createDelve(content, options(5, 'textbook'), party(5, [['warden', 'human'], ['blade', 'human']]))
    s.heroes[0]!.hpPercent = 30
    const pick = choosePolicyCommand('textbook', s, legalDelveActions(content, s), Rng.fromSeed(1), content)
    expect(pick).toMatchObject({ kind: 'useItem', heroIndex: 0 })
  })

  it('a hurt hero without a potion is not cured by a healthy hero drinking one', () => {
    const s = createDelve(content, options(5, 'textbook'), party(5, [['warden', 'human'], ['blade', 'human']]))
    s.heroes[0]!.hpPercent = 30
    s.heroes[0]!.record = { ...s.heroes[0]!.record, bag: s.heroes[0]!.record.bag.filter((b) => !/potion/.test(b.itemId)) }
    const pick = choosePolicyCommand('textbook', s, legalDelveActions(content, s), Rng.fromSeed(1), content)
    expect(pick?.kind === 'useItem' && /potion/.test(String(s.heroes[pick.heroIndex]?.record.bag.find((b) => b.instanceId === pick.instanceId)?.itemId))).toBe(false)
  })
})

describe('the careful player reads the threat (D-092)', () => {
  const lastCellarFloor = content.dungeons.get(DUNGEON)!.zones[0]!.floors.to
  const bossFloor = content.dungeons.get(DUNGEON)!.floors.find((f) => f.bossId && f.floor <= lastCellarFloor)!

  it("a fresh party sent to the Captain's floor reads her Deadly and walks out at once", () => {
    const fresh = party(9, [['warden', 'human'], ['mender', 'human']])
    const read = carefulRead(createDelve(content, options(9, 'careful', bossFloor.floor), fresh), [], content)
    expect(read.floorTooFar).toBe(true)
    const careful = runDelveAuto(content, createDelve(content, options(9, 'careful', bossFloor.floor), fresh), 400)
    expect(careful.phase.kind === 'over' && careful.phase.outcome).toBe('retreated')
    expect(careful.stats.fights).toBe(0)
    expect(careful.stats.falls).toBe(0)
    // The textbook player goes in.
    const textbook = runDelveAuto(content, createDelve(content, options(9, 'textbook', bossFloor.floor), fresh), 400)
    expect(textbook.stats.fights).toBeGreaterThan(0)
  })

  it('at the stairs it reads the next floor, and a ready party goes on', () => {
    const fresh = createDelve(content, options(9, 'careful', bossFloor.floor - 1), party(9, [['warden', 'human']]))
    expect(carefulRead(fresh, [], content).nextFloorTooFar).toBe(true)
    const ready = createDelve(content, options(9, 'careful', bossFloor.floor - 1), party(9, [['warden', 'human']], 12))
    expect(carefulRead(ready, [], content).nextFloorTooFar).toBe(false)
    expect(carefulRead(ready, [], content).floorTooFar).toBe(false)
  })

  it('without the content it reads only the threat the move actions carry', () => {
    const s = createDelve(content, options(9, 'careful', bossFloor.floor), party(9, [['warden', 'human']]))
    const read = carefulRead(s, legalDelveActions(content, s))
    expect(read.floorTooFar).toBe(false)
    expect(read.nextFloorTooFar).toBe(false)
  })

  it('dies no more often than the textbook player across a sweep', () => {
    let careful = 0
    let textbook = 0
    for (let seed = 1; seed <= (SWEEP ? 24 : 6); seed++) {
      const heroes = party(seed, [['warden', 'human'], ['blade', 'human']])
      careful += runDelveAuto(content, createDelve(content, options(seed, 'careful'), heroes), 3000).stats.falls
      textbook += runDelveAuto(content, createDelve(content, options(seed, 'textbook'), heroes), 3000).stats.falls
    }
    expect(careful).toBeLessThanOrEqual(textbook)
  })
})
