import type { CustomHandler, HookContext, IncomingDamage } from './types.ts'

/**
 * Punish (Warden, Vanguard II; docs/classes/warden.md §4.2): every counter-hit deals +`percent`.
 * Reading: a counter-hit is a non-melee strike dealt by a melee-armed hero while it holds a `counter-stance` hook
 * (Counter Stance, Phalanx's stance and their successors all strike with `isMelee: false`); strikes that set the
 * flag `noCounter:<holder id>` (Spiked Rim's reflect, Spearwall's free hit, a Rebuke) are not counter-hits.
 */
function isCounterHit(ctx: HookContext, incoming: IncomingDamage): boolean {
  const h = ctx.holder
  if (incoming.isMelee || incoming.isDot || !h.hero || h.hero.weapon.ranged) return false
  if (ctx.state.flags[`noCounter:${h.id}`] === true) return false
  return h.hooks.some((k) => k.customId === 'counter-stance')
}

const handler: CustomHandler = {
  outgoingDamagePercent: (ctx, _target, incoming) => (isCounterHit(ctx, incoming) ? (ctx.line.percent ?? 0) : 0),
}
export default handler
