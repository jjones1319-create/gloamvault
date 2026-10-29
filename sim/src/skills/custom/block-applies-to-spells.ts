import type { CustomHandler } from './types.ts'

/**
 * The Wyrmward Buckler (08 §7): "Block also applies to spell and breath damage". The hook sits on the wearer
 * (hero.ts). The fight rolls Block only on physical hits (03 §2.2: Block halves a physical hit); this hook rolls the
 * holder's Block for every other direct hit (a spell, a breath, an elemental strike) and halves it on a success, as a
 * block does. DoT ticks and Ultimates are never blocked. Reading: the block's other riders (wear, on-block hooks)
 * follow physical blocks only.
 */
const handler: CustomHandler = {
  incomingDamagePercent: (ctx, incoming) => {
    if (incoming.physical || incoming.isDot || incoming.isUltimate) return 0
    const block = ctx.fx.statOf(ctx.holder, 'block')
    if (block <= 0 || !ctx.rng.pct(block)) return 0
    ctx.fx.log('blockSpell', `${ctx.holder.name} catches the ${incoming.damageType} on the Wyrmward Buckler`, { actorId: ctx.holder.id })
    return -50
  },
}
export default handler
