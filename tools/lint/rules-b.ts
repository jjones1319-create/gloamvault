/**
 * Cross-file rule 70 (Phase 8, pass B): the first delve's lesson floor (D-038, 03 §13; content/README.md rule 70).
 * Same contract as rules.ts: each rule returns `{ file, rule, message }[]` and skips what the schema already reports.
 * Rules 71–74 are kept for this pass.
 */
import { at, num, obj, objs, str, strs, type JsonObject } from './json.ts'
import type { Ctx, Failure } from './rules.ts'

function fail(file: string, rule: number, message: string): Failure {
  return { file, rule, message }
}

function tuningOf(ctx: Ctx): JsonObject | undefined {
  return obj(ctx.corpus.byKind.get('tuning')?.[0]?.json)
}

/** The lowest Perception a new hero can start with: 10 + the lowest species and class modifiers (free points only add). */
function lowestStartingPerception(ctx: Ctx): number {
  const mod = (rec: { json: JsonObject }) => num(at(rec.json, 'attributeMods', 'perception')) ?? 0
  const species = [...ctx.species.values()].map(mod)
  const classes = [...ctx.classes.values()].map(mod)
  return 10 + Math.min(0, ...species) + Math.min(0, ...classes)
}

/** The light band's Detection bonus at `light` (tuning exploration.light.bands; 07 §2.3). */
function bandDetection(tuning: JsonObject | undefined, light: number): number {
  for (const b of objs(at(tuning, 'exploration', 'light', 'bands'))) {
    const min = num(b.min)
    const max = num(b.max)
    if (min !== undefined && max !== undefined && light >= min && light <= max) return num(b.detection) ?? 0
  }
  return 0
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 70: the lesson floor. `floor` is a floor of the dungeon with no boss; `encounterId` an encounter of this dungeon
// on one of the floor's tables, legal on the floor, with no Monster-role monster; every trap is the dungeon's, of the
// floor's zone, may stand in a trap room, and is revealed by the lowest starting Perception in the light the party has
// when it reaches the trap room (the floor's entry light less two new rooms) — the lesson is "a trap your Perception
// reveals" (03 §13), so a hero who could miss it would be taught the wrong thing.

export function rule70(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const tuning = tuningOf(ctx)
  const perNewRoom = num(at(tuning, 'exploration', 'light', 'perNewRoom')) ?? 0
  const lowest = lowestStartingPerception(ctx)
  for (const d of ctx.dungeons.values()) {
    const lesson = obj(d.json.tutorial)
    if (!lesson) continue
    const dungeonId = str(d.json.id) ?? d.id
    const floorNo = num(lesson.floor)
    const floor = objs(d.json.floors).find((f) => num(f.floor) === floorNo)
    if (!floor) {
      out.push(fail(d.file, 70, `tutorial.floor ${String(lesson.floor)} is not one of the dungeon's floors`))
      continue
    }
    if (str(floor.bossId)) out.push(fail(d.file, 70, `tutorial.floor ${floorNo} carries a boss; the lesson floor must not`))
    const zoneId = str(floor.zoneId)
    // The first fight.
    const encId = str(lesson.encounterId) ?? ''
    const enc = ctx.encounters.get(encId)
    if (!enc) out.push(fail(d.file, 70, `tutorial.encounterId '${encId}' is not an encounter`))
    else {
      if (str(enc.json.dungeonId) !== dungeonId) out.push(fail(d.file, 70, `tutorial.encounterId '${encId}' belongs to another dungeon`))
      if (!strs(floor.encounterTableIds).includes(str(enc.json.tableId) ?? '')) out.push(fail(d.file, 70, `tutorial.encounterId '${encId}' is on table '${str(enc.json.tableId)}', which floor ${floorNo} does not draw from`))
      const min = num(at(enc.json, 'floorBand', 'min'))
      const max = num(at(enc.json, 'floorBand', 'max'))
      if (floorNo !== undefined && (min === undefined || max === undefined || floorNo < min || floorNo > max)) out.push(fail(d.file, 70, `tutorial.encounterId '${encId}' is not legal on floor ${floorNo} (its floorBand)`))
      for (const slot of objs(enc.json.composition)) {
        const m = ctx.monsters.get(str(slot.monsterId) ?? '')
        if (m && str(m.json.role) === 'monster') out.push(fail(d.file, 70, `tutorial.encounterId '${encId}' holds a Monster-role monster (${m.id}); the first fight teaches the timeline, not a wall`))
      }
    }
    // The trap room.
    const entryLight = num(floor.lightAtEntry) ?? 100
    const lightAtTrapRoom = Math.max(0, Math.min(100, entryLight + 2 * perNewRoom))
    const detection = lowest + bandDetection(tuning, lightAtTrapRoom)
    for (const id of strs(lesson.trapIds)) {
      const trap = objs(d.json.traps).find((t) => str(t.id) === id)
      if (!trap) {
        out.push(fail(d.file, 70, `tutorial.trapIds names '${id}', which is not a trap of this dungeon`))
        continue
      }
      const trapZone = str(trap.zoneId)
      if (trapZone && trapZone !== zoneId) out.push(fail(d.file, 70, `tutorial trap '${id}' belongs to zone '${trapZone}', not the lesson floor's '${zoneId}'`))
      const kinds = strs(at(trap, 'placement', 'roomKinds'))
      if (kinds.length > 0 && !kinds.includes('trapGauntlet')) out.push(fail(d.file, 70, `tutorial trap '${id}' cannot stand in a trap room (its placement.roomKinds)`))
      const needs = num(at(trap, 'revealedBy', 'detection')) ?? num(trap.difficulty) ?? 0
      if (needs > detection) out.push(fail(d.file, 70, `tutorial trap '${id}' needs Detection ${needs}, but the lowest starting Perception (${lowest}) at light ${lightAtTrapRoom} gives ${detection}: some heroes would never see it`))
    }
  }
  return out
}

export const RULES_B: ReadonlyArray<{ n: number; run: (ctx: Ctx) => Failure[] }> = [{ n: 70, run: rule70 }]
