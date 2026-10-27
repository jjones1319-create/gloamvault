import type { CustomHandler } from './types.ts'

/**
 * Frozen Tomb (Arcanist, Rime III; docs/classes/arcanist.md §4.2): cast on an ally the tomb encases instead of
 * freezing — immune to all damage until the ally's next turn, then `status` 1 (mastery: no Chill).
 * Reading: the skill's target word is `enemy`, so this line reaches an ally only when it resolves on one (a
 * `target: 'ally'` override or a hook's applyLine); on an enemy it does nothing by design (the Freeze line is the
 * enemy mode). The sim has no joint that skips a skill's *other* lines by the target's side, so the Freeze line still
 * resolves on an enemy in the same cast — a documented gap. The encasement is a hook whose `absorb` swallows every
 * hit; DoT ticks bypass the pipeline and still land. It removes itself at the ally's turn start and applies the status.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || target.side !== ctx.holder.side) return
    ctx.fx.installHook(target, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId })
    ctx.fx.log('encase', `${target.name} is encased in ice`, { actorId: ctx.holder.id, targetId: target.id })
  },
  absorb: (ctx, incoming) => {
    if (incoming.amount > 0) ctx.fx.log('encased', `the ice around ${ctx.holder.name} takes the blow`, { targetId: ctx.holder.id, amount: incoming.amount })
    return 0
  },
  onTurnStart: (ctx) => {
    if (!ctx.hook) return
    ctx.fx.removeHook(ctx.holder, ctx.hook)
    if (ctx.line.status) ctx.fx.applyStatus(ctx.holder, { status: ctx.line.status, duration: ctx.line.duration ?? 1 }, ctx.hook.sourceId)
    ctx.fx.log('encaseEnd', `${ctx.holder.name} breaks out of the ice`, { targetId: ctx.holder.id })
  },
}
export default handler
