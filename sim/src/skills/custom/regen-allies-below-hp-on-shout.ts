import type { CustomHandler } from './types.ts'

/**
 * Second Wind (Warden, Warcry II; docs/classes/warden.md §4.3): after every shout (an active of the owner's
 * school) allies under `amount`% HP gain Regen `percent`% of max HP for `duration` turns.
 */
const handler: CustomHandler = {
  onSkillUsed: (ctx, skill) => {
    const school = ctx.content.skills.get(ctx.hook?.sourceSkillId ?? ctx.sourceId ?? '')?.school
    if (skill.type !== 'active' || !school || skill.school !== school) return
    const threshold = ctx.line.amount ?? 50
    for (const ally of ctx.fx.alliesOf(ctx.holder)) {
      if (ally.hp * 100 >= ally.maxHp * threshold) continue
      const r = ctx.fx.applyStatus(ally, { status: ctx.line.status ?? 'regen', duration: ctx.line.duration, magnitude: ctx.line.percent }, ctx.holder.id)
      if (r === 'applied') ctx.fx.log('secondWind', `${ally.name} draws a second wind`, { actorId: ctx.holder.id, targetId: ally.id })
    }
  },
}
export default handler
