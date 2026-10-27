import { clamp, roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

/**
 * Wall Stance (Warden, Bulwark I; docs/classes/warden.md §4.1): a successful block restores `percent` of the pool.
 * Natural blocks arrive through `onBlock`; the auto-blocks of `block-first-physical-hits` through the
 * `autoBlock:<holder id>` flag, read in `afterHit`.
 */
function restore(ctx: HookContext): void {
  const holder = ctx.holder
  if (!holder.poolKind) return
  const amount = roundHalfUp((holder.poolMax * (ctx.line.percent ?? 0)) / 100)
  if (amount <= 0) return
  holder.pool = clamp(holder.pool + amount, 0, holder.poolMax)
  ctx.fx.log('pool', `${holder.name}'s block restores ${amount} ${holder.poolKind}`, { actorId: holder.id, amount })
}

const handler: CustomHandler = {
  onFightStart: (ctx) => {
    if (ctx.hook) ctx.hook.data.seenAuto = Number(ctx.state.flags[`autoBlock:${ctx.holder.id}`] ?? 0)
  },
  onBlock: (ctx) => restore(ctx),
  afterHit: (ctx) => {
    const hook = ctx.hook
    if (!hook) return
    const auto = Number(ctx.state.flags[`autoBlock:${ctx.holder.id}`] ?? 0)
    const seen = Number(hook.data.seenAuto ?? 0)
    hook.data.seenAuto = auto
    if (auto > seen) restore(ctx)
  },
}
export default handler
