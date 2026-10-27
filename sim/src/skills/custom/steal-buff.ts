import type { CustomHandler } from './types.ts'

/**
 * Sleight (Shade, Larceny III; docs/classes/shade.md §4.3): moves `amount` strippable buff(s) (a status whose record
 * lists `strip` among its cleanses: Fortify, Haste, Shield, Regen) from the target to an ally — the ally with the
 * lowest HP% (the holder included), since the skill's target word names the enemy and no ally is chosen. A buff the
 * ally already holds keeps the stronger magnitude, the higher stacks and the longer duration.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || target.side === ctx.holder.side) return
    const allies = ctx.fx.alliesOf(ctx.holder)
    let receiver = ctx.holder
    let best = Infinity
    for (const a of allies) {
      const pct = (a.hp * 100) / Math.max(1, a.maxHp)
      if (pct < best) {
        best = pct
        receiver = a
      }
    }
    const want = Math.max(1, ctx.line.amount ?? 1)
    let moved = 0
    for (const s of [...target.statuses]) {
      if (moved >= want) break
      const def = ctx.content.statuses.get(s.id)
      if (!def?.cleansedBy.includes('strip')) continue
      target.statuses = target.statuses.filter((x) => x !== s)
      const mine = receiver.statuses.find((x) => x.id === s.id)
      if (mine) {
        mine.magnitude = Math.max(mine.magnitude, s.magnitude)
        mine.stacks = Math.max(mine.stacks, s.stacks)
        mine.turnsLeft = mine.turnsLeft === null || s.turnsLeft === null ? null : Math.max(mine.turnsLeft, s.turnsLeft)
      } else receiver.statuses.push({ ...s, sourceId: ctx.holder.id, counter: 0 })
      moved += 1
      ctx.fx.log('steal', `${ctx.holder.name} lifts ${def.name} from ${target.name} for ${receiver.name}`, { actorId: ctx.holder.id, targetId: target.id, data: { status: s.id, to: receiver.id } })
    }
    if (moved === 0) ctx.fx.log('steal', `${target.name} has nothing worth taking`, { actorId: ctx.holder.id, targetId: target.id })
  },
}
export default handler
