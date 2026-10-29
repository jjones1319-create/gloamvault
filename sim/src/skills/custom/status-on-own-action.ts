import type { CustomHandler } from './types.ts'

/**
 * Endless Winter (Arcanist, Rime V; docs/classes/arcanist.md §4.2): for `duration` turns (3) the target gets `status`
 * (Chill) for `amount` turn(s) (1) whenever it acts. `apply` puts the line on each target as a hook that counts down
 * with the target's turns; `onHolderAttacks` — the fight's call as an actor's skill, attack or blow begins — lays the
 * status on the actor, credited to the caster (`hook.sourceId`).
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || !ctx.line.status || !ctx.fx.isActive(target)) return
    ctx.fx.installHook(target, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? 3 })
  },
  onHolderAttacks: (ctx) => {
    const hook = ctx.hook
    const status = ctx.line.status
    if (!hook || !status || !ctx.fx.isActive(ctx.holder)) return
    ctx.fx.applyStatus(ctx.holder, { status, duration: Math.max(1, Math.round(ctx.line.amount ?? 1)) }, hook.sourceId)
  },
}
export default handler
