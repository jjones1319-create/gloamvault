import { clamp, roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']
const ID = 'nightshade-veins'

/** Seeds a mirror of the line (sourceId = the Shade) on every enemy that lacks one: adds and summons included. */
function seed(ctx: HookContext, owner: Actor): void {
  for (const e of ctx.fx.enemiesOf(owner)) {
    if (e.hooks.some((h) => h.customId === ID && h.sourceId === owner.id)) continue
    ctx.fx.installHook(e, ctx.line, owner.id, { sourceSkillId: ctx.hook?.sourceSkillId ?? null, data: { mirror: true, mark: ctx.state.log.length } })
  }
}

/**
 * Nightshade Veins (Shade, Venom IV; docs/classes/shade.md §4.2): each tick of the holder's Poison on an enemy restores
 * `percent`% of the holder's Stamina (3; Mastery 5); a Poison tick on a target below `amount`% HP (20) ticks double.
 * Reading: the passive seeds a mirror on every enemy (at the fight's start and its turn starts); an enemy's DoTs tick at
 * its turn start just before its hooks' `onTurnStart`, so the mirror reads the Poison `dot` events logged on its holder
 * since its last turn — counted when the holder's Poison is the Shade's (the status's source) — pays the Stamina, and,
 * when the target was under the threshold as the tick landed, deals the tick again (a second blow of the same amount
 * that ignores Defense, as the tick does).
 */
const handler: CustomHandler = {
  onFightStart: (ctx) => {
    if (ctx.hook && ctx.hook.data.mirror !== true) seed(ctx, ctx.holder)
  },
  onTurnStart: (ctx) => {
    const hook = ctx.hook
    if (!hook) return
    if (hook.data.mirror !== true) {
      seed(ctx, ctx.holder)
      return
    }
    const enemy = ctx.holder
    const log = ctx.state.log
    const from = Math.max(0, Number(hook.data.mark ?? 0))
    hook.data.mark = log.length
    const owner = ctx.state.actors.find((a) => a.id === hook.sourceId)
    const poison = enemy.statuses.find((s) => s.id === 'poison')
    if (!owner || !poison || poison.sourceId !== owner.id) return
    for (let i = from; i < log.length; i++) {
      const e = log[i]
      if (!e || e.kind !== 'dot' || e.actorId !== enemy.id || e.data?.status !== 'poison') continue
      const tick = e.amount ?? 0
      if (tick <= 0) continue
      if (ctx.fx.isActive(owner) && owner.poolKind) {
        const gain = roundHalfUp((owner.poolMax * (ctx.line.percent ?? 3)) / 100)
        owner.pool = clamp(owner.pool + gain, 0, owner.poolMax)
        ctx.fx.log('pool', `${owner.name} drinks from the poison (+${gain} ${owner.poolKind})`, { actorId: owner.id, amount: gain })
      }
      const hpBefore = enemy.hp + tick
      if (ctx.fx.isActive(enemy) && hpBefore * 100 < enemy.maxHp * (ctx.line.amount ?? 20)) {
        ctx.fx.strike(owner, enemy, { amount: tick, damageType: 'poison', label: 'Nightshade Veins', canMiss: false, canCrit: false, isMelee: false, ignoresDefense: true })
      }
    }
    hook.data.mark = log.length
  },
}
export default handler
