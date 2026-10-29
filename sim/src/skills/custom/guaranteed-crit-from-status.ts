import type { CustomHandler, HookContext } from './types.ts'

const STARTS = new Set(['action', 'guard', 'swapRow', 'flee', 'fleeFail', 'freeAlly', 'charge', 'stance'])

function actionStart(ctx: HookContext): number {
  const log = ctx.state.log
  for (let i = log.length - 1; i >= 0; i--) if (log[i]?.actorId === ctx.holder.id && STARTS.has(log[i]?.kind ?? '')) return i
  return 0
}

/** Was the holder Veiled as this action began? Read from the log, as veil-strike-bonus does (attacking ends Veil before any line). */
function veiledByLog(ctx: HookContext): boolean {
  const log = ctx.state.log
  for (let j = actionStart(ctx) - 1; j >= 0; j--) {
    const e = log[j]
    if (!e) continue
    if (e.kind === 'action' && e.actorId === ctx.holder.id) return false
    if (e.kind === 'statusEnd' && e.actorId === ctx.holder.id && e.data?.status === 'veil') return false
    // A miss spends a Veil — unless it is the dodge that granted one (Second Shadow logs `secondShadow` just before it).
    if (e.kind === 'miss' && e.targetId === ctx.holder.id && !(log[j - 1]?.kind === 'secondShadow' && log[j - 1]?.actorId === ctx.holder.id)) return false
    if (e.kind === 'status' && e.targetId === ctx.holder.id && e.data?.status === 'veil') return true
  }
  return false
}

/**
 * Assassinate (Shade, Shadow IV; docs/classes/shade.md §4.1): from Veil, this action's hits are guaranteed crits — the
 * holder must have been in `status` (Veil) as the action began. The line (before the damage line) installs a hook for
 * the current action; `forceCrit` answers and `onSkillUsed` consumes it.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const st = ctx.line.status
    if (!st || !(ctx.fx.hasStatus(ctx.holder, st) || (st === 'veil' && veiledByLog(ctx)))) return
    ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, data: { action: ctx.holder.tally.actions } })
  },
  forceCrit: (ctx) => {
    const hook = ctx.hook
    if (!hook) return false
    if (Number(hook.data.action) !== ctx.holder.tally.actions) {
      ctx.fx.removeHook(ctx.holder, hook)
      return false
    }
    return true
  },
  onSkillUsed: (ctx) => {
    if (ctx.hook) ctx.fx.removeHook(ctx.holder, ctx.hook)
  },
}
export default handler
