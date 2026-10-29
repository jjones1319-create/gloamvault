import type { CustomHandler } from './types.ts'

/**
 * Coin Flip (Captain Vexa Marrow, 06 §3.1): "her next attack is a guaranteed crit; tell: the flip, and a star on
 * her strip icon — Guard it". The line installs a hook on the holder; `forceCrit` answers once on the next damage
 * roll that can crit and removes the hook. The flip is itself the tell for that blow (not a wind-up), so it logs the
 * fight's tell event (`{ kind: 'tell', data: { hint, cue, source, ref, first, boss } }`, sim/src/arena.ts) with the
 * attack's two-word hint ("Coin flipped", D-099) and keeps `data.tell` for the HUD's star.
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    const who = target ?? ctx.holder
    ctx.fx.installHook(who, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId })
    const attack = ctx.holder.monster?.attacks.find((a) => a.id === ctx.sourceId)
    const hint = attack?.hint ?? 'Coin flipped'
    const arena = ctx.state.arena ?? null
    const first = arena ? !arena.hintsShown.includes(hint) : !ctx.state.log.some((e) => e.kind === 'tell' && e.data?.hint === hint)
    if (arena) {
      if (first) arena.hintsShown.push(hint)
      arena.stats.tells += 1
    }
    ctx.fx.log('tell', `${who.name} flips a coin: the next blow lands true`, {
      actorId: who.id,
      data: { tell: 'crit', hint, cue: 'the flip, and a star on her strip icon — Guard it', source: 'attack', ref: ctx.sourceId ?? 'coin-flip', first, boss: arena?.bossId ?? null },
    })
  },
  forceCrit: (ctx) => {
    const hook = ctx.hook
    if (!hook) return false
    ctx.fx.removeHook(ctx.holder, hook)
    return true
  },
}
export default handler
