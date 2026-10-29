import type { CustomHandler } from './types.ts'

/**
 * Aegis of the Keep (Warden, Bulwark V; docs/classes/warden.md §4.1): "you take −30% damage for the duration" — the
 * target takes `percent`% damage (−30) for `duration` turns. The line installs a hook on the target for that many of
 * its turns (one more when it is cast on the actor whose turn it is, as a fresh status keeps its full duration);
 * `incomingDamagePercent` answers on every direct hit, DoT ticks aside.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    const turns = ctx.line.duration ?? 3
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: turns + (ctx.state.actingId === holder.id ? 1 : 0) })
  },
  incomingDamagePercent: (ctx, incoming) => (incoming.isDot ? 0 : (ctx.line.percent ?? 0)),
}
export default handler
