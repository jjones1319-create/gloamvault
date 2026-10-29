import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']
const ID = 'ally-control-immunity-above-hp'

/**
 * Unwavering (Mender passive, Vigil V; docs/classes/mender.md §4.3): while the Mender is above `percent`% HP (50;
 * Mastery 25) no ally can be Feared, Stunned or Petrified — one line per `status`. Reading: statuses.ts has no
 * immunity joint that can follow the Mender's HP, so the Mender's hook seeds a companion per status on every ally
 * (sourceId = the Mender) and each companion sheds its status at the ally's turn start — before the fight asks whether
 * the turn is lost (fight.ts takeTurn) — while the Mender stands above the line. A Petrify's instant energy push is
 * not undone.
 */
function ownerOf(ctx: HookContext): Actor | null {
  return ctx.state.actors.find((a) => a.id === ctx.hook?.sourceId) ?? null
}

function seed(ctx: HookContext, owner: Actor): void {
  for (const a of ctx.fx.alliesOf(owner)) {
    if (a.hooks.some((h) => h.customId === ID && h.sourceId === owner.id && h.line.status === ctx.line.status)) continue
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
    const status = ctx.line.status
    if (!owner || !status || !ctx.fx.isActive(owner)) return
    if (owner.hp * 100 <= owner.maxHp * (ctx.line.percent ?? 50)) return
    if (ctx.fx.removeStatus(ctx.holder, status)) ctx.fx.log('unwavering', `${ctx.holder.name} stands firm against ${status} (${owner.name})`, { actorId: owner.id, targetId: ctx.holder.id, data: { status } })
  },
}
export default handler
