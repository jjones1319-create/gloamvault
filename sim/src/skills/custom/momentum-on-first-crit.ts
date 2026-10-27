import type { CustomHandler, HookContext } from './types.ts'

const STARTS = new Set(['action', 'guard', 'swapRow', 'flee', 'fleeFail', 'freeAlly', 'charge', 'stance'])

function critThisAction(ctx: HookContext): boolean {
  const log = ctx.state.log
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]
    if (!e) continue
    if (e.actorId === ctx.holder.id && STARTS.has(e.kind)) return false
    if (e.kind === 'damage' && e.actorId === ctx.holder.id && e.data?.crit === true) return true
  }
  return false
}

/**
 * Killer's Calm (Shade, Shadow III; docs/classes/shade.md §4.1): once per fight, the holder's first crit grants
 * +`amount` Momentum. Reading: settled once per action from this action's crit events in the log (no joint reports a
 * crit); `state.flags` remembers the fight's first.
 */
function settle(ctx: HookContext): void {
  const key = `firstCrit:${ctx.holder.id}`
  if (ctx.state.flags[key] || !critThisAction(ctx)) return
  ctx.state.flags[key] = true
  const gain = ctx.line.amount ?? 0
  ctx.fx.gainMomentum(ctx.holder, gain)
  ctx.fx.log('momentum', `${ctx.holder.name}'s first cut lands true (+${gain} Momentum)`, { actorId: ctx.holder.id, amount: gain })
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null })
  },
  onSkillUsed: (ctx) => settle(ctx),
  modifyWeight: (ctx, w) => {
    settle(ctx)
    return w
  },
}
export default handler
