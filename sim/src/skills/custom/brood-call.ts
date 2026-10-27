import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']
type HookInstance = NonNullable<HookContext['hook']>

/**
 * Brood Call (Broodmother, 06 §3.1): "spawns 2 Cellar Spider (at ×0.5 HP) in the front". The two summons are the
 * attack's DSL `summon` lines; the fight spawns each as its line resolves, so by the time this rider (the attack's
 * last line) runs both spiderlings already stand. `apply` moves every summon of the holder it has not seen to the
 * front row at `percent` of its HP and remembers the ids in `data.scaled`; the same scaling runs again from
 * `modifyWeight` (the fight spends the attack's weight right after its lines) as a guard against a content order
 * that puts the rider before the summons. Reading: "at 50% HP" is current HP, max HP unchanged.
 */
function scaleFresh(ctx: HookContext, mother: Actor, hook: HookInstance | null): void {
  const pct = ctx.line.percent ?? 50
  const seen = String(hook?.data.scaled ?? '')
    .split(',')
    .filter((s) => s.length > 0)
  for (const a of ctx.state.actors) {
    if (a.side !== mother.side || a.monster?.summonedBy !== mother.id || seen.includes(a.id) || !ctx.fx.isActive(a)) continue
    a.hp = Math.max(1, roundHalfUp((a.maxHp * pct) / 100))
    a.row = 'front'
    seen.push(a.id)
    ctx.fx.log('brood', `${a.name} scuttles into the front row at ${pct}% HP`, { actorId: mother.id, targetId: a.id, amount: a.hp })
  }
  if (hook) hook.data.scaled = seen.join(',')
}

const handler: CustomHandler = {
  apply: (ctx) => {
    const mother = ctx.holder
    const hook = mother.hooks.find((h) => h.customId === 'brood-call' && h.sourceId === mother.id) ?? ctx.fx.installHook(mother, ctx.line, mother.id, { sourceSkillId: ctx.sourceId, data: { scaled: '' } })
    scaleFresh(ctx, mother, hook)
  },
  modifyWeight: (ctx, weight) => {
    scaleFresh(ctx, ctx.holder, ctx.hook)
    return weight
  },
}
export default handler
