import type { Status } from '../../types/enums.ts'
import type { CustomHandler, HookContext } from './types.ts'

type Effect = HookContext['line']

/**
 * Steadfast (08 §5): "+Fear and Stun resistance 10% / 20% / 35%". The affix hook sits on the wearer (hero.ts); at
 * the fight's start (or when applied as a line) it installs one `status-resist-bonus` hook per status — the hook
 * statuses.ts `resistChance` already reads — for Fear and for Stun at `percent`, lasting the fight. The two carry
 * distinct source ids (`<affix>:fear`, `<affix>:stun`) so re-arming replaces rather than stacks.
 */
const STATUSES: readonly Status[] = ['fear', 'stun']

function arm(ctx: HookContext): void {
  const who = ctx.holder
  const pct = ctx.line.percent ?? 0
  const source = ctx.hook?.sourceId ?? ctx.sourceId ?? 'steadfast'
  for (const status of STATUSES) {
    const line: Effect = { kind: 'custom', customId: 'status-resist-bonus', status, percent: pct }
    ctx.fx.installHook(who, line, `${source}:${status}`, { turnsLeft: null })
  }
}

const handler: CustomHandler = {
  onFightStart: (ctx) => arm(ctx),
  apply: (ctx) => arm(ctx),
}
export default handler
