import type { CustomHandler } from './types.ts'

/**
 * Vault Imp's Pilfer (pet active, 06 §9): removes the target's newest buff status and gives it to the pet's owner
 * for its remaining duration (stacks and magnitude carried over; a buff the owner already holds is replaced);
 * nothing if the target holds no buff. "Buff" is the status record's kind (content/statuses).
 */
const handler: CustomHandler = {
  apply: (ctx, target) => {
    if (!target || target.side === ctx.holder.side) return
    let stolen: (typeof target.statuses)[number] | null = null
    for (let i = target.statuses.length - 1; i >= 0; i--) {
      const s = target.statuses[i]
      if (s && ctx.content.statuses.get(s.id)?.kind === 'buff') {
        stolen = s
        break
      }
    }
    if (!stolen) {
      ctx.fx.log('noEffect', `${target.name} has nothing worth pilfering`, { actorId: ctx.holder.id, targetId: target.id })
      return
    }
    const taken = stolen
    target.statuses = target.statuses.filter((s) => s !== taken)
    const owner = ctx.state.actors.find((a) => a.id === ctx.holder.pet?.ownerId) ?? ctx.holder
    owner.statuses = owner.statuses.filter((s) => s.id !== taken.id)
    owner.statuses.push({ ...taken, sourceId: ctx.holder.id })
    ctx.fx.log('pilfer', `${ctx.holder.name} pilfers ${taken.id} from ${target.name} for ${owner.name}`, { actorId: ctx.holder.id, targetId: target.id, data: { status: taken.id, to: owner.id } })
  },
}
export default handler
