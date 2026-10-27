import { GROUP as arcane } from './_group-arcane.ts'
import { GROUP as cellars } from './_group-cellars.ts'
import { GROUP as core } from './_group-core.ts'
import { GROUP as faith } from './_group-faith.ts'
import { GROUP as martial } from './_group-martial.ts'
import type { CustomHandler, HandlerEntry } from './types.ts'

/**
 * Every custom hook by its customId (content/README.md rule 31: each id has a file sim/src/skills/custom/<id>.ts).
 * The registry is the union of the group files so several passes can add handlers without touching one list;
 * sim/test/custom-registry.test.ts checks every handler file is registered once under its own file name.
 */
export const HANDLER_GROUPS: Readonly<Record<string, readonly HandlerEntry[]>> = { core, martial, arcane, faith, cellars }

export const CUSTOM_HANDLERS: ReadonlyMap<string, CustomHandler> = new Map<string, CustomHandler>([...core, ...martial, ...arcane, ...faith, ...cellars])

export function customHandler(id: string): CustomHandler | null {
  return CUSTOM_HANDLERS.get(id) ?? null
}

export type { CustomHandler, HandlerEntry, HookContext, HookFx, IncomingDamage, StrikeOptions } from './types.ts'
