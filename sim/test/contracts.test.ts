import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { bandOfFloor, boardClock, boardTurnsOver, contractContribution, contractEligible, contractPayout, delveContractProgress, playerBand, rForBand, syncBoard, type BoardContext, type ContractBoard } from '../src/contracts.ts'
import { chestKeyItemId } from '../src/chests.ts'
import { createDelve, runDelveAuto } from '../src/delve.ts'
import type { DelveOptions, DelveState } from '../src/delve-types.ts'
import { finalBossOf } from '../src/pacts.ts'
import { addHero, boardContext, claimContract, newProfile, settleDelve, startDelve, syncQuestBoard, TownError, type Profile } from '../src/town.ts'
import type { ContractDef } from '../src/types/content.ts'

const content = loadContentDir(path.resolve('content'))
const t = content.tuning
const DUNGEON = 'gravehollow-keep'
const dungeon = content.dungeons.get(DUNGEON)!

function profile(seed = 4): Profile {
  let p = addHero(content, newProfile(seed), { name: 'Orrin', speciesId: 'dwarf', classId: 'warden', eggPetId: 'cellar-hound' }).profile
  p = addHero(content, p, { name: 'Pip', speciesId: 'halfling', classId: 'ranger', eggPetId: 'rat-prince' }).profile
  return p
}

const options = (over: Partial<DelveOptions> = {}): DelveOptions => ({ dungeonId: DUNGEON, floor: 1, seed: 17, difficulty: 'normal', pactIds: [], auto: true, policy: 'textbook', deathRule: 'sheltered', ...over })

/** A delve that never played, with log lines written by hand (what the delve writes: kills, stairs, chest, curio, sell). */
function delveWith(events: { floor: number; kind: string; data?: Record<string, number | string | boolean | null> }[], over: Partial<DelveOptions> = {}, heroes = 1): DelveState {
  const p = profile()
  const s = createDelve(content, options(over), p.heroes.slice(0, heroes))
  for (const e of events) s.log.push({ floor: e.floor, roomId: 'r0', kind: e.kind, text: e.kind, data: e.data })
  s.phase = { kind: 'over', outcome: 'cleared', summary: 'test' }
  return s
}

function contract(id: string): ContractDef {
  const k = content.contracts.get(id)
  if (!k) throw new Error(`no contract ${id}`)
  return k
}

describe('the board clock (07 §7: dailies at 04:00 local, the weekly on Monday)', () => {
  // 2026-11-02 is a Monday; the client hands the sim its local wall clock as UTC milliseconds.
  const at = (iso: string) => Date.parse(`${iso}Z`)
  it('a day turns over at 04:00, a week on Monday at 04:00', () => {
    const before = boardClock(t, at('2026-11-02T03:59:00'))
    const after = boardClock(t, at('2026-11-02T04:00:00'))
    expect(after.day).toBe(before.day + 1)
    expect(after.week).toBe(before.week + 1)
    const tuesday = boardClock(t, at('2026-11-03T04:00:00'))
    expect(tuesday.day).toBe(after.day + 1)
    expect(tuesday.week).toBe(after.week)
    const sunday = boardClock(t, at('2026-11-08T23:00:00'))
    expect(sunday.week).toBe(after.week)
    expect(boardClock(t, at('2026-11-09T04:00:00')).week).toBe(after.week + 1)
  })

  it('says how long until each board turns over', () => {
    const left = boardTurnsOver(t, at('2026-11-02T03:00:00'))
    expect(left.dailyMs).toBe(3_600_000)
    expect(left.weeklyMs).toBe(3_600_000)
    expect(boardTurnsOver(t, at('2026-11-02T05:00:00')).dailyMs).toBe(23 * 3_600_000)
  })
})

describe('the bands (07 §7: templated with the player’s band)', () => {
  it('a new save is band 1; R follows the band', () => {
    expect(playerBand({}, t)).toBe(1)
    expect(bandOfFloor(1, t)).toBe(1)
    expect(bandOfFloor(7, t)).toBe(3)
    expect(rForBand(1, t)).toBe(300)
    expect(rForBand(2, t)).toBe(480)
  })
})

