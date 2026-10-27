import type { CustomHandler } from './types.ts'

/**
 * Hunter's Mark, Mastery (Ranger, Marksman I; docs/classes/ranger.md §4.1): Marks the holder applies use `percent`
 * instead of the status's default (+20). Reading: the Mark status carries its own `damage-taken-percent` line, so
 * this line (after the Mark line) puts a hook on the marked target for the Mark's remaining turns that adds the
 * difference while the Mark is held.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const inst = target?.statuses.find((s) => s.id === 'mark')
    if (!target || !inst) return
    ctx.fx.installHook(target, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: inst.turnsLeft })
  },
  incomingDamagePercent: (ctx, incoming) => {
    if (incoming.isDot || !ctx.fx.hasStatus(ctx.holder, 'mark')) return 0
    const base = ctx.content.statuses.get('mark')?.effects.find((e) => e.kind === 'custom' && e.customId === 'damage-taken-percent')?.percent ?? 20
    return (ctx.line.percent ?? base) - base
  },
}
export default handler
