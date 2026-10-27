/**
 * @gloamvault/sim: the rulebook (docs/03-GAME-DESIGN.md) as pure, deterministic TypeScript.
 * No DOM, no Math.random, no Date.now, integer math, a seeded RNG whose state lives in the save (10-TECH-PLAN §2).
 * The client, the balance runner and the linter import from here and nowhere else. Phase 2 fills this package in.
 */
export const SIM_VERSION = 1

export type { Tuning } from './tuning.ts'
