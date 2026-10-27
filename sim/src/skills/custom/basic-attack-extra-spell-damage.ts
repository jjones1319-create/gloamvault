import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Consecration (Mender passive, Sanctity I; docs/classes/mender.md §4.2): the holder's basic attack deals an extra
 * `multiplier` × spell Attack as `damageType` (Holy). Installed as a hook by hero.ts. The damage pipeline does not
 * say what kind of action a hit came from, so `modifyLine` — which sees the line's source — notes whether the line
 * now resolving is a basic attack, `onDealtDamage` adds the strike once per action, and `onHolderAttacks` re-arms
 * it at the start of the next action (a dual-wield pair gives one extra hit, not two).
 */
const handler: CustomHandler = {
  modifyLine: (ctx, _line, source) => {
    if (ctx.hook) ctx.hook.data.basic = source.kind === 'basic'
    return null
  },
  onHolderAttacks: (ctx) => {
    if (ctx.hook) ctx.hook.data.fired = false
  },
  onDealtDamage: (ctx, target, _dealt, incoming) => {
    const hook = ctx.hook
    if (!hook || hook.data.basic !== true || hook.data.fired === true || incoming.isDot) return
    const type = ctx.line.damageType ?? 'holy'
    if (incoming.damageType === type) return
    hook.data.fired = true
    if (!ctx.fx.isActive(target)) return
    const amount = roundHalfUp(ctx.fx.statOf(ctx.holder, 'attackSpell') * (ctx.line.multiplier ?? 0))
    if (amount <= 0) return
    ctx.fx.strike(ctx.holder, target, { amount, damageType: type, label: 'consecration', canMiss: false, canCrit: false, isMelee: false })
  },
}
export default handler
