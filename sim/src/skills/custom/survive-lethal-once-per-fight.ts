import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Unbreakable (Warden, Bulwark III; docs/classes/warden.md §4.1): `amount` times per fight a hit that would down
 * the holder leaves it at 1 HP and grants a Shield of `percent`% of max HP. With the Mastery's
 * `survive-lethal-cleanses-debuffs` hook beside it, the trigger also strips every hostile status (DoT, debuff,
 * control, mark). The pipeline's `beforeDowned` sets the HP to 1 after this returns true.
 */
const HOSTILE = new Set(['dot', 'debuff', 'control', 'mark'])

const handler: CustomHandler = {
  beforeDowned: (ctx) => {
    const hook = ctx.hook
    if (!hook) return false
    const used = Number(hook.data.used ?? 0)
    if (used >= Math.max(1, ctx.line.amount ?? 1)) return false
    hook.data.used = used + 1
    const holder = ctx.holder
    const shield = roundHalfUp((holder.maxHp * (ctx.line.percent ?? 0)) / 100)
    if (shield > 0) ctx.fx.applyStatus(holder, { status: 'shield', magnitude: shield }, holder.id)
    if (holder.hooks.some((h) => h.customId === 'survive-lethal-cleanses-debuffs')) {
      const before = holder.statuses.length
      holder.statuses = holder.statuses.filter((s) => !HOSTILE.has(ctx.content.statuses.get(s.id)?.kind ?? ''))
      if (!holder.statuses.some((s) => s.id === 'grab')) holder.grabbedBy = null
      if (holder.statuses.length !== before) ctx.fx.log('cleanse', `${holder.name} shakes off every affliction`, { actorId: holder.id })
    }
    ctx.fx.log('lastStand', `${holder.name} refuses to fall`, { actorId: holder.id, amount: shield })
    return true
  },
}
export default handler
