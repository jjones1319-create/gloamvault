import type { CustomHandler } from './types.ts'

/**
 * Berserk (Blade, Bloodletter III; docs/classes/blade.md §4.3): for `duration` turns the holder cannot Guard.
 * Stub: the fight has no joint on the Guard action (`canGuard(ctx)` is needed; the AI's Guard fallback and
 * `legalFightActions` would read it). The line installs a marker hook for `duration` turns so the client and a later
 * joint can see the state, and logs `hookStub` once per fight.
 */
export const STUB = true

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? 3 })
    const key = 'stub:cannot-guard'
    if (ctx.state.flags[key]) return
    ctx.state.flags[key] = true
    ctx.fx.log('hookStub', 'cannot-guard: Berserk does not yet stop the Guard action', { actorId: holder.id })
  },
}
export default handler
