/**
 * The audio facade (Phase 8): the only audio module in the main bundle. Nothing sounds before the first tap (Android
 * Chrome starts audio only on a user gesture): the AudioContext is made inside that gesture and the engine is imported
 * then (`runtime.ts`, its own chunk). Until it arrives every call here is a quiet no-op; after it, a failure is a
 * console warning and silence, never an error — music never blocks play.
 *
 * It watches what the game already does and says: the route, the profile and the delve (the director picks the music
 * and the bed), the delve's log (doors, traps, chests, the stairs, the hunter), the toasts (an error), the purse (coins)
 * and every button's click (tap, confirm, back). The fight playback calls `audioFightBeat` for each beat it plays; the
 * Curio Merchant calls `audioChestReveal`. The context is suspended while the page is hidden or the sound is muted.
 */
import { effect, signal } from '@preact/signals'
import type { Content } from '../../../sim/src/content.ts'
import type { DelveState } from '../../../sim/src/delve-types.ts'
import type { FightState } from '../../../sim/src/fight-types.ts'
import { content, delve, delveVersion, profile, toasts } from '../game/session.ts'
import { resumeIndex, type Beat } from '../game/fightView.ts'
import { route } from '../ui/router.ts'
import { settings } from '../ui/store/settings.ts'
import { fightFinale, held } from '../ui/screens/delve/fight/prefs.ts'
import TUNING from './tuning.json'
import PLACES from './places.json'
import { decide, endStingers, isRareGrade, type DelveScene, type FightScene, type Request, type Scene, type StingerName } from './director.ts'
import { beatMusicCues, beatSounds, delveEventSound, hunterNear, thin, type SoundCue } from './sounds.ts'
import type { AudioRuntime } from './runtime.ts'

let rt: AudioRuntime | null = null
let ctx: AudioContext | null = null
let loading = false
let lastRequest: Request | null = null

/** The fight as the playback has shown it: the boss's phase and the hunters that answered the King. */
const shown = signal<{ fight: FightState | null; phase: number; hunters: readonly string[] }>({ fight: null, phase: 1, hunters: [] })
/** What a fight that just ended brought (read when its last beat plays): level-ups and a rare find. */
let pendingEnd: { levelUps: number; rare: boolean } | null = null

function volumes() {
  const s = settings.value
  return { master: s.masterVolume, music: s.musicVolume, sfx: s.sfxVolume, muted: s.muted }
}

function nowSec(): number {
  return typeof performance !== 'undefined' ? performance.now() / 1000 : 0
}

/** Plays an effect by id (a no-op before the first tap). */
export function audioEffect(id: string, pan = 0): void {
  rt?.effect(id, { pan })
}

function stingers(ids: readonly StingerName[]): void {
  if (ids.length) rt?.stingers(ids)
}

/** Running only while the page is visible and the sound is on (no work in the background, none while muted). */
function syncRunning(): void {
  const c = ctx
  if (!c || typeof document === 'undefined') return
  const want = document.visibilityState !== 'hidden' && !settings.value.muted
  try {
    if (want && c.state === 'suspended') void c.resume().catch(() => undefined)
    else if (!want && c.state === 'running') void c.suspend().catch(() => undefined)
  } catch {
    /* fine */
  }
}

let noContext = false

/** Creates the context inside the first gesture and loads the engine; a later tap retries an engine that failed to load. */
function unlock(): void {
  // A tap also wakes a context the browser suspended on its own (a call, another app taking the audio).
  if (rt) {
    syncRunning()
    return
  }
  if (loading || noContext || typeof window === 'undefined') return
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    try {
      if (!AC) throw new Error('Web Audio is not available')
      ctx = new AC({ latencyHint: 'interactive' })
    } catch (e) {
      console.warn('audio: no AudioContext', e)
      noContext = true
      return
    }
  }
  if (ctx.state === 'suspended' && !settings.value.muted) void ctx.resume().catch(() => undefined)
  loading = true
  void import('./runtime.ts')
    .then((m) => {
      if (!ctx) return
      rt = m.boot(ctx, import.meta.env.BASE_URL)
      rt.setVolumes(volumes())
      syncRunning()
      if (lastRequest) rt.apply(lastRequest)
    })
    .catch((e: unknown) => console.warn('audio: the engine did not load (the next tap tries again)', e))
    .finally(() => {
      loading = false
    })
}

/* ---------- the scene the director reads ---------- */

function zoneOf(c: Content, d: DelveState): string | null {
  const zone = c.dungeons.get(d.options.dungeonId)?.zones.find((z) => d.floor.number >= z.floors.from && d.floor.number <= z.floors.to)
  return zone?.id ?? null
}

