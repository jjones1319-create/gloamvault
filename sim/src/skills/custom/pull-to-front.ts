import type { CustomHandler } from './types.ts'

/**
 * Chain of Penance (Tidebound Flagellant, 06 §3.3): "pulls one back-row hero to the front and Roots (2) them". The
 * attack's hit and its Root are DSL lines; this rider moves the struck hero (the chosen back-row hero, else the first
 * back-row hero) into the front row. A species immune to forced moves (05) stays put, as does a hero in front.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = ctx.holder
    const victim = target && target.side !== holder.side && target.row === 'back' && ctx.fx.isActive(target) ? target : (ctx.fx.enemiesOf(holder).find((e) => e.row === 'back' && ctx.fx.isActive(e)) ?? null)
    if (!victim) {
      ctx.fx.log('pull', `${holder.name}'s chain finds no one in the back row`, { actorId: holder.id })
      return
    }
    if (victim.hero?.species.forcedRowMoveImmune) {
      ctx.fx.log('pull', `${victim.name} cannot be pulled`, { actorId: holder.id, targetId: victim.id })
      return
    }
    victim.row = 'front'
    ctx.fx.log('pull', `${holder.name} hauls ${victim.name} into the front row`, { actorId: holder.id, targetId: victim.id, data: { row: 'front' } })
  },
}
export default handler
