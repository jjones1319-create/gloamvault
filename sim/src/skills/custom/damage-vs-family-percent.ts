import type { CustomHandler, HookContext } from './types.ts'

/**
 * <Family>bane (08 §5): "+8–10% / 10–15% / 15–25% damage vs that family". The hook sits on the wearer (hero.ts) with
 * `sourceId` = the affix id; the family is the affix's `family:<id>` tag. `outgoingDamagePercent` adds `percent`
 * when the target's `familyId` is that word or contains it as a hyphenated part (Verminbane hits `cellar-vermin`;
 * Banditbane waits for a family whose id says bandit — the Grinning Company share the Cellars' Vermin family).
 */
function familyOf(ctx: HookContext): string | null {
  const affix = ctx.content.affixes.get(ctx.hook?.sourceId ?? '')
  const tag = affix?.tags.find((t) => t.startsWith('family:'))
  return tag ? tag.slice('family:'.length).toLowerCase() : null
}

const handler: CustomHandler = {
  outgoingDamagePercent: (ctx, target) => {
    const family = familyOf(ctx)
    const id = target.monster?.familyId.toLowerCase()
    if (!family || !id) return 0
    return id === family || id.split('-').includes(family) ? (ctx.line.percent ?? 0) : 0
  },
}
export default handler
