import { quiverRefill, withQuiver } from './ammo.ts'
import { EMPTY_PITY, chestKeyItemId, chestOnSale, keyOpens, openTownChest, type ChestPityState, type ChestResult, type TomeBagState } from './chests.ts'
import { compareIds, type Content } from './content.ts'
import { boardSlot, contractPayout, delveContractProgress, markClaimed, playerBand, syncBoard, type BoardContext, type ContractBoard, type ContractPayout } from './contracts.ts'
import { codexFromLog, mergeCodex, type CodexRecord } from './codex.ts'
import { createDelve } from './delve.ts'
import type { DelveCommand, DelveOptions, DelveState } from './delve-types.ts'
import { chestBandGrade, chestPriceR, goldFor, rForFloor, sellPrice, skillHallPriceR, type ChestFamily } from './economy.ts'
import { wearBlocker } from './armory.ts'
import { addBattleXp, createHero, loseLevels, type CreateHeroInput } from './hero.ts'
import { canHoldOffHand, canPromote, createItemInstance, plusNUpgrade, promote, repairAllCost, rungMaterial, salvage } from './items.ts'
import { stoneItemFor } from './loot.ts'
import { difficultyOpen, finalBossOf, pactsBlocker } from './pacts.ts'
import { growPetTraitFromFinds } from './pets.ts'
import { Rng, seedFor, type RngState } from './rng.ts'
import { itemValue, readTomeOnHero, tomeReadBlocker, tomeSkill, type TomeReadOutcome } from './tomes.ts'
import type { Equipment, HeroRecord, ItemInstance, KnownSkill, PetInstance } from './types/content.ts'
import { DIFFICULTIES, type ChestSubtype, type DeathRule, type Difficulty, type Grade, type MaterialLadder, type Stance } from './types/enums.ts'
import { heroFromWayfarer, wayfarerPool } from './wayfarers.ts'
import { skillRankFor, skillRankThreshold, tierOpenAt } from './xp.ts'

/**
 * The town between delves (03 §1, §6–§9, §12; 07 §1; 08): the player's profile — the roster of heroes, the party,
 * the purse and the bank, the armory, materials, stabled pets and eggs, chest pity, the tower's progress — and every
 * town action as a pure function `(content, profile, …) → profile` (or a result carrying one). The client keeps the
 * profile in a signal and saves it; the sim never touches storage, clocks or randomness outside \`profile.rng\`.
 *
 * Readings (D-087): the purse is carried into a delve and lost on a wipe with the delve's own gold (03 §12.2); the
 * bank never is. Gear found in a delve lands in the armory, even on a wipe ("you keep every item found").
 *
 * James's direction of 2026-10-27 (D-088–D-091): the save has a death rule (Mortal: the dead stay dead; Sheltered:
 * nobody is lost); the player makes one **chosen hero** at a time and every other party member is a **wayfarer**
 * from the Wayfarer Chest; the dead carried home lie at the Ember Shrine until raised (for gold and levels) or laid to
 * rest; a hero lost for good leaves a **legacy** (a share of their battle XP) and a line on the Memorial.
 */
/** 2: the Nightmare death rule (D-095). 3: every hero has a look (Phase 5). */
export const PROFILE_VERSION = 4

export interface TowerProgress {
  /** The deepest floor reached-and-finished per dungeon (D-083): the Waystone offers the floor below it. */
  deepest: Record<string, number>
  /** Boss kills by monster id. */
  bossKills: Record<string, number>
  /**
   * Boss kills by preset and monster id (07 §6.1: Hard and Dread open per dungeon when its final boss is dead on the
   * preset below; the presets' first-kill extras). Optional; absent in saves from before Phase 7 = none recorded.
   */
  bossKillsByDifficulty?: Partial<Record<Difficulty, Record<string, number>>>
  delves: number
  clears: number
  wipes: number
}

/** A delve in progress, saved as its options, the party's records at the start and the command log (10 §6). */
export interface ActiveDelveRecord {
  options: DelveOptions
  party: HeroRecord[]
  commands: DelveCommand[]
}

export interface DelveSummaryRecord {
  outcome: string
  dungeonId: string
  floorFrom: number
  floorTo: number
  gold: number
  goldLost: number
  items: number
  parts: number
  fights: number
  levelsGained: Record<string, number>
  battleXp: Record<string, number>
  /** Heroes who died and were carried home to the Shrine (Mortal, D-088), by name. */
  died: string[]
  /** Heroes lost for good in a wipe (Mortal, D-088), by name. */
  lost: string[]
  /** Heroes a healer raised in the dungeon (D-089). */
  raises: number
  /** Under Nightmare, the chosen hero died and the save ended (D-095). */
  ended?: boolean
}

/**
 * A Nightmare run that ended (D-095): the line the Hall of Nightmares keeps outside the save. The client stamps the
 * date (the sim never reads the clock).
 */
export interface HallRecord {
  name: string
  speciesId: string
  classId: string
  level: number
  dungeonId: string
  /** The floor they died on. */
  floor: number
  /** The deepest floor the save ever finished in that dungeon. */
  deepest: number
  delves: number
  wayfarers: number
  how: 'fell' | 'wipe'
}

/** A dead hero brought home: they lie at the Ember Shrine until raised or laid to rest (D-089). */
export interface DeadRecord {
  heroId: string
  dungeonId: string
  floor: number
}

/** A lost hero's legacy waiting for an heir (D-090). */
export interface LegacyRecord {
  id: string
  heroId: string
  name: string
  classId: string
  level: number
  /** The battle XP the heir takes. */
  xp: number
  /** The lost hero was the chosen hero: the next chosen hero takes it unless the player gives it to someone else. */
  fromChosen: boolean
}

/** A line on the Shrine's Memorial (D-090). */
export interface MemorialRecord {
  name: string
  speciesId: string
  classId: string
  level: number
  chosen: boolean
  wayfarerId: string | null
  dungeonId: string | null
  floor: number | null
  /** The town's delve count when they were lost. */
  delve: number
  how: 'wipe' | 'laidToRest'
}

export interface Profile {
  saveVersion: number
  /** How death works in this save (D-088, D-095): chosen at New game; Settings may lower it in town (Nightmare → Mortal → Sheltered). */
  deathRule: DeathRule
  heroes: HeroRecord[]
  /** The heroes going into the next delve, in row order (never the dead). */
  partyIds: string[]
  /** The hero made at the selection (D-090); null, or the id of a hero no longer in the roster, when the player may choose a new one. */
  chosenId: string | null
  /** heroId → the wayfarer of the cast that hero is (D-091). */
  wayfarerOf: Record<string, string>
  /** The dead brought home, lying at the Shrine (D-089). */
  dead: DeadRecord[]
  /** Legacies waiting for an heir (D-090). */
  legacies: LegacyRecord[]
  memorial: MemorialRecord[]
  /** Gold carried (at risk in a delve). */
  purse: number
  /** Gold banked (safe). */
  bank: number
  armory: ItemInstance[]
  materials: Record<string, number>
  /** Unhatched eggs from chests (pet id + grade). */
  eggs: { petId: string; grade: Grade }[]
  /** Pets not with a hero. */
  stables: PetInstance[]
  /** Chest pity per family and tier ("gear-standard"). */
  pity: Record<string, ChestPityState>
  tomeBags: Record<string, TomeBagState>
  /** Skill Hall purchases per hero and tier ("<heroId>:<tier>"), for the price ramp (§7.4). */
  skillPurchases: Record<string, number>
  progress: TowerProgress
  /** The town's RNG (chests, new heroes' instance ids); delves fork their own seed from it. */
  rng: RngState
  seedCounter: number
  activeDelve: ActiveDelveRecord | null
  lastDelve: DelveSummaryRecord | null
  /** The Quest Board (07 §7; sim/src/contracts.ts): today's dailies, the week's weekly, progress, claims, the key caps. Optional (Phase 7). */
  contracts?: ContractBoard
  /** The codex (Phase 8, pass B; sim/src/codex.ts): the monsters met and the materials found, folded in at settlement. Optional; absent = none yet. */
  codex?: CodexRecord
  /** The lesson's coach marks (D-038; Phase 8, pass B — the client shows them, the sim never reads this). Optional; absent = none seen. */
  tutorial?: TutorialProgress
  /** The backup reminder (10 §6; Phase 8, pass B — the client counts days by its own clock). Optional; absent = no day counted yet. */
  backup?: BackupReminder
}

/** Which of the lesson's coach marks the player has seen (D-038; Phase 8). Shown once per profile; Settings can replay them. */
export interface TutorialProgress {
  /** Coach mark ids shown and dismissed. */
  seen: string[]
  /** "Skip the lesson": no coach mark shows until a replay. */
  skipped?: boolean
  /** Settings → Replay the tutorial: the next delve that starts on the lesson floor is the lesson again. */
  replay?: boolean
}

