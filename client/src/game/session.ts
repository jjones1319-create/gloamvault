import { batch, computed, signal } from '@preact/signals'
import type { Content } from '../../../sim/src/content.ts'
import { boardClock } from '../../../sim/src/contracts.ts'
import { createDelve, legalDelveActions, replayDelve, runDelveAuto, stepDelve } from '../../../sim/src/delve.ts'
import type { DelveCommand, DelveState, LegalDelveAction } from '../../../sim/src/delve-types.ts'
import type { FightCommand } from '../../../sim/src/fight-types.ts'
import { heroAtLevel } from '../../../sim/src/hero.ts'
import type { DeathRule, Difficulty } from '../../../sim/src/types/enums.ts'
import { heroFromWayfarer } from '../../../sim/src/wayfarers.ts'
import { Rng } from '../../../sim/src/rng.ts'
import {
  abandonDelve,
  addHero,
  chooseHero,
  newProfile,
  recordDelveCommand,
  settleDelve,
  startDelve,
  syncQuestBoard,
  TownError,
  type DelveSummaryRecord,
  type Profile,
  type StartDelveInput,
} from '../../../sim/src/town.ts'
import type { CreateHeroInput } from '../../../sim/src/hero.ts'
import { idbStore, safeGet, type KeyValueStore } from '../save/db.ts'
import { addToHall, readHall, type HallEntry } from '../save/hall.ts'
import { endRun, eraseProfile, exportSave, freshProfile, importSave, readProfile, writeBackup, writeProfile } from '../save/profile.ts'
import { navigate } from '../ui/router.ts'

/**
 * The game session (Phase 4): the one place the screens go through. It holds the profile (town) and the delve in
 * progress as signals, steps the pure sim, and writes the save after every change (10 §6: a delve is saved as its
 * options, the party's starting records and the command log, so a reload replays it). Screens read the signals and
 * call the actions; none of them touches the sim's state directly.
 *
 * The sim mutates a DelveState in place (`stepDelve`), so `delveVersion` is bumped after every step for the screens'
 * computed values to re-run.
 */

export const content = signal<Content | null>(null)
export const profile = signal<Profile | null>(null)
export const delve = signal<DelveState | null>(null)
export const delveVersion = signal(0)
/** A deep-link session (shots, e2e, a debug link): never written to storage. */
export const ephemeral = signal(false)
export const sessionReady = signal(false)
/** What the save loader repaired, shown once in town. */
export const loadNotes = signal<string[]>([])
/** The Hall of Nightmares (D-095): the Nightmare saves that ended, newest first. */
export const hall = signal<HallEntry[]>([])

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'good' | 'bad'
}
export const toasts = signal<Toast[]>([])
let toastId = 0

export function toast(text: string, tone: Toast['tone'] = 'info'): void {
  const t = { id: ++toastId, text, tone }
  toasts.value = [...toasts.value.slice(-2), t]
  setTimeout(() => {
    toasts.value = toasts.value.filter((x) => x.id !== t.id)
  }, 3200)
}

let store: KeyValueStore | null = null
let contentPromise: Promise<Content> | null = null

/** The content bundle, loaded once in its own chunk so the title screen opens before it arrives. */
export function loadGameContent(): Promise<Content> {
  contentPromise ??= import('../content/load.ts').then((m) => {
    const c = m.loadContent()
    content.value = c
    return c
  })
  return contentPromise
}

export function requireContent(): Content {
  const c = content.value
  if (!c) throw new Error('content is not loaded yet')
  return c
}

/** Boots the save: reads the profile (or its newest backup) and resumes a delve in progress by replaying it. */
export async function bootSession(s: KeyValueStore = idbStore()): Promise<void> {
  store = s
  const c = await loadGameContent()
  if (ephemeral.value) {
    sessionReady.value = true
    return
  }
  hall.value = await readHall(s)
  const report = await readProfile(s, c)
  let p = report.profile
  const notes = [...report.notes]
  let resumed: DelveState | null = null
  if (p?.activeDelve) {
    try {
      resumed = replayDelve(c, p.activeDelve.options, p.activeDelve.party, p.activeDelve.commands)
    } catch {
      notes.push('A delve in progress could not be replayed; the party is back in town as it went in.')
      p = abandonDelve(p)
    }
  }
  batch(() => {
    profile.value = p
    delve.value = resumed
    loadNotes.value = notes
    sessionReady.value = true
  })
  if (notes.length && p) void save()
}

