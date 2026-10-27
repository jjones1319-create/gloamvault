import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/**
 * Hoarfrost (Arcanist, Rime III; docs/classes/arcanist.md §4.2): at fight start every enemy in the row `target`
 * names (enemyFront = the front row, Huge monsters included; allEnemies = both rows) gets `status` for `duration`.
 * The status goes through the line interpreter, so Permafrost's duration bonus and the fight's own log apply.
 */
function cast(ctx: HookContext, owner: Actor): void {
  const status = ctx.line.status
  if (!status) return
  const word = ctx.line.target ?? 'enemyFront'
  const skill = ctx.content.skills.get(ctx.hook?.sourceSkillId ?? ctx.sourceId ?? '')
  const enemies = ctx.fx.enemiesOf(owner).filter((e) => word === 'allEnemies' || e.row === 'front' || e.monster?.size === 'huge')
  if (enemies.length === 0) return
  ctx.fx.log('frost', `${owner.name}'s cold settles over ${word === 'allEnemies' ? 'the enemy' : 'the enemy front row'}`, { actorId: owner.id })
  for (const e of enemies) ctx.fx.applyLine(owner, { kind: 'applyStatus', status, duration: ctx.line.duration, target: 'enemy' }, 'enemy', e, { kind: 'skill', id: skill?.id ?? 'fight-start', label: skill?.name ?? 'fight start', neverMisses: true, isMelee: false })
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, holder.id, { sourceSkillId: ctx.sourceId })
    // Applied before anyone has acted, the line still counts as the fight's start.
    if (ctx.state.actors.every((a) => a.tally.actions === 0)) cast(ctx, holder)
  },
  onFightStart: (ctx) => cast(ctx, ctx.holder),
}
export default handler
