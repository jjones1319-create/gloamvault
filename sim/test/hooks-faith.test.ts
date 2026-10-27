import { describe, expect, it } from 'vitest'
import { applyLine, dealDamage, hookCtx, statOf, type DamageInput, type EffectContext, type LineSource } from '../src/effects.ts'
import { createFight } from '../src/fight.ts'
import type { Actor } from '../src/fight-types.ts'
import { installHook } from '../src/hooks.ts'
import { buildMonsterActor } from '../src/monsters.ts'
import { buildPetActor } from '../src/pets.ts'
import { Rng, seedState } from '../src/rng.ts'
import { customHandler } from '../src/skills/custom/index.ts'
import { roundHalfUp } from '../src/stats.ts'
import { countDownStatuses, hasStatus } from '../src/statuses.ts'
import type { Effect, MonsterDef, PetInstance, SkillDef } from '../src/types/content.ts'
import { ELEMENTS, type DamageType } from '../src/types/enums.ts'
import { exactTuning, example, loadTuning, makeContent, makeHeroActor } from './helpers.ts'

/** The faith group: Mender passives and riders, pet traits and actives, the twelve elite affixes. */
const tuning = exactTuning(loadTuning())
const PROVOKE: SkillDef = {
  id: 'warden-provoke',
  classId: 'warden',
  school: 'warcry',
  tier: 1,
  name: 'Provoke',
  description: 'Taunt.',
  type: 'active',
  cost: 8,
  weight: 800,
  target: 'enemy',
  effects: [{ kind: 'taunt', duration: 2 }],
  prerequisiteId: null,
  isUltimate: false,
  monsterTechniqueOf: null,
  rankScaling: { effectPerRank: 4, costPerRank: -2 },
  mastery: { text: 'Taunt 3.', effects: [{ kind: 'taunt', duration: 3 }] },
  tags: ['taunt'],
  xpTags: ['willpower'],
  aiHints: { role: 'control', priority: 70 },
}
const content = makeContent([example('monster', 'monster'), example('pet', 'pet'), { kind: 'skill', path: 'content/skills/warden/warden-provoke.json', json: PROVOKE }])
const ratDef = content.monsters.get('giant-rat') as MonsterDef

const SOURCE: LineSource = { kind: 'skill', id: 'test', label: 'test', isUltimate: false, neverMisses: true, effectPercent: 100, reach: false, ranged: false, isMelee: true }
const BASIC: LineSource = { ...SOURCE, kind: 'basic', id: 'basic', label: 'basic attack' }
const RAT_BITE: LineSource = { kind: 'attack', id: 'bite', label: 'bite', isUltimate: false, neverMisses: true, effectPercent: 100, reach: true, ranged: false, isMelee: true }

function rat(id: string, def: MonsterDef = ratDef): Actor {
  return buildMonsterActor(content, tuning, def, { id, level: 1, row: 'front', hpPercent: 100 })
}

function pet(ownerId: string, stance: PetInstance['stance'] = 'fierce'): Actor {
  const inst: PetInstance = { petId: 'cellar-hound', name: 'Biscuit', grade: 'F', level: 1, xp: 0, bondStars: 0, traitRank: 1, stance, ranchImport: null }
  return buildPetActor(content, tuning, inst, { id: 'pet', ownerId, ownerLevel: 1 })
}

function fight(heroes: Actor[], monsters: Actor[], pets: Actor[] = [], seed = 7): { ctx: EffectContext } {
  const rng = new Rng(seedState(seed, seed + 1))
  const state = createFight(content, tuning, { heroes, pets, monsters, surprised: null, light: 70, options: { dungeonId: 'gravehollow-keep', floor: 1, floorLevel: 1 }, rng })
  return { ctx: { content, t: tuning, state, rng } }
}

/** A hit that lands for exactly `amount` (no roll, no crit, no Defense). */
function hit(amount: number, damageType: DamageType = 'blunt', over: Partial<DamageInput> = {}): DamageInput {
  return { amount, damageType, canMiss: false, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: true, ignoresDefense: true, sourceLabel: 'test', ...over }
}

function custom(customId: string, fields: Omit<Effect, 'kind' | 'customId'> = {}): Effect {
  return { kind: 'custom', customId, ...fields }
}

function first<T>(xs: readonly T[]): T {
  const x = xs[0]
  if (x === undefined) throw new Error('expected a first element')
  return x
}

