import type { CustomHandler } from './types.ts'

/**
 * Legend's Voice (Warden, Warcry V passive; docs/classes/warden.md §4.3): Momentum gain +`percent`% for the whole
 * party (25; Mastery 40) while the holder stands. Reading: the other heroes take it as an aura (`auraStatPercent` on
 * `momentumGain`, which statOf reads for every ally but the holder); the holder takes it as a StatModifier added at
 * the fight's start (sourceId `party-momentum-gain-percent:<holder id>`), as a hook cannot aura itself.
 */
const handler: CustomHandler = {
  onFightStart: (ctx) => {
    const holder = ctx.holder
    const src = `party-momentum-gain-percent:${holder.id}`
    if (!holder.modifiers.some((m) => m.sourceId === src)) holder.modifiers.push({ stat: 'momentumGain', amount: 0, percent: ctx.line.percent ?? 0, turnsLeft: 9999, sourceId: src })
  },
  auraStatPercent: (ctx, ally, stat) => (stat === 'momentumGain' && ally.kind === 'hero' ? (ctx.line.percent ?? 0) : 0),
}
export default handler
