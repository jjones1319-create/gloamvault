import type { Content } from '../../content.ts'
import type { Actor, FightState, StatusInstance } from '../../fight-types.ts'
import type { Rng } from '../../rng.ts'
import type { Tuning } from '../../tuning.ts'
import type { Effect } from '../../types/content.ts'
import type { DamageType } from '../../types/enums.ts'

/**
 * Custom hooks (09-SKILLS §6, content/README.md rule 31): an effect line of kind `custom` names a handler file
 * sim/src/skills/custom/<customId>.ts. A handler is either imperative (`apply`, run when the line resolves) or a
 * rule consulted while a status carrying the line is held (the `can*`, `modify*` and `on*` members). A handler
 * implements only the members it needs.
 */
export interface HookContext {
  content: Content
  t: Tuning
  state: FightState
  rng: Rng
  /** The actor holding the status (rule hooks) or casting the line (apply). */
  holder: Actor
  status: StatusInstance | null
  line: Effect
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

export interface CustomHandler {
  /** Run when the line resolves on a target (skills, traits, affixes, curios). */
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
  /** After a hit landed on the holder (Freeze shatters, Shock chains). */
  afterHit?(ctx: HookContext, incoming: IncomingDamage, dealt: number): void
  /** When a lost action should become a Guard instead (Fear). */
  lostActionBecomesGuard?(ctx: HookContext): boolean
  /** At the holder's turn start. */
  onTurnStart?(ctx: HookContext): void
  /** When the holder attacks (Veil ends). */
  onHolderAttacks?(ctx: HookContext): void
  /** Called each turn the grabber takes while the hold lasts; returns true when the hold should end (role cap). */
  grabberTurn?(ctx: HookContext, grabber: Actor): boolean
}
