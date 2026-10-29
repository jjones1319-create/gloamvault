import type { CustomHandler } from './types.ts'

/**
 * Quickstep (Blade, Iron Dance I; docs/classes/blade.md §4.1): the holder's next action resolves at weight `amount`
 * (800) instead of its own. The line installs a hook that waits out the action that cast it (the holder's action
 * count) and consumes itself in `modifyWeight` on the next one. Reading: an action already lighter than `amount`
 * keeps its own weight (a Swap row stays 400). Sunflare (Arcanist, Tier V) uses it for "the next cast weighs 800": a
 * heavy Mana cast asks `chargeWeight` (pure) before its charge is declared, so the lightened cast does not charge.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, data: { since: ctx.holder.tally.actions } })
  },
  chargeWeight: (ctx, weight) => {
    const hook = ctx.hook
    if (!hook || Number(hook.data.since) === ctx.holder.tally.actions) return weight
    return Math.min(weight, ctx.line.amount ?? weight)
  },
  modifyWeight: (ctx, weight) => {
    const hook = ctx.hook
    if (!hook || Number(hook.data.since) === ctx.holder.tally.actions) return weight
    ctx.fx.removeHook(ctx.holder, hook)
    return Math.min(weight, ctx.line.amount ?? weight)
  },
}
export default handler
