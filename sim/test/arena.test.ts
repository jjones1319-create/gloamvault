import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { arenaAfterTurn, arenaAttackResolved, arenaExtraActions, arenaHeroAuto, arenaLegalActions, arenaNoteSwap, arenaRoundStart, arenaTorch, doArenaAction, oathTarget, takeWindup, beginWindup } from '../src/arena.ts'
import type { Content } from '../src/content.ts'
import { dealDamage, reachableEnemies, type EffectContext } from '../src/effects.ts'
import { spawnBossFight } from '../src/explore.ts'
import { createFight, legalFightActions, runFightAuto } from '../src/fight.ts'
import type { Actor, FightEvent, FightState } from '../src/fight-types.ts'
import { Rng } from '../src/rng.ts'
import { applyStatus } from '../src/statuses.ts'
import { customHandler } from '../src/skills/custom/index.ts'
import type { MonsterDef } from '../src/types/content.ts'
import { exactTuning, makeHeroActor, type HeroSpec } from './helpers.ts'

/**
 * The boss arenas (07 §2.8; sim/src/arena.ts): each arena rule of the four Gravehollow bosses, the tells (06 §8.10,
 * D-099), the arena events' shapes the balance runner reads, and the heroes' arena actions.
 */
const real = loadContentDir(path.resolve('content'))

/** Adds the bosses call that another pass may not have written yet stand in as a Giant Rat under their id. */
function withStubs(c: Content): Content {
  const rat = c.monsters.get('giant-rat')!
  const monsters = new Map(c.monsters)
  const stub = (id: string, extra: Partial<MonsterDef> = {}) => {
    if (!monsters.has(id)) monsters.set(id, { ...rat, id, name: id, ...extra })
  }
  for (const id of ['skeleton-footman', 'wraith', 'tidebound-acolyte', 'tidebound-blade', 'deep-tentacle', 'vault-lantern', 'grinning-netter', 'grinning-cutpurse', 'grinning-crossbowman']) stub(id)
  const hunter = { levelOffset: 3, entersAtTick: 40, roomsPerTick: 0.5, cannotFlee: true, guaranteedRarePart: true, movesDuringRest: false }
  for (const id of ['wardens-hound', 'vault-leech', 'old-gnaw']) stub(id, { role: 'hunter', hunter })
  return { ...c, monsters }
}

const content = withStubs(real)
const t = exactTuning(content.tuning)
const c2 = { ...content, tuning: t }

function hero(spec: Partial<HeroSpec> & { id: string }): Actor {
  return makeHeroActor(t, { level: 10, flatHp: 400, ...spec })
}

const bow = { attack: 20, type: 'shortbow' as const, damageType: 'pierce' as const, weight: 1000, strengthRequirement: 8, ranged: true }

function bossFight(bossId: string, heroes: Actor[], o: { huntersKilled?: string[]; light?: number | null; seed?: number } = {}): FightState {
  const def = c2.monsters.get(bossId)!
  const level = def.levelBand.min
  const monsters = spawnBossFight(c2, t, def, { level, partySize: heroes.length, enemyHpPercent: 100 })
  const floors: Record<string, number> = { 'captain-vexa-marrow': 60, 'barrow-warden': 50, 'sister-naesa': 40, 'hollow-king': 70 }
  return createFight(c2, t, {
    heroes,
    pets: [],
    monsters,
    surprised: null,
    light: 100,
    options: { dungeonId: 'gravehollow-keep', floor: 3, floorLevel: level },
    rng: Rng.fromSeed(o.seed ?? 7),
    arena: { bossActorId: monsters[0]!.id, templateId: null, light: o.light === undefined ? (floors[bossId] ?? null) : o.light, huntersKilled: o.huntersKilled ?? [], partySize: heroes.length, enemyHpPercent: 100 },
  })
}

const ctxOf = (state: FightState): EffectContext => ({ content: c2, t, state, rng: new Rng(state.rng) })
const boss = (s: FightState) => s.actors.find((a) => a.id === s.arena!.bossActorId)!
const arenaEvents = (s: FightState, what: string): FightEvent[] => s.log.filter((e) => e.kind === 'arena' && e.data?.what === what)
const tells = (s: FightState, hint?: string): FightEvent[] => s.log.filter((e) => e.kind === 'tell' && (hint === undefined || e.data?.hint === hint))

/** Advances the round counter as the fight would and runs the arena's round clocks. */
function nextRound(s: FightState): void {
  s.round += 1
  arenaRoundStart(ctxOf(s))
}

function setHpPercent(a: Actor, pct: number): void {
  a.hp = Math.max(1, Math.floor((a.maxHp * pct) / 100))
}

