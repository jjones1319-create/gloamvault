import type { CustomHandler, HookContext, IncomingDamage } from './types.ts'

/**
 * Unyielding Point (Warden, Vanguard IV passive; docs/classes/warden.md §4.2): counter-hits strike at `multiplier`×
 * (1.5) instead of 1.0× — a +(multiplier − 1)×100 percent on every counter-hit (they already can crit). Mastery: the
 * same line names `status` (Root) and `duration` (1) and every counter-hit applies it. Reading: the counter-hit test of
 * `counter-hit-damage-percent` (a non-melee strike by a melee-armed hero holding a `counter-stance` hook, not flagged
 * `noCounter:<holder id>`); this is its own hook so Punish's +50% and Weaken stack with it (two passives' lines with one
 * customId would replace each other on the holder).
 */
function isCounterHit(ctx: HookContext, incoming: IncomingDamage): boolean {
  const h = ctx.holder
  if (incoming.isMelee || incoming.isDot || !h.hero || h.hero.weapon.ranged) return false
  if (ctx.state.flags[`noCounter:${h.id}`] === true) return false
  return h.hooks.some((k) => k.customId === 'counter-stance')
}

const handler: CustomHandler = {
  outgoingDamagePercent: (ctx, _target, incoming) => (isCounterHit(ctx, incoming) ? Math.round(((ctx.line.multiplier ?? 1) - 1) * 100) : 0),
  onDealtDamage: (ctx, target, _dealt, incoming) => {
    if (!ctx.line.status || !isCounterHit(ctx, incoming) || !ctx.fx.isActive(target)) return
    ctx.fx.applyStatus(target, { status: ctx.line.status, duration: ctx.line.duration }, ctx.holder.id)
  },
}
export default handler
