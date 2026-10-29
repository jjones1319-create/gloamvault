import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { createDelve, legalDelveActions, stepDelve } from '../src/delve.ts'
import type { DelveOptions } from '../src/delve-types.ts'
import { applyFightCommand, createFight, legalFightActions, runFight, runFightAuto } from '../src/fight.ts'
import type { Actor, FightState } from '../src/fight-types.ts'
import { buildHeroActor, createHero } from '../src/hero.ts'
import { createItemInstance } from '../src/items.ts'
import { buildMonsterActor } from '../src/monsters.ts'
import { hollowCoinOffer, isFightRelic, isInstantRelic } from '../src/relics.ts'
import { Rng } from '../src/rng.ts'
import type { HeroRecord, ItemInstance } from '../src/types/content.ts'

const content = loadContentDir(path.resolve('content'))
const t = content.tuning

function relic(id: string): ItemInstance {
  return createItemInstance(content, Rng.fromSeed(1), id, { instanceId: `r-${id}` })
}

function hero(id: string, classId: string, relicId: string | null, aiRule?: string): HeroRecord {
  const h = createHero(content, t, Rng.fromSeed(5), { id, name: id, speciesId: 'human', classId, eggPetId: null })
  return { ...h, equipment: { ...h.equipment, relic: relicId ? relic(relicId) : null }, ...(aiRule ? { aiRule } : {}) }
}

/** A fight against three rats; heroes under a human (the loop stops at the first hero's turn). */
function fightWith(records: HeroRecord[], seed = 11): { fight: FightState; heroes: Actor[] } {
  const heroes = records.map((r, i) => buildHeroActor(content, t, r, { id: `hero-${i}`, row: i === 0 ? 'front' : 'back' }))
  const rat = content.monsters.get('giant-rat')!
  const monsters = ['a', 'b', 'c'].map((s, i) => buildMonsterActor(content, t, rat, { id: `rat-${s}`, level: 1, row: i === 0 ? 'front' : 'back', hpPercent: 100 }))
  const fight = createFight(content, t, { heroes, pets: [], monsters, surprised: 'enemy', light: 100, options: { dungeonId: 'gravehollow-keep', floor: 1, floorLevel: 1 }, rng: Rng.fromSeed(seed) })
  runFight(content, t, fight)
  return { fight, heroes }
}

function pending(fight: FightState): Actor {
  return fight.actors.find((a) => a.id === fight.pendingActorId)!
}

describe('the six zone relics as content (08 §3)', () => {
  it('each has its first grade, its active and its card text; instant ones take no Item action', () => {
    const rows: [string, string, boolean][] = [
      ['hourglass-shard', 'D', true],
      ['the-barrow-bell', 'D', false],
      ['candle-of-the-crypt', 'D', false],
      ['the-brine-pearl', 'C', true],
      ['the-tidebound-idol', 'C', false],
      ['the-hollow-coin', 'C', false],
    ]
    for (const [id, grade, instant] of rows) {
      const d = content.items.get(id)!
      expect(d.grade, id).toBe(grade)
      expect(d.active?.text, id).toBeTruthy()
      expect(isInstantRelic(d), id).toBe(instant)
    }
    expect(isFightRelic(content.items.get('the-hollow-coin')!)).toBe(false)
    expect(content.items.get('the-hollow-coin')!.active).toMatchObject({ timing: 'afterFight', usesPerFloor: 1 })
  })
})

