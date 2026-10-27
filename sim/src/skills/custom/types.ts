import type { Content } from '../../content.ts'
import type { LineSource } from '../../effects.ts'
import type { Actor, FightState, HookInstance, StatusInstance } from '../../fight-types.ts'
import type { InstallOptions } from '../../hooks.ts'
import type { Rng } from '../../rng.ts'
import type { Tuning } from '../../tuning.ts'
import type { Effect, SkillDef } from '../../types/content.ts'
import type { DamageType, DerivedStat, Status, Target } from '../../types/enums.ts'

/**
 * Custom hooks (09-SKILLS §6, content/README.md rule 31): an effect line of kind `custom` names a handler file
 * sim/src/skills/custom/<customId>.ts. A handler is imperative (`apply`, run when the line resolves) and/or a rule
 * consulted while the line is active on an actor — through a status that carries it (statuses.ts) or a persistent
 * HookInstance (hooks.ts: passives, champion affixes, pet traits, stances, broken limbs). A handler implements only
 * the members it needs and never imports the fight: everything it may do to the fight comes through `ctx.fx`.
 */
export interface HookContext {
  content: Content
  t: Tuning
  state: FightState
  rng: Rng
  /** The actor holding the line (rule hooks) or casting it (apply). */
  holder: Actor
  /** The status carrying the line, when one does. */
  status: StatusInstance | null
  /** The persistent hook carrying the line, when one does. */
  hook: HookInstance | null
  line: Effect
  /** For `apply`: the id of the skill, attack, item or affix the line belongs to. */
  sourceId: string | null
  /** The fight's verbs a handler may use. */
  fx: HookFx
}

export interface StrikeOptions {
  amount: number
  damageType: DamageType
  label: string
  canMiss?: boolean
  canCrit?: boolean
  /** Ripostes and thorns pass false so they never answer each other. */
  isMelee?: boolean
  ignoresDefense?: boolean
}

export interface HookFx {
  /** One hit through the damage pipeline, logged. `attacker` null for damage nobody dealt (thorns). */
  strike(attacker: Actor | null, target: Actor, o: StrikeOptions): { hit: boolean; dealt: number; killed: boolean }
  heal(healer: Actor | null, target: Actor, amount: number): number
  applyStatus(target: Actor, input: { status: Status; chance?: number; duration?: number; magnitude?: number }, sourceId: string | null): 'applied' | 'resisted' | 'immune' | 'missed'
  attackFor(actor: Actor, type: DamageType): number
  statOf(actor: Actor, stat: DerivedStat): number
  gainMomentum(actor: Actor, amount: number): void
  log(kind: string, text: string, extra?: { actorId?: string; targetId?: string; amount?: number; data?: Record<string, number | string | boolean | null> }): void
  alliesOf(actor: Actor): Actor[]
  enemiesOf(actor: Actor): Actor[]
  isActive(actor: Actor): boolean
  installHook(actor: Actor, line: Effect, sourceId: string, opts?: InstallOptions): HookInstance
  removeHook(actor: Actor, hook: HookInstance): void
  /** Resolves one DSL line for `actor` as the fight would (a chain hit, an extra target); `source` overrides the line's source fields. */
  applyLine(actor: Actor, line: Effect, baseTarget: Target, chosen: Actor | null, source?: Partial<LineSource>): { targets: string[]; dealt: number[]; applied: string[] }
  hasStatus(actor: Actor, status: Status): boolean
  removeStatus(actor: Actor, status: Status): boolean
}

export interface IncomingDamage {
  amount: number
  damageType: DamageType
  attacker: Actor | null
  isSingleTarget: boolean
  isDot: boolean
  isUltimate: boolean
  isMelee: boolean
  physical: boolean
}

/** One registry row: [customId, handler]. */
export type HandlerEntry = readonly [string, CustomHandler]

