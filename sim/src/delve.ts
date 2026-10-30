import { fightAmmoFor, stowAmmo } from './ammo.ts'
import { compareIds, type Content } from './content.ts'
import type { DelveCommand, DelveHero, DelveOptions, DelveState, FloorRun, HunterState, LegalDelveAction, RoomState } from './delve-types.ts'
import { detection, disarmChance, heroAmbushChance, monsterAmbushChance, rollScout, scoutChance, trapRevealed } from './detection.ts'
import { codexEventData } from './codex.ts'
import { corridorChoices, roomEntryTicks, useCorridorSkill } from './corridor.ts'
import { goldFor, retreatToll, rForFloor, sellPrice } from './economy.ts'
import { buyOffer, dressRoom, drawChampionAffixes, encountersFor, farthestRoom, floorDef, hopsFrom, isBeforeFinalBoss, isMonsterEncounter, isWaystoneFloor, meetsRoleMix, merchantStock, pickEncounter, spawnBossFight, spawnEncounter, spawnPack, spawnSingle, stepToward, templateHasBrazier, zoneByIndex, zoneOf } from './explore.ts'
import { insightChanceBp, rollInsight } from './insight.ts'
import { applyFightCommand, createFight, legalFightActions, runFight, runFightAuto } from './fight.ts'
import { arenaSummary, type ArenaSetup } from './arena.ts'
import type { Actor, FightState } from './fight-types.ts'
import { generateFloor, type FloorGraph } from './generator.ts'
import { hashState } from './hash.ts'
import { buildHeroActor, heroDetection, heroStats, loseLevels, speciesRules } from './hero.ts'
import { installHook } from './hooks.ts'
import { applyWearBp, createItemInstance, effectiveItemStats, fieldRepair, repairItemPoints, repairKit, setBonusLoad } from './items.ts'
import { addLight, lightAfterRoom, lightAtEntry, lightBand } from './light.ts'
import { lootTableForFloor, openDungeonChest, pickGearItem, rollFightLoot, rollParts, rollRewardItem, rollTreasureRoom, type FightMonster, type ItemFilter } from './loot.ts'
import { partyScale } from './monsters.ts'
import { applyPetTraitAuras, buildPetActor, growPetTraitFromFight, partyPetTraitBonus, petTraitLineAmount } from './pets.ts'
import { chestShiftFor, combineKnobs, lockForPact, oathOf, shiftedCentre } from './pacts.ts'
import { choosePolicyCommand } from './policies.ts'
import { hollowCoinActions, rerollFightDrop } from './relics.ts'
import { applyFightProgress, carryHeroState, floorUsesFor, gainFieldSkillXp, trainCartography } from './progress.ts'
import { Rng, seedFor } from './rng.ts'
import { linesAtRank } from './skill-lines.ts'
import { clamp, roundHalfUp } from './stats.ts'
import { secretDoorKnown } from './secret-doors.ts'
import { roomThreat } from './threat.ts'
import { createTome, tomeCandidates, tomeSkillsAtTier } from './tomes.ts'
import { dressTutorialRoom, isTutorialFloor, tutorialFor } from './tutorial.ts'
import { applyStatus } from './statuses.ts'
import type { Tuning } from './tuning.ts'
import type { CurioDef, DungeonDef, Effect, HeroRecord, ItemInstance, Requirement, Reward, SecretDef, TrapDef } from './types/content.ts'
import { DIFFICULTIES, GRADES, isMember, type Grade, type Status, type Target } from './types/enums.ts'

/**
 * The delve (03-GAME-DESIGN §1, §4, §11, §12; 07): `createDelve / legalDelveActions / stepDelve / runDelveAuto /
 * replayDelve / hashDelve`. State is mutated in place and returned; `seed + commandLog` replays it (D-014).
 */
export const DELVE_VERSION = 1

function rngOf(state: DelveState): Rng {
  return new Rng(state.rng)
}

function save(state: DelveState, rng: Rng): void {
  state.rng = rng.state
}

function dungeonOf(content: Content, state: DelveState): DungeonDef {
  const d = content.dungeons.get(state.options.dungeonId)
  if (!d) throw new Error(`unknown dungeon ${state.options.dungeonId}`)
  return d
}

function logEvent(state: DelveState, kind: string, text: string, data?: Record<string, number | string | boolean | null>): void {
  state.log.push({ floor: state.floor?.number ?? 0, roomId: state.floor?.currentRoomId ?? '', kind, text, data })
}

function activeHeroes(state: DelveState): DelveHero[] {
  return state.heroes.filter((h) => !h.fallen)
}

function bestOf(content: Content, t: Tuning, state: DelveState, pick: (h: DelveHero, stats: Record<string, number>) => number): number {
  let best = -Infinity
  for (const h of activeHeroes(state)) best = Math.max(best, pick(h, heroStats(content, t, h.record)))
  return Number.isFinite(best) ? best : 0
}

/**
 * The roller's Luck for every drop grade (08 §5 of Plunder: "drop shape +pp toward higher grades, stacks with Luck,
 * same cap"): the party's best Luck plus the worn `drop-shape-pp` lines read as Luck points (pp / luckPpPerPoint),
 * so grades.ts applies the one cap to both.
 */
function partyLuck(content: Content, t: Tuning, state: DelveState): number {
  let best = 0
  for (const h of activeHeroes(state)) best = Math.max(best, h.record.attributes.luck)
  const pp = partyAffixPercent(content, t, state, 'drop-shape-pp')
  const perPoint = t.equipment.dropShape.luckPpPerPoint
  const extra = pp > 0 && perPoint > 0 ? roundHalfUp(pp / perPoint) : 0
  return (best || 10) + extra
}

/** Σ of the worn custom lines of one id across the party (an affix's rolled value is its `percent`); a broken item gives nothing. */
/**
 * Every custom line of `customId` a hero carries outside a fight (D-071): worn gear's affix and unique-power lines and
 * the loadout passives' lines at their rank. Delve-side hooks (Light Fingers, Attune, "of Greed") are read here.
 */
function heroHookLines(content: Content, t: Tuning, h: DelveHero, customId: string): Effect[] {
  const out: Effect[] = []
  const eq = h.record.equipment
  const worn: (ItemInstance | null)[] = [eq.mainHand, eq.offHand, eq.helmet, eq.chest, eq.legs, eq.boots, eq.gloves, eq.ring[0], eq.ring[1], eq.talisman, eq.relic]
  for (const inst of worn) {
    const def = inst ? content.items.get(inst.itemId) : undefined
    if (!inst || !def) continue
    for (const hl of effectiveItemStats(content, t, def, inst).hookLines) if (hl.line.customId === customId) out.push(hl.line)
  }
  // Worn sets' bonus lines (08 §6; pass B, Phase 7): the Grinning Company's gold, the Lanternkeeper's light.
  for (const sl of setBonusLoad(content, t, worn).hookLines) if (sl.line.customId === customId) out.push(sl.line)
  for (const id of h.record.loadout.passives) {
    const skill = id ? content.skills.get(id) : undefined
    if (!skill || skill.type !== 'passive') continue
    const rank = h.record.skills.find((s) => s.skillId === skill.id)?.rank ?? 1
    for (const line of linesAtRank(skill, rank)) if (line.kind === 'custom' && line.customId === customId) out.push(line)
  }
  return out
}

/** One hero's total of a delve-side hook (`amount`, else `percent`). */
function heroHookAmount(content: Content, t: Tuning, h: DelveHero, customId: string): number {
  return heroHookLines(content, t, h, customId).reduce((s, l) => s + (l.amount ?? l.percent ?? 0), 0)
}

/** The party's total of a gear or passive hook ("of Greed": every hero's lines add). */
function partyAffixPercent(content: Content, t: Tuning, state: DelveState, customId: string): number {
  return activeHeroes(state).reduce((s, h) => s + heroHookAmount(content, t, h, customId), 0)
}

/** The best single hero's value of a hook (two Attunes are not twice as bright; D-069's rule). */
function partyHookBest(content: Content, t: Tuning, state: DelveState, customId: string): number {
  return activeHeroes(state).reduce((best, h) => Math.max(best, heroHookAmount(content, t, h, customId)), 0)
}

function partyPets(state: DelveState) {
  return activeHeroes(state).map((h) => h.record.petInstance)
}

/** A hero's effective Trap Disarm rank: the skill plus Saboteur and Quick Hands (D-071). */
function disarmRank(content: Content, t: Tuning, h: DelveHero): number {
  return h.record.fieldSkills.trapDisarm.rank + heroHookAmount(content, t, h, 'trap-disarm-rank-bonus') + heroHookAmount(content, t, h, 'field-skill-bonus-trap-disarm')
}

function darkvisionShift(content: Content, state: DelveState): number {
  let shift = 0
  for (const h of activeHeroes(state)) {
    const species = content.species.get(h.record.speciesId)
    if (species) shift = Math.min(shift, speciesRules(species).lightBandShift ?? 0)
  }
  return shift
}

/** The party's best Detection for traps, secrets and curio checks (exported for the tests). */
export function partyDetection(content: Content, t: Tuning, state: DelveState): number {
  let best = 0
  for (const h of activeHeroes(state)) {
    const species = content.species.get(h.record.speciesId)
    const rules = species ? speciesRules(species) : {}
    const stats = heroStats(content, t, h.record)
    const pet = h.record.petInstance && h.record.petInstance.stance === 'forage' ? 2 : 0
    // fix: the loadout passives' Detection lines count out of combat too (Keen Eyes, Snare-Sense): hero.ts heroDetection, the card's number.
    best = Math.max(best, detection(t, heroDetection(content, t, h.record, stats.detection), state.light, rules.lightBandShift ?? 0, pet))
  }
  // A Spiderling's or a Wisp's +5 Detection on the party's best (06 §9).
  return best + partyPetTraitBonus(content, partyPets(state), 'detection')
}

/** A hero's field-skill rank for a check, with its passive rank lines (Tier IV: Wayfinder's Cartography +2). */
function fieldRankOf(content: Content, t: Tuning, h: DelveHero, skill: keyof HeroRecord['fieldSkills']): number {
  return h.record.fieldSkills[skill].rank + (skill === 'cartography' ? heroHookAmount(content, t, h, 'field-skill-bonus-cartography') : 0)
}

/**
 * fix: Cartography (09 §5, 03 §7.6), never built before: entering a room, the map shows the rooms within one ring per
 * `ringPerRanks` (3) ranks of the party's best Cartography (Tier IV: Wayfinder's +2 counts) — scouted, as Scout Ahead
 * leaves them; a secret door stays hidden — and at `stairsAtRank` (10) the floor's first room marks the stairs. Blind Map
 * turns it off (07 §6.2). fix (Phase 8): a room entered for the first time is mapped, and the hero whose rank draws the
 * map trains Cartography by it (progress.ts `trainCartography`; `firstVisitLevel` is the floor's monster level then).
 */
function cartographyReveal(content: Content, t: Tuning, state: DelveState, roomId: string, firstVisitLevel: number | null = null): void {
  const c = t.skills.fieldSkills.cartography
  if (state.ruleFlags.includes('no-cartography')) return
  const rank = activeHeroes(state).reduce((best, h) => Math.max(best, fieldRankOf(content, t, h, 'cartography')), 0)
  const rings = Math.floor(rank / c.ringPerRanks)
  if (rings > 0) for (const [id, v] of hopsFrom(state.floor.graph, roomId)) if (v.hops > 0 && v.hops <= rings && state.floor.rooms[id]) state.floor.rooms[id]!.scouted = true
  const exit = state.floor.rooms[state.floor.graph.exitId]
  if (rank >= c.stairsAtRank && roomId === state.floor.graph.entryId && exit) exit.scouted = true
  if (firstVisitLevel !== null) trainCartography(t, state, state.heroes.map((h) => (h.fallen ? -1 : fieldRankOf(content, t, h, 'cartography'))), firstVisitLevel)
}

/** Tier IV: Wayfinder — the hunter comes at 50 ticks, not the standard 40 (Mastery 60): the difference is added to the floor's own clock, so a preset's earlier hunter stays earlier. */
function hunterDelay(content: Content, state: DelveState): number {
  const at = partyHookBest(content, content.tuning, state, 'hunter-arrival-ticks')
  return at > 0 ? Math.max(0, at - content.tuning.exploration.floorClock.hunterEntersAt) : 0
}

/** Tier IV: Wayfinder — a floor holds its secret room `percent` points more often (+10; Mastery +15); a floor with no secret chance keeps none. */
function secretChanceFor(content: Content, state: DelveState, base: number): number | undefined {
  const bonus = partyHookBest(content, content.tuning, state, 'secret-chance-percent')
  return bonus > 0 && base > 0 ? Math.min(100, base + bonus) : undefined
}

/**
 * The heroes' side of the ambush roll (03 §4.4; fix: only the pets' traits were read): the best single hero's
 * `party-ambush-modifier` lines (Ambush Sense −10, Mastery −15; Never Lost −30), never past D-099's cap
 * (`skills.limits.ambushCutMaxPercent`, so Perception keeps its job), and the best `party-ambush-light-shift`
 * (Tier IV: Dawn Vigil reads the band one step brighter). The pets' traits add on their own (petAmbushModifier).
 */
export function heroAmbushParts(content: Content, state: DelveState): { cut: number; lightShift: number } {
  const t = content.tuning
  const caps = Object.values(t.skills.limits.ambushCutMaxPercent as Record<string, number>)
  const cut = activeHeroes(state).reduce((best, h) => Math.min(best, heroHookAmount(content, t, h, 'party-ambush-modifier')), 0)
  return { cut: caps.length ? Math.max(-Math.max(...caps), cut) : cut, lightShift: partyHookBest(content, t, state, 'party-ambush-light-shift') }
}

/**
 * The preset's knobs and the Pacts' (07 §6; sim/src/pacts.ts `combineKnobs`): percent knobs multiply, bonus knobs add,
 * the rest replace; Thin Line's −2 lands on the preset's revives; the flags and the rewards gather.
 */
function knobsFor(t: Tuning, dungeon: DungeonDef, options: DelveOptions): { knobs: Record<string, number>; flags: string[]; reward: DelveState['pactReward'] } {
  const { knobs, flags, reward } = combineKnobs(t, dungeon, options.difficulty, options.pactIds ?? [])
  return { knobs, flags, reward }
}

function emptyStats(): DelveState['stats'] {
  return { rooms: 0, fights: 0, eliteFights: 0, bossFights: 0, roundsByKind: {}, ambushedParty: 0, ambushedMonsters: 0, trapsRevealed: 0, trapsTriggered: 0, trapsDisarmed: 0, curiosUsed: 0, chestsOpened: 0, torchesUsed: 0, hunterArrived: 0, hunterKilled: 0, downs: 0, wipes: 0, goldFound: 0, goldLost: 0, itemsFound: 0, partsFound: 0, insights: 0, secretsFound: 0, ticksToStairs: [], lightAtStairs: [], fled: 0, xpEvents: 0, hookStubs: {}, deepestFloorCompleted: 0, falls: 0, raises: 0 }
}

/** D-088: under the Mortal rule (and Nightmare, which keeps it, D-095) the dead stay dead; Sheltered (the Phase 3 rules) is the default for the sim's tools. */
export function isMortal(state: DelveState): boolean {
  return state.options.deathRule === 'mortal' || state.options.deathRule === 'nightmare'
}

/** D-095: Nightmare — the chosen hero leads the delve and their death ends it, and the save. */
export function isNightmare(state: DelveState): boolean {
  return state.options.deathRule === 'nightmare'
}

/** Under Nightmare, the leader when they have died (null otherwise). */
export function deadLeader(state: DelveState): DelveHero | null {
  if (!isNightmare(state) || !state.options.leaderId) return null
  return state.heroes.find((h) => h.record.id === state.options.leaderId && h.fallen) ?? null
}

/** D-089: a living hero who knows a revive-tagged skill and has reached the raise level can raise the dead. */
export function canRaise(content: Content, h: DelveHero): boolean {
  if (h.fallen) return false
  if (h.record.level < content.tuning.death.raise.healerMinLevel) return false
  return h.record.skills.some((s) => content.skills.get(s.skillId)?.tags.includes('revive') ?? false)
}

/* ---------- creation ---------- */

export function createDelve(content: Content, options: DelveOptions, party: readonly HeroRecord[]): DelveState {
  const t = content.tuning
  const dungeon = content.dungeons.get(options.dungeonId)
  if (!dungeon) throw new Error(`unknown dungeon ${options.dungeonId}`)
  if (party.length < 1 || party.length > t.coop.maxPlayers) throw new Error(`party of 1–${t.coop.maxPlayers}`)
  const seed: readonly [number, number] = typeof options.seed === 'number' ? [Math.floor(Math.abs(options.seed) / 4294967296) >>> 0, Math.abs(options.seed) >>> 0] : [options.seed[0] >>> 0, options.seed[1] >>> 0]
  const rng = Rng.fromSeed(seed[0], seed[1])
  const { knobs, flags, reward } = knobsFor(t, dungeon, options)
  const startFloor = options.zone !== undefined ? zoneByIndex(dungeon, options.zone).floors.from : (options.floor ?? 1)
  const zone = zoneOf(dungeon, startFloor)
  const lastFloor = options.lastFloor ?? zone.floors.to
  const state: DelveState = {
    version: DELVE_VERSION,
    seed,
    rng: rng.state,
    options: { ...options, lastFloor },
    heroes: party.map((record) => ({ record, hpPercent: 100, poolPercent: 100, downed: false, fallen: false, skillUses: {}, insight: { usesSincePity: 0 }, treatUsed: false, cooked: null, wearCarry: {}, growth: { skills: {}, attributes: {}, items: {}, insights: [], levelsGained: 0 }, petHpPercent: 100 })),
    // The purse carried in rides in the options, so a replay after a reload keeps it (startDelve; Phase 7).
    gold: Math.max(0, Math.floor(options.purseIn ?? 0)),
    bankedAtStart: 0,
    pile: [],
    materials: {},
    floor: null as unknown as FloorRun,
    light: clamp(options.light ?? knobs.lightStart ?? t.exploration.light.start, 0, t.exploration.light.max),
    phase: { kind: 'room' },
    fight: null,
    fightContext: null,
    commandLog: [],
    log: [],
    stats: emptyStats(),
    knobs,
    ruleFlags: flags,
    pactReward: reward,
    pendingStatuses: [],
  }
  beginFloor(content, state, startFloor, rng)
  save(state, rng)
  return state
}

