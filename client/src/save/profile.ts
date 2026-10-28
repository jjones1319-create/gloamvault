import * as v from 'valibot'
import type { Content } from '../../../sim/src/content.ts'
import { newProfile, PROFILE_VERSION, type Profile } from '../../../sim/src/town.ts'
import type { HeroRecord, ItemInstance } from '../../../sim/src/types/content.ts'
import type { DeathRule } from '../../../sim/src/types/enums.ts'
import { KEY_PREFIX, KEYS, safeGet, safeSet, type KeyValueStore } from './db.ts'

/**
 * The game save (10-TECH-PLAN §6): the sim's \`Profile\` under \`gloamvault/profile\`, three rotating backups, and a
 * portable JSON export. "Saves are sacred": everything loaded is migrated, validated and clamped against the content
 * that is loaded now (an id the content no longer has is dropped, never crashed on), and a broken save falls back to
 * the newest good backup. SAVE_VERSION is the sim's PROFILE_VERSION; a schema change bumps it and adds a migration
 * below plus a fixture test.
 */
export const SAVE_VERSION = PROFILE_VERSION

export const BACKUP_KEYS = [0, 1, 2].map((i) => `${KEY_PREFIX}profile-backup-${i}`)

/** Step N → N+1. */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  // 1 → 2: the Nightmare death rule joins Sheltered and Mortal (D-095); a version-1 save needs nothing changed.
  1: (raw) => raw,
}

export function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  let out = raw
  let version = typeof out.saveVersion === 'number' ? out.saveVersion : 1
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) break
    out = { ...step(out), saveVersion: version + 1 }
    version += 1
  }
  return out
}

const int = (min = 0) => v.fallback(v.pipe(v.number(), v.integer(), v.minValue(min)), min)
const record = <T extends v.GenericSchema>(item: T) => v.fallback(v.record(v.string(), item), {} as never)

/** The envelope's shape: numbers clamped to their range, every list defaulted when missing. Heroes are checked below. */
const ProfileSchema = v.object({
  saveVersion: v.fallback(v.number(), SAVE_VERSION),
  heroes: v.fallback(v.array(v.looseObject({ id: v.string(), name: v.string(), speciesId: v.string(), classId: v.string() })), []),
  partyIds: v.fallback(v.array(v.string()), []),
  deathRule: v.fallback(v.picklist(['mortal', 'sheltered', 'nightmare']), 'mortal' as DeathRule),
  chosenId: v.fallback(v.nullable(v.string()), null),
  wayfarerOf: record(v.string()),
  dead: v.fallback(v.array(v.object({ heroId: v.string(), dungeonId: v.string(), floor: int(1) })), []),
  legacies: v.fallback(
    v.array(v.object({ id: v.string(), heroId: v.string(), name: v.string(), classId: v.string(), level: int(1), xp: int(), fromChosen: v.fallback(v.boolean(), false) })),
    [],
  ),
  memorial: v.fallback(
    v.array(
      v.object({
        name: v.string(),
        speciesId: v.string(),
        classId: v.string(),
        level: int(1),
        chosen: v.fallback(v.boolean(), false),
        wayfarerId: v.fallback(v.nullable(v.string()), null),
        dungeonId: v.fallback(v.nullable(v.string()), null),
        floor: v.fallback(v.nullable(v.number()), null),
        delve: int(),
        how: v.fallback(v.picklist(['wipe', 'laidToRest']), 'wipe'),
      }),
    ),
    [],
  ),
  purse: int(),
  bank: int(),
  armory: v.fallback(v.array(v.looseObject({ instanceId: v.string(), itemId: v.string() })), []),
  materials: record(v.pipe(v.number(), v.integer(), v.minValue(0))),
  eggs: v.fallback(v.array(v.object({ petId: v.string(), grade: v.string() })), []),
  stables: v.fallback(v.array(v.looseObject({ petId: v.string() })), []),
  pity: record(v.object({ plusOneCounter: int(), plusTwoCounter: int() })),
  tomeBags: record(v.record(v.string(), v.array(v.string()))),
  skillPurchases: record(v.pipe(v.number(), v.integer(), v.minValue(0))),
  progress: v.fallback(
    v.object({
      deepest: record(v.pipe(v.number(), v.integer(), v.minValue(0))),
      bossKills: record(v.pipe(v.number(), v.integer(), v.minValue(0))),
      delves: int(),
      clears: int(),
      wipes: int(),
    }),
    { deepest: {}, bossKills: {}, delves: 0, clears: 0, wipes: 0 },
  ),
  rng: v.object({ a: v.number(), b: v.number(), c: v.number(), d: v.number() }),
  seedCounter: int(),
  activeDelve: v.fallback(v.nullable(v.looseObject({ options: v.looseObject({ dungeonId: v.string() }), party: v.array(v.looseObject({ id: v.string() })), commands: v.array(v.looseObject({ kind: v.string() })) })), null),
  lastDelve: v.fallback(v.nullable(v.looseObject({ outcome: v.string() })), null),
})

