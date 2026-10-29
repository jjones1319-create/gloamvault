import type { CustomHandler } from './types.ts'

/**
 * Swallow (Deep Maw, 06 §3.3): "Grab a Chilled front hero … Swallows only a Chilled hero — cleanse Chill and it
 * cannot". The struck hero when it is Chilled, else the first Chilled hero of the front row, takes `status`
 * (`duration`); with none the Maw closes on nothing, logged.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!ctx.line.status) return
    const maw = ctx.holder
    const chilled = ctx.fx.enemiesOf(maw).filter((e) => ctx.fx.isActive(e) && ctx.fx.hasStatus(e, 'chill'))
    const victim = target && chilled.includes(target) ? target : (chilled.find((e) => e.row === 'front') ?? null)
    if (!victim) {
      ctx.fx.log('fizzle', `${maw.name} closes on nothing: no one in reach is chilled`, { actorId: maw.id, targetId: target?.id })
      return
    }
    ctx.fx.applyLine(maw, { kind: 'applyStatus', status: ctx.line.status, chance: ctx.line.chance, duration: ctx.line.duration, target: 'enemy' }, 'enemy', victim, { kind: 'attack', id: ctx.sourceId ?? 'swallow', label: 'swallow', neverMisses: true, isMelee: true })
  },
}
export default handler
