import { roundHalfUp } from '../../stats.ts'
import type { DamageType } from '../../types/enums.ts'
import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']
const ID = 'veil-strike-bonus'
const STARTS = new Set(['action', 'guard', 'swapRow', 'flee', 'fleeFail', 'freeAlly', 'charge', 'stance'])

function actionStart(ctx: HookContext): number {
  const log = ctx.state.log
  for (let i = log.length - 1; i >= 0; i--) if (log[i]?.actorId === ctx.holder.id && STARTS.has(log[i]?.kind ?? '')) return i
  return 0
}

/**
 * First-cast fallback: was the holder Veiled when this action began? Walking back from the action's marker: a Veil
 * `status` event on the holder says yes unless, since it, the holder took an action (attacks end Veil; an item would
 * not, and under-reads), the Veil expired (`statusEnd`) or a hit on the holder missed (a Veil spent — a plain dodge
 * looks the same and under-reads).
 */
function veiledByLog(ctx: HookContext): boolean {
  const log = ctx.state.log
  for (let j = actionStart(ctx) - 1; j >= 0; j--) {
    const e = log[j]
    if (!e) continue
    if (e.kind === 'action' && e.actorId === ctx.holder.id) return false
    if (e.kind === 'statusEnd' && e.actorId === ctx.holder.id && e.data?.status === 'veil') return false
    if (e.kind === 'miss' && e.targetId === ctx.holder.id) return false
    if (e.kind === 'status' && e.targetId === ctx.holder.id && e.data?.status === 'veil') return true
  }
  return false
}

function typePercent(ctx: HookContext, target: Actor, type: DamageType): number {
  const m = target.monster
  if (!m) return 100
  const e = ctx.t.combat.elements
  if (m.immune.includes(type)) return e.immuneMultiplier * 100
  if (m.weak.includes(type)) return e.weakMultiplier * 100
  if (m.resist.includes(type)) return e.resistMultiplier * 100
  return 100
}

/**
 * Backstab (Shade, Shadow I; docs/classes/shade.md §4.1): from Veil the skill's damage is +`percent`% (×2; mastery
 * ×2.5) and Crit Rate +`amount` pp; the attack ends Veil as usual. The fight ends Veil the moment the Shade attacks —
 * before any line resolves — so the line cannot read the status itself. Reading: the first Backstab of a fight installs
 * a persistent hook on the Shade whose `onTurnStart` remembers whether the Shade is Veiled as each turn begins;
 * from then on `modifyLine` scales the skill's damage line and `critRateBonus` the roll on a turn that began Veiled.
 * That first cast reads the Veil from the log (`veiledByLog`) and pays the damage difference as an extra
 * Defense-ignoring strike, without the crit bonus.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = ctx.holder
    const existing = holder.hooks.find((h) => h.customId === ID && h.sourceSkillId === ctx.sourceId)
    const tracked = existing !== undefined && existing.data.action === holder.tally.actions
    const veiled = tracked ? existing.data.veiled === true : veiledByLog(ctx)
    if (!existing) ctx.fx.installHook(holder, ctx.line, holder.id, { sourceSkillId: ctx.sourceId, data: { veiled: false, action: -1, inSkill: false } })
    if (!veiled) return
    ctx.fx.log('fromVeil', `${holder.name} strikes from the Veil`, { actorId: holder.id })
    if (tracked || !target) return
    const skill = ctx.content.skills.get(ctx.sourceId ?? '')
    const type = skill?.effects.find((l) => l.kind === 'damage')?.damageType ?? 'pierce'
    const hits = ctx.state.log.slice(actionStart(ctx)).filter((e) => e.kind === 'damage' && e.actorId === holder.id && e.targetId === target.id && (e.amount ?? 0) > 0)
    const pct = typePercent(ctx, target, type)
    if (pct <= 0 || !ctx.fx.isActive(target)) return
    for (const hit of hits) {
      const extra = roundHalfUp(((hit.amount ?? 0) * (ctx.line.percent ?? 0)) / pct)
      if (extra > 0) ctx.fx.strike(holder, target, { amount: extra, damageType: type, label: `${skill?.name ?? 'Backstab'} (from Veil)`, canMiss: false, canCrit: false, isMelee: false, ignoresDefense: true })
    }
  },
  onTurnStart: (ctx) => {
    if (!ctx.hook) return
    ctx.hook.data.veiled = ctx.fx.hasStatus(ctx.holder, 'veil')
    ctx.hook.data.action = ctx.holder.tally.actions
  },
  modifyLine: (ctx, line, source) => {
    const hook = ctx.hook
    if (!hook) return null
    hook.data.inSkill = source.id === hook.sourceSkillId
    if (hook.data.inSkill !== true || hook.data.veiled !== true || hook.data.action !== ctx.holder.tally.actions || line.kind !== 'damage') return null
    return { ...line, multiplier: ((line.multiplier ?? 1) * (100 + (ctx.line.percent ?? 0))) / 100 }
  },
  critRateBonus: (ctx) => {
    const hook = ctx.hook
    return hook && hook.data.inSkill === true && hook.data.veiled === true && hook.data.action === ctx.holder.tally.actions ? (ctx.line.amount ?? 0) : 0
  },
}
export default handler
