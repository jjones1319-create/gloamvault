import type { CustomHandler } from './types.ts'

/**
 * Attune (Arcanist, Arcana I; docs/classes/arcanist.md §4.3): the holder's per-turn pool regen is +`amount`
 * percentage points (8% → 11%; mastery 13%). Read by the fight's turn-start regen step.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null })
  },
  poolRegenBonus: (ctx) => ctx.line.amount ?? 0,
}
export default handler
