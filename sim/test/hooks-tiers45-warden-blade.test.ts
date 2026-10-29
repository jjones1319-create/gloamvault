import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { RawContentFile } from '../src/content.ts'
import { applyLine, dealDamage, hookCtx, statOf, type DamageInput, type EffectContext, type LineSource } from '../src/effects.ts'
import { createFight } from '../src/fight.ts'
import type { Actor, HookInstance } from '../src/fight-types.ts'
import { applyPassives } from '../src/hero.ts'
import { activeHooks, installHook } from '../src/hooks.ts'
import { buildMonsterActor } from '../src/monsters.ts'
import { Rng, seedState } from '../src/rng.ts'
import { linesAtRank } from '../src/skill-lines.ts'
import { customHandler } from '../src/skills/custom/index.ts'
import { applyStatus } from '../src/statuses.ts'
import { mitigate, roundHalfUp } from '../src/stats.ts'
import type { Effect, MonsterDef, SkillDef } from '../src/types/content.ts'
import { exactTuning, example, loadTuning, makeContent, makeHeroActor } from './helpers.ts'

/**
 * Tiers IV–V of the Warden and the Blade (docs/classes/warden.md, blade.md §4; Phase 7): every new hook's rule, the
 * real skill records driving them, and D-099's limits (Oath of the Vault once per ally per cast, Undying Rage once per
 * floor and twice with Deathless, no execute above 6.0×).
 */
const tuning = exactTuning(loadTuning())
const K = tuning.derived.defense.mitigationK

function classSkills(cls: string): RawContentFile[] {
  return readdirSync(`content/skills/${cls}`)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ kind: 'skill' as const, path: `content/skills/${cls}/${f}`, json: JSON.parse(readFileSync(`content/skills/${cls}/${f}`, 'utf8')) }))
}
const content = makeContent([example('monster', 'monster'), ...classSkills('warden'), ...classSkills('blade')])
const ratDef = content.monsters.get('giant-rat') as MonsterDef
const SKILL = (id: string): SkillDef => {
  const s = content.skills.get(id)
  if (!s) throw new Error(`no skill ${id}`)
  return s
}
const H = (id: string) => {
  const h = customHandler(id)
  if (!h) throw new Error(`no handler ${id}`)
  return h
}

function rat(level = 1, id = 'rat', hp?: number): Actor {
  const a = buildMonsterActor(content, tuning, ratDef, { id, level, row: 'front', hpPercent: 100 })
  if (hp !== undefined) {
    a.maxHp = hp
    a.hp = hp
  }
  return a
}

function setup(heroes: Actor[], monsters: Actor[], seed = 7) {
  const rng = new Rng(seedState(seed, seed + 1))
  const state = createFight(content, tuning, { heroes, pets: [], monsters, surprised: null, light: 70, options: { dungeonId: 'gravehollow-keep', floor: 1, floorLevel: 1 }, rng })
  const ctx: EffectContext = { content, t: tuning, state, rng }
  return { ctx, state }
}

/** A sure-footed hero: never crits, never misses, plenty of HP. */
function hero(id: string, extra: Partial<Parameters<typeof makeHeroActor>[1]> = {}): Actor {
  return makeHeroActor(tuning, { id, flatHp: 500, flat: { critRate: -100, accuracy: 100 }, ...extra })
}

function sure(amount: number, damageType: DamageInput['damageType'], extra: Partial<DamageInput> = {}): DamageInput {
  return { amount, damageType, canMiss: false, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: true, ignoresDefense: true, sourceLabel: 'hit', ...extra }
}

const SOURCE: LineSource = { kind: 'skill', id: 'test', label: 'test', isUltimate: false, neverMisses: true, effectPercent: 100, reach: true, ranged: false, isMelee: true }
const RAT: LineSource = { kind: 'attack', id: 'bite', label: 'Bite', isUltimate: false, neverMisses: true, effectPercent: 100, reach: true, ranged: false, isMelee: true }

function sourceOf(skill: SkillDef, rank = 1): LineSource {
  return { kind: 'skill', id: skill.id, label: skill.name, isUltimate: skill.isUltimate, neverMisses: skill.isUltimate, effectPercent: 100 + skill.rankScaling.effectPerRank * (rank - 1), reach: true, ranged: false, isMelee: true }
}

function pushAction(ctx: EffectContext, actor: Actor): void {
  ctx.state.log.push({ tick: ctx.state.tick, round: ctx.state.round, kind: 'action', actorId: actor.id, text: `${actor.name} acts` })
}

/** Resolves a real skill as the fight does (its lines at the rank, then the actor's onSkillUsed hooks), on the actor's turn. */
function cast(ctx: EffectContext, actor: Actor, skill: SkillDef, chosen: Actor | null, rank = 1): void {
  ctx.state.actingId = actor.id
  pushAction(ctx, actor)
  for (const line of linesAtRank(skill, rank)) applyLine(ctx, actor, line, skill.target, chosen, sourceOf(skill, rank))
  for (const { status, hook, line } of activeHooks(content, actor)) customHandler(line.customId ?? '')?.onSkillUsed?.(hookCtx(ctx, actor, status, line, hook), skill)
}

function hooksOf(actor: Actor, id: string): HookInstance[] {
  return actor.hooks.filter((h) => h.customId === id)
}

const custom = (customId: string, extra: Partial<Effect> = {}): Effect => ({ kind: 'custom', customId, target: 'self', ...extra })

