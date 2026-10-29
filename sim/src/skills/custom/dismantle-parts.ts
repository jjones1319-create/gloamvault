import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']
const ID = 'dismantle-parts'

/** Seeds a mirror of the line (sourceId = the Ranger) on every enemy that lacks one. */
function seed(ctx: HookContext, owner: Actor): void {
  for (const e of ctx.fx.enemiesOf(owner)) {
    if (e.hooks.some((h) => h.customId === ID && h.sourceId === owner.id)) continue
    ctx.fx.installHook(e, ctx.line, owner.id, { sourceSkillId: ctx.hook?.sourceSkillId ?? null, data: { mirror: true } })
  }
}

/** The actor whose `partBreak` event broke this monster's limb, read from the log (newest first). */
function breaker(ctx: HookContext, monster: Actor): string | null {
  const log = ctx.state.log
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]
    if (e?.kind === 'partBreak' && e.targetId === monster.id) return e.actorId ?? null
  }
  return null
}

/** Pays the Ranger's part for one broken monster, once (a guaranteed common part; the Mastery's rare roll). */
function credit(ctx: HookContext, owner: Actor, monster: Actor, chance: number): void {
  const m = monster.monster
  if (!m?.partBroken) return
  const key = `dismantle:${monster.id}`
  if (ctx.state.flags[key]) return
  if (breaker(ctx, monster) !== owner.id) return
  ctx.state.flags[key] = true
  const def = ctx.content.monsters.get(m.monsterId)
  if (!def) return
  const common = def.parts.common
  ctx.fx.log('partStolen', `${owner.name} takes the broken ${m.monsterId} apart`, { actorId: owner.id, targetId: monster.id, amount: common.quantity.min, data: { materialId: common.materialId ?? null, itemId: common.itemId ?? null, quantity: common.quantity.min, rare: false, guaranteed: true } })
  if (chance > 0 && ctx.rng.pct(chance)) {
    const rare = def.parts.rare
    ctx.fx.log('partStolen', `${owner.name} finds a rare part in the wreck`, { actorId: owner.id, targetId: monster.id, amount: rare.quantity.min, data: { materialId: rare.materialId ?? null, itemId: rare.itemId ?? null, quantity: rare.quantity.min, rare: true, guaranteed: false } })
  }
}

/**
 * Dismantle (Ranger, Trapper IV; docs/classes/ranger.md §4.2): the holder's part-breaks drop a guaranteed common part
 * of the broken monster; with `chance` (Mastery 10) a rare part too. (The sheet's other half, a failed Trap Disarm
 * never triggering on the holder, is the delve-side `disarm-failure-safe` line beside this one.)
 * Reading: the fight cannot add to the bag, so a part is a `partStolen` event the delve totals into the fight's loot
 * (as Filch's). A limb breaks either inside the damage pipeline (a heavy enough blow, effects.ts `breakPart`) or by a
 * skill's `part-break` line (Hamstring, Heist) after its hit; the passive seeds a mirror on every enemy whose
 * `afterHit` credits a break the moment it happens, and the Ranger's `onSkillUsed` credits a `part-break` line's.
 * A break is the Ranger's when its `partBreak` event names the Ranger; each monster pays once.
 */
const handler: CustomHandler = {
  onFightStart: (ctx) => {
    if (ctx.hook && ctx.hook.data.mirror !== true) seed(ctx, ctx.holder)
  },
  onTurnStart: (ctx) => {
    if (ctx.hook && ctx.hook.data.mirror !== true) seed(ctx, ctx.holder)
  },
  afterHit: (ctx) => {
    const hook = ctx.hook
    if (!hook || hook.data.mirror !== true) return
    const owner = ctx.state.actors.find((a) => a.id === hook.sourceId)
    if (owner) credit(ctx, owner, ctx.holder, ctx.line.chance ?? 0)
  },
  onSkillUsed: (ctx) => {
    if (!ctx.hook || ctx.hook.data.mirror === true) return
    for (const e of ctx.fx.enemiesOf(ctx.holder)) credit(ctx, ctx.holder, e, ctx.line.chance ?? 0)
    for (const e of ctx.state.actors) if (e.side !== ctx.holder.side && e.gone && e.monster?.partBroken) credit(ctx, ctx.holder, e, ctx.line.chance ?? 0)
  },
}
export default handler
