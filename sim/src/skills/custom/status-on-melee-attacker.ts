import type { CustomHandler } from './types.ts'

/**
 * Rimeborn (Arcanist passive, Rime V; docs/classes/arcanist.md §4.2): a melee attacker whose hit lands on the holder
 * gets `status` (Chill) for `duration` (1). Ranged hits, spells and DoTs carry no attacker into the cold. Installed as
 * a hook by hero.ts; the status goes through the status rules (immunities, Resistance).
 */
const handler: CustomHandler = {
  afterHit: (ctx, incoming) => {
    const attacker = incoming.attacker
    const status = ctx.line.status
    if (!status || !attacker || attacker.side === ctx.holder.side || !incoming.isMelee || incoming.isDot || !ctx.fx.isActive(attacker)) return
    ctx.fx.applyStatus(attacker, { status, duration: ctx.line.duration ?? 1 }, ctx.holder.id)
  },
}
export default handler
