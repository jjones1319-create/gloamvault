import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * The Bursting Corpse's belly breaks (06 §3.2 part-break: "it bursts now, ×0.5"). Runs with the corpse as holder and
 * target: its Burst lands at once at half strength — `multiplier` × its Attack of `damageType` (Poison) on every
 * hero in the front row, each then Poisoned (`status`, `duration`) — and the corpse is gone, killed through the damage
 * pipeline so its death and its loot count. The line names no damage type of the break, so a critical hit breaks it.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const corpse = ctx.holder
    if (!ctx.fx.isActive(corpse)) return
    const type = ctx.line.damageType ?? 'poison'
    const amount = roundHalfUp(ctx.fx.attackFor(corpse, type) * (ctx.line.multiplier ?? 0.75))
    ctx.fx.log('burst', `${corpse.name}'s belly splits`, { actorId: corpse.id })
    for (const hero of ctx.fx.enemiesOf(corpse).filter((e) => e.row === 'front' && ctx.fx.isActive(e))) {
      ctx.fx.strike(corpse, hero, { amount, damageType: type, label: 'burst belly', canMiss: false, canCrit: false, isMelee: false })
      if (ctx.line.status && ctx.fx.isActive(hero)) ctx.fx.applyStatus(hero, { status: ctx.line.status, duration: ctx.line.duration }, corpse.id)
    }
    if (ctx.fx.isActive(corpse) && corpse.hp > 0) ctx.fx.strike(null, corpse, { amount: corpse.hp * 2 + 1, damageType: 'blunt', label: 'its own burst', canMiss: false, canCrit: false, isMelee: false, ignoresDefense: true })
  },
}
export default handler
