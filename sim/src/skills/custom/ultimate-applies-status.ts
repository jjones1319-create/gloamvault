import type { CustomHandler } from './types.ts'

/**
 * The Cinderborn Talisman (08 §7): "your Ultimate applies Burn". The hook sits on the wearer (hero.ts). After the
 * holder resolves its Ultimate, every enemy the Ultimate hit this action (its damage events since the holder's
 * action marker) gains the line's `status`; a Burn ticks a share of that hit (03 §3.5), so its magnitude is the hit.
 */
const handler: CustomHandler = {
  onSkillUsed: (ctx, skill) => {
    if (!skill.isUltimate) return
    const status = ctx.line.status ?? 'burn'
    const log = ctx.state.log
    const hit = new Map<string, number>()
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]
      if (!e) continue
      if (e.kind === 'action' && e.actorId === ctx.holder.id) break
      if (e.kind === 'damage' && e.actorId === ctx.holder.id && e.targetId && (e.amount ?? 0) > 0 && !hit.has(e.targetId)) hit.set(e.targetId, e.amount ?? 0)
    }
    for (const enemy of ctx.fx.enemiesOf(ctx.holder)) {
      const dealt = hit.get(enemy.id)
      if (dealt === undefined || !ctx.fx.isActive(enemy)) continue
      ctx.fx.applyStatus(enemy, status === 'burn' ? { status, magnitude: dealt } : { status }, ctx.holder.id)
    }
  },
}
export default handler