/** The boss's phase and the hunters already shown when a HUD (re)starts on this fight. */
function initialShown(fight: FightState): { fight: FightState; phase: number; hunters: string[] } {
  let phase = 1
  const hunters: string[] = []
  const upTo = resumeIndex(fight)
  for (let i = 0; i < upTo; i++) {
    const e = fight.log[i]!
    if (e.kind !== 'arena') continue
    if (e.data?.what === 'phase') phase = Math.max(phase, Number(e.data.phase ?? 1))
    if (e.data?.what === 'hunterReturns' && !e.data.skipped && typeof e.data.hunter === 'string') hunters.push(e.data.hunter)
  }
  return { fight, phase, hunters }
}

function inDanger(fight: FightState): boolean {
  const heroes = fight.actors.filter((a) => a.kind === 'hero' && a.side === 'party' && !a.fallen && !a.gone)
  if (heroes.some((h) => h.downed)) return true
  const hp = heroes.reduce((s, h) => s + Math.max(0, h.hp), 0)
  const max = heroes.reduce((s, h) => s + h.maxHp, 0)
  return max > 0 && (hp * 100) / max < TUNING.dangerHpPercent
}

function spidersIn(c: Content | null, d: DelveState): boolean {
  const room = d.floor.graph.rooms.find((r) => r.id === d.floor.currentRoomId)
  if (!room) return false
  const words = PLACES.spiderFamilies
  if (words.some((w) => room.templateId.includes(w))) return true
  const enc = room.encounterId ? c?.encounters.get(room.encounterId) : undefined
  return !!enc && !d.floor.rooms[room.id]?.cleared && enc.composition.some((s) => words.some((w) => s.monsterId.includes(w)))
}

function delveScene(c: Content | null, d: DelveState): DelveScene {
  const fight = d.fight ?? (fightFinale.value ? held.fight : null)
  let f: FightScene | null = null
  if (fight) {
    const s = shown.value.fight === fight ? shown.value : initialShown(fight)
    f = { kind: d.fightContext?.kind ?? (fight.arena ? 'boss' : 'fight'), bossId: fight.arena?.bossId ?? null, phase: s.phase, hunters: s.hunters, danger: inDanger(fight) }
  }
  const room = d.floor.graph.rooms.find((r) => r.id === d.floor.currentRoomId)
  return {
    zoneId: c ? zoneOf(c, d) : null,
    phase: f ? 'fight' : d.phase.kind,
    outcome: d.phase.kind === 'over' ? d.phase.outcome : null,
    roomKind: room?.kind ?? null,
    spiders: spidersIn(c, d),
    fight: f,
  }
}

function sceneNow(): Scene {
  void delveVersion.value
  const r = route.value
  const d = delve.value
  return { screen: r.screen, townPlace: r.params.place ?? null, hasProfile: profile.value !== null, delve: d ? delveScene(content.value, d) : null }
}

/* ---------- the hooks the screens call ---------- */

let summary: SoundCue[] = []
let summaryQueued = false

/**
 * One beat of the fight playback (ui/screens/delve/fight/playback.ts). `live` is false when beats are flushed at once
 * (a skip, or Reduce motion): their sounds are gathered into one short summary instead of a pile-up.
 */
export function audioFightBeat(beat: Beat, fight: FightState | null, c: Content | null, speed: number, live: boolean): void {
  if (!fight) return
  try {
    if (shown.peek().fight !== fight) shown.value = initialShown(fight)
    const m = beatMusicCues(beat)
    const cur = shown.peek()
    if ((m.phase !== null && m.phase > cur.phase) || m.hunters.some((h) => !cur.hunters.includes(h))) {
      const phase = Math.max(cur.phase, m.phase ?? 1)
      shown.value = { fight, phase, hunters: [...new Set([...cur.hunters, ...m.hunters])] }
      if (phase > cur.phase && live) stingers(['bossPhase'])
    }
    if (!rt) return
    const sounds = beatSounds(beat, fight, c, speed)
    if (live) rt.cues(sounds)
    else {
      summary.push(...sounds)
      if (!summaryQueued) {
        summaryQueued = true
        queueMicrotask(() => {
          summaryQueued = false
          const list = thin(summary, 3)
          summary = []
          rt?.cues(list, 0.06)
        })
      }
    }
    const end = beat.events.find((e) => e.kind === 'end')
    if (end) {
      stingers(endStingers({ outcome: String(end.data?.outcome ?? ''), boss: !!fight.arena, levelUps: pendingEnd?.levelUps ?? 0, rare: pendingEnd?.rare ?? false }))
      pendingEnd = null
    }
  } catch (e) {
    console.warn('audio: a beat failed', e)
  }
}

