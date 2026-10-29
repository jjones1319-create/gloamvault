import type { CustomHandler } from './types.ts'

/**
 * Unyielding Point (Warden, Vanguard IV passive; docs/classes/warden.md §4.2): "you start every fight in Counter
 * Stance". At the fight's start the hook installs the holder's Counter Stance — a `counter-stance` hook with the
 * line's `multiplier` (1.0) and `amount` counters (1) — which, as Counter Stance's own, drops at the holder's first
 * turn start. Counter Stance's rules (and Punish's and Unyielding Point's riders) do the rest.
 */
const handler: CustomHandler = {
  onFightStart: (ctx) => {
    const holder = ctx.holder
    const counters = Math.max(1, ctx.line.amount ?? 1)
    ctx.fx.installHook(holder, { kind: 'custom', customId: 'counter-stance', multiplier: ctx.line.multiplier ?? 1, amount: counters, target: 'self' }, holder.id, {
      sourceSkillId: ctx.hook?.sourceSkillId ?? null,
      untilTurnStart: true,
      counter: counters,
      data: { scale: 100 },
    })
    ctx.fx.log('stance', `${holder.name} opens the fight in a counter stance`, { actorId: holder.id })
  },
}
export default handler