describe('Tiers IV–V in the content: the Warden and the Blade', () => {
  it('each school has three Tier IV and three Tier V skills, prerequisites one tier down in the school', () => {
    for (const cls of ['warden', 'blade']) {
      const all = [...content.skills.values()].filter((s) => s.classId === cls && !s.isUltimate)
      expect(all).toHaveLength(45)
      for (const tier of [4, 5]) {
        const row = all.filter((s) => s.tier === tier)
        expect(row).toHaveLength(9)
        for (const s of row) {
          const pre = SKILL(s.prerequisiteId ?? '')
          expect(pre.tier).toBe(tier - 1)
          expect(pre.school).toBe(s.school)
        }
      }
    }
  })

  it('every new custom line has a handler', () => {
    for (const s of content.skills.values()) {
      if (s.tier < 4) continue
      for (const l of [...s.effects, ...s.mastery.effects]) if (l.kind === 'custom') expect(customHandler(l.customId ?? ''), `${s.id}: ${l.customId}`).not.toBeNull()
    }
  })

  it('D-099: no execute line above 6.0×; Oath once per ally per cast; Undying Rage once per floor, twice with Deathless', () => {
    const limits = tuning.skills.limits
    for (const s of content.skills.values()) {
      for (const l of [...s.effects, ...s.mastery.effects]) {
        if (l.kind === 'custom' && l.customId === 'execute-multiplier-below-hp') expect(l.multiplier ?? 0, s.id).toBeLessThanOrEqual(limits.executeMaxMultiplier)
      }
    }
    const guillotine = SKILL('blade-guillotine').effects.find((l) => l.customId === 'execute-multiplier-below-hp')
    expect(guillotine?.multiplier).toBe(5.2)
    const oath = SKILL('warden-oath-of-the-vault')
    for (const l of [...oath.effects, ...oath.mastery.effects]) if (l.customId === 'oath-of-the-vault') expect(l.amount).toBe(limits.perCast['warden-oath-of-the-vault'])
    expect(SKILL('blade-undying-rage').effects[0]?.amount).toBe(limits.perFloor['blade-undying-rage'])
    for (const l of [...SKILL('blade-deathless').effects, ...SKILL('blade-deathless').mastery.effects]) expect(l.amount).toBe(limits.perFloor['blade-deathless'])
  })
})

