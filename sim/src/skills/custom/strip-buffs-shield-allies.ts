import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Grand Larceny (Shade, Larceny IV; docs/classes/shade.md §4.3): strips every buff from every enemy (a status whose
 * record lists `strip`; never Veil) and gives each ally a Shield of `percent`% (5) of its own max HP per buff stripped.
 * With `amount` 1 (the Mastery) a stripped `status` (Haste) becomes its opposite on that enemy — Slow for the turns the
 * Haste had left. The line says `status` in the base form too, so the Mastery replaces it (skill-lines.ts signature).
 * Reading: the line runs once (target self) and walks the enemies itself, so the Shield is one status per ally sized by
 * the whole haul (a Shield keeps the larger of two, 03 §3.5).
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const holder = ctx.holder
    const convert = (ctx.line.amount ?? 0) === 1 ? ctx.line.status : undefined
    let count = 0
    for (const e of ctx.fx.enemiesOf(holder)) {
      for (const s of [...e.statuses]) {
        if (s.id === 'veil') continue
        const def = ctx.content.statuses.get(s.id)
        if (!def?.cleansedBy.includes('strip')) continue
        e.statuses = e.statuses.filter((x) => x !== s)
        count += 1
        if (convert && s.id === convert) ctx.fx.applyStatus(e, { status: 'slow', duration: Math.max(1, s.turnsLeft ?? 2) }, holder.id)
      }
    }
    if (count === 0) {
      ctx.fx.log('strip', `${holder.name} finds nothing worth taking`, { actorId: holder.id })
      return
    }
    ctx.fx.log('strip', `${holder.name} strips ${count} buff${count === 1 ? '' : 's'} from the enemy`, { actorId: holder.id, amount: count })
    for (const ally of ctx.fx.alliesOf(holder)) {
      const amount = roundHalfUp((ally.maxHp * (ctx.line.percent ?? 5) * count) / 100)
      if (amount > 0) ctx.fx.applyStatus(ally, { status: 'shield', magnitude: amount }, holder.id)
    }
  },
}
export default handler
