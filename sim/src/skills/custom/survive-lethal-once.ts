import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

/**
 * Martyr's Grace (Mender passive, Benediction III; docs/classes/mender.md §4.1): once per fight, the first ally who
 * would be downed instead survives at `amount` HP (or at `percent`% of max HP at Mastery). Installed as a hook by
 * hero.ts on the Mender; `beforeDowned` is read on the falling actor, so at the fight's start the Mender installs a
 * mirror of this line (`data.mirror`) on every ally, itself included. The once is `state.flags` keyed by the Mender;
 * the pipeline leaves the survivor at 1 HP and `afterHit` tops it up to `percent` when the line names one.
 */
function ensureMirrors(ctx: HookContext): void {
  const hook = ctx.hook
  if (!hook || hook.data.mirror === true || hook.data.mirrored === true) return
  hook.data.mirrored = true
  for (const ally of ctx.fx.alliesOf(ctx.holder)) ctx.fx.installHook(ally, ctx.line, ctx.holder.id, { data: { mirror: true } })
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null })
  },
  onFightStart: (ctx) => ensureMirrors(ctx),
  onTurnStart: (ctx) => ensureMirrors(ctx),
  beforeDowned: (ctx) => {
    const hook = ctx.hook
    if (!hook || hook.data.mirror !== true) return false
    const mender = ctx.state.actors.find((a) => a.id === hook.sourceId)
    if (!mender || (mender !== ctx.holder && !ctx.fx.isActive(mender))) return false
    const key = `survive-lethal-once:${mender.id}`
    if (ctx.state.flags[key] === true) return false
    ctx.state.flags[key] = true
    hook.data.topUp = true
    ctx.fx.log('martyr', `${ctx.holder.name} is spared by ${mender.name}'s grace`, { actorId: mender.id, targetId: ctx.holder.id })
    return true
  },
  afterHit: (ctx) => {
    const hook = ctx.hook
    if (!hook || hook.data.topUp !== true) return
    hook.data.topUp = false
    const pct = ctx.line.percent
    if (pct === undefined || ctx.holder.hp <= 0) return
    const floor = Math.max(1, roundHalfUp((ctx.holder.maxHp * pct) / 100))
    if (ctx.holder.hp < floor) ctx.holder.hp = floor
  },
}
export default handler
