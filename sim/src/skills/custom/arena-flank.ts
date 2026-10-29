import { lightBand } from '../../light.ts'
import type { CustomHandler } from './types.ts'

/**
 * Vexa's Cutpurses flank in the dark (07 §2.8: "below Shadowy her Cutpurses flank (+15% to hit the back row)").
 * Installed by sim/src/arena.ts on the monsters a `flank` rule names; in the rule's light bands their blows on a
 * back-row hero gain `params.accuracy` points (arena.ts also lets them reach that row).
 */
const handler: CustomHandler = {
  accuracyBonus: (ctx, target) => {
    const arena = ctx.state.arena
    const m = ctx.holder.monster
    if (!arena || !m || target.row !== 'back') return 0
    const band = lightBand(ctx.t, ctx.state.light).id
    let pts = 0
    for (const r of ctx.content.monsters.get(arena.bossId)?.boss?.arena?.rules ?? []) {
      if (r.kind !== 'flank' || !(r.monsters ?? []).includes(m.monsterId) || !(r.bands ?? []).includes(band as never)) continue
      pts += typeof r.params?.accuracy === 'number' ? r.params.accuracy : 0
    }
    return pts
  },
}
export default handler
