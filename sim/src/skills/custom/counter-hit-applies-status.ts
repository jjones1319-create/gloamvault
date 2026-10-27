import type { CustomHandler, HookContext, IncomingDamage } from './types.ts'

/**
 * Punish (Warden, Vanguard II; docs/classes/warden.md §4.2): every counter-hit applies `status` (Weaken) for
 * `duration` turns. Reading: the same counter-hit test as `counter-hit-damage-percent` — a non-melee strike by a
 * melee-armed hero holding a `counter-stance` hook, not flagged `noCounter:<holder id>`.
 */
function isCounterHit(ctx: HookContext, incoming: IncomingDamage): boolean {
  const h = ctx.holder
  if (incoming.isMelee || incoming.isDot || !h.hero || h.hero.weapon.ranged) return false
  if (ctx.state.flags[`noCounter:${h.id}`] === true) return false
  return h.hooks.some((k) => k.customId === 'counter-stance')
}

const handler: CustomHandler = {
  onDealtDamage: (ctx, target, _dealt, incoming) => {
    if (!ctx.line.status || !isCounterHit(ctx, incoming) || !ctx.fx.isActive(target)) return
    ctx.fx.applyStatus(target, { status: ctx.line.status, duration: ctx.line.duration }, ctx.holder.id)
  },
}
export default handler
