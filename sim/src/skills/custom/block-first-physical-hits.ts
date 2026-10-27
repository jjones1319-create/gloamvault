import type { CustomHandler } from './types.ts'

/**
 * Bone Knight's Stand (Warden, Bulwark III; docs/classes/warden.md §4.1): until your next turn the first `amount`
 * physical hits are blocked automatically.
 * Reading: the sim has no forced-block joint, so the hook halves the hit where Block would (`incomingDamagePercent`
 * −50 on a physical, non-DoT, non-Ultimate hit), counts it in `tally.blocks`, logs it and bumps the flag
 * `autoBlock:<holder id>` so `reflect-on-block-percent`, `pool-on-block` and `damage-plus-blocked-since-last-turn`
 * treat it as a block. The natural Block roll still rolls on top (a lucky roll halves twice). The hook drops at the
 * holder's next turn start.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, untilTurnStart: true, counter: Math.max(1, ctx.line.amount ?? 1) })
    ctx.fx.log('stance', `${holder.name} braces behind the shield`, { actorId: holder.id })
  },
  incomingDamagePercent: (ctx, incoming) => {
    const hook = ctx.hook
    if (!hook || hook.counter <= 0 || !incoming.physical || incoming.isDot || incoming.isUltimate) return 0
    hook.counter -= 1
    const key = `autoBlock:${ctx.holder.id}`
    ctx.state.flags[key] = Number(ctx.state.flags[key] ?? 0) + 1
    ctx.holder.tally.blocks += 1
    ctx.fx.log('block', `${ctx.holder.name} blocks`, { actorId: ctx.holder.id, targetId: incoming.attacker?.id })
    if (hook.counter <= 0) ctx.fx.removeHook(ctx.holder, hook)
    return -50
  },
}
export default handler
