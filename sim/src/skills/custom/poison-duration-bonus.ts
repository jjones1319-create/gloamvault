import type { CustomHandler } from './types.ts'

/**
 * Steeped Blades (Shade, Venom I; docs/classes/shade.md §4.2): Poison the holder applies lasts +`amount` turns.
 * The bonus is read by the line interpreter's duration step for applyStatus lines (03 §3.5).
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null })
  },
  statusDurationBonus: (ctx, status) => (status === 'poison' ? (ctx.line.amount ?? 0) : 0),
}
export default handler
