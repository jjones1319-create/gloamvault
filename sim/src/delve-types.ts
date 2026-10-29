import type { FightCommand, FightState } from './fight-types.ts'
import type { FloorGraph } from './generator.ts'
import type { DungeonChest } from './loot.ts'
import type { PolicyName } from './policies.ts'
import type { RngState } from './rng.ts'
import type { Effect, HeroRecord, ItemInstance } from './types/content.ts'
import type { ThreatRead } from './threat.ts'
import type { DeathRule, DerivedStat, Difficulty, Stance, Status, Target } from './types/enums.ts'

/**
 * A delve (03-GAME-DESIGN §1, §4, §11, §12): one trip into a zone, floor by floor, as plain serialisable data.
 * `seed + commandLog` replays it (D-014); everything else is derived. The client reads it and sends commands.
 */
export type DelveCommand =
  | { kind: 'move'; toRoomId: string }
  | { kind: 'fight'; command: FightCommand }
  | { kind: 'curio'; choice: number }
  | { kind: 'disarm'; trapIndex: number; heroIndex: number }
  | { kind: 'walkAround'; trapIndex: number }
  | { kind: 'openChest'; chestIndex: number; useKey: boolean; heroIndex: number }
  | { kind: 'takeGold' }
  | { kind: 'rest'; cookAttribute?: string; treat?: boolean }
  | { kind: 'fieldRepair'; heroIndex: number; slot: string }
  | { kind: 'useItem'; heroIndex: number; instanceId: string }
  | { kind: 'firstAid'; heroIndex: number; targetIndex: number }
  /** D-089: a healer of level 10+ with a revive skill raises a dead hero out of a fight (Mortal). */
  | { kind: 'raise'; heroIndex: number; targetIndex: number }
  | { kind: 'stance'; heroIndex: number; stance: Stance }
  | { kind: 'buy'; offerIndex: number }
  /** Sell Dunmore Quist parts the delve found (07 §2.7: he buys at 40% + 0.5% per Haggling rank; Phase 7). */
  | { kind: 'sell'; itemId: string; quantity: number }
  /** A loadout active's corridor use (D-099): its Stamina, no turn, no floor-clock tick (sim/src/corridor.ts). */
  | { kind: 'corridorSkill'; heroIndex: number; skillId: string }
  /** An after-fight relic (08 §3, the Hollow Coin): re-roll the fight's gear drop, once per floor (sim/src/relics.ts). */
  | { kind: 'relic'; heroIndex: number }
  | { kind: 'descend' }
  | { kind: 'retreat' }
  | { kind: 'continue' }
  | { kind: 'auto' }

export interface LegalDelveAction {
  command: DelveCommand
  label: string
  enabled: boolean
  reason?: string
  /** A move into a room whose fight the party knows of (visited or scouted): how dangerous it reads (D-092). */
  threat?: ThreatRead
}

export interface TrapState {
  trapId: string
  revealed: boolean
  disarmed: boolean
  triggered: boolean
  /** The door it blocks (room id), or null. */
  blocksDoorTo: string | null
}

export interface MerchantOffer {
  itemId: string
  quantity: number
  /** Gold after the merchant's markup and Haggling. */
  price: number
  soldOut: boolean
}

export interface RoomState {
  roomId: string
  kind: FloorGraph['rooms'][number]['kind']
  /** Scouted from a neighbour: the contents show on the map before entering. */
  scouted: boolean
  visited: boolean
  /** The fight here is done (won or fled from). */
  cleared: boolean
  encounterId: string | null
  /** Champion affixes drawn for an Elite room. */
  championAffixIds: string[]
  curioId: string | null
  curioUsed: boolean
  traps: TrapState[]
  chests: DungeonChest[]
  goldPiles: number[]
  restUsed: boolean
  merchant: MerchantOffer[] | null
  /** The hidden treasure (08 §11) already found. */
  hiddenFound: boolean
  secretRevealed: boolean
}

export interface HunterState {
  monsterId: string
  entered: boolean
  /** The room the hunter is in once it has entered. */
  roomId: string | null
  /** Ticks accumulated toward its next move. */
  moveProgress: number
  killed: boolean
}

