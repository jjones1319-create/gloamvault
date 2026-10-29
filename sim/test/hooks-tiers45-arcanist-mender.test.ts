import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { activeHooks } from '../src/hooks.ts'
import { applyLine, dealDamage, hookCtx, log, type DamageInput, type EffectContext, type LineSource } from '../src/effects.ts'
import { createFight } from '../src/fight.ts'
import type { Actor } from '../src/fight-types.ts'
import { installHook } from '../src/hooks.ts'
import { buildMonsterActor } from '../src/monsters.ts'
import type { RawContentFile } from '../src/content.ts'
import { Rng, seedState } from '../src/rng.ts'
import { linesAtRank } from '../src/skill-lines.ts'
import { customHandler } from '../src/skills/custom/index.ts'
import { roundHalfUp } from '../src/stats.ts'
import { applyStatus, hasStatus } from '../src/statuses.ts'
import type { Effect, MonsterDef, SkillDef } from '../src/types/content.ts'
import { exactTuning, example, loadTuning, makeContent, makeHeroActor } from './helpers.ts'

/** Tiers IV–V of the Arcanist and the Mender (Phase 7, pass A): the new hooks and the skills that need more than one. */
const tuning = exactTuning(loadTuning())

function skillFile(classId: string, id: string): RawContentFile {
  const p = `content/skills/${classId}/${id}.json`
  return { kind: 'skill', path: p, json: JSON.parse(readFileSync(p, 'utf8')) }
}

const SKILLS = [
  ['mender', 'mender-rebirth'],
  ['mender', 'mender-miracle'],
  ['mender', 'mender-breath-of-life'],
  ['arcanist', 'arcanist-stormcall'],
  ['arcanist', 'arcanist-glass-heart'],
  ['arcanist', 'arcanist-vaultbreaker'],
] as const
const content = makeContent([example('monster', 'monster'), ...SKILLS.map(([c, id]) => skillFile(c, id))])
const ratDef = content.monsters.get('giant-rat') as MonsterDef
const undeadDef: MonsterDef = { ...ratDef, id: 'test-skeleton', familyId: 'the-restless-dead', resist: [], weak: [], immune: [] }

const SOURCE: LineSource = { kind: 'skill', id: 'test', label: 'test', isUltimate: false, neverMisses: true, effectPercent: 100, reach: true, ranged: false, isMelee: false }

function rat(id: string, def: MonsterDef = ratDef): Actor {
  return buildMonsterActor(content, tuning, def, { id, level: 1, row: 'front', hpPercent: 100 })
}

function fight(heroes: Actor[], monsters: Actor[], seed = 11): { ctx: EffectContext } {
  const rng = new Rng(seedState(seed, seed + 1))
  const state = createFight(content, tuning, { heroes, pets: [], monsters, surprised: null, light: 70, options: { dungeonId: 'gravehollow-keep', floor: 1, floorLevel: 1 }, rng })
  return { ctx: { content, t: tuning, state, rng } }
}

function custom(customId: string, fields: Omit<Effect, 'kind' | 'customId'> = {}): Effect {
  return { kind: 'custom', customId, ...fields }
}

/** A hit that lands for exactly `amount` (no roll, no crit, no Defense). */
function hit(amount: number, over: Partial<DamageInput> = {}): DamageInput {
  return { amount, damageType: 'blunt', canMiss: false, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: true, ignoresDefense: true, sourceLabel: 'test', ...over }
}

/** What fight.ts resolveSkill does for a skill's lines: the action marker, the lines at the rank, the after-skill hooks. */
function cast(ctx: EffectContext, actor: Actor, skill: SkillDef, target: Actor | null, rank = 1): void {
  log(ctx, { kind: 'action', actorId: actor.id, targetId: target?.id, text: `${actor.name} uses ${skill.name}` })
  for (const { status, hook, line } of activeHooks(ctx.content, actor)) customHandler(line.customId ?? '')?.onHolderAttacks?.(hookCtx(ctx, actor, status, line, hook))
  const source: LineSource = { ...SOURCE, id: skill.id, label: skill.name }
  for (const line of linesAtRank(skill, rank)) applyLine(ctx, actor, line, skill.target, target, source)
  for (const { status, hook, line } of activeHooks(ctx.content, actor)) customHandler(line.customId ?? '')?.onSkillUsed?.(hookCtx(ctx, actor, status, line, hook), skill)
}