/** About every 7 days of play the town offers a backup (10 §6). The client stamps the days; the sim never reads a clock. */
export interface BackupReminder {
  /** Days with play since the last backup or the last reminder put aside. */
  playDays: number
  /** The last local day counted ("2026-10-28"), so a day counts once. */
  lastPlayDay: string | null
  /** When the save was last downloaded or shared (ISO), or null. */
  lastBackupAt: string | null
}

export class TownError extends Error {}

function fail(message: string): never {
  throw new TownError(message)
}

export function newProfile(seed: number, deathRule: DeathRule = 'mortal'): Profile {
  return {
    saveVersion: PROFILE_VERSION,
    deathRule,
    heroes: [],
    partyIds: [],
    chosenId: null,
    wayfarerOf: {},
    dead: [],
    legacies: [],
    memorial: [],
    purse: 0,
    bank: 0,
    armory: [],
    materials: {},
    eggs: [],
    stables: [],
    pity: {},
    tomeBags: {},
    skillPurchases: {},
    progress: { deepest: {}, bossKills: {}, delves: 0, clears: 0, wipes: 0 },
    rng: Rng.fromSeed(seed).state,
    seedCounter: 0,
    activeDelve: null,
    lastDelve: null,
  }
}

function withRng<T>(profile: Profile, f: (rng: Rng) => T): { value: T; rng: RngState } {
  const rng = new Rng(profile.rng)
  const value = f(rng)
  return { value, rng: rng.state }
}

export function heroOf(profile: Profile, heroId: string): HeroRecord {
  return profile.heroes.find((h) => h.id === heroId) ?? fail(`no hero ${heroId}`)
}

function replaceHero(profile: Profile, hero: HeroRecord): Profile {
  return { ...profile, heroes: profile.heroes.map((h) => (h.id === hero.id ? hero : h)) }
}

/** Pay from the purse, then the bank (the town's gold is one pocket to the player; the bank only matters in a delve). */
function pay(profile: Profile, gold: number): Profile {
  if (gold <= 0) return profile
  if (profile.purse + profile.bank < gold) fail(`not enough gold (${gold} needed)`)
  const fromPurse = Math.min(profile.purse, gold)
  return { ...profile, purse: profile.purse - fromPurse, bank: profile.bank - (gold - fromPurse) }
}

export function totalGold(profile: Profile): number {
  return profile.purse + profile.bank
}

/** R at the player's band (03 §8.1): the deepest floor finished anywhere sets the prices. */
export function townR(profile: Profile): number {
  const deepest = Math.max(0, ...Object.values(profile.progress.deepest))
  return rForFloor(Math.max(1, deepest))
}

export function chestBand(profile: Profile): Grade {
  return chestBandGrade(Math.max(0, ...Object.values(profile.progress.deepest))) as Grade
}

/* ---------- the roster, the chosen hero and the party (D-090, D-091) ---------- */

const PARTY_MAX = 4

export function isDead(profile: Profile, heroId: string): boolean {
  return profile.dead.some((d) => d.heroId === heroId)
}

/** The heroes who can delve: the roster minus the dead at the Shrine. */
export function livingHeroes(profile: Profile): HeroRecord[] {
  return profile.heroes.filter((h) => !isDead(profile, h.id))
}

/** The chosen hero while they are in the roster (living or lying at the Shrine), else null. */
export function chosenHero(profile: Profile): HeroRecord | null {
  return profile.chosenId === null ? null : (profile.heroes.find((h) => h.id === profile.chosenId) ?? null)
}

/** The selection opens when the chosen hero is gone (never made, lost in a wipe, or laid to rest) — D-090. */
export function canChooseHero(content: Content, profile: Profile): boolean {
  return chosenHero(profile) === null && profile.heroes.length < content.tuning.coop.rosterMax
}

/** The save's first hero takes the creation egg (03 §2.3); later chosen heroes find pets at the Stables (D-090). */
export function isFirstHero(profile: Profile): boolean {
  return profile.heroes.length === 0 && profile.memorial.length === 0 && profile.dead.length === 0 && profile.progress.delves === 0
}

/** The chosen hero's legacy the next chosen hero takes (the oldest one waiting), or null. */
export function pendingChosenLegacy(profile: Profile): LegacyRecord | null {
  return profile.legacies.find((l) => l.fromChosen) ?? null
}

function joinParty(profile: Profile, heroId: string): Profile {
  return profile.partyIds.length < PARTY_MAX && !profile.partyIds.includes(heroId) ? { ...profile, partyIds: [...profile.partyIds, heroId] } : profile
}

/**
 * The selection (03 §2.3, D-090): a new chosen hero, when there is none. The creation egg only for the save's first
 * hero; a chosen hero's legacy waiting at the Shrine passes to them at once.
 */
export function chooseHero(content: Content, profile: Profile, input: Omit<CreateHeroInput, 'id'>): { profile: Profile; hero: HeroRecord; legacy: LegacyRecord | null } {
  if (chosenHero(profile) !== null) fail('your chosen hero still lives: new party members come from the Wayfarer Chest')
  if (profile.heroes.length >= content.tuning.coop.rosterMax) fail(`the Lantern Inn is full (${content.tuning.coop.rosterMax} heroes)`)
  const first = isFirstHero(profile)
  const id = `hero-${profile.seedCounter + 1}`
  const { value: created, rng } = withRng(profile, (r) => createHero(content, content.tuning, r, { ...input, id, eggPetId: first ? (input.eggPetId ?? null) : null }))
  const legacy = pendingChosenLegacy(profile)
  const hero = legacy ? addBattleXp(content, content.tuning, created, legacy.xp) : created
  let next: Profile = {
    ...profile,
    rng,
    seedCounter: profile.seedCounter + 1,
    heroes: [...profile.heroes, hero],
    chosenId: hero.id,
    legacies: legacy ? profile.legacies.filter((l) => l.id !== legacy.id) : profile.legacies,
  }
  next = joinParty(next, hero.id)
  return { profile: next, hero, legacy }
}

/**
 * Adds a hero without the selection's rule (deep links, the demo, tests and the balance tools): the first becomes the
 * chosen hero, the others companions. The game itself makes heroes only by `chooseHero` and the Wayfarer Chest.
 */
export function addHero(content: Content, profile: Profile, input: Omit<CreateHeroInput, 'id'>): { profile: Profile; hero: HeroRecord } {
  if (profile.heroes.length >= content.tuning.coop.rosterMax) fail(`the Lantern Inn is full (${content.tuning.coop.rosterMax} heroes)`)
  const { value: hero, rng } = withRng(profile, (r) => createHero(content, content.tuning, r, { ...input, id: `hero-${profile.seedCounter + 1}` }))
  let next: Profile = { ...profile, rng, seedCounter: profile.seedCounter + 1, heroes: [...profile.heroes, hero] }
  if (chosenHero(next) === null) next = { ...next, chosenId: hero.id }
  next = joinParty(next, hero.id)
  return { profile: next, hero }
}

export function setParty(profile: Profile, heroIds: readonly string[]): Profile {
  const ids = [...new Set(heroIds)].filter((id) => profile.heroes.some((h) => h.id === id) && !isDead(profile, id)).slice(0, PARTY_MAX)
  if (ids.length === 0) fail('a party needs at least one living hero')
  return { ...profile, partyIds: ids }
}

/** The party in row order; the dead never go. */
export function partyHeroes(profile: Profile): HeroRecord[] {
  return profile.partyIds
    .filter((id) => !isDead(profile, id))
    .map((id) => profile.heroes.find((h) => h.id === id))
    .filter((h): h is HeroRecord => h !== undefined)
}

const DEATH_RULE_RANK: Record<DeathRule, number> = { sheltered: 0, mortal: 1, nightmare: 2 }

/** The rules a save may be lowered to (D-088, D-095): gentler ones only. */
export function lowerRulesFor(rule: DeathRule): DeathRule[] {
  return (['mortal', 'sheltered'] as const).filter((r) => DEATH_RULE_RANK[r] < DEATH_RULE_RANK[rule])
}

/** D-088, D-095: Settings may lower the rule (Nightmare → Mortal → Sheltered), never raise it, and only in town. */
export function lowerDeathRule(profile: Profile, to: DeathRule = 'sheltered'): Profile {
  if (profile.activeDelve) fail('the death rule can only be lowered in town')
  return DEATH_RULE_RANK[to] < DEATH_RULE_RANK[profile.deathRule] ? { ...profile, deathRule: to } : profile
}

/** D-095: under Nightmare the chosen hero leads every delve; the reason the party cannot go, or null. */
export function nightmareBlocker(profile: Profile): string | null {
  if (profile.deathRule !== 'nightmare') return null
  const chosen = profile.chosenId ? profile.heroes.find((h) => h.id === profile.chosenId) : undefined
  if (!chosen) return 'Under Nightmare your chosen hero leads every delve'
  return profile.partyIds.includes(chosen.id) ? null : `Under Nightmare ${chosen.name} leads every delve: add them to the party`
}

/* ---------- death, the Ember Shrine and legacies (D-088–D-090) ---------- */

/**
 * A hero leaves the roster for good: their gear goes to the armory and their pet to the Stables (the Lantern Inn's
 * bearers, D-088), their legacy waits for an heir, their name goes on the Memorial, and a wayfarer returns to the
 * Wayfarer Chest's pool (D-090, D-091).
 */