function beginFloor(content: Content, state: DelveState, floorNumber: number, rng: Rng): void {
  const t = content.tuning
  const dungeon = dungeonOf(content, state)
  const fd = floorDef(dungeon, floorNumber)
  const zone = zoneOf(dungeon, floorNumber)
  const bossDef = fd.bossId ? content.monsters.get(fd.bossId) : undefined
  const isLastOfDungeon = floorNumber === Math.max(...dungeon.floors.map((f) => f.floor))
  // D-038 (Phase 8, pass B): a first delve's lesson floor, its contents fixed by the dungeon's `tutorial` block (tutorial.ts).
  const lesson = tutorialFor(dungeon, state.options, floorNumber)
  const kind = isTutorialFloor(dungeon, state.options, floorNumber) ? 'tutorial' : bossDef ? (isLastOfDungeon && (bossDef.boss?.phases.length ?? 0) >= 3 ? 'throne' : 'zoneBoss') : 'normal'
  const floorSeed = seedFor(state.seed[0], state.seed[1], dungeon.id, floorNumber)
  const encRng = rng.fork(`encounters-${floorNumber}`)
  let monsterRooms = 0
  // The boss's arena room is fixed (07 §2.10 "Boss templates are fixed"; 07 §2.8 names it, the boss's arena.room — C1).
  const legalEncounters = encountersFor(content, fd, dungeon.id)
  const graph: FloorGraph = generateFloor({
    knobs: dungeon.generator,
    floor: { ...fd, bossTemplateId: bossDef?.boss?.arena?.room ?? null },
    templates: dungeon.templates,
    seed: floorSeed,
    partySize: state.heroes.length,
    kind,
    // Tier IV: Wayfinder — secret rooms +10% (secretChanceFor).
    overrides: { eliteRoomWeight: state.knobs.eliteRoomWeight, everyDoorLocked: state.ruleFlags.includes('every-door-locked'), secretChance: secretChanceFor(content, state, fd.secretChance) },
    pickEncounter: (ctx) => {
      if (lesson) return lesson.encounterId
      const e = pickEncounter(content, ctx.rng ?? encRng, fd, dungeon.id, ctx.previousEncounterId, monsterRooms, false)
      if (e && isMonsterEncounter(content, e)) monsterRooms++
      return e?.id ?? null
    },
    meetsRoleMix: (ids) => meetsRoleMix(content, ids, floorNumber, legalEncounters),
  })
  const rooms: Record<string, RoomState> = {}
  const used = { curios: new Set<string>(), traps: [] as string[] }
  const trapBonus = state.knobs.trapDifficultyBonus ?? 0
  for (const room of graph.rooms) {
    const rs = lesson ? dressTutorialRoom(dungeon, room, lesson) : dressRoom(content, rng, dungeon, zone, fd, room, used, trapBonus)
    if (room.kind === 'elite') {
      const e = rs.encounterId ? content.encounters.get(rs.encounterId) : undefined
      const picked = e && e.eliteAllowed && !isMonsterEncounter(content, e) ? e : pickEncounter(content, rng, fd, dungeon.id, null, 99, true)
      rs.encounterId = picked?.id ?? rs.encounterId
      if (picked) {
        const elite = picked.composition.map((s) => content.monsters.get(s.monsterId)).find((m) => m && m.role !== 'monster')
        const count = Math.min(4, fd.eliteAffixCount + (state.knobs.eliteAffixBonus ?? 0))
        if (elite) rs.championAffixIds = drawChampionAffixes(content, rng, elite, count)
      }
    }
    rooms[room.id] = rs
  }
  // The lesson floor keeps the hunter away when its block says so (D-038; tutorial.ts).
  const hunter: HunterState | null = zone.hunterId && fd.hunterClock !== null && lesson?.hunter !== false ? { monsterId: zone.hunterId, entered: false, roomId: null, moveProgress: 0, killed: false } : null
  // The secret room's record (07 §2.6): one of the dungeon's secrets for this zone, drawn when the floor has one.
  const secrets = (dungeon.secrets ?? []).filter((s) => s.zoneId === null || s.zoneId === zone.id)
  const secretId = graph.secretId !== null && secrets.length > 0 ? rng.pick(secrets).id : null
  state.floor = {
    number: floorNumber,
    monsterLevel: fd.monsterLevel,
    graph,
    rooms,
    currentRoomId: graph.entryId,
    clock: 0,
    hunter,
    // D-088: under Mortal there is no floor revive budget; the dead are raised by a healer or at the Shrine.
    revivesLeft: isMortal(state) ? 0 : (state.knobs.revivesPerFloor ?? t.death.partyRevivesPerFloor[state.options.difficulty]),
    hasKey: false,
    bossDefeated: false,
    lastEncounterId: null,
    firstFightDone: false,
    secretId,
    shortcutTo: null,
    goldPercentBonus: 0,
    ambushPercent: 0,
    raisesUsed: {},
    // Pact: Twin Hunter — a second hunter on every floor that has one (07 §6.2).
    ...(hunter && state.ruleFlags.includes('twin-hunter') ? { twinHunter: { ...hunter } } : {}),
  }
  // Floor-long statuses (a shrine's Curse, a blessing) end with the floor; counted ones (Greased Stairs) carry over.
  state.pendingStatuses = state.pendingStatuses.filter((p) => p.fightsLeft !== null)
  // The entry lantern never lowers the light (07 §2.3); on the delve's first floor the preset's lightStart wins (07 §6.1).
  const firstFloorOfDelve = state.stats.rooms === 0
  if (!(firstFloorOfDelve && state.knobs.lightStart !== undefined)) state.light = lightAtEntry(t, state.light, fd.lightAtEntry)
  for (const h of state.heroes) h.cooked = null
  logEvent(state, 'floor', `Floor ${floorNumber}: ${graph.rooms.length} rooms (${kind})`, { rooms: graph.rooms.length, kind })
  // 07 §1.1: the zone's Waystone stands in the entry room of its first floor (Gravehollow F1, F4, F7).
  if (isWaystoneFloor(dungeon, floorNumber)) logEvent(state, 'waystone', `${zone.name}: the zone's Waystone stands in the entry room`, { zone: zone.id })
  enterRoom(content, state, graph.entryId, rng, false)
}

/* ---------- rooms ---------- */

function currentRoom(state: DelveState): RoomState {
  const r = state.floor.rooms[state.floor.currentRoomId]
  if (!r) throw new Error('no current room')
  return r
}

function graphRoom(state: DelveState, id: string) {
  const r = state.floor.graph.rooms.find((x) => x.id === id)
  if (!r) throw new Error(`no room ${id}`)
  return r
}

function tickClock(content: Content, state: DelveState, ticks: number, rng: Rng): void {
  state.floor.clock += ticks
  // Pact: Twin Hunter — the second hunter keeps its own walk (it enters with the first, from the floor's other end).
  if (state.floor.twinHunter) tickTwinHunter(content, state, state.floor.twinHunter, ticks)
  const h = state.floor.hunter
  if (!h || h.killed) return
  const dungeon = dungeonOf(content, state)
  const fd = floorDef(dungeon, state.floor.number)
  // Tier IV: Wayfinder delays the hunter.
  const enterAt = (state.knobs.hunterClock ?? fd.hunterClock ?? content.tuning.exploration.floorClock.hunterEntersAt) + hunterDelay(content, state)
  if (!h.entered && state.floor.clock >= enterAt) {
    h.entered = true
    h.roomId = farthestRoom(state.floor.graph, state.floor.currentRoomId)
    state.stats.hunterArrived += 1
    logEvent(state, 'hunter', `The hunter enters the floor`, { room: h.roomId })
  }
  if (h.entered && h.roomId) {
    h.moveProgress += ticks
    const per = content.tuning.exploration.floorClock.hunterTicksPerRoom
    while (h.moveProgress >= per && h.roomId !== state.floor.currentRoomId) {
      h.moveProgress -= per
      h.roomId = stepToward(state.floor.graph, h.roomId, state.floor.currentRoomId)
    }
  }
  void rng
}

/** The hunters standing in a room: the floor's and, under the Twin Hunter Pact, its twin (07 §6.2). */
function huntersHere(state: DelveState, roomId: string): HunterState[] {
  return [state.floor.hunter, state.floor.twinHunter].filter((h): h is HunterState => !!h && h.entered && !h.killed && h.roomId === roomId)
}

/**
 * Pact: Twin Hunter (07 §6.2) — the second hunter enters at the same clock as the first, in the room farthest from the
 * first one's (the floor's other end; never the party's own room), and walks toward the party at the same pace.
 */
function tickTwinHunter(content: Content, state: DelveState, h: HunterState, ticks: number): void {
  if (h.killed) return
  const fd = floorDef(dungeonOf(content, state), state.floor.number)
  // Tier IV: Wayfinder delays the hunter.
  const enterAt = (state.knobs.hunterClock ?? fd.hunterClock ?? content.tuning.exploration.floorClock.hunterEntersAt) + hunterDelay(content, state)
  const graph = state.floor.graph
  if (!h.entered && state.floor.clock >= enterAt) {
    const first = farthestRoom(graph, state.floor.currentRoomId)
    const hops = hopsFrom(graph, first)
    let far: string | null = null
    let farHops = -1
    for (const r of graph.rooms) {
      if (r.kind === 'secret' || r.id === first || r.id === state.floor.currentRoomId) continue
      const n = hops.get(r.id)?.hops ?? -1
      if (n > farHops) {
        far = r.id
        farHops = n
      }
    }
    h.entered = true
    h.roomId = far ?? first
    state.stats.hunterArrived += 1
    logEvent(state, 'hunter', 'A second hunter enters the floor', { room: h.roomId, twin: true })
  }
  if (h.entered && h.roomId) {
    h.moveProgress += ticks
    const per = content.tuning.exploration.floorClock.hunterTicksPerRoom
    while (h.moveProgress >= per && h.roomId !== state.floor.currentRoomId) {
      h.moveProgress -= per
      h.roomId = stepToward(graph, h.roomId, state.floor.currentRoomId)
    }
  }
}

function enterRoom(content: Content, state: DelveState, roomId: string, rng: Rng, viaMove: boolean): void {
  const t = content.tuning
  const dungeon = dungeonOf(content, state)
  const fd = floorDef(dungeon, state.floor.number)
  const g = graphRoom(state, roomId)
  const rs = state.floor.rooms[roomId]
  if (!rs) throw new Error(`room ${roomId} has no state`)
  const firstVisit = !rs.visited
  state.floor.currentRoomId = roomId
  if (viaMove) {
    const before = state.light
    // Pact: Long Night — a new room drains `lightPerNewRoom` (−8) instead of tuning's perNewRoom (07 §6.2).
    state.light = firstVisit && state.knobs.lightPerNewRoom !== undefined ? addLight(t, state.light, state.knobs.lightPerNewRoom) : lightAfterRoom(t, state.light, !firstVisit)
    // Attune, Vigil Lantern, "of Embers": the party's Light falls that many less per room (the best single hero's; D-071).
    const ease = partyHookBest(content, t, state, 'light-decay-reduction')
    if (ease > 0 && state.light < before) state.light = Math.min(before, state.light + ease)
    // Double Time's corridor use (D-099): the room entries it covers share one floor-clock tick (sim/src/corridor.ts).
    if (roomEntryTicks(state)) tickClock(content, state, t.exploration.floorClock.tickPerRoomEntered, rng)
    // Trailblaze's corridor use: its ambush shift belongs to this room's fights, and only this room's.
    state.floor.ambushShiftHere = state.floor.ambushShiftNext ?? 0
    state.floor.ambushShiftNext = 0
    // Mourner's Candles (07 §2.4): a new room entered while they burn cannot surprise the party (C1).
    if (firstVisit && (state.floor.quietRooms ?? 0) > 0) {
      state.floor.quietRooms = (state.floor.quietRooms ?? 0) - 1
      state.floor.ambushShiftHere = (state.floor.ambushShiftHere ?? 0) - 100
    }
  }
  if (firstVisit) {
    rs.visited = true
    state.stats.rooms += 1
    // Braziers restore +15 on the first visit (03 §4.2); the entry's own lantern is the floor's lightAtEntry, not a brazier.
    if (g.kind !== 'entry' && templateHasBrazier(dungeon, g.templateId)) state.light = addLight(t, state.light, t.exploration.light.brazier)
  }
  // The Key (07 §2.10 G12) sits in a room of any rolled kind: picked up on entering when nothing guards it, else when its fight is won.
  if (g.hasKey && rs.cleared && !state.floor.hasKey) {
    state.floor.hasKey = true
    logEvent(state, 'key', 'The party finds the key')
  }
  logEvent(state, 'room', `${g.kind} room ${roomId}${firstVisit ? '' : ' (again)'}`, { kind: g.kind, light: state.light })

  // Perception: traps, the secret door, scouting (03 §4.3).
  const det = partyDetection(content, t, state)
  for (const tr of rs.traps) {
    const def = dungeon.traps.find((x) => x.id === tr.trapId)
    if (!def || tr.revealed || tr.triggered) continue
    if (trapRevealed(det, def.revealedBy.detection + (state.knobs.trapDifficultyBonus ?? 0)) || (def.revealedBy.classId && state.heroes.some((h) => h.record.classId === def.revealedBy.classId)) || (def.revealedBy.petId && state.heroes.some((h) => h.record.petInstance?.petId === def.revealedBy.petId)) || (def.revealedBy.fieldSkillRank && state.heroes.some((h) => fieldRankOf(content, t, h, def.revealedBy.fieldSkillRank!.fieldSkill) >= def.revealedBy.fieldSkillRank!.min)) || (def.revealedBy.criticalScout && rs.scouted)) {
      tr.revealed = true
      state.stats.trapsRevealed += 1
      logEvent(state, 'trapRevealed', `${def.name} spotted`, { trap: def.id })
    }
  }
  // Tier IV: Treasure Sense — Detection +4 for secrets and hidden treasure only, never for traps.
  const treasureDet = det + partyHookBest(content, t, state, 'treasure-detection-bonus')
  if (!rs.secretRevealed && g.doors.some((d) => d.secret) && treasureDet >= fd.secretDifficulty) {
    rs.secretRevealed = true
    state.stats.secretsFound += 1
    logEvent(state, 'secret', 'A secret door')
  }
  const rangers = state.heroes.filter((h) => h.record.classId === 'ranger').length
  const pets = partyPets(state)
  const scoutShift = Math.min(darkvisionShift(content, state), partyPetTraitBonus(content, pets, 'scoutBandShift'))
  const scoutExtra = partyHookBest(content, t, state, 'scouting-chance-percent') + partyPetTraitBonus(content, pets, 'scouting')
  // Pact: Blind Map — no scouting (07 §6.2): nothing ahead is revealed, and no roll is drawn.
  const scout = state.ruleFlags.includes('no-scouting') ? 'none' : rollScout(t, rng, scoutChance(t, state.light, scoutShift, rangers, 0, scoutExtra))
  if (scout !== 'none') {
    for (const d of g.doors) {
      if (d.secret && !rs.secretRevealed) continue
      const n = state.floor.rooms[d.to]
      if (n) n.scouted = true
      if (scout === 'critical') for (const d2 of graphRoom(state, d.to).doors) if (!d2.secret && state.floor.rooms[d2.to]) state.floor.rooms[d2.to]!.scouted = true
    }
  }
  // fix: Cartography's reveal (09 §5); Tier IV: Wayfinder's +2 counts. A first visit trains it (Phase 8).
  cartographyReveal(content, t, state, roomId, firstVisit ? fd.monsterLevel : null)
  // Unrevealed traps that fire on entering (07 §2.5: 'enter', and 'time' on the light — the Drowning Bell).
  springTraps(content, state, rng, rs, 'enter')
  if (state.phase.kind !== 'room') return
  // The hunter (and, under the Twin Hunter Pact, its twin: either one in this room starts the fight).
  const hunter = state.floor.hunter
  const twin = state.floor.twinHunter
  if ((hunter?.entered && !hunter.killed && hunter.roomId === roomId) || (twin?.entered && !twin.killed && twin.roomId === roomId)) {
    startFight(content, state, rng, 'hunter')
    return
  }
  // The room itself.
  switch (g.kind) {
    case 'fight':
    case 'elite':
    case 'keyRoom':
      if (!rs.cleared && rs.encounterId) startFight(content, state, rng, g.kind === 'elite' ? 'elite' : 'fight')
      else if (!rs.cleared) rs.cleared = true
      break
    case 'boss':
      if (!rs.cleared) startFight(content, state, rng, 'boss')
      break
    case 'treasure':
      if (firstVisit) {
        const table = lootTableForFloor(content, dungeon.id, state.floor.number)
        const loot = rollTreasureRoom(content, t, rng, table, { luck: partyLuck(content, t, state), bestDetection: treasureDet })
        rs.goldPiles = loot.goldPiles
        // Pact: Every Door Locked — a chest that would be open locks 30% of the time (07 §6.2).
        if (loot.smallChest) rs.chests.push(lockForPact(state.knobs, rng, loot.smallChest))
        if (loot.largeChest) rs.chests.push(lockForPact(state.knobs, rng, loot.largeChest))
        giveItems(state, loot.bundle)
        if (loot.hidden.kind !== 'none') {
          giveItems(state, [loot.hidden.item])
          rs.hiddenFound = true
          logEvent(state, 'hidden', `Hidden treasure: ${loot.hidden.kind}`)
        }
      }
      break
    case 'secret':
      if (firstVisit) {
        const secret = state.floor.secretId !== null ? (dungeon.secrets ?? []).find((s) => s.id === state.floor.secretId) : undefined
        if (secret) paySecret(content, state, rng, secret, rs)
        else {
          // D-064: with no secret records, a secret room's reward is the zone's cache: 0.15 R, two torches and a Small chest (07 §2.6).
          const gold = goldFor(0.15, rForFloor(state.floor.number))
          state.gold += gold
          state.stats.goldFound += gold
          const torch = [...content.items.values()].find((d) => d.kind === 'consumable' && /torch/i.test(d.name))
          if (torch) giveItems(state, [createItemInstance(content, rng, torch.id, { quantity: 2 })])
          // Pact: Every Door Locked (07 §6.2).
          rs.chests.push(lockForPact(state.knobs, rng, { size: 'small', locked: false, trapped: false, trapId: null, opened: false }))
          logEvent(state, 'cache', `A cache: ${gold} gold`)
        }
      }
      break
    case 'curio':
      if (rs.curioId && !rs.curioUsed) state.phase = { kind: 'curio', curioId: rs.curioId }
      break
    case 'merchant':
      if (!rs.merchant) {
        const hag = Math.max(...state.heroes.map((h) => h.record.fieldSkills.haggling.rank))
        const table = lootTableForFloor(content, dungeon.id, state.floor.number)
        // 07 §2.7 from tuning → merchant (C1): the zone's safe items, the four Torches before the throne (D-099).
        rs.merchant = merchantStock(content, t, rng, { r: rForFloor(state.floor.number, t), hagglingRank: hag, centreGrade: table.gradeShape.centreGrade, classIds: state.heroes.map((h) => h.record.classId), zoneId: zoneOf(dungeon, state.floor.number).id, beforeFinalBoss: isBeforeFinalBoss(dungeon, state.floor.number) })
        state.light = addLight(t, state.light, t.merchant.lightBonus)
      }
      break
    default:
      break
  }
}

