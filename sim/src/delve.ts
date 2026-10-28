import { buildTomeBag } from './chests.ts'
import type { Content } from './content.ts'
import type { DelveCommand, DelveHero, DelveOptions, DelveState, FloorRun, HunterState, LegalDelveAction, RoomState } from './delve-types.ts'
import { detection, disarmChance, heroAmbushChance, monsterAmbushChance, rollScout, scoutChance, trapRevealed } from './detection.ts'
import { goldFor, retreatToll, rForFloor } from './economy.ts'
import { buyOffer, dressRoom, drawChampionAffixes, encountersFor, farthestRoom, floorDef, hopsFrom, isMonsterEncounter, meetsRoleMix, merchantStock, pickEncounter, spawnBossFight, spawnEncounter, spawnPack, spawnSingle, stepToward, templateHasBrazier, zoneByIndex, zoneOf } from './explore.ts'
import { applyFightCommand, createFight, legalFightActions, runFight, runFightAuto } from './fight.ts'
import type { Actor, FightState } from './fight-types.ts'
import { generateFloor, type FloorGraph } from './generator.ts'
import { hashState } from './hash.ts'
import { buildHeroActor, heroStats, loseLevels, speciesRules } from './hero.ts'
import { installHook } from './hooks.ts'
import { applyWearBp, createItemInstance, effectiveItemStats, fieldRepair, repairItemPoints, repairKit } from './items.ts'
import { addLight, lightAfterRoom, lightAtEntry, lightBand } from './light.ts'
import { lootTableForFloor, openDungeonChest, pickGearItem, rollFightLoot, rollParts, rollTreasureRoom, type FightMonster, type ItemFilter } from './loot.ts'
import { partyScale } from './monsters.ts'
import { buildPetActor, partyPetTraitBonus } from './pets.ts'
import { choosePolicyCommand } from './policies.ts'
import { applyFightProgress, carryHeroState } from './progress.ts'
import { Rng, seedFor } from './rng.ts'
import { linesAtRank } from './skill-lines.ts'
import { clamp, roundHalfUp } from './stats.ts'
import { secretDoorKnown } from './secret-doors.ts'
import { roomThreat } from './threat.ts'
import { applyStatus } from './statuses.ts'
import type { Tuning } from './tuning.ts'
import type { CurioDef, DifficultyKnobs, DungeonDef, Effect, HeroRecord, ItemInstance, Requirement, Reward, SecretDef, TrapDef } from './types/content.ts'
import { GRADES, isMember, type Grade, type Status, type Target } from './types/enums.ts'

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

function partyDetection(content: Content, t: Tuning, state: DelveState): number {
  let best = 0
  for (const h of activeHeroes(state)) {
    const species = content.species.get(h.record.speciesId)
    const rules = species ? speciesRules(species) : {}
    const stats = heroStats(content, t, h.record)
    const pet = h.record.petInstance && h.record.petInstance.stance === 'forage' ? 2 : 0
    best = Math.max(best, detection(t, stats.detection, state.light, rules.lightBandShift ?? 0, pet))
  }
  // A Spiderling's or a Wisp's +5 Detection on the party's best (06 §9).
  return best + partyPetTraitBonus(content, partyPets(state), 'detection')
}

