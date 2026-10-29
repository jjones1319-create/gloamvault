import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

/**
 * Font of Mana (Arcanist passive, Arcana IV; docs/classes/arcanist.md §4.3): `amount` time(s) per fight (once), when
 * the holder's pool reaches 0 it refills to `percent`% of max (50; Mastery 70). Read after each of the holder's skills
 * (a cast that spent the last point), after each hit it takes (a drain) and at its turn starts.
 */
function check(ctx: HookContext): void {
  const hook = ctx.hook
  const h = ctx.holder
  if (!hook || h.poolKind === null || h.poolMax <= 0 || h.pool > 0 || !ctx.fx.isActive(h)) return
  const used = typeof hook.data.used === 'number' ? hook.data.used : 0
  if (used >= Math.max(1, Math.round(ctx.line.amount ?? 1))) return
  hook.data.used = used + 1
  h.pool = Math.min(h.poolMax, roundHalfUp((h.poolMax * (ctx.line.percent ?? 50)) / 100))
  ctx.fx.log('font', `${h.name}'s ${h.poolKind} wells up again (${h.pool})`, { actorId: h.id, amount: h.pool })
}

const handler: CustomHandler = {
  onSkillUsed: (ctx) => check(ctx),
  afterHit: (ctx) => check(ctx),
  onTurnStart: (ctx) => check(ctx),
}
export default handler