function loseHero(content: Content, profile: Profile, heroId: string, how: MemorialRecord['how'], where: { dungeonId: string; floor: number } | null): Profile {
  const hero = heroOf(profile, heroId)
  const t = content.tuning
  const xp = Math.floor((hero.battleXp * t.death.legacy.percent) / 100)
  const wasChosen = profile.chosenId === heroId
  const legacy: LegacyRecord | null = xp > 0 ? { id: `legacy-${profile.seedCounter + 1}`, heroId, name: hero.name, classId: hero.classId, level: hero.level, xp, fromChosen: wasChosen } : null
  const wayfarerOf = { ...profile.wayfarerOf }
  const wayfarerId = wayfarerOf[heroId] ?? null
  delete wayfarerOf[heroId]
  const gear = t.death.bearersBringGear ? equippedItems(hero) : []
  return {
    ...profile,
    seedCounter: profile.seedCounter + 1,
    heroes: profile.heroes.filter((h) => h.id !== heroId),
    partyIds: profile.partyIds.filter((id) => id !== heroId),
    dead: profile.dead.filter((d) => d.heroId !== heroId),
    chosenId: wasChosen ? null : profile.chosenId,
    wayfarerOf,
    armory: [...profile.armory, ...gear],
    stables: hero.petInstance ? [...profile.stables, hero.petInstance] : profile.stables,
    legacies: legacy ? [...profile.legacies, legacy] : profile.legacies,
    memorial: [
      ...profile.memorial,
      { name: hero.name, speciesId: hero.speciesId, classId: hero.classId, level: hero.level, chosen: wasChosen, wayfarerId, dungeonId: where?.dungeonId ?? null, floor: where?.floor ?? null, delve: profile.progress.delves, how },
    ],
  }
}

/** The Shrine's fee to raise a dead hero (D-089): 0.3 R + 0.05 R per level at the player's band. */
export function shrineFee(content: Content, profile: Profile, heroId: string): number {
  const s = content.tuning.death.shrine
  return goldFor(s.feeR + s.feePerLevelR * heroOf(profile, heroId).level, townR(profile))
}

/** Raise a dead hero at the Ember Shrine (D-089): the fee and two levels; they rejoin the party if there is room. */
export function raiseAtShrine(content: Content, profile: Profile, heroId: string): Profile {
  if (!isDead(profile, heroId)) fail('only the dead are raised')
  const paid = pay(profile, shrineFee(content, profile, heroId))
  const hero = loseLevels(content, content.tuning, heroOf(paid, heroId), content.tuning.death.shrine.levelLoss)
  const next = { ...replaceHero(paid, hero), dead: paid.dead.filter((d) => d.heroId !== heroId) }
  return joinParty(next, heroId)
}

/** Lay a dead hero to rest (D-090): they are gone for good and leave a legacy. */
export function layToRest(content: Content, profile: Profile, heroId: string): Profile {
  const record = profile.dead.find((d) => d.heroId === heroId) ?? fail('only the dead are laid to rest')
  return loseHero(content, profile, heroId, 'laidToRest', { dungeonId: record.dungeonId, floor: record.floor })
}

/** Pass a legacy to a living hero (D-090): the XP lands at once, with any levels it reaches. */
export function passLegacy(content: Content, profile: Profile, legacyId: string, heirId: string): Profile {
  const legacy = profile.legacies.find((l) => l.id === legacyId) ?? fail('no such legacy')
  if (isDead(profile, heirId)) fail('the dead cannot take a legacy')
  const heir = heroOf(profile, heirId)
  return { ...replaceHero(profile, addBattleXp(content, content.tuning, heir, legacy.xp)), legacies: profile.legacies.filter((l) => l.id !== legacyId) }
}

/** The level a new wayfarer arrives at (D-091): the lowest-level living hero's, at least 1. */
export function wayfarerArrivalLevel(profile: Profile): number {
  const levels = livingHeroes(profile).map((h) => h.level)
  return levels.length ? Math.max(1, Math.min(...levels)) : 1
}

/* ---------- the Waystone: delves in and out (D-083) ---------- */

/**
 * The zone Waystones lit for this player (07 §1.1): a zone with `waystone` has its stone in the entry room of its first
 * floor (Gravehollow F1, F4, F7); the first zone's is lit from the start, a later zone's once its previous zone's last
 * boss has died for this player (its kill counted, or the floor before the zone finished). The "column of lamps".
 */
export function litWaystones(content: Content, profile: Profile, dungeonId: string): number[] {
  const dungeon = content.dungeons.get(dungeonId) ?? fail(`no dungeon ${dungeonId}`)
  const deepest = profile.progress.deepest[dungeonId] ?? 0
  const zones = [...dungeon.zones].sort((a, b) => a.floors.from - b.floors.from)
  const out: number[] = []
  zones.forEach((z, i) => {
    if (!z.waystone) return
    const prev = zones[i - 1]
    const prevBoss = prev?.bossIds[prev.bossIds.length - 1]
    const lit = !prev || deepest >= z.floors.from - 1 || (prevBoss !== undefined && (profile.progress.bossKills[prevBoss] ?? 0) > 0)
    if (lit) out.push(z.floors.from)
  })
  return out
}

/**
 * The floors the Waystone offers in a dungeon (D-083, 07 §1.1; C1, Phase 7): the floor memory — its first floor and
 * every floor below one already finished, as built — and every lit zone Waystone (`litWaystones`). A zone whose
 * `waystone` is false is reached by the memory alone. Sorted, no repeats.
 */
export function waystoneFloors(content: Content, profile: Profile, dungeonId: string): number[] {
  const dungeon = content.dungeons.get(dungeonId) ?? fail(`no dungeon ${dungeonId}`)
  const first = Math.min(...dungeon.floors.map((f) => f.floor))
  const last = Math.max(...dungeon.floors.map((f) => f.floor))
  const deepest = profile.progress.deepest[dungeonId] ?? 0
  const out = new Set<number>()
  for (let f = first; f <= Math.min(last, Math.max(first, deepest + 1)); f++) out.add(f)
  for (const f of litWaystones(content, profile, dungeonId)) if (f >= first && f <= last) out.add(f)
  return [...out].sort((a, b) => a - b)
}

export interface StartDelveInput {
  dungeonId: string
  floor: number
  difficulty?: DelveOptions['difficulty']
  auto?: boolean
  policy?: DelveOptions['policy']
  /** The first-ever delve: F1 is the fixed 3-room tutorial (D-038). */
  firstDelve?: boolean
  /** The Pacts the party takes at the Waystone (07 §6.2); none by default. */
  pactIds?: readonly string[]
}

/** Starts a delve with the party at full HP and pool; the purse goes in with them (it is at risk). */
export function startDelve(content: Content, profile: Profile, input: StartDelveInput): { profile: Profile; state: DelveState } {
  if (profile.activeDelve) fail('a delve is already in progress')
  const party = partyHeroes(profile)
  if (party.length === 0) fail(profile.heroes.length === 0 ? 'make a hero first' : 'the party needs a living hero')
  const blocked = nightmareBlocker(profile)
  if (blocked) fail(blocked)
  if (!waystoneFloors(content, profile, input.dungeonId).includes(input.floor)) fail(`floor ${input.floor} is not open yet`)
  const dungeon = content.dungeons.get(input.dungeonId)!
  const zone = dungeon.zones.find((z) => input.floor >= z.floors.from && input.floor <= z.floors.to)
  // 07 §6: the preset must be open in this dungeon, and every Pact known and meant for this zone (no hunter Pact
  // where no hunter stalks).
  const difficulty = input.difficulty ?? 'normal'
  const preset = difficultyOpen(dungeon, profile.progress, difficulty)
  if (!preset.open) fail(preset.reason ?? `${difficulty} is not open yet`)
  const pactIds = [...new Set(input.pactIds ?? [])]
  const pactProblem = pactsBlocker(dungeon, input.floor, pactIds)
  if (pactProblem) fail(pactProblem)
  const seed = seedFor('delve', profile.rng.a, profile.rng.b, profile.seedCounter + 1)
  const options: DelveOptions = {
    dungeonId: input.dungeonId,
    floor: input.floor,
    seed,
    difficulty,
    pactIds,
    auto: input.auto ?? false,
    policy: input.policy ?? 'textbook',
    ...(input.firstDelve ? { firstDelve: true } : {}),
    lastFloor: zone?.floors.to ?? Math.max(...dungeon.floors.map((f) => f.floor)),
    deathRule: profile.deathRule,
    ...(profile.deathRule === 'nightmare' && profile.chosenId ? { leaderId: profile.chosenId } : {}),
    // C2: the kills so far, so a boss knows its first death (06 §3, 08 §11).
    bossKills: { ...profile.progress.bossKills },
    // The purse rides in the options so a replay keeps it; the delve starts with it as its gold.
    purseIn: profile.purse,
  }
  const state = createDelve(content, options, party)
  return { profile: { ...profile, purse: 0, seedCounter: profile.seedCounter + 1, activeDelve: { options, party, commands: [] } }, state }
}

