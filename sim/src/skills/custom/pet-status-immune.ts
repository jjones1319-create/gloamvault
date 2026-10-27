import type { CustomHandler, HookContext } from './types.ts'

/**
 * A pet trait's status immunity (06 §9: Bone Pup and Sporeling never take Poison, Frost Kit Chill, Drakeling Fear).
 * The trait hook sits on the pet (pets.ts). Reading: no joint stops a status before it lands, but statuses.ts
 * `resistChance` adds every `status-resist-bonus` hook on the target for that status — so at the fight's start the
 * pet installs one at 100% (a sure resist, no RNG spent) and the status never lands; `afterHit` and `onTurnStart`
 * strip it as well in case anything bypassed the resist roll.
 */
function ensureResist(ctx: HookContext): void {
  const hook = ctx.hook
  const status = ctx.line.status
  if (!hook || !status || hook.data.armed === true) return
  hook.data.armed = true
  ctx.fx.installHook(ctx.holder, { kind: 'custom', customId: 'status-resist-bonus', status, percent: 100 }, `pet-status-immune:${status}`)
}

function strip(ctx: HookContext): void {
  const status = ctx.line.status
  if (status && ctx.fx.removeStatus(ctx.holder, status)) ctx.fx.log('immune', `${ctx.holder.name} shrugs off ${status}`, { actorId: ctx.holder.id, data: { status } })
}

const handler: CustomHandler = {
  apply: (ctx) => ensureResist(ctx),
  onFightStart: (ctx) => ensureResist(ctx),
  onTurnStart: (ctx) => {
    ensureResist(ctx)
    strip(ctx)
  },
  afterHit: (ctx) => strip(ctx),
}
export default handler
