import type { CustomHandler } from './types.ts'

/**
 * Exsanguinate (Blade, Bloodletter IV; docs/classes/blade.md §4.3): "2.4× Slash, +50% per turn of Bleed remaining on
 * the target (cap +150%)". The line comes first in the skill: it reads the turns of `status` left on the target and
 * arms a one-shot hook on the holder for this action, whose `modifyLine` scales the skill's next damage line by
 * (1 + min(`amount`, `percent` × turns) / 100) and removes itself. Unlike Pinning Strike's Mastery hook
 * (`damage-per-status-turn-remaining`, armed by its first use) the bonus counts on every use. The skill's own
 * `removeStatus` line then takes the Bleed off.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const status = ctx.line.status
    if (!target || !status) return
    const turns = target.statuses.find((s) => s.id === status)?.turnsLeft ?? 0
    const bonus = Math.min(ctx.line.amount ?? 150, (ctx.line.percent ?? 50) * Math.max(0, turns))
    if (bonus <= 0) return
    ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, data: { bonus, skill: ctx.sourceId ?? '', action: ctx.holder.tally.actions } })
  },
  modifyLine: (ctx, line, source) => {
    const hook = ctx.hook
    if (!hook) return null
    if (Number(hook.data.action) !== ctx.holder.tally.actions) {
      ctx.fx.removeHook(ctx.holder, hook)
      return null
    }
    if (line.kind !== 'damage' || source.kind !== 'skill' || source.id !== hook.data.skill) return null
    ctx.fx.removeHook(ctx.holder, hook)
    return { ...line, multiplier: (line.multiplier ?? 1) * (1 + Number(hook.data.bonus) / 100) }
  },
}
export default handler
