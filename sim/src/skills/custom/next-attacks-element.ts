import type { CustomHandler, HookContext } from './types.ts'

/**
 * Wraith-step (Shade, Shadow III; docs/classes/shade.md §4.1): the holder's next `amount` attack(s) deal `damageType`
 * and apply `status` for `duration` turns. The hook rewrites the damage lines of the holder's next basic attacks or
 * skills (one attack = one action, however many hits it has), applies the status on each hit that landed, and
 * counts an attack down when the action ends. Reading: the element rides the weapon — the rewritten line's
 * multiplier is rescaled by Attack(phys)/Attack(spell) so the Shade's dagger keeps its physical Attack base.
 */
function spend(ctx: HookContext): void {
  const hook = ctx.hook
  if (!hook || hook.data.action !== ctx.holder.tally.actions) return
  hook.data.action = -1
  hook.counter -= 1
  if (hook.counter <= 0) ctx.fx.removeHook(ctx.holder, hook)
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, counter: Math.max(1, ctx.line.amount ?? 1), data: { action: -1 } })
    ctx.fx.log('oil', `${holder.name}'s next strike will be ${ctx.line.damageType ?? 'shadow'}`, { actorId: holder.id })
  },
  modifyLine: (ctx, line, source) => {
    const hook = ctx.hook
    const type = ctx.line.damageType
    if (!hook || !type || hook.counter <= 0 || line.kind !== 'damage' || (source.kind !== 'basic' && source.kind !== 'skill')) return null
    hook.data.action = ctx.holder.tally.actions
    if (line.damageType === type) return null
    const phys = ctx.fx.statOf(ctx.holder, 'attackPhys')
    const spell = ctx.fx.statOf(ctx.holder, 'attackSpell')
    const wasPhysical = line.damageType === undefined || line.damageType === 'slash' || line.damageType === 'pierce' || line.damageType === 'blunt'
    const multiplier = wasPhysical && spell > 0 ? ((line.multiplier ?? 1) * phys) / spell : (line.multiplier ?? 1)
    return { ...line, damageType: type, multiplier }
  },
  onDealtDamage: (ctx, target, _dealt, incoming) => {
    if (incoming.isDot || !ctx.line.status || ctx.hook?.data.action !== ctx.holder.tally.actions || incoming.damageType !== ctx.line.damageType || !ctx.fx.isActive(target)) return
    ctx.fx.applyStatus(target, { status: ctx.line.status, duration: ctx.line.duration }, ctx.holder.id)
  },
  onSkillUsed: (ctx) => spend(ctx),
  modifyWeight: (ctx, w) => {
    spend(ctx)
    return w
  },
}
export default handler
