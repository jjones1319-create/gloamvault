import type { CustomHandler, HookContext } from './types.ts'

/**
 * Living Wall (Moss Tortoise trait, 06 §9): in Guard the pet intercepts `percent` more of the single-target hits
 * aimed at its owner (03 §9: 30% → 40%). The trait hook sits on the pet (pets.ts). Reading: the stance's own 30%
 * roll lives in the fight and cannot be read from a hook, so at the fight's start the pet installs a mirror of this
 * line on its owner (`data.mirror`) whose `intercept` rolls first with chance bonus / (100 − base) — the one chance
 * that makes the two rolls together land exactly base + bonus (10 / 70 → 14.29%, combined 40%).
 */
function ensureMirror(ctx: HookContext): void {
  const hook = ctx.hook
  const pet = ctx.holder
  if (!hook || hook.data.mirror === true || hook.data.mirrored === true || !pet.pet) return
  const owner = ctx.state.actors.find((a) => a.id === pet.pet?.ownerId)
  if (!owner) return
  hook.data.mirrored = true
  ctx.fx.installHook(owner, ctx.line, pet.id, { data: { mirror: true } })
}

const handler: CustomHandler = {
  apply: (ctx) => ensureMirror(ctx),
  onFightStart: (ctx) => ensureMirror(ctx),
  onTurnStart: (ctx) => ensureMirror(ctx),
  intercept: (ctx, _attacker, incoming) => {
    const hook = ctx.hook
    if (!hook || hook.data.mirror !== true || !incoming.isSingleTarget || incoming.isDot || incoming.isUltimate) return null
    const pet = ctx.state.actors.find((a) => a.id === hook.sourceId)
    if (!pet?.pet || pet.pet.ownerId !== ctx.holder.id || pet.pet.stance !== 'guard' || !ctx.fx.isActive(pet)) return null
    const base = ctx.t.pets.stances.guardInterceptPercent
    const bonus = ctx.line.percent ?? 0
    const chance = base >= 100 ? 100 : (100 * bonus) / (100 - base)
    if (!ctx.rng.pct(chance)) return null
    return { interceptorId: pet.id, percent: 0 }
  },
}
export default handler
