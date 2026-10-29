import type { CustomHandler } from './types.ts'

/**
 * Heist (Shade, Larceny IV; docs/classes/shade.md §4.3): against a bandit, steals its held item, once per enemy per
 * fight. Reading: as Filch's bandit case (`steal-part`) — a bandit is a Grinning Company monster (its id or family) and
 * its held item is a Small HP Potion; the fight cannot add to the bag, so the steal is a `partStolen` event the delve
 * totals into the fight's loot. Anything not a bandit has nothing held to take (the skill's part-break line is its
 * loot there).
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const m = target?.monster
    if (!target || !m) return
    const bandit = /grinning|bandit|cutpurse/.test(m.monsterId) || /grinning|bandit/.test(m.familyId)
    if (!bandit) return
    const key = `banditItem:${target.id}`
    if (ctx.state.flags[key]) return
    ctx.state.flags[key] = true
    ctx.fx.log('partStolen', `${ctx.holder.name} lifts ${target.name}'s potion`, { actorId: ctx.holder.id, targetId: target.id, amount: 1, data: { materialId: null, itemId: 'small-hp-potion', quantity: 1, rare: false, guaranteed: true } })
  },
}
export default handler
