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
    /** Bows and crossbows: either row; their arrows and bolts are counted in `ammo` (08 §4, D-099). */
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
  /**
   * The bow's or crossbow's ammo the delve counts for this fight (08 §4, D-099; sim/src/ammo.ts): a basic attack
   * spends 1, a shot skill its `consume-ammo` lines; empty, the basic attack is a Bash. Absent or null: not counted.
   */
  ammo?: { itemId: string; left: number; spent: number } | null
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
  /**
   * A telegraphed attack wound up on the monster's last turn (06 §8.10: "none lands on the turn its tell shows"):
   * it lands on the monster's next turn unless a Daze or a Silence breaks it first (arena.ts). Absent or null: none.
   */
  windup?: MonsterWindup | null
}

/** A telegraphed attack between its tell and its blow (arena.ts; the HUD's hint and the 3D model's tell read it). */
export interface MonsterWindup {
  attackId: string
  /** The hero it will strike, when the attack names one (Verdict's swinging lantern). */
  targetId: string | null
  /** The two-word hint (06 §8.10, 07 §2.8; D-099). */
  hint: string
  /** The log length when the tell was shown: a Daze or Silence logged after it breaks the wind-up. */
  sinceLog: number
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
  /**
   * D-127 (Proposed): a control status's timeline push (Freeze, Stun, Daze, Petrify) has landed since this actor's last
   * turn, so another one only applies the status, not the push (statuses.ts applyStatus); cleared when its turn comes up.
   */
  pushGuard?: boolean
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
  /** A boss arena's interactable (07 §2.8): shoot a keg, burn a bone pile, turn the sluice wheel. arena.ts. */
  | { kind: 'arena'; propId: string }
  /** The worn relic's active (08 §3; relics.ts): an Item action, or no turn at all when it is instant. */
  | { kind: 'relic'; targetId: string | null }
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
  /** A boss fight's arena (07 §2.8; sim/src/arena.ts): its light steps, tide, braziers, props and tells. Absent or null elsewhere. */
  arena?: ArenaState | null
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
  /** A Torch's light in this fight (07 §6.1's knob: +25, Dread +20, the Candle Pact +15); absent: the item's own line. */
  torchValue?: number
}

/* ---------- boss arenas (07 §2.8; sim/src/arena.ts) ---------- */

/** What an arena interactable is: Vexa's kegs, the Warden's bone piles, Naesa's sluice wheel, the King's braziers. */
export type ArenaPropKind = 'keg' | 'pile' | 'sluice' | 'brazier'

/** One interactable of the arena (07 §2.8): a hero's Arena action works on it (a brazier through a Torch Item action). */
export interface ArenaProp {
  /** 'keg-1', 'pile-3', 'sluice', 'brazier-2'. */
  id: string
  kind: ArenaPropKind
  name: string
  /** Hits left before it breaks (a keg spills, a pile burns out); 0 once it has, and for the sluice and the braziers. */
  hitsLeft: number
  /** A keg spilled, a pile burnt out, a brazier lit in this phase. */
  done: boolean
}

/** A tell on show (07 §2.8 "the visible cue one turn before the dangerous thing"; D-099's two-word hint). */
export interface ArenaTell {
  /** The arena tell's id ('tide-rising', 'lantern-targeted' …). */
  id: string
  hint: string
  cue: string
  /** The round the thing it warns of happens. */
  firesAtRound: number
  /** Who shows it (the boss, or null for the room itself) and whom it threatens, when one hero. */
  actorId: string | null
  targetId: string | null
}

/** An add that fell, for the re-entries (07 §2.8: Vexa's crew rallies, Naesa's adds return, the King re-calls). */
export interface ArenaFallenAdd {
  monsterId: string
  row: FightRow
  fellAtRound: number
  /** It came back already (each add re-enters once). */
  returned: boolean
  /** Where it came from: 'start' (the phase-1 adds), 'phase-2', 'call', 'deep', 'doors', 'heel', 'return', 'hunter'. */
  group: string
}

/** One blow on a boss, queued by effects.ts's breakPart for the boss's several parts (06 §3: the conch, the crown …). */
export interface ArenaHit {
  attackerId: string | null
  dealt: number
  damageType: string
  crit: boolean
}

/** The arena's tally (DelveState.stats.bossArenas keeps one row per boss fight; the balance runner reads it). */
export interface ArenaStats {
  lightMin: number
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
  tells: number
  /** Telegraphed blows a Daze or a Silence broke off. */
  tellsBroken: number
}

/** A boss fight's arena (07 §2.8): plain data on the fight, hashed with it. */
export interface ArenaState {
  /** The boss's monster id and its actor's id. */
  bossId: string
  bossActorId: string
  /** The room template (07 §2.8: cel-t-tap-room, cry-t-wardens-vigil, vlt-t-drowned-chapel, vlt-t-throne). */
  templateId: string | null
  /** The boss's phase, 1-based (its monster's phaseIndex + 1), and the round it began. */
  phase: number
  phaseStartRound: number
  /** The light the room set at the start (07 §2.3 "arena sets"). The live light is FightState.light. */
  lightSet: number
  /** Actor ids a non-reach melee blow cannot reach now (Vexa's barricade, the King on his throne); read by effects.ts. */
  meleeBlocked: string[]
  /** Vexa's barricade still stands. */
  barricade: boolean
  /** The Warden's ring: candles still lit of the ring's count. */
  candles: { lit: number; of: number } | null
  /** The Warden's secret doors (the sixth candle, or phase 2). */
  doorsOpen: boolean
  /** Naesa's tide (and the throne's water): the step 0–max, the round of the next rise, and whether a broken chain stopped it. */
  tide: { level: number; max: number; nextRound: number | null; stopped: boolean } | null
  props: ArenaProp[]
  /** Tells on show now. */
  tells: ArenaTell[]
  /** Hints already shown this fight (a hint shows the first time it fires; D-099). */
  hintsShown: string[]
  fallen: ArenaFallenAdd[]
  /** The Warden's Oath: the heroes who have struck him, and the one whose blow holds his attention. */
  struckBy: string[]
  oathHolderId: string | null
  /** The King's returning hunters: waves done so far. */
  hunterWaves: number
  /** Boss parts broken (06 §3 part-breaks), by part id. */
  partsBroken: string[]
  /** Blows on the boss since the last turn ended (effects.ts breakPart queues them). */
  hits: ArenaHit[]
  /** Heroes who swapped rows since the throne's last tide tell (they are spared the pull). */
  swapped: string[]
  /** Each monster's row at the last check, for the slick floor (a monster that changes rows slips). */
  rows: Record<string, FightRow>
  /** Small one-off marks (a phase's opener used, an at-HP add spent, the sluice turned this round). */
  flags: Record<string, number | string | boolean>
  stats: ArenaStats
}
