import type { CustomHandler, HookContext } from './types.ts'

/**
 * Voice of Iron (Warden, Warcry III; docs/classes/warden.md §4.3): actives of the owner's school (Warcry) may be
 * used while Silenced. Stub: `canUseSkills` is all-or-nothing and Silence's own hook answers it; a per-skill joint
 * (`canUseSkill(ctx, skill)`) is needed. Logs `hookStub` once per fight.
 */
export const STUB = true

function note(ctx: HookContext): void {
  const key = 'stub:school-ignores-silence'
  if (ctx.state.flags[key]) return
  ctx.state.flags[key] = true
  ctx.fx.log('hookStub', 'school-ignores-silence: shouts through Silence are not modelled yet', { actorId: ctx.holder.id })
}

const handler: CustomHandler = {
  apply: (ctx) => note(ctx),
  onFightStart: (ctx) => note(ctx),
}
export default handler
