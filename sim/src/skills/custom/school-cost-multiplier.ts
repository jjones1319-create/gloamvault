import type { CustomHandler } from './types.ts'

/** Loud Voice (Warden, Warcry I) and Quick Hands (Ranger, Trapper I): actives of the owner's school cost `percent` (−20 / −10) more or less. */
const handler: CustomHandler = {
  costPercent: (ctx, skill) => {
    const school = ctx.content.skills.get(ctx.hook?.sourceSkillId ?? ctx.sourceId ?? '')?.school
    return school && skill.school === school ? (ctx.line.percent ?? 0) : 0
  },
}
export default handler
