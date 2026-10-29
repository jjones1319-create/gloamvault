import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import type { Content } from '../src/content.ts'
import { createDelve, legalDelveActions, runDelveAuto, stepDelve } from '../src/delve.ts'
import type { DelveOptions, DelveState } from '../src/delve-types.ts'
import { createHero } from '../src/hero.ts'
import { chestShiftFor, combineKnobs, difficultyOpen, finalBossOf, lockForPact, oathOf, oathTier, pactChoices, pactNeedsHunter, pactsBlocker, PACT_RULE_FLAGS, shiftChestLines, shiftedCentre } from '../src/pacts.ts'
import { Rng } from '../src/rng.ts'
import { addHero, difficultyChoices, newProfile, settleDelve, startDelve, TownError, type Profile } from '../src/town.ts'
import type { DungeonDef, HeroRecord } from '../src/types/content.ts'

const content = loadContentDir(path.resolve('content'))
const t = content.tuning
const DUNGEON = 'gravehollow-keep'
const dungeon = content.dungeons.get(DUNGEON)!

function hero(classId = 'warden', id = 'h1'): HeroRecord {
  return createHero(content, t, Rng.fromSeed(3), { id, name: classId, speciesId: 'human', classId, eggPetId: 'cellar-hound' })
}

const options = (over: Partial<DelveOptions> = {}): DelveOptions => ({ dungeonId: DUNGEON, floor: 1, seed: 17, difficulty: 'normal', pactIds: [], auto: true, policy: 'textbook', ...over })

/** The content with Gravehollow's hunters taken away (a zone like the Drowned Vault: no clock on any floor). */
function hunterless(): Content {
  const d: DungeonDef = { ...dungeon, floors: dungeon.floors.map((f) => ({ ...f, hunterClock: null })) }
  return { ...content, dungeons: new Map([[DUNGEON, d]]) }
}

describe('the twelve Pacts as data (07 §6.2)', () => {
  it('every Pact is in the content with its weight, and every flag is one the sim implements', () => {
    expect(dungeon.pacts.map((p) => p.id)).toEqual(['candle-pact', 'hungry-hunter', 'brittle', 'thin-line', 'loud-boots', 'grinning-odds', 'every-door-locked', 'blind-map', 'long-night', 'pack-hunters', 'iron-oath', 'twin-hunter'])
    expect(dungeon.pacts.map((p) => p.weight)).toEqual([2, 2, 1, 2, 1, 2, 1, 2, 1, 2, 3, 3])
    for (const p of dungeon.pacts) for (const f of p.ruleFlags) expect(PACT_RULE_FLAGS as readonly string[]).toContain(f)
    expect(dungeon.pacts.filter(pactNeedsHunter).map((p) => p.id)).toEqual(['hungry-hunter', 'twin-hunter'])
  })

  it('percent knobs multiply the preset, bonus knobs add, the rest replace', () => {
    expect(combineKnobs(t, dungeon, 'normal', ['pack-hunters']).knobs.enemyCountPercent).toBe(125)
    expect(combineKnobs(t, dungeon, 'hard', ['pack-hunters']).knobs.enemyCountPercent).toBe(138)
    const odds = combineKnobs(t, dungeon, 'dread', ['grinning-odds']).knobs
    expect(odds.eliteAffixBonus).toBe(2)
    expect(odds.eliteRoomWeight).toBe(16)
    const candle = combineKnobs(t, dungeon, 'dread', ['candle-pact']).knobs
    expect([candle.lightStart, candle.torchValue]).toEqual([25, 15])
    expect(combineKnobs(t, dungeon, 'normal', ['hungry-hunter']).knobs.hunterClock).toBe(20)
    expect(combineKnobs(t, dungeon, 'normal', ['brittle']).knobs.wearPercent).toBe(150)
    expect(combineKnobs(t, dungeon, 'normal', ['long-night']).knobs.lightPerNewRoom).toBe(-8)
    expect(combineKnobs(t, dungeon, 'normal', ['loud-boots']).knobs.ambushBonusPercent).toBe(15)
    expect(combineKnobs(t, dungeon, 'normal', ['every-door-locked']).knobs.lockedChestPercent).toBe(30)
  })

  it('Thin Line takes two revives from what the preset leaves, never below 0', () => {
    expect(combineKnobs(t, dungeon, 'normal', ['thin-line']).knobs.revivesPerFloor).toBe(1)
    expect(combineKnobs(t, dungeon, 'hard', ['thin-line']).knobs.revivesPerFloor).toBe(0)
    expect(combineKnobs(t, dungeon, 'dread', ['thin-line']).knobs.revivesPerFloor).toBe(0)
    expect(combineKnobs(t, dungeon, 'normal', ['thin-line']).knobs.revivesPerFloorDelta).toBeUndefined()
  })

  it('rewards and the Oath sum; an unknown or repeated Pact counts once or not at all', () => {
    const c = combineKnobs(t, dungeon, 'normal', ['twin-hunter', 'grinning-odds', 'twin-hunter', 'no-such-pact'])
    expect(c.reward).toEqual({ goldPercent: 25, xpPercent: 35, chestShiftPp: 15 })
    expect(c.oath).toBe(5)
    expect(c.flags).toEqual(['twin-hunter'])
    expect(oathOf(dungeon, ['iron-oath', 'twin-hunter', 'blind-map'])).toBe(8)
  })
})

