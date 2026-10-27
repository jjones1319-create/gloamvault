import type { CustomHandler } from './types.ts'

/**
 * Pinning Strike, Mastery (Warden, Vanguard III; docs/classes/warden.md §4.2): the skill deals +`percent` per turn
 * of `status` (Root) left on the target when it lands. Reading: the skill's own Root line refreshes the duration
 * before this line resolves, so the first use installs a fight-long hook on the Warden whose `modifyLine` scales the
 * skill's damage line by the chosen target's Root turns as they stand before the hit; the installing use itself
 * gets no bonus.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId })
  },
  modifyLine: (ctx, line, source, chosen) => {
    const hook = ctx.hook
    const status = ctx.line.status
    if (!hook || !status || !chosen || line.kind !== 'damage' || source.kind !== 'skill' || source.id !== hook.sourceSkillId) return null
    const turns = chosen.statuses.find((s) => s.id === status)?.turnsLeft ?? 0
    if (turns <= 0) return null
    return { ...line, multiplier: (line.multiplier ?? 1) * (1 + ((ctx.line.percent ?? 0) * turns) / 100) }
  },
}
export default handler
