/**
 * Pass B's hooks (Phase 7): the set bonuses and named uniques of 08 §6–§7 through the real pipeline — heroes built
 * from the real content wearing the pieces, fights against the Cellars' rats.
 */
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { dealDamage, hookCtx } from '../src/effects.ts'
import { applyFightCommand, createFight, runFight } from '../src/fight.ts'
import type { Actor, FightState } from '../src/fight-types.ts'
import { buildHeroActor, createHero } from '../src/hero.ts'
import { createItemInstance } from '../src/items.ts'
import { buildMonsterActor } from '../src/monsters.ts'
import { Rng } from '../src/rng.ts'
import blockAppliesToSpells from '../src/skills/custom/block-applies-to-spells.ts'
import shieldLowestAllyOnBlock from '../src/skills/custom/shield-lowest-ally-on-block.ts'
import type { Equipment, HeroRecord, ItemInstance } from '../src/types/content.ts'

const content = loadContentDir(path.resolve('content'))
const t = content.tuning

const it_ = (id: string): ItemInstance => createItemInstance(content, Rng.fromSeed(1), id, { instanceId: `x-${id}` })

/** A hero of the class wearing these pieces (slot by the item's own slot), with extra known skills in the loadout. */
function hero(id: string, classId: string, wear: string[], actives?: (string | null)[]): HeroRecord {
  const h = createHero(content, t, Rng.fromSeed(5), { id, name: id, speciesId: 'human', classId, eggPetId: null })
  let eq: Equipment = h.equipment
  for (const itemId of wear) {
    const d = content.items.get(itemId)!
    if (d.slot === 'ring') eq = { ...eq, ring: [it_(itemId), eq.ring[1]] }
    else eq = { ...eq, [d.slot as string]: it_(itemId) }
  }
  const known = new Set(h.skills.map((s) => s.skillId))
  const extra = (actives ?? []).filter((s): s is string => s !== null && !known.has(s)).map((skillId) => ({ skillId, rank: 1, xp: 0 }))
  return { ...h, equipment: eq, skills: [...h.skills, ...extra], ...(actives ? { loadout: { ...h.loadout, actives: actives as never } } : {}) }
}

const SET = (prefix: string, grade = '') => ['helm', 'breastplate', 'greaves', 'sabatons', 'gauntlets'].map((p) => `${prefix}-${p}${grade}`)

/** A fight against two rats; `tough` gives them 10,000 HP so a test's blow never kills. */
function fight(records: HeroRecord[], seed = 11, ratHp = 100, tough = false): { fight: FightState; heroes: Actor[]; rats: Actor[] } {
  const heroes = records.map((r, i) => buildHeroActor(content, t, r, { id: `hero-${i}`, row: i === 0 ? 'front' : 'back' }))
  const rat = content.monsters.get('giant-rat')!
  const rats = ['a', 'b'].map((s, i) => buildMonsterActor(content, t, rat, { id: `rat-${s}`, level: 1, row: i === 0 ? 'front' : 'back', hpPercent: ratHp }))
  if (tough) for (const r of rats) r.hp = r.maxHp = 10_000
  const f = createFight(content, t, { heroes, pets: [], monsters: rats, surprised: 'enemy', light: 100, options: { dungeonId: 'gravehollow-keep', floor: 1, floorLevel: 1 }, rng: Rng.fromSeed(seed) })
  runFight(content, t, f)
  return { fight: f, heroes, rats }
}

describe("the Barrow Warden's Vigil, four pieces: Guard also Taunts every enemy and Fortifies", () => {
  it('a Warden in four Vigil pieces who Guards taunts both rats and is Fortified; with two pieces nothing happens', () => {
    const four = fight([hero('w', 'warden', SET('barrow-wardens').slice(0, 4))])
    const me = four.fight.actors.find((a) => a.id === four.fight.pendingActorId)!
    const before = four.fight.log.length
    applyFightCommand(content, t, four.fight, { kind: 'guard' })
    const after = four.fight.log.slice(before)
    // The Taunt lasts each rat's next turn: every rat's taunt ends in the log, and every rat bit the Warden.
    for (const r of four.rats) expect(after.some((e) => e.kind === 'statusEnd' && e.actorId === r.id && e.data?.status === 'taunt'), r.id).toBe(true)
    expect(after.filter((e) => e.kind === 'action' && e.actorId?.startsWith('rat')).every((e) => e.targetId === me.id)).toBe(true)
    expect(after.some((e) => e.kind === 'status' && e.targetId === me.id && e.data?.status === 'fortify')).toBe(true)
    const two = fight([hero('w', 'warden', SET('barrow-wardens').slice(0, 2))])
    const b2 = two.fight.log.length
    applyFightCommand(content, t, two.fight, { kind: 'guard' })
    expect(two.fight.log.slice(b2).some((e) => e.kind === 'statusEnd' && e.data?.status === 'taunt')).toBe(false)
  })
})

