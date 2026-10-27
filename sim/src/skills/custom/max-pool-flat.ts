import { clamp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Deep (08 §5): "+pool 3–5 / 5–10 / 10–20" flat points of the wearer's own pool (Stamina or Mana). The rolled value
 * arrives as `percent` (items.ts `effectWithMagnitude` fills the first open field), so the handler reads
 * `amount ?? percent`. `onFightStart` raises `poolMax` and `pool` by it once per fight (`data.applied`); heroes are
 * rebuilt for every fight, so the bonus never stacks across fights.
 */
const handler: CustomHandler = {
  onFightStart: (ctx) => {
    const hook = ctx.hook
    const who = ctx.holder
    if (!hook || hook.data.applied === true || who.poolKind === null) return
    const amount = Math.max(0, Math.round(ctx.line.amount ?? ctx.line.percent ?? 0))
    who.poolMax += amount
    who.pool = clamp(who.pool + amount, 0, who.poolMax)
    hook.data.applied = true
  },
}
export default handler
