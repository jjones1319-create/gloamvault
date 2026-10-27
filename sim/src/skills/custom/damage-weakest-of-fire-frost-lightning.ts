import { roundHalfUp } from '../../stats.ts'
import type { DamageType } from '../../types/enums.ts'
import type { CustomHandler } from './types.ts'

const CANDIDATES: readonly DamageType[] = ['fire', 'frost', 'lightning']

/**
 * Prismatic Ruin (Arcanist Ultimate; docs/classes/arcanist.md §3): `multiplier` × spell Attack to each target as
 * whichever of Fire, Frost and Lightning it is weakest to; Fire when none; an immune element is never chosen (the
 * next legal one is, Fire first). The hit never misses and may crit. Reading: the strike runs as a single-target hit
 * per enemy, so a Guarding target still halves it (the Ultimate flag is not on the hook strike).
 */
const handler: CustomHandler = {
  apply: (ctx, target, scale) => {
    if (!target) return
    const m = target.monster
    const h = target.hero
    const immune = (t: DamageType) => (m ? m.immune.includes(t) : false)
    const weak = (t: DamageType) => (m ? m.weak.includes(t) : h ? h.species.weak[t] !== undefined : false)
    const legal = CANDIDATES.filter((t) => !immune(t))
    const type = legal.find(weak) ?? legal[0] ?? 'fire'
    const amount = roundHalfUp((ctx.fx.attackFor(ctx.holder, type) * (ctx.line.multiplier ?? 1) * scale) / 100)
    const label = ctx.content.skills.get(ctx.sourceId ?? '')?.name ?? 'Prismatic Ruin'
    ctx.fx.strike(ctx.holder, target, { amount, damageType: type, label: `${label} (${type})`, canMiss: false, canCrit: true, isMelee: false })
  },
}
export default handler
