import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/**
 * The Swarm Turns (Giant Rat, 06 §3.1): "when a rat dies the survivors gain Haste (1 turn)". The content writes it
 * as a zero-weight attack that "fires when this rat dies, not as an action"; explore.ts installs the custom lines
 * of such attacks on the monster as hooks at spawn, and `apply` (the rare action pick, or a line on another rat)
 * installs the same hook on every rat ally, so one call arms the swarm. `onDeath` gives `status` (`duration`) to
 * every surviving rat ally — the same template, or any Vermin whose id says "rat".
 */
function ratKin(a: Actor, dead: Actor): boolean {
  const m = a.monster
  if (!m) return false
  return m.monsterId === dead.monster?.monsterId || /rat/i.test(m.monsterId)
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const rat = target ?? ctx.holder
    if (rat.side !== ctx.holder.side || !rat.monster) return
    ctx.fx.installHook(rat, ctx.line, rat.id, { sourceSkillId: ctx.sourceId })
  },
  onDeath: (ctx) => {
    const dead = ctx.holder
    let turned = 0
    for (const ally of ctx.fx.alliesOf(dead)) {
      if (ally === dead || !ratKin(ally, dead)) continue
      if (ctx.fx.applyStatus(ally, { status: ctx.line.status ?? 'haste', duration: ctx.line.duration ?? 1 }, dead.id) === 'applied') turned++
    }
    if (turned > 0) ctx.fx.log('swarm', `The swarm turns: ${turned} rat${turned === 1 ? '' : 's'} surge forward`, { actorId: dead.id, amount: turned })
  },
}
export default handler