describe('Captain Vexa Marrow, the Wine Hall (07 §2.8)', () => {
  it('sets the light to 60, opens phase 1, stands the barricade with its kegs, and logs both as arena events', () => {
    const s = bossFight('captain-vexa-marrow', [hero({ id: 'w', row: 'front' }), hero({ id: 'r', row: 'back', weapon: bow })])
    expect(s.light).toBe(60)
    const light = arenaEvents(s, 'light')[0]!
    expect(light.data).toMatchObject({ what: 'light', boss: 'captain-vexa-marrow', from: 100, to: 60, band: 'dim', cause: 'arena' })
    expect(arenaEvents(s, 'phase')[0]!.data).toMatchObject({ phase: 1, phases: 2, name: "the Captain's Table" })
    expect(s.arena!.barricade).toBe(true)
    expect(s.arena!.props.filter((p) => p.kind === 'keg')).toHaveLength(2)
  })

  it('keeps her back row out of a non-reach melee blow while the barricade stands — never for a party that cannot reach past it', () => {
    const w = hero({ id: 'w', row: 'front' })
    const s = bossFight('captain-vexa-marrow', [w, hero({ id: 'r', row: 'back', weapon: bow })])
    for (const a of s.actors) if (a.side === 'enemy' && a.row === 'front') a.gone = true
    arenaAfterTurn(ctxOf(s), w)
    const ctx = ctxOf(s)
    expect(reachableEnemies(ctx, w, false).map((a) => a.id)).not.toContain(boss(s).id)
    expect(reachableEnemies(ctx, s.actors.find((a) => a.id === 'r')!, true).map((a) => a.id)).toContain(boss(s).id)
    // All melee: the barricade binds no one (no lock).
    const solo = bossFight('captain-vexa-marrow', [hero({ id: 'w2', row: 'front' })])
    for (const a of solo.actors) if (a.side === 'enemy' && a.row === 'front') a.gone = true
    arenaAfterTurn(ctxOf(solo), solo.actors[0]!)
    expect(solo.arena!.meleeBlocked).toEqual([])
    expect(reachableEnemies(ctxOf(solo), solo.actors[0]!, false).map((a) => a.id)).toContain(boss(solo).id)
  })

  it('shoots out a lantern every 3rd round (−10) after "Lantern targeted", whose hint shows the first time only', () => {
    const s = bossFight('captain-vexa-marrow', [hero({ id: 'w' })])
    nextRound(s) // 2: the tell
    expect(tells(s, 'Lantern targeted')).toHaveLength(1)
    expect(tells(s, 'Lantern targeted')[0]!.data).toMatchObject({ source: 'arena', ref: 'lantern-targeted', first: true, boss: 'captain-vexa-marrow' })
    nextRound(s) // 3: the shot
    expect(s.light).toBe(50)
    expect(arenaEvents(s, 'light').at(-1)!.data).toMatchObject({ cause: 'lantern', from: 60, to: 50, lanternsOut: 1 })
    nextRound(s)
    nextRound(s) // 5: the tell again, not the first time
    expect(tells(s, 'Lantern targeted').at(-1)!.data?.first).toBe(false)
    nextRound(s)
    expect(s.light).toBe(40)
    expect(s.arena!.stats.lanternsOut).toBe(2)
  })

  it('steps down at 50%: the light set to 40, the Netter at the back, the kick as her opener — telegraphed, landing on her next turn', () => {
    const w = hero({ id: 'w' })
    const s = bossFight('captain-vexa-marrow', [w])
    setHpPercent(boss(s), 49)
    arenaAfterTurn(ctxOf(s), w)
    expect(s.arena!.phase).toBe(2)
    expect(s.light).toBe(40)
    expect(arenaEvents(s, 'recall').at(-1)!.data).toMatchObject({ cause: 'phase', count: 1 })
    expect(s.arena!.flags.opener).toBe('kick-the-barricade')
    // Run the fight: the kick shows its tell first, then lands, and the barricade falls.
    const run = bossFight('captain-vexa-marrow', [hero({ id: 'a', flatHp: 3000 }), hero({ id: 'b', flatHp: 3000, row: 'back', weapon: bow })], { seed: 3 })
    setHpPercent(boss(run), 49)
    arenaAfterTurn(ctxOf(run), run.actors[0]!)
    run.options.autoHeroes = true
    runFightAuto(c2, t, run)
    const tell = run.log.findIndex((e) => e.kind === 'tell' && e.data?.ref === 'kick-the-barricade')
    const kick = run.log.findIndex((e) => e.kind === 'action' && e.data?.attackId === 'kick-the-barricade')
    expect(tell).toBeGreaterThan(-1)
    expect(kick).toBeGreaterThan(tell)
    expect(run.log[tell]!.data?.hint).toBe('Boot raised')
    expect(arenaEvents(run, 'barricade')[0]!.data).toMatchObject({ standing: false })
  })

  it('rallies her fallen crew every 4 rounds of phase 1 ("Crew rallying" the round before), each of them once', () => {
    const w = hero({ id: 'w' })
    const s = bossFight('captain-vexa-marrow', [w, hero({ id: 'w2' }), hero({ id: 'w3' })])
    const crew = s.actors.filter((a) => a.side === 'enemy' && a.id !== boss(s).id)
    for (const a of crew) {
      a.hp = 0
      a.gone = true
    }
    arenaAfterTurn(ctxOf(s), w)
    expect(s.arena!.fallen).toHaveLength(crew.length)
    nextRound(s)
    nextRound(s) // 3: the tell
    expect(tells(s, 'Crew rallying')).toHaveLength(1)
    nextRound(s) // 4: they re-enter
    const rally = arenaEvents(s, 'recall').at(-1)!
    expect(rally.data).toMatchObject({ cause: 'rally', count: crew.length })
    for (const a of s.actors.filter((x) => x.side === 'enemy' && x.id !== boss(s).id && !x.gone)) {
      a.hp = 0
      a.gone = true
    }
    arenaAfterTurn(ctxOf(s), w)
    for (let i = 0; i < 4; i++) nextRound(s)
    expect(arenaEvents(s, 'recall').filter((e) => e.data?.cause === 'rally')).toHaveLength(1)
  })

  it('under 20% stops flipping and attacks twice a turn (06 §3.1)', () => {
    const w = hero({ id: 'w' })
    const s = bossFight('captain-vexa-marrow', [w])
    setHpPercent(boss(s), 15)
    arenaAfterTurn(ctxOf(s), w)
    expect(s.arena!.phase).toBe(2)
    expect(boss(s).monster!.attackIds).not.toContain('coin-flip-2')
    expect(arenaExtraActions(ctxOf(s), boss(s))).toBe(1)
  })

  it('breaks her grin-mask to one heavy Blunt blow and her coin only to a Pierce crit', () => {
    const w = hero({ id: 'w' })
    const s = bossFight('captain-vexa-marrow', [w])
    const v = boss(s)
    s.arena!.hits.push({ attackerId: 'w', dealt: Math.ceil(v.maxHp * 0.07), damageType: 'pierce', crit: false })
    arenaAfterTurn(ctxOf(s), w)
    expect(s.arena!.partsBroken).toEqual([])
    s.arena!.hits.push({ attackerId: 'w', dealt: Math.ceil(v.maxHp * 0.07), damageType: 'blunt', crit: false })
    s.arena!.hits.push({ attackerId: 'w', dealt: Math.ceil(v.maxHp * 0.07), damageType: 'pierce', crit: true })
    arenaAfterTurn(ctxOf(s), w)
    expect(s.arena!.partsBroken).toEqual(['grin-mask', 'coin'])
    expect(arenaEvents(s, 'partBreak').map((e) => e.data?.part)).toEqual(['grin-mask', 'coin'])
    expect(v.monster!.statusImmune).not.toContain('fear')
    expect(v.monster!.attackIds).not.toContain('coin-flip')
  })

  it('spills a keg to three shots and the floor turns slick: a monster that changes rows is Slowed', () => {
    const r = hero({ id: 'r', row: 'back', weapon: bow })
    const w = hero({ id: 'w' })
    const s = bossFight('captain-vexa-marrow', [w, r])
    const ctx = ctxOf(s)
    const kegs = arenaLegalActions(ctx, r).find((a) => a.label.startsWith('Shoot a keg'))!
    expect(kegs.enabled).toBe(true)
    expect(arenaLegalActions(ctx, w).find((a) => a.label.startsWith('Shoot a keg'))!.enabled).toBe(false)
    const id = kegs.command.kind === 'arena' ? kegs.command.propId : ''
    for (let i = 0; i < 3; i++) doArenaAction(ctx, r, id)
    expect(s.arena!.props.find((p) => p.id === id)!.done).toBe(true)
    const v = boss(s)
    v.row = 'front'
    arenaAfterTurn(ctx, v)
    expect(v.statuses.some((x) => x.id === 'slow')).toBe(true)
    expect(arenaEvents(s, 'slick')).toHaveLength(1)
  })
})

