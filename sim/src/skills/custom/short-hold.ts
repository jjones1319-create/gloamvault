import type { CustomHandler } from './types.ts'

/**
 * The Deep Tentacle's sucker pad breaks (06 §3.3 part-break: "Grab lasts 1 turn"). Runs with the tentacle as holder
 * and target and stays on it: a hero it holds is let go at the tentacle's second turn start of the hold (one full
 * turn held), instead of at the Grab rule's cap (06 §7: a Special holds 3 of its turns).
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, data: { held: '' } })
    ctx.fx.log('partBreakEffect', `${ctx.holder.name}'s grip loosens`, { actorId: ctx.holder.id })
  },
  onTurnStart: (ctx) => {
    const hook = ctx.hook
    if (!hook) return
    const holder = ctx.holder
    const before = String(hook.data.held ?? '')
      .split(',')
      .filter((s) => s.length > 0)
    const now: string[] = []
    for (const held of ctx.state.actors.filter((a) => a.grabbedBy === holder.id)) {
      if (before.includes(held.id)) {
        held.grabbedBy = null
        ctx.fx.removeStatus(held, 'grab')
        ctx.fx.log('release', `${holder.name} lets ${held.name} slip free`, { actorId: holder.id, targetId: held.id })
      } else now.push(held.id)
    }
    hook.data.held = now.join(',')
  },
}
export default handler
