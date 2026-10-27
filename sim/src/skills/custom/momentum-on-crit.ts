import type { CustomHandler, HookContext } from './types.ts'

const STARTS = new Set(['action', 'guard', 'swapRow', 'flee', 'fleeFail', 'freeAlly', 'charge', 'stance'])

/** Crits the holder landed in its current action, read from the hits' own log events back to the action marker. */
function critsThisAction(ctx: HookContext): number {
  const log = ctx.state.log
  let n = 0
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]
    if (!e) continue
    if (e.actorId === ctx.holder.id && STARTS.has(e.kind)) break
    if (e.kind === 'damage' && e.actorId === ctx.holder.id && e.data?.crit === true) n += 1
  }
  return n
}

/**
 * Cold Read (Shade, Shadow I; docs/classes/shade.md §4.1): each crit the holder lands grants +`amount` Momentum.
 * Reading: no joint reports a crit, so the hook settles once per action (after a skill, or as the action's weight is
 * spent) by counting this action's crit events in the log. Chain strikes carry no crit flag and never count.
 */
function settle(ctx: HookContext): void {
  const hook = ctx.hook
  if (!hook || hook.data.action === ctx.holder.tally.actions) return
  hook.data.action = ctx.holder.tally.actions
  const crits = critsThisAction(ctx)
  if (crits <= 0) return
  const gain = crits * (ctx.line.amount ?? 0)
  ctx.fx.gainMomentum(ctx.holder, gain)
  ctx.fx.log('momentum', `${ctx.holder.name} reads the opening (+${gain} Momentum)`, { actorId: ctx.holder.id, amount: gain })
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null, data: { action: -1 } })
  },
  onSkillUsed: (ctx) => settle(ctx),
  modifyWeight: (ctx, w) => {
    settle(ctx)
    return w
  },
}
export default handler
