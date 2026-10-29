import * as v from 'valibot'
import { CODEX_LIMITS } from '../../../sim/src/codex.ts'
import type { Content } from '../../../sim/src/content.ts'
import { SAVE_VERSION as HERO_RECORD_VERSION } from '../../../sim/src/hero.ts'
import { clampLook, defaultLook, LOOK_INDEX_MAX } from '../../../sim/src/look.ts'
import { newProfile, PROFILE_VERSION, type Profile } from '../../../sim/src/town.ts'
import type { HeroRecord, ItemInstance, PetInstance } from '../../../sim/src/types/content.ts'
import { BODY_FRAMES, type DeathRule } from '../../../sim/src/types/enums.ts'
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

/** A hero record from before save 3 gets its look: the same one a hash of its id always gives (Phase 5). */
function withLook(content: Content | null, hero: unknown): unknown {
  if (typeof hero !== 'object' || hero === null || Array.isArray(hero)) return hero
  const h = hero as Record<string, unknown>
  if (h.look !== undefined || typeof h.id !== 'string') return hero
  const species = typeof h.speciesId === 'string' ? content?.species.get(h.speciesId) : undefined
  return { ...h, look: defaultLook(h.id, species), saveVersion: Math.max(typeof h.saveVersion === 'number' ? h.saveVersion : 1, HERO_RECORD_VERSION) }
}

/** Step N → N+1. */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>, content: Content | null) => Record<string, unknown>> = {
  // 1 → 2: the Nightmare death rule joins Sheltered and Mortal (D-095); a version-1 save needs nothing changed.
  1: (raw) => raw,
  // 2 → 3: every hero has a look (Phase 5) — the roster and the party records of a delve in progress alike.
  2: (raw, content) => {
    const out: Record<string, unknown> = { ...raw }
    if (Array.isArray(raw.heroes)) out.heroes = raw.heroes.map((h) => withLook(content, h))
    const active = raw.activeDelve as Record<string, unknown> | null | undefined
    if (active && typeof active === 'object' && Array.isArray(active.party)) out.activeDelve = { ...active, party: active.party.map((h) => withLook(content, h)) }
    return out
  },
  // 3 → 4 (Phase 7): every new field is optional and takes its default when it is missing, so a version-3 save needs
  // nothing changed — the Quest Board (`contracts`, posted fresh on the next visit), kills by preset
  // (`progress.bossKillsByDifficulty`, empty: Hard opens on the first final-boss kill), each hero's quiver (missing =
  // full), techniques witnessed and the Insight pity (none yet), a pet's trait uses (rank 1), a Tome's `skillId` on an
  // item, and on a delve in progress `options.bossKills` / `purseIn` (a delve begun before the update replays with no
  // first-kill record and no purse carried in, as it was begun).
  3: (raw) => raw,
}

export function migrate(raw: Record<string, unknown>, content: Content | null = null): Record<string, unknown> {
  let out = raw
  let version = typeof out.saveVersion === 'number' ? out.saveVersion : 1
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) break
    out = { ...step(out, content), saveVersion: version + 1 }
    version += 1
  }
  return out
}

/**
 * A look's shape: indexes rounded and clamped to the schema's 0–15 here, to the species' own ranges in repairHero
 * (clampLook); a field that is not a number or a frame is dropped and takes the hero id's default; a look that is not
 * an object is rebuilt whole from the id.
 */
const lookIndex = v.fallback(v.optional(v.pipe(v.number(), v.finite(), v.transform((n: number) => Math.min(LOOK_INDEX_MAX, Math.max(0, Math.round(n)))))), undefined)
const LookSchema = v.fallback(v.optional(v.object({ frame: v.fallback(v.optional(v.picklist(BODY_FRAMES)), undefined), skin: lookIndex, face: lookIndex, hair: lookIndex })), undefined)

const int = (min = 0) => v.fallback(v.pipe(v.number(), v.integer(), v.minValue(min)), min)
const record = <T extends v.GenericSchema>(item: T) => v.fallback(v.record(v.string(), item), {} as never)

/**
 * The Quest Board (07 §7; Phase 7, optional): a slot's numbers clamped, a board that does not parse dropped whole (the
 * board posts a fresh one); slots of contracts the content no longer has are dropped in validateProfile.
 */
const ContractSlotSchema = v.object({ contractId: v.string(), band: int(1), progress: int(), goal: int(1), claimed: v.fallback(v.boolean(), false) })

