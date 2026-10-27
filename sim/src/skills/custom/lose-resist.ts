import type { CustomHandler } from './types.ts'

/**
 * A protective part breaks (06 §3.1: the Bruiser's mail coif → "loses its Slash resist", the Warren Alpha's scarred
 * hide → "loses its Pierce resist"). Runs with the monster as holder and target: the line's `damageType` leaves the
 * monster's `resist` list for the rest of the fight (the type multiplier then reads ×1.0).
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const m = ctx.holder.monster
    const type = ctx.line.damageType
    if (!m || !type) return
    const had = m.resist.includes(type)
    m.resist = m.resist.filter((t) => t !== type)
    ctx.fx.log('partBreakEffect', `${ctx.holder.name} ${had ? `loses its ${type} resistance` : `had no ${type} resistance to lose`}`, { actorId: ctx.holder.id, data: { damageType: type } })
  },
}
export default handler
