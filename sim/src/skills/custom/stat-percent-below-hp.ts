import type { CustomHandler, HookContext } from './types.ts'

/**
 * Pain Threshold (Blade, Bloodletter II; docs/classes/blade.md §4.3): `stat` +`percent` while the holder is under
 * `amount`% HP; of several lines for one stat only the deepest matching threshold applies. Reading: a hook cannot
 * buff its own holder's stats, so the winning line keeps one StatModifier on the holder (sourceId
 * `stat-percent-below-hp:<skill>:<stat>:<threshold>`), re-checked at the fight's start, the holder's turn start,
 * after every hit it takes, before each of its lines and when it spends an action.
 */
const ID = 'stat-percent-below-hp'

function sync(ctx: HookContext): void {
  const hook = ctx.hook
  const stat = ctx.line.stat
  if (!hook || !stat) return
  const holder = ctx.holder
  const src = `${ID}:${hook.sourceSkillId ?? hook.sourceId}:${stat}:${ctx.line.amount ?? 0}`
  let deepest: typeof hook | null = null
  if (holder.hp > 0) {
    for (const h of holder.hooks) {
      if (h.customId !== ID || h.line.stat !== stat || holder.hp * 100 >= holder.maxHp * (h.line.amount ?? 0)) continue
      const t = h.line.amount ?? 0
      const best = deepest?.line.amount ?? Infinity
      if (!deepest || t < best || (t === best && (h.line.percent ?? 0) > (deepest.line.percent ?? 0))) deepest = h
    }
  }
  const on = deepest === hook
  const has = holder.modifiers.some((m) => m.sourceId === src)
  if (on && !has) holder.modifiers.push({ stat, amount: 0, percent: ctx.line.percent ?? 0, turnsLeft: 9999, sourceId: src })
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
