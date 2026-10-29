import { GROUP as arcanistMender } from './_group-tiers45-arcanist-mender.ts'
import { GROUP as rangerShade } from './_group-tiers45-ranger-shade.ts'
import { GROUP as shared } from './_group-tiers45-shared.ts'
import { GROUP as wardenBlade } from './_group-tiers45-warden-blade.ts'
import type { HandlerEntry } from './types.ts'

/**
 * The hooks Tiers IV–V need (Phase 7, pass A: docs/classes/*.md §4's Tier IV and V rows), one file per customId as
 * the rest. Kept in four shares so the classes could be written side by side; this file is the one group the registry
 * (index.ts) imports.
 */
export const GROUP: readonly HandlerEntry[] = [...shared, ...wardenBlade, ...rangerShade, ...arcanistMender]
