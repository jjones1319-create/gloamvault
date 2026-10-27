import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

/**
 * Nullifier (elite affix, 06 §2): the hero the champion last hit is Silenced (`status`, `duration`), the Silence
 * moving with each new hit; while the champion lives every hero's pool regen is `percent` (−50%). Installed on the
 * champion at spawn (explore.ts). Reading for the regen: `poolRegenBonus` is read on the regenerating actor's own
 * hooks, so the champion installs a mirror of this line (`data.mirror`) on every enemy hero at the fight's start
 * and removes the mirrors when it dies; a mirror answers only while the champion stands and returns `percent` of
 * the class's base regen in percentage points (Stamina 10 → −5, Mana 8 → −4), since the joint adds points.
 */
function champion(ctx: HookContext) {
  return ctx.state.actors.find((a) => a.id === ctx.hook?.sourceId) ?? null
}

function ensureMirrors(ctx: HookContext): void {
  const hook = ctx.hook
  if (!hook || hook.data.mirror === true || hook.data.mirrored === true) return
  hook.data.mirrored = true
  for (const hero of ctx.fx.enemiesOf(ctx.holder)) if (hero.kind === 'hero') ctx.fx.installHook(hero, ctx.line, ctx.holder.id, { data: { mirror: true } })
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null })
  },
  onFightStart: (ctx) => ensureMirrors(ctx),
  onTurnStart: (ctx) => ensureMirrors(ctx),
  onDealtDamage: (ctx, target, _dealt, incoming) => {
    const hook = ctx.hook
    if (!hook || hook.data.mirror === true || incoming.isDot || target.kind !== 'hero' || !ctx.fx.isActive(target)) return
    const status = ctx.line.status ?? 'silence'
    for (const other of ctx.fx.enemiesOf(ctx.holder)) if (other !== target) other.statuses = other.statuses.filter((s) => !(s.id === status && s.sourceId === ctx.holder.id))
    ctx.fx.applyStatus(target, { status, duration: ctx.line.duration }, ctx.holder.id)
  },
  poolRegenBonus: (ctx) => {
    const hook = ctx.hook
    if (!hook || hook.data.mirror !== true) return 0
    const owner = champion(ctx)
    if (!owner || !ctx.fx.isActive(owner)) return 0
    const base = ctx.holder.poolKind === 'stamina' ? ctx.t.derived.stamina.regenPercentPerTurn : ctx.holder.poolKind === 'mana' ? ctx.t.derived.mana.regenPercentPerTurn : 0
    return roundHalfUp((base * (ctx.line.percent ?? 0)) / 100)
  },
  onDeath: (ctx) => {
    const hook = ctx.hook
    if (!hook || hook.data.mirror === true) return
    for (const a of ctx.state.actors) for (const h of a.hooks.filter((h) => h.customId === 'silence-aura' && h.sourceId === ctx.holder.id)) ctx.fx.removeHook(a, h)
  },
}
export default handler
