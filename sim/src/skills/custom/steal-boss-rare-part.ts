import type { CustomHandler } from './types.ts'

/**
 * King's Ransom (Shade, Larceny V; docs/classes/shade.md §4.3): against a boss, a guaranteed rare part, once per fight.
 * Reading: Mug's `steal-boss-part` with the boss's rare part — a `partStolen` event (rare, guaranteed) the delve totals
 * into the fight's loot; `state.flags` keeps it to once per boss per fight.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const m = target?.monster
    if (!target || !m?.isBoss) return
    const key = `bossRarePartStolen:${target.id}`
    if (ctx.state.flags[key]) return
    const part = ctx.content.monsters.get(m.monsterId)?.parts.rare
    if (!part) return
    ctx.state.flags[key] = true
    const what = part.itemId ?? part.materialId ?? 'a rare part'
    ctx.fx.log('partStolen', `${ctx.holder.name} ransoms ${what} from ${target.name}`, { actorId: ctx.holder.id, targetId: target.id, amount: part.quantity.min, data: { materialId: part.materialId ?? null, itemId: part.itemId ?? null, quantity: part.quantity.min, rare: true, guaranteed: true } })
  },
}
export default handler
