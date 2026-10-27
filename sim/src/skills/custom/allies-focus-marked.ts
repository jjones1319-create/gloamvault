import type { CustomHandler } from './types.ts'

/**
 * Grin's rider (Captain Vexa Marrow, 06 §3.1): "Mark (2) on one hero; all bandits target them". The line (target
 * allAllies) installs a persistent hook on every monster on her side; `preferredTarget` hands the fight the Marked
 * hero whenever a bandit's behaviour names no target, preferring the hero this Captain marked. The hook lasts the
 * fight and is inert while nobody is Marked.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const ally = target ?? ctx.holder
    if (ally.side !== ctx.holder.side) return
    ctx.fx.installHook(ally, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId })
  },
  preferredTarget: (ctx, candidates) => {
    const source = ctx.hook?.sourceId ?? null
    const marked = candidates.filter((c) => c.side !== ctx.holder.side && c.statuses.some((s) => s.id === 'mark'))
    if (marked.length === 0) return null
    return marked.find((c) => c.statuses.some((s) => s.id === 'mark' && s.sourceId === source)) ?? marked[0] ?? null
  },
}
export default handler
