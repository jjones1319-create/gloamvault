import type { CustomHandler } from './types.ts'

/**
 * The Hourglass Shard (08 §3): "Your next action weighs 0 (instant)". The relic is instant (relics.ts: no Item action,
 * the hero acts again), so `apply` installs the hook and the very next action whose weight is spent — usually in the
 * same turn — weighs `amount` (0) and consumes it. Unlike Quickstep's `next-action-weight`, it does not wait out the
 * action that cast it, because the relic's use spends no weight. A charged cast pays its weight at the charge's end
 * and leaves the hook for the action after it.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId })
    ctx.fx.log('relic', `Time slows around ${ctx.holder.name}`, { actorId: ctx.holder.id })
  },
  modifyWeight: (ctx, weight) => {
    const hook = ctx.hook
    if (!hook) return weight
    ctx.fx.removeHook(ctx.holder, hook)
    return Math.min(weight, ctx.line.amount ?? 0)
  },
}
export default handler