describe('elite affixes', () => {
  it('Shielded absorbs the first two hits, re-arms once under half HP, then never again', () => {
    const hero = makeHeroActor(tuning, { id: 'h' })
    const champ = rat('champ')
    installHook(champ, custom('absorb-first-hits', { amount: 2, target: 'self' }), 'shielded')
    const { ctx } = fight([hero], [champ])
    const hook = first(champ.hooks)
    expect(hook.counter).toBe(2)
    const max = champ.maxHp
    dealDamage(ctx, hero, champ, hit(5))
    dealDamage(ctx, hero, champ, hit(5))
    expect(champ.hp).toBe(max)
    expect(hook.counter).toBe(0)
    dealDamage(ctx, hero, champ, hit(5))
    expect(champ.hp).toBe(max - 5)
    // Crossing 50% re-arms it once.
    champ.hp = Math.floor(max / 2) + 3
    dealDamage(ctx, hero, champ, hit(5))
    expect(champ.hp * 2).toBeLessThan(max)
    expect(hook.counter).toBe(2)
    expect(hook.data.rearmed).toBe(true)
    const low = champ.hp
    dealDamage(ctx, hero, champ, hit(5))
    dealDamage(ctx, hero, champ, hit(5))
    expect(champ.hp).toBe(low)
    dealDamage(ctx, hero, champ, hit(5))
    expect(champ.hp).toBe(low - 5)
    expect(hook.counter).toBe(0)
    expect(ctx.state.log.filter((e) => e.kind === 'shieldAbsorb')).toHaveLength(4)
    expect(ctx.state.log.filter((e) => e.kind === 'shieldRearm')).toHaveLength(1)
  })

  it('Spiteful bursts on death: Blunt ×1.2 to the front row plus the family status (vermin → Poison)', () => {
    const front = makeHeroActor(tuning, { id: 'f', flatHp: 200 })
    const back = makeHeroActor(tuning, { id: 'b', row: 'back', flatHp: 200 })
    front.base.resistance = 0
    const champ = rat('champ')
    installHook(champ, custom('death-burst', { multiplier: 1.2, damageType: 'blunt', target: 'partyFront' }), 'spiteful')
    const { ctx } = fight([front, back], [champ])
    champ.hp = 1
    const r = dealDamage(ctx, front, champ, hit(5))
    expect(r.killed).toBe(true)
    expect(front.hp).toBeLessThan(front.maxHp)
    expect(hasStatus(front, 'poison')).toBe(true)
    expect(back.hp).toBe(back.maxHp)
    expect(hasStatus(back, 'poison')).toBe(false)
    expect(ctx.state.log.some((e) => e.kind === 'deathBurst')).toBe(true)
  })

  it('Warded rolls an element the template is not weak to; that element deals 0 and pulls it forward', () => {
    const hero = makeHeroActor(tuning, { id: 'h' })
    const champ = rat('champ')
    installHook(champ, custom('element-immunity-random', { energy: 100, target: 'self' }), 'warded')
    const { ctx } = fight([hero], [champ])
    const element = first(champ.hooks).data.element as DamageType
    expect(ELEMENTS as readonly string[]).toContain(element)
    expect(element).not.toBe('fire')
    expect(champ.monster?.immune).toContain(element)
    const energy = champ.energy
    const hp = champ.hp
    dealDamage(ctx, hero, champ, hit(10, element))
    expect(champ.hp).toBe(hp)
    expect(champ.energy).toBe(energy + 100)
    dealDamage(ctx, hero, champ, hit(10, 'blunt'))
    expect(champ.hp).toBe(hp - 10)
    expect(champ.energy).toBe(energy + 100)
  })

  it('Leech drains 15% of the target’s current pool and heals the champion by that much', () => {
    const hero = makeHeroActor(tuning, { id: 'h', flatHp: 200 })
    const champ = rat('champ')
    installHook(champ, custom('pool-drain-heal', { percent: 15, target: 'enemy' }), 'leech')
    const { ctx } = fight([hero], [champ])
    champ.hp = 1
    const pool = hero.pool
    expect(pool).toBeGreaterThan(0)
    dealDamage(ctx, champ, hero, hit(10))
    const drain = roundHalfUp(pool * 0.15)
    expect(hero.pool).toBe(pool - drain)
    expect(champ.hp).toBe(1 + drain)
  })

  it('Commander: fodder allies have +20% Attack and +10 Speed while it stands', () => {
    const hero = makeHeroActor(tuning, { id: 'h' })
    const champ = rat('champ')
    installHook(champ, custom('fodder-attack-speed-aura', { percent: 20, amount: 10, target: 'allAllies' }), 'commander')
    const grunt = rat('grunt')
    const { ctx } = fight([hero], [champ, grunt])
    expect(statOf(ctx, grunt, 'attackPhys')).toBe(roundHalfUp(grunt.base.attackPhys * 1.2))
    expect(statOf(ctx, grunt, 'speed')).toBe(Math.min(tuning.derived.speed.cap, roundHalfUp(grunt.base.speed * 1.1)))
    expect(statOf(ctx, champ, 'attackPhys')).toBe(champ.base.attackPhys)
    champ.hp = 0
    champ.gone = true
    expect(statOf(ctx, grunt, 'attackPhys')).toBe(grunt.base.attackPhys)
  })

  it('Commander: its death fears the fodder that remain', () => {
    const hero = makeHeroActor(tuning, { id: 'h' })
    const champ = rat('champ')
    installHook(champ, custom('fear-fodder-on-death', { status: 'fear', duration: 1, target: 'allAllies' }), 'commander')
    const grunt = rat('grunt')
    const { ctx } = fight([hero], [champ, grunt])
    champ.hp = 1
    dealDamage(ctx, hero, champ, hit(5))
    expect(hasStatus(grunt, 'fear')).toBe(true)
    expect(grunt.statuses.find((s) => s.id === 'fear')?.turnsLeft).toBe(1)
  })

  it('Nullifier: the Silence moves to the hero last hit; every hero’s regen is −50% until it dies', () => {
    const a = makeHeroActor(tuning, { id: 'a', flatHp: 200 })
    const b = makeHeroActor(tuning, { id: 'b', flatHp: 200, pool: 'mana' })
    a.base.resistance = 0
    b.base.resistance = 0
    const champ = rat('champ')
    installHook(champ, custom('silence-aura', { status: 'silence', duration: 1, percent: -50, target: 'allEnemies' }), 'nullifier')
    const { ctx } = fight([a, b], [champ])
    const mirrorA = a.hooks.find((h) => h.customId === 'silence-aura')
    const mirrorB = b.hooks.find((h) => h.customId === 'silence-aura')
    expect(mirrorA?.sourceId).toBe('champ')
    expect(mirrorB?.data.mirror).toBe(true)
    dealDamage(ctx, champ, a, hit(5))
    expect(hasStatus(a, 'silence')).toBe(true)
    dealDamage(ctx, champ, b, hit(5))
    expect(hasStatus(b, 'silence')).toBe(true)
    expect(hasStatus(a, 'silence')).toBe(false)
    const h = customHandler('silence-aura')
    if (!mirrorA || !mirrorB || !h?.poolRegenBonus) throw new Error('mirror or member missing')
    expect(h.poolRegenBonus(hookCtx(ctx, a, null, mirrorA.line, mirrorA))).toBe(-5)
    expect(h.poolRegenBonus(hookCtx(ctx, b, null, mirrorB.line, mirrorB))).toBe(-4)
    champ.hp = 1
    dealDamage(ctx, a, champ, hit(5))
    expect(a.hooks.some((x) => x.customId === 'silence-aura')).toBe(false)
    expect(b.hooks.some((x) => x.customId === 'silence-aura')).toBe(false)
  })

  it('Regenerating heals 5% at its turn start; Burn suppresses it for two of its turns', () => {
    const hero = makeHeroActor(tuning, { id: 'h' })
    const champ = rat('champ')
    installHook(champ, custom('regen-percent-max-hp', { percent: 5, duration: 2, target: 'self' }), 'regenerating')
    const { ctx } = fight([hero], [champ])
    const hook = first(champ.hooks)
    const h = customHandler('regen-percent-max-hp')
    if (!h?.onTurnStart) throw new Error('member missing')
    const turn = () => h.onTurnStart?.(hookCtx(ctx, champ, null, hook.line, hook))
    champ.hp = 10
    const tick = roundHalfUp(champ.maxHp * 0.05)
    turn()
    expect(champ.hp).toBe(10 + tick)
    champ.statuses.push({ id: 'burn', stacks: 1, turnsLeft: 3, magnitude: 1, sourceId: null, counter: 0 })
    turn()
    turn()
    expect(champ.hp).toBe(10 + tick)
    champ.statuses = []
    turn()
    expect(champ.hp).toBe(10 + 2 * tick)
  })

  it('Mirrored: two decoys soak the first two single-target hits that would have landed', () => {
    const hero = makeHeroActor(tuning, { id: 'h', flat: { accuracy: 100 } })
    const champ = rat('champ')
    installHook(champ, custom('decoys', { amount: 2, percent: 10, target: 'self' }), 'mirrored')
    const { ctx } = fight([hero], [champ])
    const hook = first(champ.hooks)
    expect(hook.counter).toBe(2)
    let tries = 0
    while (hook.counter > 0 && tries++ < 40) dealDamage(ctx, hero, champ, hit(5, 'blunt', { canMiss: true }))
    expect(hook.counter).toBe(0)
    expect(champ.hp).toBe(champ.maxHp)
    expect(ctx.state.log.filter((e) => e.kind === 'decoy')).toHaveLength(2)
    dealDamage(ctx, hero, champ, hit(5))
    expect(champ.hp).toBe(champ.maxHp - 5)
  })

  it('Thorned reflects 20% of melee damage as Pierce (ranged hits are safe)', () => {
    const hero = makeHeroActor(tuning, { id: 'h', flatHp: 200 })
    const champ = rat('champ')
    installHook(champ, custom('reflect-melee-percent', { percent: 20, damageType: 'pierce', target: 'self' }), 'thorned')
    const { ctx } = fight([hero], [champ])
    const hp = hero.hp
    dealDamage(ctx, hero, champ, hit(10))
    // 2 Pierce, ×1.25 against Plate, no Defense: 3.
    expect(hero.hp).toBe(hp - 3)
    dealDamage(ctx, hero, champ, hit(10, 'blunt', { isMelee: false }))
    expect(hero.hp).toBe(hp - 3)
  })
})

