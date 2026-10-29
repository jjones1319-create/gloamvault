import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

/**
 * Oath of the Vault (Warden, Warcry V; docs/classes/warden.md §4.3, D-099): for `duration` turns allies cannot drop
 * below 1 HP — each ally is saved `amount` time(s) per cast (D-099: once; the first blow that would drop them leaves
 * them at 1 HP) — and when the oath ends the caster takes `percent`% of its max HP (Mastery: 4 turns, `percent` 0).
 * The line (target: every ally, the caster too) installs a save on each ally — a hook whose counter is its saves left —
 * and the oath itself on the caster (data.role 'oath'; data.cast numbers the casts, one per action). The oath counts
 * `duration` of the caster's turns (each turn start after the cast takes one; the next turn start after the last ends
 * it, so a 3-turn oath covers the caster's next three turns); at its end the saves of that cast are removed and the
 * caster pays. A save answers only while its cast's oath holds and the caster
 * stands (a fallen oath-keeper's oath breaks). A new cast replaces the old one. Fortify is the skill's own line.
 * Reading: the price is a cost paid from HP (no Block, no Defense) that never drops the caster below 1 HP.
 */
const ID = 'oath-of-the-vault'

function oathHolds(ctx: HookContext, casterId: string, cast: number): boolean {
  const caster = ctx.state.actors.find((a) => a.id === casterId)
  if (!caster || !ctx.fx.isActive(caster)) return false
  return caster.hooks.some((h) => h.customId === ID && h.data.role === 'oath' && Number(h.data.cast) === cast)
}

function clearCast(ctx: HookContext, casterId: string, keep: number | null): void {
  for (const a of ctx.state.actors) for (const h of [...a.hooks]) if (h.customId === ID && h.sourceId === casterId && Number(h.data.cast) !== keep) ctx.fx.removeHook(a, h)
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const caster = ctx.holder
    if (!target || target.side !== caster.side) return
    // Every target of the one action belongs to one cast (the line resolves once per target).
    const openKey = `oathAction:${caster.id}`
    const castKey = `oathCast:${caster.id}`
    if (ctx.state.flags[openKey] !== caster.tally.actions) {
      const cast = Number(ctx.state.flags[castKey] ?? 0) + 1
      ctx.state.flags[castKey] = cast
      ctx.state.flags[openKey] = caster.tally.actions
      clearCast(ctx, caster.id, null)
      ctx.fx.installHook(caster, ctx.line, caster.id, { sourceSkillId: ctx.sourceId, replace: false, data: { role: 'oath', cast, turns: ctx.line.duration ?? 3 } })
      ctx.fx.log('oath', `${caster.name} swears the Oath of the Vault`, { actorId: caster.id })
    }
    const cast = Number(ctx.state.flags[castKey])
    ctx.fx.installHook(target, ctx.line, caster.id, { sourceSkillId: ctx.sourceId, replace: false, counter: Math.max(1, ctx.line.amount ?? 1), data: { role: 'save', cast } })
  },
  beforeDowned: (ctx) => {
    const hook = ctx.hook
    if (!hook || hook.data.role !== 'save' || hook.counter <= 0) return false
    if (!oathHolds(ctx, hook.sourceId, Number(hook.data.cast))) return false
    hook.counter -= 1
    ctx.fx.log('oathSave', `The Oath of the Vault holds ${ctx.holder.name} at the edge`, { actorId: hook.sourceId, targetId: ctx.holder.id })
    if (hook.counter <= 0) ctx.fx.removeHook(ctx.holder, hook)
    return true
  },
  onTurnStart: (ctx) => {
    const hook = ctx.hook
    if (!hook || hook.data.role !== 'oath') return
    const turns = Number(hook.data.turns ?? 0)
    if (turns > 0) {
      hook.data.turns = turns - 1
      return
    }
    clearCast(ctx, ctx.holder.id, -1)
    ctx.fx.log('oathEnd', 'The Oath of the Vault ends', { actorId: ctx.holder.id })
    // The price is a cost, not a blow: no Block, no Defense, and it never drops the caster below 1 HP.
    const cost = Math.min(roundHalfUp((ctx.holder.maxHp * (ctx.line.percent ?? 0)) / 100), ctx.holder.hp - 1)
    if (cost > 0 && ctx.fx.isActive(ctx.holder)) {
      ctx.holder.hp -= cost
      ctx.holder.tally.damageTaken += cost
      ctx.fx.log('cost', `${ctx.holder.name} pays the oath's price: ${cost} HP`, { actorId: ctx.holder.id, targetId: ctx.holder.id, amount: cost })
    }
  },
}
export default handler
