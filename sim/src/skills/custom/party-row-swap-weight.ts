import type { CustomHandler, HookContext } from './types.ts'

/**
 * Formation Drill (Warden, Vanguard I; docs/classes/warden.md §4.2): the Swap row action weighs `amount` (200)
 * instead of the usual 400 for the whole party. The Warden's passive hook answers its own swaps and keeps a marker
 * hook (data.marker) on every ally, refreshed at the fight's start and the Warden's turn starts; a marker answers
 * while the Warden stands.
 */
const ID = 'party-row-swap-weight'

function ensure(ctx: HookContext): void {
  if (!ctx.hook || ctx.hook.data.marker) return
  const warden = ctx.holder
  for (const ally of ctx.fx.alliesOf(warden)) {
    if (ally === warden || ally.hooks.some((h) => h.customId === ID && h.sourceId === warden.id)) continue
    ctx.fx.installHook(ally, ctx.line, warden.id, { sourceSkillId: ctx.hook.sourceSkillId, data: { marker: true } })
  }
}

const handler: CustomHandler = {
  onFightStart: (ctx) => ensure(ctx),
  onTurnStart: (ctx) => ensure(ctx),
  modifyWeight: (ctx, weight) => {
    if (weight !== ctx.t.combat.weights.rowSwap) return weight
    const hook = ctx.hook
    const source = hook?.data.marker ? ctx.state.actors.find((a) => a.id === hook.sourceId) : ctx.holder
    if (!source || !ctx.fx.isActive(source)) return weight
    return Math.max(0, ctx.line.amount ?? weight)
  },
}
export default handler
