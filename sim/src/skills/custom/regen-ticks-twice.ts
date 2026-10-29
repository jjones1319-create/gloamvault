import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']
const ID = 'regen-ticks-twice'

/**
 * Troll's Regrowth (Mender passive, Benediction IV — a monster technique whose Warren Troll waits for the Fungal Deep;
 * docs/classes/mender.md §4.1): Regen on the holder's allies ticks twice per turn, and Fire damage on a holder removes
 * its Regen "as it does the troll's" at `percent`% (100; the Mastery sets 0: Fire no longer removes it).
 * Reading: the fight ticks Regen once at an actor's turn start (statuses.ts pendingTicks), so the Mender's hook seeds a
 * companion (same line, sourceId = the Mender) on every ally at the fight's start and at each of its turn starts;
 * each companion heals its holder one more Regen tick in `onTurnStart` (after the regular tick) and drops the Regen
 * on a Fire hit (`afterHit`; Burn's ticks are DoTs and do not count). Both need the Mender standing.
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
    if (!owner || !ctx.fx.isActive(owner) || !ctx.fx.isActive(ctx.holder)) return
    const regen = ctx.holder.statuses.find((s) => s.id === 'regen')
    if (!regen || regen.magnitude <= 0) return
    const amount = roundHalfUp((ctx.holder.maxHp * regen.magnitude) / 100) * Math.max(1, regen.stacks)
    const healer = ctx.state.actors.find((a) => a.id === regen.sourceId) ?? owner
    const healed = ctx.fx.heal(healer, ctx.holder, amount)
    ctx.fx.log('hot', `${ctx.holder.name} regenerates again (${healed})`, { actorId: ctx.holder.id, amount: healed, data: { status: 'regen' } })
  },
  afterHit: (ctx, incoming) => {
    if (incoming.damageType !== 'fire' || incoming.isDot) return
    const owner = ownerOf(ctx)
    if (!owner || !ctx.fx.isActive(owner) || !ctx.fx.hasStatus(ctx.holder, 'regen')) return
    const chance = ctx.line.percent ?? 100
    if (chance <= 0 || (chance < 100 && !ctx.rng.pct(chance))) return
    ctx.fx.removeStatus(ctx.holder, 'regen')
    ctx.fx.log('regenBurnt', `The fire sears ${ctx.holder.name}'s regrowth away`, { actorId: ctx.holder.id })
  },
}
export default handler
