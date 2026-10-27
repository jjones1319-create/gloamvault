import type { CustomHandler } from './types.ts'

/**
 * Gentle Hands (Mender passive, Benediction I; docs/classes/mender.md §4.1), second line: a heal the holder casts
 * on an ally below `percent`% HP costs half. Installed as a hook by hero.ts. Reading: the cost is settled before the
 * target is known, so the check reads the lowest ally in the party (the one a heal would go to) — a healing skill
 * costs half while any ally, the holder included, is under the threshold.
 */
const handler: CustomHandler = {
  costPercent: (ctx, skill) => {
    if (skill.type !== 'active') return 0
    const heals = skill.tags.includes('heal') || skill.effects.some((l) => l.kind === 'heal')
    if (!heals) return 0
    const threshold = ctx.line.percent ?? 30
    const low = ctx.fx.alliesOf(ctx.holder).some((a) => a.hp * 100 < a.maxHp * threshold)
    return low ? -50 : 0
  },
}
export default handler