describe('posting the board', () => {
  it('a new save gets three dailies it can do and no weekly it cannot', () => {
    const p = profile()
    const ctx = boardContext(content, p)
    const board = syncBoard(content, null, ctx, { day: 20_000, week: 2_857 })
    expect(board.dailies).toHaveLength(t.contracts.dailies)
    for (const s of board.dailies) {
      const k = contract(s.contractId)
      expect(k.cadence).toBe('daily')
      expect(contractEligible(content, k, ctx)).toBe(true)
      expect(s.band).toBe(1)
      expect(s.goal).toBe(Math.max(1, k.target.count ?? 1))
      expect(s.progress).toBe(0)
    }
    // The Grinning Captain is a Hard kill: no weekly until Hard is open.
    expect(board.weekly).toBeNull()
  })

  it('the same day keeps the board; a new day redraws the dailies; a new week the weekly and the key counts', () => {
    const p = profile()
    const ctx = boardContext(content, p)
    const board = syncBoard(content, null, ctx, { day: 20_000, week: 2_857 })
    expect(syncBoard(content, board, ctx, { day: 20_000, week: 2_857 })).toBe(board)
    const used: ContractBoard = { ...board, keysStandard: 2 }
    const nextDay = syncBoard(content, used, ctx, { day: 20_001, week: 2_857 })
    expect(nextDay.day).toBe(20_001)
    expect(nextDay.keysStandard).toBe(2)
    const nextWeek = syncBoard(content, used, ctx, { day: 20_007, week: 2_858 })
    expect(nextWeek.keysStandard).toBe(0)
    expect(nextWeek.keysWeek).toBe(2_858)
  })

  it('posts the weekly once its preset is open (the final boss dead on Normal)', () => {
    const final = finalBossOf(dungeon)!
    const p = profile()
    const veteran = { ...p, progress: { ...p.progress, bossKills: { ...p.progress.bossKills, [final]: 1, 'captain-vexa-marrow': 1 }, deepest: { [DUNGEON]: 3 } } }
    const board = syncBoard(content, null, boardContext(content, veteran), { day: 20_000, week: 2_857 })
    expect(board.weekly?.contractId).toBe('the-grinning-captain')
    expect(board.weekly?.band).toBe(1)
  })

  it('a zone the player cannot reach keeps its contracts off the board', () => {
    const k = { ...contract('rat-catcher'), target: { ...contract('rat-catcher').target, zoneId: 'the-crypts-of-nowhere' } } as ContractDef
    const ctx: BoardContext = { band: 1, openFloors: () => [1], difficultyOpen: () => false }
    expect(contractEligible(content, k, ctx)).toBe(false)
    expect(contractEligible(content, contract('rat-catcher'), ctx)).toBe(true)
    expect(contractEligible(content, contract('rat-catcher'), { ...ctx, openFloors: () => [] })).toBe(false)
  })
})