describe('the Barrow Warden, the Vigil (07 §2.8)', () => {
  it('keeps his Hound at heel at 60% unless the party killed it this delve', () => {
    const s = bossFight('barrow-warden', [hero({ id: 'w' })])
    const hound = s.actors.find((a) => a.monster?.monsterId === 'wardens-hound')!
    expect(hound).toBeDefined()
    expect(hound.hp).toBeLessThan(hound.maxHp * 0.61)
    expect(arenaEvents(s, 'recall').find((e) => e.data?.cause === 'heel')).toBeDefined()
    const without = bossFight('barrow-warden', [hero({ id: 'w' })], { huntersKilled: ['wardens-hound'] })
    expect(without.actors.some((a) => a.monster?.monsterId === 'wardens-hound')).toBe(false)
  })

  it('puts a candle out each round; the sixth greens his lantern and the secret doors open next round with the Wraiths', () => {
    const s = bossFight('barrow-warden', [hero({ id: 'w' })])
    for (let i = 0; i < 6; i++) nextRound(s)
    expect(s.arena!.candles).toEqual({ lit: 6, of: 12 })
    expect(arenaEvents(s, 'candle').at(-1)!.data).toMatchObject({ out: 6, of: 12 })
    expect(tells(s, 'Lantern greening')).toHaveLength(1)
    expect(s.arena!.doorsOpen).toBe(false)
    nextRound(s)
    expect(s.arena!.doorsOpen).toBe(true)
    expect(arenaEvents(s, 'doors')).toHaveLength(1)
    expect(s.actors.filter((a) => a.monster?.monsterId === 'wraith')).toHaveLength(2)
    // Phase 2 does not bring a second pair.
    setHpPercent(boss(s), 40)
    arenaAfterTurn(ctxOf(s), s.actors[0]!)
    expect(s.actors.filter((a) => a.monster?.monsterId === 'wraith')).toHaveLength(2)
  })

  it('opens the doors with his phase 2 when the candles have not, and the lantern drains the light 20', () => {
    const s = bossFight('barrow-warden', [hero({ id: 'w' })])
    setHpPercent(boss(s), 45)
    arenaAfterTurn(ctxOf(s), s.actors[0]!)
    expect(s.arena!.phase).toBe(2)
    expect(s.light).toBe(30)
    expect(s.arena!.doorsOpen).toBe(true)
    expect(s.actors.filter((a) => a.monster?.monsterId === 'wraith')).toHaveLength(2)
  })

  it('tolls Footmen up only from the live bone piles; Holy or Fire burns a pile out in three', () => {
    const fire = { attack: 20, type: 'staff' as const, damageType: 'fire' as const, weight: 1000, strengthRequirement: 0 }
    const mage = hero({ id: 'm', row: 'back', pool: 'mana', weapon: fire })
    const s = bossFight('barrow-warden', [hero({ id: 'w' }), mage])
    const ctx = ctxOf(s)
    const footmen = () => s.actors.filter((a) => a.monster?.monsterId === 'skeleton-footman' && !a.gone).length
    const before = footmen()
    const toll = boss(s).monster!.attacks.find((a) => a.id === 'toll')!
    arenaAttackResolved(ctx, boss(s), toll)
    expect(footmen()).toBe(before + 2)
    // A Toll tops his raised Footmen up to two; it never floods the Vigil.
    arenaAttackResolved(ctx, boss(s), toll)
    expect(footmen()).toBe(before + 2)
    const raised = () => s.actors.filter((a) => a.monster?.monsterId === 'skeleton-footman' && !a.gone && s.arena!.flags[`group:${a.id}`] === 'call')
    for (const a of raised()) {
      a.hp = 0
      a.gone = true
    }
    const burn = arenaLegalActions(ctx, mage).find((a) => a.label.startsWith('Burn a bone pile'))!
    expect(burn.enabled).toBe(true)
    for (const pile of s.arena!.props.filter((p) => p.kind === 'pile').slice(0, 3)) for (let i = 0; i < 3; i++) doArenaAction(ctx, mage, pile.id)
    expect(s.arena!.props.filter((p) => p.kind === 'pile' && !p.done)).toHaveLength(1)
    arenaAttackResolved(ctx, boss(s), toll)
    expect(footmen()).toBe(before + 1)
    const last = s.arena!.props.find((p) => p.kind === 'pile' && !p.done)!
    for (let i = 0; i < 3; i++) doArenaAction(ctx, mage, last.id)
    for (const a of raised()) {
      a.hp = 0
      a.gone = true
    }
    arenaAttackResolved(ctx, boss(s), toll)
    expect(footmen()).toBe(before)
    expect(arenaEvents(s, 'recall').at(-1)!.data).toMatchObject({ cause: 'call', count: 0 })
    expect(arenaEvents(s, 'pile').filter((e) => e.data?.done === true)).toHaveLength(4)
  })

  it("keeps his Oath: nobody who has not struck him, the striker's attention held by a Mark, a Warden's Taunt honoured", () => {
    const a = hero({ id: 'a' })
    const b = hero({ id: 'b' })
    const s = bossFight('barrow-warden', [a, b])
    const ctx = ctxOf(s)
    const wd = boss(s)
    expect(oathTarget(ctx, wd, [a, b], a)).toBeNull()
    s.arena!.hits.push({ attackerId: 'b', dealt: 5, damageType: 'slash', crit: false })
    arenaAfterTurn(ctx, b)
    expect(s.arena!.struckBy).toEqual(['b'])
    expect(b.statuses.some((x) => x.id === 'mark' && x.sourceId === wd.id)).toBe(true)
    expect(arenaEvents(s, 'oath')[0]!.data).toMatchObject({ holder: 'b' })
    expect(oathTarget(ctx, wd, [a, b], a)?.id).toBe('b')
    applyStatus(c2, t, ctx.rng, wd, { status: 'taunt', duration: 2, sourceId: 'a' })
    expect(oathTarget(ctx, wd, [a, b], b)?.id).toBe('a')
  })

  it('loses Toll with its bell, and with its lantern the light stops dropping and Verdict its Mark', () => {
    const w = hero({ id: 'w' })
    const s = bossFight('barrow-warden', [w])
    const wd = boss(s)
    s.arena!.hits.push({ attackerId: 'w', dealt: Math.ceil(wd.maxHp * 0.09), damageType: 'blunt', crit: false })
    s.arena!.hits.push({ attackerId: 'w', dealt: Math.ceil(wd.maxHp * 0.06), damageType: 'holy', crit: false })
    arenaAfterTurn(ctxOf(s), w)
    expect(s.arena!.partsBroken).toEqual(['bell', 'lantern'])
    expect(wd.monster!.attackIds).not.toContain('toll')
    setHpPercent(wd, 40)
    arenaAfterTurn(ctxOf(s), w)
    expect(s.light).toBe(50)
    expect(wd.monster!.attackIds).not.toContain('toll-2')
    expect(wd.monster!.attacks.find((x) => x.id === 'verdict')!.effects.some((l) => l.kind === 'applyStatus' && l.status === 'mark')).toBe(false)
  })
})