describe('the Oath and the chest shift (07 §6.1–§6.2)', () => {
  it('Oath 6 shifts 10 pp toward +1 grade, Oath 12 moves the centre one up', () => {
    expect(oathTier(t, 5)).toBeNull()
    expect(oathTier(t, 6)).toMatchObject({ shiftPp: 10, centreShift: 0 })
    expect(oathTier(t, 11)).toMatchObject({ shiftPp: 10, centreShift: 0 })
    expect(oathTier(t, 12)).toMatchObject({ shiftPp: 0, centreShift: 1 })
  })

  it('the preset, the Pacts and the Oath add up', () => {
    const hard = combineKnobs(t, dungeon, 'hard', ['twin-hunter', 'grinning-odds'])
    // Hard 10 + Twin Hunter 10 + Grinning Odds 5; Oath 5 reaches no tier.
    expect(chestShiftFor(t, hard.knobs, hard.reward.chestShiftPp, hard.oath)).toEqual({ shiftPp: 25, centreShift: 0 })
    const dread = combineKnobs(t, dungeon, 'dread', ['iron-oath', 'twin-hunter', 'blind-map', 'pack-hunters', 'candle-pact'])
    expect(dread.oath).toBe(12)
    expect(chestShiftFor(t, dread.knobs, dread.reward.chestShiftPp, dread.oath)).toEqual({ shiftPp: 10, centreShift: 2 })
  })

  it('a shift moves points from a chest’s lowest line to the one above it', () => {
    expect(shiftChestLines([{ offset: 0, weight: 75 }, { offset: 1, weight: 25 }], 10)).toEqual([{ offset: 0, weight: 65 }, { offset: 1, weight: 35 }])
    expect(shiftChestLines([{ offset: 0, weight: 0 }, { offset: 1, weight: 75 }, { offset: 2, weight: 25 }], 10)).toEqual([{ offset: 0, weight: 0 }, { offset: 1, weight: 65 }, { offset: 2, weight: 35 }])
    expect(shiftChestLines([{ offset: 0, weight: 5 }, { offset: 1, weight: 95 }], 30)).toEqual([{ offset: 0, weight: 0 }, { offset: 1, weight: 100 }])
    expect(shiftedCentre('F', 1)).toBe('E')
    expect(shiftedCentre('C', 0)).toBe('C')
  })

  it('Every Door Locked locks about 30% of the chests that would be open, and never opens a locked one', () => {
    const rng = Rng.fromSeed(99)
    let locked = 0
    for (let i = 0; i < 2000; i++) if (lockForPact({ lockedChestPercent: 30 }, rng, { locked: false }).locked) locked++
    expect(locked / 2000).toBeGreaterThan(0.26)
    expect(locked / 2000).toBeLessThan(0.34)
    expect(lockForPact({}, rng, { locked: false }).locked).toBe(false)
    expect(lockForPact({ lockedChestPercent: 30 }, rng, { locked: true }).locked).toBe(true)
  })
})

describe('no hunter, no hunter Pact (07 §6.2)', () => {
  it('the Cellars offer every Pact; a zone without a hunter clock greys out Hungry Hunter and Twin Hunter', () => {
    expect(pactChoices(dungeon, 1).every((c) => c.available)).toBe(true)
    const greyed = pactChoices(hunterless().dungeons.get(DUNGEON)!, 1).filter((c) => !c.available)
    expect(greyed.map((c) => c.pact.id)).toEqual(['hungry-hunter', 'twin-hunter'])
    expect(greyed[0]!.reason).toMatch(/No hunter stalks/)
    expect(pactsBlocker(hunterless().dungeons.get(DUNGEON)!, 1, ['twin-hunter'])).toMatch(/Twin Hunter/)
    expect(pactsBlocker(dungeon, 1, ['no-such-pact'])).toMatch(/no Pact/)
  })
})

