import type { CustomHandler, HookContext } from './types.ts'

/**
 * Iron Vigil (Warden, Bulwark IV passive; docs/classes/warden.md §4.1): while any enemy is Taunted by the holder
 * (a living enemy holding a Taunt whose source is the holder): Defense +`percent`% and +`amount` extra Momentum each
 * time the holder is hit. Reading: a hook cannot buff its own holder's stats, so the Defense sits on the holder as a
 * StatModifier (sourceId `taunting-defense:<holder id>`) re-checked at the fight's start, the holder's turn start and
 * at every hit on it before Defense applies (the pipeline reads the target's percent hooks before its Defense).
 */
function taunting(ctx: HookContext): boolean {
  return ctx.fx.enemiesOf(ctx.holder).some((e) => e.statuses.some((s) => s.id === 'taunt' && s.sourceId === ctx.holder.id))
}

function sync(ctx: HookContext): boolean {
  const holder = ctx.holder
  const src = `taunting-defense:${holder.id}`
  const on = holder.hp > 0 && taunting(ctx)
  const has = holder.modifiers.some((m) => m.sourceId === src)
  if (on && !has) holder.modifiers.push({ stat: 'defense', amount: 0, percent: ctx.line.percent ?? 0, turnsLeft: 9999, sourceId: src })
  else if (!on && has) holder.modifiers = holder.modifiers.filter((m) => m.sourceId !== src)
  return on
}

const handler: CustomHandler = {
  onFightStart: (ctx) => {
    sync(ctx)
  },
  onTurnStart: (ctx) => {
    sync(ctx)
  },
  incomingDamagePercent: (ctx) => {
    sync(ctx)
    return 0
  },
  afterHit: (ctx, incoming) => {
    if (incoming.isDot || !sync(ctx)) return
    const amount = ctx.line.amount ?? 0
    if (amount > 0) ctx.fx.gainMomentum(ctx.holder, amount)
  },
}
export default handler
