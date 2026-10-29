import type { CustomHandler } from './types.ts'

/**
 * Unending Rhythm (Blade, Iron Dance V; docs/classes/blade.md §4.1): "Blade Rhythm's cap is 6 stacks for the rest of
 * the fight". Blade Rhythm's hook (`school-combo-damage-stacks`) reads its cap from its own line's `amount`; this line
 * raises that cap on the holder's Blade Rhythm hook(s) to `amount` for the rest of the fight (never lowers it). With no
 * Blade Rhythm slotted it changes nothing and says so.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    const cap = ctx.line.amount ?? 6
    const rhythm = holder.hooks.filter((h) => h.customId === 'school-combo-damage-stacks')
    if (rhythm.length === 0) {
      ctx.fx.log('nothing', `${holder.name} has no rhythm to lengthen`, { actorId: holder.id })
      return
    }
    for (const h of rhythm) if ((h.line.amount ?? 3) < cap) h.line = { ...h.line, amount: cap }
    ctx.fx.log('rhythm', `${holder.name}'s rhythm runs to ${cap} beats`, { actorId: holder.id, amount: cap })
  },
}
export default handler