/** Asks the browser to keep our storage (Android Chrome evicts otherwise), once. */
export async function askPersist(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist()
  } catch {
    /* not available: fine */
  }
}

let saving: Promise<boolean> | null = null
let saveAgain = false

/** Writes the profile (coalesced: at most one write in flight, one queued). */
export async function save(): Promise<boolean> {
  if (ephemeral.value || !store || !profile.value) return false
  if (saving) {
    saveAgain = true
    return saving
  }
  saving = writeProfile(store, profile.value)
  const ok = await saving
  saving = null
  if (saveAgain) {
    saveAgain = false
    return save()
  }
  return ok
}

/* ---------- the profile ---------- */

/** A save worth continuing: a hero, or a town that has seen a delve or a loss (Mortal can leave a town with no heroes, D-090). */
export function hasSave(): boolean {
  const p = profile.value
  return p !== null && (p.heroes.length > 0 || p.progress.delves > 0 || p.memorial.length > 0)
}

/** A new save with the player's death rule (D-088, D-095: Mortal, the dead stay dead; Sheltered, nobody is lost; Nightmare, the chosen hero's death ends the save). */
export function startNewGame(deathRule: DeathRule = 'mortal'): void {
  batch(() => {
    ephemeral.value = false
    profile.value = freshProfile(Date.now(), deathRule)
    delve.value = null
  })
  void save()
  void askPersist()
}

/**
 * Runs a town action: `fn` gets the content and the current profile and returns the next one. A TownError (not
 * enough gold, a locked tier…) becomes a toast instead of a crash; success saves.
 */
export function act(fn: (c: Content, p: Profile) => Profile, okText?: string): boolean {
  const c = content.value
  const p = profile.value
  if (!c || !p) return false
  try {
    profile.value = fn(c, p)
    if (okText) toast(okText, 'good')
    void save()
    return true
  } catch (e) {
    toast(e instanceof TownError ? e.message : `Something went wrong: ${e instanceof Error ? e.message : String(e)}`, 'bad')
    if (!(e instanceof TownError)) console.error(e)
    return false
  }
}

/** Like `act` for actions that return a result beside the profile (a chest's contents). */
export function actWith<R>(fn: (c: Content, p: Profile) => { profile: Profile; result: R }): R | null {
  let out: R | null = null
  act((c, p) => {
    const r = fn(c, p)
    out = r.result
    return r.profile
  })
  return out
}

/**
 * The selection (D-090): makes the player's chosen hero — the first of the save, or a new one after the chosen hero is
 * gone. A legacy the last chosen hero left passes to them at once.
 */
export function createHero(input: Omit<CreateHeroInput, 'id'>): string | null {
  let id: string | null = null
  let legacyText = ''
  const ok = act((c, p) => {
    const r = chooseHero(c, p ?? freshProfile(), input)
    id = r.hero.id
    if (r.legacy) legacyText = ` and takes up ${r.legacy.name}'s legacy (+${r.legacy.xp} XP)`
    return r.profile
  })
  if (ok) toast(`${input.name} joins the roster${legacyText}`, 'good')
  return id
}

/* ---------- the Quest Board (07 §7) ---------- */

/**
 * The board's day and week from this device's clock (the sim never reads one): local wall time as UTC milliseconds,
 * a day from 04:00, a week from Monday 04:00 (tuning contracts.resetHour / weekStartsOn).
 */
export function boardClockNow(c: Content, now: Date = new Date()): { day: number; week: number } {
  return boardClock(c.tuning, now.getTime() - now.getTimezoneOffset() * 60_000)
}

/** Posts the Quest Board when a day or a week has turned over (saved); a no-op otherwise. */
export function syncBoard(): void {
  const c = content.value
  const p = profile.value
  if (!c || !p) return
  const next = syncQuestBoard(c, p, boardClockNow(c))
  if (next === p) return
  profile.value = next
  void save()
}

/* ---------- delves ---------- */

export const legalActions = computed<LegalDelveAction[]>(() => {
  void delveVersion.value
  const c = content.value
  const d = delve.value
  return c && d ? legalDelveActions(c, d) : []
})

