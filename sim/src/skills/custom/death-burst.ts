import { roundHalfUp } from '../../stats.ts'
import type { Status } from '../../types/enums.ts'
import type { CustomHandler } from './types.ts'

/**
 * Spiteful (elite affix, 06 §2): on the champion's death, Attack × `multiplier` of `damageType` to every enemy in
 * the row the line names (partyFront → the party's front row), then the family's signature status (06 §1: the
 * Cellars' vermin and bandits Poison, the Restless Dead Curse, the Tidebound Chill; `line.status` is the fallback
 * for a family not listed). Installed on the champion at spawn (explore.ts). The one-turn "it swells" tell has no
 * joint yet; the HUD reads the affix from the nameplate.
 */
const SIGNATURE: Record<string, Status> = {
  'cellar-vermin': 'poison',
  'the-grinning-company': 'poison',
  'the-restless-dead': 'curse',
  'the-tidebound': 'chill',
}

const handler: CustomHandler = {
  apply: (ctx, target) => {
    const holder = target ?? ctx.holder
    ctx.fx.installHook(holder, ctx.line, ctx.holder.id, { sourceSkillId: ctx.sourceId, turnsLeft: ctx.line.duration ?? null })
  },
  onDeath: (ctx) => {
    const holder = ctx.holder
    const row = ctx.line.target === 'partyBack' ? 'back' : ctx.line.target === 'partyFront' ? 'front' : null
    const victims = ctx.fx.enemiesOf(holder).filter((e) => row === null || e.row === row)
    if (victims.length === 0) return
    const type = ctx.line.damageType ?? 'blunt'
    const amount = roundHalfUp(ctx.fx.attackFor(holder, type) * (ctx.line.multiplier ?? 1))
    const status = SIGNATURE[holder.monster?.familyId ?? ''] ?? ctx.line.status ?? null
    ctx.fx.log('deathBurst', `${holder.name} bursts`, { actorId: holder.id, data: { status } })
    for (const v of victims) {
      ctx.fx.strike(holder, v, { amount, damageType: type, label: 'death burst', canMiss: false, canCrit: false, isMelee: false })
      if (status && ctx.fx.isActive(v)) ctx.fx.applyStatus(v, { status }, holder.id)
    }
  },
}
export default handler