/** A chest opened at the Curio Merchant: the reveal, and the rare-find stinger for an A-grade or a Divine Shard. */
export function audioChestReveal(result: { kind: string; grade?: string }): void {
  if (!rt) return
  const rare = result.kind === 'shard' || isRareGrade(result.grade, TUNING.rareGrades)
  rt.chestReveal(rare)
  if (rare) setTimeout(() => stingers(['rareDrop']), TUNING.rareRevealDelayMs)
}

/* ---------- the watchers ---------- */

function rareIn(c: Content | null, d: DelveState, from: number): boolean {
  return d.pile.slice(from).some((i) => isRareGrade(c?.items.get(i.itemId)?.grade, TUNING.rareGrades))
}

function watchDelve(): void {
  let watched: DelveState | null = null
  let logAt = 0
  let pileAt = 0
  let phaseWas = ''
  let snap: { levels: number[]; pile: number } | null = null
  let nearWas = false
  let nearAt = -1e9
  effect(() => {
    void delveVersion.value
    const d = delve.value
    if (d !== watched) {
      watched = d
      logAt = d?.log.length ?? 0
      pileAt = d?.pile.length ?? 0
      phaseWas = d?.phase.kind ?? ''
      nearWas = d ? hunterNear(d) : false
      snap = d && d.phase.kind === 'fight' ? { levels: d.heroes.map((h) => h.record.level), pile: d.pile.length } : null
      return
    }
    if (!d) return
    try {
      const c = content.peek()
      for (const e of d.log.slice(logAt)) {
        const id = delveEventSound(e)
        if (id) audioEffect(id)
      }
      logAt = d.log.length
      const phase = d.phase.kind
      if (phase === 'fight' && phaseWas !== 'fight') snap = { levels: d.heroes.map((h) => h.record.level), pile: d.pile.length }
      if (phaseWas === 'fight' && phase !== 'fight' && snap) {
        const before = snap
        pendingEnd = { levelUps: d.heroes.filter((h, i) => h.record.level > (before.levels[i] ?? Infinity)).length, rare: rareIn(c, d, before.pile) }
        snap = null
        pileAt = d.pile.length
      } else if (phase !== 'fight' && d.pile.length > pileAt) {
        if (rareIn(c, d, pileAt)) stingers(['rareDrop'])
        pileAt = d.pile.length
      } else if (d.pile.length < pileAt) pileAt = d.pile.length
      const near = hunterNear(d)
      if (near && !nearWas && nowSec() - nearAt > TUNING.hunterNearCooldownSec) {
        audioEffect('hunter-near')
        nearAt = nowSec()
      }
      nearWas = near
      phaseWas = phase
    } catch (e) {
      console.warn('audio: the delve watcher failed', e)
    }
  })
}

/** Which UI sound a click on this element makes, or null (pure; tested). */
export function clickSound(el: Element | null): string | null {
  const b = el?.closest?.('button, [role="button"], a[href]') as HTMLElement | null
  if (!b || (b as HTMLButtonElement).disabled || b.getAttribute('aria-disabled') === 'true') return null
  if (b.getAttribute('aria-label') === 'Back' || b.dataset.testid === 'back') return 'ui-back'
  if (b.classList.contains('btn--primary')) return 'ui-confirm'
  if (b.classList.contains('btn--danger')) return 'ui-heavy'
  return 'ui-tap'
}

/** Installs the first-gesture unlock, the background pause, the settings, the director and the watchers. Call once. */
export function installAudio(doc: Document): void {
  if (typeof window === 'undefined') return
  doc.addEventListener('pointerup', unlock, { passive: true })
  doc.addEventListener('keydown', unlock, { passive: true })
  doc.addEventListener('visibilitychange', syncRunning)
  doc.addEventListener(
    'click',
    (ev) => {
      const id = clickSound(ev.target as Element | null)
      if (id) audioEffect(id)
    },
    { capture: true, passive: true },
  )
  effect(() => {
    const v = volumes()
    rt?.setVolumes(v)
    syncRunning()
  })
  effect(() => {
    const r = decide(sceneNow())
    lastRequest = r
    rt?.apply(r)
  })
  watchDelve()
  let toastSeen = 0
  effect(() => {
    for (const t of toasts.value) {
      if (t.id <= toastSeen) continue
      toastSeen = t.id
      if (t.tone === 'bad') audioEffect('ui-error')
    }
  })
  let purseWas: number | null = null
  effect(() => {
    const p = profile.value
    const purse = p ? p.purse : null
    if (purseWas !== null && purse !== null && purse !== purseWas && route.peek().screen === 'town') audioEffect('ui-coins')
    purseWas = purse
  })
  ;(window as unknown as { __audio?: unknown }).__audio = {
    get state() {
      return rt ? rt.debug() : { unlocked: false, context: ctx?.state ?? null }
    },
    play: audioEffect,
    stingers,
  }
}