/** Records a command the client stepped, so the delve can be replayed after a reload. */
export function recordDelveCommand(profile: Profile, command: DelveCommand): Profile {
  if (!profile.activeDelve) return profile
  return { ...profile, activeDelve: { ...profile.activeDelve, commands: [...profile.activeDelve.commands, command] } }
}

/**
 * Brings a finished delve home (03 §12; D-083): the heroes' records with what grew and wore, the gold (lost on a wipe),
 * the found gear into the armory, materials, the floors finished and the bosses beaten, and the party slots they
 * unlock.
 */
export function settleDelve(content: Content, profile: Profile, state: DelveState): { profile: Profile; summary: DelveSummaryRecord; hall: HallRecord | null } {
  if (state.phase.kind !== 'over') fail('the delve is not over')
  const outcome = state.phase.outcome
  const dungeonId = state.options.dungeonId
  const dungeon = content.dungeons.get(dungeonId)
  const back = new Map(state.heroes.map((h) => [h.record.id, h.record]))
  const before = new Map(profile.heroes.map((h) => [h.id, h]))
  // 03 §9: a Perception trait grows by what the party found — traps revealed, secret doors, monsters caught unawares.
  const finds = state.stats.trapsRevealed + state.stats.secretsFound + state.stats.ambushedMonsters
  // A rule edited during the delve (the fight's rule editor) is the profile's now; the delve ran on the old one.
  const heroes = profile.heroes.map((h) => {
    const r = back.get(h.id)
    return r ? { ...r, aiRule: h.aiRule, ...(r.petInstance ? { petInstance: growPetTraitFromFinds(content, content.tuning, r.petInstance, finds) } : {}) } : h
  })
  const levelsGained: Record<string, number> = {}
  const battleXp: Record<string, number> = {}
  for (const h of heroes) {
    const b = before.get(h.id)
    if (!b || !back.has(h.id)) continue
    levelsGained[h.id] = h.level - b.level
    battleXp[h.id] = h.battleXp - b.battleXp
  }
  const wiped = outcome === 'wiped'
  const gold = wiped ? 0 : Math.max(0, state.gold)
  const materials = { ...profile.materials }
  for (const [id, n] of Object.entries(state.materials)) materials[id] = (materials[id] ?? 0) + n
  const from = state.options.floor ?? 1
  const finished = state.stats.deepestFloorCompleted
  const deepest = { ...profile.progress.deepest }
  // Pact: Iron Oath — a wipe also costs the Waystone progress of this delve (07 §6.2).
  const oathBroken = wiped && state.ruleFlags.includes('wipe-loses-waystone')
  if (finished > 0 && !oathBroken) deepest[dungeonId] = Math.max(deepest[dungeonId] ?? 0, finished)
  const bossKills = { ...profile.progress.bossKills }
  for (const f of dungeon?.floors ?? []) {
    if (f.bossId && f.floor >= from && f.floor <= finished) bossKills[f.bossId] = (bossKills[f.bossId] ?? 0) + 1
  }
  // 07 §6.1: kills by preset — Hard and Dread open on them (difficultyOpen) — and a boss's first kill on Hard or Dread
  // pays the preset's extras: +1 rare part of the boss, and on Dread +1 Divine Shard from a final boss.
  const byDifficulty = { ...(profile.progress.bossKillsByDifficulty ?? {}) }
  const onPreset = { ...(byDifficulty[state.options.difficulty] ?? {}) }
  const finalBoss = dungeon ? finalBossOf(dungeon) : null
  for (const f of dungeon?.floors ?? []) {
    if (!f.bossId || f.floor < from || f.floor > finished) continue
    const firstOnPreset = (onPreset[f.bossId] ?? 0) === 0
    onPreset[f.bossId] = (onPreset[f.bossId] ?? 0) + 1
    if (!firstOnPreset) continue
    const boss = content.monsters.get(f.bossId)
    const rareId = boss?.parts.rare.itemId ?? boss?.parts.rare.materialId
    const rare = state.knobs.bossExtraRareParts ?? 0
    if (rareId && rare > 0) materials[rareId] = (materials[rareId] ?? 0) + rare
    const shards = f.bossId === finalBoss ? (state.knobs.finalBossExtraShards ?? 0) : 0
    if (shards > 0) materials['divine-shard'] = (materials['divine-shard'] ?? 0) + shards
  }
  byDifficulty[state.options.difficulty] = onPreset
  const progress: TowerProgress = {
    deepest,
    bossKills,
    bossKillsByDifficulty: byDifficulty,
    delves: profile.progress.delves + 1,
    clears: profile.progress.clears + (outcome === 'cleared' ? 1 : 0),
    wipes: profile.progress.wipes + (wiped ? 1 : 0),
  }
  const summary: DelveSummaryRecord = {
    outcome,
    dungeonId,
    floorFrom: from,
    floorTo: state.floor.number,
    gold,
    goldLost: wiped ? Math.max(0, state.stats.goldLost) : 0,
    items: state.pile.length,
    parts: state.stats.partsFound,
    fights: state.stats.fights,
    levelsGained,
    battleXp,
    died: [],
    lost: [],
    raises: state.stats.raises,
  }
  let next: Profile = {
    ...profile,
    heroes,
    purse: profile.purse + gold,
    armory: [...profile.armory, ...state.pile],
    materials,
    progress,
    activeDelve: null,
    lastDelve: summary,
    // 07 §7: what the delve did toward the Quest Board's contracts (sim/src/contracts.ts).
    ...(profile.contracts ? { contracts: delveContractProgress(content, profile.contracts, state) } : {}),
    // The codex (Phase 8, pass B): the delve's fights and the materials it brought home (sim/src/codex.ts).
    codex: mergeCodex(profile.codex, codexFromLog(state.log), state.materials),
  }
  // 06 §3, D-037: a boss's first-kill title and +1 Luck reach the heroes who stood at the kill (pass C2).
  next = payBossTownRewards(next, state)
  // D-095: under Nightmare the chosen hero's death ends the save — everything is lost; only the Hall's line remains.
  const leader = state.options.deathRule === 'nightmare' && state.options.leaderId ? state.heroes.find((h) => h.record.id === state.options.leaderId) : undefined
  if (leader?.fallen) {
    const r = leader.record
    const hall: HallRecord = {
      name: r.name,
      speciesId: r.speciesId,
      classId: r.classId,
      level: r.level,
      dungeonId,
      floor: state.floor.number,
      deepest: progress.deepest[dungeonId] ?? 0,
      delves: progress.delves,
      wayfarers: Object.keys(profile.wayfarerOf).length,
      how: wiped && state.heroes.length > 1 ? 'wipe' : 'fell',
    }
    const ended = newProfile(seedFor('ended', profile.rng.a, profile.rng.b, profile.seedCounter + 1)[1], 'nightmare')
    return { profile: { ...ended, lastDelve: { ...summary, ended: true } }, summary: { ...summary, ended: true }, hall }
  }
  // D-088: under Mortal (and Nightmare, for wayfarers) the dead stay dead. Carried home they lie at the Shrine; in a
  // wipe nobody carries them and they are lost for good (their gear and pets come home with the bearers, their legacy waits).
  if (state.options.deathRule === 'mortal' || state.options.deathRule === 'nightmare') {
    const where = { dungeonId, floor: state.floor.number }
    for (const h of state.heroes) {
      if (!h.fallen || !next.heroes.some((x) => x.id === h.record.id)) continue
      if (wiped) {
        next = loseHero(content, next, h.record.id, 'wipe', where)
        summary.lost.push(h.record.name)
      } else {
        next = { ...next, dead: [...next.dead.filter((d) => d.heroId !== h.record.id), { heroId: h.record.id, ...where }], partyIds: next.partyIds.filter((id) => id !== h.record.id) }
        summary.died.push(h.record.name)
      }
    }
    next = { ...next, lastDelve: summary }
  }
  return { profile: next, summary, hall: null }
}

/**
 * The boss lines the delve could not pay (DelveState.bossRewards, 06 §3): each title joins the titles of every hero who
 * came home standing, once; +N Luck (a final boss's first kill, D-037: at most one per final boss, so at most +4 over
 * the four dungeons) adds to their Luck and its creation value. A Waystone line needs nothing: the floor memory opens
 * the floors (D-083).
 */
function payBossTownRewards(profile: Profile, state: DelveState): Profile {
  const rewards = state.bossRewards ?? []
  if (rewards.length === 0) return profile
  const standing = new Set(state.heroes.filter((h) => !h.fallen).map((h) => h.record.id))
  const heroes = profile.heroes.map((h) => {
    if (!standing.has(h.id)) return h
    let next = h
    for (const r of rewards) {
      if (r.kind === 'title' && r.id && !next.titles.includes(r.id)) next = { ...next, titles: [...next.titles, r.id] }
      if (r.kind === 'luck' && r.amount > 0) next = { ...next, attributes: { ...next.attributes, luck: next.attributes.luck + r.amount }, creationValues: { ...next.creationValues, luck: next.creationValues.luck + r.amount } }
    }
    return next
  })
  return { ...profile, heroes }
}