describe('Warden Tier IV–V hooks', () => {
  it('Rolling Bastion swaps rows, Fortifies both and blocks the next two physical hits whenever they come', () => {
    const w = hero('w')
    const a = hero('a', { row: 'back' })
    const r = rat()
    const { ctx } = setup([w, a], [r])
    cast(ctx, w, SKILL('warden-rolling-bastion'), a)
    expect([w.row, a.row]).toEqual(['back', 'front'])
    expect(w.statuses.some((s) => s.id === 'fortify') && a.statuses.some((s) => s.id === 'fortify')).toBe(true)
    // The blocks wait: a turn start does not drop them (Bone Knight's Stand's do).
    expect(hooksOf(w, 'block-next-physical-hits')[0]?.untilTurnStart).toBe(false)
    const hit = (type: DamageInput['damageType']) => dealDamage(ctx, r, w, sure(40, type)).dealt
    expect(hit('fire')).toBe(40)
    expect(hit('slash')).toBe(20)
    expect(hit('blunt')).toBe(20)
    expect(hit('slash')).toBe(40)
    expect(w.tally.blocks).toBe(2)
    expect(ctx.state.flags['autoBlock:w']).toBe(2)
  })

  it('Rolling Bastion at Mastery weighs 800 for that action only', () => {
    const w = hero('w')
    const a = hero('a', { row: 'back' })
    const { ctx } = setup([w, a], [rat()])
    cast(ctx, w, SKILL('warden-rolling-bastion'), a, 10)
    const hook = hooksOf(w, 'this-action-weight')[0]
    expect(hook).toBeDefined()
    expect(H('this-action-weight').modifyWeight?.(hookCtx(ctx, w, null, hook!.line, hook!), 1000)).toBe(800)
    expect(hooksOf(w, 'this-action-weight')).toEqual([])
    // A stale hook (a later action) leaves the weight alone.
    const stale = installHook(w, hook!.line, w.id, { data: { action: w.tally.actions - 1 } })
    expect(H('this-action-weight').modifyWeight?.(hookCtx(ctx, w, null, stale.line, stale), 1000)).toBe(1000)
  })

  it('Rampart shields every ally for 20% of the Warden’s max HP and Regens the Warden; Mastery adds Fortify', () => {
    const w = hero('w')
    const a = hero('a', { row: 'back', flatHp: 50 })
    const { ctx } = setup([w, a], [rat()])
    cast(ctx, w, SKILL('warden-rampart'), null, 10)
    const shield = roundHalfUp(w.maxHp * 0.2 * 1.36)
    expect(a.statuses.find((s) => s.id === 'shield')?.magnitude).toBe(shield)
    expect(w.statuses.find((s) => s.id === 'shield')?.magnitude).toBe(shield)
    expect(w.statuses.some((s) => s.id === 'regen')).toBe(true)
    expect(a.statuses.some((s) => s.id === 'fortify')).toBe(true)
  })

  it('Iron Vigil: +15% Defense and +5 Momentum per hit only while an enemy holds the Warden’s Taunt', () => {
    const w = hero('w', { armorDefense: 60 })
    const r = rat()
    const { ctx } = setup([w], [r])
    installHook(w, custom('taunting-defense-and-momentum', { amount: 5, percent: 15 }), w.id, { sourceSkillId: 'warden-iron-vigil' })
    const base = statOf(ctx, w, 'defense')
    w.momentum = 0
    dealDamage(ctx, r, w, sure(30, 'blunt'))
    expect(w.momentum).toBe(tuning.derived.momentum.onHit)
    expect(statOf(ctx, w, 'defense')).toBe(base)
    expect(applyStatus(content, tuning, ctx.rng, r, { status: 'taunt', sourceId: w.id }).outcome).toBe('applied')
    w.momentum = 0
    const r1 = dealDamage(ctx, r, w, sure(100, 'blunt', { ignoresDefense: false }))
    expect(statOf(ctx, w, 'defense')).toBe(roundHalfUp(base * 1.15))
    expect(r1.dealt).toBe(mitigate(100, roundHalfUp(base * 1.15), K))
    expect(w.momentum).toBe(tuning.derived.momentum.onHit + 5)
  })

  it("Mountain's Verdict petrifies a target the blow finds under 30% HP, Dazes a boss instead, and spares a healthy one", () => {
    const w = hero('w')
    const low = rat(12, 'low', 1000)
    const boss = rat(12, 'boss', 1000)
    const fit = rat(12, 'fit', 1000)
    const { ctx } = setup([w], [low, boss, fit])
    boss.monster!.isBoss = true
    const line = SKILL('warden-mountains-verdict').effects[1]!
    for (const t of [low, boss, fit]) {
      t.hp = t === fit ? 900 : 250
      pushAction(ctx, w)
      applyLine(ctx, w, { kind: 'damage', multiplier: 0.05, damageType: 'blunt' }, 'enemyFront', t, SOURCE)
      const energy = t.energy
      applyLine(ctx, w, line, 'enemyFront', t, SOURCE)
      if (t === boss) expect(t.energy).toBe(energy - 500)
    }
    expect(low.statuses.some((s) => s.id === 'petrify')).toBe(true)
    expect(boss.statuses.some((s) => s.id === 'petrify')).toBe(false)
    expect(fit.statuses.some((s) => s.id === 'petrify')).toBe(false)
  })

  it('Aegis of the Keep turns half of each blow on an ally onto the Warden, who takes −30% for the duration', () => {
    const w = hero('w', { flatHp: 800 })
    const a = hero('a', { row: 'back' })
    const r = rat(5)
    const { ctx } = setup([w, a], [r])
    cast(ctx, w, SKILL('warden-aegis-of-the-keep'), null)
    expect(hooksOf(a, 'redirect-ally-damage-percent')).toHaveLength(1)
    expect(hooksOf(w, 'redirect-ally-damage-percent')).toHaveLength(0)
    // On the Warden's own turn the −30% hook gets one extra turn, as a fresh status would.
    expect(hooksOf(w, 'damage-taken-percent-timed')[0]?.turnsLeft).toBe(4)
    const before = w.hp
    expect(dealDamage(ctx, r, a, sure(100, 'blunt')).dealt).toBe(50)
    const share = ctx.state.log.find((e) => e.kind === 'damage' && e.targetId === 'w' && e.text.includes('Aegis'))
    const D = statOf(ctx, w, 'defense')
    expect(share?.amount).toBe(mitigate(roundHalfUp(50 * 0.7), D, K))
    expect(before - w.hp).toBe(share?.amount)
    // A blow on the Warden itself is only cut by its own −30%.
    expect(dealDamage(ctx, r, w, sure(100, 'blunt')).dealt).toBe(70)
  })

  it('Living Wall blocks elemental hits at its share of the Block chance and every block gives Momentum', () => {
    const w = hero('w', { shieldBlock: 100 })
    const r = rat()
    const { ctx } = setup([w], [r])
    installHook(w, custom('elemental-block-and-momentum', { amount: 5, percent: 100 }), w.id, { sourceSkillId: 'warden-living-wall' })
    w.momentum = 0
    expect(dealDamage(ctx, r, w, sure(40, 'fire')).dealt).toBe(20)
    expect(w.momentum).toBe(5 + tuning.derived.momentum.onHit)
    w.momentum = 0
    expect(dealDamage(ctx, r, w, sure(40, 'slash')).dealt).toBe(20)
    expect(w.momentum).toBe(5 + tuning.derived.momentum.onHit)
    expect(w.tally.blocks).toBe(2)
  })

  it('Unyielding Point: counter-hits at 1.5× (stacking with Punish), Root at Mastery, and Counter Stance from the start', () => {
    const w = hero('w', { flatHp: 300 })
    installHook(w, custom('counter-stance-at-fight-start', { multiplier: 1, amount: 1 }), w.id, { sourceSkillId: 'warden-unyielding-point' })
    installHook(w, custom('counter-hit-multiplier', { multiplier: 1.5, status: 'root', duration: 1 }), w.id, { sourceSkillId: 'warden-unyielding-point' })
    const r = rat(6)
    const { ctx } = setup([w], [r])
    expect(hooksOf(w, 'counter-stance')).toHaveLength(1)
    expect(hooksOf(w, 'counter-stance')[0]?.untilTurnStart).toBe(true)
    const A = statOf(ctx, w, 'attackPhys')
    const D = statOf(ctx, r, 'defense')
    dealDamage(ctx, r, w, sure(10, 'pierce'))
    const counter = ctx.state.log.find((e) => e.kind === 'damage' && e.text.includes('counter'))
    expect(counter?.amount).toBe(mitigate(roundHalfUp(A * 1.5), D, K))
    expect(r.statuses.some((s) => s.id === 'root')).toBe(true)
    // With Punish's +50% beside it the two add (+100% on the 1.0× counter).
    const w2 = hero('w2', { flatHp: 300 })
    const r2 = rat(6, 'rat2')
    const s2 = setup([w2], [r2])
    applyLine(s2.ctx, w2, { kind: 'custom', customId: 'counter-stance', multiplier: 1, amount: 1, target: 'self' }, 'self', w2, SOURCE)
    installHook(w2, custom('counter-hit-multiplier', { multiplier: 1.5 }), w2.id, { sourceSkillId: 'warden-unyielding-point' })
    installHook(w2, custom('counter-hit-damage-percent', { percent: 50 }), w2.id, { sourceSkillId: 'warden-punish' })
    dealDamage(s2.ctx, r2, w2, sure(10, 'pierce'))
    const both = s2.state.log.find((e) => e.kind === 'damage' && e.text.includes('counter'))
    expect(both?.amount).toBe(mitigate(roundHalfUp(statOf(s2.ctx, w2, 'attackPhys') * 2), statOf(s2.ctx, r2, 'defense'), K))
  })

  it('Immovable resists Grab, Root, Web, Daze and Petrify; allies in its row resist Fear (and Grab at Mastery); a row change follows', () => {
    const w = hero('w')
    const a = hero('a')
    const b = hero('b', { row: 'back' })
    installHook(w, custom('immovable', { amount: 1 }), w.id, { sourceSkillId: 'warden-immovable' })
    const { ctx, state } = setup([w, a, b], [rat()])
    for (const s of ['grab', 'root', 'web', 'daze', 'petrify'] as const) expect(applyStatus(content, tuning, ctx.rng, w, { status: s, sourceId: 'rat' }).outcome, s).toBe('resisted')
    expect(applyStatus(content, tuning, ctx.rng, a, { status: 'fear', sourceId: 'rat' }).outcome).toBe('resisted')
    expect(applyStatus(content, tuning, ctx.rng, a, { status: 'grab', sourceId: 'rat' }).outcome).toBe('resisted')
    expect(b.hooks.filter((h) => h.customId === 'status-resist-bonus')).toEqual([])
    expect(state.log.filter((e) => e.kind === 'hookStub' && e.text.startsWith('immovable'))).toHaveLength(1)
    // a steps back: at the Warden's next turn start the ward falls away from a, and b (now beside nobody) stays bare.
    a.row = 'back'
    const hook = hooksOf(w, 'immovable')[0]!
    H('immovable').onTurnStart?.(hookCtx(ctx, w, null, hook.line, hook))
    expect(a.hooks.filter((h) => h.customId === 'status-resist-bonus')).toEqual([])
    expect(w.hooks.filter((h) => h.customId === 'status-resist-bonus')).toHaveLength(5)
  })

  it('Warden of the Pass takes single-target blows on allies in its row and counters at 1.5×; the back row is not covered', () => {
    const w = hero('w', { flatHp: 800 })
    const a = hero('a')
    const b = hero('b', { row: 'back' })
    const r = rat(5)
    const { ctx } = setup([w, a, b], [r])
    cast(ctx, w, SKILL('warden-warden-of-the-pass'), null)
    expect(hooksOf(w, 'intercept-row-and-counter')[0]?.turnsLeft).toBe(4)
    const aHp = a.hp
    const wHp = w.hp
    applyLine(ctx, r, { kind: 'damage', multiplier: 1, damageType: 'pierce' }, 'enemy', a, RAT)
    expect(a.hp).toBe(aHp)
    expect(w.hp).toBeLessThan(wHp)
    const counter = ctx.state.log.find((e) => e.kind === 'damage' && e.text.includes('counter (the pass)'))
    expect(counter?.targetId).toBe('rat')
    expect(counter?.amount).toBe(mitigate(roundHalfUp(statOf(ctx, w, 'attackPhys') * 1.5), statOf(ctx, r, 'defense'), K))
    const bHp = b.hp
    applyLine(ctx, r, { kind: 'damage', multiplier: 1, damageType: 'pierce' }, 'enemy', b, RAT)
    expect(b.hp).toBeLessThan(bHp)
  })

  it('Ironlung: shouts weigh 800 and give the other allies +10 Momentum; other skills are untouched', () => {
    const w = hero('w')
    const a = hero('a', { row: 'back' })
    const { ctx } = setup([w, a], [rat()])
    const weight = installHook(w, custom('school-action-weight', { amount: 800 }), w.id, { sourceSkillId: 'warden-ironlung' })
    const share = installHook(w, custom('ally-momentum-on-shout', { amount: 10 }), w.id, { sourceSkillId: 'warden-ironlung' })
    a.momentum = 0
    w.momentum = 0
    for (const h of [weight, share]) H(h.customId).onSkillUsed?.(hookCtx(ctx, w, null, h.line, h), SKILL('warden-warhorn'))
    expect(H('school-action-weight').modifyWeight?.(hookCtx(ctx, w, null, weight.line, weight), 1000)).toBe(800)
    expect(a.momentum).toBe(10)
    expect(w.momentum).toBe(0)
    w.tally.actions += 1
    for (const h of [weight, share]) H(h.customId).onSkillUsed?.(hookCtx(ctx, w, null, h.line, h), SKILL('warden-sentinels-sweep'))
    expect(H('school-action-weight').modifyWeight?.(hookCtx(ctx, w, null, weight.line, weight), 1400)).toBe(1400)
    expect(a.momentum).toBe(10)
  })

  it('Mocking Roar Taunts and Marks every enemy; Warhorn Hastes every ally', () => {
    const w = hero('w')
    const a = hero('a', { row: 'back' })
    const r1 = rat(1, 'r1')
    const r2 = rat(1, 'r2')
    const { ctx } = setup([w, a], [r1, r2])
    cast(ctx, w, SKILL('warden-mocking-roar'), null)
    for (const r of [r1, r2]) expect(r.statuses.map((s) => s.id).sort()).toEqual(['mark', 'taunt'])
    cast(ctx, w, SKILL('warden-warhorn'), null)
    expect(w.statuses.some((s) => s.id === 'haste') && a.statuses.some((s) => s.id === 'haste')).toBe(true)
  })

  it('Roar of Ruin Stuns only a target Dazed since its own last turn', () => {
    const w = hero('w')
    const r = rat(6)
    const { ctx } = setup([w], [r])
    const line = SKILL('warden-roar-of-ruin').effects[1]!
    ctx.state.log.push({ tick: 0, round: 1, kind: 'status', actorId: 'w', targetId: r.id, text: 'rat is daze', data: { status: 'daze' } })
    pushAction(ctx, w)
    applyLine(ctx, w, line, 'allEnemies', null, SOURCE)
    expect(r.statuses.some((s) => s.id === 'stun')).toBe(true)
    r.statuses = []
    ctx.state.log.push({ tick: 1, round: 1, kind: 'action', actorId: r.id, text: 'rat bites' })
    pushAction(ctx, w)
    applyLine(ctx, w, line, 'allEnemies', null, SOURCE)
    expect(r.statuses.some((s) => s.id === 'stun')).toBe(false)
  })

  it('Oath of the Vault saves each ally once per cast (D-099), ends after three of the caster’s turns, and the caster pays 15%', () => {
    const w = hero('w')
    const a = hero('a')
    const b = hero('b', { row: 'back' })
    const r = rat(5)
    const { ctx } = setup([w, a, b], [r])
    cast(ctx, w, SKILL('warden-oath-of-the-vault'), null)
    for (const x of [w, a, b]) expect(hooksOf(x, 'oath-of-the-vault').filter((h) => h.data.role === 'save').map((h) => h.counter)).toEqual([1])
    expect(a.statuses.some((s) => s.id === 'fortify')).toBe(true)
    const first = dealDamage(ctx, r, a, sure(10_000, 'blunt'))
    expect(first.downed).toBe(false)
    expect(a.hp).toBe(1)
    const second = dealDamage(ctx, r, a, sure(10_000, 'blunt'))
    expect(second.downed).toBe(true)
    expect(dealDamage(ctx, r, b, sure(10_000, 'blunt')).downed).toBe(false)
    const oath = hooksOf(w, 'oath-of-the-vault').find((h) => h.data.role === 'oath')!
    const tick = () => H('oath-of-the-vault').onTurnStart?.(hookCtx(ctx, w, null, oath.line, oath))
    tick()
    tick()
    tick()
    expect(hooksOf(w, 'oath-of-the-vault').some((h) => h.data.role === 'oath')).toBe(true)
    const hp = w.hp
    tick()
    expect(hooksOf(w, 'oath-of-the-vault')).toEqual([])
    expect(hooksOf(b, 'oath-of-the-vault')).toEqual([])
    expect(hp - w.hp).toBe(roundHalfUp(w.maxHp * 0.15))
  })

  it('a second Oath replaces the first, and a fallen oath-keeper’s oath saves nobody', () => {
    const w = hero('w')
    const a = hero('a')
    const r = rat(5)
    const { ctx } = setup([w, a], [r])
    cast(ctx, w, SKILL('warden-oath-of-the-vault'), null)
    w.tally.actions += 1
    cast(ctx, w, SKILL('warden-oath-of-the-vault'), null)
    expect(hooksOf(a, 'oath-of-the-vault').map((h) => h.data.cast)).toEqual([2])
    w.downed = true
    expect(dealDamage(ctx, r, a, sure(10_000, 'blunt')).downed).toBe(true)
  })

  it("Legend's Voice: +25% Momentum gain for the holder and the party; its Ultimate Weakens every enemy", () => {
    const w = hero('w')
    const a = hero('a', { row: 'back' })
    const r1 = rat(1, 'r1')
    const r2 = rat(1, 'r2')
    r2.row = 'back'
    installHook(w, custom('party-momentum-gain-percent', { percent: 25 }), w.id, { sourceSkillId: 'warden-legends-voice' })
    const ult = installHook(w, custom('ultimate-status-all-enemies', { status: 'weaken', duration: 2 }), w.id, { sourceSkillId: 'warden-legends-voice' })
    const { ctx } = setup([w, a], [r1, r2])
    expect(statOf(ctx, w, 'momentumGain')).toBe(125)
    expect(statOf(ctx, a, 'momentumGain')).toBe(125)
    H('ultimate-status-all-enemies').onSkillUsed?.(hookCtx(ctx, w, null, ult.line, ult), SKILL('warden-warhorn'))
    expect(r1.statuses.some((s) => s.id === 'weaken')).toBe(false)
    H('ultimate-status-all-enemies').onSkillUsed?.(hookCtx(ctx, w, null, ult.line, ult), SKILL('warden-the-gate-holds'))
    expect(r1.statuses.some((s) => s.id === 'weaken') && r2.statuses.some((s) => s.id === 'weaken')).toBe(true)
  })
})

