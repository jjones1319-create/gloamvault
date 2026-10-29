import type { Content } from './content.ts'
import type { DelveState, LegalDelveAction } from './delve-types.ts'
import { alliesOf, applyLine, enemiesOf, gainMomentum, hookCtx, isActive, log, type EffectContext, type LineSource } from './effects.ts'
import type { Actor, EquippedItem, FightState, LegalFightAction } from './fight-types.ts'
import { activeHooks } from './hooks.ts'
import { lootTableForFloor, rollGearDrop } from './loot.ts'
import type { Rng } from './rng.ts'
import { customHandler } from './skills/custom/index.ts'
import type { Tuning } from './tuning.ts'
import type { HeroRecord, ItemDef, ItemInstance } from './types/content.ts'

/**
 * Relics (03 §6.1, 08 §3): the eleventh slot's active — "once per fight unless stated". In a fight a relic is an Item
 * action (weight 600, tuning combat.weights.item) unless it is **instant**: then it spends no weight and no turn, and
 * the hero chooses again (fight.ts `applyFightCommand`). Its lines resolve through the effect DSL like a skill's
 * (taunt, fortify, regen, shield, dispel, light) and its custom lines through their hooks (the Hourglass Shard's
 * `next-action-weightless`). The uses left this fight are `HeroActorData.relicUsesLeft` (hero.ts sets them from
 * `active.usesPerFight`).
 *
 * A relic used **after a fight** (`active.timing: 'afterFight'`) is no fight action: the Hollow Coin re-rolls the
 * fight's gear drop once per floor, offered by the delve in the fight's result (`hollowCoinOffer`, `rerollFightDrop`).
 */

/** True when the relic is used in a fight (every relic but an after-fight one). */
export function isFightRelic(def: ItemDef): boolean {
  return def.active !== null && def.active.timing !== 'afterFight'
}

/** 08 §3 "(instant)": no Item action — written `active.instant`, or a fight relic with no action weight. */
export function isInstantRelic(def: ItemDef): boolean {
  return isFightRelic(def) && (def.active?.instant ?? def.weight === null)
}

/** The fight actor's worn relic when it can be used now (a fight relic with a use left this fight), else null. */
export function usableRelic(actor: Actor): EquippedItem | null {
  const h = actor.hero
  const relic = h?.equipment.relic
  if (!h || !relic || !isFightRelic(relic.def) || h.relicUsesLeft <= 0) return null
  return relic
}

/** The targets a relic's command accepts: none for a relic that picks its own (allEnemies, allyLowest …). */
function relicTargets(state: FightState, actor: Actor, def: ItemDef): string[] {
  switch (def.active?.target) {
    case 'ally':
      return alliesOf(state, actor).filter(isActive).map((a) => a.id)
    case 'enemy':
      return enemiesOf(state, actor).filter(isActive).map((a) => a.id)
    default:
      return []
  }
}

/** The relic's line in the hero's legal actions (fight.ts legalFightActions), or null when the hero wears no fight relic. */
export function relicFightAction(state: FightState, actor: Actor): LegalFightAction | null {
  const relic = actor.hero?.equipment.relic
  if (!actor.hero || !relic || !isFightRelic(relic.def)) return null
  const left = actor.hero.relicUsesLeft
  const targets = relicTargets(state, actor, relic.def)
  return {
    command: { kind: 'relic', targetId: targets[0] ?? null },
    label: `${relic.def.name}${isInstantRelic(relic.def) ? ' (instant)' : ''}`,
    targets,
    enabled: left > 0,
    ...(left > 0 ? {} : { reason: 'already used this fight' }),
  }
}

/**
 * Uses the actor's relic in a fight: its lines resolve on their target (the chosen one when the relic takes one), a
 * use comes off, and — unless it is instant — Momentum is gained and the Item action's weight is spent (the holder's
 * weight hooks apply, so a Hourglass Shard used before makes it free). Returns 'instant' (the hero acts again),
 * 'action' (the turn is spent) or 'none' (nothing to use).
 */
