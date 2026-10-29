import type { CustomHandler } from './types.ts'

/**
 * Final Verdict (Blade, Executioner V; docs/classes/blade.md §4.2): "if it kills, you gain Haste 2 turns and the next
 * ally action deals +30%". The line resolves after the skill's hit: when a hit of the holder's this action killed (a
 * `damage` event with `data.killed` since the holder's action marker — the slain target is gone, so the line itself
 * resolves on whoever stands next, or on no one), the holder gains Haste for `duration` turns and every other standing
 * ally gets a one-shot boost of `percent`% (data.role 'boost'); once per action (flag `verdict:<holder id>`).
 * Reading: "the next ally action" is the first action an ally takes after the kill that deals damage — the first
 * boosted ally to deal damage claims the boost (flag `verdictBoost:<holder id>`) for that whole action (every hit of
 * it), and the other allies' boosts lapse.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const holder = ctx.holder
    const once = `verdict:${holder.id}`
    if (ctx.state.flags[once] === holder.tally.actions) return
    const log = ctx.state.log
    let killed = false
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]
      if (!e) continue
      if (e.kind === 'action' && e.actorId === holder.id) break
      if (e.kind === 'damage' && e.actorId === holder.id && e.data?.killed === true) killed = true
    }
    if (!killed) return
    ctx.state.flags[once] = holder.tally.actions
    ctx.fx.applyStatus(holder, { status: 'haste', duration: ctx.line.duration ?? 2 }, holder.id)
    const key = `verdictBoost:${holder.id}`
    ctx.state.flags[key] = 'open'
    for (const ally of ctx.fx.alliesOf(holder)) {
      if (ally === holder) continue
      ctx.fx.installHook(ally, ctx.line, holder.id, { sourceSkillId: ctx.sourceId, data: { role: 'boost', key } })
    }
    ctx.fx.log('verdict', `${holder.name}'s verdict is final; the next blow lands harder`, { actorId: holder.id })
  },
  outgoingDamagePercent: (ctx) => {
    const hook = ctx.hook
    if (!hook || hook.data.role !== 'boost' || ctx.state.actingId !== ctx.holder.id) return 0
    const key = String(hook.data.key)
    const claim = ctx.state.flags[key]
    if (claim === 'open') {
      ctx.state.flags[key] = ctx.holder.id
      hook.data.action = ctx.holder.tally.actions
    } else if (claim !== ctx.holder.id || Number(hook.data.action) !== ctx.holder.tally.actions) {
      ctx.fx.removeHook(ctx.holder, hook)
      return 0
    }
    return ctx.line.percent ?? 30
  },
  onTurnStart: (ctx) => {
    const hook = ctx.hook
    if (!hook || hook.data.role !== 'boost') return
    const claim = ctx.state.flags[String(hook.data.key)]
    // Claimed by another ally, or already spent on this ally's earlier action: the boost is gone.
    if (claim !== 'open') ctx.fx.removeHook(ctx.holder, hook)
  },
}
export default handler
