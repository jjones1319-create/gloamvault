import { roundHalfUp } from '../../stats.ts'
import type { Status } from '../../types/enums.ts'
import type { CustomHandler, HookContext } from './types.ts'

/**
 * Intimidating (Orc trait, 05 §3): durations of effects the holder applies from the Warden's Warcry school are
 * ×(100 + `percent`)%; Fear is covered by the species rule knob (appliedDurationMultiplier) and is left out here.
 * To be installed by hero.ts as a hook (sourceId = the species id). Reading: the duration joint names the status
 * and the target but not the skill or the line's duration, so the bonus applies to a Warden holder for the statuses
 * the Warcry school can apply (read from the Warden's Warcry skills in content) and is `percent` of the status's
 * default duration, rounded half up (a 3-turn default gains +1; a 2-turn default gains nothing, as 2 × 1.2 → 2).
 */
function warcryStatuses(ctx: HookContext): Set<Status> {
  const out = new Set<Status>()
  for (const skill of ctx.content.skillsByClass.get('warden') ?? []) {
    if (skill.school !== 'warcry') continue
    for (const line of [...skill.effects, ...skill.mastery.effects]) {
      if (line.kind === 'taunt') out.add('taunt')
      else if (line.kind === 'shield') out.add('shield')
      else if (line.kind === 'applyStatus' && line.status) out.add(line.status)
    }
  }
  out.delete('fear')
  return out
}

const handler: CustomHandler = {
  statusDurationBonus: (ctx, status) => {
    if (ctx.holder.hero?.classId !== 'warden' || !warcryStatuses(ctx).has(status)) return 0
    const base = ctx.content.statuses.get(status)?.durationDefault ?? 0
    return roundHalfUp((base * (ctx.line.percent ?? 0)) / 100)
  },
}
export default handler