export interface LoadReport {
  profile: Profile | null
  /** What was dropped or repaired, for the player and the log. */
  notes: string[]
}

function knownItem(content: Content, inst: ItemInstance | null, notes: string[], where: string): ItemInstance | null {
  if (!inst) return null
  if (content.items.has(inst.itemId)) {
    const durability = Math.max(0, Math.min(100, Math.round(inst.durability ?? 100)))
    const maxDurability = Math.max(0, Math.min(100, Math.round(inst.maxDurability ?? 100)))
    return { ...inst, durability: Math.min(durability, maxDurability), maxDurability, quantity: Math.max(1, Math.round(inst.quantity ?? 1)) }
  }
  notes.push(`${where}: an item the game no longer has (${inst.itemId}) was put away`)
  return null
}

/** A hero that still makes sense against the loaded content, or null with a note. */
function repairHero(content: Content, raw: HeroRecord, notes: string[]): HeroRecord | null {
  if (!content.classes.has(raw.classId) || !content.species.has(raw.speciesId)) {
    notes.push(`${raw.name ?? raw.id}: an unknown class or species — the hero was set aside`)
    return null
  }
  const e = raw.equipment
  const fix = (i: ItemInstance | null, where: string) => knownItem(content, i, notes, `${raw.name} (${where})`)
  const equipment = {
    ...e,
    mainHand: fix(e.mainHand, 'main hand'),
    offHand: fix(e.offHand, 'off hand'),
    helmet: fix(e.helmet, 'helmet'),
    chest: fix(e.chest, 'chest'),
    legs: fix(e.legs, 'legs'),
    boots: fix(e.boots, 'boots'),
    gloves: fix(e.gloves, 'gloves'),
    talisman: fix(e.talisman, 'talisman'),
    relic: fix(e.relic, 'relic'),
    ring: [fix(e.ring?.[0] ?? null, 'ring'), fix(e.ring?.[1] ?? null, 'ring')] as [ItemInstance | null, ItemInstance | null],
  }
  const skills = (raw.skills ?? []).filter((s) => content.skills.has(s.skillId))
  const known = new Set(skills.map((s) => s.skillId))
  const keep = (id: string | null) => (id && known.has(id) ? id : null)
  const loadout = { ...raw.loadout, actives: raw.loadout.actives.map(keep) as never, passives: raw.loadout.passives.map(keep) as never }
  const bag = (raw.bag ?? []).map((i) => knownItem(content, i, notes, `${raw.name} (bag)`)).filter((i): i is ItemInstance => i !== null)
  const petInstance = raw.petInstance && content.pets.has(raw.petInstance.petId) ? raw.petInstance : null
  return {
    ...raw,
    level: Math.max(1, Math.round(raw.level ?? 1)),
    battleXp: Math.max(0, Math.round(raw.battleXp ?? 0)),
    gold: Math.max(0, Math.round(raw.gold ?? 0)),
    equipment,
    skills,
    loadout,
    bag,
    petInstance,
  }
}

/** Migrates, validates and repairs anything that claims to be a profile. Never throws. */
export function validateProfile(content: Content, raw: unknown): LoadReport {
  const notes: string[] = []
  try {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { profile: null, notes }
    const migrated = migrate(raw as Record<string, unknown>)
    if (typeof migrated.saveVersion === 'number' && migrated.saveVersion > SAVE_VERSION) {
      return { profile: null, notes: [`This save comes from a newer version of the game (save ${migrated.saveVersion}); update the app first.`] }
    }
    const parsed = v.safeParse(ProfileSchema, migrated)
    if (!parsed.success) return { profile: null, notes: ['The save could not be read.'] }
    const p = parsed.output as unknown as Profile
    const heroes = p.heroes.map((h) => repairHero(content, h as HeroRecord, notes)).filter((h): h is HeroRecord => h !== null)
    const ids = new Set(heroes.map((h) => h.id))
    const armory = p.armory.map((i) => knownItem(content, i as ItemInstance, notes, 'armory')).filter((i): i is ItemInstance => i !== null)
    const materials = Object.fromEntries(Object.entries(p.materials).filter(([id]) => content.items.has(id) || id === 'divine-shard'))
    const eggs = p.eggs.filter((e) => content.pets.has(e.petId))
    const stables = p.stables.filter((s) => content.pets.has(s.petId))
    let activeDelve = p.activeDelve
    if (activeDelve && (!content.dungeons.has(activeDelve.options.dungeonId) || activeDelve.party.some((h) => !ids.has(h.id)))) {
      notes.push('A delve in progress could not be resumed; the party is back in town as it went in.')
      activeDelve = null
    }
    // D-088–D-091: the dead lie at the Shrine (never in the party); a wayfarer the content no longer has stays as a
    // plain companion; the chosen id may name a hero who is gone (the selection is open).
    const dead = p.dead.filter((d, i, all) => ids.has(d.heroId) && all.findIndex((x) => x.heroId === d.heroId) === i)
    const deadIds = new Set(dead.map((d) => d.heroId))
    const wayfarerOf = Object.fromEntries(
      Object.entries(p.wayfarerOf).filter(([heroId, wayfarerId]) => {
        if (!ids.has(heroId)) return false
        if (content.wayfarers.has(wayfarerId)) return true
        notes.push(`A wayfarer the game no longer has (${wayfarerId}) stays as a companion`)
        return false
      }),
    )
    const legacies = p.legacies.filter((l) => l.xp > 0)
    const living = heroes.filter((h) => !deadIds.has(h.id))
    const partyIds = p.partyIds.filter((id) => ids.has(id) && !deadIds.has(id)).slice(0, 4)
    const profile: Profile = {
      ...p,
      saveVersion: SAVE_VERSION,
      heroes,
      partyIds: partyIds.length ? partyIds : living.slice(0, 1).map((h) => h.id),
      chosenId: p.chosenId ?? (heroes.length > 0 && p.memorial.length === 0 ? heroes[0]!.id : null),
      wayfarerOf,
      dead,
      legacies,
      armory,
      materials,
      eggs,
      stables,
      activeDelve,
    }
    return { profile, notes }
  } catch {
    return { profile: null, notes: ['The save could not be read.'] }
  }
}

