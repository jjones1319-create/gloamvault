import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']
const ID = 'regen-holds-below-hp'

/**
 * Everflow (Mender passive, Benediction V; docs/classes/mender.md §4.1): Regen on an ally below `percent`% HP (50)
 * does not count down. Reading: statuses count down at the holder's turn end (statuses.ts countDownStatuses), so the
 * Mender's hook seeds a companion on every ally (sourceId = the Mender) and each companion gives the Regen back the turn
 * it is about to lose — at the ally's turn start, while the ally is below the line and the Mender stands.
 */
function ownerOf(ctx: HookContext): Actor | null {
  return ctx.state.actors.find((a) => a.id === ctx.hook?.sourceId) ?? null
}

function seed(ctx: HookContext, owner: Actor): void {
  for (const a of ctx.fx.alliesOf(owner)) {
    if (a.hooks.some((h) => h.customId === ID && h.sourceId === owner.id)) continue
    ctx.fx.installHook(a, ctx.line, owner.id, { sourceSkillId: ctx.hook?.sourceSkillId ?? ctx.sourceId, replace: false })
  }
}

const handler: CustomHandler = {
  onFightStart: (ctx) => {
    if (ctx.hook?.sourceId === ctx.holder.id) seed(ctx, ctx.holder)
  },
  onTurnStart: (ctx) => {
    if (ctx.hook?.sourceId === ctx.holder.id) seed(ctx, ctx.holder)
    const owner = ownerOf(ctx)
    if (!owner || !ctx.fx.isActive(owner)) return
    const h = ctx.holder
    if (h.hp * 100 >= h.maxHp * (ctx.line.percent ?? 50)) return
    const regen = h.statuses.find((s) => s.id === 'regen')
    if (!regen || regen.turnsLeft === null || regen.fresh) return
    regen.turnsLeft += 1
  },
}
export default handler
