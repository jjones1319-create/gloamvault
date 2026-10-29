import type { HandlerEntry } from './types.ts'

/**
 * Tiers IV–V hooks (Phase 7, pass A) — the shared share, merged by _group-tiers45.ts. Add each new hook's import and its
 * [customId, handler] pair here; sim/test/custom-registry.test.ts checks every handler file is registered once.
 */
export const GROUP: readonly HandlerEntry[] = []
