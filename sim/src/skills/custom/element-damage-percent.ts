import type { CustomHandler } from './types.ts'

/**
 * A blessing on the holder's damage of one type (07 §2.4 Bone Reliquary and §2.6 the Ossuary Shrine's Vigil: "+15%
 * Holy damage … this floor"): +`percent` on every hit of `damageType`. Installed on the heroes at each fight's start
 * by the delve (a pending entry of kind 'hook', delve.ts) for as long as the blessing lasts.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const who = target ?? ctx.holder
    ctx.fx.installHook(who, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null })
  },
  outgoingDamagePercent: (ctx, _target, incoming) => (incoming.damageType === ctx.line.damageType ? (ctx.line.percent ?? 0) : 0),
}
export default handler
