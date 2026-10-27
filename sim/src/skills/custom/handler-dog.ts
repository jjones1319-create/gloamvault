import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/**
 * Handler's Fall (Cellar Hound, 06 §3.1): "Fear (1) when its handler dies" — the hound's handler is the nearest
 * bandit ally. The content writes it as a zero-weight attack that "fires when the nearest bandit ally dies, not as
 * an action"; explore.ts installs such lines on the monster as hooks at spawn (and `apply` installs the same hook).
 * The hook counts the Grinning Company allies standing (`data.bandits`) at the fight's start and at each of the
 * hound's turn starts; when the count has fallen the hound takes `status` (`duration`) and the count is reset.
 */
function bandits(ctx: HookContext, hound: Actor): number {
  return ctx.fx.alliesOf(hound).filter((a) => a !== hound && a.monster !== undefined && /grinning|bandit|captain/i.test(a.monster.monsterId)).length
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const hound = target ?? ctx.holder
    if (hound.side !== ctx.holder.side || !hound.monster) return
    ctx.fx.installHook(hound, ctx.line, hound.id, { sourceSkillId: ctx.sourceId, data: { bandits: bandits(ctx, hound) } })
  },
  onFightStart: (ctx) => {
    if (ctx.hook) ctx.hook.data.bandits = bandits(ctx, ctx.holder)
  },
  onTurnStart: (ctx) => {
    const hook = ctx.hook
    if (!hook) return
    const now = bandits(ctx, ctx.holder)
    const before = Number(hook.data.bandits ?? now)
    if (now < before) {
      const r = ctx.fx.applyStatus(ctx.holder, { status: ctx.line.status ?? 'fear', duration: ctx.line.duration ?? 1 }, ctx.holder.id)
      ctx.fx.log('handlerFall', `${ctx.holder.name}'s handler is down${r === 'applied' ? ': it cowers' : ''}`, { actorId: ctx.holder.id })
    }
    hook.data.bandits = now
  },
}
export default handler
