import type { FightCommand, FightState } from './fight-types.ts'
import type { FloorGraph } from './generator.ts'
import type { DungeonChest } from './loot.ts'
import type { RngState } from './rng.ts'
import type { HeroRecord, ItemInstance } from './types/content.ts'
import type { Difficulty, Stance } from './types/enums.ts'

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
  | { kind: 'stance'; heroIndex: number; stance: Stance }
  | { kind: 'buy'; offerIndex: number }
  | { kind: 'descend' }
  | { kind: 'retreat' }
  | { kind: 'continue' }
  | { kind: 'auto' }

export interface LegalDelveAction {
  command: DelveCommand
  label: string
  enabled: boolean
  reason?: string
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
}

export type DelvePhase =
  | { kind: 'room' }
  | { kind: 'fight' }
  | { kind: 'result'; title: string; lines: string[] }
  | { kind: 'curio'; curioId: string }
  | { kind: 'over'; outcome: 'cleared' | 'retreated' | 'wiped' | 'capped'; summary: string }

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
  policy: 'textbook' | 'cautious' | 'greedy' | 'random'
  /** The first-ever delve: F1 is the fixed 3-room tutorial (D-038). */
  firstDelve?: boolean
  /** Stop the delve after this floor (the zone's last floor by default). */
  lastFloor?: number
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
}