/** Abandons a saved delve that can no longer be replayed (content changed): the party comes home as it went in. */
export function abandonDelve(profile: Profile): Profile {
  if (!profile.activeDelve) return profile
  const party = new Map(profile.activeDelve.party.map((h) => [h.id, h]))
  return { ...profile, heroes: profile.heroes.map((h) => party.get(h.id) ?? h), activeDelve: null }
}

/* ---------- the Bank ---------- */

export function deposit(profile: Profile, amount: number): Profile {
  const a = Math.max(0, Math.min(Math.floor(amount), profile.purse))
  return { ...profile, purse: profile.purse - a, bank: profile.bank + a }
}

export function withdraw(profile: Profile, amount: number): Profile {
  const a = Math.max(0, Math.min(Math.floor(amount), profile.bank))
  return { ...profile, purse: profile.purse + a, bank: profile.bank - a }
}

/* ---------- equipment and the armory ---------- */

const SINGLE_SLOTS = ['mainHand', 'offHand', 'helmet', 'chest', 'legs', 'boots', 'gloves', 'talisman', 'relic'] as const
type SingleSlot = (typeof SINGLE_SLOTS)[number]

export function equippedItems(hero: HeroRecord): ItemInstance[] {
  const e = hero.equipment
  return [...SINGLE_SLOTS.map((s) => e[s]), e.ring[0], e.ring[1]].filter((i): i is ItemInstance => i !== null)
}

/**
 * Equips an armory item on a hero; whatever was in the slot goes back to the armory. Class locks and species
 * restrictions hold (08, 05); `hand: 'off'` puts a dual weapon (a dagger, throwing knives, a Blade's shortsword) in
 * the off hand (03 §6.1 the hand rule), and nothing goes in the off hand beside a two-handed weapon.
 */
export function equip(content: Content, profile: Profile, heroId: string, instanceId: string, ringIndex: 0 | 1 = 0, hand: 'main' | 'off' = 'main'): Profile {
  const hero = heroOf(profile, heroId)
  const inst = profile.armory.find((i) => i.instanceId === instanceId) ?? fail('not in the armory')
  const def = content.items.get(inst.itemId) ?? fail(`unknown item ${inst.itemId}`)
  const blocked = wearBlocker(content, hero, def)
  if (blocked) fail(`${def.name}: ${blocked}`)
  const e: Equipment = hero.equipment
  const toOffHand = def.slot === 'offHand' || (hand === 'off' && def.slot === 'mainHand')
  if (toOffHand) {
    if (!canHoldOffHand(def, hero.classId)) fail(`${def.name} is not held in the off hand`)
    const main = e.mainHand ? content.items.get(e.mainHand.itemId) : undefined
    if (main?.hands === 2) fail(`${main.name} fills both hands`)
    const removedOff = e.offHand
    return { ...replaceHero(profile, { ...hero, equipment: { ...e, offHand: inst } }), armory: [...profile.armory.filter((i) => i !== inst), ...(removedOff ? [removedOff] : [])] }
  }
  let removed: ItemInstance | null
  let equipment: Equipment
  if (def.slot === 'ring') {
    removed = e.ring[ringIndex]
    const ring: [ItemInstance | null, ItemInstance | null] = [e.ring[0], e.ring[1]]
    ring[ringIndex] = inst
    equipment = { ...e, ring }
  } else {
    const slot = def.slot as SingleSlot
    removed = e[slot]
    equipment = { ...e, [slot]: inst }
    // A two-handed weapon frees the off hand (08 §1).
    if (slot === 'mainHand' && def.hands === 2 && e.offHand) {
      const off = e.offHand
      equipment = { ...equipment, offHand: null }
      return { ...replaceHero(profile, { ...hero, equipment }), armory: [...profile.armory.filter((i) => i !== inst), ...(removed ? [removed] : []), off] }
    }
  }
  return { ...replaceHero(profile, { ...hero, equipment }), armory: [...profile.armory.filter((i) => i !== inst), ...(removed ? [removed] : [])] }
}

export function unequip(profile: Profile, heroId: string, slot: SingleSlot | 'ring0' | 'ring1'): Profile {
  const hero = heroOf(profile, heroId)
  const e = hero.equipment
  let removed: ItemInstance | null
  let equipment: Equipment
  if (slot === 'ring0' || slot === 'ring1') {
    const i = slot === 'ring0' ? 0 : 1
    removed = e.ring[i]
    const ring: [ItemInstance | null, ItemInstance | null] = [e.ring[0], e.ring[1]]
    ring[i] = null
    equipment = { ...e, ring }
  } else {
    removed = e[slot]
    equipment = { ...e, [slot]: null }
  }
  if (!removed) return profile
  return { ...replaceHero(profile, { ...hero, equipment }), armory: [...profile.armory, removed] }
}

/* ---------- the Blacksmith (03 §6.4–§6.5, 08 §8–§9) ---------- */

/**
 * "Repair all"'s bill (03 §6.4): the gear's wear, and the quiver (D-099: Repair all refills it — the arrows or bolts the
 * hand draws, back to ammo.quiverMax, at their own price). `gold` is the whole bill; `points` the gear's wear alone.
 */
export function repairAllQuote(content: Content, profile: Profile, heroId: string): { gold: number; points: number; ammo: { itemId: string; missing: number; gold: number } | null } {
  const hero = heroOf(profile, heroId)
  const gear = repairAllCost(content, content.tuning, equippedItems(hero))
  const ammo = quiverRefill(content, content.tuning, hero)
  return { gold: gear.gold + (ammo?.gold ?? 0), points: gear.points, ammo }
}

/** "Repair all" (03 §6.4): every equipped item back to its max durability for 0.5% of value per point. */
export function repairAll(content: Content, profile: Profile, heroId: string): Profile {
  const quote = repairAllQuote(content, profile, heroId)
  const paid = pay(profile, quote.gold)
  const hero = heroOf(paid, heroId)
  const fix = (i: ItemInstance | null): ItemInstance | null => (i ? { ...i, durability: i.maxDurability } : i)
  const e = hero.equipment
  const equipment: Equipment = { ...e, mainHand: fix(e.mainHand), offHand: fix(e.offHand), helmet: fix(e.helmet), chest: fix(e.chest), legs: fix(e.legs), boots: fix(e.boots), gloves: fix(e.gloves), talisman: fix(e.talisman), relic: fix(e.relic), ring: [fix(e.ring[0]), fix(e.ring[1])] }
  const mended = { ...hero, equipment }
  // D-099: the quiver comes back full with the gear.
  return replaceHero(paid, quote.ammo ? withQuiver(content.tuning, mended, quote.ammo.itemId, content.tuning.ammo.quiverMax) : mended)
}

function findEquipped(hero: HeroRecord, instanceId: string): { slot: SingleSlot | 'ring0' | 'ring1'; inst: ItemInstance } | null {
  for (const s of SINGLE_SLOTS) if (hero.equipment[s]?.instanceId === instanceId) return { slot: s, inst: hero.equipment[s]! }
  if (hero.equipment.ring[0]?.instanceId === instanceId) return { slot: 'ring0', inst: hero.equipment.ring[0]! }
  if (hero.equipment.ring[1]?.instanceId === instanceId) return { slot: 'ring1', inst: hero.equipment.ring[1]! }
  return null
}

function putBack(hero: HeroRecord, slot: SingleSlot | 'ring0' | 'ring1', inst: ItemInstance): HeroRecord {
  if (slot === 'ring0' || slot === 'ring1') {
    const ring: [ItemInstance | null, ItemInstance | null] = [hero.equipment.ring[0], hero.equipment.ring[1]]
    ring[slot === 'ring0' ? 0 : 1] = inst
    return { ...hero, equipment: { ...hero.equipment, ring } }
  }
  return { ...hero, equipment: { ...hero.equipment, [slot]: inst } }
}

/** +N one step (03 §6.5, 08 §4): gold and the grade's stones. */
export function upgradePlusN(content: Content, profile: Profile, heroId: string, instanceId: string): Profile {
  const hero = heroOf(profile, heroId)
  const where = findEquipped(hero, instanceId) ?? fail('equip it first')
  const def = content.items.get(where.inst.itemId)!
  const up = plusNUpgrade(content.tuning, def, where.inst) ?? fail('at its +N cap')
  const stone = stoneItemFor(content, content.tuning, def.grade)
  const stoneId = stone?.id ?? 'whetstone'
  if ((profile.materials[stoneId] ?? 0) < up.stones) fail(`needs ${up.stones} × ${stone?.name ?? stoneId}`)
  const paid = pay(profile, up.gold)
  return { ...replaceHero(paid, putBack(heroOf(paid, heroId), where.slot, up.inst)), materials: { ...paid.materials, [stoneId]: (paid.materials[stoneId] ?? 0) - up.stones } }
}

