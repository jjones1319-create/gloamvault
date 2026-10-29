import type { CustomHandler } from './types.ts'

/**
 * Nullfield's Mastery (Arcanist, Arcana V; docs/classes/arcanist.md §4.3, "Bosses 2"): `status` for `duration` lands
 * only on a boss or a hunter. statuses.ts shortens every boss's and hunter's status by one turn, so a line of 3 holds
 * 2; it refreshes the cast's own shorter Silence. Through the line interpreter, so immunities and Resistance count.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const m = target?.monster
    if (!target || !m || !(m.isBoss || m.isHunter) || !ctx.line.status || !ctx.fx.isActive(target)) return
    const label = ctx.content.skills.get(ctx.sourceId ?? '')?.name ?? 'rider'
    ctx.fx.applyLine(ctx.holder, { kind: 'applyStatus', status: ctx.line.status, chance: ctx.line.chance, duration: ctx.line.duration, target: 'enemy' }, 'enemy', target, { kind: 'skill', id: ctx.sourceId ?? 'rider', label, neverMisses: true, isMelee: false })
  },
}
export default handler
