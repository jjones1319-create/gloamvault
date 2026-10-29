import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/**
 * Rebirth (Mender, Benediction IV) and Miracle (Mender, Benediction V; docs/classes/mender.md §4.1; D-089 "a powerful
 * enough healer" raises the dead in a fight): raises fallen allies — past the 3-turn downed window — of the caster's
 * side at `percent`% HP. `amount` caps the raises per fight for this caster and skill (Rebirth 1, Mastery 2); with no
 * `amount` every fallen ally stands (Miracle, itself once per fight). The line targets the caster (one call per cast)
 * and picks: the action's chosen target when it has fallen, then heroes before pets, in the fight's order. Each raise
 * is the DSL's own `revive` line (effects.ts): the actor leaves the fallen state, stands at the percent, its energy
 * reset to 0, so it is back on the timeline; it keeps the statuses it fell with, as a Breath of Life revive does.
 */
function chosenTargetId(ctx: HookContext): string | null {
  const log = ctx.state.log
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]
    if (e && e.kind === 'action' && e.actorId === ctx.holder.id) return e.targetId ?? null
  }
  return null
}

const handler: CustomHandler = {
  apply: (ctx) => {
    const holder = ctx.holder
    const chosen = chosenTargetId(ctx)
    const fallen = ctx.state.actors
      .filter((a: Actor) => a.side === holder.side && a.fallen && !a.gone && !a.fled && (a.kind === 'hero' || a.kind === 'pet'))
      .sort((a, b) => Number(b.id === chosen) - Number(a.id === chosen) || Number(b.kind === 'hero') - Number(a.kind === 'hero'))
    if (fallen.length === 0) return
    const key = `revive-fallen:${holder.id}:${ctx.sourceId ?? 'skill'}`
    const used = typeof ctx.state.flags[key] === 'number' ? Number(ctx.state.flags[key]) : 0
    const limit = ctx.line.amount === undefined ? Infinity : Math.max(0, Math.round(ctx.line.amount))
    const room = Math.max(0, limit - used)
    const label = ctx.content.skills.get(ctx.sourceId ?? '')?.name ?? 'revive'
    if (room <= 0) {
      ctx.fx.log('reviveSpent', `${label} cannot reach the fallen again this fight`, { actorId: holder.id })
      return
    }
    const raise = fallen.slice(0, room === Infinity ? fallen.length : room)
    for (const a of raise) ctx.fx.applyLine(holder, { kind: 'revive', percent: ctx.line.percent ?? 50 }, 'fallenAlly', a, { kind: 'skill', id: ctx.sourceId ?? 'revive', label, neverMisses: true, isMelee: false })
    if (limit !== Infinity) ctx.state.flags[key] = used + raise.length
  },
}
export default handler
