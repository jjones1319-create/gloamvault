import type { CustomHandler } from './types.ts'

/**
 * Reaper's Patience (Blade, Executioner V passive; docs/classes/blade.md §4.2): if the holder's previous action was
 * Guard, its next heavy (1,400-weight) skill weighs `amount` (1,000) and crits automatically (Mastery: and deals
 * +`percent`% more, 20). Reading: a Guard holds until the holder's next turn starts, so at its turn start the hook
 * reads `guarding` (still set from the last action) and primes; the prime lasts that one action — a heavy skill takes
 * it (`modifyLine` marks the action, `forceCrit` and `outgoingDamagePercent` answer for its hits, `modifyWeight` sets
 * its weight), anything else lets it lapse.
 */
const handler: CustomHandler = {
  onTurnStart: (ctx) => {
    const hook = ctx.hook
    if (!hook) return
    hook.data.primed = ctx.holder.guarding
    hook.data.armed = -1
  },
  modifyLine: (ctx, _line, source) => {
    const hook = ctx.hook
    if (!hook || hook.data.primed !== true || source.kind !== 'skill') return null
    const skill = ctx.content.skills.get(source.id)
    if (skill && skill.type === 'active' && skill.weight === ctx.t.combat.weights.heavy) hook.data.armed = ctx.holder.tally.actions
    return null
  },
  forceCrit: (ctx) => ctx.hook?.data.primed === true && Number(ctx.hook.data.armed) === ctx.holder.tally.actions,
  outgoingDamagePercent: (ctx) => (ctx.hook?.data.primed === true && Number(ctx.hook.data.armed) === ctx.holder.tally.actions ? (ctx.line.percent ?? 0) : 0),
  modifyWeight: (ctx, weight) => {
    const hook = ctx.hook
    if (!hook) return weight
    const armed = hook.data.primed === true && Number(hook.data.armed) === ctx.holder.tally.actions
    hook.data.primed = false
    hook.data.armed = -1
    return armed ? Math.min(weight, ctx.line.amount ?? 1000) : weight
  },
}
export default handler
