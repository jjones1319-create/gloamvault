import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Breath (Draconid trait, 05 §3): an innate action outside the loadout — once per fight, weight 1,000, cost 0: a
 * Fire cone of `multiplier` × Attack (physical or spell, whichever is higher) to every enemy in the front row that
 * applies `status` (Burn); ranks by use. `apply` does all of that when the line resolves (the row of the resolved
 * target, Huge bodies included; the once is `state.flags`). STUB: the hero has no innate-action slot yet — the fight
 * must offer Breath as a free action that resolves this line, and hero.ts must install species-trait custom lines
 * as hooks (sourceId = the species id) for `onFightStart` to see it; until then it logs `hookStub` once per fight.
 */
export const STUB = true

const handler: CustomHandler = {
  onFightStart: (ctx) => {
    if (ctx.state.flags['stub:species-breath'] === true) return
    ctx.state.flags['stub:species-breath'] = true
    ctx.fx.log('hookStub', 'species-breath: the fight offers no innate Breath action yet', { actorId: ctx.holder.id, data: { customId: 'species-breath' } })
  },
  apply: (ctx, target, scale) => {
    const holder = ctx.holder
    const key = `species-breath:${holder.id}`
    if (!target) return
    if (ctx.state.flags[key] === true) {
      ctx.fx.log('breathSpent', `${holder.name} has no breath left this fight`, { actorId: holder.id })
      return
    }
    ctx.state.flags[key] = true
    const attack = Math.max(ctx.fx.statOf(holder, 'attackPhys'), ctx.fx.statOf(holder, 'attackSpell'))
    const amount = roundHalfUp((attack * (ctx.line.multiplier ?? 1) * scale) / 100)
    const type = ctx.line.damageType ?? 'fire'
    const row = target.row
    ctx.fx.log('breath', `${holder.name} breathes ${type}`, { actorId: holder.id })
    for (const e of ctx.fx.enemiesOf(holder).filter((e) => e.row === row || e.monster?.size === 'huge')) {
      const r = ctx.fx.strike(holder, e, { amount, damageType: type, label: 'breath', canMiss: false, canCrit: true, isMelee: false })
      if (r.hit && r.dealt > 0 && ctx.line.status && ctx.fx.isActive(e)) ctx.fx.applyStatus(e, { status: ctx.line.status, magnitude: r.dealt }, holder.id)
    }
  },
}
export default handler
