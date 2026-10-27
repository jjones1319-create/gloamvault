import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/**
 * Reel (Cellar Weaver, 06 §3.1): "pulls the Webbed hero to the front row". The chosen enemy when it is Webbed,
 * else the first Webbed enemy, moves to the front row; a species immune to forced moves (05) stays put, as does a
 * hero already in front. Nothing to reel is logged, not an error.
 */
function webbed(a: Actor): boolean {
  return a.statuses.some((s) => s.id === 'web')
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const weaver = ctx.holder
    const victim = target && target.side !== weaver.side && webbed(target) ? target : (ctx.fx.enemiesOf(weaver).find(webbed) ?? null)
    if (!victim) {
      ctx.fx.log('reel', `${weaver.name} reels in an empty thread`, { actorId: weaver.id })
      return
    }
    if (victim.hero?.species.forcedRowMoveImmune) {
      ctx.fx.log('reel', `${victim.name} cannot be pulled`, { actorId: weaver.id, targetId: victim.id })
      return
    }
    if (victim.row === 'front') {
      ctx.fx.log('reel', `${victim.name} is already in the front row`, { actorId: weaver.id, targetId: victim.id })
      return
    }
    victim.row = 'front'
    ctx.fx.log('reel', `${weaver.name} reels ${victim.name} into the front row`, { actorId: weaver.id, targetId: victim.id, data: { row: 'front' } })
  },
}
export default handler
