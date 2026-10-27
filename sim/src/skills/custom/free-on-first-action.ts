import { clamp, roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

const STARTS = new Set(['action', 'guard', 'swapRow', 'flee', 'fleeFail', 'freeAlly', 'charge', 'stance'])

function actionStart(ctx: HookContext): number {
  const log = ctx.state.log
  for (let i = log.length - 1; i >= 0; i--) if (log[i]?.actorId === ctx.holder.id && STARTS.has(log[i]?.kind ?? '')) return i
  return 0
}

/**
 * Veil mastery (Shade, Shadow I; docs/classes/shade.md §4.1): the skill costs 0 pool when it is the holder's first
 * action of the fight. Reading: cost hooks are read before a skill resolves and this line belongs to the skill, so
 * the cost is paid and refunded as the line resolves (the pool must still cover it to pick the skill). A Fortune
 * free-cast this action leaves nothing to refund.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const holder = ctx.holder
    if (holder.tally.actions !== 0 || holder.poolKind === null) return
    const skill = ctx.content.skills.get(ctx.sourceId ?? '')
    if (!skill) return
    const rank = holder.hero?.ranks[skill.id] ?? 1
    const cost = Math.max(0, roundHalfUp((skill.cost * (100 + skill.rankScaling.costPerRank * (rank - 1))) / 100))
    if (cost <= 0) return
    if (ctx.state.log.slice(actionStart(ctx)).some((e) => e.kind === 'fortune' && e.actorId === holder.id)) return
    holder.pool = clamp(holder.pool + cost, 0, holder.poolMax)
    ctx.fx.log('freeCast', `${holder.name}'s ${skill.name} costs nothing (first action)`, { actorId: holder.id, amount: cost })
  },
}
export default handler