/** Calls one hook member on every active hook of `actor` that names `customId`. */
function each(ctx: EffectContext, actor: Actor, customId: string, f: (h: NonNullable<ReturnType<typeof customHandler>>, hc: ReturnType<typeof hookCtx>) => void): void {
  for (const { status, hook, line } of activeHooks(ctx.content, actor)) {
    if (line.customId !== customId) continue
    const h = customHandler(customId)
    if (h) f(h, hookCtx(ctx, actor, status, line, hook))
  }
}

function skill(id: string): SkillDef {
  const s = content.skills.get(id)
  if (!s) throw new Error(`no skill ${id}`)
  return s
}

const mana = (id: string, extra: Parameters<typeof makeHeroActor>[1] = { id }) => makeHeroActor(tuning, { pool: 'mana', ...extra, id })

describe('Mender: raising the dead (D-089)', () => {
  it('Breath of Life is normal weight (never charged) at 28 Mana (D-099)', () => {
    const s = skill('mender-breath-of-life')
    expect(s.weight).toBe(1000)
    expect(s.cost).toBe(28)
    expect(s.tags).toContain('revive')
  })

  it('Rebirth revives every downed ally at 50% and one fallen hero, once per fight', () => {
    const mender = mana('m')
    const downed = makeHeroActor(tuning, { id: 'd' })
    const fallen1 = makeHeroActor(tuning, { id: 'f1' })
    const fallen2 = makeHeroActor(tuning, { id: 'f2' })
    const { ctx } = fight([mender, downed, fallen1, fallen2], [rat('r')])
    for (const a of [downed, fallen1, fallen2]) a.hp = 0
    downed.downed = true
    fallen1.fallen = true
    fallen2.fallen = true
    const rebirth = skill('mender-rebirth')
    cast(ctx, mender, rebirth, fallen2)
    expect(downed.downed).toBe(false)
    expect(downed.hp).toBe(roundHalfUp(downed.maxHp * 0.5))
    // The chosen target first.
    expect(fallen2.fallen).toBe(false)
    expect(fallen2.hp).toBe(roundHalfUp(fallen2.maxHp * 0.5))
    expect(fallen2.energy).toBe(0)
    expect(fallen1.fallen).toBe(true)
    // A second cast this fight raises no more of the fallen.
    cast(ctx, mender, rebirth, fallen1)
    expect(fallen1.fallen).toBe(true)
    expect(ctx.state.log.some((e) => e.kind === 'reviveSpent')).toBe(true)
  })

  it('Rebirth at Mastery raises two fallen heroes per fight', () => {
    const mender = mana('m')
    const a = makeHeroActor(tuning, { id: 'a' })
    const b = makeHeroActor(tuning, { id: 'b' })
    const { ctx } = fight([mender, a, b], [rat('r')])
    for (const x of [a, b]) {
      x.hp = 0
      x.fallen = true
    }
    const rebirth = skill('mender-rebirth')
    cast(ctx, mender, rebirth, null, 10)
    expect(a.fallen).toBe(false)
    expect(b.fallen).toBe(false)
  })

  it('Miracle heals in full, revives the downed and the fallen at 60%, and works once per fight', () => {
    const mender = mana('m')
    const hurt = makeHeroActor(tuning, { id: 'h' })
    const downed = makeHeroActor(tuning, { id: 'd' })
    const fallen = makeHeroActor(tuning, { id: 'f' })
    const { ctx } = fight([mender, hurt, downed, fallen], [rat('r')])
    hurt.hp = 5
    applyStatus(content, tuning, ctx.rng, hurt, { status: 'weaken', duration: 2, sourceId: 'r' })
    downed.hp = 0
    downed.downed = true
    fallen.hp = 0
    fallen.fallen = true
    const miracle = skill('mender-miracle')
    cast(ctx, mender, miracle, null)
    expect(hurt.hp).toBe(hurt.maxHp)
    expect(hasStatus(hurt, 'weaken')).toBe(false)
    expect(downed.hp).toBe(roundHalfUp(downed.maxHp * 0.6))
    expect(fallen.fallen).toBe(false)
    expect(fallen.hp).toBe(roundHalfUp(fallen.maxHp * 0.6))
    // Once per fight: the second cast resolves nothing.
    hurt.hp = 5
    fallen.hp = 0
    fallen.fallen = true
    cast(ctx, mender, miracle, null)
    expect(hurt.hp).toBe(5)
    expect(fallen.fallen).toBe(true)
    expect(ctx.state.log.some((e) => e.kind === 'oncePerFight')).toBe(true)
    // The skip hook goes with the cast.
    expect(mender.hooks.some((h) => h.customId === 'skill-once-per-fight')).toBe(false)
  })
})

