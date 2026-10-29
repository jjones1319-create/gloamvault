import type { CustomHandler } from './types.ts'

/** The field-trap hooks a Ranger lays (Caltrop Toss, Tripwire, Bear Jaw, Killing Field). */
const TRAP_HOOKS: ReadonlySet<string> = new Set(['field-trap-row-dot', 'field-trap-on-movement', 'field-trap-front-action', 'field-trap-both-rows'])

/**
 * Trapmaster (Ranger, Trapper V; docs/classes/ranger.md §4.2): once per round, laying a field trap has weight `amount`
 * (400) instead of its own; trap damage +`percent`%.
 * Reading: `onSkillUsed` notes that this action laid a trap (a skill carrying one of the field-trap lines); the
 * fight's `modifyWeight`, made once the action has resolved, then lightens it — once per round (the sheet's "once per
 * turn": a hero takes one turn a round). The +% is read by the traps this Phase wrote (Bear Jaw's
 * `field-trap-front-action`, Killing Field's `field-trap-both-rows`); Caltrop Toss's and Tripwire's older hooks do not
 * read it yet. The sim keeps no cap on the traps a field holds, so the Mastery's "three traps" has nothing to raise.
 */
const handler: CustomHandler = {
  onSkillUsed: (ctx, skill) => {
    const hook = ctx.hook
    if (!hook) return
    if (skill.effects.some((l) => l.kind === 'custom' && TRAP_HOOKS.has(l.customId ?? ''))) hook.data.trapAction = ctx.holder.tally.actions
  },
  modifyWeight: (ctx, weight) => {
    const hook = ctx.hook
    if (!hook || hook.data.trapAction !== ctx.holder.tally.actions || hook.data.usedRound === ctx.state.round) return weight
    hook.data.usedRound = ctx.state.round
    return Math.min(weight, ctx.line.amount ?? 400)
  },
}
export default handler
