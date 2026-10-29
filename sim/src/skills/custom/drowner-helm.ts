import type { CustomHandler } from './types.ts'

/**
 * The Tidebound Drowner's bell helm breaks (06 §3.3 part-break: "loses Slash/Pierce resist, Blind (2)"). Runs with
 * the Drowner as holder and target: Slash and Pierce leave its `resist` list (its plate's; Frost stays), and it is
 * Blinded (`status`, `duration`). The line names no damage type, so a critical hit breaks the helm.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const drowner = ctx.holder
    const m = drowner.monster
    if (!m) return
    m.resist = m.resist.filter((t) => t !== 'slash' && t !== 'pierce')
    ctx.fx.log('partBreakEffect', `${drowner.name}'s bell helm caves in`, { actorId: drowner.id })
    ctx.fx.applyStatus(drowner, { status: ctx.line.status ?? 'blind', duration: ctx.line.duration ?? 2 }, drowner.id)
  },
}
export default handler
