import type { RngState } from './rng.ts'
import type { DerivedStats } from './stats.ts'
import type { Effect, ItemDef, ItemInstance, MonsterAttack, MonsterBehaviorRule } from './types/content.ts'
import type { Attribute, DamageType, DerivedStat, Pool, Role, Size, Slot, Stance, Status, WeaponType } from './types/enums.ts'

/**
 * The fight's state (03-GAME-DESIGN §3): plain data, serialisable, hashed by sim/src/hash.ts. Everything mutable
 * here is the sim's own working copy; content records are referenced by id and never written to.
 */
export type Side = 'party' | 'enemy'
export type ActorKind = 'hero' | 'pet' | 'monster' | 'summon'
export type FightRow = 'front' | 'back'

export interface StatusInstance {
  id: Status
  stacks: number
  /** Turns left; null for an until-condition status (Grab, Veil, Shield until broken). */
  turnsLeft: number | null
  /** DoT: damage per tick per stack (hitDamage-based) · Shield: absorb left · Regen: percent of max HP. */
  magnitude: number
  sourceId: string | null
  /** For Grab: the grabber's turns since the grab (role cap). */
  counter: number
  /** Applied during the holder's own turn: skips that turn's count-down once (D-077). */
  fresh?: boolean
}

export interface StatModifier {
  stat: DerivedStat
  amount: number
  percent: number
  turnsLeft: number
  sourceId: string
  /** Applied during the holder's own turn: skips that turn's count-down once (D-077). */
  fresh?: boolean
}

/**
 * A persistent custom hook on an actor (hooks.ts): a loadout passive, a champion's affix, a pet's trait, a stance
 * that lasts "until your next turn", a broken limb. The line plus the handler's own small state.
 */
export interface HookInstance {
  customId: string
  line: Effect
  /** The actor that installed it (the Warden for Intercept, the pet for Guard Dog, the champion for an aura). */
  sourceId: string
  /** The skill that owns the line, when one does (a passive's school is read from it). */
  sourceSkillId: string | null
  /** Turns left, counted down at the holder's turn end like a status; null lasts the fight. */
  turnsLeft: number | null
  /** Drops at the holder's next turn start (Counter Stance). */
  untilTurnStart: boolean
  /** A counter the handler owns (hits left, a cooldown). */
  counter: number
  data: Record<string, number | string | boolean>
}

export interface ActorTally {
  actions: number
  hitsLanded: number
  hitsTaken: number
  blocks: number
  damageDealt: number
  damageTaken: number
  healingDone: number
  kills: number
  skillUses: Record<string, number>
}

export interface EquippedItem {
  def: ItemDef
  inst: ItemInstance
}

export type HeroEquipment = Partial<Record<Exclude<Slot, 'ring' | 'pet'>, EquippedItem>> & { ring: (EquippedItem | null)[] }

export interface HeroActorData {
  heroId: string
  classId: string
  speciesId: string
  pool: Pool
  /** Loadout actives in slot order (ids or null) and the two passives. */
  actives: (string | null)[]
  passives: (string | null)[]
  ultimateId: string | null
  /** Skill ranks for everything known. */
  ranks: Record<string, number>
  /** The weapon in hand: basic attack shape. */
  weapon: {
    type: WeaponType | null
    damageType: DamageType
    weight: number
    hands: 1 | 2
    dual: boolean
    offHandAttackPercent: number
    heavy: boolean
    /** Bows and crossbows: either row; ammo counts later. */
    ranged: boolean
    reach: boolean
    onHit: Effect[]
  }
  armorFamily: string | null
  shieldBlock: number
  equipment: HeroEquipment
  /** Bag items usable in a fight: instance id → def id, for Item actions. */
  bag: ItemInstance[]
  aiRule: string
  relicUsesLeft: number
  stanceChangeUsed: boolean
  /** Species rule knobs the fight consults. */
  species: {
    darkAccuracyImmune: boolean
    lightBandShift: number
    immunities: Status[]
    statusResist: Partial<Record<Status, number>>
    statusDurationDelta: Partial<Record<Status, number>>
    appliedDurationMultiplier: Partial<Record<Status, number>>
    resist: Partial<Record<DamageType, number>>
    weak: Partial<Record<DamageType, number>>
    forcedRowMoveImmune: boolean
    damageMultiplierBelowHpPercent: { hpPercent: number; multiplier: number } | null
    enemyAccuracyBySize: Partial<Record<Size, number>>
  }
}

export interface MonsterActorData {
  monsterId: string
  familyId: string
  role: Role
  size: Size
  attacks: MonsterAttack[]
  /** Attack ids usable now (a boss's current phase). */
  attackIds: string[]
  behavior: MonsterBehaviorRule[]
  fleesAtPercent: number
  resist: DamageType[]
  weak: DamageType[]
  immune: DamageType[]
  statusImmune: Status[]
  champion: { affixIds: string[] } | null
  phaseIndex: number
  isBoss: boolean
  isHunter: boolean
  cannotFlee: boolean
  partBroken: boolean
  goldMultiplier: number
  xpClass: number
  summonedBy: string | null
}