describe('Hard and Dread open per dungeon (07 §6.1)', () => {
  const final = finalBossOf(dungeon)!
  it('Normal is open; Hard opens with the final boss dead; Dread with it dead on Hard', () => {
    expect(final).toBe(dungeon.floors.find((f) => f.floor === Math.max(...dungeon.floors.map((x) => x.floor)))!.bossId)
    expect(difficultyOpen(dungeon, { bossKills: {} }, 'normal').open).toBe(true)
    expect(difficultyOpen(dungeon, { bossKills: {} }, 'hard').open).toBe(false)
    expect(difficultyOpen(dungeon, { bossKills: { [final]: 1 } }, 'hard').open).toBe(true)
    expect(difficultyOpen(dungeon, { bossKills: { [final]: 1 } }, 'dread').open).toBe(false)
    expect(difficultyOpen(dungeon, { bossKills: { [final]: 2 }, bossKillsByDifficulty: { hard: { [final]: 1 } } }, 'dread').open).toBe(true)
    expect(difficultyOpen(dungeon, { bossKills: {} }, 'hard', 'the Hollow King').reason).toBe('Defeat the Hollow King on Normal to open Hard')
  })

  it('startDelve refuses a shut preset and a Pact the zone cannot take; it threads the choice and the purse', () => {
    let p: Profile = addHero(content, newProfile(5), { name: 'Orrin', speciesId: 'dwarf', classId: 'warden', eggPetId: 'cellar-hound' }).profile
    p = { ...p, purse: 120 }
    expect(() => startDelve(content, p, { dungeonId: DUNGEON, floor: 1, difficulty: 'hard' })).toThrow(TownError)
    expect(() => startDelve(hunterless(), p, { dungeonId: DUNGEON, floor: 1, pactIds: ['hungry-hunter'] })).toThrow(/Hungry Hunter/)
    const choices = difficultyChoices(content, p, DUNGEON)
    expect(choices.map((c) => [c.difficulty, c.open])).toEqual([['normal', true], ['hard', false], ['dread', false]])
    const r = startDelve(content, p, { dungeonId: DUNGEON, floor: 1, pactIds: ['candle-pact', 'brittle'] })
    expect(r.state.options.pactIds).toEqual(['candle-pact', 'brittle'])
    expect(r.state.options.purseIn).toBe(120)
    expect(r.state.gold).toBe(120)
    expect(r.state.light).toBe(25)
    expect(r.profile.purse).toBe(0)
    expect(r.state.options.bossKills).toEqual({})
    const killed = { ...p, progress: { ...p.progress, bossKills: { [final]: 1 } } }
    expect(startDelve(content, killed, { dungeonId: DUNGEON, floor: 1, difficulty: 'hard' }).state.options.difficulty).toBe('hard')
  })
})

describe('the Pacts in a delve', () => {
  it('Iron Oath: no walking out of the entrance, and a retreat command is refused', () => {
    const s = createDelve(content, options({ pactIds: ['iron-oath'], auto: false }), [hero()])
    expect(legalDelveActions(content, s).some((a) => a.command.kind === 'retreat')).toBe(false)
    expect(() => stepDelve(content, s, { kind: 'retreat' })).toThrow(/Iron Oath/)
    const free = createDelve(content, options({ auto: false }), [hero()])
    expect(legalDelveActions(content, free).some((a) => a.command.kind === 'retreat')).toBe(true)
  })

  it('Blind Map: nothing is ever scouted ahead', () => {
    const scouted = (s: DelveState) => Object.values(s.floor.rooms).filter((r) => r.scouted).length
    let without = 0
    let withPact = 0
    for (const seed of [11, 12, 13, 14, 15]) {
      const a = runDelveAuto(content, createDelve(content, options({ seed, lastFloor: 1 }), [hero('ranger')]), 400)
      const b = runDelveAuto(content, createDelve(content, options({ seed, lastFloor: 1, pactIds: ['blind-map'] }), [hero('ranger')]), 400)
      without += scouted(a)
      withPact += scouted(b)
      expect(b.ruleFlags).toEqual(expect.arrayContaining(['no-minimap', 'no-scouting', 'no-cartography']))
    }
    expect(withPact).toBe(0)
    expect(without).toBeGreaterThan(0)
  })

  it('Long Night: a new room drains 8 instead of 5', () => {
    const drop = (pactIds: string[]) => {
      const s = createDelve(content, options({ auto: false, pactIds }), [hero()])
      const door = legalDelveActions(content, s).find((a) => a.command.kind === 'move' && a.enabled)!
      const before = s.light
      stepDelve(content, s, door.command)
      const room = s.log.filter((e) => e.kind === 'room').at(-1)!
      return { before, after: Number(room.data?.light) }
    }
    const plain = drop([])
    const night = drop(['long-night'])
    expect(plain.before - plain.after).toBe(5)
    expect(night.before - night.after).toBe(8)
  })

  it('Candle Pact starts the delve at light 25; Thin Line leaves one revive on Normal', () => {
    expect(createDelve(content, options({ pactIds: ['candle-pact'] }), [hero()]).light).toBe(25)
    expect(createDelve(content, options({ pactIds: ['thin-line'], deathRule: 'sheltered' }), [hero()]).floor.revivesLeft).toBe(1)
  })

  it('Brittle: the same delve wears the gear half again as fast', () => {
    const wornBy = (pactIds: string[]) => {
      const s = runDelveAuto(content, createDelve(content, options({ seed: 21, lastFloor: 1, pactIds }), [hero()]), 600)
      const eq = s.heroes[0]!.record.equipment
      return [eq.mainHand, eq.chest, eq.helmet, eq.legs, eq.boots, eq.gloves].reduce((sum, i) => sum + (i ? i.maxDurability - i.durability : 0), 0)
    }
    const plain = wornBy([])
    const brittle = wornBy(['brittle'])
    expect(plain).toBeGreaterThan(0)
    expect(brittle).toBeGreaterThan(plain)
  })

  it('Twin Hunter: two hunters enter, from different rooms', () => {
    let seen = 0
    for (const seed of [31, 32, 33, 34, 35, 36]) {
      const s = runDelveAuto(content, createDelve(content, options({ seed, lastFloor: 1, pactIds: ['twin-hunter', 'hungry-hunter'] }), [hero()]), 1500)
      const entries = s.log.filter((e) => e.kind === 'hunter' && e.floor === 1)
      if (entries.length < 2) continue
      seen++
      expect(entries.some((e) => e.data?.twin === true)).toBe(true)
      const first = entries.find((e) => e.data?.twin !== true)!
      const twin = entries.find((e) => e.data?.twin === true)!
      expect(twin.data?.room).not.toBe(first.data?.room)
    }
    expect(seen).toBeGreaterThan(0)
  })
})

