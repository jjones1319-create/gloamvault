import type { CustomHandler, HookContext } from './types.ts'

/**
 * Pain Threshold (Blade, Bloodletter II; docs/classes/blade.md §4.3): `stat` +`amount` while the holder is under
 * `percent`% HP. Reading: a hook cannot buff its own holder's stats, so the bonus sits on the holder as a
 * StatModifier (sourceId `stat-amount-below-hp:<skill>:<stat>:<threshold>`) that is re-checked at the fight's start,
 * the holder's turn start, after every hit it takes, before each of its lines and when it spends an action.
 */
function sync(ctx: HookContext): void {
  const hook = ctx.hook
  const stat = ctx.line.stat
  if (!hook || !stat) return
  const holder = ctx.holder
  const src = `stat-amount-below-hp:${hook.sourceSkillId ?? hook.sourceId}:${stat}:${ctx.line.percent ?? 0}`
  const on = holder.hp > 0 && holder.hp * 100 < holder.maxHp * (ctx.line.percent ?? 0)
  const has = holder.modifiers.some((m) => m.sourceId === src)
  if (on && !has) holder.modifiers.push({ stat, amount: ctx.line.amount ?? 0, percent: 0, turnsLeft: 9999, sourceId: src })
  else if (!on && has) holder.modifiers = holder.modifiers.filter((m) => m.sourceId !== src)
}

const handler: CustomHandler = {
  onFightStart: (ctx) => sync(ctx),
  onTurnStart: (ctx) => sync(ctx),
  afterHit: (ctx) => sync(ctx),
  modifyLine: (ctx) => {
    sync(ctx)
    return null
  },
  modifyWeight: (ctx, weight) => {
    sync(ctx)
    return weight
  },
}
export default handler
