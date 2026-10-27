import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']
const ID = 'party-shatter-bonus'

/**
 * Shatter (Arcanist, Rime I; docs/classes/arcanist.md §4.2): while the Arcanist is in the fight, any ally's hit on a
 * Frozen enemy deals +`percent`% and crits; the Freeze ends and the target's accumulator moves by `energy` (−300).
 * Reading: attacker-side joints sit on the attacker, so the Arcanist's hook seeds a companion hook (same line,
 * sourceId = the Arcanist) on every ally at fight start and at each of its turn starts (pets and summons that join
 * later); the companions and the Arcanist's own hook answer `outgoingDamagePercent`, `forceCrit` and
 * `onDealtDamage` while the Arcanist stands. The Freeze status's own ×1.5 on physical hits still applies first.
 */
function ownerOf(ctx: HookContext): Actor | null {
  return ctx.state.actors.find((a) => a.id === ctx.hook?.sourceId) ?? null
}

function standing(ctx: HookContext): boolean {
  const owner = ownerOf(ctx)
  return owner !== null && ctx.fx.isActive(owner)
}

function frozen(target: Actor): boolean {
  return target.statuses.some((s) => s.id === 'freeze')
}

function seed(ctx: HookContext, owner: Actor): void {
  for (const a of ctx.fx.alliesOf(owner)) {
    if (a.hooks.some((h) => h.customId === ID && h.sourceId === owner.id)) continue
    ctx.fx.installHook(a, ctx.line, owner.id, { sourceSkillId: ctx.hook?.sourceSkillId ?? ctx.sourceId })
  }
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, holder.id, { sourceSkillId: ctx.sourceId })
    seed(ctx, holder)
  },
  onFightStart: (ctx) => {
    if (ctx.hook?.sourceId === ctx.holder.id) seed(ctx, ctx.holder)
  },
  onTurnStart: (ctx) => {
    if (ctx.hook?.sourceId === ctx.holder.id) seed(ctx, ctx.holder)
  },
  outgoingDamagePercent: (ctx, target, incoming) => (!incoming.isDot && frozen(target) && standing(ctx) ? (ctx.line.percent ?? 0) : 0),
  forceCrit: (ctx, target) => frozen(target) && standing(ctx),
  onDealtDamage: (ctx, target, _dealt, incoming) => {
    if (incoming.isDot || !standing(ctx)) return
    const freeze = target.statuses.find((s) => s.id === 'freeze')
    if (!freeze) return
    target.statuses = target.statuses.filter((s) => s !== freeze)
    target.energy += ctx.line.energy ?? -300
    ctx.fx.log('shatter', `${target.name} shatters`, { actorId: ctx.holder.id, targetId: target.id, data: { by: ctx.hook?.sourceId ?? null } })
  },
}
export default handler
