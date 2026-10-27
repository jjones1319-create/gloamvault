import type { CustomHandler } from './types.ts'

/**
 * Commander (elite affix, 06 §2), first line: every fodder-role ally has +`percent`% Attack (both Attack stats) and
 * +`amount` Speed while the champion stands. Installed on the champion at spawn (explore.ts); statOf() reads the
 * aura from a living ally's hooks. Reading: the aura joint is percent-only, so the flat +10 Speed is read as +10%
 * of Speed (the same +10 on the 100 baseline most fodder sits at).
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null })
  },
  auraStatPercent: (ctx, ally, stat) => {
    if (ally.monster?.role !== 'fodder') return 0
    if (stat === 'attackPhys' || stat === 'attackSpell') return ctx.line.percent ?? 0
    if (stat === 'speed') return ctx.line.amount ?? 0
    return 0
  },
}
export default handler
