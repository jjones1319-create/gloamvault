import type { Content } from './content.ts'
import type { MerchantOffer, RoomState, TrapState } from './delve-types.ts'
import { townPrice } from './economy.ts'
import type { Actor } from './fight-types.ts'
import type { FloorGraph, FloorRoom } from './generator.ts'
import { installHook } from './hooks.ts'
import { createItemInstance } from './items.ts'
import { buildMonsterActor, monsterLevelOnFloor, partyScale, scaledCount } from './monsters.ts'
import type { Rng } from './rng.ts'
import { roundHalfUp } from './stats.ts'
import type { Tuning } from './tuning.ts'
import type { CurioDef, DungeonDef, EncounterDef, FloorDef, MonsterDef, TrapDef, ZoneDef } from './types/content.ts'

/**
 * Exploring a floor (03-GAME-DESIGN §4, §11.1–§11.2; 07 §2.3–§2.7): the rules that fill a generated room with
 * an encounter, a champion, traps, a curio or a merchant, and that spawn the monsters for a fight. Pure functions
 * over content and the seeded rng; the delve module owns the state machine.
 */
export const EXPLORE_RULES = {
  /** A non-fixed room's chance to hold one trap from the zone's pool (D-064). */
  trapChancePercent: 25,
  /** Traps in a trap gauntlet. */
  gauntletTraps: { min: 2, max: 3 },
  /** A Monster-role encounter at most once per floor (06 §8.2). */
  monsterRoomsPerFloor: 1,
}

export function floorDef(dungeon: DungeonDef, floor: number): FloorDef {
  const f = dungeon.floors.find((x) => x.floor === floor)
  if (!f) throw new Error(`${dungeon.id} has no floor ${floor}`)
  return f
}

export function zoneOf(dungeon: DungeonDef, floor: number): ZoneDef {
  const z = dungeon.zones.find((x) => floor >= x.floors.from && floor <= x.floors.to)
  if (!z) throw new Error(`${dungeon.id} has no zone for floor ${floor}`)
  return z
}

export function zoneByIndex(dungeon: DungeonDef, index1: number): ZoneDef {
  const z = dungeon.zones[Math.max(0, index1 - 1)]
  if (!z) throw new Error(`${dungeon.id} has no zone ${index1}`)
  return z
}

/** Encounters legal on a floor: the floor's tables, the floor inside the entry's band. */
export function encountersFor(content: Content, floor: FloorDef, dungeonId: string): EncounterDef[] {
  const out: EncounterDef[] = []
  for (const tableId of floor.encounterTableIds) {
    for (const e of content.encountersByTable.get(tableId) ?? []) {
      if (e.dungeonId !== dungeonId) continue
      if (floor.floor < e.floorBand.min || floor.floor > e.floorBand.max) continue
      out.push(e)
    }
  }
  return out
}

export function encounterRoles(content: Content, e: EncounterDef): Set<string> {
  const roles = new Set<string>()
  for (const slot of e.composition) {
    const m = content.monsters.get(slot.monsterId)
    if (m) roles.add(m.role)
  }
  return roles
}

export function isMonsterEncounter(content: Content, e: EncounterDef): boolean {
  return encounterRoles(content, e).has('monster')
}

/** Draws an encounter (07 §2.3): equal table weights folded into the entries' weights, never the same twice in a row. */
export function pickEncounter(content: Content, rng: Rng, floor: FloorDef, dungeonId: string, previousId: string | null, monsterRoomsUsed: number, elite: boolean): EncounterDef | null {
  let pool = encountersFor(content, floor, dungeonId)
  if (elite) pool = pool.filter((e) => e.eliteAllowed && !isMonsterEncounter(content, e))
  if (monsterRoomsUsed >= EXPLORE_RULES.monsterRoomsPerFloor) pool = pool.filter((e) => !isMonsterEncounter(content, e))
  const notPrevious = pool.filter((e) => e.id !== previousId)
  const candidates = notPrevious.length ? notPrevious : pool
  if (candidates.length === 0) return null
  return rng.weighted(candidates, (e) => e.weight)
}

