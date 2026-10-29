import type { CustomHandler, HookContext } from './types.ts'

/**
 * Grace (Mender, Vigil IV; docs/classes/mender.md §4.3): the ally's next `amount` action(s) (1; Mastery 2) cost no pool
 * and weigh 800 whatever their own weight. `apply` puts the line on the ally as a hook; `costPercent` frees the action's
 * skill and `modifyWeight` lightens it. An action is spent once the ally's action count moves past the one it was used
 * on. A heavy Mana cast asks `chargeWeight` (a pure query) before fight.ts declares its charge: Graced, it weighs 800,
 * so it is not heavy and resolves at once (Phase 7 joint). Graced on oneself, the casting action does not count.
 */
const LIGHT = 800

/** Spends the use an earlier action took; false when the hook is gone or not yet active. */
function settle(ctx: HookContext): boolean {
  const hook = ctx.hook
  if (!hook) return false
  const actions = ctx.holder.tally.actions
  if (typeof hook.data.usedAt === 'number' && actions > hook.data.usedAt) {
    hook.counter -= 1
    delete hook.data.usedAt
    if (hook.counter <= 0) {
      ctx.fx.removeHook(ctx.holder, hook)
      return false
    }
  }
  return actions >= Number(hook.data.from ?? 0)
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const ally = target ?? ctx.holder
    const self = ally === ctx.holder
    ctx.fx.installHook(ally, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, counter: Math.max(1, Math.round(ctx.line.amount ?? 1)), data: { from: ally.tally.actions + (self ? 1 : 0) } })
    ctx.fx.log('grace', `${ally.name} is graced: the next action is light and free`, { actorId: ctx.holder.id, targetId: ally.id })
  },
  costPercent: (ctx) => {
    if (!settle(ctx) || !ctx.hook) return 0
    ctx.hook.data.usedAt = ctx.holder.tally.actions
    return -100
  },
  chargeWeight: (ctx, weight) => {
    const hook = ctx.hook
    if (!hook) return weight
    const actions = ctx.holder.tally.actions
    const left = hook.counter - (typeof hook.data.usedAt === 'number' && actions > hook.data.usedAt ? 1 : 0)
    return left > 0 && actions >= Number(hook.data.from ?? 0) ? Math.min(weight, LIGHT) : weight
  },
  modifyWeight: (ctx, weight) => {
    if (!settle(ctx) || !ctx.hook) return weight
    ctx.hook.data.usedAt = ctx.holder.tally.actions
    return Math.min(weight, LIGHT)
  },
  onTurnStart: (ctx) => {
    settle(ctx)
  },
}
export default handler
