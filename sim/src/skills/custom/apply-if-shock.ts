import type { CustomHandler } from './types.ts'

/**
 * Thunderhead (Arcanist, Evocation III; docs/classes/arcanist.md §4.1): every target already Shocked has a
 * `chance`% chance of Stun 1. The skill applies no Shock of its own, so the check reads the target as it stands.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || !ctx.line.status || !ctx.fx.hasStatus(target, 'shock')) return
    const label = ctx.content.skills.get(ctx.sourceId ?? '')?.name ?? 'rider'
    ctx.fx.applyLine(ctx.holder, { kind: 'applyStatus', status: ctx.line.status, chance: ctx.line.chance, duration: ctx.line.duration, target: 'enemy' }, 'enemy', target, { kind: 'skill', id: ctx.sourceId ?? 'rider', label, neverMisses: true, isMelee: false })
  },
}
export default handler
