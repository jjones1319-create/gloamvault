/**
 * The bridge (D-139, Phase 10): the one surface the Unity app calls. The sim runs inside the app's JavaScript engine
 * (Jint) as one bundle built from this file (tools/unity/bundle.ts → `GV`); every call takes and returns strings or
 * numbers, and a delve's state stays here behind an integer handle, so a step never copies the whole state across.
 *
 * Calls throw on bad input; the app turns a throw into a readable error (unity/…/Runtime/Sim/JintSim.cs). Fight
 * events and the town's calls join this file in the phases that need them (12 §3: Phases 19 and 23–24).
 */
import { buildContent, contentSummary, type Content, type RawContentFile } from './content.ts'
import { createDelve as createDelveState, delveSummary, hashDelve, legalDelveActions, stepDelve } from './delve.ts'
import type { DelveCommand, DelveOptions, DelveState } from './delve-types.ts'
import type { FightState } from './fight-types.ts'
import { createHero, heroAtLevel } from './hero.ts'
import { classOf, equip, pointsEarned, pointsOf, resetTree, spendPoints, standing, treeOf } from './skills/tree.ts'
import { tierOpenAt } from './xp.ts'
import type { PolicyName } from './policies.ts'
import { lightBand } from './light.ts'
import { Rng } from './rng.ts'
import type { HeroRecord } from './types/content.ts'
import type { Difficulty } from './types/enums.ts'

/** Raised when a call's arguments or the bridge's own rules change shape; the app checks it after loading. */
export const BRIDGE_VERSION = 1

/** One hero of a party by class (the species defaults to human, the name to "<Class> <n>"). */
export interface PartyMember {
  readonly classId: string
  readonly speciesId?: string
  readonly name?: string
  /** Phase 19 (the shots, the tests): skills the hero knows from the start, put in its free active or passive slots. */
  readonly skillIds?: readonly string[]
  /** Phase 19 (the shots): the active slots set to exactly these known skills. */
  readonly onlyActives?: readonly string[]
  /** Phase 19 (the shots, the tests): the hero's gambit line instead of the class default. */
  readonly aiRule?: string
}

/** What `createDelve` takes: a delve's options without the party records, and the party by class. */
export interface DelveRequest {
  readonly dungeonId: string
  readonly zone?: number
  readonly floor?: number
  /** Phase 17 (D-150): play this hand-laid floor (content/dungeons/<d>/floors/<id>.json). */
  readonly floorLayoutId?: string
  /** The last floor of the delve (Phase 17: a walked floor plays alone until the floors after it exist). */
  readonly lastFloor?: number
  readonly seed: number
  readonly difficulty?: Difficulty
  readonly pactIds?: readonly string[]
  readonly auto?: boolean
  readonly policy?: PolicyName
  readonly party: readonly PartyMember[]
}

/** What `step` returns: enough for a caller to know where the delve is without asking for more. */
export interface StepResult {
  readonly phase: DelveState['phase']['kind']
  readonly commands: number
  readonly over: boolean
}

/**
 * A party built the way `npm run sim` builds one: hero i from the seed + i, two free points each in Endurance,
 * Vitality and Strength, the first creation egg. Shared by the CLI and the bridge so both play the same heroes.
 */
/** skillIds extra on a party member (Phase 19): known at rank 1 and put in the free active or passive slots. */
function withExtraSkills(content: Content, hero: HeroRecord, skillIds: readonly string[] | undefined): HeroRecord {
  if (!skillIds?.length) return hero
  let out = hero
  for (const id of skillIds) {
    const def = content.skills.get(id)
    if (!def || def.classId !== hero.classId || out.skills.some((k) => k.skillId === id)) continue
    out = { ...out, skills: [...out.skills, { skillId: id, rank: 1, xp: 0 }] }
    const actives = [...out.loadout.actives] as [string | null, string | null, string | null, string | null]
    const passives = [...out.loadout.passives] as [string | null, string | null]
    if (def.type === 'passive') { const i = passives.indexOf(null); if (i >= 0) passives[i] = id }
    else { const i = actives.indexOf(null); if (i >= 0) actives[i] = id }
    out = { ...out, loadout: { ...out.loadout, actives, passives } }
  }
  return out
}

