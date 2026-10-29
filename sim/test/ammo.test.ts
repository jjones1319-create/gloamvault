import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { ammoItemFor, emptyQuiver, fightAmmoFor, hasAmmoFor, heroAmmo, quiverAfterFight, quiverCount, quiverRefill, skillAmmoCost, stowAmmo, withQuiver } from '../src/ammo.ts'
import { createDelve, runDelveAuto } from '../src/delve.ts'
import { applyFightCommand, createFight, legalFightActions, runFight } from '../src/fight.ts'
import type { Actor } from '../src/fight-types.ts'
import { buildHeroActor, createHero } from '../src/hero.ts'
import { createItemInstance } from '../src/items.ts'
import { buildMonsterActor } from '../src/monsters.ts'
import { Rng } from '../src/rng.ts'
import { addHero, newProfile, repairAll, repairAllQuote } from '../src/town.ts'
import type { HeroRecord } from '../src/types/content.ts'

const content = loadContentDir(path.resolve('content'))
const t = content.tuning

function ranger(id = 'r1'): HeroRecord {
  return createHero(content, t, Rng.fromSeed(5), { id, name: 'Pip', speciesId: 'halfling', classId: 'ranger', eggPetId: 'rat-prince' })
}

/** A Ranger in a fight against two rats, with `left` arrows counted. */
function rangerFight(left: number, actives: (string | null)[] = ['ranger-aimed-shot', null, null, null]) {
  const r = ranger()
  const record: HeroRecord = { ...r, skills: [...r.skills, { skillId: 'ranger-volley', rank: 1, xp: 0 }], loadout: { ...r.loadout, actives: actives as never } }
  const hero = buildHeroActor(content, t, record, { id: 'hero-0', row: 'back' })
  hero.hero!.ammo = { itemId: 'arrows', left, spent: 0 }
  const rat = content.monsters.get('giant-rat')!
  const monsters: Actor[] = [buildMonsterActor(content, t, rat, { id: 'rat-a', level: 1, row: 'front', hpPercent: 100 }), buildMonsterActor(content, t, rat, { id: 'rat-b', level: 1, row: 'back', hpPercent: 100 })]
  const fight = createFight(content, t, { heroes: [hero], pets: [], monsters, surprised: 'enemy', light: 100, options: { dungeonId: 'gravehollow-keep', floor: 1, floorLevel: 1 }, rng: Rng.fromSeed(11) })
  runFight(content, t, fight)
  return { fight, hero }
}

describe('the quiver (08 §4, D-099)', () => {
  it('bows draw arrows and crossbows bolts; throwing knives are not ammo', () => {
    expect(ammoItemFor(t, 'shortbow')).toBe('arrows')
    expect(ammoItemFor(t, 'longbow')).toBe('arrows')
    expect(ammoItemFor(t, 'crossbow')).toBe('bolts')
    expect(ammoItemFor(t, 'throwingKnife')).toBeNull()
    expect(ammoItemFor(t, 'sword')).toBeNull()
  })

  it('a hero with no quiver entry has a full one; the count clamps to what a hero can carry', () => {
    const r = ranger()
    expect(heroAmmo(content, t, r)).toMatchObject({ itemId: 'arrows', count: t.ammo.quiverMax, max: t.ammo.quiverMax, low: false })
    expect(quiverCount(t, withQuiver(t, r, 'arrows', 9999), 'arrows')).toBe(t.ammo.carryMax)
    expect(heroAmmo(content, t, withQuiver(t, r, 'arrows', t.ammo.lowAt))?.low).toBe(true)
    const warden = createHero(content, t, Rng.fromSeed(5), { id: 'w', name: 'W', speciesId: 'human', classId: 'warden' })
    expect(heroAmmo(content, t, warden)).toBeNull()
  })

  it('Repair all refills the quiver at the ammo’s own price (its value buys a stack)', () => {
    let p = addHero(content, newProfile(3), { name: 'Pip', speciesId: 'halfling', classId: 'ranger', eggPetId: 'rat-prince' }).profile
    const id = p.heroes[0]!.id
    p = { ...p, purse: 500, heroes: p.heroes.map((h) => withQuiver(t, h, 'arrows', 40)) }
    const refill = quiverRefill(content, t, p.heroes[0]!)!
    const arrows = content.items.get('arrows')!
    expect(refill).toEqual({ itemId: 'arrows', missing: t.ammo.quiverMax - 40, gold: Math.round((60 * arrows.value) / arrows.ammo!.stack) })
    const quote = repairAllQuote(content, p, id)
    expect(quote.ammo).toEqual(refill)
    const after = repairAll(content, p, id)
    expect(quiverCount(t, after.heroes[0]!, 'arrows')).toBe(t.ammo.quiverMax)
    expect(after.purse).toBe(500 - quote.gold)
    expect(repairAllQuote(content, after, id).ammo).toBeNull()
  })

  it('a stack found or bought goes to the archer’s quiver; nobody draws it, it stays an item', () => {
    const heroes = [{ record: createHero(content, t, Rng.fromSeed(1), { id: 'w', name: 'W', speciesId: 'human', classId: 'warden' }), fallen: false }, { record: withQuiver(t, ranger(), 'arrows', 10), fallen: false }]
    const stack = createItemInstance(content, Rng.fromSeed(2), 'arrows')
    expect(stowAmmo(content, t, heroes, stack)).toBe(1)
    expect(quiverCount(t, heroes[1]!.record, 'arrows')).toBe(10 + content.items.get('arrows')!.ammo!.stack)
    expect(stowAmmo(content, t, [heroes[0]!], stack)).toBeNull()
  })
})