describe("the Tidebound Reaver's Mail, four pieces: basic attacks restore +10% Stamina; Haste on a kill", () => {
  const MAIL = ['tidebound-reavers-coif', 'tidebound-reavers-hauberk', 'tidebound-reavers-chausses', 'tidebound-reavers-treads']
  it('a basic attack restores 10% more Stamina, once per attack', () => {
    const f = fight([hero('b', 'blade', MAIL)], 7, 100, true)
    const me = f.fight.actors.find((a) => a.id === f.fight.pendingActorId)!
    me.pool = 0
    const before = f.fight.log.length
    applyFightCommand(content, t, f.fight, { kind: 'basic', targetId: f.rats[0]!.id })
    const bonus = f.fight.log.slice(before).filter((e) => e.kind === 'setBonus' && e.actorId === me.id)
    expect(bonus).toHaveLength(1)
    expect(bonus[0]!.amount).toBe(Math.floor((me.poolMax * 10) / 100 + 0.5))
    const plain = fight([hero('b', 'blade', [])], 7, 100, true)
    const b2 = plain.fight.log.length
    applyFightCommand(content, t, plain.fight, { kind: 'basic', targetId: plain.rats[0]!.id })
    expect(plain.fight.log.slice(b2).some((e) => e.kind === 'setBonus')).toBe(false)
  })

  it('a kill gives Haste', () => {
    for (let seed = 1; seed < 40; seed++) {
      const f = fight([hero('b', 'blade', MAIL)], seed, 1)
      const me = f.fight.actors.find((a) => a.id === f.fight.pendingActorId)
      if (!me) continue
      applyFightCommand(content, t, f.fight, { kind: 'basic', targetId: f.rats[0]!.id })
      if (!f.rats[0]!.gone) continue
      expect(me.statuses.some((s) => s.id === 'haste')).toBe(true)
      return
    }
    throw new Error('no seed landed the killing blow')
  })
})

describe("the Drowned Choir's Vestments, four pieces: a Chilled target hit by your Frost spell Freezes", () => {
  it('Frostbolt on a Chilled rat freezes it', () => {
    const ROBES = ['drowned-choirs-cowl', 'drowned-choirs-robe', 'drowned-choirs-leggings', 'drowned-choirs-slippers']
    for (let seed = 1; seed < 40; seed++) {
      const f = fight([hero('a', 'arcanist', ROBES, ['arcanist-frostbolt', null, null, null])], seed, 100, true)
      const me = f.fight.actors.find((a) => a.id === f.fight.pendingActorId)
      if (!me) continue
      const rat = f.rats[0]!
      rat.statuses.push({ id: 'chill', stacks: 1, turnsLeft: 3, magnitude: 0, sourceId: me.id } as never)
      const before = f.fight.log.length
      applyFightCommand(content, t, f.fight, { kind: 'skill', slot: 0, targetId: rat.id })
      const hit = f.fight.log.slice(before).some((e) => e.kind === 'damage' && e.actorId === me.id && e.targetId === rat.id)
      if (!hit || rat.gone) continue
      expect(f.fight.log.slice(before).some((e) => e.kind === 'setBonus' && e.targetId === rat.id)).toBe(true)
      return
    }
    throw new Error('no seed landed the Frostbolt')
  })
})

describe("the Lanternkeeper's Habit, four pieces: Holy spells grant Regen 2 rounds", () => {
  it('a Mend gives the lowest ally Regen', () => {
    const HABIT = ['lanternkeepers-cowl', 'lanternkeepers-robe', 'lanternkeepers-leggings', 'lanternkeepers-slippers']
    const f = fight([hero('m', 'mender', HABIT), hero('b', 'blade', [])])
    const me = f.fight.actors.find((a) => a.id === f.fight.pendingActorId)!
    const other = f.heroes.find((h) => h.id !== me.id)!
    other.hp = Math.floor(other.maxHp / 4)
    const slot = me.hero!.actives.indexOf('mender-mend')
    applyFightCommand(content, t, f.fight, { kind: 'skill', slot, targetId: other.id })
    expect(other.statuses.find((s) => s.id === 'regen')).toMatchObject({ magnitude: 5 })
  })
})