describe('Sister Naesa, the Drowned Chapel (07 §2.8)', () => {
  const strong = (id: string, row: 'front' | 'back' = 'front') => hero({ id, row, attributes: { strength: 14 } })

  it('raises the tide a step every 3 rounds after "Tide rising"; the back row wades at 2', () => {
    const back = strong('b', 'back')
    const s = bossFight('sister-naesa', [strong('f'), back])
    expect(s.light).toBe(40)
    nextRound(s) // 2: the boom
    expect(tells(s, 'Tide rising')).toHaveLength(1)
    nextRound(s) // 3: step 1
    expect(s.arena!.tide!.level).toBe(1)
    expect(arenaEvents(s, 'tide')[0]!.data).toMatchObject({ what: 'tide', boss: 'sister-naesa', from: 0, to: 1, cause: 'rise' })
    for (let i = 0; i < 3; i++) nextRound(s) // 6: step 2
    expect(s.arena!.tide!.level).toBe(2)
    expect(back.statuses.some((x) => x.id === 'slow')).toBe(true)
  })

  it('at step 3 chains a Lightning blow through the water into both rows; at step 4 the Deep Tentacles rise and Grab the front', () => {
    const f1 = strong('f1')
    const f2 = strong('f2')
    const s = bossFight('sister-naesa', [f1, f2, strong('b', 'back')])
    s.arena!.tide!.level = 3
    const ctx = ctxOf(s)
    const enemies = s.actors.filter((a) => a.side === 'enemy' && !a.gone)
    const target = enemies[1]!
    const before = enemies.map((a) => a.hp)
    dealDamage(ctx, f1, target, { amount: 200, damageType: 'lightning', canMiss: false, canCrit: false, isDot: false, isUltimate: false, isSingleTarget: true, isMelee: false, ignoresDefense: false, sourceLabel: 'test' })
    const hurt = enemies.filter((a, i) => a !== target && a.hp < before[i]!)
    expect(hurt.length).toBe(enemies.length - 1)
    nextRound(s)
    nextRound(s)
    for (let i = 0; i < 6 && s.arena!.tide!.level < 4; i++) nextRound(s)
    expect(s.arena!.tide!.level).toBe(4)
    expect(s.actors.filter((a) => a.monster?.monsterId === 'deep-tentacle' && !a.gone)).toHaveLength(3)
    expect([f1, f2].every((h) => h.grabbedBy !== null)).toBe(true)
    expect(arenaEvents(s, 'recall').some((e) => e.data?.cause === 'deep')).toBe(true)
  })

  it('lowers the water a step with the sluice wheel (Strength 12, an Item-weight action)', () => {
    const weak = hero({ id: 'weak', attributes: { strength: 8 } })
    const s = bossFight('sister-naesa', [strong('f'), weak])
    s.arena!.tide!.level = 3
    const ctx = ctxOf(s)
    const wheel = (h: Actor) => arenaLegalActions(ctx, h).find((a) => a.label.startsWith('Turn the sluice wheel'))!
    expect(wheel(weak).enabled).toBe(false)
    expect(wheel(weak).reason).toBe('needs strength 12')
    const f = s.actors.find((a) => a.id === 'f')!
    expect(wheel(f).enabled).toBe(true)
    doArenaAction(ctx, f, 'sluice')
    expect(s.arena!.tide!.level).toBe(2)
    expect(arenaEvents(s, 'tide').at(-1)!.data).toMatchObject({ from: 3, to: 2, cause: 'sluice' })
    expect(s.arena!.stats.sluiceTurns).toBe(1)
  })

  it('walks into the water at 50%: Large, the front row, the tide jumps to 3; under 20% it rises every 2 rounds', () => {
    const s = bossFight('sister-naesa', [strong('f')])
    const n = boss(s)
    setHpPercent(n, 45)
    arenaAfterTurn(ctxOf(s), n)
    expect(s.arena!.phase).toBe(2)
    expect(n.row).toBe('front')
    expect(n.monster!.size).toBe('large')
    expect(s.arena!.tide!.level).toBe(3)
    expect(n.hooks.some((h) => h.customId === 'silence-aura')).toBe(true)
    // Under 20% the clock quickens: once the water climbs, the next step is 2 rounds away, not 3.
    setHpPercent(n, 15)
    for (let i = 0; i < 4 && s.arena!.tide!.level < 4; i++) nextRound(s)
    expect(s.arena!.tide!.level).toBe(4)
    expect(s.arena!.tide!.nextRound! - s.round).toBe(2)
  })

  it('brings her fallen adds back once, 4 rounds after they fall', () => {
    const s = bossFight('sister-naesa', [strong('f')])
    const acolyte = s.actors.find((a) => a.monster?.monsterId === 'tidebound-acolyte')!
    acolyte.hp = 0
    acolyte.gone = true
    arenaAfterTurn(ctxOf(s), acolyte)
    for (let i = 0; i < 3; i++) nextRound(s)
    expect(arenaEvents(s, 'recall').filter((e) => e.data?.cause === 'return')).toHaveLength(0)
    nextRound(s)
    expect(arenaEvents(s, 'recall').filter((e) => e.data?.cause === 'return')).toHaveLength(1)
  })

  it("Tidal Call raises a half-HP tentacle that Grabs the weakest arm, unless that hero guards", () => {
    const weak = hero({ id: 'weak', attributes: { strength: 6 } })
    const s = bossFight('sister-naesa', [strong('f'), weak])
    const call = boss(s).monster!.attacks.find((a) => a.id === 'tidal-call')!
    arenaAttackResolved(ctxOf(s), boss(s), call)
    const tentacle = s.actors.find((a) => a.monster?.monsterId === 'deep-tentacle')!
    expect(weak.grabbedBy).toBe(tentacle.id)
    const s2 = bossFight('sister-naesa', [strong('f'), hero({ id: 'weak', attributes: { strength: 6 } })])
    const w2 = s2.actors.find((a) => a.id === 'weak')!
    w2.guarding = true
    arenaAttackResolved(ctxOf(s2), boss(s2), call)
    expect(w2.grabbedBy).toBeNull()
  })
})

