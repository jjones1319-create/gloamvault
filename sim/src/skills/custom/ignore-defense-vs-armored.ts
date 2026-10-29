import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

/** A construct or an armored elite (the sheet's examples: vault sentinels, bone knights, forge-golems). */
function armored(target: HookContext['holder']): boolean {
  const m = target.monster
  if (!m) return false
  return m.role === 'elite' || /construct|golem|sentinel/.test(`${m.familyId} ${m.monsterId}`)
}

/**
 * Vault Cracker (Shade, Larceny V; docs/classes/shade.md §4.3): this action's damage ignores `percent`% (100: all) of
 * the Defense of constructs and armored elites — read as an elite-role monster or one of the construct and golem
 * families (vault sentinels, bone knights, forge-golems). The same reading as `ignore-defense-percent`: an
 * `outgoingDamagePercent` for the current action equal to the blow with that Defense removed, consumed when the skill
 * resolves. (The corridor half is `corridor-open-locks`.)
 */
const handler: CustomHandler = {
  apply: (ctx) => {
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
    if (hook.data.inSkill !== true || incoming.isDot || !armored(target)) return 0
    const pct = Math.max(0, Math.min(100, ctx.line.percent ?? 100))
    const def = ctx.fx.statOf(target, 'defense')
    if (pct <= 0 || def <= 0) return 0
    const k = ctx.t.derived.defense.mitigationK
    return roundHalfUp(((k + def) / (k + (def * (100 - pct)) / 100) - 1) * 100)
  },
  onSkillUsed: (ctx) => {
    if (ctx.hook) ctx.fx.removeHook(ctx.holder, ctx.hook)
  },
}
export default handler
