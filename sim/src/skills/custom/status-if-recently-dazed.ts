import type { CustomHandler } from './types.ts'

/**
 * Roar of Ruin (Warden, Warcry V; docs/classes/warden.md §4.3): `status` (Stun, `duration` 1) on Dazed targets.
 * Reading: Daze is an instant push on the timeline (03 §3.5: −500 energy) and leaves no status behind, so a target
 * counts as Dazed while the push is still "owed": a Daze landed on it since its own last turn (the log's status
 * events with `data.status` 'daze' after its last action, lost turn or held turn). The line resolves after the roar's
 * hit and needs the target standing.
 */
const TURN_KINDS: ReadonlySet<string> = new Set(['action', 'skip', 'held'])

const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || !ctx.line.status || !ctx.fx.isActive(target)) return
    const log = ctx.state.log
    let dazed = false
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]
      if (!e) continue
      if (TURN_KINDS.has(e.kind) && e.actorId === target.id) break
      if (e.kind === 'status' && e.targetId === target.id && e.data?.status === 'daze') {
        dazed = true
        break
      }
    }
    if (!dazed) return
    ctx.fx.applyStatus(target, { status: ctx.line.status, duration: ctx.line.duration }, ctx.holder.id)
  },
}
export default handler