describe('the Hollow King, the Drowned Throne (07 §2.8)', () => {
  const torchBag = (h: Actor, n = 6) => {
    h.hero!.bag = [{ instanceId: 'torches', itemId: 'torch', quantity: n } as never]
    return h
  }

  it('sits out of melee reach on his throne in phase 1 while the party can reach him', () => {
    const w = hero({ id: 'w' })
    const s = bossFight('hollow-king', [w, hero({ id: 'r', row: 'back', weapon: bow })])
    expect(s.light).toBe(70)
    arenaAfterTurn(ctxOf(s), w)
    expect(s.arena!.meleeBlocked).toContain(boss(s).id)
    expect(reachableEnemies(ctxOf(s), w, false)).not.toContain(boss(s))
  })

  it('relights a brazier with a Torch (+25), once per brazier per phase; the Torch waits when all four are lit', () => {
    const w = torchBag(hero({ id: 'w' }))
    const s = bossFight('hollow-king', [w])
    s.light = 20
    const torch = c2.items.get('torch')!
    for (let i = 0; i < 4; i++) expect(arenaTorch(ctxOf(s), w, torch)).toBe(true)
    expect(s.light).toBe(100)
    expect(arenaEvents(s, 'brazier').map((e) => e.data?.lit)).toEqual([1, 2, 3, 4])
    const item = legalFightActions(c2, t, { ...s, pendingActorId: 'w' }).find((a) => a.command.kind === 'item')!
    expect(item.enabled).toBe(false)
    // The delve's torchValue (07 §6.1: Dread +20, the Candle Pact +15) is a brazier's worth too.
    const candle = bossFight('hollow-king', [torchBag(hero({ id: 'c' }))])
    candle.options.torchValue = 15
    candle.light = 20
    arenaTorch(ctxOf(candle), candle.actors[0]!, torch)
    expect(candle.light).toBe(35)
    setHpPercent(boss(s), 55)
    arenaAfterTurn(ctxOf(s), w)
    expect(s.arena!.phase).toBe(2)
    expect(s.light).toBe(75)
    expect(arenaEvents(s, 'light').at(-1)!.data).toMatchObject({ cause: 'phase', from: 100, to: 75 })
    expect(s.arena!.props.filter((p) => p.kind === 'brazier' && !p.done)).toHaveLength(4)
  })

  it('wakes his guard at 60% (Huge), pulses Silence at the casters every 3 rounds after "Lamps flaring", and re-calls the fallen at 40%', () => {
    const mage = hero({ id: 'm', row: 'back', pool: 'mana' })
    const s = bossFight('hollow-king', [hero({ id: 'w' }), mage])
    const k = boss(s)
    setHpPercent(k, 59)
    arenaAfterTurn(ctxOf(s), k)
    expect(k.monster!.size).toBe('huge')
    const guard = () => s.actors.filter((a) => (a.monster?.monsterId === 'skeleton-footman' || a.monster?.monsterId === 'wraith') && !a.gone)
    const n = guard().length
    expect(n).toBeGreaterThan(0)
    nextRound(s) // 2: the tell
    expect(tells(s, 'Lamps flaring')).toHaveLength(1)
    nextRound(s) // 3: the pulse
    expect(mage.statuses.some((x) => x.id === 'silence')).toBe(true)
    for (const a of guard()) {
      a.hp = 0
      a.gone = true
    }
    setHpPercent(k, 39)
    arenaAfterTurn(ctxOf(s), k)
    expect(guard().length).toBe(n)
    expect(arenaEvents(s, 'recall').at(-1)!.data).toMatchObject({ cause: 'recall' })
  })

  it('pulls the rows on the tide: who swapped on the tell is spared, the front is Slowed and owes his Blade ×1.5, the back Chilled', () => {
    const front = hero({ id: 'f' })
    const back = hero({ id: 'b', row: 'back' })
    const swapper = hero({ id: 's' })
    const s = bossFight('hollow-king', [front, back, swapper])
    nextRound(s) // 2: "Tide pulling"
    expect(tells(s, 'Tide pulling')).toHaveLength(1)
    // The textbook player takes the pull (tuning arena.auto.swapOnPull off); with the switch on it swaps on the tell.
    expect(arenaHeroAuto(ctxOf(s), front)).toBeNull()
    const swapping = { ...ctxOf(s), t: { ...t, arena: { ...t.arena, auto: { ...t.arena.auto, swapOnPull: { ...t.arena.auto.swapOnPull, value: true } } } } }
    expect(arenaHeroAuto(swapping, front)).toEqual({ kind: 'swapRow' })
    arenaNoteSwap(ctxOf(s), swapper)
    nextRound(s) // 3: the pull
    expect(front.statuses.some((x) => x.id === 'slow')).toBe(true)
    expect(back.statuses.some((x) => x.id === 'chill')).toBe(true)
    expect(swapper.statuses.some((x) => x.id === 'slow' || x.id === 'chill')).toBe(false)
    expect(arenaEvents(s, 'pull')[0]!.data).toMatchObject({ slowed: 1, chilled: 1, spared: 1 })
    expect(s.arena!.flags['pulled:f']).toBe(true)
  })

  it('comes in with the tide at 25%: Speed 120, the fourth step, the light snuffed again, the pull every 2 rounds', () => {
    const s = bossFight('hollow-king', [hero({ id: 'w' })])
    const k = boss(s)
    setHpPercent(k, 20)
    arenaAfterTurn(ctxOf(s), k)
    expect(s.arena!.phase).toBe(3)
    expect(k.base.speed).toBe(120)
    expect(s.arena!.tide!.level).toBe(4)
    expect(s.light).toBe(20)
    expect(arenaEvents(s, 'phase').map((e) => e.data?.phase)).toEqual([1, 2, 3])
    // The phase begins mid-round: the 2-round clock shows its tell at once and pulls at the next round.
    expect(tells(s, 'Tide pulling')).toHaveLength(1)
    nextRound(s)
    expect(arenaEvents(s, 'pull')).toHaveLength(1)
    nextRound(s)
    expect(tells(s, 'Tide pulling')).toHaveLength(2)
    nextRound(s)
    expect(arenaEvents(s, 'pull')).toHaveLength(2)
  })

  it('calls the three hunters at phase rounds +2, +4, +6 — never one the party killed this delve — and shows Naesa\'s shade at 10%', () => {
    const s = bossFight('hollow-king', [hero({ id: 'w' })], { huntersKilled: ['vault-leech'] })
    const k = boss(s)
    setHpPercent(k, 20)
    arenaAfterTurn(ctxOf(s), k)
    for (let i = 0; i < 6; i++) nextRound(s)
    const waves = arenaEvents(s, 'hunterReturns')
    expect(waves.map((e) => [e.data?.hunter, e.data?.wave, e.data?.skipped])).toEqual([
      ['old-gnaw', 1, false],
      ['wardens-hound', 2, false],
      ['vault-leech', 3, true],
    ])
    expect(tells(s, 'Hunter returning')).toHaveLength(2)
    expect(s.arena!.stats.huntersReturned).toBe(2)
    setHpPercent(k, 9)
    arenaAfterTurn(ctxOf(s), k)
    const shade = s.actors.find((a) => a.name === "Sister Naesa's shade")!
    expect(shade.maxHp).toBe(1)
  })

  it('in Radiant light his Shadow blows are ×0.75; in the dark his Gaze crits 20 more', () => {
    const w = hero({ id: 'w' })
    const s = bossFight('hollow-king', [w])
    const k = boss(s)
    const h = customHandler('arena-boss')!
    const hook = k.hooks.find((x) => x.customId === 'arena-boss')!
    const hc = (state: FightState) => ({ content: c2, t, state, rng: new Rng(state.rng), holder: k, status: null, line: hook.line, hook, sourceId: null, fx: {} as never })
    s.light = 90
    expect(h.outgoingDamagePercent!(hc(s), w, { amount: 10, damageType: 'shadow', attacker: k, isSingleTarget: true, isDot: false, isUltimate: false, isMelee: true, physical: false })).toBe(-25)
    s.light = 10
    s.log.push({ tick: 0, round: 1, kind: 'action', actorId: k.id, text: 'gaze', data: { attackId: 'hollow-gaze' } })
    expect(h.critRateBonus!(hc(s), w, { amount: 10, damageType: 'shadow', attacker: k, isSingleTarget: true, isDot: false, isUltimate: false, isMelee: true, physical: false })).toBe(20)
  })
})

describe('telegraphed attacks (06 §8.10: none lands on the turn its tell shows)', () => {
  it('a wound-up blow lands on the next turn; a Daze or a Silence in between breaks it off', () => {
    const w = hero({ id: 'w' })
    const s = bossFight('barrow-warden', [w])
    const wd = boss(s)
    const ctx = ctxOf(s)
    const toll = wd.monster!.attacks.find((a) => a.id === 'toll')!
    beginWindup(ctx, wd, toll, null)
    expect(tells(s, 'Bell lifting')[0]!.data).toMatchObject({ source: 'attack', ref: 'toll', first: true })
    expect(takeWindup(ctx, wd)).toMatchObject({ attack: { id: 'toll' } })
    beginWindup(ctx, wd, toll, null)
    applyStatus(c2, t, ctx.rng, wd, { status: 'silence', duration: 1, sourceId: 'w' })
    s.log.push({ tick: 0, round: 1, kind: 'status', targetId: wd.id, text: 'silenced', data: { status: 'silence' } })
    expect(takeWindup(ctx, wd)).toBe('broken')
    expect(s.log.some((e) => e.kind === 'tellBroken')).toBe(true)
    expect(s.arena!.stats.tellsBroken).toBe(1)
  })
})
