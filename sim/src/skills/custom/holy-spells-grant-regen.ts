import type { Effect } from '../../types/content.ts'
import type { CustomHandler } from './types.ts'

/** A Holy spell: a skill with a Holy damage line or a heal line (a Mender's heals are Holy, 03 §3.4). */
function holy(lines: readonly Effect[]): boolean {
  return lines.some((l) => (l.kind === 'damage' && l.damageType === 'holy') || l.kind === 'heal')
}

/**
 * Lanternkeeper's Habit, four pieces (08 §6): "Holy spells grant Regen 2 rounds". The hook sits on the wearer
 * (hero.ts). Reading (Phase 7): after the holder resolves a Holy skill, the lowest-HP ally standing (the holder
 * included) gains the line's `status` (Regen) for `duration` (2) turns at `percent` (5% of max HP, the Candle of the
 * Crypt's) — 08 names neither the target nor the size.
 */
const handler: CustomHandler = {
  onSkillUsed: (ctx, skill) => {
    if (!holy(skill.effects)) return
    let low: typeof ctx.holder | null = null
    for (const a of ctx.fx.alliesOf(ctx.holder)) {
      if (!ctx.fx.isActive(a)) continue
      if (low === null || a.hp * low.maxHp < low.hp * a.maxHp) low = a
    }
    if (low === null) return
    const r = ctx.fx.applyStatus(low, { status: ctx.line.status ?? 'regen', duration: ctx.line.duration ?? 2, magnitude: ctx.line.percent ?? 5 }, ctx.holder.id)
    if (r === 'applied') ctx.fx.log('setBonus', `The lantern's warmth settles on ${low.name}`, { actorId: ctx.holder.id, targetId: low.id })
  },
}
export default handler