/** Promotion to the next material rung (03 §6.5, 08 §8.2). */
export function promoteItem(content: Content, profile: Profile, heroId: string, instanceId: string): Profile {
  const hero = heroOf(profile, heroId)
  const where = findEquipped(hero, instanceId) ?? fail('equip it first')
  const def = content.items.get(where.inst.itemId)!
  const quote = canPromote(content, content.tuning, def, where.inst, new Map(Object.entries(profile.materials)))
  if (!quote.ok) fail(quote.reason ?? 'cannot promote')
  const paid = pay(profile, quote.gold)
  const materials = { ...paid.materials }
  let left = quote.units
  for (const id of quote.materialIds) {
    const take = Math.min(left, materials[id] ?? 0)
    materials[id] = (materials[id] ?? 0) - take
    left -= take
  }
  const { value: result, rng } = withRng(paid, (r) => promote(content, r, content.tuning, def, where.inst))
  const stone = stoneItemFor(content, content.tuning, def.grade)
  if (stone && result.stoneRefund.stones > 0) materials[stone.id] = (materials[stone.id] ?? 0) + result.stoneRefund.stones
  return { ...replaceHero(paid, putBack(heroOf(paid, heroId), where.slot, result.inst)), materials, rng }
}

/** Salvage an armory item into material units (08 §8.4). */
export function salvageItem(content: Content, profile: Profile, instanceId: string): Profile {
  const inst = profile.armory.find((i) => i.instanceId === instanceId) ?? fail('not in the armory')
  const def = content.items.get(inst.itemId)!
  const r = salvage(content.tuning, def, inst)
  const materials = { ...profile.materials }
  const ladderItem = r.materialLadder ? (rungMaterial(content, r.materialLadder, r.materialRung) ?? undefined) : undefined
  if (ladderItem && r.units > 0) materials[ladderItem.id] = (materials[ladderItem.id] ?? 0) + r.units
  return { ...profile, armory: profile.armory.filter((i) => i !== inst), materials }
}

/** Sell an armory item to the town (Haggling, 03 §7.6). */
export function sellItem(content: Content, profile: Profile, instanceId: string, hagglingRank = 0): Profile {
  const inst = profile.armory.find((i) => i.instanceId === instanceId) ?? fail('not in the armory')
  // A Skill Tome is worth its skill's tier (08 §4; tomes.ts itemValue); every other item its def's value.
  const value = itemValue(content, inst, townR(profile))
  return { ...profile, armory: profile.armory.filter((i) => i !== inst), purse: profile.purse + sellPrice(content.tuning, value, hagglingRank) * Math.max(1, inst.quantity) }
}

/* ---------- the Skill Hall (03 §7.4) ---------- */

export function skillPrice(content: Content, profile: Profile, heroId: string, skillId: string): number {
  const skill = content.skills.get(skillId) ?? fail(`no skill ${skillId}`)
  const tier = Math.min(3, Math.max(1, skill.tier)) as 1 | 2 | 3
  return goldFor(skillHallPriceR(content.tuning, tier, profile.skillPurchases[`${heroId}:${tier}`] ?? 0), townR(profile))
}

/** The skills the Hall sells this hero: its class's Tier I–III actives and passives it does not know, tier open by level. */
export function skillHallOffers(content: Content, profile: Profile, heroId: string): { skillId: string; price: number; locked: string | null }[] {
  const hero = heroOf(profile, heroId)
  const known = new Set(hero.skills.map((s) => s.skillId))
  const open = tierOpenAt(content.tuning, hero.level)
  const out: { skillId: string; price: number; locked: string | null }[] = []
  for (const s of content.skills.values()) {
    if (s.classId !== hero.classId || known.has(s.id) || s.tier > 3 || s.isUltimate || s.monsterTechniqueOf) continue
    const prereq = s.prerequisiteId && !known.has(s.prerequisiteId) ? `needs ${content.skills.get(s.prerequisiteId)?.name ?? s.prerequisiteId}` : null
    const tierLock = s.tier > open ? `Tier ${s.tier} opens at level ${content.tuning.skills.tierOpensAtLevel[String(s.tier) as '1']}` : null
    out.push({ skillId: s.id, price: skillPrice(content, profile, heroId, s.id), locked: tierLock ?? prereq })
  }
  return out.sort((a, b) => (content.skills.get(a.skillId)!.tier - content.skills.get(b.skillId)!.tier) || a.price - b.price || compareIds(a.skillId, b.skillId))
}

export function learnSkill(content: Content, profile: Profile, heroId: string, skillId: string): Profile {
  const offer = skillHallOffers(content, profile, heroId).find((o) => o.skillId === skillId) ?? fail('not on offer')
  if (offer.locked) fail(offer.locked)
  const skill = content.skills.get(skillId)!
  const paid = pay(profile, offer.price)
  const hero = heroOf(paid, heroId)
  const known: KnownSkill = { skillId, rank: 1, xp: 0 } as KnownSkill
  const key = `${heroId}:${Math.min(3, skill.tier)}`
  return { ...replaceHero(paid, { ...hero, skills: [...hero.skills, known] }), skillPurchases: { ...paid.skillPurchases, [key]: (paid.skillPurchases[key] ?? 0) + 1 } }
}

/**
 * A hero reads a Skill Tome from their bag or the armory (03 §7.5, 08 §4; Phase 7): an unknown skill is learned at rank
 * 1, a known one gains a rank's worth of XP (a duplicate is never dead loot). Only a hero of the skill's class reads it;
 * the dead do not read; the Tome is used up.
 */
export function readTome(content: Content, profile: Profile, heroId: string, instanceId: string): { profile: Profile; outcome: TomeReadOutcome } {
  const hero = heroOf(profile, heroId)
  if (isDead(profile, heroId)) fail(`${hero.name} lies at the Shrine`)
  const inBag = hero.bag.find((i) => i.instanceId === instanceId)
  const inst = inBag ?? profile.armory.find((i) => i.instanceId === instanceId) ?? fail('no such Tome')
  const skill = tomeSkill(content, inst) ?? fail('that is not a Skill Tome')
  const blocked = tomeReadBlocker(content, hero, inst)
  if (blocked) fail(blocked)
  const r = readTomeOnHero(content.tuning, hero, skill)
  const useUp = (list: readonly ItemInstance[]): ItemInstance[] =>
    list.flatMap((i) => (i.instanceId !== instanceId ? [i] : i.quantity > 1 ? [{ ...i, quantity: i.quantity - 1 }] : []))
  const reader = inBag ? { ...r.hero, bag: useUp(r.hero.bag) } : r.hero
  const next = replaceHero(profile, reader)
  return { profile: inBag ? next : { ...next, armory: useUp(next.armory) }, outcome: r.outcome }
}

/** Puts a known skill in a loadout slot (actives 0–3, passives 0–1). */
export function setLoadoutSlot(content: Content, profile: Profile, heroId: string, kind: 'active' | 'passive', slot: number, skillId: string | null): Profile {
  const hero = heroOf(profile, heroId)
  if (skillId !== null) {
    if (!hero.skills.some((s) => s.skillId === skillId)) fail('not a known skill')
    const skill = content.skills.get(skillId)!
    if (skill.isUltimate) fail('the Ultimate has its own button')
    if (skill.type !== kind) fail(`${skill.name} is ${skill.type}`)
  }
  const actives = [...hero.loadout.actives] as (string | null)[]
  const passives = [...hero.loadout.passives] as (string | null)[]
  const list = kind === 'active' ? actives : passives
  if (slot < 0 || slot >= list.length) fail('no such slot')
  for (let i = 0; i < list.length; i++) if (list[i] === skillId) list[i] = null
  list[slot] = skillId
  return replaceHero(profile, { ...hero, loadout: { ...hero.loadout, actives: actives as never, passives: passives as never } })
}

export function setAiRule(profile: Profile, heroId: string, rule: string): Profile {
  const hero = heroOf(profile, heroId)
  return replaceHero(profile, { ...hero, aiRule: rule.slice(0, 400) })
}

/* ---------- the Curio Merchant (03 §8.3, 08 §10) ---------- */

export function chestPrice(content: Content, profile: Profile, chestId: string): number {
  const chest = content.chests.get(chestId) ?? fail(`no chest ${chestId}`)
  return goldFor(chestPriceR(content.tuning, chest.kind as ChestFamily, chest.tier === 'grand'), townR(profile))
}

export interface BuyChestOptions {
  /** A Gear Chest's sub-type (03 §8.3: choose it so dupes halve); a random one of the chest's when omitted. */
  subtype?: ChestSubtype
  /** A Material Crate's ladder (metal when omitted). */
  materialLadder?: MaterialLadder
  /** Keep a duplicate item instead of salvaging it (the reveal's Keep). */
  keepDupe?: boolean
  /** The skill a Tome of Practice trains (08 §10); the lowest-ranked loadout skill when omitted. */
  practiceSkillId?: string
}

/** How a chest is paid for: gold at the band's price, or one chest key of the chest's tier (07 §7; pass B, Phase 7). */
export type ChestPayment = 'gold' | 'key'