export interface FloorRun {
  number: number
  /** The global floor number (the dungeon's). */
  monsterLevel: number
  graph: FloorGraph
  rooms: Record<string, RoomState>
  currentRoomId: string
  clock: number
  hunter: HunterState | null
  revivesLeft: number
  /** The Key-and-Lock pair: has the party picked the key up. */
  hasKey: boolean
  bossDefeated: boolean
  lastEncounterId: string | null
  firstFightDone: boolean
  /** The secret record this floor's secret room holds (07 §2.6), drawn when the floor begins; null when none. */
  secretId: string | null
  /** A secret's crawlway to the exit room (the Company's Bolt-hole): a free move offered from the secret room. */
  shortcutTo: string | null
  /** Percent added to fight gold for the rest of the floor (a paid Toll Shrine). */
  goldPercentBonus: number
  /** Extra surprise for the next fight when `ruleFlags` carries 'next-fight-ambush' (a Tripwire Bell: 30). */
  ambushPercent: number
  /** Raises from the dead this floor by healer index (D-089: once per healer per floor). */
  raisesUsed: Record<string, number>
  /** Mourner's Candles (07 §2.4): new rooms left whose fight cannot surprise the party. Optional; absent = 0 (C1). */
  quietRooms?: number
  /** A turned Rusted Sluice Wheel (07 §2.4): the next Tide Gate on this floor floods nothing. Optional (C1). */
  sluiceDrained?: boolean
  /** After-fight relic uses this floor, by "<heroIndex>:<relicId>" (the Hollow Coin, once per floor; relics.ts). Optional. */
  relicUses?: Record<string, number>
  /** Twin Hunter (07 §6.2): the second hunter, entering with the first from the floor's other end. Absent without the Pact. */
  twinHunter?: HunterState | null
  /** Trailblaze's corridor use (D-099): the ambush shift for the next room entered, then for the fights there. */
  ambushShiftNext?: number
  ambushShiftHere?: number
  /** Double Time's corridor use: room entries left that share one floor-clock tick, and whether it has been paid. */
  roomsPerTick?: { left: number; paid: boolean }
}

/**
 * A status a curio, trap or secret hands to the party out of combat (07 §2.4–§2.6): applied to the party actors
 * the `target` word names right after each fight is created, for `fightsLeft` fights (null: every fight until the
 * floor ends). Kind 'resist' installs a `status-resist-bonus` hook of `percent` instead (a floor's Fear immunity).
 */
export interface PendingStatus {
  /**
   * 'status' applies `status`; 'resist' installs `status-resist-bonus` (`percent`); 'hook' installs `line` (a custom line,
   * the Vigil's +15% Holy); 'modifier' adds `amount` to `stat` for the fight (the Tide Gate's wading) — C1, Phase 7.
   */
  kind: 'status' | 'resist' | 'hook' | 'modifier'
  /** The status of kinds 'status' and 'resist' (absent on 'hook' and 'modifier'). */
  status?: Status
  target: Target
  duration?: number
  /** For a status whose record reads a magnitude (a DoT's per-tick damage, Regen's percent). */
  magnitude?: number
  percent?: number
  fightsLeft: number | null
  sourceId: string
  /** The one hero it lands on (a trap's victim, a curio's reader: `hero-<index>`); absent: every actor `target` names. Optional (C1). */
  heroIndex?: number
  /** Kind 'hook': the custom line installed on each target at the fight's start. Optional (C1). */
  line?: Effect
  /** Kind 'modifier': the stat and the flat amount (the wading's −10 Speed and Accuracy). Optional (C1). */
  stat?: DerivedStat
  amount?: number
  /** Kind 'modifier': the monsters take it too ("for everyone, both sides"). Optional (C1). */
  bothSides?: boolean
  /** A Shield's absorb as a share of each target's own max HP (the Tide Altar's 30%, the Undertow's 20%). Optional (C1). */
  maxHpPercent?: number
}

export interface DelveHero {
  record: HeroRecord
  /** HP carried between fights (percent of max). */
  hpPercent: number
  poolPercent: number
  downed: boolean
  fallen: boolean
  /** Per-skill meaningful uses this delve (the use budget, 03 §5.1). */
  skillUses: Record<string, number>
  insight: { usesSincePity: number }
  treatUsed: boolean
  cooked: string | null
  /** Sub-percent wear carried per equipment slot between fights (basis points). */
  wearCarry: Record<string, number>
  /** What grew this delve, for the result screen. */
  growth: { skills: Record<string, number>; attributes: Record<string, number>; items: Record<string, number>; insights: string[]; levelsGained: number }
  petHpPercent: number
}

export interface DelveStats {
  rooms: number
  fights: number
  eliteFights: number
  bossFights: number
  roundsByKind: Record<string, number[]>
  ambushedParty: number
  ambushedMonsters: number
  trapsRevealed: number
  trapsTriggered: number
  trapsDisarmed: number
  curiosUsed: number
  chestsOpened: number
  torchesUsed: number
  hunterArrived: number
  hunterKilled: number
  downs: number
  wipes: number
  goldFound: number
  goldLost: number
  itemsFound: number
  partsFound: number
  insights: number
  secretsFound: number
  ticksToStairs: number[]
  lightAtStairs: number[]
  fled: number
  xpEvents: number
  /** Hooks that ran as documented stubs (`hookStub` events), by hook id (sim/src/skills/custom/README.md). */
  hookStubs: Record<string, number>
  /** The deepest floor whose way down (stairs or a beaten boss) the party reached: the next delve may start below it (D-083). */
  deepestFloorCompleted: number
  /** Heroes still fallen when a fight ended, wipes included: under Mortal each one died (D-088). */
  falls: number
  /** Dead heroes raised by a healer in the dungeon (D-089). */
  raises: number
  /** One row per boss fight, written when it ends (07 §8.2: the arena mechanics the runner counts; arena.ts). Optional; absent = none. */
  bossArenas?: BossArenaRecord[]
}

