import type { Content } from './content.ts'
import type { DelveCommand, DelveHero, DelveOptions, DelveState, FloorRun, HunterState, LegalDelveAction, RoomState } from './delve-types.ts'
import { detection, disarmChance, heroAmbushChance, monsterAmbushChance, rollScout, scoutChance, trapRevealed } from './detection.ts'
import { goldFor, retreatToll, rForFloor } from './economy.ts'
import { buyOffer, dressRoom, drawChampionAffixes, farthestRoom, floorDef, hopsFrom, isMonsterEncounter, meetsRoleMix, merchantStock, pickEncounter, spawnBossFight, spawnEncounter, spawnSingle, stepToward, templateHasBrazier, zoneByIndex, zoneOf } from './explore.ts'
import { applyFightCommand, createFight, legalFightActions, runFight, runFightAuto } from './fight.ts'
import type { Actor } from './fight-types.ts'
import { generateFloor, type FloorGraph } from './generator.ts'
import { hashState } from './hash.ts'
import { buildHeroActor, heroStats, speciesRules } from './hero.ts'
import { applyWearBp, createItemInstance, fieldRepair, repairKit } from './items.ts'
import { addLight, lightAfterRoom, lightAtEntry, lightBand } from './light.ts'
import { lootTableForFloor, openDungeonChest, rollFightLoot, rollTreasureRoom, type FightMonster } from './loot.ts'
import { buildPetActor } from './pets.ts'
import { choosePolicyCommand } from './policies.ts'
import { applyFightProgress, carryHeroState } from './progress.ts'
import { Rng, seedFor } from './rng.ts'
import { clamp, roundHalfUp } from './stats.ts'
import type { Tuning } from './tuning.ts'
import type { CurioDef, DifficultyKnobs, DungeonDef, HeroRecord, ItemInstance, Requirement, TrapDef } from './types/content.ts'
import type { Grade } from './types/enums.ts'

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

