import type { CustomHandler } from './types.ts'

/**
 * Crippling Dust mastery (Shade, Venom I; docs/classes/shade.md §4.2 "Two targets"): the skill's lines also land on
 * `amount` more distinct enemies, nearest first (the main target's row, then the other row, in actor order).
 * Reading: the extra targets receive the skill's base non-custom lines (Crippling Dust: the Blind) through the
 * fight's own line interpreter at the cast's rank scaling; the mastery's own replacement lines and this line are
 * not re-run, so a mastery that also changed a base line would spread the base version.
 */
const handler: CustomHandler = {
  apply: (ctx, target, scale) => {
    const skill = ctx.content.skills.get(ctx.sourceId ?? '')
    if (!skill || !target) return
    const extra = Math.max(0, ctx.line.amount ?? 1)
    const others = ctx.fx.enemiesOf(ctx.holder).filter((e) => e !== target)
    const ordered = [...others.filter((e) => e.row === target.row), ...others.filter((e) => e.row !== target.row)].slice(0, extra)
    const lines = skill.effects.filter((l) => l.kind !== 'custom')
    for (const enemy of ordered) {
      for (const line of lines) ctx.fx.applyLine(ctx.holder, line, 'enemy', enemy, { kind: 'skill', id: skill.id, label: skill.name, effectPercent: scale, isMelee: false })
      ctx.fx.log('spread', `${skill.name} also reaches ${enemy.name}`, { actorId: ctx.holder.id, targetId: enemy.id })
    }
  },
}
export default handler