export interface PetActorData {
  petId: string
  ownerId: string
  stance: Stance
  stamina: number
  staminaMax: number
  actives: string[]
  traitEffects: Effect[]
}

export interface Actor {
  id: string
  name: string
  side: Side
  kind: ActorKind
  row: FightRow
  level: number
  hp: number
  maxHp: number
  pool: number
  poolMax: number
  poolKind: Pool | null
  momentum: number
  attributes: Record<Attribute, number>
  /** Derived stats without temporary modifiers (recomputed when gear changes, not per tick). */
  base: DerivedStats
  energy: number
  charging: { weight: number; chargePaid: number; action: PendingAction } | null
  statuses: StatusInstance[]
  modifiers: StatModifier[]
  /** Persistent custom hooks (passives, affixes, traits, stances); statuses carry their own lines. */
  hooks: HookInstance[]
  guarding: boolean
  downed: boolean
  /** Turns of the downed hero that may pass before it is fallen (03 §12.1: 3). */
  downedTurnsLeft: number
  fallen: boolean
  fled: boolean
  /** A monster removed from the fight (dead, fled, vanished). */
  gone: boolean
  grabbedBy: string | null
  grabDamage: number
  /** Did this actor act since the round started (heroes only count toward rounds). */
  actedThisRound: boolean
  /** The last enemy this actor attacked (a Fierce pet follows it; bandit dogs follow their handler's). */
  lastTargetId: string | null
  tally: ActorTally
  hero?: HeroActorData
  monster?: MonsterActorData
  pet?: PetActorData
}

export type PendingAction =
  | { kind: 'skill'; skillId: string; targetId: string | null }
  | { kind: 'attack'; attackId: string; targetId: string | null }

export type FightCommand =
  | { kind: 'basic'; targetId: string }
  | { kind: 'skill'; slot: number; targetId: string | null }
  | { kind: 'ultimate'; targetId: string | null }
  | { kind: 'guard' }
  | { kind: 'item'; instanceId: string; targetId: string | null }
  | { kind: 'swapRow' }
  | { kind: 'flee' }
  | { kind: 'freeAlly'; targetId: string }
  | { kind: 'stance'; stance: Stance }
  | { kind: 'auto' }

export interface LegalFightAction {
  command: FightCommand
  label: string
  /** Target ids the command accepts (empty when none needed). */
  targets: string[]
  /** Why it is unavailable when `enabled` is false. */
  enabled: boolean
  reason?: string
}

export interface FightEvent {
  tick: number
  round: number
  kind: string
  actorId?: string
  targetId?: string
  text: string
  amount?: number
  data?: Record<string, number | string | boolean | null>
}

export type FightOutcome = 'victory' | 'defeat' | 'fled' | 'cap'

export interface WearEvent {
  actorId: string
  kind: 'weapon' | 'armor' | 'shield'
  /** Armor: the piece hit; weapon: mainHand/offHand. */
  slot: string
  double: boolean
  /** Percent of a normal event (Wall Stance's armor −20 → 80); omitted means 100. */
  percent?: number
}

export interface XpEvent {
  actorId: string
  kind: 'skill' | 'attribute' | 'item'
  /** The skill id, the attribute, or the item slot. */
  id: string
  enemyLevel: number
}

export interface FightState {
  rng: RngState
  tick: number
  round: number
  light: number
  /** Which side was surprised at the start. */
  surprised: Side | null
  actors: Actor[]
  /** The hero waiting for a command, or null while the sim resolves on its own. */
  pendingActorId: string | null
  over: { outcome: FightOutcome; reason: string } | null
  log: FightEvent[]
  /** Counters for the loot and the report. */
  counters: { monstersKilled: number; heroDowns: number; fleeAttempts: number; goldStolen: number; roundsAtEnd: number }
  /** Wear events the delve applies to the heroes' gear after the fight (03 §6.4). */
  wear: WearEvent[]
  /** Skill uses and tagged actions for XP by use (03 §5), by hero actor id. */
  xp: XpEvent[]
  options: FightOptions
  /** Elite champions, boss phases and the like read these. */
  flags: Record<string, number | string | boolean>
  /** The actor whose turn is resolving (a status it gains now does not count down at this turn's end; D-077). */
  actingId: string | null
}

export interface FightOptions {
  jitterPercent: number
  roundCap: number
  /** Difficulty knobs the fight consults (percent of normal). */
  enemyDamagePercent: number
  enemySpeedPercent: number
  /** Heroes on auto (balance runner, AFK): their AI rule decides. */
  autoHeroes: boolean
  /** Monster level of the floor (for XP gates and the hunter's offset). */
  floorLevel: number
  /** The dungeon's loot band, for drops after the fight. */
  dungeonId: string
  floor: number
  /** The party's carried gold when the fight began (a Cutpurse steals a share of it). */
  partyGold: number
}
