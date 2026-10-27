import type { CustomHandler, HookContext } from './types.ts'

/**
 * Shielded (elite affix, 06 §2): the first `amount` hits of the fight against the champion are absorbed entirely;
 * the shield re-arms once when it drops below 50% HP. Installed on the champion at spawn (explore.ts); the hook's
 * counter is the hits left, `data.rearmed` the once. Only a hit that would deal damage spends a charge (DoTs never
 * do: they bypass the pipeline). It re-arms on the hit that takes it under half, or at its turn start when a tick did.
 */
function arm(ctx: HookContext): void {
  const hook = ctx.hook
  if (!hook || hook.data.armed === true) return
  hook.counter = Math.max(0, ctx.line.amount ?? 2)
  hook.data.armed = true
}

function rearmIfLow(ctx: HookContext): void {
  const hook = ctx.hook
  if (!hook || hook.data.rearmed === true) return
  if (ctx.holder.hp <= 0 || ctx.holder.hp * 2 >= ctx.holder.maxHp) return
  hook.data.rearmed = true
  hook.counter = Math.max(0, ctx.line.amount ?? 2)
  ctx.fx.log('shieldRearm', `${ctx.holder.name}'s shield flares again`, { actorId: ctx.holder.id, amount: hook.counter })
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null, counter: Math.max(0, ctx.line.amount ?? 2), data: { armed: true } })
  },
  onFightStart: (ctx) => arm(ctx),
  absorb: (ctx, incoming) => {
    arm(ctx)
    const hook = ctx.hook
    if (!hook || hook.counter <= 0 || incoming.amount <= 0) return incoming.amount
    hook.counter -= 1
    ctx.fx.log('shieldAbsorb', `${ctx.holder.name}'s shield absorbs the hit${hook.counter === 0 ? ' and pops' : ''}`, { actorId: ctx.holder.id, amount: incoming.amount, data: { left: hook.counter } })
    return 0
  },
  afterHit: (ctx) => rearmIfLow(ctx),
  onTurnStart: (ctx) => rearmIfLow(ctx),
}
export default handler