describe('Mender: Tier IV–V hooks', () => {
  it('Troll’s Regrowth: an ally’s Regen ticks again at its turn start; Fire sears it away (not at Mastery)', () => {
    const mender = mana('m')
    const ally = makeHeroActor(tuning, { id: 'a', flatHp: 100 })
    installHook(mender, custom('regen-ticks-twice', { percent: 100, target: 'self' }), 'm', { sourceSkillId: 'mender-trolls-regrowth' })
    const { ctx } = fight([mender, ally], [rat('r')])
    expect(ally.hooks.some((h) => h.customId === 'regen-ticks-twice' && h.sourceId === 'm')).toBe(true)
    applyStatus(content, tuning, ctx.rng, ally, { status: 'regen', duration: 3, magnitude: 5, sourceId: 'm' })
    ally.hp = 50
    each(ctx, ally, 'regen-ticks-twice', (h, hc) => h.onTurnStart?.(hc))
    expect(ally.hp).toBe(50 + roundHalfUp(ally.maxHp * 0.05))
    dealDamage(ctx, rat('r2'), ally, hit(3, { damageType: 'fire' }))
    expect(hasStatus(ally, 'regen')).toBe(false)
    // Mastery: percent 0 — the Regen survives the Fire.
    const m2 = mana('m2')
    const a2 = makeHeroActor(tuning, { id: 'a2' })
    installHook(m2, custom('regen-ticks-twice', { percent: 0, target: 'self' }), 'm2')
    const f2 = fight([m2, a2], [rat('r')]).ctx
    applyStatus(content, tuning, f2.rng, a2, { status: 'regen', duration: 3, magnitude: 5, sourceId: 'm2' })
    dealDamage(f2, rat('r3'), a2, hit(3, { damageType: 'fire' }))
    expect(hasStatus(a2, 'regen')).toBe(true)
  })

  it('Exorcism and Banishment destroy a non-boss Undead under the line; the living and bosses are spared', () => {
    const mender = mana('m')
    const bones = rat('bones', undeadDef)
    const living = rat('living')
    const boss = rat('boss', undeadDef)
    if (boss.monster) boss.monster.isBoss = true
    const { ctx } = fight([mender], [bones, living, boss])
    for (const x of [bones, living, boss]) x.hp = Math.max(1, Math.floor(x.maxHp * 0.15))
    const line = custom('destroy-below-hp', { percent: 20, damageType: 'holy' })
    for (const x of [bones, living, boss]) customHandler('destroy-below-hp')?.apply?.(hookCtx(ctx, mender, null, line, null, 'mender-exorcism'), x, 100)
    expect(bones.gone).toBe(true)
    expect(mender.tally.kills).toBe(1)
    expect(living.gone).toBe(false)
    expect(boss.gone).toBe(false)
  })

  it('Sanctified Weapon: an ally’s basic attack adds 0.2× the Mender’s spell Attack as Holy, once per action; skills add nothing', () => {
    const mender = mana('m', { id: 'm', attributes: { wisdom: 20 } })
    const ally = makeHeroActor(tuning, { id: 'a' })
    installHook(mender, custom('party-basic-extra-holy', { multiplier: 0.2, damageType: 'holy', target: 'self' }), 'm', { sourceSkillId: 'mender-sanctified-weapon' })
    const target = rat('r')
    target.hp = 9999
    target.maxHp = 9999
    const { ctx } = fight([mender, ally], [target])
    const basic: LineSource = { ...SOURCE, kind: 'basic', id: 'basic', label: 'basic attack', isMelee: true, neverMisses: true }
    each(ctx, ally, 'party-basic-extra-holy', (h, hc) => h.onHolderAttacks?.(hc))
    applyLine(ctx, ally, { kind: 'damage', multiplier: 1, damageType: 'slash' }, 'enemy', target, basic)
    const extra = ctx.state.log.filter((e) => e.kind === 'damage' && e.actorId === 'a' && e.text.includes('sanctified'))
    expect(extra).toHaveLength(1)
    // A skill line is not a basic attack.
    each(ctx, ally, 'party-basic-extra-holy', (h, hc) => h.onHolderAttacks?.(hc))
    applyLine(ctx, ally, { kind: 'damage', multiplier: 1, damageType: 'slash' }, 'enemy', target, { ...SOURCE, isMelee: true })
    expect(ctx.state.log.filter((e) => e.kind === 'damage' && e.actorId === 'a' && e.text.includes('sanctified'))).toHaveLength(1)
  })

  it('Sanctified Weapon: Holy hits ignore 20 Defense (the same blow as against Defense − 20)', () => {
    const mender = mana('m')
    installHook(mender, custom('defense-ignore-flat', { amount: 20, damageType: 'holy', target: 'self' }), 'm')
    const plain = mana('p')
    const a = rat('a')
    const b = rat('b')
    a.base.defense = 50
    b.base.defense = 30
    a.hp = a.maxHp = 9999
    b.hp = b.maxHp = 9999
    const { ctx } = fight([mender, plain], [a, b])
    const holy = hit(400, { damageType: 'holy', ignoresDefense: false, isMelee: false })
    const withIgnore = dealDamage(ctx, mender, a, holy).dealt
    const against30 = dealDamage(ctx, plain, b, holy).dealt
    expect(Math.abs(withIgnore - against30)).toBeLessThanOrEqual(1)
    // Other types are untouched.
    const slashA = dealDamage(ctx, mender, a, hit(400, { damageType: 'slash', ignoresDefense: false })).dealt
    const slashB = dealDamage(ctx, plain, a, hit(400, { damageType: 'slash', ignoresDefense: false })).dealt
    expect(slashA).toBe(slashB)
  })

  it('Saint’s Mantle answers a hit with Holy and Fear, once per attacker action', () => {
    const mender = mana('m', { id: 'm', attributes: { wisdom: 20 } })
    installHook(mender, custom('retaliate-on-hit', { multiplier: 0.4, damageType: 'holy', status: 'fear', duration: 1, target: 'self' }), 'm')
    const r = rat('r')
    r.base.resistance = 0
    r.hp = r.maxHp = 9999
    const { ctx } = fight([mender], [r])
    dealDamage(ctx, r, mender, hit(5))
    dealDamage(ctx, r, mender, hit(5))
    expect(ctx.state.log.filter((e) => e.kind === 'damage' && e.actorId === 'm' && e.text.includes('mantle'))).toHaveLength(1)
    expect(hasStatus(r, 'fear')).toBe(true)
    r.tally.actions += 1
    dealDamage(ctx, r, mender, hit(5))
    expect(ctx.state.log.filter((e) => e.kind === 'damage' && e.actorId === 'm' && e.text.includes('mantle'))).toHaveLength(2)
  })

  it('Guardian Spirit pays half of each hit from the Mender’s Mana at 2 per HP and ends when the Mana runs out', () => {
    const mender = mana('m')
    const ally = makeHeroActor(tuning, { id: 'a', flatHp: 200 })
    const r = rat('r')
    const { ctx } = fight([mender, ally], [r])
    customHandler('damage-to-pool-redirect')?.apply?.(hookCtx(ctx, mender, null, custom('damage-to-pool-redirect', { percent: 50, amount: 2, duration: 3 }), null, 'mender-guardian-spirit'), ally, 100)
    mender.pool = 30
    const hp = ally.hp
    dealDamage(ctx, r, ally, hit(20))
    expect(ally.hp).toBe(hp - 10)
    expect(mender.pool).toBe(10)
    // 10 Mana pays 5 HP of the next 20; then the spirit is spent.
    dealDamage(ctx, r, ally, hit(20))
    expect(ally.hp).toBe(hp - 10 - 15)
    expect(mender.pool).toBe(0)
    expect(ally.hooks.some((h) => h.customId === 'damage-to-pool-redirect')).toBe(false)
  })

  it('Everflow: each ally the Mender’s skill heals regains 5% of its pool; Regen holds below 50% HP', () => {
    const mender = mana('m')
    const ally = mana('a')
    installHook(mender, custom('heal-restores-pool', { percent: 5, target: 'self' }), 'm')
    installHook(mender, custom('regen-holds-below-hp', { percent: 50, target: 'self' }), 'm', { sourceSkillId: 'mender-everflow' })
    const { ctx } = fight([mender, ally], [rat('r')])
    ally.pool = 0
    ally.hp = 10
    const mend: SkillDef = { ...skill('mender-breath-of-life'), id: 'test-mend', target: 'ally', effects: [{ kind: 'heal', percent: 10 }], mastery: { text: '-', effects: [] } }
    cast(ctx, mender, mend, ally)
    expect(ally.pool).toBe(roundHalfUp(ally.poolMax * 0.05))
    applyStatus(content, tuning, ctx.rng, ally, { status: 'regen', duration: 2, magnitude: 5, sourceId: 'm' })
    const regen = ally.statuses.find((s) => s.id === 'regen')
    delete regen?.fresh
    each(ctx, ally, 'regen-holds-below-hp', (h, hc) => h.onTurnStart?.(hc))
    expect(regen?.turnsLeft).toBe(3)
    ally.hp = ally.maxHp
    each(ctx, ally, 'regen-holds-below-hp', (h, hc) => h.onTurnStart?.(hc))
    expect(regen?.turnsLeft).toBe(3)
  })

  it('Grace: the ally’s next action costs nothing and weighs 800, then it is spent', () => {
    const mender = mana('m')
    const ally = mana('a')
    const { ctx } = fight([mender, ally], [rat('r')])
    customHandler('grace-next-action')?.apply?.(hookCtx(ctx, mender, null, custom('grace-next-action', { amount: 1 }), null, 'mender-grace'), ally, 100)
    let cost = 0
    let weight = 1000
    each(ctx, ally, 'grace-next-action', (h, hc) => (cost += h.costPercent?.(hc, skill('arcanist-stormcall')) ?? 0))
    each(ctx, ally, 'grace-next-action', (h, hc) => (weight = h.modifyWeight?.(hc, weight) ?? weight))
    expect(cost).toBe(-100)
    expect(weight).toBe(800)
    ally.tally.actions += 1
    cost = 0
    each(ctx, ally, 'grace-next-action', (h, hc) => (cost += h.costPercent?.(hc, skill('arcanist-stormcall')) ?? 0))
    expect(cost).toBe(0)
    expect(ally.hooks.some((h) => h.customId === 'grace-next-action')).toBe(false)
  })

  it('Dawn Vigil gives every hero +10 Momentum at the fight’s start; Martyrdom splits the Mender’s Momentum', () => {
    const mender = mana('m')
    const a = makeHeroActor(tuning, { id: 'a' })
    const b = makeHeroActor(tuning, { id: 'b' })
    installHook(mender, custom('fight-start-momentum-allies', { amount: 10, target: 'self' }), 'm')
    const { ctx } = fight([mender, a, b], [rat('r')])
    expect(a.momentum).toBe(10)
    expect(b.momentum).toBe(10)
    expect(mender.momentum).toBe(10)
    mender.momentum = 61
    customHandler('momentum-split-to-allies')?.apply?.(hookCtx(ctx, mender, null, custom('momentum-split-to-allies', { percent: 100 }), null, 'mender-martyrdom'), mender, 100)
    expect(mender.momentum).toBe(0)
    expect(a.momentum).toBe(40)
    expect(b.momentum).toBe(40)
  })

  it('Unwavering: above 50% HP the Mender’s allies shed Fear at their turn start; below it they keep it', () => {
    const mender = mana('m')
    const ally = makeHeroActor(tuning, { id: 'a' })
    installHook(mender, custom('ally-control-immunity-above-hp', { status: 'fear', percent: 50, target: 'self' }), 'm', { sourceSkillId: 'mender-unwavering' })
    const { ctx } = fight([mender, ally], [rat('r')])
    ally.base.resistance = 0
    applyStatus(content, tuning, ctx.rng, ally, { status: 'fear', duration: 2, sourceId: 'r' })
    each(ctx, ally, 'ally-control-immunity-above-hp', (h, hc) => h.onTurnStart?.(hc))
    expect(hasStatus(ally, 'fear')).toBe(false)
    mender.hp = Math.floor(mender.maxHp * 0.4)
    applyStatus(content, tuning, ctx.rng, ally, { status: 'fear', duration: 2, sourceId: 'r' })
    each(ctx, ally, 'ally-control-immunity-above-hp', (h, hc) => h.onTurnStart?.(hc))
    expect(hasStatus(ally, 'fear')).toBe(true)
  })

  it('party-ambush-light-shift is read by the delve (Dawn Vigil), so the fight logs no stub for it', () => {
    const mender = mana('m')
    installHook(mender, custom('party-ambush-light-shift', { amount: 1, target: 'self' }), 'm')
    const { ctx } = fight([mender], [rat('r')])
    expect(ctx.state.log.filter((e) => e.kind === 'hookStub' && e.text.startsWith('party-ambush-light-shift:'))).toHaveLength(0)
  })
})

