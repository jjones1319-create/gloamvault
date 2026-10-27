import type { CustomHandler } from './types.ts'

/**
 * Intercept (Warden, Bulwark II; docs/classes/warden.md §4.1): for `duration` turns, single-target attacks aimed at
 * the chosen ally land on the Warden instead at (100 + `percent`)% (−10). The line installs a hook on the ally whose
 * sourceId is the Warden; the hook answers while the Warden stands. AoE, DoTs and Ultimates are not intercepted.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || target === ctx.holder) return
    ctx.fx.installHook(target, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? 2 })
    ctx.fx.log('intercept', `${ctx.holder.name} stands in front of ${target.name}`, { actorId: ctx.holder.id, targetId: target.id })
  },
  intercept: (ctx, _attacker, incoming) => {
    if (!incoming.isSingleTarget || incoming.isDot || incoming.isUltimate) return null
    const warden = ctx.state.actors.find((a) => a.id === ctx.hook?.sourceId)
    if (!warden || !ctx.fx.isActive(warden)) return null
    return { interceptorId: warden.id, percent: ctx.line.percent ?? 0 }
  },
}
export default handler