export function useRelicInFight(ctx: EffectContext, actor: Actor, chosen: Actor | null): 'instant' | 'action' | 'none' {
  const relic = usableRelic(actor)
  const h = actor.hero
  if (!relic || !h || !relic.def.active) return 'none'
  const def = relic.def
  const active = relic.def.active
  log(ctx, { kind: 'action', actorId: actor.id, targetId: chosen?.id, text: `${actor.name} raises ${def.name}`, data: { relic: def.id } })
  const source: LineSource = { kind: 'relic', id: def.id, label: def.name, isUltimate: false, neverMisses: true, effectPercent: 100, reach: true, ranged: true, isMelee: false }
  for (const line of active.effects) applyLine(ctx, actor, line, active.target, chosen, source)
  h.relicUsesLeft = Math.max(0, h.relicUsesLeft - 1)
  if (isInstantRelic(def)) return 'instant'
  gainMomentum(ctx, actor, ctx.t.derived.momentum.onAct)
  let weight: number = def.weight ?? ctx.t.combat.weights.item
  for (const { status, hook, line } of activeHooks(ctx.content, actor)) weight = customHandler(line.customId ?? '')?.modifyWeight?.(hookCtx(ctx, actor, status, line, hook), weight) ?? weight
  actor.energy -= ctx.rng.jitter(Math.max(0, weight), ctx.state.options.jitterPercent)
  return 'action'
}

// ---------------------------------------------------------------------------------------------------------------
// After the fight: the Hollow Coin (08 §3: "Re-roll this fight's item drop (after the fight) · once per floor")
// ---------------------------------------------------------------------------------------------------------------

/** A hero record's worn relic as content, or null. */
export function wornRelic(content: Content, hero: HeroRecord): { def: ItemDef; inst: ItemInstance } | null {
  const inst = hero.equipment.relic
  const def = inst ? content.items.get(inst.itemId) : undefined
  return inst && def ? { def, inst } : null
}

/** The floor's use counter key for a hero's after-fight relic. */
function floorUseKey(heroIndex: number, relicId: string): string {
  return `${heroIndex}:${relicId}`
}

/**
 * The Hollow Coin's offer in a won fight's result: the first standing hero who wears an after-fight relic with a use
 * left on this floor, and the fight's gear drop it would re-roll. null when the fight dropped no gear item (there is
 * nothing to re-roll) or nobody can.
 */
export function hollowCoinOffer(content: Content, state: DelveState): { heroIndex: number; relicId: string; pileIndex: number } | null {
  const drop = state.lastFightDrop
  if (!drop || state.phase.kind !== 'result' || !state.pile[drop.pileIndex]) return null
  for (let i = 0; i < state.heroes.length; i++) {
    const h = state.heroes[i]
    if (!h || h.fallen) continue
    const relic = wornRelic(content, h.record)
    const active = relic?.def.active
    if (!relic || !active || active.timing !== 'afterFight') continue
    const used = state.floor.relicUses?.[floorUseKey(i, relic.def.id)] ?? 0
    if (used < (active.usesPerFloor ?? active.usesPerFight)) return { heroIndex: i, relicId: relic.def.id, pileIndex: drop.pileIndex }
  }
  return null
}

/**
 * The Hollow Coin re-rolls the fight's gear drop: the item on the pile is replaced by a new roll on the floor's loot
 * table (the same drop shape and the party's best Luck — `luck`), and the hero's use for the floor is spent. The new
 * roll stands even when it is worse (a re-roll, not a second chance). Returns the new item, or null when the table
 * gave nothing. Throws when this hero has no re-roll to make (an illegal command).
 */
export function rerollFightDrop(content: Content, t: Tuning, rng: Rng, state: DelveState, heroIndex: number, luck: number): ItemInstance | null {
  const offer = hollowCoinOffer(content, state)
  if (!offer || offer.heroIndex !== heroIndex) throw new Error('no after-fight relic to use')
  const table = lootTableForFloor(content, state.options.dungeonId, state.floor.number)
  const next = rollGearDrop(content, t, rng, table, luck)
  const key = floorUseKey(heroIndex, offer.relicId)
  state.floor.relicUses = { ...(state.floor.relicUses ?? {}), [key]: (state.floor.relicUses?.[key] ?? 0) + 1 }
  state.lastFightDrop = null
  if (next === null) return null
  state.pile = state.pile.map((it, i) => (i === offer.pileIndex ? next : it))
  return next
}

/** The Hollow Coin's line in a won fight's result (delve.ts legalDelveActions): none when there is nothing to re-roll. */
export function hollowCoinActions(content: Content, state: DelveState): LegalDelveAction[] {
  const offer = hollowCoinOffer(content, state)
  if (!offer) return []
  const relic = content.items.get(offer.relicId)?.name ?? 'the relic'
  const drop = content.items.get(state.pile[offer.pileIndex]?.itemId ?? '')?.name ?? 'the drop'
  return [{ command: { kind: 'relic', heroIndex: offer.heroIndex }, label: `Re-roll ${drop} (${relic})`, enabled: true }]
}
