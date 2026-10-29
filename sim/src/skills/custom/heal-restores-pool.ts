import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * Everflow (Mender passive, Benediction V; docs/classes/mender.md §4.1): the holder's heals also restore `percent`%
 * (5; Mastery 8) of the target's pool. Reading: the heal pipeline has no after-heal joint, so the hook marks the log as
 * each of the holder's actions begins (`onHolderAttacks`) and, when its skill has resolved (`onSkillUsed`), restores
 * the pool of every actor its 'heal' events named — once per target per action. Regen ticks (not an action) do not.
 */
const handler: CustomHandler = {
  onHolderAttacks: (ctx) => {
    if (ctx.hook) ctx.hook.data.mark = ctx.state.log.length
  },
  onSkillUsed: (ctx) => {
    const hook = ctx.hook
    if (!hook || typeof hook.data.mark !== 'number') return
    const log = ctx.state.log
    const healed = new Set<string>()
    for (let i = hook.data.mark; i < log.length; i++) {
      const e = log[i]
      if (e && e.kind === 'heal' && e.actorId === ctx.holder.id && e.targetId) healed.add(e.targetId)
    }
    delete hook.data.mark
    for (const id of healed) {
      const a = ctx.state.actors.find((x) => x.id === id)
      if (!a || a.poolKind === null || a.poolMax <= 0 || !ctx.fx.isActive(a)) continue
      const gain = Math.min(a.poolMax - a.pool, roundHalfUp((a.poolMax * (ctx.line.percent ?? 5)) / 100))
      if (gain <= 0) continue
      a.pool += gain
      ctx.fx.log('everflow', `${a.name} is refreshed (+${gain} ${a.poolKind})`, { actorId: ctx.holder.id, targetId: a.id, amount: gain })
    }
  },
}
export default handler
