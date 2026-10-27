import type { CustomHandler } from './types.ts'

/**
 * A pet trait's damage-type resistance (06 §9: Ember Fox Fire ×0.5, Salamander Hatchling Fire immune): damage of
 * `damageType` the pet takes is scaled by `percent` (−50 halves, −100 is immunity). The trait hook sits on the pet
 * (pets.ts). DoT ticks bypass the pipeline and are not scaled.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null })
  },
  incomingDamagePercent: (ctx, incoming) => (incoming.damageType === ctx.line.damageType ? (ctx.line.percent ?? 0) : 0),
}
export default handler
