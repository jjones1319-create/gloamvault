import type { CustomHandler, HookContext } from './types.ts'

/**
 * Living Wall (Warden, Bulwark V passive; docs/classes/warden.md §4.1): Block also applies to elemental attacks at
 * `percent`% of the holder's Block chance (50; Mastery 100), and every block gives `amount` Momentum (5). Reading: the
 * fight rolls Block only on physical hits (effects.ts), so the hook rolls the elemental block itself on every direct
 * non-physical hit (DoT ticks and Ultimates never), halving it as a block does (a target-side −50 before Defense),
 * counting it in `tally.blocks` and bumping `autoBlock:<holder id>` as the other forced blocks do. Natural physical
 * blocks give their Momentum through `onBlock`.
 */
function momentum(ctx: HookContext): void {
  const amount = ctx.line.amount ?? 0
  if (amount > 0) ctx.fx.gainMomentum(ctx.holder, amount)
}

const handler: CustomHandler = {
  incomingDamagePercent: (ctx, incoming) => {
    if (incoming.physical || incoming.isDot || incoming.isUltimate) return 0
    const chance = (ctx.fx.statOf(ctx.holder, 'block') * (ctx.line.percent ?? 50)) / 100
    if (chance <= 0 || !ctx.rng.pct(chance)) return 0
    const key = `autoBlock:${ctx.holder.id}`
    ctx.state.flags[key] = Number(ctx.state.flags[key] ?? 0) + 1
    ctx.holder.tally.blocks += 1
    ctx.fx.log('block', `${ctx.holder.name} blocks the ${incoming.damageType}`, { actorId: ctx.holder.id, targetId: incoming.attacker?.id })
    momentum(ctx)
    return -50
  },
  onBlock: (ctx) => momentum(ctx),
}
export default handler