describe('Blade Tier IV–V hooks', () => {
  it('Quicksilver gives 800 energy back once per fight (twice at Mastery)', () => {
    const b = hero('b')
    const { ctx } = setup([b], [rat()])
    const qs = SKILL('blade-quicksilver')
    const e0 = b.energy
    cast(ctx, b, qs, null)
    expect(b.energy).toBe(e0 + 800)
    cast(ctx, b, qs, null)
    expect(b.energy).toBe(e0 + 800)
    expect(ctx.state.log.some((e) => e.kind === 'nothing')).toBe(true)
    const b2 = hero('b2')
    const s2 = setup([b2], [rat(1, 'r2')])
    const e2 = b2.energy
    cast(s2.ctx, b2, qs, null, 10)
    cast(s2.ctx, b2, qs, null, 10)
    cast(s2.ctx, b2, qs, null, 10)
    expect(b2.energy).toBe(e2 + 1600)
  })

  it('Perfect Tempo makes every third Iron Dance action free and ignores other schools', () => {
    const b = hero('b')
    const { ctx } = setup([b], [rat()])
    const hook = installHook(b, custom('school-every-nth-free', { amount: 3 }), b.id, { sourceSkillId: 'blade-perfect-tempo' })
    const h = H('school-every-nth-free')
    const hc = () => hookCtx(ctx, b, null, hook.line, hook)
    const twin = SKILL('blade-twin-cut')
    const seen: number[] = []
    for (let i = 0; i < 6; i++) {
      seen.push(h.costPercent?.(hc(), twin) ?? 0)
      h.onSkillUsed?.(hc(), twin)
      if (i === 1) {
        expect(h.costPercent?.(hc(), SKILL('blade-open-vein'))).toBe(0)
        h.onSkillUsed?.(hc(), SKILL('blade-open-vein'))
      }
    }
    expect(seen).toEqual([0, 0, -100, 0, 0, -100])
  })

  it("Unending Rhythm Hastes and raises Blade Rhythm's cap to 6 for the fight; without Blade Rhythm it says so", () => {
    const b = hero('b')
    const { ctx } = setup([b], [rat()])
    const rhythm = installHook(b, custom('school-combo-damage-stacks', { amount: 3, percent: 8 }), b.id, { sourceSkillId: 'blade-blade-rhythm' })
    cast(ctx, b, SKILL('blade-unending-rhythm'), null)
    expect(rhythm.line.amount).toBe(6)
    expect(b.statuses.some((s) => s.id === 'haste')).toBe(true)
    const b2 = hero('b2')
    const s2 = setup([b2], [rat(1, 'r2')])
    cast(s2.ctx, b2, SKILL('blade-unending-rhythm'), null)
    expect(s2.state.log.some((e) => e.kind === 'nothing')).toBe(true)
  })

  it('Edge of the Dance answers every dodge with a 0.8× riposte (no limit); its Dodge cap is a logged stub', () => {
    const b = hero('b', { flat: { dodge: 95, critRate: -100 } })
    installHook(b, custom('riposte-every-dodge', { multiplier: 0.8, damageType: 'slash' }), b.id, { sourceSkillId: 'blade-edge-of-the-dance' })
    installHook(b, custom('dodge-cap', { amount: 40 }), b.id, { sourceSkillId: 'blade-edge-of-the-dance' })
    const r = rat(3, 'rat', 5000)
    const { ctx, state } = setup([b], [r])
    expect(state.log.filter((e) => e.kind === 'hookStub' && e.text.startsWith('dodge-cap'))).toHaveLength(1)
    let dodges = 0
    for (let i = 0; i < 80 && dodges < 3; i++) if (!dealDamage(ctx, r, b, sure(1, 'pierce', { canMiss: true, ignoresDefense: false })).hit) dodges += 1
    expect(dodges).toBe(3)
    const ripostes = state.log.filter((e) => e.kind === 'damage' && e.text.includes('riposte'))
    expect(ripostes).toHaveLength(3)
    expect(ripostes[0]?.amount).toBe(mitigate(roundHalfUp(statOf(ctx, b, 'attackPhys') * 0.8), statOf(ctx, r, 'defense'), K))
  })

  it('Guillotine: 2.6×, the 5.2× execute under 40% HP (≤ 6.0×), and a sure hit on a Marked target', () => {
    const b = hero('b', { weapon: { attack: 20, type: 'greatsword', damageType: 'slash', weight: 1400, strengthRequirement: 14 } })
    const r = rat(30, 'rat', 2000)
    const { ctx } = setup([b], [r])
    const A = statOf(ctx, b, 'attackPhys')
    const D = statOf(ctx, r, 'defense')
    const g = SKILL('blade-guillotine')
    r.hp = 1500
    let mark = ctx.state.log.length
    cast(ctx, b, g, r)
    const plain = mitigate(roundHalfUp(A * 2.6), D, K)
    expect(ctx.state.log.slice(mark).filter((e) => e.kind === 'damage' && e.actorId === 'b').map((e) => e.amount)).toEqual([plain])
    r.hp = 700
    mark = ctx.state.log.length
    cast(ctx, b, g, r)
    expect(ctx.state.log.slice(mark).filter((e) => e.kind === 'damage' && e.actorId === 'b').map((e) => e.amount)).toEqual([plain, plain])
    // The sure hit: armed for the action, +1,000 Accuracy against a Marked target only, gone when the skill resolves.
    pushAction(ctx, b)
    applyLine(ctx, b, g.effects[0]!, 'enemyFront', r, sourceOf(g))
    const hook = hooksOf(b, 'sure-hit-vs-status')[0]!
    const h = H('sure-hit-vs-status')
    expect(h.accuracyBonus?.(hookCtx(ctx, b, null, hook.line, hook), r)).toBe(0)
    applyStatus(content, tuning, ctx.rng, r, { status: 'mark', sourceId: 'b' })
    expect(h.accuracyBonus?.(hookCtx(ctx, b, null, hook.line, hook), r)).toBe(1000)
    h.onSkillUsed?.(hookCtx(ctx, b, null, hook.line, hook), g)
    expect(hooksOf(b, 'sure-hit-vs-status')).toEqual([])
  })

  it("Bone Knight's Cleave hits the whole front row and Fears it; Mountain Cleaver cleaves through to the back row", () => {
    const b = hero('b', { weapon: { attack: 20, type: 'greatsword', damageType: 'slash', weight: 1400, strengthRequirement: 14 } })
    const f1 = rat(5, 'f1', 3000)
    const f2 = rat(5, 'f2', 3000)
    const bk = rat(5, 'bk', 3000)
    bk.row = 'back'
    const { ctx } = setup([b], [f1, f2, bk])
    cast(ctx, b, SKILL('blade-bone-knights-cleave'), f1)
    expect(f1.statuses.some((s) => s.id === 'fear') && f2.statuses.some((s) => s.id === 'fear')).toBe(true)
    expect(bk.hp).toBe(3000)
    cast(ctx, b, SKILL('blade-mountain-cleaver'), f1)
    expect(bk.hp).toBeLessThan(3000)
  })

  it("Death's Ledger raises Executioner thresholds by 10 and adds +50 Crit Damage against a target under the raised one", () => {
    const b = hero('b')
    const r = rat(20, 'rat', 1000)
    const { ctx } = setup([b], [r])
    const hook = installHook(b, custom('execute-threshold-bonus', { amount: 10, percent: 50 }), b.id, { sourceSkillId: 'blade-deaths-ledger' })
    const h = H('execute-threshold-bonus')
    const g = SKILL('blade-guillotine')
    const exec = g.effects.find((l) => l.customId === 'execute-multiplier-below-hp')!
    expect(h.modifyLine?.(hookCtx(ctx, b, null, hook.line, hook), exec, sourceOf(g), r)).toEqual({ ...exec, percent: 50 })
    // Not an Executioner skill: untouched.
    expect(h.modifyLine?.(hookCtx(ctx, b, null, hook.line, hook), exec, sourceOf(SKILL('blade-open-vein')), r)).toBeNull()
    const base = statOf(ctx, b, 'critDamage')
    r.hp = 600
    h.modifyLine?.(hookCtx(ctx, b, null, hook.line, hook), g.effects[1]!, sourceOf(g), r)
    expect(statOf(ctx, b, 'critDamage')).toBe(base)
    r.hp = 450
    h.modifyLine?.(hookCtx(ctx, b, null, hook.line, hook), g.effects[1]!, sourceOf(g), r)
    expect(statOf(ctx, b, 'critDamage')).toBe(base + 50)
    h.onSkillUsed?.(hookCtx(ctx, b, null, hook.line, hook), g)
    expect(statOf(ctx, b, 'critDamage')).toBe(base)
  })

  it('Final Verdict on a kill: Haste for the Blade and +30% for the first ally action that deals damage', () => {
    const b = hero('b')
    const a = hero('a', { row: 'back' })
    const c = hero('c', { row: 'back' })
    const r = rat(1, 'r', 5)
    const r2 = rat(5, 'r2', 5000)
    const { ctx } = setup([b, a, c], [r, r2])
    cast(ctx, b, SKILL('blade-final-verdict'), r)
    expect(r.gone).toBe(true)
    expect(b.statuses.some((s) => s.id === 'haste')).toBe(true)
    expect(hooksOf(a, 'on-kill-haste-ally-damage')).toHaveLength(1)
    ctx.state.actingId = a.id
    const boosted = dealDamage(ctx, a, r2, sure(100, 'slash'))
    expect(boosted.dealt).toBe(130)
    expect(dealDamage(ctx, a, r2, sure(100, 'slash')).dealt).toBe(130)
    // c's boost lapsed: a claimed it.
    ctx.state.actingId = c.id
    expect(dealDamage(ctx, c, r2, sure(100, 'slash')).dealt).toBe(100)
    // No kill, no Haste.
    const b2 = hero('b2')
    const s2 = setup([b2], [rat(5, 'big', 5000)])
    cast(s2.ctx, b2, SKILL('blade-final-verdict'), s2.state.actors.find((x) => x.id === 'big')!)
    expect(b2.statuses.some((s) => s.id === 'haste')).toBe(false)
  })

  it("Reaper's Patience: after a Guard the next heavy skill weighs 1,000 and crits; anything else lets it lapse", () => {
    const b = hero('b')
    const r = rat()
    const { ctx } = setup([b], [r])
    const hook = installHook(b, custom('guard-primes-heavy', { amount: 1000, percent: 20 }), b.id, { sourceSkillId: 'blade-reapers-patience' })
    const h = H('guard-primes-heavy')
    const hc = () => hookCtx(ctx, b, null, hook.line, hook)
    b.guarding = true
    h.onTurnStart?.(hc())
    h.modifyLine?.(hc(), { kind: 'damage', multiplier: 2.6, damageType: 'slash' }, sourceOf(SKILL('blade-guillotine')), r)
    expect(h.forceCrit?.(hc(), r)).toBe(true)
    expect(h.outgoingDamagePercent?.(hc(), r, { amount: 1, damageType: 'slash', attacker: b, isSingleTarget: true, isDot: false, isUltimate: false, isMelee: true, physical: true })).toBe(20)
    expect(h.modifyWeight?.(hc(), 1400)).toBe(1000)
    expect(h.forceCrit?.(hc(), r)).toBe(false)
    // Primed, but the action is a light skill: no crit, its weight stays, and the prime is spent.
    b.guarding = true
    h.onTurnStart?.(hc())
    h.modifyLine?.(hc(), { kind: 'damage', multiplier: 0.6, damageType: 'slash' }, sourceOf(SKILL('blade-twin-cut')), r)
    expect(h.forceCrit?.(hc(), r)).toBe(false)
    expect(h.modifyWeight?.(hc(), 800)).toBe(800)
    // No Guard before: nothing.
    b.guarding = false
    h.onTurnStart?.(hc())
    h.modifyLine?.(hc(), { kind: 'damage', multiplier: 2.6, damageType: 'slash' }, sourceOf(SKILL('blade-guillotine')), r)
    expect(h.modifyWeight?.(hc(), 1400)).toBe(1400)
  })

  it('Exsanguinate deals +50% per Bleed turn left (cap +150%) and takes the Bleed off', () => {
    const b = hero('b')
    const r = rat(20, 'rat', 5000)
    const { ctx } = setup([b], [r])
    const A = statOf(ctx, b, 'attackPhys')
    const D = statOf(ctx, r, 'defense')
    const ex = SKILL('blade-exsanguinate')
    const hitsOf = (from: number) => ctx.state.log.slice(from).filter((e) => e.kind === 'damage' && e.actorId === 'b').map((e) => e.amount)
    applyStatus(content, tuning, ctx.rng, r, { status: 'bleed', magnitude: 40, duration: 4, sourceId: 'b' })
    let mark = ctx.state.log.length
    cast(ctx, b, ex, r)
    expect(hitsOf(mark)).toEqual([mitigate(roundHalfUp(A * 2.4 * 2.5), D, K)])
    expect(r.statuses.some((s) => s.id === 'bleed')).toBe(false)
    applyStatus(content, tuning, ctx.rng, r, { status: 'bleed', magnitude: 40, duration: 1, sourceId: 'b' })
    mark = ctx.state.log.length
    cast(ctx, b, ex, r)
    expect(hitsOf(mark)).toEqual([mitigate(roundHalfUp(A * 2.4 * 1.5), D, K)])
    mark = ctx.state.log.length
    cast(ctx, b, ex, r)
    expect(hitsOf(mark)).toEqual([mitigate(roundHalfUp(A * 2.4), D, K)])
    expect(hooksOf(b, 'damage-bonus-per-status-turn')).toEqual([])
  })

  it('Undying Rage (D-099): while Berserk, once per floor — the floor’s earlier trigger counts; Deathless allows two; the Mastery drops the Berserk test', () => {
    const berserk = (x: Actor) => x.modifiers.push({ stat: 'attackPhys', amount: 0, percent: 25, turnsLeft: 3, sourceId: 'blade-berserk' })
    const rage = custom('undying-rage', { amount: 1, percent: 10, duration: 2 })
    // Once per floor.
    const b = hero('b')
    const r = rat()
    const { ctx, state } = setup([b], [r])
    installHook(b, rage, b.id, { sourceSkillId: 'blade-undying-rage' })
    expect(dealDamage(ctx, r, b, sure(10_000, 'blunt')).downed).toBe(true)
    b.downed = false
    b.hp = b.maxHp
    berserk(b)
    expect(dealDamage(ctx, r, b, sure(10_000, 'blunt')).downed).toBe(false)
    expect(b.hp).toBe(1)
    expect(b.statuses.find((s) => s.id === 'regen')?.magnitude).toBe(10)
    expect(state.log.filter((e) => e.kind === 'floorLimit').map((e) => e.data?.skillId)).toEqual(['blade-undying-rage'])
    expect(dealDamage(ctx, r, b, sure(10_000, 'blunt')).downed).toBe(true)
    // A trigger earlier on the floor (buildHeroActor's floorUses) spends it before the fight.
    const b2 = hero('b2')
    berserk(b2)
    installHook(b2, rage, b2.id, { sourceSkillId: 'blade-undying-rage', data: { floorUsed: 1 } })
    const s2 = setup([b2], [rat(1, 'r2')])
    expect(dealDamage(s2.ctx, s2.state.actors[1]!, b2, sure(10_000, 'blunt')).downed).toBe(true)
    // Deathless: twice per floor, its Regen 3 turns at Mastery.
    const b3 = hero('b3')
    berserk(b3)
    installHook(b3, rage, b3.id, { sourceSkillId: 'blade-undying-rage' })
    installHook(b3, custom('deathless', { amount: 2, percent: 100, duration: 3 }), b3.id, { sourceSkillId: 'blade-deathless' })
    const s3 = setup([b3], [rat(1, 'r3')])
    const r3 = s3.state.actors[1]!
    expect(dealDamage(s3.ctx, r3, b3, sure(10_000, 'blunt')).downed).toBe(false)
    expect(dealDamage(s3.ctx, r3, b3, sure(10_000, 'blunt')).downed).toBe(false)
    expect(b3.statuses.find((s) => s.id === 'regen')?.turnsLeft).toBe(3)
    expect(dealDamage(s3.ctx, r3, b3, sure(10_000, 'blunt')).downed).toBe(true)
    // The Mastery's marker: no Berserk needed.
    const b4 = hero('b4')
    installHook(b4, rage, b4.id, { sourceSkillId: 'blade-undying-rage' })
    installHook(b4, custom('undying-rage-unbound'), b4.id, { sourceSkillId: 'blade-undying-rage' })
    const s4 = setup([b4], [rat(1, 'r4')])
    expect(dealDamage(s4.ctx, s4.state.actors[1]!, b4, sure(10_000, 'blunt')).downed).toBe(false)
  })

  it("applyPassives hands a floor-limited passive the floor's earlier triggers as data.floorUsed", () => {
    const b = hero('b')
    b.hero!.passives = ['blade-undying-rage', null]
    b.hero!.ranks = { 'blade-undying-rage': 1 }
    applyPassives(content, b, { 'blade-undying-rage': 1 })
    expect(hooksOf(b, 'undying-rage')[0]?.data.floorUsed).toBe(1)
    const fresh = hero('b2')
    fresh.hero!.passives = ['blade-undying-rage', null]
    applyPassives(content, fresh)
    expect(hooksOf(fresh, 'undying-rage')[0]?.data).toEqual({})
  })

  it('Deathless doubles Pain Threshold’s Attack and Speed lines at the fight’s start', () => {
    const b = hero('b')
    installHook(b, { kind: 'custom', customId: 'stat-percent-below-hp', stat: 'attackPhys', amount: 25, percent: 30, target: 'self' }, b.id, { sourceSkillId: 'blade-pain-threshold' })
    installHook(b, { kind: 'custom', customId: 'stat-amount-below-hp', stat: 'speed', amount: 10, percent: 25, target: 'self' }, b.id, { sourceSkillId: 'blade-pain-threshold' })
    installHook(b, custom('deathless', { amount: 2, percent: 100, duration: 2 }), b.id, { sourceSkillId: 'blade-deathless' })
    b.hp = Math.floor(b.maxHp * 0.2)
    const { ctx } = setup([b], [rat()])
    expect(hooksOf(b, 'stat-percent-below-hp')[0]?.line.percent).toBe(60)
    expect(hooksOf(b, 'stat-amount-below-hp')[0]?.line.amount).toBe(20)
    const pt = hooksOf(b, 'stat-percent-below-hp')[0]!
    H('stat-percent-below-hp').onTurnStart?.(hookCtx(ctx, b, null, pt.line, pt))
    expect(b.modifiers.find((m) => m.sourceId.startsWith('stat-percent-below-hp:blade-pain-threshold'))?.percent).toBe(60)
  })

  it('Blood Price spends 25% of max HP (never below 1), restores 40% Stamina and gives 30 Momentum', () => {
    const b = hero('b')
    const { ctx } = setup([b], [rat()])
    b.hp = b.maxHp
    b.pool = 0
    b.momentum = 0
    cast(ctx, b, SKILL('blade-blood-price'), null)
    expect(b.maxHp - b.hp).toBe(roundHalfUp(b.maxHp * 0.25))
    expect(b.pool).toBe(roundHalfUp(b.poolMax * 0.4))
    expect(b.momentum).toBe(30)
    expect(ctx.state.xp.some((x) => x.actorId === 'b' && x.id === 'vitality')).toBe(true)
    b.hp = 10
    cast(ctx, b, SKILL('blade-blood-price'), null)
    expect(b.hp).toBe(1)
    expect(b.downed).toBe(false)
  })

  it('Red Tide hits both rows, Bleeds them and heals 20% of the total', () => {
    const b = hero('b')
    const f = rat(5, 'f', 3000)
    const k = rat(5, 'k', 3000)
    k.row = 'back'
    const { ctx } = setup([b], [f, k])
    b.hp = 100
    const mark = ctx.state.log.length
    cast(ctx, b, SKILL('blade-red-tide'), null)
    const dealt = ctx.state.log.slice(mark).filter((e) => e.kind === 'damage' && e.actorId === 'b').reduce((s, e) => s + (e.amount ?? 0), 0)
    expect(f.hp < 3000 && k.hp < 3000).toBe(true)
    expect(f.statuses.some((s) => s.id === 'bleed') && k.statuses.some((s) => s.id === 'bleed')).toBe(true)
    expect(b.hp).toBe(100 + roundHalfUp(dealt * 0.2))
  })

  it('Sanguine Pact: every ally heals 15% of the damage it deals for 3 turns; the Blade Bleeds, but not at Mastery', () => {
    const b = hero('b')
    const a = hero('a', { row: 'back' })
    const r = rat(5, 'r', 5000)
    const { ctx } = setup([b, a], [r])
    cast(ctx, b, SKILL('blade-sanguine-pact'), null)
    expect(hooksOf(b, 'party-lifesteal-percent')[0]?.turnsLeft).toBe(4)
    expect(hooksOf(a, 'party-lifesteal-percent')[0]?.turnsLeft).toBe(3)
    expect(b.statuses.some((s) => s.id === 'bleed')).toBe(true)
    a.hp = 100
    const hit = dealDamage(ctx, a, r, sure(200, 'slash'))
    expect(a.hp).toBe(100 + roundHalfUp(hit.dealt * 0.15))
    const b2 = hero('b2')
    const s2 = setup([b2], [rat(5, 'r2', 5000)])
    cast(s2.ctx, b2, SKILL('blade-sanguine-pact'), null, 10)
    expect(b2.statuses.some((s) => s.id === 'bleed')).toBe(false)
    expect(hooksOf(b2, 'party-lifesteal-percent')[0]?.turnsLeft).toBe(5)
  })

  it('Tempest Dance spreads five hits over random enemies in both rows; Hundred Cuts lands eight and pays Momentum per hit', () => {
    const b = hero('b', { weapon: { attack: 10, type: 'sword', damageType: 'slash', weight: 800, strengthRequirement: 8, dual: true } })
    const f = rat(5, 'f', 5000)
    const k = rat(5, 'k', 5000)
    k.row = 'back'
    const { ctx } = setup([b], [f, k])
    let mark = ctx.state.log.length
    cast(ctx, b, SKILL('blade-tempest-dance'), f)
    const hits = ctx.state.log.slice(mark).filter((e) => (e.kind === 'damage' || e.kind === 'miss') && e.actorId === 'b')
    expect(hits).toHaveLength(5)
    b.momentum = 0
    mark = ctx.state.log.length
    cast(ctx, b, SKILL('blade-hundred-cuts'), f)
    const landed = ctx.state.log.slice(mark).filter((e) => e.kind === 'damage' && e.actorId === 'b').length
    expect(landed).toBe(8)
    expect(b.momentum).toBe(8 * 4)
    expect(f.statuses.some((s) => s.id === 'bleed')).toBe(true)
  })
})
