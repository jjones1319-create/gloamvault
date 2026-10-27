import type { CustomHandler } from './types.ts'

/**
 * Shove, Mastery (Warden, Bulwark II; docs/classes/warden.md §4.1): Daze (`chance`%) on the enemy swapped in as
 * well. Reading: the sim's `rowSwap` line moves only the target, so the "swapped-in" enemy is read as the first
 * other enemy standing in the row the target moved into; a Large or Huge target did not move and swaps nobody in.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const m = target?.monster
    if (!target || !m || m.size === 'large' || m.size === 'huge') return
    const other = ctx.fx.enemiesOf(ctx.holder).find((e) => e !== target && e.row === target.row)
    if (!other) return
    const r = ctx.fx.applyStatus(other, { status: ctx.line.status ?? 'daze', chance: ctx.line.chance, duration: ctx.line.duration }, ctx.holder.id)
    if (r === 'applied') ctx.fx.log('shove', `${other.name} stumbles as ${target.name} is shoved past`, { actorId: ctx.holder.id, targetId: other.id })
  },
}
export default handler