export function enterDelve(input: StartDelveInput): boolean {
  const c = content.value
  const p = profile.value
  if (!c || !p) return false
  try {
    const r = startDelve(c, p, input)
    batch(() => {
      profile.value = r.profile
      delve.value = r.state
      delveVersion.value++
    })
    void save()
    navigate('delve')
    return true
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), 'bad')
    return false
  }
}

/** One delve command through the sim; the command log is saved so a reload replays to here. */
export function delveCommand(command: DelveCommand): boolean {
  const c = content.value
  const d = delve.value
  if (!c || !d) return false
  try {
    stepDelve(c, d, command)
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), 'bad')
    return false
  }
  batch(() => {
    if (profile.value) profile.value = recordDelveCommand(profile.value, command)
    delveVersion.value++
  })
  void save()
  return true
}

export function fightCommand(command: FightCommand): boolean {
  return delveCommand({ kind: 'fight', command })
}

/** Brings a finished delve home and returns to town; the backup rotates. */
export function finishDelve(): DelveSummaryRecord | null {
  const c = content.value
  const d = delve.value
  const p = profile.value
  if (!c || !d || !p || d.phase.kind !== 'over') return null
  // 07 §7: the board is posted for today before the delve's progress lands on it.
  const r = settleDelve(c, ephemeral.value ? p : syncQuestBoard(c, p, boardClockNow(c)), d)
  if (r.hall) {
    // D-095: the Nightmare ends. The save and its backups are erased (after any write still in flight, so nothing
    // brings it back) and the Hall keeps one line.
    const record = r.hall
    batch(() => {
      profile.value = null
      delve.value = null
      delveVersion.value++
    })
    const s = store
    if (s && !ephemeral.value)
      void (async () => {
        if (saving) await saving
        hall.value = await addToHall(s, record, new Date())
        await endRun(s)
      })()
    else hall.value = [{ ...record, endedAt: new Date().toISOString() }, ...hall.value]
    return r.summary
  }
  batch(() => {
    profile.value = r.profile
    delve.value = null
    delveVersion.value++
  })
  void save()
  if (store && !ephemeral.value) void writeBackup(store, r.profile)
  return r.summary
}

/* ---------- backups ---------- */

export function exportCurrentSave(): string | null {
  return profile.value ? exportSave(profile.value) : null
}

export async function importSaveText(text: string): Promise<boolean> {
  const c = content.value
  if (!c) return false
  const r = importSave(c, text)
  if (!r.profile) {
    toast(r.notes[0] ?? 'That save could not be read.', 'bad')
    return false
  }
  if (store && profile.value && !ephemeral.value) await writeBackup(store, profile.value)
  batch(() => {
    profile.value = r.profile
    delve.value = null
    ephemeral.value = false
  })
  await save()
  toast(r.notes.length ? `Save loaded (${r.notes.length} thing(s) repaired)` : 'Save loaded', 'good')
  return true
}

/** Settings → Erase: a backup is taken first, then the save is gone on purpose (a reload never brings it back). */
export async function eraseSave(): Promise<void> {
  if (store && profile.value) await writeBackup(store, profile.value)
  batch(() => {
    profile.value = null
    delve.value = null
  })
  if (store) await eraseProfile(store)
}

export async function hasBackup(): Promise<boolean> {
  return store ? (await safeGet(store, 'gloamvault/profile-backup-0')) !== undefined : false
}

/* ---------- deep links (07 §8.3; CLAUDE.md "Deep links the client honours") ---------- */

export interface DeepDelve {
  dungeonId: string
  floor: number
  seed: number
  classes: string[]
  /** `&species=dwarf,elf`: each hero's species in party order (Human when missing or unknown). */
  species?: string[]
  /** `&level=N`; absent: level 1, or the zone's recommended level under `zone`. */
  level?: number
  /**
   * `&zone=N` (07 §8.3 link 1; C1, Phase 7): the dungeon's N-th zone — the delve starts on its first floor (Gravehollow:
   * 1 → F1, 2 → F4, 3 → F7) with the heroes at its recommended level (07 §1: the first floor's monster level) unless
   * `level` names one. `floor` is ignored when it is set.
   */
  zone?: number
  auto: boolean
  /** `&death=sheltered` (D-088); Mortal by default, like a new save. */
  deathRule?: DeathRule
  /** `&learn=mender-breath-of-life,…`: skills each hero of the skill's class also knows (shots of a raise, D-089). */
  learn?: string[]
  /** Play the whole delve with the scripted player (the end card shows). */
  toEnd?: boolean
  /** `&difficulty=hard` (07 §8.3 link 2); Normal by default. */
  difficulty?: Difficulty
  /** `&pacts=candle,hungry-hunter` (07 §8.3 link 3): Pact ids, or the start of one ("candle" → candle-pact). */
  pacts?: string[]
  /** `&room=boss` (07 §8.3 links 2 and 7): the party at the boss's door with the floor behind it cleared; `auto=1` walks in. */
  room?: 'boss'
}

