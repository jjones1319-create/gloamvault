import type { DelveOptions, RoomState, TrapState } from './delve-types.ts'
import type { FloorRoom } from './generator.ts'
import type { DungeonChest } from './loot.ts'
import type { DungeonDef, TutorialDef } from './types/content.ts'

/**
 * The lesson floor (D-038, 03 §13; Phase 8, pass B). A profile's first delve opens on a fixed floor of three rooms after
 * the entrance — the first fight, a trap room, the stairs — which teaches moving, the timeline, a trap your Perception
 * reveals, a chest, and leaving by the stairs or teleporting out. The generator lays it out (`FloorKind` 'tutorial':
 * Entry · Fight · Trap room · Stairs); the dungeon's `tutorial` block says what stands in it, so nothing on it is rolled.
 * Every later floor and delve plays normally. Pure: no clock, no randomness.
 */

/** The lesson's floor when a dungeon carries no `tutorial` block (D-038 as built in Phase 4). */
export const DEFAULT_TUTORIAL_FLOOR = 1

/** Whether `floor` of this delve is the lesson floor: a first delve (`options.firstDelve`) on the dungeon's lesson floor. */
export function isTutorialFloor(dungeon: DungeonDef, options: Pick<DelveOptions, 'firstDelve'>, floor: number): boolean {
  return options.firstDelve === true && floor === (dungeon.tutorial?.floor ?? DEFAULT_TUTORIAL_FLOOR)
}

/** The dungeon's fixed lesson when `floor` is the lesson floor of this delve, else null (no block, or not the lesson). */
export function tutorialFor(dungeon: DungeonDef, options: Pick<DelveOptions, 'firstDelve'>, floor: number): TutorialDef | null {
  return isTutorialFloor(dungeon, options, floor) ? (dungeon.tutorial ?? null) : null
}

/**
 * A lesson room as the data says, with no roll (explore.ts `dressRoom` rolls traps and curios on every other floor):
 * the fight room holds the lesson's encounter, the trap room its traps — none revealed yet, so the party's Perception
 * finds them on entering — and its chest; every other room is bare.
 */
export function dressTutorialRoom(dungeon: DungeonDef, room: FloorRoom, tutorial: TutorialDef): RoomState {
  const traps: TrapState[] = []
  const chests: DungeonChest[] = []
  if (room.kind === 'trapGauntlet') {
    for (const id of tutorial.trapIds) {
      const def = dungeon.traps.find((t) => t.id === id)
      if (!def) continue
      // The same door rule as dressRoom: a door-blocking trap shuts the room's way on.
      traps.push({ trapId: def.id, revealed: false, disarmed: false, triggered: false, blocksDoorTo: def.blocksDoor && room.doors.length > 1 ? (room.doors[1]?.to ?? null) : null })
    }
    if (tutorial.chest) chests.push({ size: tutorial.chest, locked: false, trapped: false, trapId: null, opened: false })
  }
  const fights = room.kind === 'fight' || room.kind === 'elite' || room.kind === 'boss' || room.kind === 'keyRoom'
  return {
    roomId: room.id,
    kind: room.kind,
    scouted: false,
    visited: false,
    cleared: !fights,
    encounterId: room.kind === 'fight' ? tutorial.encounterId : room.encounterId,
    championAffixIds: [],
    curioId: null,
    curioUsed: false,
    traps,
    chests,
    goldPiles: [],
    restUsed: false,
    merchant: null,
    hiddenFound: false,
    secretRevealed: false,
  }
}
