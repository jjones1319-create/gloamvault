import type { CustomHandler } from './types.ts'

/**
 * Wind-up (Blade, Executioner I; docs/classes/blade.md §4.2): no energy push-back from hits until the next skill
 * resolves. Stub: the push-back (fight.ts, a hit on a charging caster) has no joint (`interruptible(ctx)` is
 * needed), and a Stamina Blade never charges in this sim, so the line has nothing to protect yet. Logs `hookStub`
 * once per fight.
 */
export const STUB = true

const handler: CustomHandler = {
  apply: (ctx) => {
    const key = 'stub:next-skill-uninterruptible'
    if (ctx.state.flags[key]) return
    ctx.state.flags[key] = true
    ctx.fx.log('hookStub', 'next-skill-uninterruptible: cast push-back protection is not modelled yet', { actorId: ctx.holder.id })
  },
}
export default handler