describe('the named uniques\' hooks (08 §7)', () => {
  it("the Shieldbrother's Kite: a block Shields the lowest ally for 5% of their max HP", () => {
    const f = fight([hero('w', 'warden', ['shieldbrothers-kite']), hero('m', 'mender', [])])
    const warden = f.heroes[0]!
    const mender = f.heroes[1]!
    mender.hp = Math.floor(mender.maxHp / 3)
    const rng = new Rng(f.fight.rng)
    const ctx = { content, t, state: f.fight, rng }
    const hook = warden.hooks.find((h) => h.customId === 'shield-lowest-ally-on-block')!
    expect(hook).toBeDefined()
    shieldLowestAllyOnBlock.onBlock!(hookCtx(ctx, warden, null, hook.line, hook), { amount: 10, damageType: 'slash', attacker: f.rats[0]!, isSingleTarget: true, isDot: false, isUltimate: false, isMelee: true, physical: true })
    expect(mender.statuses.find((s) => s.id === 'shield')?.magnitude).toBe(Math.floor((mender.maxHp * 5) / 100 + 0.5))
  })

  it('the Wyrmward Buckler: a spell hit is halved on a block roll; physical hits are left to the normal block', () => {
    const f = fight([hero('s', 'shade', ['wyrmward-buckler'])])
    const shade = f.heroes[0]!
    const hook = shade.hooks.find((h) => h.customId === 'block-applies-to-spells')!
    expect(hook).toBeDefined()
    const ctx = { content, t, state: f.fight, rng: new Rng(f.fight.rng) }
    const incoming = { amount: 40, damageType: 'frost' as const, attacker: f.rats[0]!, isSingleTarget: true, isDot: false, isUltimate: false, isMelee: false, physical: false }
    shade.base = { ...shade.base, block: 100 }
    expect(blockAppliesToSpells.incomingDamagePercent!(hookCtx(ctx, shade, null, hook.line, hook), incoming)).toBe(-50)
    expect(blockAppliesToSpells.incomingDamagePercent!(hookCtx(ctx, shade, null, hook.line, hook), { ...incoming, damageType: 'slash', physical: true })).toBe(0)
    expect(blockAppliesToSpells.incomingDamagePercent!(hookCtx(ctx, shade, null, hook.line, hook), { ...incoming, isDot: true })).toBe(0)
    const full = dealDamage(ctx, f.rats[0]!, shade, { amount: 40, damageType: 'frost', canMiss: false, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: false, ignoresDefense: true, sourceLabel: 'test' })
    expect(full.dealt).toBeLessThanOrEqual(21)
  })

  it('the Cinderborn Talisman: the Ultimate burns every enemy it hit', () => {
    for (let seed = 1; seed < 30; seed++) {
      const record = hero('b', 'blade', ['cinderborn-talisman'])
      const cls = content.classes.get('blade')!
      const withUlt = { ...record, skills: [...record.skills, { skillId: cls.ultimateSkillId, rank: 1, xp: 0 }] }
      const f = fight([withUlt], seed, 100, true)
      const me = f.fight.actors.find((a) => a.id === f.fight.pendingActorId)
      if (!me) continue
      me.momentum = t.derived.momentum.ultimateCost
      const before = f.fight.log.length
      applyFightCommand(content, t, f.fight, { kind: 'ultimate', targetId: f.rats[0]!.id })
      const hit = f.fight.log.slice(before).filter((e) => e.kind === 'damage' && e.actorId === me.id && (e.amount ?? 0) > 0).map((e) => e.targetId)
      const alive = f.rats.filter((r) => hit.includes(r.id) && !r.gone)
      if (alive.length === 0) continue
      for (const r of alive) expect(r.statuses.some((s) => s.id === 'burn'), r.id).toBe(true)
      return
    }
    throw new Error('no seed left a burning rat')
  })

  it('the Emberheart Ring: +10% to the wearer\'s Fire hits', () => {
    const f = fight([hero('a', 'arcanist', ['emberheart-ring'])])
    expect(f.heroes[0]!.hooks.find((h) => h.customId === 'element-damage-percent')?.line).toMatchObject({ damageType: 'fire', percent: 10 })
  })
})
