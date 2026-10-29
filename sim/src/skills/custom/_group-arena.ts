import arenaBoss from './arena-boss.ts'
import arenaFlank from './arena-flank.ts'
import arenaTideChain from './arena-tide-chain.ts'
import type { HandlerEntry } from './types.ts'

/**
 * The boss arenas' hooks (07 §2.8; pass C2, Phase 7). sim/src/arena.ts installs them on the actors of an arena fight;
 * no content line names them.
 */
export const GROUP: HandlerEntry[] = [
  ['arena-boss', arenaBoss],
  ['arena-flank', arenaFlank],
  ['arena-tide-chain', arenaTideChain],
]
