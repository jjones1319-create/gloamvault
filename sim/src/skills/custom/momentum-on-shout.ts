import type { CustomHandler } from './types.ts'

/** Loud Voice, Mastery (Warden, Warcry I; docs/classes/warden.md §4.3): every shout (an active of the owner's school) gives the holder `amount` Momentum. */
const handler: CustomHandler = {
  onSkillUsed: (ctx, skill) => {
    const school = ctx.content.skills.get(ctx.hook?.sourceSkillId ?? ctx.sourceId ?? '')?.school
    if (skill.type !== 'active' || !school || skill.school !== school) return
    ctx.fx.gainMomentum(ctx.holder, ctx.line.amount ?? 0)
  },
}
export default handler
