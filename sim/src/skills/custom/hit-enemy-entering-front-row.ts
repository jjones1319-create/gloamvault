import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

/**
 * Spearwall (Warden, Vanguard III; docs/classes/warden.md §4.2): every enemy that moves into the front row takes a
 * free `multiplier` × Attack hit of `damageType` from the Warden.
 * Reading: the sim has no row-change joint, so the Warden's passive keeps a tracker hook (data.tracker) on every
 * enemy, refreshed at the fight's start and at the Warden's turn starts for late spawns; each tracker remembers the
 * enemy's row and, at that enemy's turn start, strikes when it now stands in the front row and did not before. The
 * free hit cannot miss, can crit, is never answered (`isMelee: false`) and is flagged `noCounter` for Punish.
 */
const ID = 'hit-enemy-entering-front-row'

function ensureTrackers(ctx: HookContext): void {
  const warden = ctx.holder
  for (const e of ctx.fx.enemiesOf(warden)) {
    if (e.hooks.some((h) => h.customId === ID && h.sourceId === warden.id)) continue
    ctx.fx.installHook(e, ctx.line, warden.id, { sourceSkillId: ctx.hook?.sourceSkillId ?? ctx.sourceId, data: { tracker: true, row: e.row } })
  }
}

function check(ctx: HookContext): void {
  const hook = ctx.hook
  if (!hook) return
  const enemy = ctx.holder
  const was = hook.data.row
  hook.data.row = enemy.row
  if (was === 'front' || enemy.row !== 'front') return
  const warden = ctx.state.actors.find((a) => a.id === hook.sourceId)
  if (!warden || !ctx.fx.isActive(warden) || !ctx.fx.isActive(enemy)) return
  const type = ctx.line.damageType ?? 'pierce'
  const scale = 100 + (ctx.line.scalesWith ? Math.max(0, (warden.attributes[ctx.line.scalesWith] ?? 10) - 10) * 2 : 0)
  const amount = roundHalfUp((ctx.fx.attackFor(warden, type) * (ctx.line.multiplier ?? 1) * scale) / 100)
  if (amount <= 0) return
  const flag = `noCounter:${warden.id}`
  ctx.state.flags[flag] = true
  ctx.fx.strike(warden, enemy, { amount, damageType: type, label: 'spearwall', canMiss: false, canCrit: true, isMelee: false })
  delete ctx.state.flags[flag]
}

const handler: CustomHandler = {
  onFightStart: (ctx) => {
    if (ctx.hook && !ctx.hook.data.tracker) ensureTrackers(ctx)
  },
  onTurnStart: (ctx) => {
    if (!ctx.hook) return
    if (ctx.hook.data.tracker) check(ctx)
    else ensureTrackers(ctx)
  },
}
export default handler