describe('relics in a fight (08 §3: once per fight; an Item action unless instant)', () => {
  it('the Barrow Bell taunts every enemy onto the bearer and Fortifies them; then it is spent', () => {
    const { fight } = fightWith([hero('warden', 'warden', 'the-barrow-bell')])
    const me = pending(fight)
    const line = legalFightActions(content, t, fight).find((a) => a.command.kind === 'relic')
    expect(line).toMatchObject({ label: 'The Barrow Bell', enabled: true })
    applyFightCommand(content, t, fight, { kind: 'relic', targetId: null })
    const rats = fight.actors.filter((a) => a.side === 'enemy' && !a.gone)
    expect(rats.every((r) => r.statuses.some((s) => s.id === 'taunt' && s.sourceId === me.id))).toBe(true)
    expect(me.statuses.some((s) => s.id === 'fortify')).toBe(true)
    expect(me.hero!.relicUsesLeft).toBe(0)
    const again = fight.pendingActorId === me.id ? legalFightActions(content, t, fight).find((a) => a.command.kind === 'relic') : null
    if (again) expect(again).toMatchObject({ enabled: false, reason: 'already used this fight' })
    if (fight.pendingActorId === me.id) expect(() => applyFightCommand(content, t, fight, { kind: 'relic', targetId: null })).toThrow(/no relic/)
  })

  it('the Candle of the Crypt puts Regen (5% of max HP) on the whole party for 3 turns', () => {
    const { fight } = fightWith([hero('mender', 'mender', 'candle-of-the-crypt'), hero('blade', 'blade', null)])
    const me = pending(fight)
    applyFightCommand(content, t, fight, { kind: 'relic', targetId: null })
    for (const h of fight.actors.filter((a) => a.side === 'party')) {
      const regen = h.statuses.find((s) => s.id === 'regen')
      expect(regen, h.id).toBeDefined()
      expect(regen?.magnitude).toBe(5)
    }
    expect(me.hero!.relicUsesLeft).toBe(0)
  })

  it('the Brine Pearl is instant: a Shield on the lowest ally, and the same hero chooses again with no energy spent', () => {
    const { fight, heroes } = fightWith([hero('mender', 'mender', 'the-brine-pearl'), hero('blade', 'blade', null)])
    const me = pending(fight)
    const blade = heroes.find((h) => h.id !== me.id)!
    blade.hp = Math.floor(blade.maxHp / 3)
    const energy = me.energy
    const before = fight.log.length
    applyFightCommand(content, t, fight, { kind: 'relic', targetId: null })
    expect(fight.pendingActorId).toBe(me.id)
    expect(me.energy).toBe(energy)
    const shield = blade.statuses.find((s) => s.id === 'shield')
    expect(shield?.magnitude).toBe(Math.floor((blade.maxHp * 25) / 100 + 0.5))
    expect(fight.log.slice(before).some((e) => e.kind === 'action' && e.data?.relic === 'the-brine-pearl')).toBe(true)
    // The hero's real action still happens this turn.
    applyFightCommand(content, t, fight, { kind: 'guard' })
    expect(fight.pendingActorId === null || fight.pendingActorId !== me.id || fight.over).toBeTruthy()
  })

  it('the Hourglass Shard is instant and makes the next action weigh nothing', () => {
    const run = (useShard: boolean) => {
      const { fight } = fightWith([hero('warden', 'warden', 'hourglass-shard')], 4)
      const me = pending(fight)
      const e0 = me.energy
      if (useShard) {
        applyFightCommand(content, t, fight, { kind: 'relic', targetId: null })
        expect(fight.pendingActorId).toBe(me.id)
        expect(me.hooks.some((h) => h.customId === 'next-action-weightless')).toBe(true)
      }
      applyFightCommand(content, t, fight, { kind: 'guard' })
      return { spent: e0 - me.energy, hookLeft: me.hooks.some((h) => h.customId === 'next-action-weightless') }
    }
    const plain = run(false)
    const shard = run(true)
    expect(plain.spent).toBeGreaterThan(0)
    expect(shard.spent).toBeLessThan(plain.spent)
    expect(shard.hookLeft).toBe(false)
  })

  it('the Tidebound Idol cleanses every debuff on the party', () => {
    const { fight, heroes } = fightWith([hero('blade', 'blade', 'the-tidebound-idol'), hero('mender', 'mender', null)])
    for (const h of heroes) h.statuses.push({ id: 'poison', stacks: 1, turnsLeft: 3, magnitude: 3, sourceId: 'rat-a' } as never, { id: 'weaken', stacks: 1, turnsLeft: 2, magnitude: 0, sourceId: 'rat-a' } as never)
    applyFightCommand(content, t, fight, { kind: 'relic', targetId: null })
    for (const h of heroes) expect(h.statuses.filter((s) => s.id === 'poison' || s.id === 'weaken'), h.id).toEqual([])
  })

  it('a hero AI rule naming the relic uses it; the fight on auto runs to its end', () => {
    const { fight } = fightWith([hero('warden', 'warden', 'the-barrow-bell', 'IF enemies count > 1 THEN item the barrow bell; ELSE attack front enemy')])
    const me = pending(fight)
    applyFightCommand(content, t, fight, { kind: 'auto' })
    expect(me.hero!.relicUsesLeft).toBe(0)
    runFightAuto(content, t, fight)
    expect(fight.over).not.toBeNull()
  })

  it('the Hollow Coin is no fight action', () => {
    const { fight } = fightWith([hero('warden', 'warden', 'the-hollow-coin')])
    expect(legalFightActions(content, t, fight).some((a) => a.command.kind === 'relic')).toBe(false)
  })
})

describe('the Hollow Coin after a fight (08 §3: re-roll this fight\'s item drop, once per floor)', () => {
  const options: DelveOptions = { dungeonId: 'gravehollow-keep', zone: 1, seed: 17, difficulty: 'normal', pactIds: [], auto: false, policy: 'textbook' }

  function afterAWonFight() {
    const state = createDelve(content, options, [hero('warden', 'warden', 'the-hollow-coin')])
    const drop = createItemInstance(content, Rng.fromSeed(8), 'iron-longsword', { instanceId: 'drop-1', rollAffixes: true })
    state.pile = [...state.pile, drop]
    state.lastFightDrop = { pileIndex: state.pile.length - 1 }
    state.phase = { kind: 'result', title: 'Victory', lines: [] }
    return state
  }

  it('offers a re-roll beside Continue; the drop on the pile is rolled again; once per floor', () => {
    const state = afterAWonFight()
    const offer = legalDelveActions(content, state).find((a) => a.command.kind === 'relic')
    expect(offer).toMatchObject({ enabled: true, command: { kind: 'relic', heroIndex: 0 } })
    expect(offer?.label).toMatch(/Re-roll Iron Longsword \(The Hollow Coin\)/)
    const index = state.lastFightDrop!.pileIndex
    stepDelve(content, state, { kind: 'relic', heroIndex: 0 })
    expect(state.pile[index]?.instanceId).not.toBe('drop-1')
    expect(state.floor.relicUses).toEqual({ '0:the-hollow-coin': 1 })
    expect(hollowCoinOffer(content, state)).toBeNull()
    // The next won fight on this floor: no second re-roll.
    state.lastFightDrop = { pileIndex: index }
    expect(hollowCoinOffer(content, state)).toBeNull()
    expect(() => stepDelve(content, state, { kind: 'relic', heroIndex: 0 })).toThrow(/no after-fight relic/)
  })

  it('no drop, no offer; the offer goes when the party continues', () => {
    const state = afterAWonFight()
    state.lastFightDrop = null
    expect(legalDelveActions(content, state).some((a) => a.command.kind === 'relic')).toBe(false)
    const again = afterAWonFight()
    stepDelve(content, again, { kind: 'continue' })
    expect(hollowCoinOffer(content, again)).toBeNull()
  })
})