/** 06 §8.2's role mix over a floor's encounters: ≥ 2 fodder-only packs, ≥ 1 with a Special, ≥ 1 role-Elite from F2, ≤ 1 Monster. */
export function meetsRoleMix(content: Content, encounterIds: readonly string[], floor: number): boolean {
  let fodderOnly = 0
  let special = 0
  let elite = 0
  let monster = 0
  for (const id of encounterIds) {
    const e = content.encounters.get(id)
    if (!e) continue
    const roles = encounterRoles(content, e)
    if (roles.size === 1 && roles.has('fodder')) fodderOnly++
    if (roles.has('special')) special++
    if (roles.has('elite')) elite++
    if (roles.has('monster')) monster++
  }
  if (encounterIds.length < 3) return true
  return fodderOnly >= 2 && special >= 1 && (floor < 2 || elite >= 1) && monster <= 1
}

/** Champion affixes for an Elite room (06 §2): count by floor, at most one defensive and one control. */
export function drawChampionAffixes(content: Content, rng: Rng, monster: MonsterDef, count: number): string[] {
  const pool = monster.elitePool.map((id) => content.eliteAffixes.get(id)).filter((a): a is NonNullable<typeof a> => a !== undefined)
  const chosen: string[] = []
  let defensive = 0
  let control = 0
  const remaining = rng.shuffle(pool)
  for (const affix of remaining) {
    if (chosen.length >= count) break
    if (affix.affixClass === 'defensive' && defensive >= 1) continue
    if (affix.affixClass === 'control' && control >= 1) continue
    chosen.push(affix.id)
    if (affix.affixClass === 'defensive') defensive++
    if (affix.affixClass === 'control') control++
  }
  return chosen
}

export interface SpawnOptions {
  level: number
  partySize: number
  enemyHpPercent: number
  enemyCountPercent: number
  /** Elite room: the champion's affixes go on the first elite-role monster (else the first non-fodder, else the first). */
  championAffixIds?: string[]
}

/** The monster actors of an encounter at this party size (03 §11.2, 06 §8.1). */
export function spawnEncounter(content: Content, t: Tuning, _rng: Rng, encounter: EncounterDef, opts: SpawnOptions): Actor[] {
  const scale = partyScale(t, opts.partySize)
  const actors: Actor[] = []
  let championGiven = false
  const slots = [...encounter.composition]
  // The champion goes on the elite-role slot when there is one.
  const eliteFirst = slots.sort((a, b) => {
    const ra = content.monsters.get(a.monsterId)?.role === 'elite' ? 0 : 1
    const rb = content.monsters.get(b.monsterId)?.role === 'elite' ? 0 : 1
    return ra - rb
  })
  const counts = scaleComposition(content, eliteFirst, roundHalfUp((scale.countPercent * opts.enemyCountPercent) / 100))
  for (const [slotIndex, slot] of eliteFirst.entries()) {
    const def = content.monsters.get(slot.monsterId)
    if (!def) throw new Error(`encounter ${encounter.id} names unknown monster ${slot.monsterId}`)
    const count = counts[slotIndex] ?? 0
    for (let i = 0; i < count; i++) {
      const champion = !championGiven && opts.championAffixIds && opts.championAffixIds.length > 0 && def.role !== 'monster'
      if (champion) championGiven = true
      actors.push(
        buildMonsterActor(content, t, def, {
          id: `${def.id}-${actors.length}`,
          level: monsterLevelOnFloor(def, opts.level),
          row: slot.row,
          hpPercent: scale.hpPercent,
          enemyHpPercent: opts.enemyHpPercent,
          champion: champion ? { affixIds: [...(opts.championAffixIds ?? [])] } : null,
          nameSuffix: champion ? ' (champion)' : count > 1 ? ` ${i + 1}` : '',
        }),
      )
    }
  }
  // Champion affix effect lines (set-speed, attack +10%) at spawn; zero-weight trigger attacks arm their hooks.
  for (const a of actors) {
    installPassiveAttackHooks(a)
    const m = a.monster
    if (!m?.champion) continue
    for (const id of m.champion.affixIds) {
      const affix = content.eliteAffixes.get(id)
      for (const line of affix?.effects ?? []) {
        if (line.kind === 'buffStat' && line.stat) a.modifiers.push({ stat: line.stat, amount: line.amount ?? 0, percent: line.percent ?? 0, turnsLeft: 999, sourceId: id })
        if (line.kind === 'custom' && line.customId === 'set-speed' && line.amount !== undefined) a.base.speed = line.amount
        else if (line.kind === 'custom' && line.customId) installHook(a, line, id)
      }
    }
  }
  return actors
}

