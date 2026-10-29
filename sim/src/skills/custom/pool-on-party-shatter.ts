import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

/**
 * Deep Cold (Arcanist passive, Rime IV; docs/classes/arcanist.md §4.2): whenever an ally — the holder included —
 * shatters a Frozen enemy, the holder restores `percent`% of its max pool (15; Mastery 20). Reading: a shatter happens
 * inside another hook (Shatter's `party-shatter-bonus`, Avalanche's `shatter-frozen`), which logs a 'shatter' event;
 * this hook reads the log since it last looked, at the fight's start, at each of the holder's turn starts and after each
 * of its skills, and pays once per shatter by a hero or pet of the holder's side.
 */
function settle(ctx: HookContext): void {
  const hook = ctx.hook
  if (!hook) return
  const log = ctx.state.log
  const from = typeof hook.data.seen === 'number' ? hook.data.seen : log.length
  hook.data.seen = log.length
  if (ctx.holder.poolKind === null || ctx.holder.poolMax <= 0 || !ctx.fx.isActive(ctx.holder)) return
  let shatters = 0
  for (let i = from; i < log.length; i++) {
    const e = log[i]
    if (!e || e.kind !== 'shatter') continue
    const by = ctx.state.actors.find((a) => a.id === e.actorId)
    if (by && by.side === ctx.holder.side) shatters += 1
  }
  if (shatters === 0) return
  const gain = roundHalfUp((ctx.holder.poolMax * (ctx.line.percent ?? 15) * shatters) / 100)
  const before = ctx.holder.pool
  ctx.holder.pool = Math.min(ctx.holder.poolMax, ctx.holder.pool + gain)
  ctx.fx.log('deepCold', `${ctx.holder.name} drinks the cold of ${shatters} shatter${shatters === 1 ? '' : 's'} (+${ctx.holder.pool - before} ${ctx.holder.poolKind})`, { actorId: ctx.holder.id, amount: ctx.holder.pool - before })
}

const handler: CustomHandler = {
  onFightStart: (ctx) => {
    if (ctx.hook) ctx.hook.data.seen = ctx.state.log.length
  },
  onTurnStart: (ctx) => settle(ctx),
  onSkillUsed: (ctx) => settle(ctx),
}
export default handler