/**
 * `#delve=gravehollow&zone=1&seed=17&party=warden,mender&auto=1`: an ephemeral party (never saved) dropped into a
 * delve; `auto=1` lets the scripted player run to the first fight so the screenshot shows one. `&level=N` raises the
 * heroes (D-082).
 */
export async function startDeepDelve(d: DeepDelve): Promise<void> {
  const c = await loadGameContent()
  const dungeonId = c.dungeons.has(d.dungeonId) ? d.dungeonId : (c.dungeons.has(`${d.dungeonId}-keep`) ? `${d.dungeonId}-keep` : [...c.dungeons.keys()][0]!)
  // 07 §8.3 link 1: `zone=N` is the N-th zone's first floor, at its recommended level unless the link names one.
  const dungeonDef = c.dungeons.get(dungeonId)
  const zones = [...(dungeonDef?.zones ?? [])].sort((a, b) => a.floors.from - b.floors.from)
  const zone = d.zone !== undefined && zones.length > 0 ? zones[Math.min(zones.length, Math.max(1, d.zone)) - 1] : undefined
  const floor = zone ? zone.floors.from : d.floor
  const level = d.level ?? (zone ? (dungeonDef?.floors.find((f) => f.floor === floor)?.monsterLevel ?? 1) : 1)
  let p = newProfile(d.seed, d.deathRule ?? 'mortal')
  const egg = [...c.pets.values()].find((x) => x.creationChoice)
  d.classes.slice(0, 4).forEach((cls, i) => {
    if (!c.classes.has(cls)) return
    const speciesId = d.species?.[i] && c.species.has(d.species[i]!) ? d.species[i]! : 'human'
    p = addHero(c, p, { name: cls[0]!.toUpperCase() + cls.slice(1), speciesId, classId: cls, eggPetId: egg?.id ?? null }).profile
  })
  if (p.heroes.length === 0) p = addHero(c, p, { name: 'Warden', speciesId: 'human', classId: 'warden', eggPetId: egg?.id ?? null }).profile
  if (level > 1) p = { ...p, heroes: p.heroes.map((h) => heroAtLevel(c, c.tuning, h, level)) }
  if (d.learn?.length) {
    p = {
      ...p,
      heroes: p.heroes.map((h) => {
        const extra = d.learn!.filter((id) => c.skills.get(id)?.classId === h.classId && !h.skills.some((k) => k.skillId === id))
        return extra.length ? { ...h, skills: [...h.skills, ...extra.map((skillId) => ({ skillId, rank: 1, xp: 0 }))] } : h
      }),
    }
  }
  // D-095: under Nightmare the first hero is the chosen one and leads.
  if (p.deathRule === 'nightmare' && p.heroes[0]) p = { ...p, chosenId: p.heroes[0].id }
  // 07 §8.3: a deep link may name the preset and the Pacts (`&difficulty=hard&pacts=candle,hungry-hunter`).
  const pacts = c.dungeons.get(dungeonId)?.pacts ?? []
  const pactIds = [...new Set((d.pacts ?? []).map((w) => pacts.find((x) => x.id === w)?.id ?? pacts.find((x) => x.id.startsWith(w))?.id).filter((id): id is string => id !== undefined))]
  const state = createDelve(c, { dungeonId, floor, seed: d.seed, difficulty: d.difficulty ?? 'normal', pactIds, auto: false, policy: 'textbook', deathRule: p.deathRule, ...(p.deathRule === 'nightmare' && p.chosenId ? { leaderId: p.chosenId } : {}), bossKills: { ...p.progress.bossKills } }, p.heroes)
  if (d.room === 'boss') standAtBossDoor(state)
  if (d.room === 'boss' && d.auto) {
    // The party walks into the arena: the boss fight starts (pass C2's link for the arena's shots).
    const boss = state.floor.graph.rooms.find((r) => r.kind === 'boss')
    if (boss) stepDelve(c, state, { kind: 'move', toRoomId: boss.id })
  } else if (d.toEnd) {
    // `end=1`: the scripted player plays the whole delve, so the end card shows (for screenshots).
    runDelveAuto(c, state)
  } else if (d.auto) {
    // The scripted player walks until the first fight starts (or the delve ends).
    const rng = new Rng({ a: d.seed >>> 0, b: 7, c: 11, d: 13 })
    const { choosePolicyCommand } = await import('../../../sim/src/policies.ts')
    for (let i = 0; i < 400 && state.phase.kind !== 'fight' && state.phase.kind !== 'over'; i++) {
      const cmd = choosePolicyCommand('textbook', state, legalDelveActions(c, state), rng)
      if (!cmd) break
      stepDelve(c, state, cmd)
    }
  }
  batch(() => {
    ephemeral.value = true
    profile.value = { ...p, activeDelve: { options: state.options, party: p.heroes, commands: [] } }
    delve.value = state
    delveVersion.value++
    sessionReady.value = true
  })
}

