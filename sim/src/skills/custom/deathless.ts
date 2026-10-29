import type { CustomHandler } from './types.ts'

/**
 * Deathless (Blade, Bloodletter V passive; docs/classes/blade.md §4.3; D-099): Pain Threshold's bonuses are raised by
 * `percent`% (100: doubled) and Undying Rage triggers `amount` times per floor (D-099: twice; its Regen lasts this
 * line's `duration`, Mastery 3). The limit and the Regen are read by `undying-rage` from this line. For Pain
 * Threshold, at the fight's start the hook raises the lines of the holder's Pain Threshold hooks (the passive
 * `blade-pain-threshold`: `stat-percent-below-hp` lines' `percent`, `stat-amount-below-hp` lines' `amount`) once, and
 * drops the modifiers they already hold so their next check re-adds them at the raised value.
 */
const PAIN_THRESHOLD = 'blade-pain-threshold'

const handler: CustomHandler = {
  onFightStart: (ctx) => {
    const holder = ctx.holder
    const factor = 1 + (ctx.line.percent ?? 100) / 100
    let raised = false
    for (const h of holder.hooks) {
      if (h.sourceSkillId !== PAIN_THRESHOLD || h.data.deathless === true) continue
      if (h.customId === 'stat-percent-below-hp') h.line = { ...h.line, percent: Math.round((h.line.percent ?? 0) * factor) }
      else if (h.customId === 'stat-amount-below-hp') h.line = { ...h.line, amount: Math.round((h.line.amount ?? 0) * factor) }
      else continue
      h.data.deathless = true
      raised = true
    }
    if (!raised) return
    holder.modifiers = holder.modifiers.filter((m) => !m.sourceId.startsWith(`stat-percent-below-hp:${PAIN_THRESHOLD}:`) && !m.sourceId.startsWith(`stat-amount-below-hp:${PAIN_THRESHOLD}:`))
    ctx.fx.log('deathless', `${holder.name}'s pain burns twice as hot`, { actorId: holder.id })
  },
}
export default handler
