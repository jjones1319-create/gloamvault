import type { CustomHandler } from './types.ts'

/**
 * Blink Step (Arcanist, Arcana II; docs/classes/arcanist.md §4.3): the skill's row swap succeeds under Root, Web and
 * Grab. Reading: the sim's `rowSwap` *line* never consults those statuses (only the Swap-row command does, through
 * canSwapRow), so the swap that follows this line already succeeds; the hook has nothing to override and records
 * the blink in the log when the target is held. The hold itself is not broken.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const who = target ?? ctx.holder
    const held = who.statuses.filter((s) => s.id === 'root' || s.id === 'web' || s.id === 'grab').map((s) => s.id)
    if (held.length === 0) return
    ctx.fx.log('blink', `${who.name} blinks despite ${held.join(' and ')}`, { actorId: ctx.holder.id, targetId: who.id })
  },
}
export default handler
