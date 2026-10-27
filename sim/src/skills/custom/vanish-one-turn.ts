import type { CustomHandler } from './types.ts'

/**
 * Bolt-hole (Old Gnaw, 06 §3.1): "vanishes for 1 turn, returns in the other row with Haste" (the Haste is the
 * attack's own DSL line). The line installs a hook on the holder that makes it untargetable (`canBeTargetedBy`);
 * at the holder's next turn start the hook swaps its row and removes itself. The hook does not use
 * `untilTurnStart` because the fight drops those before the turn-start rules run and the row swap would be lost.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const who = target ?? ctx.holder
    ctx.fx.installHook(who, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, data: { from: who.row } })
    ctx.fx.log('vanish', `${who.name} vanishes into a bolt-hole`, { actorId: who.id })
  },
  untargetable: () => true,
  onTurnStart: (ctx) => {
    const hook = ctx.hook
    if (!hook) return
    const who = ctx.holder
    who.row = who.row === 'front' ? 'back' : 'front'
    ctx.fx.removeHook(who, hook)
    ctx.fx.log('return', `${who.name} bursts out in the ${who.row} row`, { actorId: who.id, data: { row: who.row } })
  },
}
export default handler