describe('Arcanist: Tier IV–V hooks', () => {
  it('Stormcall pushes back only the targets already Shocked (Mastery −300)', () => {
    const arc = mana('a')
    const shocked = rat('s')
    const dry = rat('d')
    const { ctx } = fight([arc], [shocked, dry])
    applyStatus(content, tuning, ctx.rng, shocked, { status: 'shock', duration: 2, sourceId: 'a' })
    const e1 = shocked.energy
    const e2 = dry.energy
    const line = custom('timeline-if-status', { status: 'shock', energy: -200 })
    for (const x of [shocked, dry]) customHandler('timeline-if-status')?.apply?.(hookCtx(ctx, arc, null, line, null, 'arcanist-stormcall'), x, 100)
    expect(shocked.energy).toBe(e1 - 200)
    expect(dry.energy).toBe(e2)
    const mastery = linesAtRank(skill('arcanist-stormcall'), 10).find((l) => l.customId === 'timeline-if-status')
    expect(mastery?.energy).toBe(-300)
  })

  it('Absolute Zero freezes only a target already Chilled', () => {
    const arc = mana('a')
    const cold = rat('c')
    const warm = rat('w')
    cold.base.resistance = 0
    const { ctx } = fight([arc], [cold, warm])
    applyStatus(content, tuning, ctx.rng, cold, { status: 'chill', duration: 2, sourceId: 'a' })
    const line = custom('freeze-if-chilled', { status: 'freeze', duration: 1 })
    for (const x of [cold, warm]) customHandler('freeze-if-chilled')?.apply?.(hookCtx(ctx, arc, null, line, null, 'arcanist-absolute-zero'), x, 100)
    expect(hasStatus(cold, 'freeze')).toBe(true)
    expect(hasStatus(warm, 'freeze')).toBe(false)
  })

  it('Deep Cold: a Freeze the Arcanist causes this action lasts +1 turn; one already standing does not', () => {
    const arc = mana('a')
    installHook(arc, custom('freeze-duration-bonus', { amount: 1, target: 'self' }), 'a', { sourceSkillId: 'arcanist-deep-cold' })
    const fresh = rat('f')
    const old = rat('o')
    fresh.base.resistance = 0
    old.base.resistance = 0
    const { ctx } = fight([arc], [fresh, old])
    applyStatus(content, tuning, ctx.rng, old, { status: 'freeze', duration: 1, sourceId: 'a' })
    applyStatus(content, tuning, ctx.rng, fresh, { status: 'chill', duration: 2, sourceId: 'a' })
    const chill: SkillDef = { ...skill('arcanist-glass-heart'), id: 'test-chill', target: 'enemy', effects: [{ kind: 'applyStatus', status: 'chill', duration: 2 }], mastery: { text: '-', effects: [] } }
    cast(ctx, arc, chill, fresh)
    const f = fresh.statuses.find((s) => s.id === 'freeze')
    expect(f?.turnsLeft).toBe((content.statuses.get('freeze')?.durationDefault ?? 1) + 1)
    expect(old.statuses.find((s) => s.id === 'freeze')?.turnsLeft).toBe(1)
  })

  it('Deep Cold: each shatter by the party restores 15% of max Mana, read at the Arcanist’s next turn start', () => {
    const arc = mana('a')
    const ally = makeHeroActor(tuning, { id: 'b' })
    installHook(arc, custom('pool-on-party-shatter', { percent: 15, target: 'self' }), 'a')
    const r = rat('r')
    const { ctx } = fight([arc, ally], [r])
    arc.pool = 0
    log(ctx, { kind: 'shatter', actorId: 'b', targetId: 'r', text: 'r shatters' })
    log(ctx, { kind: 'shatter', actorId: 'r', targetId: 'b', text: 'not ours' })
    each(ctx, arc, 'pool-on-party-shatter', (h, hc) => h.onTurnStart?.(hc))
    expect(arc.pool).toBe(roundHalfUp(arc.poolMax * 0.15))
    each(ctx, arc, 'pool-on-party-shatter', (h, hc) => h.onTurnStart?.(hc))
    expect(arc.pool).toBe(roundHalfUp(arc.poolMax * 0.15))
  })

  it('Vaultbreaker chains to every other Shocked enemy and no other', () => {
    const arc = mana('a')
    const main = rat('m')
    const shocked = rat('s')
    const dry = rat('d')
    for (const x of [main, shocked, dry]) x.hp = x.maxHp = 999
    const { ctx } = fight([arc], [main, shocked, dry])
    applyStatus(content, tuning, ctx.rng, shocked, { status: 'shock', duration: 2, sourceId: 'a' })
    applyStatus(content, tuning, ctx.rng, main, { status: 'shock', duration: 2, sourceId: 'a' })
    customHandler('damage-others-with-status')?.apply?.(hookCtx(ctx, arc, null, custom('damage-others-with-status', { multiplier: 1.2, damageType: 'lightning', status: 'shock' }), null, 'arcanist-vaultbreaker'), main, 100)
    // The chain strikes only the other Shocked enemy (a Shocked target's own shock-chain may then spill on, by the status rule).
    const chained = ctx.state.log.filter((e) => e.kind === 'damage' && e.text.includes('Vaultbreaker (chain)')).map((e) => e.targetId)
    expect(chained).toEqual(['s'])
    expect(shocked.hp).toBeLessThan(999)
    expect(main.hp).toBe(999)
    void dry
  })

  it('Conflagration: Burn and Shock the Arcanist applies last +1 turn; Chill does not', () => {
    const arc = mana('a')
    installHook(arc, custom('status-duration-bonus', { status: 'burn', amount: 1, target: 'self' }), 'a')
    const r = rat('r')
    r.base.resistance = 0
    const { ctx } = fight([arc], [r])
    applyLine(ctx, arc, { kind: 'applyStatus', status: 'burn', duration: 3, multiplier: 1, damageType: 'fire' }, 'enemy', r, SOURCE)
    applyLine(ctx, arc, { kind: 'applyStatus', status: 'chill', duration: 2 }, 'enemy', r, SOURCE)
    expect(r.statuses.find((s) => s.id === 'burn')?.turnsLeft).toBe(4)
    expect(r.statuses.find((s) => s.id === 'chill')?.turnsLeft).toBe(2)
  })

  it('Endless Winter: for 3 turns an enemy is Chilled 1 turn each time it acts', () => {
    const arc = mana('a')
    const r = rat('r')
    r.base.resistance = 0
    const { ctx } = fight([arc], [r])
    customHandler('status-on-own-action')?.apply?.(hookCtx(ctx, arc, null, custom('status-on-own-action', { status: 'chill', amount: 1, duration: 3 }), null, 'arcanist-endless-winter'), r, 100)
    const hook = r.hooks.find((h) => h.customId === 'status-on-own-action')
    expect(hook?.turnsLeft).toBe(3)
    each(ctx, r, 'status-on-own-action', (h, hc) => h.onHolderAttacks?.(hc))
    expect(r.statuses.find((s) => s.id === 'chill')?.turnsLeft).toBe(1)
  })

  it('Glass Heart: a kill lifts every hero +15 Momentum; no kill, nothing', () => {
    const arc = mana('a')
    const ally = makeHeroActor(tuning, { id: 'b' })
    const r = rat('r')
    const { ctx } = fight([arc, ally], [r])
    const line = custom('party-momentum-on-kill', { amount: 15, target: 'self' })
    log(ctx, { kind: 'action', actorId: 'a', targetId: 'r', text: 'a uses Glass Heart' })
    customHandler('party-momentum-on-kill')?.apply?.(hookCtx(ctx, arc, null, line, null, 'arcanist-glass-heart'), arc, 100)
    expect(ally.momentum).toBe(0)
    log(ctx, { kind: 'damage', actorId: 'a', targetId: 'r', amount: 99, text: 'kill', data: { killed: true } })
    customHandler('party-momentum-on-kill')?.apply?.(hookCtx(ctx, arc, null, line, null, 'arcanist-glass-heart'), arc, 100)
    expect(ally.momentum).toBe(15)
    expect(arc.momentum).toBe(15)
    // The skill's own lines: sure hit and sure crit against a Frozen target, then the hit, then the Momentum.
    const lines = skill('arcanist-glass-heart').effects.map((l) => l.customId ?? l.kind)
    expect(lines).toEqual(['sure-hit-vs-status', 'guaranteed-crit-vs-status', 'damage', 'party-momentum-on-kill'])
  })

  it('Rimeborn: a melee attacker that hits the Arcanist is Chilled; a ranged one is not', () => {
    const arc = mana('a')
    installHook(arc, custom('status-on-melee-attacker', { status: 'chill', duration: 1, target: 'self' }), 'a')
    const melee = rat('m')
    const ranged = rat('r')
    melee.base.resistance = 0
    ranged.base.resistance = 0
    const { ctx } = fight([arc], [melee, ranged])
    dealDamage(ctx, melee, arc, hit(1))
    dealDamage(ctx, ranged, arc, hit(1, { isMelee: false }))
    expect(hasStatus(melee, 'chill')).toBe(true)
    expect(hasStatus(ranged, 'chill')).toBe(false)
  })

  it('Font of Mana refills an empty pool to 50% once per fight', () => {
    const arc = mana('a')
    installHook(arc, custom('pool-refill-at-zero', { percent: 50, amount: 1, target: 'self' }), 'a')
    const { ctx } = fight([arc], [rat('r')])
    arc.pool = 0
    each(ctx, arc, 'pool-refill-at-zero', (h, hc) => h.onTurnStart?.(hc))
    expect(arc.pool).toBe(roundHalfUp(arc.poolMax * 0.5))
    arc.pool = 0
    each(ctx, arc, 'pool-refill-at-zero', (h, hc) => h.onTurnStart?.(hc))
    expect(arc.pool).toBe(0)
  })

  it('Nullfield doubles every Shield on the caster’s side; its Mastery line reaches only bosses', () => {
    const arc = mana('a')
    const ally = makeHeroActor(tuning, { id: 'b' })
    const r = rat('r')
    const boss = rat('boss')
    if (boss.monster) boss.monster.isBoss = true
    boss.base.resistance = 0
    r.base.resistance = 0
    const { ctx } = fight([arc, ally], [r, boss])
    applyStatus(content, tuning, ctx.rng, ally, { status: 'shield', duration: 2, magnitude: 30, sourceId: 'a' })
    customHandler('double-ally-shields')?.apply?.(hookCtx(ctx, arc, null, custom('double-ally-shields', { percent: 100 }), null, 'arcanist-nullfield'), arc, 100)
    expect(ally.statuses.find((s) => s.id === 'shield')?.magnitude).toBe(60)
    const line = custom('apply-if-boss', { status: 'silence', duration: 3 })
    for (const x of [r, boss]) customHandler('apply-if-boss')?.apply?.(hookCtx(ctx, arc, null, line, null, 'arcanist-nullfield'), x, 100)
    expect(hasStatus(r, 'silence')).toBe(false)
    expect(boss.statuses.find((s) => s.id === 'silence')?.turnsLeft).toBe(2)
  })

  it('Rewind and Paradox are documented stubs that log once per fight', () => {
    const arc = mana('a')
    installHook(arc, custom('heavy-casts-uninterrupted', { amount: 1000, target: 'self' }), 'a')
    const { ctx } = fight([arc], [rat('r')])
    customHandler('rewind-ally')?.apply?.(hookCtx(ctx, arc, null, custom('rewind-ally'), null, 'arcanist-rewind'), arc, 100)
    customHandler('rewind-ally')?.apply?.(hookCtx(ctx, arc, null, custom('rewind-ally'), null, 'arcanist-rewind'), arc, 100)
    const stubs = ctx.state.log.filter((e) => e.kind === 'hookStub').map((e) => e.text.split(':')[0])
    expect(stubs.filter((s) => s === 'rewind-ally')).toHaveLength(1)
    expect(stubs.filter((s) => s === 'heavy-casts-uninterrupted')).toHaveLength(1)
  })
})