function knobsFor(dungeon: DungeonDef, options: DelveOptions): { knobs: Record<string, number>; flags: string[]; reward: DelveState['pactReward'] } {
  const knobs: Record<string, number> = {}
  const apply = (k: DifficultyKnobs, pact: boolean) => {
    for (const [key, value] of Object.entries(k)) {
      if (value === undefined) continue
      const percentKnob = key.endsWith('Percent')
      if (pact && percentKnob && knobs[key] !== undefined) knobs[key] = roundHalfUp(((knobs[key] ?? 100) * value) / 100)
      else knobs[key] = value
    }
  }
  apply(dungeon.presets[options.difficulty] ?? {}, false)
  const flags: string[] = []
  const reward = { goldPercent: 0, xpPercent: 0, chestShiftPp: 0 }
  for (const id of options.pactIds) {
    const pact = dungeon.pacts.find((p) => p.id === id)
    if (!pact) continue
    apply(pact.knobs, true)
    flags.push(...pact.ruleFlags)
    reward.goldPercent += pact.reward.goldPercent
    reward.xpPercent += pact.reward.xpPercent
    reward.chestShiftPp += pact.reward.chestShiftPp
  }
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
  const { knobs, flags, reward } = knobsFor(dungeon, options)
  const startFloor = options.zone !== undefined ? zoneByIndex(dungeon, options.zone).floors.from : (options.floor ?? 1)
  const zone = zoneOf(dungeon, startFloor)
  const lastFloor = options.lastFloor ?? zone.floors.to
  const state: DelveState = {
    version: DELVE_VERSION,
    seed,
    rng: rng.state,
    options: { ...options, lastFloor },
    heroes: party.map((record) => ({ record, hpPercent: 100, poolPercent: 100, downed: false, fallen: false, skillUses: {}, insight: { usesSincePity: 0 }, treatUsed: false, cooked: null, wearCarry: {}, growth: { skills: {}, attributes: {}, items: {}, insights: [], levelsGained: 0 }, petHpPercent: 100 })),
    gold: 0,
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
  const kind = state.options.firstDelve && floorNumber === 1 ? 'tutorial' : bossDef ? (isLastOfDungeon && (bossDef.boss?.phases.length ?? 0) >= 3 ? 'throne' : 'zoneBoss') : 'normal'
  const floorSeed = seedFor(state.seed[0], state.seed[1], dungeon.id, floorNumber)
  const encRng = rng.fork(`encounters-${floorNumber}`)
  let monsterRooms = 0
  const graph: FloorGraph = generateFloor({
    knobs: dungeon.generator,
    floor: fd,
    templates: dungeon.templates,
    seed: floorSeed,
    partySize: state.heroes.length,
    kind,
    overrides: { eliteRoomWeight: state.knobs.eliteRoomWeight, everyDoorLocked: state.ruleFlags.includes('every-door-locked') },
    pickEncounter: (ctx) => {
      const e = pickEncounter(content, ctx.rng ?? encRng, fd, dungeon.id, ctx.previousEncounterId, monsterRooms, false)
      if (e && isMonsterEncounter(content, e)) monsterRooms++
      return e?.id ?? null
    },
    meetsRoleMix: (ids) => meetsRoleMix(content, ids, floorNumber),
  })
  const rooms: Record<string, RoomState> = {}
  const used = { curios: new Set<string>(), traps: [] as string[] }
  const trapBonus = state.knobs.trapDifficultyBonus ?? 0
  for (const room of graph.rooms) {
    const rs = dressRoom(content, rng, dungeon, zone, fd, room, used, trapBonus)
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
  const hunter: HunterState | null = zone.hunterId && fd.hunterClock !== null ? { monsterId: zone.hunterId, entered: false, roomId: null, moveProgress: 0, killed: false } : null
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
  }
  // Floor-long statuses (a shrine's Curse, a blessing) end with the floor; counted ones (Greased Stairs) carry over.
  state.pendingStatuses = state.pendingStatuses.filter((p) => p.fightsLeft !== null)
  // The entry lantern never lowers the light (07 §2.3); on the delve's first floor the preset's lightStart wins (07 §6.1).
  const firstFloorOfDelve = state.stats.rooms === 0
  if (!(firstFloorOfDelve && state.knobs.lightStart !== undefined)) state.light = lightAtEntry(t, state.light, fd.lightAtEntry)
  for (const h of state.heroes) h.cooked = null
  logEvent(state, 'floor', `Floor ${floorNumber}: ${graph.rooms.length} rooms (${kind})`, { rooms: graph.rooms.length, kind })
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
  const h = state.floor.hunter
  if (!h || h.killed) return
  const dungeon = dungeonOf(content, state)
  const fd = floorDef(dungeon, state.floor.number)
  const enterAt = state.knobs.hunterClock ?? fd.hunterClock ?? content.tuning.exploration.floorClock.hunterEntersAt
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
    state.light = lightAfterRoom(t, state.light, !firstVisit)
    // Attune, Vigil Lantern, "of Embers": the party's Light falls that many less per room (the best single hero's; D-071).
    const ease = partyHookBest(content, t, state, 'light-decay-reduction')
    if (ease > 0 && state.light < before) state.light = Math.min(before, state.light + ease)
    tickClock(content, state, t.exploration.floorClock.tickPerRoomEntered, rng)
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
    if (trapRevealed(det, def.revealedBy.detection + (state.knobs.trapDifficultyBonus ?? 0)) || (def.revealedBy.classId && state.heroes.some((h) => h.record.classId === def.revealedBy.classId)) || (def.revealedBy.petId && state.heroes.some((h) => h.record.petInstance?.petId === def.revealedBy.petId)) || (def.revealedBy.fieldSkillRank && state.heroes.some((h) => h.record.fieldSkills[def.revealedBy.fieldSkillRank!.fieldSkill].rank >= def.revealedBy.fieldSkillRank!.min)) || (def.revealedBy.criticalScout && rs.scouted)) {
      tr.revealed = true
      state.stats.trapsRevealed += 1
      logEvent(state, 'trapRevealed', `${def.name} spotted`, { trap: def.id })
    }
  }
  if (!rs.secretRevealed && g.doors.some((d) => d.secret) && det >= fd.secretDifficulty) {
    rs.secretRevealed = true
    state.stats.secretsFound += 1
    logEvent(state, 'secret', 'A secret door')
  }
  const rangers = state.heroes.filter((h) => h.record.classId === 'ranger').length
  const pets = partyPets(state)
  const scoutShift = Math.min(darkvisionShift(content, state), partyPetTraitBonus(content, pets, 'scoutBandShift'))
  const scoutExtra = partyHookBest(content, t, state, 'scouting-chance-percent') + partyPetTraitBonus(content, pets, 'scouting')
  const scout = rollScout(t, rng, scoutChance(t, state.light, scoutShift, rangers, 0, scoutExtra))
  if (scout !== 'none') {
    for (const d of g.doors) {
      if (d.secret && !rs.secretRevealed) continue
      const n = state.floor.rooms[d.to]
      if (n) n.scouted = true
      if (scout === 'critical') for (const d2 of graphRoom(state, d.to).doors) if (!d2.secret && state.floor.rooms[d2.to]) state.floor.rooms[d2.to]!.scouted = true
    }
  }
  // Unrevealed traps that fire on entering.
  for (const tr of rs.traps) {
    const def = dungeon.traps.find((x) => x.id === tr.trapId)
    if (!def || tr.revealed || tr.triggered || tr.disarmed || def.trigger !== 'enter') continue
    fireTrap(content, state, rng, def, tr, 100)
  }
  // The hunter.
  const hunter = state.floor.hunter
  if (hunter?.entered && !hunter.killed && hunter.roomId === roomId) {
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
        const loot = rollTreasureRoom(content, t, rng, table, { luck: partyLuck(content, t, state), bestDetection: det })
        rs.goldPiles = loot.goldPiles
        if (loot.smallChest) rs.chests.push(loot.smallChest)
        if (loot.largeChest) rs.chests.push(loot.largeChest)
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
          rs.chests.push({ size: 'small', locked: false, trapped: false, trapId: null, opened: false })
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
        rs.merchant = merchantStock(content, t, rng, rForFloor(state.floor.number), hag, table.gradeShape.centreGrade, state.heroes.map((h) => h.record.classId))
        state.light = addLight(t, state.light, t.exploration.light.brazier)
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
  if (def?.consumable || def?.kind === 'key') {
    const bag = [...h.record.bag]
    const i = bag.findIndex((b) => b.itemId === inst.itemId)
    if (i >= 0) bag[i] = { ...bag[i]!, quantity: bag[i]!.quantity + inst.quantity }
    else bag.push(inst)
    h.record = { ...h.record, bag }
  } else state.pile.push(inst)
}

function giveMaterial(state: DelveState, itemId: string, quantity: number): void {
  if (quantity <= 0) return
  state.materials[itemId] = (state.materials[itemId] ?? 0) + quantity
  state.stats.partsFound += quantity
}

/* ---------- secrets (07 §2.6) ---------- */

/** Every room shows its kind on the map (a drawn floor map, a tablet); secret doors stay hidden — a map is not Detection. */
function revealFloor(state: DelveState): void {
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

/** One hero of the party learns a Tier `tier` skill of their class from a fresh Tome bag (chests.ts); a dupe is rank XP (03 §8). */
function giveTome(content: Content, state: DelveState, rng: Rng, tier: number): string {
  const heroes = activeHeroes(state)
  if (heroes.length === 0) return 'no one to read it'
  const h = rng.pick(heroes)
  const known = new Set(h.record.skills.map((s) => s.skillId))
  const bag = buildTomeBag(content, h.record.classId, { min: tier, max: tier }, known)
  const ids = bag[String(tier)] ?? []
  if (ids.length > 0) {
    const skillId = rng.pick(ids)
    h.record = { ...h.record, skills: [...h.record.skills, { skillId, rank: 1, xp: 0 }] }
    h.growth.skills[skillId] = (h.growth.skills[skillId] ?? 0) + 1
    return `${h.record.name} learns ${content.skills.get(skillId)?.name ?? skillId}`
  }
  const owned = h.record.skills.filter((s) => content.skills.get(s.skillId)?.tier === tier)
  const pick = owned.length ? rng.pick(owned) : h.record.skills[0]
  if (!pick) return 'a Tome with nothing to teach'
  h.record = { ...h.record, skills: h.record.skills.map((s) => (s.skillId === pick.skillId ? { ...s, xp: s.xp + 10 } : s)) }
  return `${h.record.name} studies ${content.skills.get(pick.skillId)?.name ?? pick.skillId} (duplicate: rank XP)`
}

/** One reward line of a secret, a boss or a disarm (08 §11); gold lines are whole gold. */
function payReward(content: Content, state: DelveState, rng: Rng, r: Reward): string | null {
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
        const inst = createItemInstance(content, rng, r.id, { quantity: amount })
        const def = content.items.get(r.id)
        if (def?.consumable || def?.kind === 'key') giveConsumable(content, state, inst)
        else giveItems(state, [inst])
        return `${amount > 1 ? `${amount} ` : ''}${def?.name ?? r.id}`
      }
      const grade: Grade = r.grade ?? 'F'
      const def = pickGearItem(content, rng, grade)
      if (!def) return null
      giveItems(state, [createItemInstance(content, rng, def.id, { rollAffixes: true })])
      return `${def.name} (${grade})`
    }
    case 'tome':
      return giveTome(content, state, rng, r.tier ?? 1)
    default:
      // shard, luck, title, waystone: town-side rewards the delve only notes (08 §11).
      logEvent(state, 'reward', `${r.kind} reward noted`, { kind: r.kind, amount })
      return `${r.kind}`
  }
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
    rs.chests.push({ size: secret.chest, locked: false, trapped: false, trapId: null, opened: false })
    bits.push(`a ${secret.chest} chest`)
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
        state.pendingStatuses.push({ kind: 'status', status: line.status, target: line.target ?? 'allAllies', duration: line.duration, fightsLeft: null, sourceId: secret.id })
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
    for (const h of activeHeroes(state)) h.record = { ...h.record, fieldSkills: { ...h.record.fieldSkills, [skill]: { ...h.record.fieldSkills[skill], xp: h.record.fieldSkills[skill].xp + 50 } } }
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