/**
 * Phase 8 (pass B), all optional. The codex (sim/src/codex.ts): counts are whole numbers ≥ 0 capped at CODEX_LIMITS.count,
 * lists are strings without repeats, cut to their caps; one entry that does not read becomes an empty one, never the
 * whole codex. The lesson's coach marks: ids without repeats. The backup reminder: a day count, the last day counted
 * (YYYY-MM-DD) and the last backup's time.
 */
const codexCount = v.fallback(v.pipe(v.number(), v.integer(), v.minValue(0), v.transform((n: number) => Math.min(CODEX_LIMITS.count, n))), 0)
const uniqueStrings = (cap: number, length = 80) =>
  v.fallback(
    v.pipe(
      v.array(v.string()),
      v.transform((list: string[]) => [...new Set(list.map((s) => s.slice(0, length)))].slice(0, cap)),
    ),
    [],
  )
const CodexMonsterSchema = v.fallback(
  v.object({ seen: codexCount, killed: codexCount, attacks: uniqueStrings(CODEX_LIMITS.attacksPerMonster), tells: uniqueStrings(CODEX_LIMITS.tellsPerMonster, CODEX_LIMITS.tellLength) }),
  { seen: 0, killed: 0, attacks: [], tells: [] },
)
const CodexSchema = v.object({ monsters: v.fallback(v.record(v.string(), CodexMonsterSchema), {}), materials: v.fallback(v.record(v.string(), codexCount), {}) })
const TutorialSchema = v.object({
  seen: uniqueStrings(64, 40),
  skipped: v.fallback(v.optional(v.boolean()), undefined),
  replay: v.fallback(v.optional(v.boolean()), undefined),
})
const BackupSchema = v.object({
  playDays: v.fallback(v.pipe(v.number(), v.integer(), v.minValue(0), v.transform((n: number) => Math.min(999, n))), 0),
  lastPlayDay: v.fallback(v.nullable(v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/))), null),
  lastBackupAt: v.fallback(v.nullable(v.pipe(v.string(), v.maxLength(40))), null),
})

const ContractBoardSchema = v.object({
  day: v.pipe(v.number(), v.integer()),
  week: v.pipe(v.number(), v.integer()),
  dailies: v.fallback(v.array(ContractSlotSchema), []),
  weekly: v.fallback(v.nullable(ContractSlotSchema), null),
  keysWeek: v.pipe(v.number(), v.integer()),
  keysStandard: int(),
  keysGrand: int(),
})

/** The envelope's shape: numbers clamped to their range, every list defaulted when missing. Heroes are checked below. */
const ProfileSchema = v.object({
  saveVersion: v.fallback(v.number(), SAVE_VERSION),
  heroes: v.fallback(v.array(v.looseObject({ id: v.string(), name: v.string(), speciesId: v.string(), classId: v.string(), look: LookSchema })), []),
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
      // 07 §6.1 (Phase 7, optional): kills by preset — Hard and Dread open on them. Unknown presets are dropped below.
      bossKillsByDifficulty: v.fallback(v.optional(v.record(v.string(), record(v.pipe(v.number(), v.integer(), v.minValue(0))))), undefined),
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
  contracts: v.fallback(v.optional(ContractBoardSchema), undefined),
  // Phase 8 (pass B), optional: a block that does not read is dropped whole (no codex yet, no mark seen, no day counted).
  codex: v.fallback(v.optional(CodexSchema), undefined),
  tutorial: v.fallback(v.optional(TutorialSchema), undefined),
  backup: v.fallback(v.optional(BackupSchema), undefined),
})

/** A pet's trait growth (03 §9; Phase 7, optional): uses a whole number ≥ 0, the rank inside the tuning's ranks. */
function clampPet<P extends PetInstance>(content: Content, pet: P): P {
  const maxRank = Math.max(1, content.tuning.pets.traitGrowth.usesForRank.length)
  const traitRank = Math.min(maxRank, Math.max(1, Math.round(Number.isFinite(pet.traitRank) ? pet.traitRank : 1)))
  const xp = typeof pet.traitXp === 'number' && Number.isFinite(pet.traitXp) ? Math.max(0, Math.round(pet.traitXp)) : undefined
  const { traitXp: _drop, ...rest } = pet
  return { ...rest, traitRank, ...(xp !== undefined ? { traitXp: xp } : {}) } as P
}

