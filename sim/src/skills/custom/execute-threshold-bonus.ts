import type { SkillDef } from '../../types/content.ts'
import type { CustomHandler, HookContext } from './types.ts'

/**
 * Death's Ledger (Blade, Executioner IV passive; docs/classes/blade.md §4.2): every execute threshold of the owner's
 * school (Executioner) is `amount` points higher (+10; Mastery +15), and a crit against a target below the skill's
 * threshold deals +`percent` Crit Damage (+50). Reading: an execute threshold is the `percent` of an
 * `execute-multiplier-below-hp` or `status-below-hp` line on an Executioner active (Execute 30%, Guillotine 40%, Skull
 * Splitter's Mastery 40%); `modifyLine` raises it as the line resolves. For the crit, the hook reads the chosen
 * target's HP as the skill's damage line resolves (before the hit) and, under the raised threshold, holds a Crit
 * Damage StatModifier (sourceId `execute-threshold-bonus:<holder id>`) on the holder until the skill resolves.
 */
const EXECUTE_HOOKS: ReadonlySet<string> = new Set(['execute-multiplier-below-hp', 'status-below-hp'])

function schoolOf(ctx: HookContext): string | null {
  return ctx.content.skills.get(ctx.hook?.sourceSkillId ?? ctx.sourceId ?? '')?.school ?? null
}

/** The skill's own execute threshold (the highest one it names), or null when it has none. */
function thresholdOf(skill: SkillDef, rank: number): number | null {
  const lines = rank >= 10 ? [...skill.mastery.effects, ...skill.effects] : [...skill.effects]
  let best: number | null = null
  for (const l of lines) if (l.kind === 'custom' && EXECUTE_HOOKS.has(l.customId ?? '') && l.percent !== undefined) best = Math.max(best ?? 0, l.percent)
  return best
}

function dropCritBonus(ctx: HookContext): void {
  const src = `execute-threshold-bonus:${ctx.holder.id}`
  ctx.holder.modifiers = ctx.holder.modifiers.filter((m) => m.sourceId !== src)
}

const handler: CustomHandler = {
  modifyLine: (ctx, line, source, chosen) => {
    const school = schoolOf(ctx)
    if (source.kind !== 'skill' || !school) return null
    const skill = ctx.content.skills.get(source.id)
    if (!skill || skill.school !== school || skill.type !== 'active') return null
    const bonus = ctx.line.amount ?? 10
    if (line.kind === 'custom' && EXECUTE_HOOKS.has(line.customId ?? '') && line.percent !== undefined) return { ...line, percent: line.percent + bonus }
    if (line.kind === 'damage' && chosen && ctx.fx.isActive(chosen)) {
      const base = thresholdOf(skill, ctx.holder.hero?.ranks[skill.id] ?? 1)
      const src = `execute-threshold-bonus:${ctx.holder.id}`
      if (base !== null && chosen.hp * 100 < chosen.maxHp * (base + bonus) && !ctx.holder.modifiers.some((m) => m.sourceId === src)) {
        ctx.holder.modifiers.push({ stat: 'critDamage', amount: ctx.line.percent ?? 50, percent: 0, turnsLeft: 9999, sourceId: src })
      }
    }
    return null
  },
  onSkillUsed: (ctx) => dropCritBonus(ctx),
  onTurnStart: (ctx) => dropCritBonus(ctx),
}
export default handler
