import { lightBand } from '../../light.ts'
import type { ArenaRuleDef } from '../../types/content.ts'
import type { CustomHandler, HookContext } from './types.ts'

/**
 * A boss's arena modifiers (07 §2.8, 06 §3.4; installed on the boss by sim/src/arena.ts, never named in content).
 * Reads the boss's `arena.rules` and the fight's light:
 * - `lightBand` with `params.shadowPercent`: in those bands his Shadow blows scale by it (Radiant: −25, "×0.75");
 * - `lightBand` with `params.critBonus`: in those bands the listed attacks crit that many points more (Dark or Pitch:
 *   the Hollow Gaze +20);
 * - `pull` with `params.bladeAttack`: a front-row hero the tide pulled takes his next Blade (`bladeAttack`, comma-joined ids) at +`bladePercent` (×1.5),
 *   once (`state.arena.flags['pulled:<id>']`, set by the pull).
 * The attack resolving is the holder's last `action` event's `data.attackId`.
 */
function rules(ctx: HookContext): readonly ArenaRuleDef[] {
  const arena = ctx.state.arena
  if (!arena || arena.bossActorId !== ctx.holder.id) return []
  return ctx.content.monsters.get(arena.bossId)?.boss?.arena?.rules ?? []
}

function currentAttack(ctx: HookContext): string | null {
  const log = ctx.state.log
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]!
    if (e.kind === 'action' && e.actorId === ctx.holder.id) return typeof e.data?.attackId === 'string' ? e.data.attackId : null
  }
  return null
}

function inBand(ctx: HookContext, r: ArenaRuleDef): boolean {
  const arena = ctx.state.arena
  if (!arena || (r.phases && !r.phases.includes(arena.phase))) return false
  return (r.bands ?? []).includes(lightBand(ctx.t, ctx.state.light).id as never)
}

const handler: CustomHandler = {
  outgoingDamagePercent: (ctx, target, incoming) => {
    const arena = ctx.state.arena
    if (!arena) return 0
    let pct = 0
    for (const r of rules(ctx)) {
      if (r.kind === 'lightBand' && typeof r.params?.shadowPercent === 'number' && incoming.damageType === 'shadow' && inBand(ctx, r)) pct += r.params.shadowPercent
      if (r.kind === 'pull' && typeof r.params?.bladeAttack === 'string' && arena.flags[`pulled:${target.id}`] === true && r.params.bladeAttack.split(',').includes(currentAttack(ctx) ?? '')) {
        pct += typeof r.params.bladePercent === 'number' ? r.params.bladePercent : 50
        delete arena.flags[`pulled:${target.id}`]
      }
    }
    return pct
  },
  critRateBonus: (ctx) => {
    let pts = 0
    for (const r of rules(ctx)) {
      if (r.kind !== 'lightBand' || typeof r.params?.critBonus !== 'number' || !inBand(ctx, r)) continue
      const attack = currentAttack(ctx)
      if (!r.attacks || (attack !== null && r.attacks.includes(attack))) pts += r.params.critBonus
    }
    return pts
  },
}
export default handler
