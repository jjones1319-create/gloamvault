import { roundHalfUp } from '../../stats.ts'
import type { CustomHandler, HookContext } from './types.ts'

type Actor = HookContext['holder']
const ID = 'party-basic-extra-holy'

/**
 * Sanctified Weapon (Mender passive, Sanctity IV; docs/classes/mender.md §4.2): every ally's basic attack deals an
 * extra `multiplier` (0.2; Mastery 0.3) × the Mender's spell Attack as `damageType` (Holy). Reading: attacker-side
 * joints sit on the attacker, so the Mender's hook seeds a companion (same line, sourceId = the Mender) on every ally —
 * pets included — at the fight's start and at each of its turn starts; each companion works like Consecration's hook
 * (basic-attack-extra-spell-damage: `modifyLine` notes a basic attack, `onDealtDamage` adds one strike per action) with
 * the Mender's spell Attack, while the Mender stands.
 */
function ownerOf(ctx: HookContext): Actor | null {
  return ctx.state.actors.find((a) => a.id === ctx.hook?.sourceId) ?? null
}

function seed(ctx: HookContext, owner: Actor): void {
  for (const a of ctx.fx.alliesOf(owner)) {
    if (a.hooks.some((h) => h.customId === ID && h.sourceId === owner.id)) continue
    ctx.fx.installHook(a, ctx.line, owner.id, { sourceSkillId: ctx.hook?.sourceSkillId ?? ctx.sourceId, replace: false })
  }
}

const handler: CustomHandler = {
  onFightStart: (ctx) => {
    if (ctx.hook?.sourceId === ctx.holder.id) seed(ctx, ctx.holder)
  },
  onTurnStart: (ctx) => {
    if (ctx.hook?.sourceId === ctx.holder.id) seed(ctx, ctx.holder)
  },
  modifyLine: (ctx, _line, source) => {
    if (ctx.hook) ctx.hook.data.basic = source.kind === 'basic'
    return null
  },
  onHolderAttacks: (ctx) => {
    if (ctx.hook) ctx.hook.data.fired = false
  },
  onDealtDamage: (ctx, target, _dealt, incoming) => {
    const hook = ctx.hook
    if (!hook || hook.data.basic !== true || hook.data.fired === true || incoming.isDot) return
    const type = ctx.line.damageType ?? 'holy'
    if (incoming.damageType === type) return
    hook.data.fired = true
    const owner = ownerOf(ctx)
    if (!owner || !ctx.fx.isActive(owner) || !ctx.fx.isActive(target)) return
    const amount = roundHalfUp(ctx.fx.statOf(owner, 'attackSpell') * (ctx.line.multiplier ?? 0))
    if (amount <= 0) return
    ctx.fx.strike(ctx.holder, target, { amount, damageType: type, label: 'sanctified', canMiss: false, canCrit: false, isMelee: false })
  },
}
export default handler
