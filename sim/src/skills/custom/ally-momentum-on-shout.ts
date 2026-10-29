import type { CustomHandler } from './types.ts'

/**
 * Ironlung (Warden, Warcry IV passive; docs/classes/warden.md §4.3): every shout — an active of the owner's school
 * (Warcry) — gives every other standing ally `amount` Momentum (10; Mastery 15). The holder's own shout Momentum is
 * Loud Voice's Mastery (`momentum-on-shout`); this line is the party's share.
 */
const handler: CustomHandler = {
  onSkillUsed: (ctx, skill) => {
    const school = ctx.content.skills.get(ctx.hook?.sourceSkillId ?? ctx.sourceId ?? '')?.school
    if (skill.type !== 'active' || skill.isUltimate || !school || skill.school !== school) return
    const amount = ctx.line.amount ?? 0
    if (amount <= 0) return
    for (const ally of ctx.fx.alliesOf(ctx.holder)) if (ally !== ctx.holder) ctx.fx.gainMomentum(ally, amount)
  },
}
export default handler