describe('what a delve does toward a contract (07 §7)', () => {
  it('Rat-catcher counts the Cellars’ vermin, not the Company’s hounds', () => {
    const s = delveWith([{ floor: 1, kind: 'kills', data: { monsters: 'giant-rat,giant-rat,cellar-hound,plague-rat', fallen: 0 } }, { floor: 2, kind: 'kills', data: { monsters: 'cellar-spider,grinning-cutpurse', fallen: 1 } }])
    expect(contractContribution(content, contract('rat-catcher'), 1, s).add).toBe(4)
  })

  it('Toll Road counts the Grinning Company only in fights where no hero fell', () => {
    const s = delveWith([{ floor: 1, kind: 'kills', data: { monsters: 'grinning-cutpurse,grinning-crossbowman,giant-rat', fallen: 0 } }, { floor: 1, kind: 'kills', data: { monsters: 'grinning-hexer', fallen: 1 } }])
    expect(contractContribution(content, contract('toll-road'), 1, s).add).toBe(2)
  })

  it('Lights On counts stairs reached at light 50 or more on a floor of the band', () => {
    const s = delveWith([{ floor: 1, kind: 'stairs', data: { light: 62 } }, { floor: 2, kind: 'stairs', data: { light: 41 } }])
    expect(contractContribution(content, contract('lights-on'), 1, s).add).toBe(1)
    expect(contractContribution(content, contract('lights-on'), 2, s).add).toBe(0)
  })

  it('Dark Harvest takes the best single floor of chests opened in the dark', () => {
    const s = delveWith([
      { floor: 1, kind: 'chest', data: { light: 20 } },
      { floor: 1, kind: 'chest', data: { light: 80 } },
      { floor: 2, kind: 'chest', data: { light: 10 } },
      { floor: 2, kind: 'chest', data: { light: 0 } },
    ])
    expect(contractContribution(content, contract('dark-harvest'), 1, s)).toEqual({ add: 0, best: 2 })
  })

  it('Pedlar’s Friend counts the parts sold in the delve', () => {
    const s = delveWith([{ floor: 2, kind: 'sell', data: { itemId: 'rawhide', quantity: 12, gold: 24 } }, { floor: 2, kind: 'sell', data: { itemId: 'copper', quantity: 9, gold: 18 } }])
    expect(contractContribution(content, contract('pedlars-friend'), 1, s).best).toBe(21)
  })

  it('Bank Run counts only the gold the delve itself brought home', () => {
    const s = delveWith([], { purseIn: 400 })
    s.gold = 400 + 449
    expect(contractContribution(content, contract('bank-run'), 1, s).best).toBe(0)
    s.gold = 400 + 450
    expect(contractContribution(content, contract('bank-run'), 1, s).best).toBe(1)
    s.phase = { kind: 'over', outcome: 'wiped', summary: 'wiped' }
    expect(contractContribution(content, contract('bank-run'), 1, s).best).toBe(0)
  })

  it('The Hound’s Hunt counts a zone hunter of the dungeon', () => {
    const s = delveWith([{ floor: 1, kind: 'kills', data: { monsters: 'old-gnaw', fallen: 0 } }])
    expect(contractContribution(content, contract('the-hounds-hunt'), 1, s).add).toBe(1)
  })

  it('The Grinning Captain wants Hard or harder and a party of two', () => {
    const kill = [{ floor: 3, kind: 'kills', data: { monsters: 'captain-vexa-marrow,grinning-cutpurse', fallen: 0 } }]
    expect(contractContribution(content, contract('the-grinning-captain'), 1, delveWith(kill, { difficulty: 'normal' }, 2)).add).toBe(0)
    expect(contractContribution(content, contract('the-grinning-captain'), 1, delveWith(kill, { difficulty: 'hard' }, 1)).add).toBe(0)
    expect(contractContribution(content, contract('the-grinning-captain'), 1, delveWith(kill, { difficulty: 'hard' }, 2)).add).toBe(1)
  })

  it('Keeper’s Peace clears a floor of the zone without opening the curio (a Leave does not count)', () => {
    const keeper: ContractDef = { id: 'keepers-peace', name: "Keeper's Peace", description: '', cadence: 'daily', kind: 'clear', target: { dungeonId: DUNGEON, zoneId: dungeon.zones[0]!.id, curioId: 'sealed-cask', condition: 'no-curio-opened' }, reward: { goldR: 0.25, keys: [{ kind: 'standard', amount: 1 }], chestId: null, items: [] }, band: null }
    const s = delveWith([
      { floor: 1, kind: 'curio', data: { curio: 'sealed-cask', choice: 2, outcome: 'nothing' } },
      { floor: 1, kind: 'stairs', data: { light: 70 } },
      { floor: 2, kind: 'curio', data: { curio: 'sealed-cask', choice: 0, outcome: 'loot' } },
      { floor: 2, kind: 'stairs', data: { light: 60 } },
    ])
    expect(contractContribution(content, keeper, 1, s).add).toBe(1)
  })

  it('Tide-turner reads the boss arena rows: Naesa beaten with the tide below step 4', () => {
    const tide: ContractDef = { id: 'tide-turner', name: 'Tide-turner', description: '', cadence: 'weekly', kind: 'kill', target: { monsterId: 'sister-naesa', dungeonId: DUNGEON, count: 1, condition: 'tide-below-step-4' }, reward: { goldR: 1.5, keys: [{ kind: 'grand', amount: 1 }], chestId: null, items: [] }, band: 3 }
    const s = delveWith([])
    const row = { boss: 'sister-naesa', floor: 7, outcome: 'victory' as const, rounds: 9, phase: 2, firstKill: true, lightMin: 30, lightEnd: 40, lanternsOut: 0, candlesOut: 0, doorsOpened: false, tideMax: 3, sluiceTurns: 1, braziersLit: 0, torchesUsed: 0, recalls: 0, huntersReturned: 0, huntersSkipped: 0, pulls: 0, partsBroken: '', tells: 2, tellsBroken: 0 }
    s.stats.bossArenas = [row, { ...row, tideMax: 4 }, { ...row, outcome: 'defeat', tideMax: 1 }]
    expect(contractContribution(content, tide, 3, s).add).toBe(1)
  })

  it('progress adds up, keeps the best single-delve figure, and stops at the goal', () => {
    const board: ContractBoard = {
      day: 1,
      week: 1,
      keysWeek: 1,
      keysStandard: 0,
      keysGrand: 0,
      dailies: [
        { contractId: 'rat-catcher', band: 1, progress: 28, goal: 30, claimed: false },
        { contractId: 'dark-harvest', band: 1, progress: 1, goal: 3, claimed: false },
        { contractId: 'lights-on', band: 1, progress: 0, goal: 1, claimed: true },
      ],
      weekly: null,
    }
    const s = delveWith([
      { floor: 1, kind: 'kills', data: { monsters: 'giant-rat,giant-rat,giant-rat,giant-rat', fallen: 0 } },
      { floor: 1, kind: 'chest', data: { light: 5 } },
      { floor: 1, kind: 'chest', data: { light: 5 } },
      { floor: 1, kind: 'stairs', data: { light: 90 } },
    ])
    const next = delveContractProgress(content, board, s)
    expect(next.dailies.map((d) => d.progress)).toEqual([30, 2, 0])
  })
})

