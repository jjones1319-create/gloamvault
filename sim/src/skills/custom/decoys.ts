import type { CustomHandler, HookContext } from './types.ts'

/**
 * Mirrored (elite affix, 06 §2): the champion starts with `amount` decoys (its nameplate, `percent` of its max HP,
 * 0 damage) in the other row; the first hit on a decoy pops it. Installed on the champion at spawn (explore.ts).
 * Reading: the fight has no verb that creates actors, so the decoys are `amount` miss tokens on the champion —
 * while any are left, a single-target hit that passed its hit roll pops one instead of landing (logged `decoy`).
 * AoE and Ultimates never roll to hit, so they ignore the decoys as they would ignore a wrong-row body; `percent`
 * (the decoy's HP) has no meaning in this reading.
 */
function arm(ctx: HookContext): void {
  const hook = ctx.hook
  if (!hook || hook.data.armed === true) return
  hook.counter = Math.max(0, ctx.line.amount ?? 2)
  hook.data.armed = true
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null, counter: Math.max(0, ctx.line.amount ?? 2), data: { armed: true } })
  },
  onFightStart: (ctx) => {
    arm(ctx)
    if (ctx.hook && ctx.hook.counter > 0) ctx.fx.log('decoys', `${ctx.holder.name} is flanked by ${ctx.hook.counter} decoys`, { actorId: ctx.holder.id, amount: ctx.hook.counter })
  },
  beforeHit: (ctx, incoming) => {
    arm(ctx)
    const hook = ctx.hook
    if (!hook || hook.counter <= 0 || !incoming.isSingleTarget || incoming.isDot || incoming.isUltimate) return null
    hook.counter -= 1
    ctx.fx.log('decoy', `a decoy of ${ctx.holder.name} shatters`, { actorId: ctx.holder.id, targetId: incoming.attacker?.id, data: { left: hook.counter } })
    return 'miss'
  },
}
export default handler
