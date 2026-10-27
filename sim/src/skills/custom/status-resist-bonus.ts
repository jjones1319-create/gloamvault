import type { CustomHandler } from './types.ts'

/**
 * Antidote (08 §4): "+50% Poison resistance 3 rounds" — a `status-resist-bonus` line names `status`, `percent` and
 * `duration`. `apply` installs the line on the target as a hook that lasts `duration` turns; statuses.ts
 * `resistChance` adds the `percent` of every such hook whose `status` matches to the resist roll. The same hook is
 * installed by `fear-stun-resist-percent` (Steadfast) and by the delve's floor-long Fear immunity (a Toll Shrine
 * cleansed with holy water), both with no duration.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const who = target ?? ctx.holder
    ctx.fx.installHook(who, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? 3 })
    ctx.fx.log('resist', `${who.name} shrugs off ${ctx.line.status ?? 'ailments'} more easily (+${ctx.line.percent ?? 0}%)`, { actorId: ctx.holder.id, targetId: who.id, data: { status: ctx.line.status ?? null } })
  },
}
export default handler