/**
 * Party-size scaling of a composition (03 §11.2, 06 §8.1): the *total* of the scalable slots (fodder, elite) is
 * scaled and rounded, minimum 1, then shared out by trimming the largest slot first; Specials, Monsters, bosses
 * and hunters are never removed (D-069: per-slot rounding gave a solo party 3 rats out of 4 instead of 2.4 → 2).
 */
export function scaleComposition(content: Content, slots: readonly { monsterId: string; count: number }[], percent: number): number[] {
  const scalable = slots.map((s) => {
    const role = content.monsters.get(s.monsterId)?.role ?? 'fodder'
    return role === 'fodder' || role === 'elite'
  })
  const per = slots.map((s, i) => (scalable[i] ? Math.max(0, roundHalfUp((s.count * percent) / 100)) : s.count))
  const scalableTotal = slots.reduce((sum, s, i) => sum + (scalable[i] ? s.count : 0), 0)
  const fixedTotal = slots.reduce((sum, s, i) => sum + (scalable[i] ? 0 : s.count), 0)
  let target = roundHalfUp((scalableTotal * percent) / 100)
  if (scalableTotal > 0 && fixedTotal === 0) target = Math.max(1, target)
  const sum = () => per.reduce((a, b, i) => a + (scalable[i] ? b : 0), 0)
  let guard = 0
  while (sum() > target && guard++ < 50) {
    let best = -1
    for (let i = 0; i < per.length; i++) if (scalable[i] && (per[i] ?? 0) > 0 && (best < 0 || (per[i] ?? 0) > (per[best] ?? 0))) best = i
    if (best < 0) break
    per[best] = (per[best] ?? 0) - 1
  }
  guard = 0
  while (sum() < target && guard++ < 50) {
    let best = -1
    for (let i = 0; i < per.length; i++) if (scalable[i] && (per[i] ?? 0) < (slots[i]?.count ?? 0) && (best < 0 || (per[i] ?? 0) < (per[best] ?? 0))) best = i
    if (best < 0) break
    per[best] = (per[best] ?? 0) + 1
  }
  return per
}

/**
 * A zero-weight attack that does not hit is a passive trigger (06 §3.1: "fires when this rat dies, not as an
 * action" — the Giant Rat's Swarm Turns, the Cellar Hound's Handler's Fall): its custom lines are installed on the
 * monster as hooks at spawn so their `onDeath` / `onTurnStart` rules are armed from the first tick. The hook's
 * source is the monster itself, which is what the handlers' `apply` installs too, so the rare action pick replaces
 * rather than stacks.
 */
export function installPassiveAttackHooks(actor: Actor): void {
  const m = actor.monster
  if (!m) return
  for (const attack of m.attacks) {
    if (attack.aiWeight !== 0 || attack.multiplier !== 0) continue
    for (const line of attack.effects) if (line.kind === 'custom' && line.customId) installHook(actor, line, actor.id, { sourceSkillId: attack.id })
  }
}

export function spawnSingle(content: Content, t: Tuning, def: MonsterDef, opts: { id: string; level: number; partySize: number; enemyHpPercent: number; row?: 'front' | 'back' }): Actor {
  const scale = partyScale(t, opts.partySize)
  const actor = buildMonsterActor(content, t, def, { id: opts.id, level: monsterLevelOnFloor(def, opts.level), row: opts.row ?? def.rows[0] ?? 'front', hpPercent: scale.hpPercent, enemyHpPercent: opts.enemyHpPercent })
  installPassiveAttackHooks(actor)
  return actor
}

/** A pack of one template (an ambush curio or trap, 07 §2.4–§2.5): `count` scaled by party size like any slot (03 §11.2), numbered names. */
export function spawnPack(content: Content, t: Tuning, def: MonsterDef, opts: { count: number; level: number; partySize: number; enemyHpPercent: number }): Actor[] {
  const scale = partyScale(t, opts.partySize)
  const n = Math.max(1, scaledCount(opts.count, scale.countPercent, def.role))
  const out: Actor[] = []
  for (let i = 0; i < n; i++) {
    const actor = buildMonsterActor(content, t, def, { id: `${def.id}-${i}`, level: monsterLevelOnFloor(def, opts.level), row: def.rows[0] ?? 'front', hpPercent: scale.hpPercent, enemyHpPercent: opts.enemyHpPercent, nameSuffix: n > 1 ? ` ${i + 1}` : '' })
    installPassiveAttackHooks(actor)
    out.push(actor)
  }
  return out
}

