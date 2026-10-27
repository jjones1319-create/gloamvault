import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Arc Chain (Arcanist, Evocation II; docs/classes/arcanist.md §4.1): after the main hit, `multiplier` × spell Attack
 * as `damageType` to up to `amount` other enemies (drawn at random without repeats), each then Shocked for
 * `duration`. Chain hits never miss and may crit. The Shock goes through the line interpreter so duration bonuses
 * (Conflagration) count.
 */
const handler: CustomHandler = {
  apply: (ctx, target, scale) => {
    if (!target) return
    const type = ctx.line.damageType ?? 'lightning'
    const pool = ctx.fx.enemiesOf(ctx.holder).filter((e) => e !== target)
    const picks = []
    for (let i = 0; i < (ctx.line.amount ?? 1) && pool.length > 0; i++) {
      const p = ctx.rng.pick(pool)
      picks.push(p)
      pool.splice(pool.indexOf(p), 1)
    }
    const amount = roundHalfUp((ctx.fx.attackFor(ctx.holder, type) * (ctx.line.multiplier ?? 1) * scale) / 100)
    const label = ctx.content.skills.get(ctx.sourceId ?? '')?.name ?? 'chain'
    for (const e of picks) {
      const r = ctx.fx.strike(ctx.holder, e, { amount, damageType: type, label: `${label} (chain)`, canMiss: false, canCrit: true, isMelee: false })
      if (r.hit && ctx.line.status && ctx.fx.isActive(e)) ctx.fx.applyLine(ctx.holder, { kind: 'applyStatus', status: ctx.line.status, duration: ctx.line.duration, target: 'enemy' }, 'enemy', e, { kind: 'skill', id: ctx.sourceId ?? 'chain', label, neverMisses: true, isMelee: false })
    }
  },
}
export default handler
