import type { CustomHandler } from './types.ts'

/**
 * Mug (Shade, Larceny III; docs/classes/shade.md §4.3): against a boss, a guaranteed common part, once per fight.
 * Reading: the fight cannot add to the bag, so the steal is a `partStolen` log event (materialId / itemId, quantity,
 * guaranteed) that delve.ts totals into the fight's loot; `state.flags` keeps it to once per boss per fight.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const m = target?.monster
    if (!target || !m?.isBoss) return
    const key = `bossPartStolen:${target.id}`
    if (ctx.state.flags[key]) return
    const part = ctx.content.monsters.get(m.monsterId)?.parts.common
    if (!part) return
    ctx.state.flags[key] = true
    const what = part.materialId ?? part.itemId ?? 'part'
    ctx.fx.log('partStolen', `${ctx.holder.name} lifts ${what} from ${target.name}`, { actorId: ctx.holder.id, targetId: target.id, amount: part.quantity.min, data: { materialId: part.materialId ?? null, itemId: part.itemId ?? null, quantity: part.quantity.min, rare: false, guaranteed: true } })
  },
}
export default handler
