/**
 * @gloamvault/sim: the rulebook (docs/03-GAME-DESIGN.md) as pure, deterministic TypeScript.
 * No DOM, no Math.random, no Date.now, integer math, a seeded RNG whose state lives in the save (10-TECH-PLAN §2).
 * The client, the balance runner and the linter import from here and nowhere else. Phase 2 fills this package in.
 */
export const SIM_VERSION = 1

export type { Tuning } from './tuning.ts'

// The content layer (Phase 2): closed sets, the record types that mirror content/schemas/, and the bundle builder.
export * from './types/enums.ts'
export type * from './types/content.ts'
export { CONTENT_KINDS, buildContent, contentSummary, kindForContentPath } from './content.ts'
export type { Content, ContentKind, ContentPathKind, RawContentFile } from './content.ts'

// Items, loot and chests (Phase 2): instances, affixes, wear and care, promotion and salvage, fight and room loot, the Curio Merchant.
export * from './items.ts'
export * from './loot.ts'
export * from './chests.ts'

export { activeHooks, installHook, removeHook, removeHooksById, hooksOf } from './hooks.ts'
export type { ActiveHook, InstallOptions } from './hooks.ts'
export { linesAtRank, rankEffectPercent } from './skill-lines.ts'
export { battleXpForLevel, heroLevelForXp, heroLevelXpCost, levelGapMultiplier } from './xp.ts'
export { fightXpPool } from './progress.ts'
export { addBattleXp, applyBattleXpLevel, heroAtLevel, levelUpGains, loseLevels } from './hero.ts'

export { generateFloor, hashFloor, DEFAULT_GRAMMAR } from './generator.ts'
export type {
  RoomKind,
  DoorSide,
  FloorKind,
  Rotation,
  Cell,
  GeneratorKnobs,
  FloorSpec,
  TemplateSpec,
  TemplateDoorSpec,
  GeneratorOverrides,
  GeneratorInput,
  GrammarNumbers,
  EncounterContext,
  FloorDoor,
  FloorRoom,
  FloorGraph,
} from './generator.ts'
export { renderFloorAscii, roomLetter, doorCell, ROOM_LETTERS, ASCII_LEGEND } from './generator-ascii.ts'

// The game loop (Phase 4): fights, delves and the town, for the client.
export { applyFightCommand, createFight, fleeChance, legalFightActions, runFight, runFightAuto, turnForecast } from './fight.ts'
export { canRaise, createDelve, deadLeader, delveSummary, hashDelve, hopsOf, isMortal, isNightmare, legalDelveActions, replayDelve, runDelveAuto, stepDelve } from './delve.ts'
export type * from './delve-types.ts'
export type * from './fight-types.ts'
export * from './town.ts'
// James's direction during Phase 4 (D-088–D-092): the Wayfarer Chest's cast and the threat read.
export * from './wayfarers.ts'
export * from './threat.ts'
export { buildHeroActor, createHero, heroLoad, heroStats } from './hero.ts'
export type { CreateHeroInput } from './hero.ts'
export { tierOpenAt } from './xp.ts'
export { lightBand } from './light.ts'
