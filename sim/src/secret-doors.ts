import type { DelveState } from './delve-types.ts'

/**
 * A secret door is known once either side has found it or the party has stood on the far side (07 §2.6): a found
 * secret door works both ways, so a party that walks into a secret room can walk back out (D-093).
 */
export function secretDoorKnown(state: DelveState, from: string, to: string): boolean {
  const a = state.floor.rooms[from]
  const b = state.floor.rooms[to]
  return Boolean(a?.secretRevealed || b?.secretRevealed || b?.visited)
}
