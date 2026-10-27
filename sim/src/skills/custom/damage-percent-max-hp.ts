import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Two homes. In a fight (Reckless Swing, Blade, Bloodletter I; docs/classes/blade.md §4.3; target self): the holder
 * takes `percent` of its own max HP, ignoring Defense, as a hit nobody dealt (no crit, no variance, no lifesteal);
 * the hit tags Vitality. The owning skill's Mastery `self-damage-skipped-above-hp` is read from the skill record at
 * rank 10 and skips the line while the holder is above its threshold. The percent is a cost and does not rank-scale.
 * In the corridor (Gravehollow's pit trap: `percent` of the lowest-Perception hero's max HP) delve.ts `fireTrap`
 * resolves the line inline and never calls this handler.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const who = target ?? ctx.holder
    const holder = ctx.holder
    if (who === holder && ctx.sourceId) {
      const skill = ctx.content.skills.get(ctx.sourceId)
      const rank = holder.hero?.ranks[ctx.sourceId] ?? 1
      const skip = rank >= 10 ? skill?.mastery.effects.find((e) => e.kind === 'custom' && e.customId === 'self-damage-skipped-above-hp') : undefined
      if (skip && holder.hp * 100 > holder.maxHp * (skip.percent ?? 50)) {
        ctx.fx.log('skip', `${holder.name} swings without opening a vein`, { actorId: holder.id })
        return
      }
    }
    const amount = roundHalfUp((who.maxHp * (ctx.line.percent ?? 0)) / 100)
    if (amount <= 0 || !ctx.fx.isActive(who)) return
    ctx.fx.strike(null, who, { amount, damageType: ctx.line.damageType ?? 'slash', label: 'blood price', canMiss: false, canCrit: false, isMelee: false, ignoresDefense: true })
    if (who.hero) {
      let enemyLevel = 0
      for (const e of ctx.fx.enemiesOf(who)) enemyLevel = Math.max(enemyLevel, e.level)
      ctx.state.xp.push({ actorId: who.id, kind: 'attribute', id: 'vitality', enemyLevel: enemyLevel || ctx.state.options.floorLevel })
    }
  },
}
export default handler
