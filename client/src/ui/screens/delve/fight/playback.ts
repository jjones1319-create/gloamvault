import { useLayoutEffect, useRef, useState } from 'preact/hooks'
import type { Content } from '../../../../../../sim/src/content.ts'
import type { FightState } from '../../../../../../sim/src/fight-types.ts'
import type { StatusDef } from '../../../../../../sim/src/types/content.ts'
import {
  beatCues,
  beatFloaters,
  beatLine,
  beatMs,
  beatsOf,
  hpBehind,
  isQuietBeat,
  nameBook,
  noteCues,
  pushFeed,
  reconcileCues,
  resumeIndex,
  shownHp,
  type Beat,
  type FloaterTone,
  type NameBook,
  type StageState,
} from '../../../../game/fightView.ts'
import { beatAnims } from '../../../../game/fightAnims.ts'
import { beatFx } from '../../../../game/fightFx.ts'
import { audioFightBeat } from '../../../../audio/index.ts'
import { cue as sceneCue, type SceneCue } from '../../../../scene/sceneBus.ts'

/**
 * The playback of the fight log (Phase 4, D-085). The sim resolves a command and every turn up to the next hero's in
 * one step; the HUD then plays what happened as beats — a feed line, floating numbers, the scene's cues — one every
 * 450 ms at 1× (225 at 2×, 150 at 3×). A tap on the feed skips to the end; Reduce motion shows everything at once.
 * The action bar waits while a playback runs.
 */
export interface Floater {
  key: number
  actorId: string
  text: string
  tone: FloaterTone
}

export interface PlaybackHost {
  setTimer(fn: () => void, ms: number): number
  clearTimer(id: number): void
  cue(c: SceneCue): void
  /** Something the HUD shows changed (a beat played, a floater left). */
  changed(): void
}

/** How long a floating number stays up (the CSS animation runs a little shorter). */
export const FLOATER_MS = 1100

interface Memory {
  shown: number
  feed: string[]
  known: Map<string, StageState>
}

/** Where each fight's playback got to, so a remount (a trip to Settings and back) does not replay it. */
const memory = new WeakMap<FightState, Memory>()

export class FightPlayback {
  fight: FightState | null = null
  /** Events of `fight.log` already played. */
  shown = 0
  /** The beat on screen right now (its actor's name shows in the banner). */
  current: Beat | null = null
  feed: string[] = []
  floaters: Floater[] = []
  playing = false
  /** Bumped whenever what the HUD shows changes: passed down as a prop so signal-reading children re-render. */
  rev = 0
  speed = 1
  reduceMotion = false
  /** The content (Phase 5): with it, each beat also cues the acting hero's clip. */
  content: Content | null = null
  private queue: Beat[] = []
  private queuedTo = 0
  private book: NameBook | null = null
  private timer: number | null = null
  private floaterTimers = new Set<number>()
  private known = new Map<string, StageState>()
  private nextKey = 1
  private readonly host: PlaybackHost

  constructor(host: PlaybackHost) {
    this.host = host
  }

  private changed(): void {
    this.rev++
    this.host.changed()
  }

  /** Follows the fight on every render: a new fight starts from where it should; new events join the queue. */
  sync(fight: FightState | null, statuses?: ReadonlyMap<string, StatusDef>): void {
    if (fight !== this.fight) {
      this.remember()
      this.stopTimers()
      this.fight = fight
      const mem = fight ? memory.get(fight) : undefined
      this.shown = mem ? mem.shown : fight ? resumeIndex(fight) : 0
      this.feed = mem ? [...mem.feed] : []
      this.known = mem ? new Map(mem.known) : new Map()
      this.queue = []
      this.queuedTo = this.shown
      this.current = null
      this.floaters = []
      this.playing = false
      this.rev++
    }
    if (!fight) return
    this.book = nameBook(fight, statuses)
    if (fight.log.length > this.queuedTo) {
      this.queue.push(...beatsOf(fight.log, this.queuedTo))
      this.queuedTo = fight.log.length
      this.playing = true
      this.rev++
    }
  }

  /** Starts playing what is queued (after the render that queued it). */
  kick(): void {
    if (this.timer !== null || !this.playing) return
    if (this.reduceMotion) {
      this.flush(true)
      return
    }
    this.timer = this.host.setTimer(() => this.step(), 0)
  }

  /** Jumps to the end: every line lands in the feed, the scene catches up in one go. */
  skip(): void {
    if (!this.playing) return
    this.flush(false)
  }

