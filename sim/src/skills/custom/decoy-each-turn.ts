import type { CustomHandler } from './types.ts'

/**
 * Phantom Twin (Shade, Shadow IV; docs/classes/shade.md §4.1): for `duration` turns the first single-target attack
 * aimed at the holder each turn hits a decoy and misses (AoE, DoTs and Ultimates are not fooled).
 * Reading: a hook on the holder with one decoy (`counter`), restocked at each of the holder's turn starts and spent by
 * the first single-target hit that passed its roll (`beforeHit`, as the Mirrored affix's decoys); it lasts the holder's
 * next `duration` turns — one more when cast during the holder's own turn, as a status does (D-077).
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    const turns = Math.max(1, ctx.line.duration ?? 2) + (ctx.state.actingId === holder.id ? 1 : 0)
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: turns, counter: 1 })
    ctx.fx.log('decoys', `${holder.name}'s phantom twin steps out of the shadows`, { actorId: holder.id })
  },
  onTurnStart: (ctx) => {
    if (ctx.hook) ctx.hook.counter = 1
  },
  beforeHit: (ctx, incoming) => {
    const hook = ctx.hook
    if (!hook || hook.counter <= 0 || !incoming.isSingleTarget || incoming.isDot || incoming.isUltimate) return null
    hook.counter -= 1
    ctx.fx.log('decoy', `${incoming.attacker?.name ?? 'The blow'} strikes ${ctx.holder.name}'s phantom twin`, { actorId: ctx.holder.id, targetId: incoming.attacker?.id })
    return 'miss'
  },
}
export default handler