describe('arrows in a fight', () => {
  it('a basic shot spends an arrow; the count rides back into the quiver', () => {
    const { fight, hero } = rangerFight(5)
    expect(fight.pendingActorId).toBe('hero-0')
    const basic = legalFightActions(content, t, fight).find((a) => a.command.kind === 'basic')!
    expect(basic.label).toBe('Attack')
    applyFightCommand(content, t, fight, basic.command)
    expect(hero.hero!.ammo).toMatchObject({ left: 4, spent: 1 })
    const back = quiverAfterFight(ranger(), hero)
    expect(back.quiver?.arrows).toBe(4)
  })

  it('an empty quiver bashes the front row; shot skills grey out', () => {
    const { fight, hero } = rangerFight(0)
    expect(emptyQuiver(hero.hero)).toBe(true)
    const actions = legalFightActions(content, t, fight)
    const basic = actions.find((a) => a.command.kind === 'basic')!
    expect(basic.label).toBe('Bash (no arrows)')
    expect(basic.targets).toEqual(['rat-a'])
    const aimed = actions.find((a) => a.command.kind === 'skill')!
    expect(aimed.enabled).toBe(false)
    expect(aimed.reason).toMatch(/arrows/)
    applyFightCommand(content, t, fight, basic.command)
    expect(fight.log.some((e) => e.kind === 'action' && e.data?.bash === true)).toBe(true)
  })

  it('a volley needs its three arrows', () => {
    const volley = content.skills.get('ranger-volley')!
    expect(skillAmmoCost(volley)).toBe(3)
    const { hero } = rangerFight(2, ['ranger-volley', null, null, null])
    expect(hasAmmoFor(hero.hero, volley)).toBe(false)
    hero.hero!.ammo!.left = 3
    expect(hasAmmoFor(hero.hero, volley)).toBe(true)
  })

  it('Forager’s Instinct brings back half of what a fight spent', () => {
    const { hero } = rangerFight(10)
    hero.hero!.ammo = { itemId: 'arrows', left: 4, spent: 6 }
    hero.hooks.push({ customId: 'recover-ammo-percent', line: { kind: 'custom', customId: 'recover-ammo-percent', percent: 50 }, sourceId: 'hero-0', sourceSkillId: 'ranger-foragers-instinct', turnsLeft: null, untilTurnStart: false, counter: 0, data: {} })
    expect(quiverAfterFight(ranger(), hero).quiver?.arrows).toBe(7)
  })

  it('a fight the delve did not hand a quiver counts nothing', () => {
    const { hero } = rangerFight(5)
    hero.hero!.ammo = null
    expect(emptyQuiver(hero.hero)).toBe(false)
    expect(quiverAfterFight(ranger(), hero).quiver).toBeUndefined()
  })
})

describe('arrows in a delve', () => {
  it('the delve hands each fight the quiver and keeps what is left', () => {
    const r = ranger()
    expect(fightAmmoFor(content, t, r)).toEqual({ itemId: 'arrows', left: t.ammo.quiverMax, spent: 0 })
    const state = runDelveAuto(content, createDelve(content, { dungeonId: 'gravehollow-keep', floor: 1, lastFloor: 1, seed: 23, difficulty: 'normal', pactIds: [], auto: true, policy: 'textbook', deathRule: 'sheltered' }, [r]), 2000)
    expect(state.stats.fights).toBeGreaterThan(0)
    expect(quiverCount(t, state.heroes[0]!.record, 'arrows')).toBeLessThan(t.ammo.quiverMax)
  })
})