/** Arrows and bolts (08 §4, D-099; Phase 7, optional): ammo items the content knows, counts 0 … ammo.carryMax. */
function clampQuiver(content: Content, quiver: unknown): Record<string, number> | undefined {
  if (typeof quiver !== 'object' || quiver === null || Array.isArray(quiver)) return undefined
  const out: Record<string, number> = {}
  for (const [id, n] of Object.entries(quiver as Record<string, unknown>)) {
    if (!content.items.get(id)?.ammo || typeof n !== 'number' || !Number.isFinite(n)) continue
    out[id] = Math.min(content.tuning.ammo.carryMax, Math.max(0, Math.round(n)))
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export interface LoadReport {
  profile: Profile | null
  /** What was dropped or repaired, for the player and the log. */
  notes: string[]
}

function knownItem(content: Content, inst: ItemInstance | null, notes: string[], where: string): ItemInstance | null {
  if (!inst) return null
  // Phase 7: a Skill Tome names its skill (skillId); a Tome of a skill the game no longer has is put away like an unknown item.
  if (inst.skillId !== undefined) {
    if (typeof inst.skillId !== 'string' || !content.skills.has(inst.skillId)) {
      notes.push(`${where}: a Skill Tome of a skill the game no longer has was put away`)
      return null
    }
  }
  if (content.items.has(inst.itemId)) {
    const durability = Math.max(0, Math.min(100, Math.round(inst.durability ?? 100)))
    const maxDurability = Math.max(0, Math.min(100, Math.round(inst.maxDurability ?? 100)))
    return { ...inst, durability: Math.min(durability, maxDurability), maxDurability, quantity: Math.max(1, Math.round(inst.quantity ?? 1)) }
  }
  notes.push(`${where}: an item the game no longer has (${inst.itemId}) was put away`)
  return null
}

/**
 * Phase 7 (pass A), both optional: the witnessed uses of techniques not yet learned (a skill of the game's that the hero
 * does not know → a whole number 0–999), and the Insight pity (0 … pityUses). Anything else is dropped.
 */
function clampWitness(content: Content, raw: unknown, known: ReadonlySet<string>): Record<string, number> | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const out: Record<string, number> = {}
  for (const [id, n] of Object.entries(raw as Record<string, unknown>)) {
    if (!content.skills.has(id) || known.has(id) || typeof n !== 'number' || !Number.isFinite(n)) continue
    const v = Math.max(0, Math.min(999, Math.round(n)))
    if (v > 0) out[id] = v
  }
  return out
}

function clampInsightPity(content: Content, raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined
  return Math.max(0, Math.min(content.tuning.skills.insight.pityUses, Math.round(raw)))
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
  const petInstance = raw.petInstance && content.pets.has(raw.petInstance.petId) ? clampPet(content, raw.petInstance) : null
  const quiver = clampQuiver(content, raw.quiver)
  const techniqueWitness = clampWitness(content, raw.techniqueWitness, known)
  const insightPity = clampInsightPity(content, raw.insightPity)
  const { quiver: _quiver, techniqueWitness: _witness, insightPity: _pity, ...kept } = raw
  return {
    ...kept,
    ...(quiver ? { quiver } : {}),
    ...(techniqueWitness ? { techniqueWitness } : {}),
    ...(insightPity !== undefined ? { insightPity } : {}),
    // Phase 5: the look fits the species (a tone or preset the species no longer has falls back to the id's own).
    look: clampLook(raw.look, content.species.get(raw.speciesId), raw.id),
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
    const migrated = migrate(raw as Record<string, unknown>, content)
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
    const stables = p.stables.filter((s) => content.pets.has(s.petId)).map((s) => clampPet(content, s))
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
    // 07 §6.1: kills by preset keep the three presets only.
    const byDifficulty = p.progress.bossKillsByDifficulty
    const progress = byDifficulty === undefined ? p.progress : { ...p.progress, bossKillsByDifficulty: Object.fromEntries(Object.entries(byDifficulty).filter(([d]) => d === 'normal' || d === 'hard' || d === 'dread')) }
    // 07 §7: a board slot whose contract the content no longer has is dropped; progress never passes the goal.
    const slot = (x: NonNullable<Profile['contracts']>['weekly']) => (x && content.contracts.has(x.contractId) ? { ...x, progress: Math.min(x.progress, x.goal) } : null)
    const contracts = p.contracts ? { ...p.contracts, dailies: p.contracts.dailies.map(slot).filter((x): x is NonNullable<typeof x> => x !== null), weekly: slot(p.contracts.weekly) } : undefined
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
      progress,
      ...(contracts ? { contracts } : {}),
    }
    if (!contracts) delete (profile as { contracts?: unknown }).contracts
    // Phase 8 (pass B): an optional block that is missing stays missing (no `undefined` keys in the save).
    for (const key of ['codex', 'tutorial', 'backup'] as const) if (profile[key] === undefined) delete profile[key]
    if (profile.tutorial) {
      const t = profile.tutorial
      if (t.skipped === undefined) delete t.skipped
      if (t.replay === undefined) delete t.replay
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
