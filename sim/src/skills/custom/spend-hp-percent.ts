import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Blood Price (Blade, Bloodletter IV; docs/classes/blade.md §4.3): "Spend 25% max HP" (Mastery 15%) — a cost paid
 * from the target's own HP: `percent`% of its max HP, never below 1 HP (a price, not a blow: no Defense, no Block, no
 * Momentum for being hit, no Last Stand). The cost tags Vitality, as Reckless Swing's self-damage does, and does not
 * rank-scale.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const who = target ?? ctx.holder
    if (!ctx.fx.isActive(who)) return
    const spend = Math.min(roundHalfUp((who.maxHp * (ctx.line.percent ?? 0)) / 100), who.hp - 1)
    if (spend <= 0) return
    who.hp -= spend
    who.tally.damageTaken += spend
    ctx.fx.log('cost', `${who.name} pays ${spend} HP in blood`, { actorId: who.id, targetId: who.id, amount: spend })
    if (who.hero) {
      let enemyLevel = 0
      for (const e of ctx.fx.enemiesOf(who)) enemyLevel = Math.max(enemyLevel, e.level)
      ctx.state.xp.push({ actorId: who.id, kind: 'attribute', id: 'vitality', enemyLevel: enemyLevel || ctx.state.options.floorLevel })
    }
  },
}
export default handler
