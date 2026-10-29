import type { CustomHandler } from './types.ts'

/**
 * Absolute Zero (Arcanist, Rime IV; docs/classes/arcanist.md §4.2): every target already Chilled gets `status`
 * (Freeze) for `duration`. The line follows the skill's hit, so the cast never shatters its own Freeze. The status
 * goes through the line interpreter, so the status rules (a Large or Huge foe and a boss take Chill instead) and the
 * caster's duration bonuses apply; an un-Chilled target is left alone without a word.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || !ctx.line.status || !ctx.fx.isActive(target) || !ctx.fx.hasStatus(target, 'chill')) return
    const label = ctx.content.skills.get(ctx.sourceId ?? '')?.name ?? 'rider'
    ctx.fx.applyLine(ctx.holder, { kind: 'applyStatus', status: ctx.line.status, chance: ctx.line.chance, duration: ctx.line.duration, target: 'enemy' }, 'enemy', target, { kind: 'skill', id: ctx.sourceId ?? 'rider', label, neverMisses: true, isMelee: false })
  },
}
export default handler