function giveItems(state: DelveState, items: readonly ItemInstance[]): void {
  for (const inst of items) {
    state.stats.itemsFound += 1
    state.pile.push(inst)
  }
}

/** Consumables go to a hero's bag so Item actions see them; gear stays on the shared pile (03 §10.2). */
function giveConsumable(content: Content, state: DelveState, inst: ItemInstance, heroIndex = 0): void {
  const h = state.heroes[heroIndex] ?? state.heroes[0]
  if (!h) return
  const def = content.items.get(inst.itemId)
  // Arrows and bolts (08 §4, D-099): a stack goes into the quiver of the hero who draws it (sim/src/ammo.ts); nobody? an item.
  if (def?.ammo) {
    if (stowAmmo(content, content.tuning, state.heroes, inst) === null) state.pile.push(inst)
    return
  }
  // +N stones (Whetstone, Honing Oil, Star Grit) are counted where the Blacksmith spends them: the materials (pass B, Phase 7).
  if (def?.kind === 'stone') {
    state.materials[inst.itemId] = (state.materials[inst.itemId] ?? 0) + inst.quantity
    return
  }
  if (def?.consumable || def?.kind === 'key') {
    const bag = [...h.record.bag]
    const i = bag.findIndex((b) => b.itemId === inst.itemId)
    if (i >= 0) bag[i] = { ...bag[i]!, quantity: bag[i]!.quantity + inst.quantity }
    else bag.push(inst)
    h.record = { ...h.record, bag }
  } else state.pile.push(inst)
}

/** The parts Dunmore buys (07 §2.7): every material the delve found, at 40% + 0.5% per the party's best Haggling rank. */
function partSales(content: Content, state: DelveState): { itemId: string; name: string; quantity: number; gold: number }[] {
  const hag = Math.max(0, ...activeHeroes(state).map((h) => h.record.fieldSkills.haggling.rank))
  const out: { itemId: string; name: string; quantity: number; gold: number }[] = []
  for (const [id, n] of Object.entries(state.materials).sort(([x], [y]) => compareIds(x, y))) {
    const def = content.items.get(id)
    if (!def || def.kind !== 'material' || def.value <= 0 || n <= 0) continue
    out.push({ itemId: id, name: def.name, quantity: n, gold: sellPrice(content.tuning, def.value, hag) * n })
  }
  return out
}

function giveMaterial(state: DelveState, itemId: string, quantity: number): void {
  if (quantity <= 0) return
  state.materials[itemId] = (state.materials[itemId] ?? 0) + quantity
  state.stats.partsFound += quantity
}

/* ---------- secrets (07 §2.6) ---------- */

/** Every room shows its kind on the map (a drawn floor map, a tablet); secret doors stay hidden — a map is not Detection. */
function revealFloor(state: DelveState): void {
  // Pact: Blind Map — no scouting of any kind, a drawn map included (07 §6.2).
  if (state.ruleFlags.includes('no-scouting')) return
  for (const r of Object.values(state.floor.rooms)) r.scouted = true
}

/** The rare parts of the current zone's family (06 §1), by id. */
function familyRareParts(content: Content, state: DelveState): string[] {
  const zone = zoneOf(dungeonOf(content, state), state.floor.number)
  const ids = new Set<string>()
  for (const m of content.monstersByFamily.get(zone.familyId) ?? []) {
    const id = m.parts.rare.itemId ?? m.parts.rare.materialId
    if (id !== undefined && content.items.has(id)) ids.add(id)
  }
  return [...ids].sort()
}

/** One rare part of the zone's family at `percent` (07 §2.4 "a rare part"); returns the id given or null. */
function rollRarePart(content: Content, state: DelveState, rng: Rng, percent: number): string | null {
  const pool = familyRareParts(content, state)
  if (pool.length === 0 || !rng.pct(percent)) return null
  const id = rng.pick(pool)
  giveMaterial(state, id, 1)
  return id
}

/** Consumables whose effects carry a `meal` line (08 §4: herb, mushroom, meat, fish, salt), by id. */
function ingredientDefs(content: Content) {
  return (content.itemsByKind.get('consumable') ?? []).filter((d) => d.consumable?.effects.some((e) => e.kind === 'custom' && e.customId === 'meal'))
}

function giveIngredient(content: Content, state: DelveState, rng: Rng, itemId: string | undefined, quantity: number): string | null {
  const def = itemId !== undefined && content.items.has(itemId) ? content.items.get(itemId) : undefined
  const pool = ingredientDefs(content)
  const chosen = def ?? (pool.length ? rng.pick(pool) : undefined)
  if (!chosen) return null
  giveConsumable(content, state, createItemInstance(content, rng, chosen.id, { quantity: Math.max(1, quantity) }))
  return chosen.id
}

/**
 * A Skill Tome for the party's pile (08 §10.2, 03 §7.5; Phase 7): a random hero's class names the bag — that tier's
 * skills a Tome may carry (never a technique or Tier V, tomes.ts) that the hero does not know. An empty bag gives a Tome
 * of one the hero knows: read in town it is rank XP, never dead loot. A hero of the class reads it in town.
 */
function giveTome(content: Content, state: DelveState, rng: Rng, tier: number): string {
  const heroes = activeHeroes(state)
  if (heroes.length === 0) return 'no one to read it'
  const h = rng.pick(heroes)
  const known = new Set(h.record.skills.map((s) => s.skillId))
  const fresh = tomeCandidates(content, h.record.classId, tier, known)
  const ids = fresh.length > 0 ? fresh : tomeSkillsAtTier(content, h.record.classId, tier)
  if (ids.length === 0) return 'a Tome with nothing to teach'
  const skillId = rng.pick(ids)
  giveItems(state, [createTome(content, rng, skillId)])
  return `a Skill Tome: ${content.skills.get(skillId)?.name ?? skillId}`
}

/** One reward line of a secret, a boss or a disarm (08 §11); gold lines are whole gold. */
function payReward(content: Content, state: DelveState, rng: Rng, r: Reward, bossId?: string): string | null {
  // A line for Hard or Dread only (07 §6.1: "+1 rare part on Hard and Dread").
  if (r.difficultyMin && DIFFICULTIES.indexOf(state.options.difficulty) < DIFFICULTIES.indexOf(r.difficultyMin)) return null
  if (r.chance !== undefined && !rng.pct(r.chance)) return null
  const amount = r.amount ?? 1
  switch (r.kind) {
    case 'gold':
      state.gold += amount
      state.stats.goldFound += amount
      return `${amount} gold`
    case 'material':
      if (!r.id) return null
      giveMaterial(state, r.id, amount)
      return `${amount} ${content.items.get(r.id)?.name ?? r.id}`
    case 'item': {
      if (r.id && content.items.has(r.id)) {
        const def = content.items.get(r.id)
        // Chest keys are counted in materials (pass B: redeemed in town).
        if (def?.kind === 'key' && /chest-key$/.test(r.id)) {
          giveMaterial(state, r.id, amount)
          return `${amount > 1 ? `${amount} ` : ''}${def.name}`
        }
        const inst = createItemInstance(content, rng, r.id, { quantity: amount })
        if (def?.consumable || def?.kind === 'key') giveConsumable(content, state, inst)
        else giveItems(state, [inst])
        return `${amount > 1 ? `${amount} ` : ''}${def?.name ?? r.id}`
      }
      const grade: Grade = r.grade ?? 'F'
      const inst = rewardItemOfGrade(content, state, rng, grade)
      if (!inst) return null
      giveItems(state, [inst])
      return `${content.items.get(inst.itemId)?.name ?? inst.itemId} (${grade})`
    }
    case 'tome':
      return giveTome(content, state, rng, r.tier ?? 1)
    case 'shard':
      // The Divine Shard (08 §7): counted in materials, as the Grand chest's.
      giveMaterial(state, 'divine-shard', amount)
      return amount > 1 ? `${amount} Divine Shards` : 'a Divine Shard'
    case 'title':
    case 'luck':
    case 'waystone': {
      // Town-side lines: settleDelve gives the title and the Luck to the heroes standing (06 §3; D-037).
      ;(state.bossRewards ??= []).push({ bossId: bossId ?? '', kind: r.kind, ...(r.id ? { id: r.id } : {}), amount })
      logEvent(state, 'reward', `${r.kind} reward for the town`, { kind: r.kind, id: r.id ?? null, amount })
      if (r.kind === 'title') return `the title ${titleWords(r.id ?? '')}`
      if (r.kind === 'luck') return `+${amount} Luck for every hero standing`
      return `the ${r.id ?? 'zone'} Waystone stirs`
    }
    default:
      logEvent(state, 'reward', `${r.kind} reward noted`, { kind: r.kind, amount })
      return `${r.kind}`
  }
}

/** A title id in words ("toll-breaker" → "Toll Breaker"). */
function titleWords(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')
}

/** One gear item of exactly a grade for a boss's line (08 §11), for a class in the party where the pool allows. */
function rewardItemOfGrade(content: Content, state: DelveState, rng: Rng, grade: Grade): ItemInstance | null {
  // Pass B's roll (sets and uniques at 08 §10.1's shares, never God, never a boss-bound relic), for a hero of the party.
  const standing = activeHeroes(state)
  const classId = standing.length > 0 ? rng.pick(standing).record.classId : undefined
  return rollRewardItem(content, rng, grade, classId)
}

