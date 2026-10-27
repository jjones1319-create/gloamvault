import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']

/**
 * The Captain's grin-mask breaks (06 §3.1 part-break, Blunt 6% HP): "she loses Fear immunity and Riposte". Runs
 * with the boss as holder and target: 'fear' leaves her `statusImmune`, every "riposte" attack leaves `attackIds`
 * (and is stripped again at each turn start, since her phase 2 lists it), any armed `answer-next-melee-hit` hook
 * is removed and `state.flags['noRiposte:<id>']` stays set so a later Riposte line arms nothing.
 * Reading: fear.json also lists bosses under `immunityRoles`, a per-record rule statuses.ts applies by role; the
 * sim has no joint to lift a role immunity for one actor, so she stays Fear-proof by role until that joint exists
 * (`state.flags['fearable:<id>']` is set for it). 06's second break (the coin) has no limb slot in the schema.
 */
const RIPOSTE = /riposte/i

function stripRiposte(holder: Actor): void {
  const m = holder.monster
  if (!m) return
  const hit = (id: string) => {
    const a = m.attacks.find((x) => x.id === id)
    return RIPOSTE.test(id) || (a !== undefined && RIPOSTE.test(a.name))
  }
  if (m.attackIds.some(hit)) m.attackIds = m.attackIds.filter((id) => !hit(id))
  if (holder.hooks.some((h) => h.customId === 'answer-next-melee-hit')) holder.hooks = holder.hooks.filter((h) => h.customId !== 'answer-next-melee-hit')
}

const handler: CustomHandler = {
  apply: (ctx) => {
    const boss = ctx.holder
    const m = boss.monster
    if (!m) return
    m.statusImmune = m.statusImmune.filter((s) => s !== 'fear')
    ctx.state.flags[`noRiposte:${boss.id}`] = true
    ctx.state.flags[`fearable:${boss.id}`] = true
    stripRiposte(boss)
    ctx.fx.installHook(boss, ctx.line, boss.id, { sourceSkillId: ctx.sourceId })
    ctx.fx.log('partBreakEffect', `${boss.name}'s grin-mask cracks: no more ripostes, and fear can reach her`, { actorId: boss.id })
  },
  onTurnStart: (ctx) => {
    stripRiposte(ctx.holder)
  },
}
export default handler
