import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/**
 * Backdraft (Arcanist, Evocation II; docs/classes/arcanist.md §4.1): when a Burning enemy dies its Burn jumps to a
 * random living enemy and the Arcanist gains +`amount` Momentum.
 * Reading: the Arcanist's hook seeds a companion hook (same line, sourceId = the Arcanist) on every enemy at fight
 * start and at each of its turn starts (for adds and summons); the companion's `onDeath` moves the Burn at once.
 * Deaths by a DoT tick fire no death joint, so the Arcanist's turn start also sweeps fallen enemies still holding a
 * Burn and jumps those late. `state.flags` keeps each death from being counted twice.
 */
const ID = 'burn-jumps-on-death'

function seed(ctx: HookContext, owner: Actor): void {
  for (const e of ctx.fx.enemiesOf(owner)) {
    if (e.hooks.some((h) => h.customId === ID && h.sourceId === owner.id)) continue
    ctx.fx.installHook(e, ctx.line, owner.id, { sourceSkillId: ctx.hook?.sourceSkillId ?? ctx.sourceId })
  }
}

function jump(ctx: HookContext, owner: Actor, dead: Actor): void {
  const key = `backdraft:${owner.id}:${dead.id}`
  if (ctx.state.flags[key]) return
  const burn = dead.statuses.find((s) => s.id === 'burn')
  if (!burn) return
  ctx.state.flags[key] = true
  dead.statuses = dead.statuses.filter((s) => s !== burn)
  const living = ctx.state.actors.filter((a) => a.side === dead.side && a !== dead && ctx.fx.isActive(a))
  if (living.length > 0) {
    const next = ctx.rng.pick(living)
    const def = ctx.content.statuses.get('burn')
    const magnitude = def?.percent ? roundHalfUp((burn.magnitude * 100) / def.percent) : burn.magnitude
    const r = ctx.fx.applyStatus(next, { status: 'burn', duration: burn.turnsLeft ?? def?.durationDefault ?? 3, magnitude }, owner.id)
    if (r === 'applied') ctx.fx.log('backdraft', `${dead.name}'s flames leap to ${next.name}`, { actorId: owner.id, targetId: next.id })
  }
  ctx.fx.gainMomentum(owner, ctx.line.amount ?? 0)
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
    if (ctx.hook?.sourceId !== ctx.holder.id) return
    seed(ctx, ctx.holder)
    for (const a of ctx.state.actors) if (a.side !== ctx.holder.side && a.gone && a.statuses.some((s) => s.id === 'burn')) jump(ctx, ctx.holder, a)
  },
  onDeath: (ctx) => {
    if (!ctx.hook || ctx.hook.sourceId === ctx.holder.id) return
    const owner = ctx.state.actors.find((a) => a.id === ctx.hook?.sourceId)
    if (owner && ctx.fx.isActive(owner)) jump(ctx, owner, ctx.holder)
  },
}
export default handler
