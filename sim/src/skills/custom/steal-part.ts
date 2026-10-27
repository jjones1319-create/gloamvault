import type { CustomHandler } from './types.ts'

/**
 * Filch (Shade, Larceny II; docs/classes/shade.md §4.3): steals one common part from a monster — a potion from a
 * Grinning Company bandit — once per enemy per fight; `chance`% of the time the part is the rare one instead
 * (mastery 25%). Reading: the fight cannot add to the bag, so the steal is a `partStolen` log event (materialId /
 * itemId, quantity, rare) that delve.ts totals into the fight's loot; a bandit (a Grinning Company monster id) yields
 * a `small-hp-potion` instead of its common part. `state.flags` keeps it to once per enemy.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const m = target?.monster
    if (!target || !m) return
    const key = `partStolen:${target.id}`
    if (ctx.state.flags[key]) return
    const def = ctx.content.monsters.get(m.monsterId)
    if (!def) return
    ctx.state.flags[key] = true
    const rare = (ctx.line.chance ?? 0) > 0 && ctx.rng.pct(ctx.line.chance ?? 0)
    const bandit = /grinning|bandit|cutpurse/.test(m.monsterId) || /grinning|bandit/.test(m.familyId)
    const part = rare ? def.parts.rare : def.parts.common
    const materialId = bandit && !rare ? null : (part.materialId ?? null)
    const itemId = bandit && !rare ? 'small-hp-potion' : (part.itemId ?? null)
    const what = itemId ?? materialId ?? 'part'
    ctx.fx.log('partStolen', `${ctx.holder.name} filches ${what} from ${target.name}${rare ? ' (rare)' : ''}`, { actorId: ctx.holder.id, targetId: target.id, amount: part.quantity.min, data: { materialId, itemId, quantity: part.quantity.min, rare, guaranteed: false } })
  },
}
export default handler