describe('settling a Pact delve (07 §6.1–§6.2)', () => {
  function over(state: DelveState, outcome: 'cleared' | 'wiped'): DelveState {
    state.phase = { kind: 'over', outcome, summary: outcome }
    return state
  }

  it('Iron Oath: a wipe keeps none of the delve’s Waystone progress; without it the floor is remembered', () => {
    const p = addHero(content, newProfile(9), { name: 'Orrin', speciesId: 'dwarf', classId: 'warden', eggPetId: 'cellar-hound' }).profile
    const party = [p.heroes[0]!]
    const oath = createDelve(content, options({ pactIds: ['iron-oath'], deathRule: 'sheltered' }), party)
    oath.stats.deepestFloorCompleted = 1
    expect(settleDelve(content, p, over(oath, 'wiped')).profile.progress.deepest[DUNGEON] ?? 0).toBe(0)
    const plain = createDelve(content, options({ deathRule: 'sheltered' }), party)
    plain.stats.deepestFloorCompleted = 1
    expect(settleDelve(content, p, over(plain, 'wiped')).profile.progress.deepest[DUNGEON]).toBe(1)
  })

  it('records boss kills by preset, and a first kill on Hard pays the preset’s rare part', () => {
    const p = addHero(content, newProfile(9), { name: 'Orrin', speciesId: 'dwarf', classId: 'warden', eggPetId: 'cellar-hound' }).profile
    const bossFloor = dungeon.floors.find((f) => f.bossId)!
    const boss = content.monsters.get(bossFloor.bossId!)!
    const rareId = boss.parts.rare.itemId ?? boss.parts.rare.materialId
    const hard = createDelve(content, options({ difficulty: 'hard', floor: bossFloor.floor, deathRule: 'sheltered' }), [p.heroes[0]!])
    hard.stats.deepestFloorCompleted = bossFloor.floor
    const first = settleDelve(content, p, over(hard, 'cleared')).profile
    expect(first.progress.bossKillsByDifficulty?.hard?.[boss.id]).toBe(1)
    expect(first.progress.bossKills[boss.id]).toBe(1)
    if (rareId) expect(first.materials[rareId] ?? 0).toBe((p.materials[rareId] ?? 0) + 1)
    const again = createDelve(content, options({ difficulty: 'hard', floor: bossFloor.floor, deathRule: 'sheltered' }), [first.heroes[0]!])
    again.stats.deepestFloorCompleted = bossFloor.floor
    const second = settleDelve(content, first, over(again, 'cleared')).profile
    expect(second.progress.bossKillsByDifficulty?.hard?.[boss.id]).toBe(2)
    if (rareId) expect(second.materials[rareId]).toBe(first.materials[rareId])
  })
})
