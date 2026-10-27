import type { CustomHandler } from './types.ts'

/**
 * Guard Dog / Wing Guard (pet actives, 06 §9): for `duration` turns the pet takes `percent`% of the single-target
 * hits aimed at its owner. `apply` runs with the pet as the caster and installs a hook on the owner whose sourceId
 * is the pet; `intercept` rolls `percent` and names the pet while it stands. AoE, DoTs and Ultimates are never
 * intercepted; the hit lands on the pet at full strength (the scaling percent is 0).
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const pet = ctx.holder
    const ownerId = pet.pet?.ownerId ?? null
    const owner = (ownerId ? ctx.state.actors.find((a) => a.id === ownerId) : undefined) ?? (target && target !== pet ? target : null)
    if (!owner || owner === pet) return
    ctx.fx.installHook(owner, ctx.line, pet.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? 2 })
    ctx.fx.log('intercept', `${pet.name} stands guard over ${owner.name}`, { actorId: pet.id, targetId: owner.id })
  },
  intercept: (ctx, _attacker, incoming) => {
    if (!incoming.isSingleTarget || incoming.isDot || incoming.isUltimate) return null
    const pet = ctx.state.actors.find((a) => a.id === ctx.hook?.sourceId)
    if (!pet || pet === ctx.holder || !ctx.fx.isActive(pet)) return null
    if (!ctx.rng.pct(ctx.line.percent ?? 0)) return null
    return { interceptorId: pet.id, percent: 0 }
  },
}
export default handler
