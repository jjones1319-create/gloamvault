import type { CustomHandler, HookContext } from './types.ts'

/**
 * Forge Beetle's trait (06 §9): the party's armor-slot durability loss is scaled by `percent` (−20 → ×0.80). The
 * trait hook sits on the pet (pets.ts) but wear events belong to the heroes, so at the fight's start the pet
 * installs a mirror of this line (`data.mirror`) on every hero of its side; a mirror answers `wearPercent` for armor.
 */
function ensureMirrors(ctx: HookContext): void {
  const hook = ctx.hook
  if (!hook || hook.data.mirror === true || hook.data.mirrored === true) return
  hook.data.mirrored = true
  for (const hero of ctx.fx.alliesOf(ctx.holder)) if (hero.kind === 'hero') ctx.fx.installHook(hero, ctx.line, ctx.holder.id, { data: { mirror: true } })
}

const handler: CustomHandler = {
  apply: (ctx) => ensureMirrors(ctx),
  onFightStart: (ctx) => ensureMirrors(ctx),
  onTurnStart: (ctx) => ensureMirrors(ctx),
  wearPercent: (ctx, kind) => (ctx.hook?.data.mirror === true && kind === 'armor' ? (ctx.line.percent ?? 0) : 0),
}
export default handler
