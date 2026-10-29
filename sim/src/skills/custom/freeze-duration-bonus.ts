import type { CustomHandler, HookContext } from './types.ts'

/**
 * Deep Cold (Arcanist passive, Rime IV; docs/classes/arcanist.md §4.2): every Freeze the holder causes lasts +`amount`
 * turns. Reading: most Freezes are a second Chill turning into one (statuses.ts gives the upgrade the Freeze's own
 * duration, so a duration bonus on the Chill line never reaches it); the hook therefore notes which enemies were
 * Frozen as each of the holder's actions begins (`onHolderAttacks`) and, when the action's skill has resolved
 * (`onSkillUsed`), lengthens every Freeze the holder put on an enemy that was not Frozen before — a Freeze line and an
 * upgraded Chill alike.
 */
function frozenIds(ctx: HookContext): string[] {
  return ctx.fx
    .enemiesOf(ctx.holder)
    .filter((e) => e.statuses.some((s) => s.id === 'freeze'))
    .map((e) => e.id)
}

const handler: CustomHandler = {
  onHolderAttacks: (ctx) => {
    if (ctx.hook) ctx.hook.data.frozenBefore = frozenIds(ctx).join(',')
  },
  onSkillUsed: (ctx) => {
    const hook = ctx.hook
    if (!hook || typeof hook.data.frozenBefore !== 'string') return
    const before = new Set(hook.data.frozenBefore.split(',').filter((x) => x.length > 0))
    delete hook.data.frozenBefore
    const bonus = Math.max(0, Math.round(ctx.line.amount ?? 1))
    if (bonus === 0) return
    for (const e of ctx.fx.enemiesOf(ctx.holder)) {
      if (before.has(e.id)) continue
      const freeze = e.statuses.find((s) => s.id === 'freeze' && s.sourceId === ctx.holder.id)
      if (!freeze || freeze.turnsLeft === null) continue
      freeze.turnsLeft += bonus
      ctx.fx.log('deepCold', `${e.name} is frozen deeper (+${bonus} turn${bonus === 1 ? '' : 's'})`, { actorId: ctx.holder.id, targetId: e.id, amount: bonus })
    }
  },
}
export default handler
