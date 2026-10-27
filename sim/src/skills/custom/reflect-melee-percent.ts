import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Thorned (elite affix, 06 §2; also the Spined item affix and the Salamander Hatchling's Molten Hide buff): the
 * holder reflects `percent` of the melee damage it takes as `damageType` (Pierce) to the attacker; ranged hits,
 * spells and DoTs are safe. Installed on a champion at spawn (explore.ts) or by `apply` for `duration` turns when
 * a skill casts it on an ally. The reflected number is already post-mitigation damage, so the strike ignores
 * Defense and never answers another reflect (`isMelee: false`).
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null })
    if (holder !== ctx.holder || ctx.line.duration) ctx.fx.log('thorns', `${holder.name} bristles with thorns`, { actorId: ctx.holder.id, targetId: holder.id })
  },
  afterHit: (ctx, incoming, dealt) => {
    const attacker = incoming.attacker
    if (!attacker || attacker === ctx.holder || !incoming.isMelee || incoming.isDot || !ctx.fx.isActive(attacker)) return
    const amount = roundHalfUp((dealt * (ctx.line.percent ?? 0)) / 100)
    if (amount <= 0) return
    ctx.fx.strike(ctx.holder, attacker, { amount, damageType: ctx.line.damageType ?? 'pierce', label: 'thorns', canMiss: false, canCrit: false, isMelee: false, ignoresDefense: true })
  },
}
export default handler