/** Chest keys held, counted in the materials where reward lines and contracts put them (chests.ts chestKeyItemId). */
export function chestKeysHeld(content: Content, profile: Profile, tier: 'standard' | 'grand'): number {
  const id = chestKeyItemId(content, tier)
  return id === null ? 0 : Math.max(0, profile.materials[id] ?? 0)
}

/** Why the chest cannot be opened with a key now, or null (no key of its tier held, or a kind keys do not open). */
export function chestKeyBlocker(content: Content, profile: Profile, chestId: string): string | null {
  const chest = content.chests.get(chestId)
  if (!chest) return `no chest ${chestId}`
  if (!keyOpens(content.tuning, chest)) return 'a key does not open this chest'
  return chestKeysHeld(content, profile, chest.tier) > 0 ? null : `no ${chest.tier === 'grand' ? 'Grand' : 'Standard'} Key`
}

/** Pays for a chest: its gold price, or one key of its tier from the materials. Refuses a chest not on sale at the band. */
function payForChest(content: Content, profile: Profile, chestId: string, via: ChestPayment): Profile {
  const chest = content.chests.get(chestId) ?? fail(`no chest ${chestId}`)
  if (!chestOnSale(chest, chestBand(profile))) fail(`${chest.name} is sold from band ${chest.minBand ?? 'F'}`)
  if (via === 'gold') return pay(profile, chestPrice(content, profile, chestId))
  const blocked = chestKeyBlocker(content, profile, chestId)
  if (blocked) fail(blocked)
  const keyId = chestKeyItemId(content, chest.tier) as string
  return { ...profile, materials: { ...profile.materials, [keyId]: (profile.materials[keyId] ?? 0) - 1 } }
}

/**
 * Opens a chest with a chest key instead of gold (07 §7: "A Standard Key opens one Standard chest free; a Grand Key
 * one Grand chest"): the same chest, odds and pity as buying it; the key comes off `profile.materials`.
 */
export function openChestWithKey(content: Content, profile: Profile, chestId: string, heroId: string | null, options: BuyChestOptions = {}): { profile: Profile; result: ChestResult } {
  return buyChest(content, profile, chestId, heroId, options, 'key')
}

/** The wayfarers the player has (living or dead at the Shrine): never drawn again while they are (D-091). */
export function ownedWayfarerIds(profile: Profile): Set<string> {
  return new Set(Object.values(profile.wayfarerOf))
}

/**
 * A Wayfarer Chest (D-091): the writ calls a wayfarer not already with you to the Lantern Inn, at the level of your
 * lowest-level living hero; they join the party while it has room.
 */
function buyWayfarerChest(content: Content, profile: Profile, chestId: string, via: ChestPayment = 'gold'): { profile: Profile; result: ChestResult } {
  const chest = content.chests.get(chestId) ?? fail(`no chest ${chestId}`)
  const t = content.tuning
  if (profile.heroes.length >= t.coop.rosterMax) fail(`the Lantern Inn is full (${t.coop.rosterMax} heroes)`)
  const owned = ownedWayfarerIds(profile)
  if (wayfarerPool(content, owned).length === 0) fail('every wayfarer of the cast is already with you')
  const paid = payForChest(content, profile, chestId, via)
  const pityKey = chest.kind
  const { value: outcome, rng } = withRng(paid, (r) => openTownChest(content, t, r, { chest, bandGrade: chestBand(paid), luck: 10, pity: paid.pity[pityKey] ?? EMPTY_PITY, ownedWayfarerIds: owned }))
  let next: Profile = { ...paid, rng, pity: { ...paid.pity, [pityKey]: outcome.pity } }
  const r = outcome.result
  if (r.kind !== 'wayfarer') return { profile: next, result: r }
  const def = content.wayfarers.get(r.wayfarerId) ?? fail(`unknown wayfarer ${r.wayfarerId}`)
  const heroId = `hero-${next.seedCounter + 1}`
  const level = wayfarerArrivalLevel(next)
  const { value: hero, rng: rng2 } = withRng(next, (rr) => heroFromWayfarer(content, t, rr, def, heroId, level))
  next = { ...next, rng: rng2, seedCounter: next.seedCounter + 1, heroes: [...next.heroes, hero], wayfarerOf: { ...next.wayfarerOf, [heroId]: def.id } }
  next = joinParty(next, heroId)
  return { profile: next, result: { ...r, heroId } }
}

/**
 * Buys and opens a chest. A gear, egg or Tome chest is opened for a hero (the hero's class sets the weapon types, the
 * armor family and the Tome bag); a Wayfarer Chest needs none. Pity counters are kept per chest family, so a Grand
 * chest advances the same counters as a Standard (08 §10.1).
 */
export function buyChest(content: Content, profile: Profile, chestId: string, heroId: string | null, options: BuyChestOptions = {}, via: ChestPayment = 'gold'): { profile: Profile; result: ChestResult } {
  const chest = content.chests.get(chestId) ?? fail(`no chest ${chestId}`)
  if (chest.kind === 'wayfarer') return buyWayfarerChest(content, profile, chestId, via)
  const hero = heroOf(profile, heroId ?? fail('choose a hero for this chest'))
  const cls = content.classes.get(hero.classId)
  const paid = payForChest(content, profile, chestId, via)
  const pityKey = chest.kind
  // Dupes (03 §8.3): a gear chest checks item ids; an egg chest checks the pet species you have hatched.
  const owned =
    chest.kind === 'petEgg'
      ? new Set([...paid.heroes.map((h) => h.petInstance?.petId), ...paid.stables.map((p) => p.petId)].filter((id): id is string => id !== undefined))
      : new Set([...paid.armory, ...paid.heroes.flatMap(equippedItems)].map((i) => i.itemId))
  const { value: outcome, rng } = withRng(paid, (r) =>
    openTownChest(content, content.tuning, r, {
      chest,
      bandGrade: chestBand(paid),
      luck: hero.attributes.luck,
      pity: paid.pity[pityKey] ?? EMPTY_PITY,
      weaponTypesAllowed: cls?.weaponTypes,
      classId: hero.classId,
      ownedItemIds: owned,
      tomeBag: paid.tomeBags[hero.classId],
      heroSkillIds: new Set(hero.skills.map((s) => s.skillId)),
      ...(options.subtype ? { subtype: options.subtype } : {}),
      ...(options.materialLadder ? { materialLadder: options.materialLadder } : {}),
      ...(options.keepDupe ? { keepOffered: true } : {}),
    }),
  )
  let next: Profile = { ...paid, rng, pity: { ...paid.pity, [pityKey]: outcome.pity } }
  if (outcome.tomeBag) next = { ...next, tomeBags: { ...next.tomeBags, [hero.classId]: outcome.tomeBag } }
  const r = outcome.result
  switch (r.kind) {
    case 'item':
      next = { ...next, armory: [...next.armory, r.inst] }
      break
    case 'salvage':
      next = salvageUnits(content, next, r.materialLadder, r.materialRung, r.units)
      break
    case 'egg':
      next = { ...next, eggs: [...next.eggs, { petId: r.petId, grade: r.grade }] }
      break
    case 'bondStar': {
      const bump = (p: PetInstance | null) => (p && p.petId === r.petId ? { ...p, bondStars: Math.min(content.tuning.economy.dupes.bondStarMax, p.bondStars + 1) } : p)
      next = { ...next, heroes: next.heroes.map((h) => ({ ...h, petInstance: bump(h.petInstance) })), stables: next.stables.map((p) => bump(p)!) }
      break
    }
    case 'materials':
      next = { ...next, materials: { ...next.materials, [r.materialId]: (next.materials[r.materialId] ?? 0) + r.units }, armory: r.rarePart ? [...next.armory, r.rarePart] : next.armory }
      break
    case 'shard':
      next = { ...next, materials: { ...next.materials, 'divine-shard': (next.materials['divine-shard'] ?? 0) + r.amount } }
      break
    case 'tome':
      // Phase 7 (03 §8.3, 08 §10.2): the Tome is an item — into the armory, read by a hero of its class (readTome).
      next = { ...next, armory: [...next.armory, r.inst] }
      break
    case 'tomeOfPractice': {
      // 08 §10: rank XP equal to one full rank for a chosen skill (the lowest-ranked skill in the loadout when none is chosen).
      const h = heroOf(next, hero.id)
      const t = content.tuning
      const inLoadout = new Set([...h.loadout.actives, ...h.loadout.passives].filter((x): x is string => x !== null))
      const candidates = h.skills.filter((k) => k.rank < t.xp.skill.maxRank)
      const chosen = candidates.find((k) => k.skillId === options.practiceSkillId) ?? [...candidates].sort((a, b) => Number(inLoadout.has(b.skillId)) - Number(inLoadout.has(a.skillId)) || a.rank - b.rank || compareIds(a.skillId, b.skillId))[0]
      if (chosen) {
        const xp = chosen.xp + (skillRankThreshold(t, chosen.rank + 1) - skillRankThreshold(t, chosen.rank))
        const rank = Math.max(chosen.rank, skillRankFor(t, xp))
        next = replaceHero(next, { ...h, skills: h.skills.map((k) => (k.skillId === chosen.skillId ? { ...k, xp, rank } : k)) })
      }
      break
    }
    case 'wayfarer':
    case 'nobodyLeft':
      break
  }
  return { profile: next, result: r }
}