describe('pets', () => {
  it('Guard Dog: the pet takes the single-target hits aimed at its owner at the line’s chance', () => {
    const hero = makeHeroActor(tuning, { id: 'h', flatHp: 100 })
    const dog = pet('h')
    const r = rat('rat')
    const { ctx } = fight([hero], [r], [dog])
    const line = custom('pet-intercept', { percent: 100, duration: 2 })
    applyLine(ctx, dog, line, 'ally', hero, { ...SOURCE, id: 'pet-hound-guard-dog' })
    expect(hero.hooks.find((h) => h.customId === 'pet-intercept')?.sourceId).toBe('pet')
    const heroHp = hero.hp
    const petHp = dog.hp
    const out = applyLine(ctx, r, { kind: 'damage', multiplier: 1, damageType: 'pierce' }, 'enemy', hero, RAT_BITE)
    expect(out.targets).toEqual(['pet'])
    expect(hero.hp).toBe(heroHp)
    expect(dog.hp).toBeLessThan(petHp)
    applyLine(ctx, dog, { ...line, percent: 0 }, 'ally', hero, { ...SOURCE, id: 'pet-hound-guard-dog' })
    const out2 = applyLine(ctx, r, { kind: 'damage', multiplier: 1, damageType: 'pierce' }, 'enemy', hero, RAT_BITE)
    expect(out2.targets).toEqual(['h'])
    expect(hero.hp).toBeLessThan(heroHp)
  })

  it('Living Wall mirrors an intercept roll onto the owner that only answers in Guard', () => {
    const hero = makeHeroActor(tuning, { id: 'h' })
    const tortoise = pet('h', 'guard')
    installHook(tortoise, custom('pet-intercept-bonus', { percent: 10, target: 'self' }), tortoise.id)
    fight([hero], [rat('rat')], [tortoise])
    const mirror = hero.hooks.find((h) => h.customId === 'pet-intercept-bonus')
    expect(mirror?.sourceId).toBe('pet')
    expect(mirror?.data.mirror).toBe(true)
  })

  it('pet-resist scales Fire taken by the line’s percent (−50 halves, −100 is immunity)', () => {
    const hero = makeHeroActor(tuning, { id: 'h' })
    const fox = pet('h')
    installHook(fox, custom('pet-resist', { damageType: 'fire', percent: -50, target: 'self' }), fox.id)
    const r = rat('rat')
    const { ctx } = fight([hero], [r], [fox])
    const max = fox.hp
    dealDamage(ctx, r, fox, hit(20, 'fire'))
    expect(fox.hp).toBe(max - 10)
    dealDamage(ctx, r, fox, hit(20, 'blunt'))
    expect(fox.hp).toBe(max - 30)
    installHook(fox, custom('pet-resist', { damageType: 'fire', percent: -100, target: 'self' }), fox.id)
    dealDamage(ctx, r, fox, hit(20, 'fire'))
    expect(fox.hp).toBe(max - 30)
  })

  it('pet-status-immune: Poison never lands on the pet (a sure resist)', () => {
    const hero = makeHeroActor(tuning, { id: 'h' })
    const pup = pet('h')
    installHook(pup, custom('pet-status-immune', { status: 'poison', target: 'self' }), pup.id)
    const r = rat('rat')
    const { ctx } = fight([hero], [r], [pup])
    expect(pup.hooks.some((h) => h.customId === 'status-resist-bonus' && h.line.status === 'poison')).toBe(true)
    const out = applyLine(ctx, r, { kind: 'applyStatus', status: 'poison' }, 'enemy', pup, RAT_BITE)
    expect(out.notes).toContain('pet:poison:resisted')
    expect(hasStatus(pup, 'poison')).toBe(false)
  })

  it('pet-regen-percent heals 2% of the pet’s max HP at its turn start', () => {
    const hero = makeHeroActor(tuning, { id: 'h' })
    const spore = pet('h')
    installHook(spore, custom('pet-regen-percent', { percent: 2, target: 'self' }), spore.id)
    const { ctx } = fight([hero], [rat('rat')], [spore])
    const hook = spore.hooks.find((h) => h.customId === 'pet-regen-percent')
    const h = customHandler('pet-regen-percent')
    if (!hook || !h?.onTurnStart) throw new Error('hook or member missing')
    spore.hp = 1
    h.onTurnStart(hookCtx(ctx, spore, null, hook.line, hook))
    expect(spore.hp).toBe(1 + Math.max(0, roundHalfUp(spore.maxHp * 0.02)))
  })

  it('Pinch grabs a Small enemy and nothing bigger', () => {
    const hero = makeHeroActor(tuning, { id: 'h' })
    const crab = pet('h')
    const small = rat('small')
    const medium = rat('medium', { ...ratDef, size: 'medium' })
    const { ctx } = fight([hero], [small, medium], [crab])
    const line = custom('pet-grab-small', { status: 'grab', duration: 1 })
    applyLine(ctx, crab, line, 'enemy', small, { ...SOURCE, id: 'pet-brine-crab-pinch' })
    expect(hasStatus(small, 'grab')).toBe(true)
    expect(small.grabbedBy).toBe('pet')
    applyLine(ctx, crab, line, 'enemy', medium, { ...SOURCE, id: 'pet-brine-crab-pinch' })
    expect(hasStatus(medium, 'grab')).toBe(false)
  })

  it('Pilfer moves the target’s newest buff onto the owner with its remaining duration', () => {
    const hero = makeHeroActor(tuning, { id: 'h' })
    const imp = pet('h')
    const r = rat('rat')
    const { ctx } = fight([hero], [r], [imp])
    r.statuses.push({ id: 'fortify', stacks: 1, turnsLeft: 2, magnitude: 0, sourceId: null, counter: 0 })
    applyLine(ctx, imp, custom('pet-steal-buff'), 'enemy', r, { ...SOURCE, id: 'pet-vault-imp-pilfer' })
    expect(hasStatus(r, 'fortify')).toBe(false)
    expect(hero.statuses.find((s) => s.id === 'fortify')?.turnsLeft).toBe(2)
  })

  it('Scavenge records one extra part roll for the loot pass, once per fight', () => {
    const hero = makeHeroActor(tuning, { id: 'h' })
    const prince = pet('h')
    const { ctx } = fight([hero], [rat('rat')], [prince])
    applyLine(ctx, prince, custom('pet-extra-part-roll', { amount: 1 }), 'self', prince, { ...SOURCE, id: 'pet-rat-prince-scavenge' })
    applyLine(ctx, prince, custom('pet-extra-part-roll', { amount: 1 }), 'self', prince, { ...SOURCE, id: 'pet-rat-prince-scavenge' })
    expect(ctx.state.flags.extraPartRolls).toBe(1)
  })

  it('Nibble takes 2% of the party’s stolen gold back', () => {
    const hero = makeHeroActor(tuning, { id: 'h' })
    const prince = pet('h')
    const r = rat('rat')
    const { ctx } = fight([hero], [r], [prince])
    ctx.state.counters.goldStolen = 200
    applyLine(ctx, prince, custom('pet-steal-gold-back', { percent: 2 }), 'enemy', r, { ...SOURCE, id: 'pet-rat-prince-nibble' })
    expect(ctx.state.counters.goldStolen).toBe(196)
  })
})

