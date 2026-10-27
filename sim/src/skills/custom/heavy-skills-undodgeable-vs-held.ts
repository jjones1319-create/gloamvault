import type { CustomHandler } from './types.ts'

/**
 * Heavy Hands (Blade, Executioner II; docs/classes/blade.md §4.2): 1,400-weight skills cannot be dodged by targets
 * under Root, Grab, Web or a Net. Reading: `modifyLine` marks the action when its source is a heavy skill;
 * `accuracyBonus` then adds +100 against a held target, which pins the hit chance at 100. Daze is instant in this
 * sim (no status instance to read), so a Dazed target is not covered.
 */
const handler: CustomHandler = {
  modifyLine: (ctx, _line, source) => {
    if (!ctx.hook || source.kind !== 'skill') return null
    const weight = ctx.content.skills.get(source.id)?.weight
    ctx.hook.data.heavyAction = weight === ctx.t.combat.weights.heavy ? ctx.holder.tally.actions : -1
    return null
  },
  accuracyBonus: (ctx, target) => {
    if (!ctx.hook || Number(ctx.hook.data.heavyAction ?? -1) !== ctx.holder.tally.actions) return 0
    const held = target.statuses.some((s) => s.id === 'root' || s.id === 'grab' || s.id === 'web') || target.hooks.some((h) => h.customId === 'net-held')
    return held ? 100 : 0
  },
}
export default handler
