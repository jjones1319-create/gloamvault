import { legalDelveActions } from '../../../../../sim/src/delve.ts'
import { choosePolicyCommand } from '../../../../../sim/src/policies.ts'
import { Rng } from '../../../../../sim/src/rng.ts'
import { content, delve, delveCommand, startDeepDelve } from '../../../game/session.ts'
import { perf } from '../../../scene/perf.ts'
import { fightAuto, fightFinale, setFightSpeed } from './fight/prefs.ts'

/**
 * The soak (10 §4; `#autoplay=1&minutes=30[&party=warden,blade,mender,arcanist][&level=4]`): an ephemeral party plays
 * delve after delve by itself — the scripted player walks the rooms at a reader's pace, the fight HUD's Auto fights at
 * 2× — while the stage's performance sample is logged every minute to `window.__gvSoak` (the soak tool reads it) and
 * the console. When the minutes are up `window.__gvSoakDone` is true and the party stops where it stands.
 *
 * The scripted player can pace between two rooms when the way to the rooms it has not seen is shut to it (the textbook
 * policy on Gravehollow floor 2, seed 101, walks r3 ↔ r4 for ever): after `STALE_MOVES` moves without a new room the
 * party takes the stairs if it stands by them, else starts the next delve — the soak keeps meeting new rooms and fights.
 */

export interface SoakSample {
  minute: number
  fps: number
  frameMs: number
  drawCalls: number
  triangles: number
  geometries: number
  textures: number
  gpuMb: number
  heapMb: number | null
  delves: number
  rooms: number
  fights: number
}

interface SoakWindow {
  __gvSoak?: SoakSample[]
  __gvSoakDone?: boolean
}

export interface AutoplayOptions {
  minutes: number
  classes: string[]
  species: string[]
  level: number
}

const STEP_MS = 1100
/** Moves in a row through rooms already seen before the soak gives up on the floor. */
const STALE_MOVES = 16

export async function startAutoplay(opts: AutoplayOptions): Promise<void> {
  const w = window as unknown as SoakWindow
  w.__gvSoak = []
  w.__gvSoakDone = false
  let seed = 101
  let floor = 1
  let delves = 0
  let rooms = 0
  let fights = 0
  let wasFight = false
  let lastRoom = ''
  // Rooms seen this delve, and moves in a row through ones already seen.
  let seen = new Set<string>()
  let stale = 0
  const rng = new Rng({ a: 7, b: 11, c: 13, d: 17 })
  const begin = async () => {
    delves++
    seen = new Set()
    stale = 0
    await startDeepDelve({ dungeonId: 'gravehollow-keep', floor, seed, classes: opts.classes, species: opts.species, level: opts.level, auto: false })
    seed++
    floor = (floor % 3) + 1
  }
  await begin()
  setFightSpeed(2)
  const started = performance.now()
  let minute = 0
  let busy = false
  const step = async () => {
    if (busy || w.__gvSoakDone) return
    busy = true
    try {
      const c = content.value
      const d = delve.value
      if (!c || !d) return
      const room = `${d.floor.number}:${d.floor.currentRoomId}`
      if (room !== lastRoom) {
        rooms++
        lastRoom = room
        if (seen.has(room)) stale++
        else {
          seen.add(room)
          stale = 0
        }
      }
      const inFight = d.phase.kind === 'fight'
      if (inFight && !wasFight) fights++
      wasFight = inFight
      if (inFight || fightFinale.value) {
        // The HUD fights (its Auto plays each hero's rule).
        if (!fightAuto.value) fightAuto.value = true
        return
      }
      if (d.phase.kind === 'over') {
        await begin()
        return
      }
      const legal = legalDelveActions(c, d)
      if (stale >= STALE_MOVES) {
        // Pacing: down the stairs if they are here, else the next delve.
        stale = 0
        const down = legal.find((a) => a.enabled && a.command.kind === 'descend')
        if (!down || !delveCommand(down.command)) await begin()
        return
      }
      const cmd = choosePolicyCommand('textbook', d, legal, rng)
      if (!cmd || !delveCommand(cmd)) await begin()
    } finally {
      busy = false
    }
  }
  const timer = window.setInterval(() => void step(), STEP_MS)
  const sampler = window.setInterval(() => {
    minute++
    const p = perf.value
    const sample: SoakSample = {
      minute,
      fps: p?.fps ?? 0,
      frameMs: p ? Math.round(p.frameMs * 100) / 100 : 0,
      drawCalls: p?.drawCalls ?? 0,
      triangles: p?.triangles ?? 0,
      geometries: p?.geometries ?? 0,
      textures: p?.textures ?? 0,
      gpuMb: p ? Math.round(p.gpuMb * 10) / 10 : 0,
      heapMb: p?.heapMb !== null && p?.heapMb !== undefined ? Math.round(p.heapMb * 10) / 10 : null,
      delves,
      rooms,
      fights,
    }
    w.__gvSoak!.push(sample)
    console.info(`soak ${JSON.stringify(sample)}`)
    if (performance.now() - started >= opts.minutes * 60_000) {
      w.__gvSoakDone = true
      window.clearInterval(timer)
      window.clearInterval(sampler)
    }
  }, 60_000)
}
