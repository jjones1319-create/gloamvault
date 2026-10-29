import type { CustomHandler } from './types.ts'

/**
 * The Bone Knight's helm breaks (06 §3.2 part-break: "loses Slash resist, Accuracy −10"). Runs with the knight as
 * holder and target: Slash leaves its `resist` list (Slash then hits at ×1.0) and it keeps `amount` Accuracy (−10)
 * for the rest of the fight. The line names no damage type, so a critical hit breaks the helm (effects.ts breakPart).
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const knight = ctx.holder
    const m = knight.monster
    if (!m) return
    m.resist = m.resist.filter((t) => t !== 'slash')
    knight.modifiers.push({ stat: 'accuracy', amount: ctx.line.amount ?? -10, percent: 0, turnsLeft: 999, sourceId: 'part-break' })
    ctx.fx.log('partBreakEffect', `${knight.name}'s visor cracks: Slash bites, and it swings half-blind`, { actorId: knight.id })
  },
}
export default handler
