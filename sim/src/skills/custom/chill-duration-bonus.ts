import type { CustomHandler } from './types.ts'

/**
 * Permafrost (Arcanist, Rime II; docs/classes/arcanist.md §4.2): Chill the holder applies lasts +`amount` turns.
 * The bonus is read by the line interpreter's duration step for applyStatus lines (03 §3.5).
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null })
  },
  statusDurationBonus: (ctx, status) => (status === 'chill' ? (ctx.line.amount ?? 0) : 0),
}
export default handler
