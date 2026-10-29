import type { CustomHandler } from './types.ts'

/**
 * Legend's Voice (Warden, Warcry V passive; docs/classes/warden.md §4.3): "your Ultimate also Weakens every enemy 2
 * turns" — after the holder resolves its Ultimate, every standing enemy (both rows, hit or not) gains `status` for
 * `duration` turns. Unlike the Cinderborn Talisman's `ultimate-applies-status` (the enemies the Ultimate hit), this
 * line reaches the whole enemy side, as the sheet says "every enemy".
 */
const handler: CustomHandler = {
  onSkillUsed: (ctx, skill) => {
    if (!skill.isUltimate || !ctx.line.status) return
    for (const enemy of ctx.fx.enemiesOf(ctx.holder)) ctx.fx.applyStatus(enemy, { status: ctx.line.status, duration: ctx.line.duration }, ctx.holder.id)
  },
}
export default handler
