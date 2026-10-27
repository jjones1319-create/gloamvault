/**
 * The room's legal actions (sim `legalDelveActions`) sorted into the room panel's groups, each with its test id:
 * `dv-action-<kind>` for the first of a kind and `dv-action-<kind>-<n>` for the n-th; moves are `dv-move-<room>`,
 * curio choices `dv-curio-<n>`, Continue `dv-continue`. Pure, tested in Node.
 */
export interface ActionLike<C extends { kind: string } = { kind: string }> {
  command: C
  label: string
  enabled: boolean
  reason?: string
}

export interface ActionItem<A extends ActionLike = ActionLike> {
  action: A
  testid: string
  label: string
  reason?: string
}

export interface ActionGroups<A extends ActionLike = ActionLike> {
  /** Raising the dead the party carries (Mortal, D-089). */
  raise: ActionItem<A>[]
  loot: ActionItem<A>[]
  traps: ActionItem<A>[]
  camp: ActionItem<A>[]
  shop: ActionItem<A>[]
  items: ActionItem<A>[]
  pets: ActionItem<A>[]
  leave: ActionItem<A>[]
  other: ActionItem<A>[]
  moves: Map<string, ActionItem<A>>
  curio: ActionItem<A>[]
  next: ActionItem<A> | null
  auto: ActionItem<A> | null
}

const REASONS: Readonly<Record<string, string>> = {
  locked: 'Locked, and nobody can pick it',
  'locked: find the key': 'Locked: find the key',
  'a trap blocks this door': 'A trap blocks this door',
  'not enough gold': 'Not enough gold',
  'no revives left this floor': 'No revives left this floor',
}

export function reasonWords(reason: string | undefined): string | undefined {
  if (!reason) return undefined
  return REASONS[reason] ?? reason[0]!.toUpperCase() + reason.slice(1)
}

function labelFor(a: ActionLike): string {
  return a.command.kind === 'auto' ? 'Auto-step' : a.label
}

export function groupActions<A extends ActionLike>(legal: readonly A[]): ActionGroups<A> {
  const out: ActionGroups<A> = { raise: [], loot: [], traps: [], camp: [], shop: [], items: [], pets: [], leave: [], other: [], moves: new Map(), curio: [], next: null, auto: null }
  const seen = new Map<string, number>()
  for (const a of legal) {
    const kind = a.command.kind
    if (kind === 'fight') continue
    const n = (seen.get(kind) ?? 0) + 1
    seen.set(kind, n)
    const cmd = a.command as unknown as { toRoomId?: string; choice?: number }
    let testid = n === 1 ? `dv-action-${kind}` : `dv-action-${kind}-${n}`
    if (kind === 'move') testid = `dv-move-${cmd.toRoomId ?? n}`
    if (kind === 'curio') testid = `dv-curio-${cmd.choice ?? n - 1}`
    if (kind === 'continue') testid = 'dv-continue'
    const item: ActionItem<A> = { action: a, testid, label: labelFor(a), reason: a.enabled ? undefined : reasonWords(a.reason) }
    switch (kind) {
      case 'move':
        if (cmd.toRoomId && !out.moves.has(cmd.toRoomId)) out.moves.set(cmd.toRoomId, item)
        break
      case 'takeGold':
      case 'openChest':
        out.loot.push(item)
        break
      case 'disarm':
      case 'walkAround':
        out.traps.push(item)
        break
      case 'raise':
        out.raise.push(item)
        break
      case 'rest':
      case 'firstAid':
      case 'fieldRepair':
        out.camp.push(item)
        break
      case 'buy':
        out.shop.push(item)
        break
      case 'useItem':
        out.items.push(item)
        break
      case 'stance':
        out.pets.push(item)
        break
      case 'descend':
      case 'retreat':
        out.leave.push(item)
        break
      case 'curio':
        out.curio.push(item)
        break
      case 'continue':
        out.next = item
        break
      case 'auto':
        out.auto = item
        break
      default:
        out.other.push(item)
    }
  }
  return out
}

/** "Use Torch ×2 (Warden)" → { hero: "Warden", text: "Torch ×2" } for the item sheet's per-hero sections. */
export function splitOwner(label: string): { text: string; owner: string | null } {
  const m = /^(?:Use )?(.*) \(([^()]+)\)$/.exec(label)
  if (!m) return { text: label, owner: null }
  return { text: m[1]!, owner: m[2]! }
}
