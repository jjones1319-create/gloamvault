import { clamp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

/**
 * Flint & Tinder, combat use (Ranger, Pathfinder I; docs/classes/ranger.md §4.3): for this fight the monsters get
 * none of the dark light bands' bonuses. Reading: the cast sets the flag `negateDarkBand` and puts a hook on every
 * enemy whose `accuracyBonus` cancels the current band's monster Accuracy bonus (the band is read from the tuning
 * at each hit). The band's monster damage bonus is not applied by the fight yet, so there is nothing to cancel;
 * when it is, the flag is there to read. Enemies that spawn later are not covered.
 */
function bandAccuracy(ctx: HookContext): number {
  const bands = ctx.t.exploration.light.bands
  const l = clamp(ctx.state.light, 0, ctx.t.exploration.light.max)
  const band = bands.find((b) => l >= b.min && l <= b.max) ?? bands[bands.length - 1]
  return band?.monsterAccuracy ?? 0
}

const handler: CustomHandler = {
  apply: (ctx) => {
    ctx.state.flags.negateDarkBand = true
    for (const e of ctx.fx.enemiesOf(ctx.holder)) ctx.fx.installHook(e, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId })
    ctx.fx.log('light', `${ctx.holder.name} lights the room; the dark favours nobody`, { actorId: ctx.holder.id })
  },
  accuracyBonus: (ctx) => (ctx.holder.side === 'enemy' ? -bandAccuracy(ctx) : 0),
}
export default handler