  /** The HUD unmounts: stop, let the scene catch up, remember where we were. */
  dispose(): void {
    this.stopTimers()
    if (this.fight) for (const c of reconcileCues(this.fight, this.known)) this.host.cue(c)
    this.remember()
    this.fight = null
  }

  private step(): void {
    this.timer = null
    let beat = this.queue.shift()
    // Bookkeeping beats (a round tick, a status running out) pass without a pause.
    while (beat && isQuietBeat(beat)) {
      this.shown = beat.end
      beat = this.queue.shift()
    }
    if (!beat) {
      this.finish()
      return
    }
    this.play(beat, true, true)
    this.changed()
    const ends = beat.events.some((e) => e.kind === 'end')
    this.timer = this.host.setTimer(() => this.step(), beatMs(this.speed) * (ends ? 2 : 1))
  }

  private play(beat: Beat, cues: boolean, floaters: boolean): void {
    const book = this.book
    if (!book) return
    // Phase 8: the beat's sounds (a paced beat plays them; flushed beats make one short summary).
    audioFightBeat(beat, this.fight, this.content, this.speed, floaters)
    if (cues) {
      if (this.content && this.fight) for (const c of beatAnims(beat, this.fight, this.content, this.speed)) this.host.cue(c)
      // Each hit or heal carries the HP the beat leaves (the HUD's meters' own reckoning), so the scene's bar lands there.
      const fight = this.fight
      const behind = fight ? hpBehind(fight.log, beat.end) : null
      const list = beatCues(beat, (id) => {
        const a = fight && behind ? fight.actors.find((x) => x.id === id) : undefined
        return a && behind ? { hp: shownHp(a, behind), maxHp: a.maxHp } : undefined
      })
      noteCues(list, this.known)
      for (const c of list) this.host.cue(c)
      // Phase 6: the beat's effects (sparks, element marks, heals, status rings, an Ultimate's flourish); none with Reduce motion.
      if (this.content && this.fight && !this.reduceMotion && floaters) for (const c of beatFx(beat, this.fight, this.content)) this.host.cue(c)
    }
    this.feed = pushFeed(this.feed, beatLine(beat, book))
    this.current = beat
    this.shown = beat.end
    if (floaters && !this.reduceMotion) {
      for (const f of beatFloaters(beat, book)) {
        const key = this.nextKey++
        this.floaters = [...this.floaters, { key, ...f }]
        const id = this.host.setTimer(() => {
          this.floaterTimers.delete(id)
          this.floaters = this.floaters.filter((x) => x.key !== key)
          this.changed()
        }, FLOATER_MS)
        this.floaterTimers.add(id)
      }
    }
  }

  private flush(cues: boolean): void {
    if (this.timer !== null) this.host.clearTimer(this.timer)
    this.timer = null
    for (const beat of this.queue) this.play(beat, cues, false)
    this.queue = []
    this.finish()
  }

  private finish(): void {
    this.playing = false
    this.current = null
    this.shown = Math.max(this.shown, this.queuedTo)
    if (this.fight) for (const c of reconcileCues(this.fight, this.known)) this.host.cue(c)
    this.remember()
    this.changed()
  }

  private stopTimers(): void {
    if (this.timer !== null) this.host.clearTimer(this.timer)
    this.timer = null
    for (const id of this.floaterTimers) this.host.clearTimer(id)
    this.floaterTimers.clear()
  }

  private remember(): void {
    if (this.fight) memory.set(this.fight, { shown: this.shown, feed: [...this.feed], known: new Map(this.known) })
  }
}

/** The playback for the HUD: one controller per mount, synced on every render, started after it. */
export function usePlayback(fight: FightState | null, opts: { speed: number; reduceMotion: boolean; statuses?: ReadonlyMap<string, StatusDef>; content?: Content | null }): FightPlayback {
  const [, setTick] = useState(0)
  const ref = useRef<FightPlayback | null>(null)
  if (ref.current === null) {
    ref.current = new FightPlayback({
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (id) => window.clearTimeout(id),
      cue: sceneCue,
      changed: () => setTick((n) => n + 1),
    })
  }
  const pb = ref.current
  pb.speed = opts.speed
  pb.reduceMotion = opts.reduceMotion
  pb.content = opts.content ?? null
  pb.sync(fight, opts.statuses)
  useLayoutEffect(() => {
    pb.kick()
  })
  useLayoutEffect(() => () => pb.dispose(), [pb])
  return pb
}
