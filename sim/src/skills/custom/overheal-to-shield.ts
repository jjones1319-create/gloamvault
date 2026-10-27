import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/**
 * Overflow (Mender passive, Benediction II; docs/classes/mender.md §4.1): healing by the holder beyond the target's
 * max HP becomes a Shield on the target, capped at `percent`% of its max HP, for `duration` turns. Installed as a
 * hook by hero.ts. Reading: the fight reports no healed-versus-intended number to the healer, so the passive's
 * `modifyLine` rewrites each of the holder's `heal` lines into this custom line (marked `status: 'shield'`, a field
 * a heal never carries) and `apply` resolves the heal itself exactly as effects.ts does — same amount rules, same
 * `heal` verb and log event — then turns what did not fit into the Shield. The healing bonuses heal() applies are
 * mirrored from the two hooks that grant them (healing-done-percent on the healer, healing-received-percent on the
 * target), so the overflow counts the boosted number.
 */
function healingPercent(ctx: HookContext, healer: Actor, target: Actor): number {
  let pct = 0
  for (const h of healer.hooks) if (h.customId === 'healing-done-percent') pct += h.line.percent ?? 0
  for (const s of healer.statuses) for (const l of ctx.content.statuses.get(s.id)?.effects ?? []) if (l.kind === 'custom' && l.customId === 'healing-done-percent') pct += l.percent ?? 0
  for (const h of target.hooks) if (h.customId === 'healing-received-percent') pct += h.line.percent ?? 0
  for (const s of target.statuses) for (const l of ctx.content.statuses.get(s.id)?.effects ?? []) if (l.kind === 'custom' && l.customId === 'healing-received-percent') pct += l.percent ?? 0
  return pct
}

const handler: CustomHandler = {
  modifyLine: (ctx, line) => {
    if (!ctx.hook || line.kind !== 'heal') return null
    return { ...line, kind: 'custom', customId: 'overheal-to-shield', status: 'shield' }
  },
  apply: (ctx, target, scale) => {
    const holder = ctx.holder
    if (ctx.line.status !== 'shield') {
      // The passive's own line cast as a skill line: install it as the hook hero.ts would.
      ctx.fx.installHook(target ?? holder, ctx.line, holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null })
      return
    }
    if (!target) return
    const chance = ctx.line.chance ?? 100
    if (chance < 100 && !ctx.rng.pct(chance)) return
    let amount = 0
    if (ctx.line.multiplier !== undefined) amount = roundHalfUp((ctx.fx.attackFor(holder, 'holy') * ctx.line.multiplier * scale) / 100)
    else if (ctx.line.percent !== undefined) amount = roundHalfUp((target.maxHp * ctx.line.percent * scale) / 10_000)
    else amount = roundHalfUp(((ctx.line.amount ?? 0) * scale) / 100)
    const scaled = Math.max(0, roundHalfUp((amount * Math.max(0, 100 + healingPercent(ctx, holder, target))) / 100))
    const healed = ctx.fx.heal(holder, target, amount)
    const label = (ctx.sourceId ? ctx.content.skills.get(ctx.sourceId)?.name : undefined) ?? ctx.sourceId ?? 'heal'
    ctx.fx.log('heal', `${holder.name}: ${label} heals ${target.name} for ${healed}`, { actorId: holder.id, targetId: target.id, amount: healed })
    const overheal = scaled - healed
    if (overheal <= 0 || target.gone || target.fallen) return
    const passive = holder.hooks.find((h) => h.customId === 'overheal-to-shield')?.line
    const cap = roundHalfUp((target.maxHp * (passive?.percent ?? 15)) / 100)
    const magnitude = Math.min(overheal, cap)
    if (magnitude <= 0) return
    const r = ctx.fx.applyStatus(target, { status: 'shield', duration: passive?.duration ?? 2, magnitude }, holder.id)
    if (r === 'applied') ctx.fx.log('overflow', `${holder.name}'s overflow shields ${target.name} for ${magnitude}`, { actorId: holder.id, targetId: target.id, amount: magnitude })
  },
}
export default handler