/**
 * The newest readable profile: the main key, else the newest backup. A save erased on purpose (Settings → Erase)
 * stays erased: the backups are kept for a restore, never loaded on their own.
 */
export async function readProfile(store: KeyValueStore, content: Content): Promise<LoadReport> {
  const rawMain = await safeGet(store, KEYS.profile)
  const main = validateProfile(content, rawMain)
  if (main.profile) return main
  if (rawMain === undefined && (await safeGet(store, KEYS.erased)) !== undefined) return main
  for (const key of BACKUP_KEYS) {
    const backup = validateProfile(content, await safeGet(store, key))
    if (backup.profile) return { profile: backup.profile, notes: [...main.notes, 'Your save was damaged; the latest backup was loaded.', ...backup.notes] }
  }
  return main
}

export async function writeProfile(store: KeyValueStore, profile: Profile): Promise<boolean> {
  const ok = await safeSet(store, KEYS.profile, profile)
  if (ok) await store.del(KEYS.erased).catch(() => undefined)
  return ok
}

/** Erase (Settings): the main save goes, a marker says so; the backups stay for a restore. */
export async function eraseProfile(store: KeyValueStore): Promise<void> {
  await safeSet(store, KEYS.erased, true)
  await store.del(KEYS.profile).catch(() => undefined)
}

/** A Nightmare save that ended (D-095): the save and its backups are gone for good, and nothing falls back to them. */
export async function endRun(store: KeyValueStore): Promise<void> {
  await eraseProfile(store)
  for (const key of BACKUP_KEYS) await store.del(key).catch(() => undefined)
}

/** Rotates the three backups (taken after every delve and before an import). */
export async function writeBackup(store: KeyValueStore, profile: Profile): Promise<boolean> {
  const older = [await safeGet(store, BACKUP_KEYS[0]!), await safeGet(store, BACKUP_KEYS[1]!)]
  if (older[1] !== undefined) await safeSet(store, BACKUP_KEYS[2]!, older[1])
  if (older[0] !== undefined) await safeSet(store, BACKUP_KEYS[1]!, older[0])
  return safeSet(store, BACKUP_KEYS[0]!, profile)
}

export interface SaveFile {
  game: 'gloamvault'
  saveVersion: number
  savedAt: string
  profile: Profile
}

export function exportSave(profile: Profile, now = new Date()): string {
  const file: SaveFile = { game: 'gloamvault', saveVersion: SAVE_VERSION, savedAt: now.toISOString(), profile }
  return JSON.stringify(file)
}

/** Reads an exported save (or a bare profile). Never throws. */
export function importSave(content: Content, text: string): LoadReport {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { profile: null, notes: ['That is not a Gloamvault save file.'] }
  }
  const body = typeof raw === 'object' && raw !== null && (raw as { game?: string }).game === 'gloamvault' ? (raw as SaveFile).profile : raw
  const report = validateProfile(content, body)
  if (!report.profile && report.notes.length === 0) report.notes.push('That is not a Gloamvault save file.')
  return report
}

/** A brand-new profile seeded from the clock (the client may read the clock; the sim may not). */
export function freshProfile(now = Date.now(), deathRule: DeathRule = 'mortal'): Profile {
  return newProfile((now % 2_147_483_647) >>> 0, deathRule)
}
