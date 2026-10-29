import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/**
 * Cocoon (Tomb Spider, 06 §3.2): "Grab a Webbed hero (counts as Web ending) … Cocoons the Webbed hero with the highest
 * Wisdom". The struck hero when it is Webbed, else the Webbed hero with the highest Wisdom: its Web ends and `status`
 * (Grab) lands on it from the spider. With no Webbed hero the cocoon closes on nothing, logged.
 */
function webbed(a: Actor): boolean {
  return a.statuses.some((s) => s.id === 'web')
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const spider = ctx.holder
    if (!ctx.line.status) return
    const pool = ctx.fx.enemiesOf(spider).filter((e) => ctx.fx.isActive(e) && webbed(e))
    const victim = target && pool.includes(target) ? target : (pool.sort((a, b) => b.attributes.wisdom - a.attributes.wisdom)[0] ?? null)
    if (!victim) {
      ctx.fx.log('fizzle', `${spider.name}'s cocoon closes on nothing`, { actorId: spider.id })
      return
    }
    ctx.fx.removeStatus(victim, 'web')
    ctx.fx.applyLine(spider, { kind: 'applyStatus', status: ctx.line.status, duration: ctx.line.duration, target: 'enemy' }, 'enemy', victim, { kind: 'attack', id: ctx.sourceId ?? 'cocoon', label: 'cocoon', neverMisses: true, isMelee: false })
  },
}
export default handler