export type DelvePhase =
  | { kind: 'room' }
  | { kind: 'fight' }
  | { kind: 'result'; title: string; lines: string[] }
  | { kind: 'curio'; curioId: string }
  | { kind: 'over'; outcome: 'cleared' | 'retreated' | 'wiped' | 'capped' | 'chosenDied'; summary: string }

export interface DelveEvent {
  floor: number
  roomId: string
  kind: string
  text: string
  data?: Record<string, number | string | boolean | null>
}

export interface DelveOptions {
  dungeonId: string
  /** Start zone (1-based) or an explicit floor; the zone wins when both are given. */
  zone?: number
  floor?: number
  /** A 64-bit seed as two u32 halves or one safe integer. */
  seed: number | readonly [number, number]
  difficulty: Difficulty
  pactIds: readonly string[]
  /** Light at the start of the delve; the preset's lightStart when omitted. */
  light?: number
  /** Heroes under auto-play use their AI rules and the scripted door policy. */
  auto: boolean
  policy: PolicyName
  /** The first-ever delve: F1 is the fixed 3-room tutorial (D-038). */
  firstDelve?: boolean
  /** Stop the delve after this floor (the zone's last floor by default). */
  lastFloor?: number
  /** The save's death rule (D-088, D-095): Mortal, the dead stay dead; Nightmare, Mortal and the leader's death ends the delve; Sheltered (the default here), the Phase 3 revives. */
  deathRule?: DeathRule
  /** Under Nightmare (D-095): the chosen hero, who leads the delve; their death ends it, and the save. */
  leaderId?: string
  /**
   * The profile's boss kills when the delve began (progress.bossKills): a boss with none pays its first-kill lines when
   * it dies (06 §3, 08 §11). Optional; absent = no kills recorded, so a boss dies for the first time.
   */
  bossKills?: Readonly<Record<string, number>>
  /**
   * The purse the party carried in (03 §8.1: at risk in the delve). The delve starts with it as its gold, so a replay
   * after a reload keeps it, and Bank Run (07 §7) counts only what the delve itself brought home. Optional; absent = 0.
   */
  purseIn?: number
}

export interface DelveState {
  version: number
  seed: readonly [number, number]
  rng: RngState
  options: DelveOptions
  heroes: DelveHero[]
  /** The shared pile and the party's purse (03 §10.2): gold is split at banking. */
  gold: number
  bankedAtStart: number
  pile: ItemInstance[]
  materials: Record<string, number>
  floor: FloorRun
  light: number
  phase: DelvePhase
  fight: FightState | null
  /** The fight's room and kind, for the result and the stats. */
  fightContext: { roomId: string; kind: 'fight' | 'elite' | 'boss' | 'hunter' | 'trap' | 'curio'; isMonsterRoom: boolean } | null
  commandLog: DelveCommand[]
  log: DelveEvent[]
  stats: DelveStats
  /** Difficulty knobs after the preset and the Pacts. */
  knobs: Record<string, number>
  ruleFlags: string[]
  /** The pacts' extra percentages. */
  pactReward: { goldPercent: number; xpPercent: number; chestShiftPp: number }
  /** Statuses waiting for the next fight(s) (a Larder's Regen, a Tar Pot's Burn, a shrine's Curse for the floor). */
  pendingStatuses: PendingStatus[]
  /**
   * The hunters killed this delve, by monster id (07 §2.8–§2.9: a hunter the party killed sits out the Hollow King's
   * last phase; the Warden's Hound killed on F4–5 is absent from the Warden's side on F6). Written by finishFight;
   * read by the arena (pass C2). Optional; absent = none (C1, Phase 7).
   */
  huntersKilled?: string[]
  /** Boss rewards the town pays at settlement (a title, +1 Luck) because the delve cannot: town.ts settleDelve. Optional. */
  bossRewards?: BossTownReward[]
  /** The last won fight's gear drop on the pile, which the Hollow Coin may re-roll (relics.ts); null once the party moves on. Optional. */
  lastFightDrop?: { pileIndex: number } | null
}

/** A boss reward line the town pays when the delve is settled (06 §3 first kills): a title or +1 Luck for the party standing. */
export interface BossTownReward {
  bossId: string
  kind: 'title' | 'luck' | 'waystone'
  /** The title id, the zone id; absent for Luck. */
  id?: string
  amount: number
}

/** A boss fight's arena tally (07 §8.2), kept on the delve's stats after the fight is gone. */
export interface BossArenaRecord {
  boss: string
  floor: number
  outcome: 'victory' | 'defeat' | 'fled' | 'cap'
  rounds: number
  /** The phase reached, 1-based. */
  phase: number
  firstKill: boolean
  lightMin: number
  lightEnd: number
  lanternsOut: number
  candlesOut: number
  doorsOpened: boolean
  tideMax: number
  sluiceTurns: number
  braziersLit: number
  torchesUsed: number
  recalls: number
  huntersReturned: number
  huntersSkipped: number
  pulls: number
  /** Part ids broken, comma-joined. */
  partsBroken: string
  tells: number
  tellsBroken: number
}
