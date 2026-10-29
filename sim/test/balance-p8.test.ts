import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { championHpPercent, spawnEncounter } from '../src/explore.ts'
import { fightGold, lootTableForFloor, type FightLootInput, type FightMonster } from '../src/loot.ts'
import { partyScale } from '../src/monsters.ts'
import { Rng } from '../src/rng.ts'
import { roundHalfUp } from '../src/stats.ts'
import type { Tuning } from '../src/tuning.ts'
import type { EncounterDef, MonsterDef } from '../src/types/content.ts'

/**
 * Phase 8, pass D — the balance rules: a fight's gold undoes the party-size count rule (Proposed), and the numbers the
 * balance pass moved stay where the report put them.
 */
const content = loadContentDir(path.resolve('content'))
const t = content.tuning
const def = (id: string) => content.monsters.get(id) as MonsterDef
const mon = (id: string): FightMonster => ({ def: def(id), level: 2, champion: false, eliteAffixIds: [], partBroken: false })
const input = (monsters: FightMonster[], partySize?: number): FightLootInput => ({ dungeonId: 'gravehollow-keep', floor: 2, monsters, lightBand: 'radiant', luck: 10, ...(partySize !== undefined ? { partySize } : {}) })

/** The table's roll the next fightGold call will make (the same seed, the same first draw). */
function rollAt(seed: number): number {
  const table = lootTableForFloor(content, 'gravehollow-keep', 2)
  return Rng.fromSeed(seed).range(table.goldRange.min, table.goldRange.max)
}
function goldAt(seed: number, i: FightLootInput): number {
  return fightGold(content, Rng.fromSeed(seed), lootTableForFloor(content, 'gravehollow-keep', 2), i)
}

describe("a fight's gold undoes the party-size count rule (Phase 8, Proposed: a four's fight pays like a trio's)", () => {
  it('a trio, and a fight with no party size, pay as before: the roll × Σ gold× ÷ 3', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rats = [mon('giant-rat'), mon('giant-rat'), mon('giant-rat')]
      expect(goldAt(seed, input(rats, 3))).toBe(rollAt(seed))
      expect(goldAt(seed, input(rats))).toBe(rollAt(seed))
    }
  })

  it("a solo's two rats and a four's five pay a trio's three: each count scale undone", () => {
    const solo = partyScale(t, 1).countPercent
    const four = partyScale(t, 4).countPercent
    expect([solo, four]).toEqual([60, 160])
    for (let seed = 1; seed <= 40; seed++) {
      const r = rollAt(seed)
      expect(goldAt(seed, input([mon('giant-rat'), mon('giant-rat')], 1))).toBe(roundHalfUp((r * ((2 * 100) / solo)) / 3))
      expect(goldAt(seed, input(Array.from({ length: 5 }, () => mon('giant-rat')), 4))).toBe(roundHalfUp((r * ((5 * 100) / four)) / 3))
    }
  })

  it('the roles the count rule leaves alone — a Special, a Monster, a hunter, a boss — pay the same for any party', () => {
    const fixed = ['old-gnaw', 'captain-vexa-marrow', 'broodmother', 'grinning-hexer'].filter((id) => content.monsters.has(id))
    expect(fixed.length).toBeGreaterThanOrEqual(3)
    for (const id of fixed) {
      expect(['special', 'monster', 'hunter', 'boss']).toContain(def(id).role)
      for (const size of [1, 2, 4]) expect(goldAt(7, input([mon(id)], size)), `${id} × ${size}`).toBe(goldAt(7, input([mon(id)], 3)))
    }
  })
})

describe('champion HP by zone (Phase 8, Proposed: dungeon.championHpPercentByZone)', () => {
  it("the Cellars ×4 (133% of the affix's ×3); the Crypts, the Vault and any zone or dungeon not listed 100%", () => {
    expect([0, 1, 2].map((z) => championHpPercent(t, 'gravehollow-keep', z))).toEqual([133, 100, 100])
    expect(championHpPercent(t, 'gravehollow-keep', 7)).toBe(100)
    expect(championHpPercent(t, 'no-such-keep', 0)).toBe(100)
  })

  it("a Cellars champion stands on 4/3 of the HP it had; its pack-mates and a Crypts champion keep theirs", () => {
    // The same tuning without the table: every champion at the affix's own ×3.
    const plain = JSON.parse(JSON.stringify(t)) as Tuning
    Reflect.deleteProperty(plain.dungeon, 'championHpPercentByZone')
    const spawn = (tuning: Tuning, encounter: EncounterDef, level: number) =>
      spawnEncounter(content, tuning, Rng.fromSeed(3), encounter, { level, partySize: 3, enemyHpPercent: 100, enemyCountPercent: 100, championAffixIds: ['rabid'] })
    const cellars = [...content.encounters.values()].find((e) => e.dungeonId === 'gravehollow-keep' && e.floorBand.max <= 3)!
    const crypts = [...content.encounters.values()].find((e) => e.dungeonId === 'gravehollow-keep' && e.floorBand.min >= 4 && e.floorBand.max <= 6)!
    const a = spawn(t, cellars, 2)
    const b = spawn(plain, cellars, 2)
    const champ = (xs: typeof a) => xs.find((x) => x.monster?.champion)!
    expect(champ(a).maxHp).toBe(roundHalfUp((champ(b).maxHp * 133) / 100))
    expect(a.filter((x) => !x.monster?.champion).map((x) => x.maxHp)).toEqual(b.filter((x) => !x.monster?.champion).map((x) => x.maxHp))
    expect(champ(spawn(t, crypts, 6)).maxHp).toBe(champ(spawn(plain, crypts, 6)).maxHp)
  })
})

describe('the Dread reference party (Phase 8: round 2 §13.4)', () => {
  it('the classic four and the crypt-breakers at L16 with C gear on every stretch, and a plan part that plays them on Dread', () => {
    const runner = t.runner as unknown as { recipes: { id: string; set?: string; level: number; gear: string | null; classes: string[]; clearTarget: unknown }[]; plans: { gravehollow: { name: string; sets: string[]; difficulty: string[] }[] } }
    const dread = runner.recipes.filter((r) => r.set === 'dread')
    expect(dread).toHaveLength(8)
    for (const r of dread) expect([r.level, r.gear, r.clearTarget, r.classes.length === 4 || r.classes.length === 3]).toEqual([16, 'C', null, true])
    expect(runner.plans.gravehollow.find((p) => p.name === 'dread')).toMatchObject({ sets: ['dread'], difficulty: ['dread'] })
  })
})