describe('claims (07 §7: gold, keys capped at 3 Standard and 1 Grand a week, items, a chest)', () => {
  function withBoard(p: Profile, board: Partial<ContractBoard>): Profile {
    return { ...p, contracts: { day: 1, week: 1, keysWeek: 1, keysStandard: 0, keysGrand: 0, dailies: [], weekly: null, ...board } }
  }

  it('pays gold at the band it was posted at, a key, and items into the first hero’s bag', () => {
    const p = withBoard(profile(), { dailies: [{ contractId: 'pedlars-friend', band: 2, progress: 20, goal: 20, claimed: false }] })
    const before = p.heroes[0]!.bag.find((b) => b.itemId === 'torch')?.quantity ?? 0
    const r = claimContract(content, p, 0)
    expect(r.result.gold).toBe(Math.round(0.15 * 480))
    expect(r.profile.purse).toBe(p.purse + r.result.gold)
    expect(r.profile.materials[chestKeyItemId(content, 'standard')!]).toBe(1)
    expect(r.profile.heroes[0]!.bag.find((b) => b.itemId === 'torch')?.quantity).toBe(before + 2)
    expect(r.profile.contracts?.dailies[0]?.claimed).toBe(true)
    expect(r.profile.contracts?.keysStandard).toBe(1)
    expect(() => claimContract(content, r.profile, 0)).toThrow(TownError)
  })

  it('refuses an unfinished contract', () => {
    const p = withBoard(profile(), { dailies: [{ contractId: 'rat-catcher', band: 1, progress: 29, goal: 30, claimed: false }] })
    expect(() => claimContract(content, p, 0)).toThrow(/not finished/)
  })

  it('past the week’s cap a claim pays its gold but no key', () => {
    const p = withBoard(profile(), { keysStandard: 3, dailies: [{ contractId: 'rat-catcher', band: 1, progress: 30, goal: 30, claimed: false }] })
    const pay = contractPayout(content, p.contracts!, p.contracts!.dailies[0]!)
    expect(pay.keys.standard).toBe(0)
    expect(pay.capped.standard).toBe(1)
    const r = claimContract(content, p, 0)
    expect(r.profile.materials[chestKeyItemId(content, 'standard')!] ?? 0).toBe(0)
    expect(r.result.gold).toBe(60)
  })

  it('a weekly’s chest is opened for the hero, free', () => {
    const p = withBoard(profile(), { weekly: { contractId: 'the-grinning-captain', band: 1, progress: 1, goal: 1, claimed: false } })
    const r = claimContract(content, p, 'weekly', p.heroes[1]!.id, { materialLadder: 'metal' })
    expect(r.result.chest).not.toBeNull()
    expect(r.result.heroId).toBe(p.heroes[1]!.id)
    expect(r.profile.purse).toBe(p.purse + 300)
    expect(r.profile.materials[chestKeyItemId(content, 'grand')!]).toBe(1)
  })
})

describe('the board in town (sim/src/town.ts)', () => {
  it('syncQuestBoard posts once per day and keeps the profile when nothing turned over', () => {
    const p = profile()
    const a = syncQuestBoard(content, p, { day: 30_000, week: 4_286 })
    expect(a.contracts?.dailies).toHaveLength(3)
    expect(syncQuestBoard(content, a, { day: 30_000, week: 4_286 })).toBe(a)
  })

  it('a delve’s kills reach the board when it comes home', () => {
    let p = profile(8)
    p = { ...p, contracts: { day: 1, week: 1, keysWeek: 1, keysStandard: 0, keysGrand: 0, dailies: [{ contractId: 'rat-catcher', band: 1, progress: 0, goal: 30, claimed: false }, { contractId: 'lights-on', band: 1, progress: 0, goal: 1, claimed: false }], weekly: null } }
    const started = startDelve(content, p, { dungeonId: DUNGEON, floor: 1, auto: true })
    const state = runDelveAuto(content, started.state, 3000)
    const vermin = state.log.filter((e) => e.kind === 'kills').flatMap((e) => String(e.data?.monsters ?? '').split(',')).filter((id) => ['giant-rat', 'plague-rat', 'warren-alpha', 'cellar-spider', 'cellar-weaver', 'broodmother', 'old-gnaw'].includes(id)).length
    const home = settleDelve(content, started.profile, state).profile
    expect(home.contracts?.dailies[0]?.progress).toBe(Math.min(30, vermin))
  })
})
