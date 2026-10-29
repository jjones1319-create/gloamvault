import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDelve, hashDelve, runDelveAuto } from '../../sim/src/delve.ts'
import type { DelveOptions } from '../../sim/src/delve-types.ts'
import { heroAtLevel } from '../../sim/src/hero.ts'
import { addHero, newProfile } from '../../sim/src/town.ts'
import { loadContentDir } from '../sim/loadContent.ts'
import { playDelve } from './collect.ts'

/**
 * The balance runner's window on a delve (tools/balance/collect.ts): watching changes nothing (the same hash as the
 * delve played unwatched), and the per-floor and per-fight rows add up to the delve's own totals.
 */
const content = loadContentDir(path.resolve('content'))
const DUNGEON = [...content.dungeons.keys()][0]!
const egg = [...content.pets.values()].find((p) => p.creationChoice)

function heroes(seed: number, level: number) {
  let p = newProfile(seed, 'mortal')
  for (const c of ['warden', 'blade', 'mender', 'arcanist']) p = addHero(content, p, { name: c, speciesId: 'human', classId: c, eggPetId: egg?.id ?? null }).profile
  return p.heroes.map((h) => (level > 1 ? heroAtLevel(content, content.tuning, h, level) : h))
}

const options = (seed: number): DelveOptions => ({ dungeonId: DUNGEON, zone: 1, seed, difficulty: 'normal', pactIds: [], auto: true, policy: 'textbook', deathRule: 'mortal' })

describe('playDelve', () => {
  it('plays exactly the delve runDelveAuto plays', () => {
    for (let seed = 1; seed <= 3; seed++) {
      const party = heroes(seed, 3)
      const plain = runDelveAuto(content, createDelve(content, options(seed), party), 3000)
      const watched = playDelve(content, options(seed), party, 3000)
      expect(hashDelve(watched.state)).toBe(hashDelve(plain))
      expect(watched.delve.commands).toBe(plain.commandLog.length)
    }
  })

  it("adds up: the floors' rows sum to the delve's, and every fight has a row", () => {
    for (let seed = 1; seed <= 3; seed++) {
      const played = playDelve(content, options(seed), heroes(seed, seed % 2 ? 1 : 5), 3000)
      const { delve, floors, fights } = played
      expect(floors.length).toBe(delve.floorReached - delve.startFloor + 1)
      expect(floors.map((f) => f.floor)).toEqual(floors.map((_, i) => delve.startFloor + i))
      const sum = (pick: (f: (typeof floors)[number]) => number) => floors.reduce((s, f) => s + pick(f), 0)
      expect(sum((f) => f.fights)).toBe(delve.fights)
      expect(sum((f) => f.goldFound)).toBe(delve.goldFound)
      expect(sum((f) => f.roomsVisited)).toBe(delve.rooms)
      expect(sum((f) => f.downs)).toBe(delve.downs)
      expect(sum((f) => f.falls)).toBe(delve.falls)
      expect(fights.length).toBe(delve.fights)
      expect(fights.filter((f) => f.boss !== null).length).toBe(played.state.stats.bossFights)
      for (const f of fights) for (const h of f.heroes) expect(h.damageDealt).toBeGreaterThanOrEqual(0)
      // Every floor but the last ends on the way down; the last ends the way the delve did.
      expect(floors.slice(0, -1).every((f) => f.end === 'down')).toBe(true)
      expect(floors[floors.length - 1]!.end).toBe(delve.outcome === 'cleared' ? 'down' : delve.outcome)
    }
  })
})
