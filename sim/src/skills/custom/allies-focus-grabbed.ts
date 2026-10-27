import type { CustomHandler } from './types.ts'

/**
 * Net Throw's rider (Grinning Netter, 06 §3.1): "while a hero is netted every Vermin in the fight targets them".
 * The line (target allAllies) installs a persistent hook on every monster on the Netter's side; `preferredTarget`
 * hands the fight the Grabbed hero whenever its behaviour names no target, preferring the one this Netter holds.
 * Reading: under D-047 a Grabbed hero is targetable only by the grabber, so `canBeTargetedBy` keeps the netted
 * hero out of the pack's candidates while the Net holds and the preference bites only for monsters that may reach
 * them (the Netter itself); the Accepted Grab rule wins over 06's prose until James settles the two (logged).
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const ally = target ?? ctx.holder
    if (ally.side !== ctx.holder.side) return
    ctx.fx.installHook(ally, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId })
  },
  preferredTarget: (ctx, candidates) => {
    const source = ctx.hook?.sourceId ?? null
    const held = candidates.filter((c) => c.side !== ctx.holder.side && c.statuses.some((s) => s.id === 'grab'))
    if (held.length === 0) return null
    return held.find((c) => c.statuses.some((s) => s.id === 'grab' && s.sourceId === source)) ?? held[0] ?? null
  },
}
export default handler
