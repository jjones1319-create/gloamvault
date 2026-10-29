import type { CustomHandler } from './types.ts'

/**
 * Miracle (Mender, Benediction V; docs/classes/mender.md §4.1): "Once per fight." The skill's first line marks the
 * fight (`state.flags`, per caster and skill); a second cast in the same fight installs a hook that skips the rest of
 * the skill's lines (`modifyLine` → 'skip') and goes when the skill resolves, so the second cast does nothing but say so.
 * The pool was already paid. fight.ts reads the same flag (idleSkillReason): the hero AI and the fight HUD do not offer
 * the skill again in this fight, so the second cast happens only from an old command.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    const key = `once:${ctx.sourceId ?? 'skill'}:${ctx.holder.id}`
    if (ctx.state.flags[key] !== true) {
      ctx.state.flags[key] = true
      return
    }
    ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId })
    const label = ctx.content.skills.get(ctx.sourceId ?? '')?.name ?? 'it'
    ctx.fx.log('oncePerFight', `${label} has already been called on this fight; nothing answers`, { actorId: ctx.holder.id })
  },
  modifyLine: (ctx, _line, source) => (ctx.hook && source.id === ctx.hook.sourceSkillId ? 'skip' : null),
  onSkillUsed: (ctx, skill) => {
    if (ctx.hook && skill.id === ctx.hook.sourceSkillId) ctx.fx.removeHook(ctx.holder, ctx.hook)
  },
}
export default handler