/** The hunters killed this delve (DelveState.huntersKilled, written by finishFight's victory branch). */
function huntersKilledThisDelve(state: DelveState): readonly string[] {
  const v = (state as { huntersKilled?: unknown }).huntersKilled
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/** Whether this kill is the boss's first for the save (DelveOptions.bossKills: the profile's when the delve began). */
function isFirstKill(state: DelveState, bossId: string): boolean {
  const n = Number(state.options.bossKills?.[bossId] ?? 0)
  return !(n > 0)
}

/** A boss's rewards (06 §3, 08 §11): every kill's lines, then the first kill's. Returns the result card's lines. */
function payBossRewards(content: Content, state: DelveState, rng: Rng, fight: FightState): string[] {
  const bossId = fight.arena?.bossId ?? fight.actors.find((a) => a.monster?.isBoss)?.monster?.monsterId
  const def = bossId ? content.monsters.get(bossId) : undefined
  if (!def?.boss) return []
  const out: string[] = []
  for (const r of def.boss.everyKill) {
    const text = payReward(content, state, rng, r, def.id)
    if (text) out.push(text)
  }
  if (isFirstKill(state, def.id)) {
    const first: string[] = []
    for (const r of def.boss.firstKill) {
      const text = payReward(content, state, rng, r, def.id)
      if (text) first.push(text)
    }
    if (first.length) out.push(`First kill: ${first.join(', ')}`)
  }
  return out
}

/** The boss fight's arena record (07 §8.2) on the delve's stats, whatever the outcome. */
function recordBossArena(content: Content, state: DelveState, fight: FightState): void {
  const s = arenaSummary(fight)
  const bossId = s?.boss ?? fight.actors.find((a) => a.monster?.isBoss)?.monster?.monsterId ?? ''
  const outcome = fight.over?.outcome ?? 'cap'
  ;(state.stats.bossArenas ??= []).push({
    boss: bossId,
    floor: state.floor.number,
    outcome,
    rounds: fight.round,
    phase: s?.phase ?? (fight.actors.find((a) => a.monster?.isBoss)?.monster?.phaseIndex ?? 0) + 1,
    firstKill: outcome === 'victory' && isFirstKill(state, bossId),
    lightMin: s?.lightMin ?? fight.light,
    lightEnd: s?.lightEnd ?? fight.light,
    lanternsOut: s?.lanternsOut ?? 0,
    candlesOut: s?.candlesOut ?? 0,
    doorsOpened: s?.doorsOpened ?? false,
    tideMax: s?.tideMax ?? 0,
    sluiceTurns: s?.sluiceTurns ?? 0,
    braziersLit: s?.braziersLit ?? 0,
    torchesUsed: s?.torchesUsed ?? 0,
    recalls: s?.recalls ?? 0,
    huntersReturned: s?.huntersReturned ?? 0,
    huntersSkipped: s?.huntersSkipped ?? 0,
    pulls: s?.pulls ?? 0,
    partsBroken: s?.partsBroken ?? '',
    tells: s?.tells ?? 0,
    tellsBroken: s?.tellsBroken ?? 0,
  })
  void content
}

/** A secret room pays its record (07 §2.6): rewards, a chest, light, the floor map, a crawlway to the exit, a blessing, field-skill XP. */
function paySecret(content: Content, state: DelveState, rng: Rng, secret: SecretDef, rs: RoomState): void {
  const t = content.tuning
  const bits: string[] = []
  for (const r of secret.rewards) {
    const text = payReward(content, state, rng, r)
    if (text) bits.push(text)
  }
  if (secret.chest) {
    // Pact: Every Door Locked (07 §6.2).
    rs.chests.push(lockForPact(state.knobs, rng, { size: secret.chest, locked: secret.chestLocked === true, trapped: false, trapId: null, opened: false }))
    bits.push(`a ${secret.chestLocked ? 'locked ' : ''}${secret.chest} chest`)
  }
  if (secret.lightBonus) {
    state.light = addLight(t, state.light, secret.lightBonus)
    bits.push(`light ${secret.lightBonus > 0 ? '+' : ''}${secret.lightBonus}`)
  }
  if (secret.revealsFloor) {
    revealFloor(state)
    bits.push('the floor map')
  }
  if (secret.shortcutToExit) {
    const exit = state.floor.rooms[state.floor.graph.exitId]
    if (exit) exit.scouted = true
    state.floor.shortcutTo = state.floor.graph.exitId
    bits.push('a crawlway to the stairs')
  }
  if (secret.blessing) {
    for (const line of secret.blessing.effects) {
      if (line.kind === 'applyStatus' && line.status) {
        // A blessing's Shield is a share of each hero's own max HP (07 §2.6 the Drowned Shrine's Undertow: 20%).
        state.pendingStatuses.push({ kind: 'status', status: line.status, target: line.target ?? 'allAllies', duration: line.duration, fightsLeft: null, sourceId: secret.id, ...(line.status === 'shield' && line.percent !== undefined ? { maxHpPercent: line.percent } : {}) })
      } else {
        const r = resolveDelveLine(content, state, rng, line, { kind: 'secret', id: secret.id, percent: 100, victim: activeHeroes(state)[0] ?? null })
        bits.push(r.text)
      }
    }
    bits.push(`blessing: ${secret.blessing.name}`)
  }
  if (secret.fieldSkillXp) {
    // Reading: 07 §2.6's "rank XP ×5" is five uses' worth (a disarm or a revive pays 10) to every active hero.
    const skill = secret.fieldSkillXp
    // fix (Phase 8): the XP reaches rank (progress.ts gainFieldSkillXp).
    for (const h of activeHeroes(state)) h.record = gainFieldSkillXp(t, h.record, skill, 50).hero
    bits.push(`${skill} XP`)
  }
  logEvent(state, 'secret', `${secret.name}: ${bits.join(', ') || 'nothing but dust'}`, { secret: secret.id })
}

/* ---------- out-of-combat effect lines (07 §2.4–§2.6, 08 §4) ---------- */

interface DelveLineSource {
  kind: 'trap' | 'curio' | 'secret' | 'item'
  id: string
  /** Percent of the effect (a fumbled disarm fires its trap at 50). */
  percent: number
  /** The hero the line falls on when it names one (a trap's victim, an item's user, a curio's digger). */
  victim: DelveHero | null
}

/** An ambush a line asks for (07 §2.4 "a fight that begins with the party surprised"), or a curio's plain fight. */
interface AmbushSpec {
  monsterId: string | null
  count: number | null
  surprise: boolean
  /** A hunter's fight (07 §2.4 the Leech Jar's Vault Leech): started as kind 'hunter' — no surprise either way, never fled. */
  asHunter?: boolean
}

interface DelveLineResult {
  text: string
  ambush: AmbushSpec | null
}

/**
 * A trap, curio or item status lands at the start of the next fight(s) on this floor; instant statuses (Daze) have
 * nowhere to land. A line with no target (or `self`) lands on the line's victim alone — the trap's lowest-Perception
 * hero, the curio's opener or reader (dungeon.schema's "Target defaults to the lowest-Perception hero"; C1) — and a
 * Shield's `percent` is a share of each target's own max HP.
 */
function queueStatus(content: Content, state: DelveState, line: Effect, status: Status, fightsLeft: number | null, sourceId: string, magnitude?: number, victim?: DelveHero | null): string {
  const def = content.statuses.get(status)
  if (def && def.durationDefault === null && (def.endsWhen ?? '').startsWith('instant')) return `${status} (fades before the next fight)`
  const one = (line.target === undefined || line.target === 'self') && victim ? state.heroes.indexOf(victim) : -1
  const shield = status === 'shield' && line.percent !== undefined ? { maxHpPercent: line.percent } : {}
  state.pendingStatuses.push({ kind: 'status', status, target: line.target ?? 'allAllies', duration: line.duration, magnitude, fightsLeft, sourceId, ...(one >= 0 ? { heroIndex: one } : {}), ...shield })
  const who = one >= 0 && victim ? ` on ${victim.record.name}` : ''
  return fightsLeft === null ? `${status}${who} for the rest of the floor` : `${status}${who} for the next ${fightsLeft === 1 ? 'fight' : `${fightsLeft} fights`}`
}

/** The row a hero stands in when a fight begins (startFight's rule; tuning floors.frontRowClasses), for a trap's rows out of combat. */
function heroRowOf(content: Content, h: DelveHero): 'front' | 'back' {
  return (content.tuning.floors.frontRowClasses as readonly string[]).includes(h.record.classId) ? 'front' : 'back'
}

/** The heroes a delve-side line hurts or heals (07 §2.5: partyFront "both front-row heroes", allAllies everyone); no target: the victim. */
function lineHeroes(content: Content, state: DelveState, line: Effect, victim: DelveHero | null): DelveHero[] {
  switch (line.target) {
    case 'partyFront':
      return activeHeroes(state).filter((h) => heroRowOf(content, h) === 'front')
    case 'partyBack':
      return activeHeroes(state).filter((h) => heroRowOf(content, h) === 'back')
    case 'allAllies':
      return activeHeroes(state)
    default:
      return victim ? [victim] : []
  }
}

/**
 * Resolves one out-of-combat effect line (a trap's, a curio outcome's, a secret blessing's, a consumable's) against
 * the delve: the DSL kinds that mean something outside a fight (light, damage, loot, applyStatus) and every custom
 * id of 07 §2.4–§2.6 and 08 §4 (the handler files under sim/src/skills/custom hold each contract). Returns the
 * result card's text and, for an ambush, what to spawn; the caller starts the fight after logging.
 */
function resolveDelveLine(content: Content, state: DelveState, rng: Rng, line: Effect, src: DelveLineSource): DelveLineResult {
  const t = content.tuning
  const floor = state.floor.number
  const scale = src.percent / 100
  const none = (text: string): DelveLineResult => ({ text, ambush: null })
  const victim = src.victim
  switch (line.kind) {
    case 'light': {
      const amount = roundHalfUp((line.amount ?? 0) * scale)
      state.light = addLight(t, state.light, amount)
      return none(`light ${amount > 0 ? '+' : ''}${amount}`)
    }
    case 'damage': {
      if (!victim) return none('no one to hurt')
      // A trap's bare damage line: 8 + 4F × multiplier (D-064's reading of 07 §2.5's numbers).
      const dmg = Math.max(1, roundHalfUp((8 + 4 * floor) * (line.multiplier ?? 1) * scale))
      hurtHero(content, state, victim, dmg)
      return none(`${dmg} to ${victim.record.name}`)
    }
    case 'heal': {
      // 07 §2.4 the Weeping Statue's "heal 30% HP to all": percent of max HP, out of combat (C1).
      const healed = lineHeroes(content, state, line, victim)
      for (const h of healed) h.hpPercent = Math.min(100, h.hpPercent + roundHalfUp((line.percent ?? 0) * scale))
      return none(healed.length ? `+${roundHalfUp((line.percent ?? 0) * scale)}% HP to ${healed.length === 1 ? healed[0]!.record.name : 'the party'}` : 'no one to heal')
    }
    case 'loot': {
      // D-064: a curio's `loot.amount` is hundredths of R (0.05 R → 5), `percent` a share of the carried gold.
      const gold = line.amount !== undefined ? goldFor(line.amount / 100, rForFloor(floor)) : roundHalfUp((state.gold * (line.percent ?? 0)) / 100)
      state.gold = Math.max(0, state.gold + gold)
      if (gold > 0) state.stats.goldFound += gold
      else state.stats.goldLost += -gold
      return none(`${gold >= 0 ? '+' : ''}${gold} gold`)
    }
    case 'applyStatus':
      if (!line.status) return none('nothing')
      return none(queueStatus(content, state, line, line.status, 1, src.id, undefined, victim))
    case 'custom':
      break
    default:
      return none(line.kind)
  }
  switch (line.customId) {
    case 'floor-clock-add':
      tickClock(content, state, line.amount ?? 0, rng)
      return none(`the clock runs on +${line.amount ?? 0}`)
    case 'next-fight-ambush':
      if (!state.ruleFlags.includes('next-fight-ambush')) state.ruleFlags.push('next-fight-ambush')
      state.floor.ambushPercent = Math.max(state.floor.ambushPercent, line.percent ?? 30)
      return none('the next fight will be an ambush')
    case 'damage-percent-max-hp': {
      if (!victim) return none('no one to hurt')
      const stats = heroStats(content, t, victim.record)
      const dmg = roundHalfUp((stats.hp * (line.percent ?? 0) * scale) / 100)
      hurtHero(content, state, victim, dmg)
      return none(`${dmg} to ${victim.record.name}`)
    }
    case 'trap-flat-damage': {
      // The victim, or the heroes the line's target names (07 §2.5's Bone Scythe: "to both front-row heroes"; C1).
      const hit = lineHeroes(content, state, line, victim)
      if (hit.length === 0) return none('no one to hurt')
      const dmg = Math.max(0, roundHalfUp(((line.amount ?? 0) + (line.multiplier ?? 0) * floor) * scale))
      for (const h of hit) hurtHero(content, state, h, dmg)
      return none(`${dmg} ${line.damageType ?? ''} to ${hit.map((h) => h.record.name).join(' and ')}`.replace('  ', ' '))
    }
    case 'ambush-encounter':
      return { text: 'an ambush', ambush: { monsterId: line.summonId ?? null, count: line.amount ?? null, surprise: true } }
    case 'lantern-gutters':
      state.light = addLight(t, state.light, line.amount ?? -10)
      return { text: `the lantern gutters (light ${line.amount ?? -10}): an ambush`, ambush: { monsterId: line.summonId ?? null, count: null, surprise: true } }
    case 'give-material': {
      const zone = zoneOf(dungeonOf(content, state), floor)
      const familyCommon = (content.monstersByFamily.get(zone.familyId) ?? []).map((m) => m.parts.common.materialId).find((id) => id !== undefined && content.items.has(id))
      const fallback = (content.itemsByKind.get('material') ?? []).find((d) => d.grade === 'F')?.id
      const id = line.itemId && content.items.has(line.itemId) ? line.itemId : (familyCommon ?? fallback)
      if (!id) return none('no material to give')
      const qty = Math.max(1, line.amount ?? 1)
      giveMaterial(state, id, qty)
      const rare = line.percent ? rollRarePart(content, state, rng, line.percent) : null
      return none(`${qty} ${content.items.get(id)?.name ?? id}${rare ? ` and ${content.items.get(rare)?.name ?? rare}` : ''}`)
    }
    case 'roll-rare-part': {
      const rare = rollRarePart(content, state, rng, line.percent ?? 100)
      return none(rare ? `a rare part: ${content.items.get(rare)?.name ?? rare}` : 'nothing rare')
    }
    case 'drop-item-of-grade': {
      const byRung = line.amount !== undefined ? GRADES[Math.max(0, Math.min(GRADES.length - 2, Math.round(line.amount)))] : undefined
      const byNote = line.note?.match(/\b(F|E|D|C|B|A|S|SS|God)\b/)?.[1]
      const grade: Grade = byRung ?? (isMember(GRADES, byNote) ? byNote : 'D')
      const slotWord = line.note?.match(/\b(boots|helmet|chest|legs|gloves|ring|talisman|shield|relic)\b/i)?.[1]?.toLowerCase()
      const filters: ItemFilter[] = slotWord ? [(d) => d.slot === slotWord, () => true] : []
      const def = pickGearItem(content, rng, grade, filters)
      if (!def) return none(`an item (${grade}) — nothing fits`)
      giveItems(state, [createItemInstance(content, rng, def.id, { rollAffixes: true })])
      return none(`${def.name} (${def.grade})`)
    }
    case 'reveal-floor':
      revealFloor(state)
      return none('the floor map')
    case 'tome-tier-1':
      return none(giveTome(content, state, rng, 1))
    case 'status-next-fights':
      if (!line.status) return none('nothing')
      return none(queueStatus(content, state, line, line.status, Math.max(1, line.amount ?? 1), src.id, undefined, victim))
    case 'status-for-floor':
      if (!line.status) return none('nothing')
      return none(queueStatus(content, state, line, line.status, null, src.id, undefined, victim))
    case 'status-flat-per-tick': {
      if (!line.status) return none('nothing')
      const flat = Math.max(0, roundHalfUp(((line.amount ?? 0) + (line.multiplier ?? 0) * floor) * scale))
      const def = content.statuses.get(line.status)
      // The record ticks a share of a hit (Burn 20%): hand it the hit that makes the tick come out at the flat.
      const magnitude = def?.magnitudeOf === 'hitDamage' && (def.percent ?? 0) > 0 ? roundHalfUp((flat * 100) / (def.percent ?? 100)) : flat
      return none(`${queueStatus(content, state, line, line.status, 1, src.id, magnitude, victim)} (${flat} per tick)`)
    }
    case 'cooking-ingredient': {
      const id = giveIngredient(content, state, rng, line.itemId, line.amount ?? 1)
      return none(id ? `${line.amount ?? 1} ${content.items.get(id)?.name ?? id}` : 'no ingredient to give')
    }
    case 'larder-feast': {
      const regen = queueStatus(content, state, { ...line, duration: undefined }, 'regen', 2, src.id)
      const id = giveIngredient(content, state, rng, line.itemId, 1)
      return none(`${regen}${id ? ` and 1 ${content.items.get(id)?.name ?? id}` : ''}`)
    }
    case 'toll-shrine-cleanse': {
      const amount = line.amount ?? 10
      state.light = addLight(t, state.light, amount)
      const status = line.status ?? 'fear'
      state.pendingStatuses.push({ kind: 'resist', status, target: 'allAllies', percent: 100, fightsLeft: null, sourceId: src.id })
      return none(`light +${amount} and ${status} immunity for the rest of the floor`)
    }
    case 'floor-gold-percent':
      state.floor.goldPercentBonus += line.percent ?? 0
      return none(`+${line.percent ?? 0}% gold found this floor`)
    case 'nothing':
      return none('nothing')
    case 'repair-durability': {
      if (!victim) return none('no one to repair for')
      const eq = victim.record.equipment
      const worst = (['mainHand', 'offHand', 'helmet', 'chest', 'legs', 'boots', 'gloves', 'talisman', 'relic'] as const).map((s) => ({ s, inst: eq[s] })).filter((x) => x.inst !== null).sort((a, b) => a.inst!.durability - b.inst!.durability)[0]
      if (!worst?.inst) return none('nothing to repair')
      const r = repairItemPoints(worst.inst, Math.max(0, roundHalfUp((line.percent ?? t.equipment.durability.repair.kitPercent) * scale)))
      victim.record = { ...victim.record, equipment: { ...eq, [worst.s]: r.inst } }
      return none(`${content.items.get(worst.inst.itemId)?.name ?? worst.s} +${r.restored}`)
    }
    case 'pet-treat': {
      if (!victim) return none('no one to feed a pet')
      if (!victim.record.petInstance) throw new Error('no pet to treat')
      if (victim.treatUsed) throw new Error('one treat per delve')
      victim.treatUsed = true
      return none(`${victim.record.petInstance.name} enjoys a treat (+${line.percent ?? t.pets.treat.xpPercent}% pet XP this delve)`)
    }
    case 'meal':
      throw new Error('cook it at a rest room')
    default:
      return resolveCryptVaultLine(content, state, rng, line, src) ?? none(line.customId ?? 'custom')
  }
}

/**
 * The Crypts' and the Vault's out-of-combat lines (07 §2.4–§2.6; C1, Phase 7), each documented in its handler file
 * under sim/src/skills/custom: a curio's plain fight, a Tome, a chest that appears, the urns, the Ledger's map and
 * Insight, the candles' quiet rooms, floor-long immunities and blessings, the sluice and the flood, the Confession.
 * Null for an id it does not know.
 */
function resolveCryptVaultLine(content: Content, state: DelveState, rng: Rng, line: Effect, src: DelveLineSource): DelveLineResult | null {
  const t = content.tuning
  const none = (text: string): DelveLineResult => ({ text, ambush: null })
  const victim = src.victim
  const one = (line.target === undefined || line.target === 'self') && victim ? state.heroes.indexOf(victim) : -1
  switch (line.customId) {
    case 'curio-fight': {
      const def = line.summonId ? content.monsters.get(line.summonId) : undefined
      if (!def) return none('nothing stirs')
      return { text: `${def.name} ${def.hunter ? 'comes for its brood' : 'attacks'}`, ambush: { monsterId: def.id, count: line.amount ?? 1, surprise: false, ...(def.hunter ? { asHunter: true } : {}) } }
    }
    case 'tome-of-tier':
      return none(giveTome(content, state, rng, Math.max(1, line.amount ?? 1)))
    case 'large-chest-appears':
    case 'small-chest-appears': {
      if ((line.amount ?? 0) > 0) tickClock(content, state, line.amount ?? 0, rng)
      const size = line.customId === 'large-chest-appears' ? 'large' : 'small'
      currentRoom(state).chests.push(lockForPact(state.knobs, rng, { size, locked: false, trapped: false, trapId: null, opened: false }))
      return none(`a ${size} chest${(line.amount ?? 0) > 0 ? ` (the clock runs on +${line.amount})` : ''}`)
    }
    case 'smash-urns': {
      const u = t.floors.funeralUrns
      const r = rForFloor(state.floor.number, t)
      let gold = 0
      let dust = 0
      let egg = false
      for (let i = 0; i < u.urns; i++) {
        const roll = rng.int(u.goldChance + u.blindChance + u.eggChance)
        if (roll < u.goldChance) gold += goldFor(u.goldR, r)
        else if (roll < u.goldChance + u.blindChance) dust++
        else egg = true
      }
      state.gold += gold
      state.stats.goldFound += gold
      if (dust > 0 && victim) queueStatus(content, state, { kind: 'applyStatus', status: 'blind', duration: u.blindDuration }, 'blind', 1, src.id, undefined, victim)
      const text = `${gold} gold${dust ? `, grave dust (${victim?.record.name ?? 'the smasher'} blinded)` : ''}${egg ? ', and an egg hatches' : ''}`
      return egg && line.summonId ? { text, ambush: { monsterId: line.summonId, count: line.amount ?? 1, surprise: true } } : none(text)
    }
    case 'reveal-secret-and-key': {
      const g = state.floor.graph
      const bits: string[] = []
      if (g.secretId) {
        const host = g.rooms.find((room) => room.doors.some((d) => d.to === g.secretId && d.secret))
        if (host && state.floor.rooms[host.id]) state.floor.rooms[host.id]!.secretRevealed = true
        if (state.floor.rooms[g.secretId]) state.floor.rooms[g.secretId]!.scouted = true
        bits.push('the secret door')
      }
      if (g.keyRoomId && state.floor.rooms[g.keyRoomId]) {
        state.floor.rooms[g.keyRoomId]!.scouted = true
        bits.push('the key')
      }
      return none(bits.length ? `${bits.join(' and ')} marked on the map` : 'no secret and no key on this floor')
    }
    case 'insight-roll': {
      if (!victim) return none('no one to read it')
      const known = new Set(victim.record.skills.map((s) => s.skillId))
      let tier = 0
      let ids: readonly string[] = []
      for (let tr = 1; tr <= 4 && ids.length === 0; tr++) {
        ids = tomeCandidates(content, victim.record.classId, tr, known)
        tier = tr
      }
      if (ids.length === 0) return none(`${victim.record.name} has nothing left to learn here`)
      const chance = insightChanceBp(t, state.floor.monsterLevel, tier, victim.record.attributes.wisdom) * Math.max(1, line.multiplier ?? 1)
      if (!rollInsight(t, rng, victim.insight, chance)) return none(`${victim.record.name} reads, but nothing comes of it`)
      const skillId = rng.pick([...ids])
      victim.record = { ...victim.record, skills: [...victim.record.skills, { skillId, rank: 1, xp: 0 }] }
      victim.growth.insights.push(skillId)
      state.stats.insights += 1
      return none(`Insight: ${victim.record.name} learns ${content.skills.get(skillId)?.name ?? skillId}`)
    }
    case 'no-ambush-rooms':
      state.floor.quietRooms = Math.max(state.floor.quietRooms ?? 0, line.amount ?? 0)
      return none(`no ambushes for the next ${line.amount ?? 0} rooms`)
    case 'resist-for-floor': {
      if (!line.status) return none('nothing')
      state.pendingStatuses.push({ kind: 'resist', status: line.status, target: line.target ?? 'allAllies', percent: line.percent ?? 100, fightsLeft: null, sourceId: src.id, ...(one >= 0 ? { heroIndex: one } : {}) })
      return none(`${line.status} immunity for the rest of the floor${one >= 0 && victim ? ` for ${victim.record.name}` : ''}`)
    }
    case 'element-damage-for-floor': {
      if (!line.damageType) return none('nothing')
      state.pendingStatuses.push({ kind: 'hook', target: line.target ?? 'allAllies', fightsLeft: null, sourceId: src.id, line: { kind: 'custom', customId: 'element-damage-percent', damageType: line.damageType, percent: line.percent ?? 0 }, ...(one >= 0 ? { heroIndex: one } : {}) })
      return none(`+${line.percent ?? 0}% ${line.damageType} damage for the rest of the floor`)
    }
    case 'drain-sluice': {
      const gold = goldFor((line.amount ?? 0) / 100, rForFloor(state.floor.number, t))
      state.gold += gold
      state.stats.goldFound += gold
      state.floor.sluiceDrained = true
      return none(`the sluice drains the next flooded room (+${gold} gold in the silt)`)
    }
    case 'flood-room': {
      if (state.floor.sluiceDrained) {
        state.floor.sluiceDrained = false
        return none('the gate opens on a drained cell')
      }
      const amount = line.amount ?? -10
      for (const stat of ['speed', 'accuracy'] as const) state.pendingStatuses.push({ kind: 'modifier', target: 'allAllies', fightsLeft: 1, sourceId: src.id, stat, amount, bothSides: true })
      return none(`the room floods: the fight here is fought wading (${amount} Speed and Accuracy, both sides)`)
    }
    case 'naesa-confession':
      if (!state.ruleFlags.includes('tidebound-confession')) state.ruleFlags.push('tidebound-confession')
      return none("Sister Naesa's tell is marked; she will open the fight weakened")
    default:
      return null
  }
}

/* ---------- trap triggers (07 §2.5; C1) ---------- */

/** What the party does in a room that may spring its traps. */
type TrapEvent = 'enter' | 'leave' | 'descend' | 'open' | 'loot'

/**
 * Whether a trap's trigger answers the party's act (07 §2.5: "Unrevealed, it fires on the lowest-Perception hero
 * unless the trigger says otherwise"): 'enter' on entering; 'step' on crossing the room — leaving it, by a door or
 * the stairs; 'open' on the door it blocks, else on the stairs or on opening a chest or curio here (a niche); 'loot'
 * on taking the room's gold or opening its chest; 'time' on entering when it reads the light (the Drowning Bell),
 * else on opening a chest or curio here (the Sentinel Eye).
 */
function trapAnswers(def: TrapDef, blocksDoorTo: string | null, event: TrapEvent, doorTo: string | null): boolean {
  switch (def.trigger) {
    case 'enter':
      return event === 'enter'
    case 'step':
      return event === 'leave' || event === 'descend'
    case 'open':
      return blocksDoorTo !== null ? event === 'leave' && doorTo === blocksDoorTo : event === 'open' || event === 'descend'
    case 'loot':
      return event === 'loot'
    case 'time':
      return def.condition?.lightBelow !== undefined ? event === 'enter' : event === 'open'
  }
}

/** A trap's `condition` (07 §2.5: the Drowning Bell only when Shadowy or worse, the Warding Glyph only for a caster). */
function trapConditionHolds(state: DelveState, def: TrapDef): boolean {
  const c = def.condition
  if (!c) return true
  if (c.lightBelow !== undefined && state.light >= c.lightBelow) return false
  if (c.partyClassIds && !activeHeroes(state).some((h) => c.partyClassIds!.includes(h.record.classId))) return false
  return true
}

/**
 * Fires the room's unrevealed traps whose trigger answers the act (the lead's go-ahead, Phase 7; 07 §2.5). A revealed
 * trap is walked around (or blocks its door until disarmed or set off); an ambush a trap springs ends the act.
 */
function springTraps(content: Content, state: DelveState, rng: Rng, rs: RoomState, event: TrapEvent, doorTo: string | null = null): void {
  const dungeon = dungeonOf(content, state)
  for (const tr of rs.traps) {
    if (tr.revealed || tr.triggered || tr.disarmed) continue
    const def = dungeon.traps.find((x) => x.id === tr.trapId)
    if (!def || !trapAnswers(def, tr.blocksDoorTo, event, doorTo) || !trapConditionHolds(state, def)) continue
    fireTrap(content, state, rng, def, tr, 100)
    if (state.phase.kind === 'fight' || state.phase.kind === 'over') return
  }
}

/* ---------- traps ---------- */

function lowestPerceptionHero(state: DelveState): DelveHero | null {
  let best: DelveHero | null = null
  for (const h of activeHeroes(state)) if (!best || h.record.attributes.perception < best.record.attributes.perception) best = h
  return best
}

function fireTrap(content: Content, state: DelveState, rng: Rng, def: TrapDef, tr: { triggered: boolean }, percent: number): void {
  tr.triggered = true
  state.stats.trapsTriggered += 1
  const victim = lowestPerceptionHero(state)
  const lines: string[] = []
  let ambush: AmbushSpec | null = null
  for (const line of def.effects) {
    const r = resolveDelveLine(content, state, rng, line, { kind: 'trap', id: def.id, percent, victim })
    lines.push(r.text)
    if (r.ambush) ambush = r.ambush
  }
  logEvent(state, 'trap', `${def.name} fires: ${lines.join(', ') || 'nothing'}`, { trap: def.id })
  if (ambush) startFight(content, state, rng, ambush.asHunter ? 'hunter' : 'trap', ambush)
}

function hurtHero(content: Content, state: DelveState, h: DelveHero, dmg: number): void {
  const stats = heroStats(content, content.tuning, h.record)
  const pct = Math.max(1, roundHalfUp((dmg * 100) / Math.max(1, stats.hp)))
  h.hpPercent = Math.max(0, h.hpPercent - pct)
  if (h.hpPercent === 0) {
    h.downed = true
    state.stats.downs += 1
  }
}

/* ---------- fights ---------- */

type FightKind = 'fight' | 'elite' | 'boss' | 'hunter' | 'trap' | 'curio'

/**
 * The monsters a named ambush brings (07 §2.4–§2.5): `count` of the monster when the line says how many, else an
 * encounter of the floor's tables that holds it, else an ordinary pack of three.
 */
function spawnAmbush(content: Content, state: DelveState, rng: Rng, ambush: AmbushSpec, opts: { level: number; partySize: number; enemyHpPercent: number; enemyCountPercent: number }): Actor[] | null {
  if (!ambush.monsterId) return null
  const def = content.monsters.get(ambush.monsterId)
  if (!def) return null
  if (ambush.count !== null) return spawnPack(content, content.tuning, def, { count: ambush.count, level: opts.level, partySize: opts.partySize, enemyHpPercent: opts.enemyHpPercent })
  const dungeon = dungeonOf(content, state)
  const fd = floorDef(dungeon, state.floor.number)
  const holding = encountersFor(content, fd, dungeon.id).filter((e) => e.composition.some((s) => s.monsterId === def.id))
  if (holding.length > 0) {
    const encounter = rng.weighted(holding, (e) => e.weight)
    state.floor.lastEncounterId = encounter.id
    return spawnEncounter(content, content.tuning, rng, encounter, { ...opts, championAffixIds: [] })
  }
  return spawnPack(content, content.tuning, def, { count: 3, level: opts.level, partySize: opts.partySize, enemyHpPercent: opts.enemyHpPercent })
}

function startFight(content: Content, state: DelveState, rng: Rng, kind: FightKind, ambush: AmbushSpec | null = null): void {
  const t = content.tuning
  const dungeon = dungeonOf(content, state)
  const fd = floorDef(dungeon, state.floor.number)
  const zone = zoneOf(dungeon, state.floor.number)
  const rs = currentRoom(state)
  const partySize = state.heroes.length
  const enemyHp = state.knobs.enemyHpPercent ?? 100
  const enemyCount = state.knobs.enemyCountPercent ?? 100
  let monsters: Actor[] = []
  let ambushMod = 0
  let isMonsterRoom = false
  let arenaSetup: ArenaSetup | undefined
  const named = ambush ? spawnAmbush(content, state, rng, ambush, { level: fd.monsterLevel, partySize, enemyHpPercent: enemyHp, enemyCountPercent: enemyCount }) : null
  if (named) {
    monsters = named
    ambushMod = Math.max(0, ...monsters.map((m) => content.monsters.get(m.monster?.monsterId ?? '')?.ambushModifier ?? 0))
  } else if (kind === 'boss') {
    const boss = fd.bossId ? content.monsters.get(fd.bossId) : undefined
    if (!boss) throw new Error(`floor ${fd.floor} names no boss`)
    monsters = spawnBossFight(content, t, boss, { level: fd.monsterLevel, partySize, enemyHpPercent: enemyHp })
    state.stats.bossFights += 1
    // The arena (07 §2.8): the room sets the light; the hunters killed this delve stay dead.
    arenaSetup = { bossActorId: monsters[0]?.id ?? boss.id, templateId: graphRoom(state, rs.roomId).templateId ?? null, light: fd.lightAtArena ?? null, huntersKilled: huntersKilledThisDelve(state), partySize, enemyHpPercent: enemyHp }
  } else if (kind === 'hunter') {
    const def = state.floor.hunter ? content.monsters.get(state.floor.hunter.monsterId) : undefined
    if (!def) throw new Error('no hunter')
    monsters = [spawnSingle(content, t, def, { id: def.id, level: fd.monsterLevel, partySize, enemyHpPercent: enemyHp })]
    // Pact: Twin Hunter — both hunters in this room fight together (07 §6.2).
    if (huntersHere(state, rs.roomId).length > 1) monsters.push(spawnSingle(content, t, def, { id: `${def.id}-twin`, level: fd.monsterLevel, partySize, enemyHpPercent: enemyHp }))
  } else {
    const encounter = (kind === 'fight' || kind === 'elite') && rs.encounterId ? content.encounters.get(rs.encounterId) : pickEncounter(content, rng, fd, dungeon.id, state.floor.lastEncounterId, 1, false)
    if (!encounter) {
      rs.cleared = true
      return
    }
    isMonsterRoom = isMonsterEncounter(content, encounter)
    monsters = spawnEncounter(content, t, rng, encounter, { level: fd.monsterLevel, partySize, enemyHpPercent: enemyHp, enemyCountPercent: enemyCount, championAffixIds: kind === 'elite' ? rs.championAffixIds : [] })
    ambushMod = Math.max(encounter.ambushModifier, ...monsters.map((m) => content.monsters.get(m.monster?.monsterId ?? '')?.ambushModifier ?? 0))
    state.floor.lastEncounterId = encounter.id
    if (kind === 'elite') state.stats.eliteFights += 1
  }
  state.stats.fights += 1
  // Heroes and pets.
  const heroes: Actor[] = []
  const pets: Actor[] = []
  state.heroes.forEach((h, i) => {
    if (h.fallen) return
    const row: 'front' | 'back' = ['warden', 'blade', 'shade', 'beast-tamer'].includes(h.record.classId) ? 'front' : 'back'
    const actor = buildHeroActor(content, t, h.record, { id: `hero-${i}`, row, hpPercent: Math.max(1, h.hpPercent), poolPercent: h.poolPercent, floorUses: floorUsesFor(h, state.floor.number) })
    // Arrows (08 §4, D-099): the fight counts the quiver of the bow or crossbow in hand (sim/src/ammo.ts).
    if (actor.hero) actor.hero.ammo = fightAmmoFor(content, t, h.record)
    heroes.push(actor)
    if (h.record.petInstance) pets.push(buildPetActor(content, t, h.record.petInstance, { id: `pet-${i}`, ownerId: `hero-${i}`, ownerLevel: h.record.level, hpPercent: h.petHpPercent }))
  })
  if (heroes.length === 0) return
  // 03 §9, 06 §9: the pets' party-wide trait lines at their ranks (a Bone Pup's +5% Resistance; sim/src/pets.ts).
  applyPetTraitAuras(content, t, [...heroes, ...pets], state.heroes.flatMap((h) => (!h.fallen && h.record.petInstance ? [{ inst: h.record.petInstance }] : [])))
  // Surprise (03 §4.4): not for bosses and hunters (07 §2.8–§2.9); a curio's or trap's "ambush" is certain (07 §2.4).
  // The lesson's first fight opens even when its block says so (D-038; tutorial.ts): no roll either way.
  const calmLesson = kind === 'fight' && tutorialFor(dungeon, state.options, state.floor.number)?.surprise === false
  let surprised: 'party' | 'enemy' | null = null
  if (ambush?.surprise) {
    surprised = 'party'
    state.stats.ambushedParty += 1
    state.ruleFlags = state.ruleFlags.filter((f) => f !== 'next-fight-ambush')
    state.floor.ambushPercent = 0
  } else if (kind !== 'boss' && kind !== 'hunter' && !calmLesson) {
    const flagged = state.ruleFlags.includes('next-fight-ambush')
    // Pact: Loud Boots — the party is ambushed `ambushBonusPercent` more often (07 §6.2); Trailblaze's corridor shift (D-099).
    // fix: the heroes' passives (Ambush Sense) shift the roll as the pets' traits do; Tier IV: Dawn Vigil brightens the band it reads.
    const heroAmbush = heroAmbushParts(content, state)
    const extra = (flagged ? state.floor.ambushPercent || 30 : 0) + (state.knobs.ambushBonusPercent ?? 0) + (state.floor.ambushShiftHere ?? 0) + petAmbushModifier(content, state) + heroAmbush.cut
    state.ruleFlags = state.ruleFlags.filter((f) => f !== 'next-fight-ambush')
    state.floor.ambushPercent = 0
    const bestPer = bestOf(content, t, state, (h) => h.record.attributes.perception)
    const orcs = state.heroes.filter((h) => h.record.speciesId === 'orc').length
    const shades = state.heroes.filter((h) => h.record.classId === 'shade').length
    const heroChance = heroAmbushChance(t, { light: state.light, darkvisionShift: darkvisionShift(content, state) - heroAmbush.lightShift, bestPerception: bestPer, monsterModifier: ambushMod, orcsInParty: orcs, shadesInParty: shades, extra })
    if (rng.pct(heroChance)) {
      surprised = 'party'
      state.stats.ambushedParty += 1
    } else if (!state.ruleFlags.includes('loud-boots')) {
      const lowestSpeed = Math.min(...heroes.map((h) => h.base.speed))
      if (rng.pct(monsterAmbushChance(t, state.light, bestPer, lowestSpeed))) {
        surprised = 'enemy'
        state.stats.ambushedMonsters += 1
      }
    }
  }
  const fight = createFight(content, t, {
    heroes,
    pets,
    monsters,
    surprised,
    light: state.light,
    options: { dungeonId: dungeon.id, floor: state.floor.number, floorLevel: fd.monsterLevel, autoHeroes: state.options.auto, enemyDamagePercent: roundHalfUp(((state.knobs.enemyDamagePercent ?? 100) * partyScale(t, state.heroes.filter((h) => !h.fallen).length, kind === 'boss').damagePercent) / 100), enemySpeedPercent: state.knobs.enemySpeedPercent ?? 100, partyGold: state.gold, torchValue: state.knobs.torchValue ?? t.exploration.light.torch },
    rng: rng.fork(`fight-${state.stats.fights}`),
    ...(arenaSetup ? { arena: arenaSetup } : {}),
  })
  applyPendingStatuses(content, state, fight)
  state.fight = fight
  state.fightContext = { roomId: rs.roomId, kind, isMonsterRoom }
  state.phase = { kind: 'fight' }
  logEvent(state, 'fightStart', `${kind} fight: ${monsters.map((m) => m.name).join(', ')}${surprised ? ` (${surprised} surprised)` : ''}`, { kind, monsters: monsters.length, surprised })
  void zone
  continueFight(content, state, rng)
}

/** The party actors an out-of-combat line's target word names (heroes and pets). */
function partyTargets(fight: FightState, target: Target): Actor[] {
  const party = fight.actors.filter((a) => a.side === 'party' && !a.fallen && a.hp > 0)
  const heroes = party.filter((a) => a.kind === 'hero')
  switch (target) {
    case 'allAllies':
      return party
    case 'partyFront':
      return party.filter((a) => a.row === 'front')
    case 'partyBack':
      return party.filter((a) => a.row === 'back')
    case 'pet':
      return party.filter((a) => a.kind === 'pet')
    case 'allyLowest': {
      let low: Actor | null = null
      for (const a of heroes) if (!low || a.hp * low.maxHp < low.hp * a.maxHp) low = a
      return low ? [low] : []
    }
    case 'self':
    case 'ally':
      return heroes[0] ? [heroes[0]] : []
    default:
      return heroes
  }
}

/**
 * Statuses the delve owes the party land right after the fight is created (07 §2.4–§2.6: a Larder's Regen "at the
 * start of the next 2 fights", a Tar Pot's Burn, a shrine's Curse "for the rest of the floor", a blessing). Rolls
 * draw from the fight's own stream so a replay agrees; counted entries tick down and leave at 0.
 */
function applyPendingStatuses(content: Content, state: DelveState, fight: FightState): void {
  if (state.pendingStatuses.length === 0) return
  const t = content.tuning
  const r = new Rng(fight.rng)
  for (const p of state.pendingStatuses) {
    // One hero (a trap's victim, a curio's reader), or the party actors the target names; the Tide Gate's wading takes the monsters too (C1).
    const party = p.heroIndex !== undefined ? fight.actors.filter((a) => a.id === `hero-${p.heroIndex}` && !a.fallen && a.hp > 0) : partyTargets(fight, p.target)
    const targets = p.bothSides ? [...party, ...fight.actors.filter((a) => a.side !== 'party' && !a.gone && a.hp > 0)] : party
    for (const a of targets) {
      if (p.kind === 'resist') {
        if (p.status) installHook(a, { kind: 'custom', customId: 'status-resist-bonus', status: p.status, percent: p.percent ?? 100 }, p.sourceId)
        continue
      }
      if (p.kind === 'hook') {
        if (p.line) installHook(a, p.line, p.sourceId)
        continue
      }
      if (p.kind === 'modifier') {
        if (p.stat) a.modifiers.push({ stat: p.stat, amount: p.amount ?? 0, percent: p.percent ?? 0, turnsLeft: 999, sourceId: p.sourceId })
        continue
      }
      if (!p.status) continue
      const magnitude = p.maxHpPercent !== undefined ? roundHalfUp((a.maxHp * p.maxHpPercent) / 100) : p.magnitude
      const out = applyStatus(content, t, r, a, { status: p.status, duration: p.duration, magnitude, sourceId: p.sourceId })
      if (out.outcome === 'applied') fight.log.push({ tick: 0, round: 1, kind: 'status', targetId: a.id, text: `${a.name} is ${out.status} (${p.sourceId})`, data: { status: out.status } })
    }
    if (p.fightsLeft !== null) p.fightsLeft -= 1
  }
  state.pendingStatuses = state.pendingStatuses.filter((p) => p.fightsLeft === null || p.fightsLeft > 0)
  fight.rng = r.state
}

/** The best single pet trait counts, not the sum: three hounds are not three times as alert (D-069). */
function petAmbushModifier(content: Content, state: DelveState): number {
  let mod = 0
  for (const h of activeHeroes(state)) {
    const inst = h.record.petInstance
    const pet = inst ? content.pets.get(inst.petId) : undefined
    // 03 §9: the trait's number grows with its rank (sim/src/pets.ts).
    for (const line of pet?.trait.effects ?? []) if (inst && line.kind === 'custom' && line.customId === 'party-ambush-modifier') mod = Math.min(mod, petTraitLineAmount(content.tuning, inst, line.amount ?? 0))
  }
  return mod
}

function continueFight(content: Content, state: DelveState, rng: Rng): void {
  const fight = state.fight
  if (!fight) return
  if (state.options.auto) runFightAuto(content, content.tuning, fight)
  else runFight(content, content.tuning, fight)
  if (fight.over) finishFight(content, state, rng)
}

function finishFight(content: Content, state: DelveState, rng: Rng): void {
  const t = content.tuning
  const fight = state.fight
  const ctxF = state.fightContext
  if (!fight || !ctxF || !fight.over) return
  // The codex (Phase 8, pass B; codex.ts): who stood on the enemy side, who fell, their attacks and tells. The log is not hashed.
  logEvent(state, 'codex', 'codex', codexEventData(fight))
  const rs = state.floor.rooms[ctxF.roomId]!
  state.floor.clock += fight.round * t.exploration.floorClock.tickPerFightRound
  ;(state.stats.roundsByKind[ctxF.kind] ??= []).push(fight.round)
  for (const e of fight.log) if (e.kind === 'hookStub') state.stats.hookStubs[e.text.split(':')[0] ?? 'hook'] = (state.stats.hookStubs[e.text.split(':')[0] ?? 'hook'] ?? 0) + 1
  state.stats.downs += fight.counters.heroDowns
  const heroIds = state.heroes.map((_, i) => `hero-${i}`)
  const lines: string[] = []
  const outcome = fight.over.outcome
  if (ctxF.kind === 'boss') recordBossArena(content, state, fight)
  // A Cutpurse's take (06 §3.1): what the bandits still hold when the fight ends is gone; a dead one dropped its share back (counters.goldStolen is the net).
  const stolen = outcome === 'defeat' ? 0 : Math.min(state.gold, Math.max(0, fight.counters.goldStolen))
  if (stolen > 0) {
    state.gold -= stolen
    state.stats.goldLost += stolen
    lines.push(`−${stolen} gold stolen`)
  }
  if (outcome === 'victory') {
    rs.cleared = true
    if (rs.kind === 'keyRoom' || graphRoom(state, rs.roomId).hasKey) {
      if (!state.floor.hasKey) logEvent(state, 'key', 'The party finds the key')
      state.floor.hasKey = true
    }
    if (ctxF.kind === 'boss') {
      state.floor.bossDefeated = true
      // 06 §3, 08 §11: every kill's lines, and the first kill's on top.
      lines.push(...payBossRewards(content, state, rng, fight))
    }
    if (ctxF.kind === 'hunter' && state.floor.hunter) {
      // Pact: Twin Hunter — every hunter standing in the room falls with the fight (without the Pact, the floor's one).
      const here = huntersHere(state, ctxF.roomId)
      for (const h of here.length ? here : [state.floor.hunter]) {
        h.killed = true
        state.stats.hunterKilled += 1
      }
    }
    // 07 §2.8–§2.9: every hunter killed this delve (on its clock or at the Leech Jar) sits out the Hollow King's last phase.
    for (const a of fight.actors) {
      const def = a.monster && a.gone && !a.fled ? content.monsters.get(a.monster.monsterId) : undefined
      if (def?.hunter && !(state.huntersKilled ?? []).includes(def.id)) state.huntersKilled = [...(state.huntersKilled ?? []), def.id]
    }
    const dungeon = dungeonOf(content, state)
    const killed: FightMonster[] = []
    for (const a of fight.actors) {
      const m = a.monster
      if (!m || !a.gone || a.fled) continue
      const def = content.monsters.get(m.monsterId)
      if (!def) continue
      killed.push({ def, level: a.level, champion: m.champion !== null, eliteAffixIds: m.champion?.affixIds ?? [], partBroken: m.partBroken })
    }
    // Contracts (07 §7): what fell in this fight and how many heroes fell with it, for the Quest Board at home (sim/src/contracts.ts).
    logEvent(state, 'kills', `${killed.length} slain`, { monsters: killed.map((k) => k.def.id).join(','), fallen: fight.actors.filter((a) => a.kind === 'hero' && a.fallen).length })
    // Gold found: the preset knob × the pacts × (a paid Toll Shrine's floor bonus + the party's "of Greed" lines) (07 §2.4, 08 §5).
    const foundPct = 100 + state.floor.goldPercentBonus + partyAffixPercent(content, t, state, 'gold-found-percent') + partyPetTraitBonus(content, partyPets(state), 'goldPercent')
    const goldPercent = roundHalfUp(((state.knobs.goldPercent ?? 100) * (1 + state.pactReward.goldPercent / 100) * foundPct) / 100)
    // Phase 8 (Proposed): the pack's party-size count scale is undone in its gold (loot.ts fightGold) — the size it was spawned for.
    const loot = rollFightLoot(content, t, rng, { dungeonId: dungeon.id, floor: state.floor.number, monsters: killed, lightBand: lightBand(t, state.light).id as 'radiant', luck: partyLuck(content, t, state), knobs: { goldPercent }, isMonsterRoom: ctxF.isMonsterRoom, partySize: state.heroes.length })
    state.gold += loot.gold
    state.stats.goldFound += loot.gold
    giveItems(state, loot.items)
    state.lastFightDrop = loot.items.length > 0 ? { pileIndex: state.pile.length - loot.items.length } : null
    for (const c of loot.consumables) giveConsumable(content, state, c)
    for (const s of loot.stones) giveConsumable(content, state, s)
    const parts = [...loot.parts]
    // A Rat Prince's Scavenge (pet-extra-part-roll): more part rolls over the fight's kills.
    for (let k = 0; k < Number(fight.flags.extraPartRolls ?? 0); k++) parts.push(...rollParts(t, rng, killed))
    // The Shade's Light Fingers and Pickpocket in the fight (steal-part, steal-boss-part): the filched parts come home.
    for (const e of fight.log) {
      if (e.kind !== 'partStolen') continue
      const id = String(e.data?.itemId ?? e.data?.materialId ?? '')
      if (id) parts.push({ itemId: id, quantity: Number(e.data?.quantity ?? 1), rare: Boolean(e.data?.rare) })
    }
    for (const p of parts) {
      state.materials[p.itemId] = (state.materials[p.itemId] ?? 0) + p.quantity
      state.stats.partsFound += p.quantity
    }
    // Gold the Shade lifted from the monsters (steal-gold-per-level).
    const lifted = Math.max(0, Number(fight.flags.goldStolenByHeroes ?? 0))
    if (lifted > 0) {
      state.gold += lifted
      state.stats.goldFound += lifted
      lines.push(`+${lifted} gold lifted`)
    }
    // Pact: Every Door Locked (07 §6.2).
    if (loot.hunterChest) rs.chests.push(lockForPact(state.knobs, rng, loot.hunterChest))
    lines.push(`+${loot.gold} gold`, ...(loot.items.length ? [`${loot.items.length} item(s)`] : []), ...(parts.length ? [`${parts.reduce((s, p) => s + p.quantity, 0)} part(s)`] : []))
    // Growth and wear.
    const reports = applyFightProgress(content, t, rng, state, fight, heroIds)
    for (const r of reports) {
      const h = state.heroes[r.heroIndex]!
      const bits = [...Object.entries(r.skillRanks).map(([k, v]) => `${k} +${v} rank`), ...Object.entries(r.attributes).map(([k, v]) => `+${v} ${k}`), ...r.insights.map((s) => `Insight: ${s}`), ...(r.levelsGained ? [`level ${h.record.level}`] : [])]
      if (bits.length) lines.push(`${h.record.name}: ${bits.join(', ')}`)
    }
    state.stats.xpEvents += fight.xp.length
    // HP and revives (03 §12.1).
    state.heroes.forEach((h, i) => {
      const a = fight.actors.find((x) => x.id === heroIds[i])
      if (!a) return
      carryHeroState(h, a)
      if (a.fallen) {
        state.stats.falls += 1
        if (isMortal(state)) {
          // D-088: past the revive window the hero is dead; the living carry the body (a healer may raise it, D-089).
          h.fallen = true
          h.downed = false
          h.hpPercent = 0
          lines.push(`${h.record.name} has died. The party carries the body.`)
        } else if (state.floor.revivesLeft > 0) {
          state.floor.revivesLeft -= 1
          h.fallen = false
          h.downed = false
          h.hpPercent = t.death.postFightReviveHpPercent
          lines.push(`${h.record.name} is back up (${state.floor.revivesLeft} revives left this floor)`)
        } else lines.push(`${h.record.name} stays down`)
      } else if (a.downed) {
        h.downed = false
        h.hpPercent = t.death.postFightReviveHpPercent
      }
      const pet = fight.actors.find((x) => x.id === `pet-${i}`)
      if (pet) h.petHpPercent = pet.downed || pet.hp <= 0 ? t.pets.downedReturnHpPercent : Math.max(1, Math.floor((pet.hp * 100) / Math.max(1, pet.maxHp)))
      // 03 §9: the pet's trait grows by use — its hits, the hits it took, its turns (sim/src/pets.ts).
      if (pet && h.record.petInstance) h.record = { ...h.record, petInstance: growPetTraitFromFight(content, t, h.record.petInstance, pet) }
    })
    state.phase = { kind: 'result', title: 'Victory', lines }
    // 03 §12.2: every hero down is a wipe, even when a pet finished the fight (nobody is left to carry anyone or walk on).
    if (state.heroes.every((h) => h.fallen)) {
      state.stats.wipes += 1
      state.stats.goldLost += state.gold
      for (const h of state.heroes) wipeDurability(content, h)
      state.gold = 0
      state.phase = { kind: 'over', outcome: 'wiped', summary: `Wiped on floor ${state.floor.number}: every hero fell` }
    }
  } else if (outcome === 'defeat') {
    state.stats.wipes += 1
    state.stats.falls += state.heroes.filter((h) => !h.fallen).length
    state.stats.goldLost += state.gold
    for (const h of state.heroes) {
      carryHeroState(h, fight.actors.find((x) => x.id === `hero-${state.heroes.indexOf(h)}`) ?? ({ hp: 0, maxHp: 1, pool: 0, poolMax: 1, downed: false, fallen: true, hero: undefined } as unknown as Actor))
      h.fallen = true
      wipeDurability(content, h)
    }
    state.gold = 0
    state.phase = { kind: 'over', outcome: 'wiped', summary: `Wiped on floor ${state.floor.number}` }
  } else {
    // Fled or capped: the party backs out; the room stays as it was.
    state.stats.fled += 1
    state.heroes.forEach((h, i) => {
      const a = fight.actors.find((x) => x.id === heroIds[i])
      if (a) carryHeroState(h, a)
      if (h.downed) {
        h.downed = false
        h.hpPercent = Math.max(h.hpPercent, 10)
      }
    })
    state.phase = { kind: 'result', title: outcome === 'fled' ? 'Fled' : 'The fight dragged on', lines: ['The party backs out of the room.'] }
    const back = [...state.floor.graph.rooms].reverse().find((r) => r.id !== rs.roomId && state.floor.rooms[r.id]?.visited)
    if (back) state.floor.currentRoomId = back.id
  }
  state.fight = null
  state.fightContext = null
  for (const h of state.heroes) h.downed = false
  // D-095: under Nightmare the chosen hero's death ends the delve at once (a wipe already has; the save ends with it).
  const leader = deadLeader(state)
  if (leader && state.phase.kind !== 'over') {
    state.phase = { kind: 'over', outcome: 'chosenDied', summary: `${leader.record.name} died on floor ${state.floor.number}. The Nightmare ends.` }
  }
}

function wipeDurability(content: Content, h: DelveHero): void {
  const t = content.tuning
  const eq = h.record.equipment
  const penalty = t.equipment.durability.wipePenalty * 100
  const wear = (inst: ItemInstance | null) => (inst ? applyWearBp(t, inst, penalty).inst : null)
  h.record = {
    ...h.record,
    equipment: { ...eq, mainHand: wear(eq.mainHand), offHand: wear(eq.offHand), helmet: wear(eq.helmet), chest: wear(eq.chest), legs: wear(eq.legs), boots: wear(eq.boots), gloves: wear(eq.gloves), ring: [wear(eq.ring[0]), wear(eq.ring[1])], talisman: wear(eq.talisman), relic: wear(eq.relic) },
  }
}

/* ---------- curios ---------- */

function requirementMet(content: Content, state: DelveState, r: Requirement): boolean {
  switch (r.kind) {
    case 'item':
      // A safe item may be a material or a part the delve carries (the Grave Bell's Cloth unit, the Tide Altar's Brine Pearl; C1).
      return state.heroes.some((h) => h.record.bag.some((b) => b.itemId === r.id && b.quantity >= (r.amount ?? 1))) || (state.materials[r.id ?? ''] ?? 0) >= (r.amount ?? 1)
    case 'fieldSkillRank':
      return state.heroes.some((h) => (h.record.fieldSkills[r.id as keyof typeof h.record.fieldSkills]?.rank ?? 0) >= (r.min ?? 1))
    case 'attribute':
      return state.heroes.some((h) => (h.record.attributes[r.id as keyof typeof h.record.attributes] ?? 0) >= (r.min ?? 0))
    case 'detection':
      return partyDetection(content, content.tuning, state) >= (r.min ?? 0)
    case 'gold':
      return state.gold >= goldFor(r.amount ?? 0, rForFloor(state.floor.number))
    case 'light':
      return state.light >= (r.min ?? 0)
    case 'classId':
      return state.heroes.some((h) => h.record.classId === r.id)
    case 'speciesId':
      return state.heroes.some((h) => h.record.speciesId === r.id)
  }
}

function consumeRequirement(state: DelveState, r: Requirement): void {
  if (r.kind === 'item' && (r.consumed ?? true)) {
    for (const h of state.heroes) {
      const i = h.record.bag.findIndex((b) => b.itemId === r.id)
      if (i < 0) continue
      const bag = [...h.record.bag]
      const b = bag[i]!
      if (b.quantity > (r.amount ?? 1)) bag[i] = { ...b, quantity: b.quantity - (r.amount ?? 1) }
      else bag.splice(i, 1)
      h.record = { ...h.record, bag }
      return
    }
    // Else from the delve's materials and parts (C1).
    const id = r.id ?? ''
    if ((state.materials[id] ?? 0) > 0) state.materials[id] = Math.max(0, (state.materials[id] ?? 0) - (r.amount ?? 1))
  }
  if (r.kind === 'gold') state.gold = Math.max(0, state.gold - goldFor(r.amount ?? 0, rForFloor(state.floor.number)))
}

function resolveCurio(content: Content, state: DelveState, rng: Rng, curio: CurioDef, choiceIndex: number): void {
  const t = content.tuning
  const choice = curio.choices[choiceIndex]
  if (!choice) throw new Error('no such choice')
  for (const r of choice.requires) if (!requirementMet(content, state, r)) throw new Error(`requirement not met: ${r.kind}`)
  for (const r of choice.requires) consumeRequirement(state, r)
  const rs = currentRoom(state)
  rs.curioUsed = true
  state.stats.curiosUsed += 1
  state.phase = { kind: 'room' }
  if (choice.outcomes.length === 0) {
    logEvent(state, 'curio', `${curio.name}: ${choice.label}`, { curio: curio.id, choice: choiceIndex, outcome: 'nothing' })
    return
  }
  const outcome = rng.weighted(choice.outcomes, (o) => o.chance)
  const line = outcome.effect
  // The line falls on the party's first standing hero (the one who opens, digs or eats first).
  const victim = activeHeroes(state)[0] ?? null
  const r = resolveDelveLine(content, state, rng, line, { kind: 'curio', id: curio.id, percent: 100, victim })
  // An outcome's further lines, in order (07 §2.4's "0.06 R and the floor's hunter clock +10"; C1).
  const texts = [r.text]
  let ambush = r.ambush
  for (const more of outcome.also ?? []) {
    const m = resolveDelveLine(content, state, rng, more, { kind: 'curio', id: curio.id, percent: 100, victim })
    texts.push(m.text)
    ambush ??= m.ambush
  }
  logEvent(state, 'curio', `${curio.name}: ${choice.label} → ${texts.join('; ')}`, { curio: curio.id, choice: choiceIndex, outcome: line.kind === 'custom' ? (line.customId ?? 'custom') : line.kind })
  if (ambush) startFight(content, state, rng, ambush.asHunter ? 'hunter' : 'curio', ambush)
  // Standing at the curio springs a trap that waits for it (07 §2.5: the Sentinel Eye, the Coffin Catapult).
  else springTraps(content, state, rng, rs, 'open')
  void t
}

/* ---------- legal actions ---------- */

function hasKeyItem(state: DelveState): boolean {
  return state.heroes.some((h) => h.record.bag.some((b) => /skeleton-key|lockpick/.test(b.itemId)))
}

export function legalDelveActions(content: Content, state: DelveState): LegalDelveAction[] {
  const t = content.tuning
  const out: LegalDelveAction[] = []
  const phase = state.phase
  if (phase.kind === 'over') return out
  if (phase.kind === 'fight') {
    const fight = state.fight
    if (fight?.pendingActorId) {
      for (const a of legalFightActions(content, t, fight)) out.push({ command: { kind: 'fight', command: a.command }, label: a.label, enabled: a.enabled, reason: a.reason })
    }
    return out
  }
  if (phase.kind === 'result') return [{ command: { kind: 'continue' }, label: 'Continue', enabled: true }, ...hollowCoinActions(content, state)]
  if (phase.kind === 'curio') {
    const dungeon = dungeonOf(content, state)
    const curio = dungeon.curios.find((c) => c.id === phase.curioId)
    if (!curio) return [{ command: { kind: 'continue' }, label: 'Continue', enabled: true }]
    curio.choices.forEach((choice, i) => {
      const unmet = choice.requires.filter((r) => !requirementMet(content, state, r))
      const safe = curio.safeItemId !== null && choice.requires.length === 1 && choice.requires[0]?.kind === 'item' && choice.requires[0].id === curio.safeItemId
      const leave = choice.outcomes.length === 0
      out.push({ command: { kind: 'curio', choice: i }, label: `${choice.label}${safe ? ' (safe)' : leave ? ' (leave)' : ''}`, enabled: unmet.length === 0, reason: unmet.length ? `needs ${unmet.map((r) => `${r.kind}${r.id ? ` ${r.id}` : ''}${r.min ? ` ${r.min}` : ''}`).join(', ')}` : undefined })
    })
    return out
  }
  // Room.
  const dungeon = dungeonOf(content, state)
  const g = graphRoom(state, state.floor.currentRoomId)
  const rs = currentRoom(state)
  // Only a revealed trap shuts its door (07 §2.5); an unrevealed one fires when the door is opened (springTraps; C1).
  const blockingTrap = rs.traps.find((tr) => tr.blocksDoorTo && tr.revealed && !tr.disarmed && !tr.triggered)
  for (const d of g.doors) {
    // A secret door, once found, works both ways: from the room it was spotted in, and back out of the secret room.
    if (d.secret && !secretDoorKnown(state, rs.roomId, d.to)) continue
    const target = state.floor.rooms[d.to]
    const label = `Door → ${target?.scouted || target?.visited ? target.kind : '?'} ${d.to}${d.locked ? ' (locked)' : ''}${d.secret ? ' (secret)' : ''}`
    let reason: string | undefined
    if (d.locked && !state.floor.hasKey) reason = 'locked: find the key'
    if (blockingTrap && blockingTrap.blocksDoorTo === d.to) reason = 'a trap blocks this door'
    const threat = roomThreat(content, state, d.to)
    out.push({ command: { kind: 'move', toRoomId: d.to }, label: threat ? `${label} [${threat.band}]` : label, enabled: !reason, reason, ...(threat ? { threat } : {}) })
  }
  // A secret's crawlway to the exit (07 §2.6 the Company's Bolt-hole): a free move from the secret room, 0 ticks.
  if (state.floor.shortcutTo && rs.roomId === state.floor.graph.secretId && state.floor.shortcutTo !== rs.roomId) {
    out.push({ command: { kind: 'move', toRoomId: state.floor.shortcutTo }, label: `Crawlway → ${state.floor.rooms[state.floor.shortcutTo]?.kind ?? 'stairs'} ${state.floor.shortcutTo} (0 ticks)`, enabled: true })
  }
  rs.traps.forEach((tr, i) => {
    if (!tr.revealed || tr.disarmed || tr.triggered) return
    const def = dungeon.traps.find((x) => x.id === tr.trapId)
    state.heroes.forEach((h, hi) => {
      if (h.fallen) return
      out.push({ command: { kind: 'disarm', trapIndex: i, heroIndex: hi }, label: `Disarm ${def?.name ?? tr.trapId} (${h.record.name}, ${disarmChance(t, disarmRank(content, t, h), def?.difficulty ?? 10)}%)`, enabled: true })
    })
    if (tr.blocksDoorTo) out.push({ command: { kind: 'walkAround', trapIndex: i }, label: `Set off ${def?.name ?? tr.trapId}`, enabled: true })
  })
  if (rs.goldPiles.length) out.push({ command: { kind: 'takeGold' }, label: `Take ${rs.goldPiles.reduce((s, x) => s + x, 0)} gold`, enabled: true })
  rs.chests.forEach((c, i) => {
    if (c.opened) return
    const key = hasKeyItem(state)
    const label = `Open ${c.size} chest${c.locked ? ' (locked)' : ''}${c.trapped ? ' (trapped)' : ''}`
    out.push({ command: { kind: 'openChest', chestIndex: i, useKey: false, heroIndex: 0 }, label, enabled: !c.locked || state.heroes.some((h) => h.record.fieldSkills.lockpicking.rank >= 1), reason: c.locked ? 'locked' : undefined })
    if (key) out.push({ command: { kind: 'openChest', chestIndex: i, useKey: true, heroIndex: 0 }, label: `${label} with a key`, enabled: true })
  })
  if (g.kind === 'rest' && !rs.restUsed) out.push({ command: { kind: 'rest' }, label: 'Rest (+30% HP and pool, clock +5)', enabled: true })
  state.heroes.forEach((h, hi) => {
    if (h.fallen) return
    for (const b of h.record.bag) {
      const def = content.items.get(b.itemId)
      if (!def?.consumable || def.consumable.inCombat === undefined) continue
      const usable = /torch|potion|draught|repair|bandage|ration|treat/i.test(def.name)
      if (!usable) continue
      out.push({ command: { kind: 'useItem', heroIndex: hi, instanceId: b.instanceId }, label: `Use ${def.name} ×${b.quantity} (${h.record.name})`, enabled: true })
    }
    if (h.record.fieldSkills.firstAid.rank >= 1) {
      state.heroes.forEach((target, ti) => {
        if ((target.fallen && !isMortal(state)) || target.downed) out.push({ command: { kind: 'firstAid', heroIndex: hi, targetIndex: ti }, label: `First Aid on ${target.record.name} (${h.record.name})`, enabled: g.kind === 'rest' || state.floor.revivesLeft > 0, reason: state.floor.revivesLeft > 0 ? undefined : 'no revives left this floor' })
      })
    }
    if (h.record.petInstance) {
      for (const s of ['fierce', 'guard', 'mend', 'forage'] as const) if (s !== h.record.petInstance.stance) out.push({ command: { kind: 'stance', heroIndex: hi, stance: s }, label: `${h.record.petInstance.name}: ${s} stance`, enabled: true })
    }
  })
  // D-089: a healer of the raise level raises one of the dead the party carries (Mortal only).
  if (isMortal(state)) {
    const r = t.death.raise
    state.heroes.forEach((healer, hi) => {
      if (!canRaise(content, healer)) return
      state.heroes.forEach((target, ti) => {
        if (!target.fallen) return
        const used = state.floor.raisesUsed[String(hi)] ?? 0
        const reason = used >= r.perHealerPerFloor ? `${healer.record.name} has raised someone on this floor already` : healer.poolPercent < r.healerPoolPercent ? `${healer.record.name} needs ${r.healerPoolPercent}% of their pool` : undefined
        out.push({ command: { kind: 'raise', heroIndex: hi, targetIndex: ti }, label: `Raise ${target.record.name} (${healer.record.name}; ${target.record.name} loses ${r.levelLoss} level${r.levelLoss === 1 ? '' : 's'})`, enabled: !reason, reason })
      })
    })
  }
  rs.merchant?.forEach((o, i) => {
    if (o.soldOut) return
    const def = content.items.get(o.itemId)
    out.push({ command: { kind: 'buy', offerIndex: i }, label: `Buy ${def?.name ?? o.itemId} (${o.price} gold)`, enabled: state.gold >= o.price, reason: state.gold < o.price ? 'not enough gold' : undefined })
  })
  // Dunmore buys parts (07 §2.7; Pedlar's Friend counts them, 07 §7): each material the delve found, all of it.
  if (rs.merchant) for (const offer of partSales(content, state)) out.push({ command: { kind: 'sell', itemId: offer.itemId, quantity: offer.quantity }, label: `Sell ${offer.quantity} ${offer.name} (${offer.gold} gold)`, enabled: true })
  // D-099: corridor skills — their pool, no turn, no floor-clock tick (sim/src/corridor.ts).
  state.heroes.forEach((h, hi) => {
    for (const c of corridorChoices(content, state, hi)) out.push({ command: { kind: 'corridorSkill', heroIndex: hi, skillId: c.skill.id }, label: `${c.skill.name} (${h.record.name}, ${c.cost.points} ${c.cost.pool})`, enabled: c.reason === null, ...(c.reason ? { reason: c.reason } : {}) })
  })
  const atExit = state.floor.currentRoomId === state.floor.graph.exitId
  if (atExit && (g.kind === 'stairs' || (g.kind === 'boss' && rs.cleared))) out.push({ command: { kind: 'descend' }, label: state.floor.number >= (state.options.lastFloor ?? 99) ? 'Finish the delve' : 'Take the stairs', enabled: true })
  // D-083 (James): the party leaves by walking back out of a floor's entrance or by teleporting out at the floor's end
  // (the stairs, or a beaten boss's room). Both keep everything; a Pact's toll knob still applies.
  const atEntry = state.floor.currentRoomId === state.floor.graph.entryId
  const atFloorEnd = atExit && (g.kind === 'stairs' || (g.kind === 'boss' && rs.cleared))
  // Pact: Iron Oath — no retreat; the zone's end is the only way out (07 §6.2).
  if ((atEntry || atFloorEnd) && !state.ruleFlags.includes('no-retreat')) {
    const toll = state.floor.bossDefeated ? 0 : (state.knobs.retreatTollPercent ?? t.death.retreatTollPercent)
    out.push({ command: { kind: 'retreat' }, label: `${atFloorEnd ? 'Teleport out' : 'Walk out'} to town${toll ? ` (toll ${toll}%)` : ''}`, enabled: true })
  }
  out.push({ command: { kind: 'auto' }, label: 'Auto', enabled: true })
  return out
}

/* ---------- stepping ---------- */

export function stepDelve(content: Content, state: DelveState, command: DelveCommand): DelveState {
  if (state.phase.kind === 'over') throw new Error('the delve is over')
  const t = content.tuning
  const rng = rngOf(state)
  state.commandLog.push(command)
  const phase = state.phase
  switch (command.kind) {
    case 'auto': {
      // The policy draws from its own stream (seed + command count), never the state's: a replay of the chosen
      // commands must not need the draws that chose them (D-014).
      const actions = legalDelveActions(content, state)
      const pick = choosePolicyCommand(state.options.policy, state, actions, policyRng(state), content)
      state.commandLog.pop()
      save(state, rng)
      if (!pick || pick.kind === 'auto') return state
      return stepDelve(content, state, pick)
    }
    case 'fight': {
      if (phase.kind !== 'fight' || !state.fight) throw new Error('no fight')
      applyFightCommand(content, t, state.fight, command.command)
      if (state.fight.over) finishFight(content, state, rng)
      else if (state.options.auto) continueFight(content, state, rng)
      break
    }
    case 'continue': {
      if (phase.kind === 'result') state.phase = { kind: 'room' }
      else if (phase.kind === 'curio') state.phase = { kind: 'room' }
      break
    }
    case 'curio': {
      if (phase.kind !== 'curio') throw new Error('no curio open')
      const curio = dungeonOf(content, state).curios.find((c) => c.id === phase.curioId)
      if (!curio) throw new Error('unknown curio')
      resolveCurio(content, state, rng, curio, command.choice)
      break
    }
    case 'move': {
      if (phase.kind !== 'room') throw new Error('not in a room')
      const g = graphRoom(state, state.floor.currentRoomId)
      const rs = currentRoom(state)
      const door = g.doors.find((d) => d.to === command.toRoomId)
      // A secret's crawlway (07 §2.6): from the secret room straight to the exit, no door, no ticks, no light lost.
      const crawlway = door === undefined && state.floor.shortcutTo === command.toRoomId && rs.roomId === state.floor.graph.secretId
      if (!door && !crawlway) throw new Error('no such door')
      if (door) {
        if (door.secret && !secretDoorKnown(state, rs.roomId, door.to)) throw new Error('hidden door')
        if (door.locked && !state.floor.hasKey) throw new Error('locked')
        const blocking = rs.traps.find((tr) => tr.blocksDoorTo === door.to && tr.revealed && !tr.disarmed && !tr.triggered)
        if (blocking) throw new Error('a trap blocks the door')
      } else logEvent(state, 'crawlway', `The party takes the crawlway to ${command.toRoomId}`)
      // Crossing the room and opening the door spring what waits there (07 §2.5; C1); an ambush keeps the party here.
      springTraps(content, state, rng, rs, 'leave', door?.to ?? null)
      if (state.phase.kind !== 'room') break
      enterRoom(content, state, command.toRoomId, rng, door !== undefined)
      break
    }
    case 'disarm': {
      const rs = currentRoom(state)
      const tr = rs.traps[command.trapIndex]
      const h = state.heroes[command.heroIndex]
      const def = tr ? dungeonOf(content, state).traps.find((x) => x.id === tr.trapId) : undefined
      if (!tr || !h || !def) throw new Error('no such trap')
      const chance = disarmChance(t, disarmRank(content, t, h), def.difficulty + (state.knobs.trapDifficultyBonus ?? 0))
      if (rng.pct(chance)) {
        tr.disarmed = true
        state.stats.trapsDisarmed += 1
        for (const r of def.disarmReward) {
          if (r.chance !== undefined && !rng.pct(r.chance)) continue
          if (r.kind === 'gold') {
            state.gold += r.amount ?? 0
            state.stats.goldFound += r.amount ?? 0
          } else if ((r.kind === 'material' || r.kind === 'item') && r.id) state.materials[r.id] = (state.materials[r.id] ?? 0) + (r.amount ?? 1)
        }
        // fix (Phase 8): the XP reaches rank (progress.ts gainFieldSkillXp).
        h.record = gainFieldSkillXp(t, h.record, 'trapDisarm', 10).hero
        logEvent(state, 'disarm', `${h.record.name} disarms ${def.name} (${chance}%)`, { trap: def.id })
      } else {
        logEvent(state, 'disarmFail', `${h.record.name} fumbles ${def.name} (${chance}%)`, { trap: def.id })
        // Saboteur's Mastery (disarm-failure-safe): a holder's fumble never springs the trap.
        if (heroHookLines(content, t, h, 'disarm-failure-safe').length === 0) fireTrap(content, state, rng, def, tr, 50)
      }
      break
    }
    case 'walkAround': {
      const rs = currentRoom(state)
      const tr = rs.traps[command.trapIndex]
      const def = tr ? dungeonOf(content, state).traps.find((x) => x.id === tr.trapId) : undefined
      if (!tr || !def) throw new Error('no such trap')
      fireTrap(content, state, rng, def, tr, 100)
      break
    }
    case 'takeGold': {
      const rs = currentRoom(state)
      // Picking up the room's treasure springs a snare on it (07 §2.5 the Hag's Snare; C1).
      springTraps(content, state, rng, rs, 'loot')
      if (state.phase.kind !== 'room') break
      const gold = rs.goldPiles.reduce((s, x) => s + x, 0)
      rs.goldPiles = []
      state.gold += gold
      state.stats.goldFound += gold
      logEvent(state, 'gold', `+${gold} gold`)
      break
    }
    case 'openChest': {
      const rs = currentRoom(state)
      const chest = rs.chests[command.chestIndex]
      if (!chest || chest.opened) throw new Error('no such chest')
      // Opening a chest here springs what waits for it (07 §2.5: the Sentinel Eye, a niche, the Hag's Snare; C1).
      springTraps(content, state, rng, rs, 'open')
      if (state.phase.kind === 'room') springTraps(content, state, rng, rs, 'loot')
      if (state.phase.kind !== 'room') break
      const dungeon = dungeonOf(content, state)
      const fd = floorDef(dungeon, state.floor.number)
      const table = lootTableForFloor(content, dungeon.id, state.floor.number)
      let withKey = false
      if (command.useKey) {
        if (!hasKeyItem(state)) throw new Error('no key')
        consumeRequirement(state, { kind: 'item', id: state.heroes.flatMap((h) => h.record.bag).find((b) => /skeleton-key|lockpick/.test(b.itemId))?.itemId ?? '', amount: 1, consumed: true })
        withKey = true
      } else if (chest.locked) {
        // Light Fingers (+2) and a Vault Imp (+2) add to the best picker's rank (D-071; 06 §9).
        const rank = Math.max(...state.heroes.map((h) => h.record.fieldSkills.lockpicking.rank + heroHookAmount(content, t, h, 'lockpicking-rank-bonus'))) + partyPetTraitBonus(content, partyPets(state), 'lockpicking')
        const chance = clamp(40 + 5 * rank - (fd.trapBand.max - fd.trapBand.min), 5, 95)
        if (!rng.pct(chance)) {
          logEvent(state, 'lockFail', `The lock holds (${chance}%)`)
          break
        }
      }
      if (chest.trapped && !withKey) {
        const def = dungeon.traps.find((x) => x.id === chest.trapId) ?? dungeon.traps[0]
        if (def) fireTrap(content, state, rng, def, { triggered: false }, 100)
      }
      const fightGold = roundHalfUp((table.goldRange.min + table.goldRange.max) / 2)
      // Pact: the preset's chest shift, the Pacts' chestShiftPp rewards and the Oath's tier (07 §6; sim/src/pacts.ts).
      const shift = chestShiftFor(t, state.knobs, state.pactReward.chestShiftPp, oathOf(dungeon, state.options.pactIds ?? []))
      const loot = openDungeonChest(content, t, rng, chest, { table, centreGrade: shiftedCentre(table.gradeShape.centreGrade, shift.centreShift), luck: partyLuck(content, t, state), fightGold, withKey, shiftPp: shift.shiftPp })
      chest.opened = true
      state.stats.chestsOpened += 1
      state.gold += loot.gold
      state.stats.goldFound += loot.gold
      giveItems(state, loot.items)
      for (const c of loot.consumables) giveConsumable(content, state, c)
      if (loot.stone) giveConsumable(content, state, loot.stone)
      // The light at the opening (Dark Harvest counts chests opened in the Dark, 07 §7).
      logEvent(state, 'chest', `A ${loot.size} chest: ${loot.items.length} item(s), ${loot.gold} gold`, { light: state.light, size: loot.size })
      break
    }
    case 'rest': {
      const rs = currentRoom(state)
      if (graphRoom(state, rs.roomId).kind !== 'rest' || rs.restUsed) throw new Error('cannot rest here')
      rs.restUsed = true
      for (const h of state.heroes) {
        if (h.fallen) {
          // D-088: a rest raises nobody under Mortal.
          if (!isMortal(state)) {
            h.fallen = false
            h.hpPercent = t.death.postFightReviveHpPercent
          }
        } else h.hpPercent = Math.min(100, h.hpPercent + t.exploration.rest.restorePercent)
        h.poolPercent = Math.min(100, h.poolPercent + t.exploration.rest.restorePercent)
        if (command.treat && h.record.petInstance && !h.treatUsed) h.treatUsed = true
      }
      // Cooking (08 §4, 09 §5): a cook with the skill turns one ingredient (a `meal` consumable) into the party's meal.
      let cooked: string | null = null
      if (command.cookAttribute && state.heroes.some((h) => !h.fallen && h.record.fieldSkills.cooking.rank >= 1)) {
        const ingredientIds = new Set(ingredientDefs(content).map((d) => d.id))
        const cook = state.heroes.find((h) => h.record.bag.some((b) => ingredientIds.has(b.itemId)))
        const inst = cook?.record.bag.find((b) => ingredientIds.has(b.itemId))
        if (cook && inst) {
          consumeRequirement(state, { kind: 'item', id: inst.itemId, amount: 1, consumed: true })
          cooked = content.items.get(inst.itemId)?.name ?? inst.itemId
          for (const h of state.heroes) if (!h.fallen) h.cooked = command.cookAttribute
        }
      }
      tickClock(content, state, t.exploration.floorClock.restAdvances, rng)
      logEvent(state, 'rest', `The party rests${cooked ? ` and cooks ${cooked} (+${command.cookAttribute})` : command.cookAttribute ? ' (nothing to cook)' : ''}`)
      break
    }
    case 'fieldRepair': {
      const h = state.heroes[command.heroIndex]
      if (!h) throw new Error('no hero')
      const eq = h.record.equipment as unknown as Record<string, ItemInstance | null>
      const inst = command.slot === 'ring' ? h.record.equipment.ring[0] : eq[command.slot]
      const def = inst ? content.items.get(inst.itemId) : undefined
      if (!inst || !def) throw new Error('nothing there')
      const mat = Object.entries(state.materials).find(([id, n]) => n > 0 && content.items.get(id)?.materialLadder === def.materialLadder)
      if (!mat) throw new Error('no material')
      state.materials[mat[0]] = (state.materials[mat[0]] ?? 1) - 1
      const r = fieldRepair(t, inst)
      h.record = { ...h.record, equipment: { ...h.record.equipment, [command.slot]: r.inst } as HeroRecord['equipment'] }
      logEvent(state, 'repair', `${h.record.name} repairs ${def.name} (+${r.restored})`)
      break
    }
    case 'useItem': {
      const h = state.heroes[command.heroIndex]
      if (!h) throw new Error('no hero')
      const i = h.record.bag.findIndex((b) => b.instanceId === command.instanceId)
      const inst = h.record.bag[i]
      const def = inst ? content.items.get(inst.itemId) : undefined
      if (!inst || !def?.consumable) throw new Error('no such item')
      const name = def.name
      const texts: string[] = []
      const hasCustom = def.consumable.effects.some((e) => e.kind === 'custom')
      if (/torch/i.test(name)) {
        state.light = addLight(t, state.light, state.knobs.torchValue ?? t.exploration.light.torch)
        state.stats.torchesUsed += 1
      } else if (/repair/i.test(name) && !hasCustom) {
        const eq = h.record.equipment
        const worst = (['mainHand', 'offHand', 'helmet', 'chest', 'legs', 'boots', 'gloves'] as const).map((s) => ({ s, inst: eq[s] })).filter((x) => x.inst).sort((a, b) => a.inst!.durability - b.inst!.durability)[0]
        if (worst?.inst) h.record = { ...h.record, equipment: { ...eq, [worst.s]: repairKit(t, worst.inst).inst } }
      } else {
        for (const line of def.consumable.effects) {
          if (line.kind === 'heal' && line.percent !== undefined) h.hpPercent = Math.min(100, h.hpPercent + line.percent)
          if (line.kind === 'pool' && line.percent !== undefined) h.poolPercent = Math.min(100, h.poolPercent + line.percent)
          if (line.kind === 'light') state.light = addLight(t, state.light, line.amount ?? 0)
          // Repair Kit, Pet Treat and the like: the custom line's contract lives in sim/src/skills/custom/<id>.ts.
          if (line.kind === 'custom') texts.push(resolveDelveLine(content, state, rng, line, { kind: 'item', id: def.id, percent: 100, victim: h }).text)
        }
      }
      const bag = [...h.record.bag]
      if (inst.quantity > 1) bag[i] = { ...inst, quantity: inst.quantity - 1 }
      else bag.splice(i, 1)
      h.record = { ...h.record, bag }
      logEvent(state, 'item', `${h.record.name} uses ${name}${texts.length ? `: ${texts.join(', ')}` : ''}`)
      break
    }
    case 'raise': {
      if (state.phase.kind !== 'room') throw new Error('raise the dead between fights')
      if (!isMortal(state)) throw new Error('nobody is dead under the Sheltered rule')
      const r = t.death.raise
      const healer = state.heroes[command.heroIndex]
      const target = state.heroes[command.targetIndex]
      if (!healer || !target || !target.fallen) throw new Error('nobody to raise')
      if (!canRaise(content, healer)) throw new Error(`a healer of level ${r.healerMinLevel} with a revive skill raises the dead`)
      const key = String(command.heroIndex)
      if ((state.floor.raisesUsed[key] ?? 0) >= r.perHealerPerFloor) throw new Error('once per healer per floor')
      if (healer.poolPercent < r.healerPoolPercent) throw new Error('not enough pool')
      healer.poolPercent -= r.healerPoolPercent
      state.floor.raisesUsed[key] = (state.floor.raisesUsed[key] ?? 0) + 1
      const before = target.record.level
      target.record = loseLevels(content, t, target.record, r.levelLoss)
      target.fallen = false
      target.downed = false
      target.hpPercent = r.hpPercent
      state.stats.raises += 1
      tickClock(content, state, r.clockTicks, rng)
      logEvent(state, 'raise', `${healer.record.name} raises ${target.record.name} from the dead (level ${before} → ${target.record.level})`, { healer: healer.record.id, target: target.record.id, from: before, to: target.record.level })
      break
    }
    case 'firstAid': {
      const h = state.heroes[command.heroIndex]
      const target = state.heroes[command.targetIndex]
      if (!h || !target || (!target.fallen && !target.downed)) throw new Error('nothing to do')
      if (target.fallen && isMortal(state)) throw new Error('First Aid cannot raise the dead')
      const inRest = graphRoom(state, state.floor.currentRoomId).kind === 'rest'
      if (!inRest) {
        if (state.floor.revivesLeft <= 0) throw new Error('no revives left')
        state.floor.revivesLeft -= 1
      }
      target.fallen = false
      target.downed = false
      target.hpPercent = 20 + 2 * h.record.fieldSkills.firstAid.rank
      // fix (Phase 8): the XP reaches rank (progress.ts gainFieldSkillXp).
      h.record = gainFieldSkillXp(t, h.record, 'firstAid', 10).hero
      logEvent(state, 'firstAid', `${h.record.name} revives ${target.record.name}`)
      break
    }
    case 'stance': {
      const h = state.heroes[command.heroIndex]
      if (!h?.record.petInstance) throw new Error('no pet')
      h.record = { ...h.record, petInstance: { ...h.record.petInstance, stance: command.stance }, loadout: { ...h.record.loadout, stance: command.stance } }
      break
    }
    case 'buy': {
      const rs = currentRoom(state)
      const offer = rs.merchant?.[command.offerIndex]
      if (!offer || offer.soldOut) throw new Error('no such offer')
      if (state.gold < offer.price) throw new Error('not enough gold')
      state.gold -= offer.price
      offer.quantity -= 1
      if (offer.quantity <= 0) offer.soldOut = true
      giveConsumable(content, state, buyOffer(content, rng, offer))
      logEvent(state, 'buy', `Bought ${offer.itemId} for ${offer.price}`)
      break
    }
    case 'sell': {
      // Dunmore buys parts at 40% + 0.5% per Haggling rank (07 §2.7); the sale is logged for Pedlar's Friend (07 §7).
      if (phase.kind !== 'room' || !currentRoom(state).merchant) throw new Error('nobody here buys parts')
      const offer = partSales(content, state).find((o) => o.itemId === command.itemId)
      const quantity = Math.min(Math.max(0, Math.floor(command.quantity)), offer?.quantity ?? 0)
      if (!offer || quantity <= 0) throw new Error('nothing of that to sell')
      const gold = roundHalfUp((offer.gold * quantity) / offer.quantity)
      state.materials[offer.itemId] = (state.materials[offer.itemId] ?? 0) - quantity
      state.gold += gold
      logEvent(state, 'sell', `Sold ${quantity} ${offer.name} for ${gold}`, { itemId: offer.itemId, quantity, gold })
      break
    }
    case 'corridorSkill': {
      if (phase.kind !== 'room') throw new Error('between fights only')
      // D-099: the pool, no turn, no floor-clock tick (sim/src/corridor.ts).
      logEvent(state, 'corridorSkill', useCorridorSkill(content, state, command.heroIndex, command.skillId), { skill: command.skillId, hero: command.heroIndex })
      break
    }
    case 'relic': {
      const item = rerollFightDrop(content, t, rng, state, command.heroIndex, partyLuck(content, t, state))
      logEvent(state, 'relic', `The Hollow Coin spins: ${item ? (content.items.get(item.itemId)?.name ?? item.itemId) : 'nothing'}`)
      break
    }
    case 'descend': {
      const g = graphRoom(state, state.floor.currentRoomId)
      const rs = currentRoom(state)
      if (state.floor.currentRoomId !== state.floor.graph.exitId || (g.kind === 'boss' && !rs.cleared)) throw new Error('not at the way down')
      // Taking the stairs springs a trap on them (07 §2.5 the Greased Stairs; C1).
      springTraps(content, state, rng, rs, 'descend')
      if (state.phase.kind !== 'room') break
      state.stats.ticksToStairs.push(state.floor.clock)
      state.stats.deepestFloorCompleted = Math.max(state.stats.deepestFloorCompleted, state.floor.number)
      state.stats.lightAtStairs.push(state.light)
      // Contracts (07 §7: Lights On, Keeper's Peace): the floor's way down reached, and the light it was reached in.
      logEvent(state, 'stairs', `The way down from floor ${state.floor.number}`, { light: state.light })
      if (state.floor.number >= (state.options.lastFloor ?? state.floor.number)) {
        state.phase = { kind: 'over', outcome: 'cleared', summary: `Cleared floors ${state.options.floor ?? 1}–${state.floor.number} with ${state.gold} gold` }
        break
      }
      beginFloor(content, state, state.floor.number + 1, rng)
      break
    }
    case 'retreat': {
      if (phase.kind !== 'room') throw new Error('not now')
      // Pact: Iron Oath (07 §6.2).
      if (state.ruleFlags.includes('no-retreat')) throw new Error('the Iron Oath: no retreat until the zone is done')
      {
        const g = graphRoom(state, state.floor.currentRoomId)
        const rs = currentRoom(state)
        const atEntry = state.floor.currentRoomId === state.floor.graph.entryId
        const atEnd = state.floor.currentRoomId === state.floor.graph.exitId && (g.kind === 'stairs' || (g.kind === 'boss' && rs.cleared))
        if (!atEntry && !atEnd) throw new Error('leave from the entrance or the floor\'s end')
        if (atEnd) state.stats.deepestFloorCompleted = Math.max(state.stats.deepestFloorCompleted, state.floor.number)
        // Contracts (07 §7): teleporting out at the floor's end reaches its way down too.
        if (atEnd) logEvent(state, 'stairs', `The way down from floor ${state.floor.number}`, { light: state.light })
      }
      const toll = state.floor.bossDefeated ? 0 : retreatToll(t, state.gold, state.knobs.retreatTollPercent ?? t.death.retreatTollPercent)
      state.gold -= toll
      state.stats.goldLost += toll
      state.phase = { kind: 'over', outcome: 'retreated', summary: `Retreated from floor ${state.floor.number}${toll ? ` (toll ${toll})` : ''}` }
      break
    }
  }
  save(state, rng)
  return state
}

/** The scripted policy's own stream: a function of the seed and how many commands have been played. */
function policyRng(state: DelveState): Rng {
  return Rng.fromSeed((state.seed[0] ^ 0xa5a5a5a5) >>> 0, (state.seed[1] + state.commandLog.length * 0x9e37) >>> 0)
}

/** Runs the delve on the scripted policy until it ends or `maxCommands` pass. */
export function runDelveAuto(content: Content, state: DelveState, maxCommands = 5000, observe?: (state: DelveState, command: DelveCommand) => void): DelveState {
  state.options.auto = true
  let n = 0
  let stuck = false
  while (state.phase.kind !== 'over' && n++ < maxCommands) {
    const actions = legalDelveActions(content, state)
    const pick = choosePolicyCommand(state.options.policy, state, actions, policyRng(state), content)
    if (!pick) {
      stuck = true
      break
    }
    stepDelve(content, state, pick)
    // The balance runner's and the debug tools' window on each step (read-only by contract; tools/balance/run.ts).
    observe?.(state, pick)
  }
  // The scripted player finds no legal way on (it never wanders: sim/src/policies.ts) or the command cap passes.
  if (state.phase.kind !== 'over') state.phase = { kind: 'over', outcome: 'capped', summary: stuck ? `Stuck on floor ${state.floor.number} in ${state.floor.currentRoomId}: no legal way on` : `Stopped after ${maxCommands} commands` }
  return state
}

/** Rebuilds a delve from its seed and command log (03 §10.1). */
export function replayDelve(content: Content, options: DelveOptions, party: readonly HeroRecord[], commands: readonly DelveCommand[]): DelveState {
  const state = createDelve(content, options, party)
  for (const c of commands) stepDelve(content, state, c)
  return state
}

/** The desync hash: everything that decides the future, without the logs. */
export function hashDelve(state: DelveState): string {
  return hashState({
    rng: state.rng,
    heroes: state.heroes,
    gold: state.gold,
    pile: state.pile,
    materials: state.materials,
    floor: { number: state.floor.number, hash: state.floor.graph.hash, rooms: state.floor.rooms, current: state.floor.currentRoomId, clock: state.floor.clock, hunter: state.floor.hunter, revives: state.floor.revivesLeft, key: state.floor.hasKey, boss: state.floor.bossDefeated, secret: state.floor.secretId, shortcut: state.floor.shortcutTo, goldBonus: state.floor.goldPercentBonus, ambush: state.floor.ambushPercent, twin: state.floor.twinHunter ?? null, trail: [state.floor.ambushShiftNext ?? 0, state.floor.ambushShiftHere ?? 0], perTick: state.floor.roomsPerTick ?? null },
    pending: state.pendingStatuses,
    light: state.light,
    phase: state.phase,
    fight: state.fight ? { tick: state.fight.tick, round: state.fight.round, actors: state.fight.actors, pending: state.fight.pendingActorId, over: state.fight.over, rng: state.fight.rng } : null,
  })
}

export function delveSummary(state: DelveState): Record<string, number | string> {
  const s = state.stats
  const rounds = Object.entries(s.roundsByKind).map(([k, v]) => `${k}: ${v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '-'}`).join(' · ')
  return { outcome: state.phase.kind === 'over' ? state.phase.outcome : 'running', floor: state.floor.number, rooms: s.rooms, fights: s.fights, rounds, gold: state.gold, goldFound: s.goldFound, downs: s.downs, wipes: s.wipes, ambushedParty: s.ambushedParty, ambushedMonsters: s.ambushedMonsters, traps: `${s.trapsRevealed}/${s.trapsTriggered}/${s.trapsDisarmed}`, hunter: s.hunterArrived, insights: s.insights, light: state.light, commands: state.commandLog.length }
}

export function hopsOf(state: DelveState): Map<string, { hops: number; via: string | null }> {
  return hopsFrom(state.floor.graph, state.floor.graph.entryId)
}