/** The boss and its first-phase adds (06 §3; 07 §2.8 owns timing, read as "present at the start"). */
export function spawnBossFight(content: Content, t: Tuning, boss: MonsterDef, opts: { level: number; partySize: number; enemyHpPercent: number }): Actor[] {
  const actors = [spawnSingle(content, t, boss, { id: boss.id, level: opts.level, partySize: opts.partySize, enemyHpPercent: opts.enemyHpPercent, row: boss.rows[0] ?? 'back' })]
  const phase0 = boss.boss?.phases[0]
  for (const add of phase0?.adds ?? []) {
    const def = content.monsters.get(add.monsterId)
    if (!def) continue
    const scale = partyScale(t, opts.partySize)
    const count = scaledCount(add.count, scale.countPercent, def.role)
    for (let i = 0; i < count; i++) actors.push(spawnSingle(content, t, def, { id: `${def.id}-add${i}`, level: opts.level, partySize: opts.partySize, enemyHpPercent: opts.enemyHpPercent, row: add.row }))
  }
  return actors
}

/* ---------- traps, curios, merchants ---------- */

export function trapsForZone(dungeon: DungeonDef, zoneId: string, floor: FloorDef, difficultyBonus: number): TrapDef[] {
  return dungeon.traps.filter((tr) => (tr.zoneId === null || tr.zoneId === zoneId) && tr.difficulty + difficultyBonus >= floor.trapBand.min && tr.difficulty + difficultyBonus <= floor.trapBand.max + difficultyBonus)
}

export function curiosForZone(dungeon: DungeonDef, zoneId: string): CurioDef[] {
  return dungeon.curios.filter((c) => c.zoneId === null || c.zoneId === zoneId)
}

/** Dresses a generated room: the encounter is the generator's; traps, curios and chests are rolled here (D-064). */
export function dressRoom(_content: Content, rng: Rng, dungeon: DungeonDef, zone: ZoneDef, floor: FloorDef, room: FloorRoom, used: { curios: Set<string>; traps: string[] }, difficultyBonus: number): RoomState {
  const traps: TrapState[] = []
  const pool = trapsForZone(dungeon, zone.id, floor, difficultyBonus)
  const addTrap = () => {
    if (pool.length === 0) return
    const fresh = pool.filter((p) => !used.traps.includes(p.id))
    const tr = rng.pick(fresh.length ? fresh : pool)
    used.traps.push(tr.id)
    const blocks = tr.blocksDoor && room.doors.length > 1 ? (room.doors[1]?.to ?? null) : null
    traps.push({ trapId: tr.id, revealed: false, disarmed: false, triggered: false, blocksDoorTo: blocks })
  }
  if (room.kind === 'trapGauntlet') {
    const n = rng.range(EXPLORE_RULES.gauntletTraps.min, EXPLORE_RULES.gauntletTraps.max)
    for (let i = 0; i < n; i++) addTrap()
  } else if (room.kind !== 'entry' && room.kind !== 'boss' && room.kind !== 'rest' && rng.pct(EXPLORE_RULES.trapChancePercent)) addTrap()

  let curioId: string | null = null
  if (room.kind === 'curio') {
    const curios = curiosForZone(dungeon, zone.id)
    const fresh = curios.filter((c) => !used.curios.has(c.id))
    const c = fresh.length ? rng.pick(fresh) : curios.length ? rng.pick(curios) : null
    if (c) {
      curioId = c.id
      used.curios.add(c.id)
    }
  }
  return {
    roomId: room.id,
    kind: room.kind,
    scouted: false,
    visited: false,
    cleared: room.kind !== 'fight' && room.kind !== 'elite' && room.kind !== 'boss' && room.kind !== 'keyRoom',
    encounterId: room.encounterId,
    championAffixIds: [],
    curioId,
    curioUsed: false,
    traps,
    chests: [],
    goldPiles: [],
    restUsed: false,
    merchant: null,
    hiddenFound: false,
    secretRevealed: false,
  }
}

