import type { CustomHandler } from './types.ts'

/**
 * Drop (Cellar Spider, 06 §3.1): "×1.3, only from the back row, moves it to the front". The attack's blow and its
 * row change are DSL lines (damage, then rowSwap on self); this rider owns the legality. Reading: the fight has no
 * joint to forbid an attack by row, so a Drop chosen from the front row keeps its blow but must not bounce the
 * spider back to the back row — `apply` installs a one-shot hook whose `modifyLine` skips the attack's own rowSwap
 * line; from the back row it only logs the drop.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const spider = ctx.holder
    if (spider.row === 'back') {
      ctx.fx.log('drop', `${spider.name} drops from the dark`, { actorId: spider.id })
      return
    }
    ctx.fx.installHook(spider, ctx.line, spider.id, { sourceSkillId: ctx.sourceId, untilTurnStart: true, counter: 1 })
    ctx.fx.log('drop', `${spider.name} lunges from the front row (no drop)`, { actorId: spider.id })
  },
  modifyLine: (ctx, line, source) => {
    const hook = ctx.hook
    if (!hook || line.kind !== 'rowSwap' || source.id !== hook.sourceSkillId) return null
    ctx.fx.removeHook(ctx.holder, hook)
    return 'skip'
  },
}
export default handler
