import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Crushing Rebuke (Warden, Bulwark III; docs/classes/warden.md §4.1): the hit adds `percent` of the damage the
 * Warden blocked since its last turn, capped at `multiplier` × Attack.
 * Reading: the first use installs a fight-long tracker hook on the Warden: `onBlock` banks half the raw incoming
 * amount of every natural block, `afterHit` banks what an auto-block (`autoBlock:<id>` flag) let through, and the
 * Warden's turn start moves the bank into "since last turn". Each use deals the banked bonus as a second non-melee
 * hit that cannot miss or crit (only when the skill's own hit landed), then empties the bank. The installing use
 * has no bank yet and adds nothing.
 */
const ID = 'damage-plus-blocked-since-last-turn'

const handler: CustomHandler = {
  apply: (ctx, target, scale) => {
    const holder = ctx.holder
    let tracker = holder.hooks.find((h) => h.customId === ID && h.sourceId === holder.id)
    if (!tracker) tracker = ctx.fx.installHook(holder, ctx.line, holder.id, { sourceSkillId: ctx.sourceId, data: { acc: 0, sinceLast: 0, seenAuto: Number(ctx.state.flags[`autoBlock:${holder.id}`] ?? 0) } })
    const banked = Number(tracker.data.sinceLast ?? 0)
    tracker.data.sinceLast = 0
    if (!target || banked <= 0 || !ctx.fx.isActive(target)) return
    const log = ctx.state.log
    let start = -1
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]
      if (e && e.kind === 'action' && e.actorId === holder.id) {
        start = i
        break
      }
    }
    const landed = log.slice(start + 1).some((e) => e.kind === 'damage' && e.actorId === holder.id && e.targetId === target.id)
    if (!landed) return
    const type = ctx.line.damageType ?? 'blunt'
    const cap = roundHalfUp((ctx.fx.attackFor(holder, type) * (ctx.line.multiplier ?? 2) * scale) / 100)
    const extra = Math.min(cap, roundHalfUp((banked * (ctx.line.percent ?? 100)) / 100))
    if (extra <= 0) return
    const flag = `noCounter:${holder.id}`
    ctx.state.flags[flag] = true
    ctx.fx.strike(holder, target, { amount: extra, damageType: type, label: 'rebuke', canMiss: false, canCrit: false, isMelee: false })
    delete ctx.state.flags[flag]
  },
  onBlock: (ctx, incoming) => {
    if (ctx.hook) ctx.hook.data.acc = Number(ctx.hook.data.acc ?? 0) + roundHalfUp(incoming.amount / 2)
  },
  afterHit: (ctx, _incoming, dealt) => {
    const hook = ctx.hook
    if (!hook) return
    const auto = Number(ctx.state.flags[`autoBlock:${ctx.holder.id}`] ?? 0)
    const seen = Number(hook.data.seenAuto ?? 0)
    hook.data.seenAuto = auto
    if (auto > seen) hook.data.acc = Number(hook.data.acc ?? 0) + dealt
  },
  onTurnStart: (ctx) => {
    const hook = ctx.hook
    if (!hook) return
    hook.data.sinceLast = Number(hook.data.acc ?? 0)
    hook.data.acc = 0
  },
}
export default handler