export function createParty(content: Content, seed: number, spec: readonly PartyMember[]): HeroRecord[] {
  const egg = [...content.pets.values()].find((p) => p.creationChoice)
  return spec.map((m, i) => {
    const cls = content.classes.get(m.classId)
    if (!cls) throw new Error(`no class "${m.classId}" (have: ${[...content.classes.keys()].join(', ')})`)
    const made = createHero(content, content.tuning, Rng.fromSeed(seed + i), {
      id: `h${i + 1}`,
      name: m.name ?? `${cls.name} ${i + 1}`,
      speciesId: m.speciesId ?? 'human',
      classId: cls.id,
      freePoints: { endurance: 2, vitality: 2, strength: 2 },
      eggPetId: egg?.id ?? null,
      ...(m.aiRule ? { aiRule: m.aiRule } : {}),
    })
    const grown = withExtraSkills(content, made, m.skillIds)
    return m.onlyActives ? { ...grown, loadout: { ...grown.loadout, actives: [m.onlyActives[0] ?? null, m.onlyActives[1] ?? null, m.onlyActives[2] ?? null, m.onlyActives[3] ?? null] } } : grown
  })
}

let content: Content | null = null
const delves = new Map<number, DelveState>()
let nextHandle = 1

function loaded(): Content {
  if (!content) throw new Error('the bridge has no content: call init first')
  return content
}

function delveOf(handle: number): DelveState {
  const state = delves.get(handle)
  if (!state) throw new Error(`no delve with handle ${handle}`)
  return state
}

