import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

const STARTS = new Set(['action', 'guard', 'swapRow', 'flee', 'fleeFail', 'freeAlly', 'charge', 'stance'])

/** The log index of the holder's current action marker. */
function actionStart(ctx: HookContext): number {
  const log = ctx.state.log
  for (let i = log.length - 1; i >= 0; i--) if (log[i]?.actorId === ctx.holder.id && STARTS.has(log[i]?.kind ?? '')) return i
  return 0
}

/**
 * Was the holder Veiled as this action began? The fight ends Veil the moment the holder attacks, before any line
 * resolves, so the status is read from the log (the reading of veil-strike-bonus): walking back from the action's
 * marker, a Veil `status` event on the holder says yes unless an earlier action of the holder, the Veil's
 * `statusEnd` or a miss on the holder (a Veil spent) comes first.
 */
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
 * Heartseeker, Comet Shot (Ranger, Marksman IV–V; docs/classes/ranger.md §4.1) and Assassinate (Shade, Shadow IV;
 * shade.md §4.1): this action's damage ignores `percent`% of the target's Defense (100 = all of it); with `status`, only
 * when the holder was in that status as the action began (Assassinate: from Veil).
 * Reading: the damage pipeline has no attacker-side Defense joint, so the line (before the damage line) installs a hook
 * for the current action whose `outgoingDamagePercent` pays the same blow — mitigation is k / (k + Defense) (03 §2.2),
 * so ignoring p% of Defense D is the hit scaled by (k + D) / (k + D·(1 − p)). The hook is consumed when the skill
 * resolves. DoT ticks are never scaled.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const st = ctx.line.status
    if (st && !(ctx.fx.hasStatus(ctx.holder, st) || (st === 'veil' && veiledByLog(ctx)))) return
    ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, data: { action: ctx.holder.tally.actions } })
  },
  // Only the skill's own damage lines: a hook's strike in the same action (an execute's extra blow) already ignores Defense.
  modifyLine: (ctx, line, source) => {
    if (ctx.hook) ctx.hook.data.inSkill = source.id === ctx.hook.sourceSkillId && line.kind === 'damage'
    return null
  },
  outgoingDamagePercent: (ctx, target, incoming) => {
    const hook = ctx.hook
    if (!hook) return 0
    if (Number(hook.data.action) !== ctx.holder.tally.actions) {
      ctx.fx.removeHook(ctx.holder, hook)
      return 0
    }
    if (hook.data.inSkill !== true || incoming.isDot) return 0
    const pct = Math.max(0, Math.min(100, ctx.line.percent ?? 0))
    const def = ctx.fx.statOf(target, 'defense')
    if (pct <= 0 || def <= 0) return 0
    const k = ctx.t.derived.defense.mitigationK
    const kept = (def * (100 - pct)) / 100
    return roundHalfUp(((k + def) / (k + kept) - 1) * 100)
  },
  onSkillUsed: (ctx) => {
    if (ctx.hook) ctx.fx.removeHook(ctx.holder, ctx.hook)
  },
}
export default handler
