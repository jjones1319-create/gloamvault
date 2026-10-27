import type { CustomHandler } from './types.ts'

/**
 * Meteor (Arcanist, Evocation III; docs/classes/arcanist.md §4.1): any target already Burning is also Dazed. The
 * line is the skill's first, so it reads the Burn held before this cast's own Burn lands. The status goes through
 * the line interpreter so the fight logs it and duration bonuses count.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || !ctx.line.status || !ctx.fx.hasStatus(target, 'burn')) return
    const label = ctx.content.skills.get(ctx.sourceId ?? '')?.name ?? 'rider'
    ctx.fx.applyLine(ctx.holder, { kind: 'applyStatus', status: ctx.line.status, chance: ctx.line.chance, duration: ctx.line.duration, target: 'enemy' }, 'enemy', target, { kind: 'skill', id: ctx.sourceId ?? 'rider', label, neverMisses: true, isMelee: false })
  },
}
export default handler
