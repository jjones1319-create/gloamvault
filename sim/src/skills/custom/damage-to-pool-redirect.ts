import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/**
 * Guardian Spirit (Mender, Benediction V; docs/classes/mender.md §4.1): for `duration` turns (3), `percent`% (50) of
 * every hit the ally takes is paid from the caster's pool at `amount` pool points per HP (2; Mastery 1) instead of
 * from the ally's HP; when the pool can no longer pay, the effect ends. `apply` puts the line on the ally as a hook
 * (sourceId = the caster); `absorb` — read after Guard, Block and Defense, beside Shields — takes the paid share off
 * the hit. The caster must be standing; DoTs pass through, as they pass every Shield.
 */
function caster(ctx: HookContext): Actor | null {
  return ctx.state.actors.find((a) => a.id === ctx.hook?.sourceId) ?? null
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const ally = target ?? ctx.holder
    ctx.fx.installHook(ally, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? 3 })
    ctx.fx.log('guardian', `${ctx.holder.name}'s spirit stands guard over ${ally.name}`, { actorId: ctx.holder.id, targetId: ally.id })
  },
  absorb: (ctx, incoming) => {
    const hook = ctx.hook
    const c = caster(ctx)
    if (!hook || incoming.isDot || incoming.amount <= 0) return incoming.amount
    const rate = Math.max(1, Math.round(ctx.line.amount ?? 2))
    if (!c || !ctx.fx.isActive(c) || c.poolKind === null || c.pool < rate) {
      ctx.fx.removeHook(ctx.holder, hook)
      return incoming.amount
    }
    const share = Math.floor((incoming.amount * (ctx.line.percent ?? 50)) / 100)
    const paid = Math.min(share, Math.floor(c.pool / rate))
    if (paid <= 0) return incoming.amount
    c.pool -= paid * rate
    ctx.fx.log('guardian', `${c.name} pays ${paid * rate} ${c.poolKind} to spare ${ctx.holder.name} ${paid} HP`, { actorId: c.id, targetId: ctx.holder.id, amount: paid })
    if (c.pool < rate) {
      ctx.fx.removeHook(ctx.holder, hook)
      ctx.fx.log('guardianEnds', `${c.name}'s spirit has nothing left to give`, { actorId: c.id, targetId: ctx.holder.id })
    }
    return incoming.amount - paid
  },
}
export default handler