describe('Mender', () => {
  it('Martyr’s Grace: the first ally who would be downed survives at 1 HP, once per fight', () => {
    const mender = makeHeroActor(tuning, { id: 'm' })
    installHook(mender, custom('survive-lethal-once', { amount: 1, target: 'self' }), 'm', { sourceSkillId: 'mender-martyrs-grace' })
    const ally = makeHeroActor(tuning, { id: 'a' })
    const r = rat('rat')
    const { ctx } = fight([mender, ally], [r])
    expect(ally.hooks.some((h) => h.customId === 'survive-lethal-once' && h.sourceId === 'm')).toBe(true)
    dealDamage(ctx, r, ally, hit(9999))
    expect(ally.hp).toBe(1)
    expect(ally.downed).toBe(false)
    dealDamage(ctx, r, ally, hit(9999))
    expect(ally.downed).toBe(true)
    expect(ctx.state.log.filter((e) => e.kind === 'martyr')).toHaveLength(1)
  })

  it('Martyr’s Grace at Mastery leaves the survivor at 10% of max HP', () => {
    const mender = makeHeroActor(tuning, { id: 'm' })
    installHook(mender, custom('survive-lethal-once', { percent: 10, target: 'self' }), 'm')
    const ally = makeHeroActor(tuning, { id: 'a', flatHp: 100 })
    const r = rat('rat')
    const { ctx } = fight([mender, ally], [r])
    dealDamage(ctx, r, ally, hit(9999))
    expect(ally.hp).toBe(Math.max(1, roundHalfUp(ally.maxHp * 0.1)))
    expect(ally.downed).toBe(false)
  })

  it('Gentle Hands: the holder’s heals are +8%', () => {
    const mender = makeHeroActor(tuning, { id: 'm' })
    installHook(mender, custom('healing-done-percent', { percent: 8, target: 'self' }), 'm')
    const ally = makeHeroActor(tuning, { id: 'a', flatHp: 300 })
    const { ctx } = fight([mender, ally], [rat('rat')])
    ally.hp = ally.maxHp - 200
    const out = applyLine(ctx, mender, { kind: 'heal', amount: 100 }, 'ally', ally, SOURCE)
    expect(out.healed).toBe(108)
    expect(ally.hp).toBe(ally.maxHp - 92)
  })

  it('Gentle Hands: a healing skill costs half while an ally is under 30% HP', () => {
    const mender = makeHeroActor(tuning, { id: 'm' })
    const hook = installHook(mender, custom('heal-cost-half-below-hp', { percent: 30, target: 'self' }), 'm')
    const ally = makeHeroActor(tuning, { id: 'a' })
    const { ctx } = fight([mender, ally], [rat('rat')])
    const h = customHandler('heal-cost-half-below-hp')
    if (!h?.costPercent) throw new Error('member missing')
    const mend: SkillDef = { ...PROVOKE, id: 'mender-mend', classId: 'mender', school: 'benediction', target: 'ally', effects: [{ kind: 'heal', percent: 18 }], tags: ['heal'] }
    expect(h.costPercent(hookCtx(ctx, mender, null, hook.line, hook), mend)).toBe(0)
    ally.hp = Math.floor(ally.maxHp * 0.2)
    expect(h.costPercent(hookCtx(ctx, mender, null, hook.line, hook), mend)).toBe(-50)
    expect(h.costPercent(hookCtx(ctx, mender, null, hook.line, hook), PROVOKE)).toBe(0)
  })

  it('Overflow turns the healing beyond max HP into a Shield capped at 15% of max HP for 2 turns', () => {
    const mender = makeHeroActor(tuning, { id: 'm' })
    installHook(mender, custom('overheal-to-shield', { percent: 15, duration: 2, target: 'self' }), 'm')
    installHook(mender, custom('healing-done-percent', { percent: 8, target: 'self' }), 'm')
    const ally = makeHeroActor(tuning, { id: 'a', flatHp: 300 })
    const { ctx } = fight([mender, ally], [rat('rat')])
    ally.hp = ally.maxHp - 10
    applyLine(ctx, mender, { kind: 'heal', amount: 100 }, 'ally', ally, SOURCE)
    expect(ally.hp).toBe(ally.maxHp)
    const shield = ally.statuses.find((s) => s.id === 'shield')
    expect(shield?.magnitude).toBe(Math.min(98, roundHalfUp(ally.maxHp * 0.15)))
    expect(shield?.turnsLeft).toBe(2)
    expect(ctx.state.log.some((e) => e.kind === 'heal' && e.targetId === 'a' && e.amount === 10)).toBe(true)
    expect(mender.tally.healingDone).toBe(10)
  })

  it('Steadfast: Fortify the holder applies lasts +1 turn', () => {
    const mender = makeHeroActor(tuning, { id: 'm' })
    installHook(mender, custom('fortify-duration-bonus', { amount: 1, target: 'self' }), 'm')
    const other = makeHeroActor(tuning, { id: 'o' })
    const { ctx } = fight([mender, other], [rat('rat')])
    applyLine(ctx, mender, { kind: 'applyStatus', status: 'fortify', duration: 2 }, 'self', mender, SOURCE)
    applyLine(ctx, other, { kind: 'applyStatus', status: 'fortify', duration: 2 }, 'self', other, SOURCE)
    expect(mender.statuses.find((s) => s.id === 'fortify')?.turnsLeft).toBe(3)
    expect(other.statuses.find((s) => s.id === 'fortify')?.turnsLeft).toBe(2)
  })

  it('Steadfast: allies holding Fortify read +10 on Resistance through the aura', () => {
    const mender = makeHeroActor(tuning, { id: 'm' })
    installHook(mender, custom('resistance-bonus-while-fortified', { amount: 10, target: 'self' }), 'm')
    const ally = makeHeroActor(tuning, { id: 'a' })
    const { ctx } = fight([mender, ally], [rat('rat')])
    const base = statOf(ctx, ally, 'resistance')
    ally.statuses.push({ id: 'fortify', stacks: 1, turnsLeft: 2, magnitude: 0, sourceId: null, counter: 0 })
    expect(statOf(ctx, ally, 'resistance')).toBe(roundHalfUp((ally.base.resistance * 110) / 100))
    expect(statOf(ctx, ally, 'resistance')).toBeGreaterThanOrEqual(base)
  })

  it('Absolution: no debuff lands for a turn, then they do again', () => {
    const mender = makeHeroActor(tuning, { id: 'm' })
    const ally = makeHeroActor(tuning, { id: 'a' })
    ally.base.resistance = 0
    const r = rat('rat')
    const { ctx } = fight([mender, ally], [r])
    applyLine(ctx, mender, custom('immune-to-debuffs', { duration: 1 }), 'ally', ally, { ...SOURCE, id: 'mender-absolution' })
    const out = applyLine(ctx, r, { kind: 'applyStatus', status: 'poison' }, 'enemy', ally, RAT_BITE)
    expect(out.notes).toContain('a:poison:resisted')
    expect(hasStatus(ally, 'poison')).toBe(false)
    expect(applyLine(ctx, r, { kind: 'applyStatus', status: 'grab' }, 'enemy', ally, RAT_BITE).applied).toEqual([])
    countDownStatuses(ally)
    expect(ally.hooks).toEqual([])
    applyLine(ctx, r, { kind: 'applyStatus', status: 'poison' }, 'enemy', ally, RAT_BITE)
    expect(hasStatus(ally, 'poison')).toBe(true)
  })

  it('Sanctuary: a shielded ally cannot be Grabbed until the Shield breaks', () => {
    const mender = makeHeroActor(tuning, { id: 'm' })
    const ally = makeHeroActor(tuning, { id: 'a', flatHp: 200 })
    ally.base.resistance = 0
    const r = rat('rat')
    const { ctx } = fight([mender, ally], [r])
    applyLine(ctx, mender, { kind: 'shield', amount: 5, duration: 2 }, 'ally', ally, { ...SOURCE, id: 'mender-sanctuary' })
    applyLine(ctx, mender, custom('sanctuary-shield-immunities', { duration: 2 }), 'ally', ally, { ...SOURCE, id: 'mender-sanctuary' })
    expect(applyLine(ctx, r, { kind: 'applyStatus', status: 'grab' }, 'enemy', ally, RAT_BITE).applied).toEqual([])
    expect(ally.grabbedBy).toBeNull()
    dealDamage(ctx, r, ally, hit(20))
    expect(hasStatus(ally, 'shield')).toBe(false)
    expect(ally.hooks).toEqual([])
    applyLine(ctx, r, { kind: 'applyStatus', status: 'grab' }, 'enemy', ally, RAT_BITE)
    expect(hasStatus(ally, 'grab')).toBe(true)
  })

  it('Judgement adds +1% per 1% of the target’s missing HP, capped, as a second strike', () => {
    const mender = makeHeroActor(tuning, { id: 'm', pool: 'mana' })
    const champ = rat('champ')
    const { ctx } = fight([mender], [champ])
    champ.maxHp = 200
    champ.hp = 120
    const out = applyLine(ctx, mender, { kind: 'damage', multiplier: 1, damageType: 'holy' }, 'enemy', champ, { ...SOURCE, id: 'mender-judgement' })
    const dealt = first(out.results).dealt
    expect(dealt).toBeGreaterThan(0)
    expect(champ.hp).toBe(120 - dealt)
    // 80 of 200 missing before the hit: +40%, under the +50% cap.
    applyLine(ctx, mender, custom('bonus-per-missing-hp', { percent: 50 }), 'enemy', champ, { ...SOURCE, id: 'mender-judgement' })
    expect(champ.hp).toBe(120 - dealt - roundHalfUp((dealt * 40) / 100))
    // A near-dead target is capped at +percent.
    champ.hp = 10
    const out2 = applyLine(ctx, mender, { kind: 'damage', multiplier: 0.1, damageType: 'holy' }, 'enemy', champ, { ...SOURCE, id: 'mender-judgement' })
    const dealt2 = first(out2.results).dealt
    expect(dealt2).toBeGreaterThan(0)
    applyLine(ctx, mender, custom('bonus-per-missing-hp', { percent: 50 }), 'enemy', champ, { ...SOURCE, id: 'mender-judgement' })
    expect(champ.hp).toBe(Math.max(0, 10 - dealt2 - roundHalfUp((dealt2 * 50) / 100)))
  })

  it('Consecration adds one Holy strike per basic attack and none to skills', () => {
    const mender = makeHeroActor(tuning, { id: 'm', pool: 'mana' })
    installHook(mender, custom('basic-attack-extra-spell-damage', { multiplier: 0.3, damageType: 'holy', target: 'self' }), 'm')
    const champ = rat('champ')
    const { ctx } = fight([mender], [champ])
    const hp = champ.hp
    const out = applyLine(ctx, mender, { kind: 'damage', multiplier: 1, damageType: 'blunt' }, 'enemy', champ, BASIC)
    const dealt = first(out.results).dealt
    expect(champ.hp).toBeLessThan(hp - dealt)
    expect(ctx.state.log.filter((e) => e.kind === 'damage' && e.text.includes('consecration'))).toHaveLength(1)
    // The same action again (no new onHolderAttacks) adds nothing; a skill line never does.
    applyLine(ctx, mender, { kind: 'damage', multiplier: 1, damageType: 'blunt' }, 'enemy', champ, BASIC)
    applyLine(ctx, mender, { kind: 'damage', multiplier: 1, damageType: 'blunt' }, 'enemy', champ, SOURCE)
    expect(ctx.state.log.filter((e) => e.kind === 'damage' && e.text.includes('consecration'))).toHaveLength(1)
  })

  it('Hallowed Ground strikes an enemy once per action for attacking the front row', () => {
    const mender = makeHeroActor(tuning, { id: 'm', pool: 'mana', row: 'back' })
    const front = makeHeroActor(tuning, { id: 'f', flatHp: 200 })
    const champ = rat('champ')
    const { ctx } = fight([mender, front], [champ])
    applyLine(ctx, mender, custom('hallowed-ground', { multiplier: 0.5, damageType: 'holy', duration: 3, target: 'self' }), 'allAllies', null, { ...SOURCE, id: 'mender-hallowed-ground' })
    expect(front.hooks.find((h) => h.customId === 'hallowed-ground')?.turnsLeft).toBe(3)
    const hp = champ.hp
    dealDamage(ctx, champ, front, hit(5))
    expect(champ.hp).toBeLessThan(hp)
    const after = champ.hp
    dealDamage(ctx, champ, front, hit(5))
    expect(champ.hp).toBe(after)
    champ.tally.actions += 1
    dealDamage(ctx, champ, front, hit(5))
    expect(champ.hp).toBeLessThan(after)
    dealDamage(ctx, champ, mender, hit(5))
    expect(ctx.state.log.filter((e) => e.kind === 'damage' && e.text.includes('hallowed ground'))).toHaveLength(2)
  })

  it('Holy Lance stuns only a Smitten target; Censure weakens only Undead or Shadow', () => {
    const mender = makeHeroActor(tuning, { id: 'm', pool: 'mana' })
    const champ = rat('champ')
    const { ctx } = fight([mender], [champ])
    applyLine(ctx, mender, custom('apply-if-smite', { status: 'stun', duration: 1 }), 'enemy', champ, SOURCE)
    expect(hasStatus(champ, 'stun')).toBe(false)
    champ.statuses.push({ id: 'smite', stacks: 1, turnsLeft: 2, magnitude: 0, sourceId: 'm', counter: 0 })
    applyLine(ctx, mender, custom('apply-if-smite', { status: 'stun', duration: 1 }), 'enemy', champ, SOURCE)
    expect(hasStatus(champ, 'stun')).toBe(true)
    applyLine(ctx, mender, custom('apply-if-undead-or-shadow', { status: 'weaken', duration: 2 }), 'enemy', champ, SOURCE)
    expect(hasStatus(champ, 'weaken')).toBe(false)
    applyLine(ctx, mender, custom('apply-if-living', { status: 'fear', duration: 1 }), 'enemy', champ, SOURCE)
    expect(hasStatus(champ, 'fear')).toBe(true)
  })
})