function partyLuck(content: Content, t: Tuning, state: DelveState): number {
  void content
  void t
  let best = 0
  for (const h of activeHeroes(state)) best = Math.max(best, h.record.attributes.luck)
  return best || 10
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
  return best
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
  return { rooms: 0, fights: 0, eliteFights: 0, bossFights: 0, roundsByKind: {}, ambushedParty: 0, ambushedMonsters: 0, trapsRevealed: 0, trapsTriggered: 0, trapsDisarmed: 0, curiosUsed: 0, chestsOpened: 0, torchesUsed: 0, hunterArrived: 0, hunterKilled: 0, downs: 0, wipes: 0, goldFound: 0, goldLost: 0, itemsFound: 0, partsFound: 0, insights: 0, secretsFound: 0, ticksToStairs: [], lightAtStairs: [], fled: 0, xpEvents: 0 }
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
  state.floor = {
    number: floorNumber,
    monsterLevel: fd.monsterLevel,
    graph,
    rooms,
    currentRoomId: graph.entryId,
    clock: 0,
    hunter,
    revivesLeft: state.knobs.revivesPerFloor ?? t.death.partyRevivesPerFloor[state.options.difficulty],
    hasKey: false,
    bossDefeated: false,
    lastEncounterId: null,
    firstFightDone: false,
  }
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
    state.light = lightAfterRoom(t, state.light, !firstVisit)
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
  const scout = rollScout(t, rng, scoutChance(t, state.light, darkvisionShift(content, state), rangers, 0))
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
        // D-064: a secret room's reward is the zone's cache: 0.15 R, two torches and a Small chest (07 §2.6).
        const gold = goldFor(0.15, rForFloor(state.floor.number))
        state.gold += gold
        state.stats.goldFound += gold
        const torch = [...content.items.values()].find((d) => d.kind === 'consumable' && /torch/i.test(d.name))
        if (torch) giveItems(state, [createItemInstance(content, rng, torch.id, { quantity: 2 })])
        rs.chests.push({ size: 'small', locked: false, trapped: false, trapId: null, opened: false })
        logEvent(state, 'cache', `A cache: ${gold} gold`)
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

/* ---------- traps ---------- */

function lowestPerceptionHero(state: DelveState): DelveHero | null {
  let best: DelveHero | null = null
  for (const h of activeHeroes(state)) if (!best || h.record.attributes.perception < best.record.attributes.perception) best = h
  return best
}

function fireTrap(content: Content, state: DelveState, rng: Rng, def: TrapDef, tr: { triggered: boolean }, percent: number): void {
  const t = content.tuning
  tr.triggered = true
  state.stats.trapsTriggered += 1
  const victim = lowestPerceptionHero(state)
  const lines: string[] = []
  for (const line of def.effects) {
    switch (line.kind) {
      case 'light':
        state.light = addLight(t, state.light, roundHalfUp(((line.amount ?? 0) * percent) / 100))
        lines.push(`light ${line.amount ?? 0}`)
        break
      case 'damage': {
        if (!victim) break
        const dmg = Math.max(1, roundHalfUp((8 + 4 * state.floor.number) * (line.multiplier ?? 1) * (percent / 100)))
        hurtHero(content, state, victim, dmg)
        lines.push(`${dmg} to ${victim.record.name}`)
        break
      }
      case 'custom': {
        if (line.customId === 'floor-clock-add') tickClock(content, state, line.amount ?? 0, rng)
        else if (line.customId === 'next-fight-ambush') state.ruleFlags.push('next-fight-ambush')
        else if (line.customId === 'damage-percent-max-hp' && victim) {
          const stats = heroStats(content, t, victim.record)
          const dmg = roundHalfUp((stats.hp * (line.percent ?? 0) * percent) / 10_000)
          hurtHero(content, state, victim, dmg)
          lines.push(`${dmg} to ${victim.record.name}`)
        } else if (line.customId === 'trap-flat-damage' && victim) {
          const dmg = roundHalfUp(((line.amount ?? 0) + 4 * state.floor.number) * (percent / 100))
          hurtHero(content, state, victim, dmg)
          lines.push(`${dmg} to ${victim.record.name}`)
        } else if (line.customId === 'ambush-encounter') state.ruleFlags.push('trap-ambush')
        else lines.push(line.customId ?? 'custom')
        break
      }
      default:
        lines.push(line.kind)
    }
  }
  logEvent(state, 'trap', `${def.name} fires: ${lines.join(', ') || 'nothing'}`, { trap: def.id })
  if (state.ruleFlags.includes('trap-ambush')) {
    state.ruleFlags = state.ruleFlags.filter((f) => f !== 'trap-ambush')
    state.ruleFlags.push('next-fight-ambush')
    startFight(content, state, rng, 'trap')
  }
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

function startFight(content: Content, state: DelveState, rng: Rng, kind: FightKind): void {
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
  if (kind === 'boss') {
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
  // Surprise (03 §4.4): not for bosses and hunters (07 §2.8–§2.9).
  let surprised: 'party' | 'enemy' | null = null
  if (kind !== 'boss' && kind !== 'hunter') {
    const extra = (state.ruleFlags.includes('next-fight-ambush') ? 30 : 0) + (state.ruleFlags.includes('loud-boots') ? 15 : 0) + petAmbushModifier(content, state)
    state.ruleFlags = state.ruleFlags.filter((f) => f !== 'next-fight-ambush')
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
    options: { dungeonId: dungeon.id, floor: state.floor.number, floorLevel: fd.monsterLevel, autoHeroes: state.options.auto, enemyDamagePercent: state.knobs.enemyDamagePercent ?? 100, enemySpeedPercent: state.knobs.enemySpeedPercent ?? 100 },
    rng: rng.fork(`fight-${state.stats.fights}`),
  })
  state.fight = fight
  state.fightContext = { roomId: rs.roomId, kind, isMonsterRoom }
  state.phase = { kind: 'fight' }
  logEvent(state, 'fightStart', `${kind} fight: ${monsters.map((m) => m.name).join(', ')}${surprised ? ` (${surprised} surprised)` : ''}`, { kind, monsters: monsters.length, surprised })
  void zone
  continueFight(content, state, rng)
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
  state.stats.downs += fight.counters.heroDowns
  const heroIds = state.heroes.map((_, i) => `hero-${i}`)
  const lines: string[] = []
  const outcome = fight.over.outcome
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
    const loot = rollFightLoot(content, t, rng, { dungeonId: dungeon.id, floor: state.floor.number, monsters: killed, lightBand: lightBand(t, state.light).id as 'radiant', luck: partyLuck(content, t, state), knobs: { goldPercent: roundHalfUp((state.knobs.goldPercent ?? 100) * (1 + state.pactReward.goldPercent / 100)) }, isMonsterRoom: ctxF.isMonsterRoom })
    state.gold += loot.gold
    state.stats.goldFound += loot.gold
    giveItems(state, loot.items)
    for (const c of loot.consumables) giveConsumable(content, state, c)
    for (const s of loot.stones) giveConsumable(content, state, s)
    for (const p of loot.parts) {
      state.materials[p.itemId] = (state.materials[p.itemId] ?? 0) + p.quantity
      state.stats.partsFound += p.quantity
    }
    if (loot.hunterChest) rs.chests.push(loot.hunterChest)
    lines.push(`+${loot.gold} gold`, ...(loot.items.length ? [`${loot.items.length} item(s)`] : []), ...(loot.parts.length ? [`${loot.parts.reduce((s, p) => s + p.quantity, 0)} part(s)`] : []))
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
        if (state.floor.revivesLeft > 0) {
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
  } else if (outcome === 'defeat') {
    state.stats.wipes += 1
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
  let text: string = line.kind
  switch (line.kind) {
    case 'light':
      state.light = addLight(t, state.light, line.amount ?? 0)
      text = `light ${line.amount ?? 0}`
      break
    case 'loot': {
      // D-064: a curio's `loot.amount` is hundredths of R (0.05 R → 5), `percent` a share of the carried gold.
      const gold = line.amount !== undefined ? goldFor(line.amount / 100, rForFloor(state.floor.number)) : roundHalfUp((state.gold * (line.percent ?? 0)) / 100)
      state.gold = Math.max(0, state.gold + gold)
      if (gold > 0) state.stats.goldFound += gold
      else state.stats.goldLost += -gold
      text = `${gold >= 0 ? '+' : ''}${gold} gold`
      break
    }
    case 'custom': {
      if (line.customId === 'ambush-encounter' || line.customId === 'lantern-gutters') {
        if (line.customId === 'lantern-gutters') state.light = addLight(t, state.light, line.amount ?? -10)
        state.ruleFlags.push('next-fight-ambush')
        logEvent(state, 'curio', `${curio.name}: ${choice.label} → ambush`, { curio: curio.id, choice: choiceIndex, outcome: line.customId })
        startFight(content, state, rng, 'curio')
        return
      }
      if (line.customId === 'give-material') {
        const mat = [...content.items.values()].find((d) => d.kind === 'material' && d.grade === 'F')
        if (mat) {
          state.materials[mat.id] = (state.materials[mat.id] ?? 0) + (line.amount ?? 1)
          state.stats.partsFound += line.amount ?? 1
        }
        text = `materials ×${line.amount ?? 1}`
      } else if (line.customId === 'drop-item-of-grade') {
        const grade = (line.note?.match(/\b(F|E|D|C|B|A|S|SS|God)\b/)?.[1] ?? 'D') as Grade
        const pool = [...content.items.values()].filter((d) => d.grade === grade && ['weapon', 'armor', 'shield', 'ring', 'talisman'].includes(d.kind))
        if (pool.length) giveItems(state, [createItemInstance(content, rng, rng.pick(pool).id, { rollAffixes: true })])
        text = `an item (${grade})`
      } else if (line.customId === 'floor-clock-add') tickClock(content, state, line.amount ?? 0, rng)
      else if (line.customId === 'next-fight-ambush') state.ruleFlags.push('next-fight-ambush')
      else if (line.customId === 'roll-rare-part') {
        const stone = [...content.items.values()].find((d) => d.kind === 'stone')
        if (stone && rng.pct(line.percent ?? 100)) {
          state.materials[stone.id] = (state.materials[stone.id] ?? 0) + 1
          state.stats.partsFound += 1
        }
      } else text = line.customId ?? 'custom'
      break
    }
    case 'applyStatus':
      text = `${line.status} (carried into the next fight is not modelled yet)`
      break
    default:
      break
  }
  logEvent(state, 'curio', `${curio.name}: ${choice.label} → ${text}`, { curio: curio.id, choice: choiceIndex, outcome: line.kind })
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
    if (d.secret && !rs.secretRevealed) continue
    const target = state.floor.rooms[d.to]
    const label = `Door → ${target?.scouted || target?.visited ? target.kind : '?'} ${d.to}${d.locked ? ' (locked)' : ''}${d.secret ? ' (secret)' : ''}`
    let reason: string | undefined
    if (d.locked && !state.floor.hasKey) reason = 'locked: find the key'
    if (blockingTrap && blockingTrap.blocksDoorTo === d.to) reason = 'a trap blocks this door'
    out.push({ command: { kind: 'move', toRoomId: d.to }, label, enabled: !reason, reason })
  }
  rs.traps.forEach((tr, i) => {
    if (!tr.revealed || tr.disarmed || tr.triggered) return
    const def = dungeon.traps.find((x) => x.id === tr.trapId)
    state.heroes.forEach((h, hi) => {
      if (h.fallen) return
      out.push({ command: { kind: 'disarm', trapIndex: i, heroIndex: hi }, label: `Disarm ${def?.name ?? tr.trapId} (${h.record.name}, ${disarmChance(t, h.record.fieldSkills.trapDisarm.rank, def?.difficulty ?? 10)}%)`, enabled: true })
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
      const usable = /torch|potion|draught|repair|bandage|ration/i.test(def.name)
      if (!usable) continue
      out.push({ command: { kind: 'useItem', heroIndex: hi, instanceId: b.instanceId }, label: `Use ${def.name} ×${b.quantity} (${h.record.name})`, enabled: true })
    }
    if (h.record.fieldSkills.firstAid.rank >= 1) {
      state.heroes.forEach((target, ti) => {
        if (target.fallen || target.downed) out.push({ command: { kind: 'firstAid', heroIndex: hi, targetIndex: ti }, label: `First Aid on ${target.record.name} (${h.record.name})`, enabled: g.kind === 'rest' || state.floor.revivesLeft > 0, reason: state.floor.revivesLeft > 0 ? undefined : 'no revives left this floor' })
      })
    }
    if (h.record.petInstance) {
      for (const s of ['fierce', 'guard', 'mend', 'forage'] as const) if (s !== h.record.petInstance.stance) out.push({ command: { kind: 'stance', heroIndex: hi, stance: s }, label: `${h.record.petInstance.name}: ${s} stance`, enabled: true })
    }
  })
  rs.merchant?.forEach((o, i) => {
    if (o.soldOut) return
    const def = content.items.get(o.itemId)
    out.push({ command: { kind: 'buy', offerIndex: i }, label: `Buy ${def?.name ?? o.itemId} (${o.price} gold)`, enabled: state.gold >= o.price, reason: state.gold < o.price ? 'not enough gold' : undefined })
  })
  const atExit = state.floor.currentRoomId === state.floor.graph.exitId
  if (atExit && (g.kind === 'stairs' || (g.kind === 'boss' && rs.cleared))) out.push({ command: { kind: 'descend' }, label: state.floor.number >= (state.options.lastFloor ?? 99) ? 'Finish the delve' : 'Take the stairs', enabled: true })
  out.push({ command: { kind: 'retreat' }, label: `Retreat to town${state.floor.bossDefeated ? '' : ` (toll ${state.knobs.retreatTollPercent ?? t.death.retreatTollPercent}%)`}`, enabled: true })
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
      if (!pick) return state
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
      if (!door) throw new Error('no such door')
      if (door.secret && !rs.secretRevealed) throw new Error('hidden door')
      if (door.locked && !state.floor.hasKey) throw new Error('locked')
      const blocking = rs.traps.find((tr) => tr.blocksDoorTo === door.to && !tr.disarmed && !tr.triggered)
      if (blocking) throw new Error('a trap blocks the door')
      enterRoom(content, state, command.toRoomId, rng, true)
      break
    }
    case 'disarm': {
      const rs = currentRoom(state)
      const tr = rs.traps[command.trapIndex]
      const h = state.heroes[command.heroIndex]
      const def = tr ? dungeonOf(content, state).traps.find((x) => x.id === tr.trapId) : undefined
      if (!tr || !h || !def) throw new Error('no such trap')
      const chance = disarmChance(t, h.record.fieldSkills.trapDisarm.rank, def.difficulty + (state.knobs.trapDifficultyBonus ?? 0))
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
        fireTrap(content, state, rng, def, tr, 50)
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
        const rank = Math.max(...state.heroes.map((h) => h.record.fieldSkills.lockpicking.rank))
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
          h.fallen = false
          h.hpPercent = t.death.postFightReviveHpPercent
        } else h.hpPercent = Math.min(100, h.hpPercent + t.exploration.rest.restorePercent)
        h.poolPercent = Math.min(100, h.poolPercent + t.exploration.rest.restorePercent)
        if (command.treat && h.record.petInstance && !h.treatUsed) h.treatUsed = true
        if (command.cookAttribute && h.record.fieldSkills.cooking.rank >= 1) h.cooked = command.cookAttribute
      }
      tickClock(content, state, t.exploration.floorClock.restAdvances, rng)
      logEvent(state, 'rest', 'The party rests')
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
      if (/torch/i.test(name)) {
        state.light = addLight(t, state.light, state.knobs.torchValue ?? t.exploration.light.torch)
        state.stats.torchesUsed += 1
      } else if (/repair/i.test(name)) {
        const eq = h.record.equipment
        const worst = (['mainHand', 'offHand', 'helmet', 'chest', 'legs', 'boots', 'gloves'] as const).map((s) => ({ s, inst: eq[s] })).filter((x) => x.inst).sort((a, b) => a.inst!.durability - b.inst!.durability)[0]
        if (worst?.inst) h.record = { ...h.record, equipment: { ...eq, [worst.s]: repairKit(t, worst.inst).inst } }
      } else {
        for (const line of def.consumable.effects) {
          if (line.kind === 'heal' && line.percent !== undefined) h.hpPercent = Math.min(100, h.hpPercent + line.percent)
          if (line.kind === 'pool' && line.percent !== undefined) h.poolPercent = Math.min(100, h.poolPercent + line.percent)
          if (line.kind === 'light') state.light = addLight(t, state.light, line.amount ?? 0)
        }
      }
      const bag = [...h.record.bag]
      if (inst.quantity > 1) bag[i] = { ...inst, quantity: inst.quantity - 1 }
      else bag.splice(i, 1)
      h.record = { ...h.record, bag }
      logEvent(state, 'item', `${h.record.name} uses ${name}`)
      break
    }
    case 'firstAid': {
      const h = state.heroes[command.heroIndex]
      const target = state.heroes[command.targetIndex]
      if (!h || !target || (!target.fallen && !target.downed)) throw new Error('nothing to do')
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
    floor: { number: state.floor.number, hash: state.floor.graph.hash, rooms: state.floor.rooms, current: state.floor.currentRoomId, clock: state.floor.clock, hunter: state.floor.hunter, revives: state.floor.revivesLeft, key: state.floor.hasKey, boss: state.floor.bossDefeated },
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
