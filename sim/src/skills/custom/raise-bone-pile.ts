import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/**
 * Raise (Crypt Sexton, 06 §3.2): "raises one Skeleton Footman from a bone pile (max 3 raises per fight); tell: his
 * bell rings the turn before". A bone pile is an ally of `summonId` killed this fight ("a killed Footman leaves a bone
 * pile that the Sexton can raise once"). The attack's DSL `summon` line has already stood the Footman up when this
 * rider (its last line) runs: with a pile left and fewer than `amount` raises by this Sexton, the pile is spent
 * (`state.flags['bonePile:<id>']`, so two Sextons never raise one pile twice) and the raised Footman takes the front
 * row; with none, the bell rings over no bones and the summoned Footman is taken back (gone and fled: no loot, no XP).
 */
function freshRaised(ctx: HookContext, sexton: Actor, id: string): Actor | null {
  const seen = String(ctx.hook?.data.seen ?? '')
    .split(',')
    .filter((s) => s.length > 0)
  for (let i = ctx.state.actors.length - 1; i >= 0; i--) {
    const a = ctx.state.actors[i]
    if (!a || a.monster?.summonedBy !== sexton.id || a.monster.monsterId !== id || seen.includes(a.id) || !ctx.fx.isActive(a)) continue
    return a
  }
  return null
}

const handler: CustomHandler = {
  apply: (ctx) => {
    const sexton = ctx.holder
    const id = ctx.line.summonId ?? 'skeleton-footman'
    const cap = ctx.line.amount ?? 3
    const hook = sexton.hooks.find((h) => h.customId === 'raise-bone-pile' && h.sourceId === sexton.id) ?? ctx.fx.installHook(sexton, ctx.line, sexton.id, { sourceSkillId: ctx.sourceId, data: { raised: 0, seen: '' } })
    const hc: HookContext = { ...ctx, hook }
    const raised = freshRaised(hc, sexton, id)
    if (!raised) return
    hook.data.seen = [String(hook.data.seen ?? ''), raised.id].filter((s) => s.length > 0).join(',')
    const count = Number(hook.data.raised ?? 0)
    const pile = ctx.state.actors.find((a) => a.side === sexton.side && a.gone && !a.fled && a.monster?.monsterId === id && !ctx.state.flags[`bonePile:${a.id}`])
    if (!pile || count >= cap) {
      raised.gone = true
      raised.fled = true
      ctx.fx.log('raise', `${sexton.name}'s bell rings over ${pile ? 'spent bones' : 'no bones'}`, { actorId: sexton.id, data: { raised: count } })
      return
    }
    ctx.state.flags[`bonePile:${pile.id}`] = true
    hook.data.raised = count + 1
    raised.row = 'front'
    ctx.fx.log('raise', `${sexton.name} raises ${raised.name} from the bones of ${pile.name}`, { actorId: sexton.id, targetId: raised.id, data: { raised: count + 1 } })
  },
}
export default handler
