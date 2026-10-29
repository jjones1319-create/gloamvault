import type { CustomHandler } from './types.ts'

/**
 * Salt Hex (Brine Hag, 06 §3.3): "Petrify a Cursed hero (2 turns; fails on an un-Cursed one) … Hexes the Cursed hero
 * with the highest Attack" — 06 §7: Petrify is only ever after a Curse. The struck hero when it is Cursed, else the
 * Cursed hero with the highest Attack, takes `status` (`duration`); with no Cursed hero the hex fails, logged.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!ctx.line.status) return
    const hag = ctx.holder
    const cursed = ctx.fx.enemiesOf(hag).filter((e) => ctx.fx.isActive(e) && ctx.fx.hasStatus(e, 'curse'))
    const victim = target && cursed.includes(target) ? target : (cursed.sort((a, b) => ctx.fx.statOf(b, 'attackPhys') - ctx.fx.statOf(a, 'attackPhys'))[0] ?? null)
    if (!victim) {
      ctx.fx.log('fizzle', `${hag.name}'s hex slides off: no curse to take hold of`, { actorId: hag.id, targetId: target?.id })
      return
    }
    ctx.fx.applyLine(hag, { kind: 'applyStatus', status: ctx.line.status, chance: ctx.line.chance, duration: ctx.line.duration, target: 'enemy' }, 'enemy', victim, { kind: 'attack', id: ctx.sourceId ?? 'hex', label: 'hex', neverMisses: true, isMelee: false })
  },
}
export default handler