function parse<T>(json: string, what: string): T {
  try {
    return JSON.parse(json) as T
  } catch (e) {
    throw new Error(`${what}: invalid JSON: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/** Builds the content from the raw files (`tools/sim/loadContent.ts` `readContentFiles`, as one JSON array); forgets every delve. */
export function init(contentJson: string): string {
  const files = parse<RawContentFile[]>(contentJson, 'content')
  if (!Array.isArray(files)) throw new Error('content: expected an array of raw content files')
  content = buildContent(files)
  delves.clear()
  return JSON.stringify({ bridge: BRIDGE_VERSION, files: files.length, ...contentSummary(content) })
}

/** Starts a delve from a `DelveRequest`; returns its handle. */
export function createDelve(requestJson: string): number {
  const c = loaded()
  const r = parse<DelveRequest>(requestJson, 'delve request')
  if (!c.dungeons.has(r.dungeonId)) throw new Error(`no dungeon "${r.dungeonId}"`)
  if (!Array.isArray(r.party) || r.party.length === 0) throw new Error('a delve needs a party')
  const options: DelveOptions = {
    dungeonId: r.dungeonId,
    zone: r.floor === undefined ? (r.zone ?? 1) : undefined,
    floor: r.floor,
    ...(r.floorLayoutId ? { floorLayoutId: r.floorLayoutId } : {}),
    ...(r.lastFloor ? { lastFloor: r.lastFloor } : {}),
    seed: r.seed,
    difficulty: r.difficulty ?? 'normal',
    pactIds: r.pactIds ?? [],
    auto: r.auto ?? false,
    policy: r.policy ?? 'textbook',
  }
  const handle = nextHandle++
  delves.set(handle, createDelveState(c, options, createParty(c, r.seed, r.party)))
  return handle
}

/** Plays one command (`{"kind":"auto"}` lets the delve's scripted player choose). */
/** The last fight of each delve, kept after the rules let it go (its last events and the fallen are read after the end). */
const lastFights = new Map<number, FightState>()

export function step(handle: number, commandJson: string): string {
  const state = delveOf(handle)
  stepDelve(loaded(), state, parse<DelveCommand>(commandJson, 'command'))
  if (state.fight) lastFights.set(handle, state.fight)
  const result: StepResult = { phase: state.phase.kind, commands: state.commandLog.length, over: state.phase.kind === 'over' }
  return JSON.stringify(result)
}

/** The commands open now, with their labels and why a closed one is closed. */
export function legal(handle: number): string {
  return JSON.stringify(legalDelveActions(loaded(), delveOf(handle)))
}

/** The desync hash (`hashDelve`): equal hashes, equal futures. */
export function hash(handle: number): string {
  return hashDelve(delveOf(handle))
}

export function summary(handle: number): string {
  return JSON.stringify(delveSummary(delveOf(handle)))
}

/**
 * What the walking client shows between steps (Phase 17): the phase, the light and its band, the floor clock, the
 * hunter, the room, the key, the walk clock, the party's health, the gold, the fights so far, the fight. Flat and
 * never null — Unity's JsonUtility reads it (an absent object would come back as an empty one, a null as a crash).
 */
export function snapshot(handle: number): string {
  const state = delveOf(handle)
  const c = loaded()
  const fl = state.floor
  const walk = fl.walk
  const ph = state.phase
  const enemies = state.fight ? state.fight.actors.filter((a) => a.side === 'enemy').map((a) => ({ id: a.id, name: a.name, level: a.level, hp: a.hp, maxHp: a.maxHp, alive: a.hp > 0 })) : []
  return JSON.stringify({
    phase: ph.kind,
    outcome: ph.kind === 'over' ? ph.outcome : '',
    summary: ph.kind === 'over' ? ph.summary : '',
    resultTitle: ph.kind === 'result' ? ph.title : '',
    resultLines: ph.kind === 'result' ? ph.lines : [],
    curioId: ph.kind === 'curio' ? ph.curioId : '',
    curioName: ph.kind === 'curio' ? (c.dungeons.get(state.options.dungeonId)?.curios.find((x) => x.id === ph.curioId)?.name ?? ph.curioId) : '',
    light: state.light,
    band: lightBand(c.tuning, state.light).id,
    clock: fl.clock,
    hunterEntered: fl.hunter?.entered ?? false,
    hunterRoomId: fl.hunter?.roomId ?? '',
    hunterKilled: fl.hunter?.killed ?? false,
    hunterName: fl.hunter ? (c.monsters.get(fl.hunter.monsterId)?.name ?? fl.hunter.monsterId) : '',
    roomId: fl.currentRoomId,
    hasKey: fl.hasKey,
    monsterLevel: fl.monsterLevel,
    walkSeconds: walk?.seconds ?? 0,
    walkBudget: Math.round(walk?.budget ?? 0),
    walkGrace: walk?.grace ?? 0,
    smokeKind: walk?.smoke?.kind ?? '',
    smokeSecondsLeft: walk?.smoke?.secondsLeft ?? 0,
    randomFights: walk?.randomFights ?? 0,
    gold: state.gold,
    fights: state.stats.fights,
    rooms: state.stats.rooms,
    heroes: state.heroes.map((h) => ({ name: h.record.name, classId: h.record.classId, level: h.record.level, hpPercent: h.hpPercent, poolPercent: h.poolPercent, fallen: h.fallen, downed: h.downed, battleXp: h.record.battleXp })),
    fightOver: state.fight?.over ?? false,
    fightRound: state.fight?.round ?? 0,
    enemies,
    log: state.log.length,
  })
}

/**
 * One room as the rules see it (Phase 17): what waits there — the monsters (the encounter and its first monster, for
 * the figure at the spot), the chests, the curio, the traps the party has spotted, the gold, the rest — so the walked
 * floor can place its things and the prompts. Flat and never null, for JsonUtility.
 */
export function room(handle: number, roomId: string): string {
  const state = delveOf(handle)
  const c = loaded()
  const rs = state.floor.rooms[roomId]
  const g = state.floor.graph.rooms.find((r) => r.id === roomId)
  if (!rs || !g) throw new Error(`no room "${roomId}"`)
  const dungeon = c.dungeons.get(state.options.dungeonId)
  const encounter = rs.encounterId ? c.encounters.get(rs.encounterId) : undefined
  const firstSlot = encounter?.composition[0]
  const curio = rs.curioId ? dungeon?.curios.find((x) => x.id === rs.curioId) : undefined
  // The disarm chance of each spotted trap, from the legal actions (the current room only; the first hero's hand).
  const chances = new Map<number, number>()
  if (roomId === state.floor.currentRoomId && state.phase.kind === 'room') {
    for (const a of legalDelveActions(c, state)) {
      if (a.command.kind !== 'disarm' || a.command.heroIndex !== 0) continue
      chances.set(a.command.trapIndex, Number(/(\d+)%\)\s*$/.exec(a.label)?.[1] ?? 0))
    }
  }
  return JSON.stringify({
    roomId,
    kind: g.kind,
    visited: rs.visited,
    cleared: rs.cleared,
    encounterId: rs.encounterId ?? '',
    encounterName: encounter?.name ?? '',
    monsterId: firstSlot?.monsterId ?? '',
    monsterName: firstSlot ? (c.monsters.get(firstSlot.monsterId)?.name ?? firstSlot.monsterId) : '',
    monsterCount: encounter ? encounter.composition.reduce((n, sl) => n + sl.count, 0) : 0,
    curioId: rs.curioId ?? '',
    curioName: curio?.name ?? '',
    curioUsed: rs.curioUsed,
    restUsed: rs.restUsed,
    keyHere: g.hasKey && !state.floor.hasKey,
    goldPiles: rs.goldPiles.length,
    chests: rs.chests.map((ch, index) => ({ index, size: ch.size, locked: ch.locked, opened: ch.opened })),
    traps: rs.traps.map((tr, index) => ({ index, trapId: tr.trapId, name: dungeon?.traps.find((x) => x.id === tr.trapId)?.name ?? tr.trapId, revealed: tr.revealed, disarmed: tr.disarmed, triggered: tr.triggered, chance: chances.get(index) ?? 0, blocks: tr.blocksDoorTo !== null, blocksTo: tr.blocksDoorTo ?? '' })),
  })
}

/** The commands open now (Phase 17), each with its command pre-serialised: the card's buttons send them back as they are. */
export function actions(handle: number): string {
  const items = legalDelveActions(loaded(), delveOf(handle)).map((a) => ({ kind: a.command.kind, label: a.label, enabled: a.enabled, reason: a.reason ?? '', command: JSON.stringify(a.command) }))
  return JSON.stringify({ items })
}

// ---- Phase 18 (D-153): the skill tree and a hero to spend on — the Tree screen; Phase 22 seats the saved roster ----

const heroes = new Map<number, HeroRecord>()
let nextHero = 1

function heroOf(handle: number): HeroRecord {
  const h = heroes.get(handle)
  if (!h) throw new Error(`no hero ${handle}`)
  return h
}

/** The class's tree: branches, tiers, every skill's head (flat, for JsonUtility). */
export function tree(classId: string): string {
  const c = loaded()
  const cls = classOf(c, classId)
  return JSON.stringify({
    classId: cls.id,
    name: cls.name,
    role: cls.role,
    branches: treeOf(c, classId).map((b) => ({ school: b.school, name: b.name, philosophy: b.philosophy, tiers: b.tiers.map((row, i) => ({ tier: i + 1, skills: row.map((s) => ({ id: s.id, name: s.name, tier: s.tier, type: s.type, cost: s.cost, weight: s.weight ?? 0, target: s.target, description: s.description, prerequisiteId: s.prerequisiteId ?? '', technique: !!s.monsterTechniqueOf, summon: s.summon?.name ?? '', mastery: s.mastery?.text ?? '' })) })) })),
  })
}

/** A fresh hero of the class and species at a level (its starter picks, its level's points unspent beyond them). */
export function heroMake(requestJson: string): number {
  const c = loaded()
  const r = parse<{ classId: string; speciesId?: string; level?: number; seed?: number }>(requestJson, 'hero request')
  let h = createParty(c, r.seed ?? 1, [{ classId: r.classId, speciesId: r.speciesId ?? 'human' }])[0]!
  if (r.level && r.level > 1) h = heroAtLevel(c, c.tuning, h, r.level)
  const handle = nextHero++
  heroes.set(handle, h)
  return handle
}

/** Where the hero stands with every skill of its tree, its points, its loadout (flat, for JsonUtility). */
export function heroView(handle: number): string {
  const c = loaded()
  const h = heroOf(handle)
  const t = c.tuning
  const ult = c.classes.get(h.classId)?.ultimateSkillId ?? ''
  const standings = treeOf(c, h.classId).flatMap((b) => b.tiers.flatMap((row) => row.map((s) => standing(c, t, h, s.id))))
  return JSON.stringify({
    id: h.id, name: h.name, classId: h.classId, speciesId: h.speciesId, level: h.level, battleXp: h.battleXp,
    points: pointsOf(c, t, h), earned: pointsEarned(t, h.level), tierOpen: tierOpenAt(t, h.level),
    actives: h.loadout.actives.map((x) => x ?? ''), passives: h.loadout.passives.map((x) => x ?? ''), ultimate: h.skills.some((k) => k.skillId === ult) ? ult : '',
    standings: standings.map((s) => ({ skillId: s.skillId, known: s.known, rank: s.rank, cost: s.cost, open: s.open, reason: s.reason ?? '', equipped: s.equipped ?? '' })),
  })
}

export function heroSpend(handle: number, skillId: string): string {
  const c = loaded()
  heroes.set(handle, spendPoints(c, c.tuning, heroOf(handle), skillId))
  return heroView(handle)
}

export function heroEquip(handle: number, slot: number, skillId: string): string {
  const c = loaded()
  heroes.set(handle, equip(c, heroOf(handle), slot, skillId === '' ? null : skillId))
  return heroView(handle)
}

export function heroReset(handle: number): string {
  const c = loaded()
  heroes.set(handle, resetTree(c, c.tuning, heroOf(handle)))
  return heroView(handle)
}

/** The test hero raised (or lowered to a fresh one) to a level, its points with it. */
export function heroLevel(handle: number, level: number): string {
  const c = loaded()
  const h = heroOf(handle)
  const fresh = createParty(c, 1, [{ classId: h.classId, speciesId: h.speciesId }])[0]!
  heroes.set(handle, level > 1 ? heroAtLevel(c, c.tuning, fresh, level) : fresh)
  return heroView(handle)
}

export function heroDispose(handle: number): void {
  heroes.delete(handle)
}

// ---- Phase 19: the fight on the stage — its actors and its events (flat, never null, for JsonUtility) ----

/** The fight's actors as they stand: sides, rows, health, the monster id for the figure, the statuses' ids. */
export function fightView(handle: number): string {
  const state = delveOf(handle)
  const f = state.fight ?? lastFights.get(handle)
  if (!f) return JSON.stringify({ active: false, round: 0, over: '', actors: [], log: 0 })
  return JSON.stringify({
    active: !!state.fight,
    round: f.round,
    over: f.over?.outcome ?? '',
    actors: f.actors.map((a) => ({ id: a.id, name: a.name, side: a.side, kind: a.kind, row: a.row, level: a.level, hp: a.hp, maxHp: a.maxHp, pool: a.pool, poolMax: a.poolMax, downed: a.downed, fallen: a.fallen, fled: a.fled, gone: a.gone, monsterId: a.monster?.monsterId ?? '', boss: a.monster?.isBoss ?? false, statuses: a.statuses.map((s) => s.id) })),
    log: f.log.length,
  })
}

/** The fight's events from index `from` on: who did what to whom, the amount, the skill's id when it was one. */
export function fightEvents(handle: number, from: number): string {
  const state = delveOf(handle)
  const f = state.fight ?? lastFights.get(handle)
  if (!f) return JSON.stringify({ items: [], total: 0 })
  const items = f.log.slice(Math.max(0, from)).map((e) => ({ tick: e.tick, round: e.round, kind: e.kind, actorId: e.actorId ?? '', targetId: e.targetId ?? '', amount: e.amount ?? 0, text: e.text, skillId: typeof e.data?.skillId === 'string' ? e.data.skillId : '', status: typeof e.data?.status === 'string' ? e.data.status : '' }))
  return JSON.stringify({ items, total: f.log.length })
}

export function phase(handle: number): string {
  return JSON.stringify(delveOf(handle).phase)
}

/** The delve's log from entry `from` on. */
export function logSince(handle: number, from: number): string {
  return JSON.stringify(delveOf(handle).log.slice(from))
}

export function dispose(handle: number): void {
  lastFights.delete(handle)
  delves.delete(handle)
}
