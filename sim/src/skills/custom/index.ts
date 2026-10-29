import { GROUP as arcane } from './_group-arcane.ts'
import { GROUP as arena } from './_group-arena.ts'
import { GROUP as cellars } from './_group-cellars.ts'
import { GROUP as core } from './_group-core.ts'
import { GROUP as crypts } from './_group-crypts.ts'
import { GROUP as faith } from './_group-faith.ts'
import { GROUP as martial } from './_group-martial.ts'
import { GROUP as tiers45 } from './_group-tiers45.ts'
import { GROUP as vault } from './_group-vault.ts'
import { GROUP as items } from './_group-items.ts'
import type { CustomHandler, HandlerEntry } from './types.ts'

/**
 * Every custom hook by its customId (content/README.md rule 31: each id has a file sim/src/skills/custom/<id>.ts).
 * The registry is the union of the group files so several passes can add handlers without touching one list;
 * sim/test/custom-registry.test.ts checks every handler file is registered once under its own file name.
 */
export const HANDLER_GROUPS: Readonly<Record<string, readonly HandlerEntry[]>> = { core, martial, arcane, faith, cellars, tiers45, crypts, vault, arena, items }

export const CUSTOM_HANDLERS: ReadonlyMap<string, CustomHandler> = new Map<string, CustomHandler>([...core, ...martial, ...arcane, ...faith, ...cellars, ...tiers45, ...crypts, ...vault, ...arena, ...items])

export function customHandler(id: string): CustomHandler | null {
  return CUSTOM_HANDLERS.get(id) ?? null
}

export type { CustomHandler, HandlerEntry, HookContext, HookFx, IncomingDamage, StrikeOptions } from './types.ts'