/** 07 §8.3 links 2 and 7: every room but the boss's visited and cleared, the party in the room at its door, the key in hand. */
function standAtBossDoor(state: DelveState): void {
  const boss = state.floor.graph.rooms.find((r) => r.kind === 'boss')
  if (!boss) return
  const door = state.floor.graph.rooms.find((r) => r.id !== boss.id && (r.doors.some((x) => x.to === boss.id) || boss.doors.some((x) => x.to === r.id)))
  if (!door) return
  for (const [id, rs] of Object.entries(state.floor.rooms)) {
    if (id === boss.id) continue
    rs.visited = true
    rs.cleared = true
    rs.scouted = true
  }
  state.floor.hasKey = true
  state.floor.currentRoomId = door.id
  state.phase = { kind: 'room' }
}

/**
 * `#town`: a demo profile for screenshots when there is no save (ephemeral). Orrin is the chosen hero; Pip Marrowby
 * came from a Wayfarer Chest; Varra Dawnscale lies at the Shrine; Bram Ostler was laid to rest and left a legacy (D-088–D-091).
 */
export async function startDemoTown(): Promise<void> {
  const c = await loadGameContent()
  if (profile.value && !ephemeral.value) return
  let p = newProfile(42)
  const egg = [...c.pets.values()].find((x) => x.creationChoice)
  p = addHero(c, p, { name: 'Orrin', speciesId: 'dwarf', classId: 'warden', eggPetId: egg?.id ?? null }).profile
  p = { ...p, purse: 320, bank: 150, eggs: [{ petId: 'spiderling', grade: 'F' }], progress: { ...p.progress, deepest: { 'gravehollow-keep': 1 }, delves: 3, clears: 0, wipes: 0 } }
  const rng = Rng.fromSeed(42)
  const pip = c.wayfarers.get('pip-marrowby')
  const varra = c.wayfarers.get('varra-dawnscale')
  if (pip && varra) {
    const pipHero = heroFromWayfarer(c, c.tuning, rng, pip, 'hero-2', 1)
    const varraHero = heroFromWayfarer(c, c.tuning, rng, varra, 'hero-3', 3)
    p = {
      ...p,
      seedCounter: Math.max(p.seedCounter, 3),
      heroes: [...p.heroes, pipHero, varraHero],
      partyIds: [...p.partyIds, 'hero-2'],
      wayfarerOf: { 'hero-2': pip.id, 'hero-3': varra.id },
      dead: [{ heroId: 'hero-3', dungeonId: 'gravehollow-keep', floor: 1 }],
      legacies: [{ id: 'legacy-demo', heroId: 'hero-0', name: 'Bram Ostler', classId: 'warden', level: 2, xp: 30, fromChosen: false }],
      memorial: [{ name: 'Bram Ostler', speciesId: 'human', classId: 'warden', level: 2, chosen: false, wayfarerId: 'bram-ostler', dungeonId: 'gravehollow-keep', floor: 1, delve: 2, how: 'laidToRest' }],
    }
  }
  batch(() => {
    ephemeral.value = true
    profile.value = p
    sessionReady.value = true
  })
}