describe('species', () => {
  it('Intimidating lengthens Warcry statuses by percent of their default (Taunt), never Fear', () => {
    const orc = makeHeroActor(tuning, { id: 'o' })
    installHook(orc, custom('warcry-duration-percent', { percent: 50, target: 'self' }), 'orc')
    const champ = rat('champ')
    const { ctx } = fight([orc], [champ])
    applyLine(ctx, orc, { kind: 'taunt', duration: 3 }, 'enemy', champ, SOURCE)
    expect(champ.statuses.find((s) => s.id === 'taunt')?.turnsLeft).toBe(4)
    champ.base.resistance = 0
    applyLine(ctx, orc, { kind: 'applyStatus', status: 'fear', duration: 2 }, 'enemy', champ, SOURCE)
    expect(champ.statuses.find((s) => s.id === 'fear')?.turnsLeft).toBe(2)
  })

  it('Breath hits the target’s row once per fight for max(Attack) × multiplier and Burns', () => {
    const drake = makeHeroActor(tuning, { id: 'd' })
    const a = rat('a')
    const b = rat('b')
    const { ctx } = fight([drake], [a, b])
    for (const m of [a, b]) {
      m.maxHp = 500
      m.hp = 500
    }
    const line = custom('species-breath', { multiplier: 1, damageType: 'fire', status: 'burn', target: 'enemyFront' })
    applyLine(ctx, drake, line, 'enemyFront', a, { ...SOURCE, id: 'draconid-breath' })
    expect(a.hp).toBeLessThan(a.maxHp)
    expect(b.hp).toBeLessThan(b.maxHp)
    expect(hasStatus(a, 'burn')).toBe(true)
    const hp = a.hp
    applyLine(ctx, drake, line, 'enemyFront', a, { ...SOURCE, id: 'draconid-breath' })
    expect(a.hp).toBe(hp)
    expect(ctx.state.log.some((e) => e.kind === 'breathSpent')).toBe(true)
  })
})