/** Dunmore Quist's cart (07 §2.7): seeded stock at 1.5× town prices after Haggling. */
export function merchantStock(content: Content, t: Tuning, rng: Rng, r: number, hagglingRank: number, floorCentreGrade: string, classIds: readonly string[]): MerchantOffer[] {
  const offers: MerchantOffer[] = []
  const add = (itemId: string, quantity: number, priceR: number) => {
    if (!content.items.has(itemId)) return
    offers.push({ itemId, quantity, price: townPrice(t, priceR, r, hagglingRank, roundHalfUp(t.economy.merchantMarkup * 100)), soldOut: false })
  }
  const find = (pred: (d: { id: string; kind: string; name: string }) => boolean) => [...content.items.values()].filter(pred)
  const potion = find((d) => d.kind === 'consumable' && /potion|draught/i.test(d.name))[0]
  if (potion) add(potion.id, 4, 0.03)
  const torch = find((d) => d.kind === 'consumable' && /torch/i.test(d.name))[0]
  if (torch) add(torch.id, 3, 0.02)
  const kit = find((d) => d.kind === 'consumable' && /repair/i.test(d.name))[0]
  if (kit) add(kit.id, 2, 0.08)
  const key = find((d) => d.kind === 'key' && /skeleton/i.test(d.name))[0]
  if (key) add(key.id, 1, 0.3)
  const safe = find((d) => d.kind === 'consumable' && /flint|salt|candle|glass|cloak|plugs|rope|vial/i.test(d.name))
  for (const s of rng.shuffle(safe).slice(0, 2)) add(s.id, 2, 0.05)
  const gear = [...content.items.values()].filter((d) => d.grade === floorCentreGrade && ['weapon', 'armor', 'shield', 'focus'].includes(d.kind) && (d.classLock.length === 0 || d.classLock.some((c) => classIds.includes(c))))
  for (const g of rng.shuffle(gear).slice(0, rng.range(2, 3))) offers.push({ itemId: g.id, quantity: 1, price: roundHalfUp((g.value * roundHalfUp(t.economy.merchantMarkup * 100) * 130) / 10_000), soldOut: false })
  if (rng.pct(10)) {
    const stone = find((d) => d.kind === 'stone')[0]
    if (stone) add(stone.id, 1, 0.04)
  }
  return offers
}

/** A merchant purchase: creates the instance and marks the line. */
export function buyOffer(content: Content, rng: Rng, offer: MerchantOffer) {
  return createItemInstance(content, rng, offer.itemId, { quantity: 1 })
}

/** BFS hops from a room over doors the hunter may use (locked doors do not stop it; secrets do). */
export function hopsFrom(graph: FloorGraph, startId: string): Map<string, { hops: number; via: string | null }> {
  const out = new Map<string, { hops: number; via: string | null }>()
  const queue: string[] = [startId]
  out.set(startId, { hops: 0, via: null })
  while (queue.length) {
    const id = queue.shift() as string
    const room = graph.rooms.find((r) => r.id === id)
    if (!room) continue
    for (const d of room.doors) {
      if (d.secret) continue
      if (out.has(d.to)) continue
      out.set(d.to, { hops: (out.get(id)?.hops ?? 0) + 1, via: id })
      queue.push(d.to)
    }
  }
  return out
}

/** The next room on the shortest path from `from` toward `to`. */
export function stepToward(graph: FloorGraph, from: string, to: string): string {
  const hops = hopsFrom(graph, to)
  const here = hops.get(from)
  if (!here || here.hops === 0) return from
  // Walk neighbours: the one with hops − 1.
  const room = graph.rooms.find((r) => r.id === from)
  for (const d of room?.doors ?? []) {
    if (d.secret) continue
    const h = hops.get(d.to)
    if (h && h.hops === here.hops - 1) return d.to
  }
  return from
}

/** The room farthest from the party, where a hunter enters. */
export function farthestRoom(graph: FloorGraph, fromId: string): string {
  const hops = hopsFrom(graph, fromId)
  let best = fromId
  let bestHops = -1
  for (const r of graph.rooms) {
    if (r.kind === 'secret') continue
    const h = hops.get(r.id)?.hops ?? -1
    if (h > bestHops) {
      best = r.id
      bestHops = h
    }
  }
  return best
}

/** Light-restoring props in a template (03 §4.2: braziers +15). */
export function templateHasBrazier(dungeon: DungeonDef, templateId: string): boolean {
  const tpl = dungeon.templates.find((x) => x.id === templateId)
  return tpl?.props.some((p) => p.lightSource) ?? false
}