function salvageUnits(content: Content, profile: Profile, ladder: string | null, rung: number, units: number): Profile {
  // The rung's first name, never a regional one (items.ts rungMaterial).
  const item = ladder ? (rungMaterial(content, ladder as MaterialLadder, rung) ?? undefined) : undefined
  if (!item || units <= 0) return profile
  return { ...profile, materials: { ...profile.materials, [item.id]: (profile.materials[item.id] ?? 0) + units } }
}

/* ---------- the Stables (03 §9) ---------- */

/** Hatches an egg for a hero; the hero's current pet goes to the stables. */
export function hatchEgg(content: Content, profile: Profile, eggIndex: number, heroId: string, name?: string): Profile {
  const egg = profile.eggs[eggIndex] ?? fail('no such egg')
  const def = content.pets.get(egg.petId) ?? fail(`unknown pet ${egg.petId}`)
  const hero = heroOf(profile, heroId)
  const pet: PetInstance = { petId: def.id, name: name ?? def.name, grade: egg.grade, level: 1, xp: 0, bondStars: 0, traitRank: 1, stance: def.roleLean, ranchImport: null }
  const stables = hero.petInstance ? [...profile.stables, hero.petInstance] : profile.stables
  return { ...replaceHero(profile, { ...hero, petInstance: pet }), eggs: profile.eggs.filter((_, i) => i !== eggIndex), stables }
}

export function swapPet(profile: Profile, heroId: string, stableIndex: number): Profile {
  const hero = heroOf(profile, heroId)
  const pet = profile.stables[stableIndex] ?? fail('no such pet')
  const stables = profile.stables.filter((_, i) => i !== stableIndex)
  if (hero.petInstance) stables.push(hero.petInstance)
  return { ...replaceHero(profile, { ...hero, petInstance: pet }), stables }
}

export function setPetStance(profile: Profile, heroId: string, stance: Stance): Profile {
  const hero = heroOf(profile, heroId)
  if (!hero.petInstance) fail('no pet')
  return replaceHero(profile, { ...hero, petInstance: { ...hero.petInstance, stance }, loadout: { ...hero.loadout, stance } })
}

/* ---------- the Quest Board (07 §7) ---------- */

/**
 * The dailies a new save would be offered on board day `dayIndex` (deterministic; kept for the tools and old tests —
 * the game posts its board with `syncQuestBoard`).
 */
export function questBoard(content: Content, dayIndex: number): string[] {
  const fresh = newProfile(0)
  return syncBoard(content, null, boardContext(content, fresh), { day: dayIndex, week: Math.floor(dayIndex / 7) }).dailies.map((s) => s.contractId)
}

/** A dungeon the player may enter: the first, and each one whose unlocking boss is dead (07 §1.1). */
function dungeonOpenTo(content: Content, profile: Profile, dungeonId: string): boolean {
  const d = content.dungeons.get(dungeonId)
  return d !== undefined && (d.unlockedBy === null || (profile.progress.bossKills[d.unlockedBy] ?? 0) > 0)
}

/** What the board reads about the player (sim/src/contracts.ts): the band, the floors open, the presets open. */
export function boardContext(content: Content, profile: Profile): BoardContext {
  return {
    band: playerBand(profile.progress.deepest, content.tuning),
    openFloors: (dungeonId) => (dungeonOpenTo(content, profile, dungeonId) ? waystoneFloors(content, profile, dungeonId) : []),
    difficultyOpen: (dungeonId, difficulty) => {
      const d = content.dungeons.get(dungeonId)
      return d !== undefined && difficultyOpen(d, profile.progress, difficulty).open
    },
  }
}

/**
 * Posts or keeps the Quest Board for the client's board day and week (07 §7: three dailies from 04:00, a weekly from
 * Monday; `boardClock` turns the client's clock into them). Unchanged when nothing turned over.
 */
export function syncQuestBoard(content: Content, profile: Profile, clock: { day: number; week: number }): Profile {
  const board = syncBoard(content, profile.contracts, boardContext(content, profile), clock)
  return board === profile.contracts ? profile : { ...profile, contracts: board }
}

export interface ContractClaim extends ContractPayout {
  /** The chest the contract gives, opened for `heroId` (null when it gives none). */
  chest: ChestResult | null
  /** The hero who took the items and opened the chest. */
  heroId: string | null
}

/**
 * Claims a finished contract (07 §7): gold at the band it was posted at into the purse; chest keys into the materials
 * (`standard-chest-key` / `grand-chest-key`; at most 3 Standard and 1 Grand a week — past the cap the gold and the
 * rest still pay); items into the bag of `heroId` (the party's first hero by default); a chest opened at once for
 * that hero, free (its price is paid by the contract).
 */
export function claimContract(content: Content, profile: Profile, which: number | 'weekly', heroId: string | null = null, options: BuyChestOptions = {}): { profile: Profile; result: ContractClaim } {
  const board = profile.contracts ?? fail('the Quest Board is bare')
  const slot = boardSlot(board, which) ?? fail('no such contract')
  if (slot.claimed) fail('already claimed')
  if (slot.progress < slot.goal) fail('not finished yet')
  const payout = contractPayout(content, board, slot)
  // Chest keys are counted in the materials (pass B: chests.ts chestKeyItemId; Grand and Standard Keys open chests free).
  const materials = { ...profile.materials }
  for (const tier of ['standard', 'grand'] as const) {
    const id = chestKeyItemId(content, tier)
    if (id !== null && payout.keys[tier] > 0) materials[id] = (materials[id] ?? 0) + payout.keys[tier]
  }
  let next: Profile = { ...profile, purse: profile.purse + payout.gold, materials, contracts: markClaimed(board, which, payout) }
  const receiver = heroId !== null && next.heroes.some((h) => h.id === heroId) && !isDead(next, heroId) ? heroId : (partyHeroes(next)[0]?.id ?? livingHeroes(next)[0]?.id ?? null)
  for (const line of payout.items) {
    if (!content.items.has(line.itemId) || line.amount <= 0) continue
    const { value: inst, rng } = withRng(next, (r) => createItemInstance(content, r, line.itemId, { quantity: line.amount }))
    next = { ...next, rng }
    const hero = receiver ? heroOf(next, receiver) : null
    if (!hero) {
      next = { ...next, armory: [...next.armory, inst] }
      continue
    }
    const i = hero.bag.findIndex((b) => b.itemId === inst.itemId)
    const bag = i >= 0 ? hero.bag.map((b, j) => (j === i ? { ...b, quantity: b.quantity + inst.quantity } : b)) : [...hero.bag, inst]
    next = replaceHero(next, { ...hero, bag })
  }
  let chest: ChestResult | null = null
  if (payout.chestId) {
    const price = chestPrice(content, next, payout.chestId)
    const opened = buyChest(content, { ...next, purse: next.purse + price }, payout.chestId, receiver, options)
    next = opened.profile
    chest = opened.result
  }
  return { profile: next, result: { ...payout, chest, heroId: receiver } }
}

/** 04 §3: the classes with a ● in a damage column (melee or ranged) — a party's strikers (D-099's "No striker" hint). */
const STRIKER_CLASS_IDS: ReadonlySet<string> = new Set(['blade', 'ranger', 'shade', 'arcanist'])

/** D-099: the Inn's (and Phase 9's lobby's) quiet hint when the party has no striker — a hint, never a block. */
export function noStrikerHint(profile: Profile): string | null {
  const party = partyHeroes(profile)
  if (party.length === 0 || party.some((h) => STRIKER_CLASS_IDS.has(h.classId))) return null
  return 'No striker: fights will be long'
}

/** The Waystone's presets for a dungeon (07 §6.1): each open, or why not ("Defeat the Hollow King on Normal to open Hard"). */
export function difficultyChoices(content: Content, profile: Profile, dungeonId: string): { difficulty: Difficulty; open: boolean; reason: string | null }[] {
  const d = content.dungeons.get(dungeonId)
  if (!d) return []
  const final = finalBossOf(d)
  const name = final ? (content.monsters.get(final)?.name.split(',')[0]?.trim() ?? final) : undefined
  return DIFFICULTIES.map((difficulty) => ({ difficulty, ...difficultyOpen(d, profile.progress, difficulty, name) }))
}

/** A repair-kit-style helper for the Inn: everything the town sells is priced in gold at the player's band. */
export function priceForR(profile: Profile, priceR: number): number {
  return goldFor(priceR, townR(profile))
}

/** Creates an item straight into the armory (debug deep links, the e2e smoke). */
export function grantItem(content: Content, profile: Profile, itemId: string, quantity = 1): Profile {
  const { value: inst, rng } = withRng(profile, (r) => createItemInstance(content, r, itemId, { quantity }))
  return { ...profile, rng, armory: [...profile.armory, inst] }
}
