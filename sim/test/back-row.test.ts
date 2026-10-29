import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import type { EffectContext } from '../src/effects.ts'
import { createFight, decideHero } from '../src/fight.ts'
import type { Actor, FightState } from '../src/fight-types.ts'
import { buildHeroActor, createHero } from '../src/hero.ts'
import { buildMonsterActor, partyScale } from '../src/monsters.ts'
import { Rng } from '../src/rng.ts'
import { spawnBossFight } from '../src/explore.ts'

/**
 * The Phase 7 balance pass (pass F). (1) Behind every boss the back row went unhit (76–91% of boss fights): the hero
 * AI turns on a back-row add that has dealt more damage this fight than the boss — bows, spells and reach weapons at
 * once, melee once the front is clear. (2) D-128 (Proposed): a boss and its adds scale HP and damage on their own row,
 * `partyScaling.boss`.
 */
const content = loadContentDir(path.resolve('content'))
const t = content.tuning

function hero(classId: string, i: number, row: 'front' | 'back'): Actor {
  const record = createHero(content, t, Rng.fromSeed(7 + i), { id: `h${i}`, name: `h${i}`, speciesId: 'human', classId })
  const a = buildHeroActor(content, t, record, { id: `hero-${i}`, row })
  a.pool = a.poolMax = 500
  return a
}

const monster = (id: string, row: 'front' | 'back', actorId = id) => buildMonsterActor(content, t, content.monsters.get(id)!, { id: actorId, level: 4, row, hpPercent: 100 })

function fightOf(heroes: Actor[], monsters: Actor[]): { f: FightState; ctx: EffectContext } {
  const f = createFight(content, t, { heroes, pets: [], monsters, surprised: null, light: 100, options: { dungeonId: 'gravehollow-keep', floor: 3, floorLevel: 4 }, rng: Rng.fromSeed(3) })
  return { f, ctx: { content, t, state: f, rng: new Rng(f.rng) } }
}

const targetOf = (ctx: EffectContext, a: Actor): string | null => {
  const r = decideHero(ctx, a)
  return 'target' in r && r.target ? r.target.id : null
}

describe('the hero AI turns on a back-row add that out-damages the boss', () => {
  const setup = (classId: string, heroRow: 'front' | 'back') => {
    const h = hero(classId, 0, heroRow)
    const boss = monster('captain-vexa-marrow', 'back', 'boss')
    const front = monster('grinning-cutpurse', 'front', 'cutpurse')
    const back = monster('grinning-crossbowman', 'back', 'crossbowman')
    return { h, boss, front, back, ...fightOf([h], [boss, front, back]) }
  }

  it('a spell (the Arcanist) switches as soon as the add has out-damaged the boss, and not before', () => {
    const { h, boss, back, ctx } = setup('arcanist', 'back')
    expect(targetOf(ctx, h)).not.toBe('crossbowman')
    back.tally.damageDealt = 30
    boss.tally.damageDealt = 30
    expect(targetOf(ctx, h)).not.toBe('crossbowman')
    back.tally.damageDealt = 31
    expect(targetOf(ctx, h)).toBe('crossbowman')
  })

  it('melee (the Warden) keeps to the front row while it stands, then turns on the add', () => {
    const { h, boss, front, back, ctx } = setup('warden', 'front')
    back.tally.damageDealt = 40
    boss.tally.damageDealt = 10
    expect(targetOf(ctx, h)).toBe('cutpurse')
    front.hp = 0
    front.gone = true
    expect(targetOf(ctx, h)).toBe('crossbowman')
  })

  it('outside a boss fight the targets are as before', () => {
    const h = hero('arcanist', 0, 'back')
    const front = monster('grinning-cutpurse', 'front', 'cutpurse')
    const back = monster('grinning-crossbowman', 'back', 'crossbowman')
    const { ctx } = fightOf([h], [front, back])
    back.tally.damageDealt = 50
    front.hp = Math.max(1, Math.floor(front.maxHp / 2))
    // "ember lance on weakest enemy": the hurt cutpurse, not the busy crossbowman.
    expect(targetOf(ctx, h)).toBe('cutpurse')
  })
})

describe('D-128: the boss row', () => {
  it("a boss and its first-phase adds read partyScaling.boss; ordinary monsters keep the fights' row", () => {
    const vexa = content.monsters.get('captain-vexa-marrow')!
    // A distinctive boss row, so the test tells the two rows apart whatever the tuned numbers are.
    const t2 = structuredClone(t)
    const scaling = t2.dungeon.partyScaling as unknown as { hp: number[]; boss: { hp: number[]; damage: number[] } }
    scaling.boss = { hp: [0.3, 0.7, 1.3, 2.1], damage: [0.6, 1.1, 1.2, 1.3] }
    for (const size of [1, 2, 3, 4]) {
      const [boss, add] = spawnBossFight(content, t2, vexa, { level: 4, partySize: size, enemyHpPercent: 100 })
      const at = (id: string, row: 'front' | 'back', hpPercent: number) => buildMonsterActor(content, t2, content.monsters.get(id)!, { id, level: 4, row, hpPercent }).maxHp
      expect(partyScale(t2, size, true)).toMatchObject({ hpPercent: Math.round(scaling.boss.hp[size - 1]! * 100), damagePercent: Math.round(scaling.boss.damage[size - 1]! * 100) })
      expect(boss!.maxHp).toBe(at(vexa.id, boss!.row, Math.round(scaling.boss.hp[size - 1]! * 100)))
      expect(add!.maxHp).toBe(at(add!.monster!.monsterId, add!.row, Math.round(scaling.boss.hp[size - 1]! * 100)))
      expect(partyScale(t2, size, false).hpPercent).toBe(Math.round(scaling.hp[size - 1]! * 100))
    }
  })
})