/** An ambush a line asks for (07 §2.4 "a fight that begins with the party surprised"). */
interface AmbushSpec {
  monsterId: string | null
  count: number | null
  surprise: boolean
}

interface DelveLineResult {
  text: string
  ambush: AmbushSpec | null
}

/** A trap, curio or item status lands at the start of the next fight(s) on this floor; instant statuses (Daze) have nowhere to land. */
function queueStatus(content: Content, state: DelveState, line: Effect, status: Status, fightsLeft: number | null, sourceId: string, magnitude?: number): string {
  const def = content.statuses.get(status)
  if (def && def.durationDefault === null && (def.endsWhen ?? '').startsWith('instant')) return `${status} (fades before the next fight)`
  state.pendingStatuses.push({ kind: 'status', status, target: line.target ?? 'allAllies', duration: line.duration, magnitude, fightsLeft, sourceId })
  return fightsLeft === null ? `${status} for the rest of the floor` : `${status} for the next ${fightsLeft === 1 ? 'fight' : `${fightsLeft} fights`}`
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
      return none(queueStatus(content, state, line, line.status, 1, src.id))
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
      if (!victim) return none('no one to hurt')
      const dmg = Math.max(0, roundHalfUp(((line.amount ?? 0) + (line.multiplier ?? 0) * floor) * scale))
      hurtHero(content, state, victim, dmg)
      return none(`${dmg} ${line.damageType ?? ''} to ${victim.record.name}`.replace('  ', ' '))
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
      const slotWord = line.note?.match(/\b(boots|helmet|chest|legs|gloves|ring|talisman|shield)\b/i)?.[1]?.toLowerCase()
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
      return none(queueStatus(content, state, line, line.status, Math.max(1, line.amount ?? 1), src.id))
    case 'status-for-floor':
      if (!line.status) return none('nothing')
      return none(queueStatus(content, state, line, line.status, null, src.id))
    case 'status-flat-per-tick': {
      if (!line.status) return none('nothing')
      const flat = Math.max(0, roundHalfUp(((line.amount ?? 0) + (line.multiplier ?? 0) * floor) * scale))
      const def = content.statuses.get(line.status)
      // The record ticks a share of a hit (Burn 20%): hand it the hit that makes the tick come out at the flat.
      const magnitude = def?.magnitudeOf === 'hitDamage' && (def.percent ?? 0) > 0 ? roundHalfUp((flat * 100) / (def.percent ?? 100)) : flat
      return none(`${queueStatus(content, state, line, line.status, 1, src.id, magnitude)} (${flat} per tick)`)
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
      return none(line.customId ?? 'custom')
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
  if (ambush) startFight(content, state, rng, 'trap', ambush)
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
  const named = ambush ? spawnAmbush(content, state, rng, ambush, { level: fd.monsterLevel, partySize, enemyHpPercent: enemyHp, enemyCountPercent: enemyCount }) : null
  if (named) {
    monsters = named
    ambushMod = Math.max(0, ...monsters.map((m) => content.monsters.get(m.monster?.monsterId ?? '')?.ambushModifier ?? 0))
  } else if (kind === 'boss') {
    const boss = fd.bossId ? content.monsters.get(fd.bossId) : undefined
    if (!boss) throw new Error(`floor ${fd.floor} names no boss`)
    monsters = spawnBossFight(content, t, boss, { level: fd.monsterLevel, partySize, enemyHpPercent: enemyHp })
    state.stats.bossFights += 1
  } else if (kind === 'hunter') {
    const def = state.floor.hunter ? content.monsters.get(state.floor.hunter.monsterId) : undefined
    if (!def) throw new Error('no hunter')
    monsters = [spawnSingle(content, t, def, { id: def.id, level: fd.monsterLevel, partySize, enemyHpPercent: enemyHp })]
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
    heroes.push(buildHeroActor(content, t, h.record, { id: `hero-${i}`, row, hpPercent: Math.max(1, h.hpPercent), poolPercent: h.poolPercent }))
    if (h.record.petInstance) pets.push(buildPetActor(content, t, h.record.petInstance, { id: `pet-${i}`, ownerId: `hero-${i}`, ownerLevel: h.record.level, hpPercent: h.petHpPercent }))
  })
  if (heroes.length === 0) return
  // Surprise (03 §4.4): not for bosses and hunters (07 §2.8–§2.9); a curio's or trap's "ambush" is certain (07 §2.4).
  let surprised: 'party' | 'enemy' | null = null
  if (ambush?.surprise) {
    surprised = 'party'
    state.stats.ambushedParty += 1
    state.ruleFlags = state.ruleFlags.filter((f) => f !== 'next-fight-ambush')
    state.floor.ambushPercent = 0
  } else if (kind !== 'boss' && kind !== 'hunter') {
    const flagged = state.ruleFlags.includes('next-fight-ambush')
    const extra = (flagged ? state.floor.ambushPercent || 30 : 0) + (state.ruleFlags.includes('loud-boots') ? 15 : 0) + petAmbushModifier(content, state)
    state.ruleFlags = state.ruleFlags.filter((f) => f !== 'next-fight-ambush')
    state.floor.ambushPercent = 0
    const bestPer = bestOf(content, t, state, (h) => h.record.attributes.perception)
    const orcs = state.heroes.filter((h) => h.record.speciesId === 'orc').length
    const shades = state.heroes.filter((h) => h.record.classId === 'shade').length
    const heroChance = heroAmbushChance(t, { light: state.light, darkvisionShift: darkvisionShift(content, state), bestPerception: bestPer, monsterModifier: ambushMod, orcsInParty: orcs, shadesInParty: shades, extra })
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
    options: { dungeonId: dungeon.id, floor: state.floor.number, floorLevel: fd.monsterLevel, autoHeroes: state.options.auto, enemyDamagePercent: roundHalfUp(((state.knobs.enemyDamagePercent ?? 100) * partyScale(t, state.heroes.filter((h) => !h.fallen).length).damagePercent) / 100), enemySpeedPercent: state.knobs.enemySpeedPercent ?? 100, partyGold: state.gold },
    rng: rng.fork(`fight-${state.stats.fights}`),
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
    for (const a of partyTargets(fight, p.target)) {
      if (p.kind === 'resist') {
        installHook(a, { kind: 'custom', customId: 'status-resist-bonus', status: p.status, percent: p.percent ?? 100 }, p.sourceId)
        continue
      }
      const out = applyStatus(content, t, r, a, { status: p.status, duration: p.duration, magnitude: p.magnitude, sourceId: p.sourceId })
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
    const pet = h.record.petInstance ? content.pets.get(h.record.petInstance.petId) : undefined
    for (const line of pet?.trait.effects ?? []) if (line.kind === 'custom' && line.customId === 'party-ambush-modifier') mod = Math.min(mod, line.amount ?? 0)
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
  const rs = state.floor.rooms[ctxF.roomId]!
  state.floor.clock += fight.round * t.exploration.floorClock.tickPerFightRound
  ;(state.stats.roundsByKind[ctxF.kind] ??= []).push(fight.round)
  for (const e of fight.log) if (e.kind === 'hookStub') state.stats.hookStubs[e.text.split(':')[0] ?? 'hook'] = (state.stats.hookStubs[e.text.split(':')[0] ?? 'hook'] ?? 0) + 1
  state.stats.downs += fight.counters.heroDowns
  const heroIds = state.heroes.map((_, i) => `hero-${i}`)
  const lines: string[] = []
  const outcome = fight.over.outcome
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
    if (ctxF.kind === 'boss') state.floor.bossDefeated = true
    if (ctxF.kind === 'hunter' && state.floor.hunter) {
      state.floor.hunter.killed = true
      state.stats.hunterKilled += 1
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
    // Gold found: the preset knob × the pacts × (a paid Toll Shrine's floor bonus + the party's "of Greed" lines) (07 §2.4, 08 §5).
    const foundPct = 100 + state.floor.goldPercentBonus + partyAffixPercent(content, t, state, 'gold-found-percent') + partyPetTraitBonus(content, partyPets(state), 'goldPercent')
    const goldPercent = roundHalfUp(((state.knobs.goldPercent ?? 100) * (1 + state.pactReward.goldPercent / 100) * foundPct) / 100)
    const loot = rollFightLoot(content, t, rng, { dungeonId: dungeon.id, floor: state.floor.number, monsters: killed, lightBand: lightBand(t, state.light).id as 'radiant', luck: partyLuck(content, t, state), knobs: { goldPercent }, isMonsterRoom: ctxF.isMonsterRoom })
    state.gold += loot.gold
    state.stats.goldFound += loot.gold
    giveItems(state, loot.items)
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
    if (loot.hunterChest) rs.chests.push(loot.hunterChest)
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
      return state.heroes.some((h) => h.record.bag.some((b) => b.itemId === r.id && b.quantity >= (r.amount ?? 1)))
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
  const r = resolveDelveLine(content, state, rng, line, { kind: 'curio', id: curio.id, percent: 100, victim: activeHeroes(state)[0] ?? null })
  logEvent(state, 'curio', `${curio.name}: ${choice.label} → ${r.text}`, { curio: curio.id, choice: choiceIndex, outcome: line.kind === 'custom' ? (line.customId ?? 'custom') : line.kind })
  if (r.ambush) startFight(content, state, rng, 'curio', r.ambush)
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
  if (phase.kind === 'result') return [{ command: { kind: 'continue' }, label: 'Continue', enabled: true }]
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
  const blockingTrap = rs.traps.find((tr) => tr.blocksDoorTo && !tr.disarmed && !tr.triggered)
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
  const atExit = state.floor.currentRoomId === state.floor.graph.exitId
  if (atExit && (g.kind === 'stairs' || (g.kind === 'boss' && rs.cleared))) out.push({ command: { kind: 'descend' }, label: state.floor.number >= (state.options.lastFloor ?? 99) ? 'Finish the delve' : 'Take the stairs', enabled: true })
  // D-083 (James): the party leaves by walking back out of a floor's entrance or by teleporting out at the floor's end
  // (the stairs, or a beaten boss's room). Both keep everything; a Pact's toll knob still applies.
  const atEntry = state.floor.currentRoomId === state.floor.graph.entryId
  const atFloorEnd = atExit && (g.kind === 'stairs' || (g.kind === 'boss' && rs.cleared))
  if (atEntry || atFloorEnd) {
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
      const pick = choosePolicyCommand(state.options.policy, state, actions, policyRng(state))
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
        const blocking = rs.traps.find((tr) => tr.blocksDoorTo === door.to && !tr.disarmed && !tr.triggered)
        if (blocking) throw new Error('a trap blocks the door')
      } else logEvent(state, 'crawlway', `The party takes the crawlway to ${command.toRoomId}`)
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
        h.record = { ...h.record, fieldSkills: { ...h.record.fieldSkills, trapDisarm: { ...h.record.fieldSkills.trapDisarm, xp: h.record.fieldSkills.trapDisarm.xp + 10 } } }
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
      const loot = openDungeonChest(content, t, rng, chest, { table, centreGrade: table.gradeShape.centreGrade, luck: partyLuck(content, t, state), fightGold, withKey })
      chest.opened = true
      state.stats.chestsOpened += 1
      state.gold += loot.gold
      state.stats.goldFound += loot.gold
      giveItems(state, loot.items)
      for (const c of loot.consumables) giveConsumable(content, state, c)
      if (loot.stone) giveConsumable(content, state, loot.stone)
      logEvent(state, 'chest', `A ${loot.size} chest: ${loot.items.length} item(s), ${loot.gold} gold`)
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
      h.record = { ...h.record, fieldSkills: { ...h.record.fieldSkills, firstAid: { ...h.record.fieldSkills.firstAid, xp: h.record.fieldSkills.firstAid.xp + 10 } } }
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
    case 'descend': {
      const g = graphRoom(state, state.floor.currentRoomId)
      const rs = currentRoom(state)
      if (state.floor.currentRoomId !== state.floor.graph.exitId || (g.kind === 'boss' && !rs.cleared)) throw new Error('not at the way down')
      state.stats.ticksToStairs.push(state.floor.clock)
      state.stats.deepestFloorCompleted = Math.max(state.stats.deepestFloorCompleted, state.floor.number)
      state.stats.lightAtStairs.push(state.light)
      if (state.floor.number >= (state.options.lastFloor ?? state.floor.number)) {
        state.phase = { kind: 'over', outcome: 'cleared', summary: `Cleared floors ${state.options.floor ?? 1}–${state.floor.number} with ${state.gold} gold` }
        break
      }
      beginFloor(content, state, state.floor.number + 1, rng)
      break
    }
    case 'retreat': {
      if (phase.kind !== 'room') throw new Error('not now')
      {
        const g = graphRoom(state, state.floor.currentRoomId)
        const rs = currentRoom(state)
        const atEntry = state.floor.currentRoomId === state.floor.graph.entryId
        const atEnd = state.floor.currentRoomId === state.floor.graph.exitId && (g.kind === 'stairs' || (g.kind === 'boss' && rs.cleared))
        if (!atEntry && !atEnd) throw new Error('leave from the entrance or the floor\'s end')
        if (atEnd) state.stats.deepestFloorCompleted = Math.max(state.stats.deepestFloorCompleted, state.floor.number)
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
export function runDelveAuto(content: Content, state: DelveState, maxCommands = 5000): DelveState {
  state.options.auto = true
  let n = 0
  while (state.phase.kind !== 'over' && n++ < maxCommands) {
    const actions = legalDelveActions(content, state)
    const pick = choosePolicyCommand(state.options.policy, state, actions, policyRng(state))
    if (!pick) break
    stepDelve(content, state, pick)
  }
  if (state.phase.kind !== 'over') state.phase = { kind: 'over', outcome: 'capped', summary: `Stopped after ${maxCommands} commands` }
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
    floor: { number: state.floor.number, hash: state.floor.graph.hash, rooms: state.floor.rooms, current: state.floor.currentRoomId, clock: state.floor.clock, hunter: state.floor.hunter, revives: state.floor.revivesLeft, key: state.floor.hasKey, boss: state.floor.bossDefeated, secret: state.floor.secretId, shortcut: state.floor.shortcutTo, goldBonus: state.floor.goldPercentBonus, ambush: state.floor.ambushPercent },
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