export interface CustomHandler {
  /** Run when the line resolves on a target (skills, traits, affixes, curios, part breaks). */
  apply?(ctx: HookContext, target: Actor | null, scalePercent: number): void
  /** While held: may the holder act at all? */
  canAct?(ctx: HookContext): boolean
  canUseSkills?(ctx: HookContext): boolean
  canSwapRow?(ctx: HookContext): boolean
  canFlee?(ctx: HookContext): boolean
  /** While held: the only actor the holder may target (Taunt). */
  mustTarget?(ctx: HookContext): string | null
  /** While held: the only attacker that may target the holder (Grab). */
  onlyTargetableBy?(ctx: HookContext): string | null
  /** While held: nobody may target the holder (Old Gnaw's vanish). */
  untargetable?(ctx: HookContext): boolean
  /** A single-target hit about to land on the holder: someone else takes it (Intercept, Guard Dog); percent scales it (−10). */
  intercept?(ctx: HookContext, attacker: Actor | null, incoming: IncomingDamage): { interceptorId: string; percent: number } | null
  /** A hit about to land on the holder: 'miss' turns it into a miss (Veil). */
  beforeHit?(ctx: HookContext, incoming: IncomingDamage): 'miss' | null
  /** Scales damage the holder takes, in percent (Mark +20). */
  incomingDamagePercent?(ctx: HookContext, incoming: IncomingDamage): number
  /** Absorbs damage: returns what is left after the absorb (Shield). */
  absorb?(ctx: HookContext, incoming: IncomingDamage): number
  /** Scales healing the holder receives, in percent (Wither −50). */
  incomingHealingPercent?(ctx: HookContext): number
  /** All attributes scaled, in percent (Curse −10). */
  attributePercent?(ctx: HookContext): number
  /** The holder's next damage line crits; the handler consumes the hook. */
  forceCrit?(ctx: HookContext, target: Actor): boolean
  /** Scales damage the holder deals, in percent (a broken bolt arm −20). */
  outgoingDamagePercent?(ctx: HookContext, target: Actor, incoming: IncomingDamage): number
  /** After the holder's hit dealt damage (Vampiric). */
  onDealtDamage?(ctx: HookContext, target: Actor, dealt: number, incoming: IncomingDamage): void
  /** After a hit landed on the holder (Freeze shatters, Shock chains, Counter Stance answers, thorns reflect). */
  afterHit?(ctx: HookContext, incoming: IncomingDamage, dealt: number): void
  /** The holder blocked a hit (Wall Stance restores pool). */
  onBlock?(ctx: HookContext, incoming: IncomingDamage): void
  /** The holder was killed (Commander's fear, a Cutpurse dropping its take). */
  onDeath?(ctx: HookContext, killer: Actor | null): void
  /** Percent added to a skill's pool cost for the holder (Loud Voice −20 on its school). */
  costPercent?(ctx: HookContext, skill: SkillDef): number
  /** Turns added to a status the holder applies (Loud Voice: Taunts +1). */
  statusDurationBonus?(ctx: HookContext, status: Status, target: Actor): number
  /** After the holder resolved a skill (Momentum on a shout). */
  onSkillUsed?(ctx: HookContext, skill: SkillDef): void
  /** Percent on the holder's wear events of a kind (armor −20). */
  wearPercent?(ctx: HookContext, kind: 'weapon' | 'armor' | 'shield'): number
  /** A stat percent the holder grants an ally while it stands (Commander: fodder Attack +20). Must not read stats. */
  auraStatPercent?(ctx: HookContext, ally: Actor, stat: DerivedStat): number
  /** The enemy the holder prefers when its behaviour names none (every bandit on the Marked hero). */
  preferredTarget?(ctx: HookContext, candidates: Actor[]): Actor | null
  /** At the fight's start, for every hook already on the actor (passives, affixes, traits). */
  onFightStart?(ctx: HookContext): void
  /** The holder dodged a hit (the attacker's hit roll failed). */
  onDodge?(ctx: HookContext, attacker: Actor, incoming: IncomingDamage): void
  /** The holder's hit killed `target`. */
  onKill?(ctx: HookContext, target: Actor): void
  /** The holder is about to drop to 0 HP: return true to stay at 1 (a Last Stand); the handler consumes its own hook. */
  beforeDowned?(ctx: HookContext, incoming: IncomingDamage): boolean
  /** Percentage points added to the holder's crit rate for this hit (attacker side). */
  critRateBonus?(ctx: HookContext, target: Actor, incoming: IncomingDamage): number
  /** Percentage points added to the holder's accuracy for this hit (attacker side). */
  accuracyBonus?(ctx: HookContext, target: Actor): number
  /** Scales healing the holder does, in percent (healer side). */
  outgoingHealingPercent?(ctx: HookContext, target: Actor): number
  /** Percentage points added to the holder's per-turn pool regen. */
  poolRegenBonus?(ctx: HookContext): number
  /** Before one of the holder's lines resolves: a replacement line, 'skip', or null to leave it alone. */
  modifyLine?(ctx: HookContext, line: Effect, source: LineSource, chosen: Actor | null): Effect | 'skip' | null
  /** The weight of the holder's action before it is spent (a first action at 600). */
  modifyWeight?(ctx: HookContext, weight: number): number
  /** When a lost action should become a Guard instead (Fear). */
  lostActionBecomesGuard?(ctx: HookContext): boolean
  /** At the holder's turn start. */
  onTurnStart?(ctx: HookContext): void
  /** When the holder attacks (Veil ends). */
  onHolderAttacks?(ctx: HookContext): void
  /** Called each turn the grabber takes while the hold lasts; returns true when the hold should end (role cap). */
  grabberTurn?(ctx: HookContext, grabber: Actor): boolean
}
