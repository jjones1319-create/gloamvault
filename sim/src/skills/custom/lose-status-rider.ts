import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler } from './types.ts'

/**
 * A biting part breaks (06 §3.2: the Ghoul's jaw → "Gnaw ×0.5, no Bleed"; 06 §3.3: the Drowned Thrall's jaw → "Chill
 * lost"). Runs with the monster as holder and target and stays on it as a hook: its applyStatus lines of `status` are
 * skipped for the rest of the fight, and with `percent` the damage of every attack that carried that status is scaled
 * to `percent` (the Gnaw at 50). The monster's other attacks are untouched.
 */
const handler: CustomHandler = {
  apply: (ctx) => {
    ctx.fx.installHook(ctx.holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId })
    ctx.fx.log('partBreakEffect', `${ctx.holder.name} loses its ${ctx.line.status ?? 'rider'}`, { actorId: ctx.holder.id })
  },
  modifyLine: (ctx, line, source) => {
    const status = ctx.line.status
    if (!status) return null
    if (line.kind === 'applyStatus' && line.status === status) return 'skip'
    const pct = ctx.line.percent
    if (line.kind !== 'damage' || pct === undefined || source.kind !== 'attack') return null
    const attack = ctx.holder.monster?.attacks.find((a) => a.id === source.id)
    if (!attack?.effects.some((l) => l.kind === 'applyStatus' && l.status === status)) return null
    return { ...line, multiplier: roundHalfUp((line.multiplier ?? 1) * pct) / 100 }
  },
}
export default handler
