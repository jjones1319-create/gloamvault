import type { CustomHandler } from './types.ts'

/**
 * Festering Wound (Shade, Venom II; docs/classes/shade.md §4.2): if the target is Poisoned, also Weaken `duration`.
 * The line follows the damage line and reads the Poison the target holds when it resolves.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || !ctx.line.status || !ctx.fx.hasStatus(target, 'poison')) return
    const label = ctx.content.skills.get(ctx.sourceId ?? '')?.name ?? 'rider'
    ctx.fx.applyLine(ctx.holder, { kind: 'applyStatus', status: ctx.line.status, chance: ctx.line.chance, duration: ctx.line.duration, target: 'enemy' }, 'enemy', target, { kind: 'skill', id: ctx.sourceId ?? 'rider', label, neverMisses: true, isMelee: false })
  },
}
export default handler
