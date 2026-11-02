/**
 * `npm run balance:walk [-- --seeds 30 --party warden,mender --level 1 --light 100 --tag walk]` — the walked floor's
 * runner (Phase 17, D-149–D-152; 12 §3 row 17): a scripted tour of Floor 1 as the phone plays it — room to room over
 * the floor's doors at walking pace (2.4 m/s), the seconds walked fed to the random-encounter clock, the monsters at
 * their spots engaged, chests and gold taken, spotted traps disarmed, the curios answered by the scripted player, the
 * fights on auto, the stair last — and what the tour says: fights per ten minutes walked, the hero's level at the end
 * against the floor's band, wipes, the light at the stair, gold, time. Writes docs/balance/<date>-<tag>.md.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createParty } from '../../sim/src/bridge.ts'
import type { Content } from '../../sim/src/content.ts'
import { createDelve, legalDelveActions, stepDelve } from '../../sim/src/delve.ts'
import type { DelveOptions, DelveState } from '../../sim/src/delve-types.ts'
import type { FloorGraph, FloorRoom } from '../../sim/src/generator.ts'
import { lightBand } from '../../sim/src/light.ts'
import type { DungeonDef } from '../../sim/src/types/content.ts'
import { loadContentDir } from '../sim/loadContent.ts'

const args = process.argv.slice(2)
const flag = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1]! : fallback
}
const SEEDS = Number(flag('seeds', '30'))
const PARTY = flag('party', 'warden').split(',').map((classId) => ({ classId, speciesId: 'dwarf' }))
const LEVEL = Number(flag('level', '1'))
const LIGHT = Number(flag('light', '100'))
const TAG = flag('tag', 'walk')
const LAYOUT = flag('layout', 'floor-1')
const WALK_MPS = 2.4
const CELL = 8
const CAP = 4000

const content: Content = loadContentDir('content')
const layout = content.floorLayouts.get(LAYOUT)
if (!layout) throw new Error(`no floor layout '${LAYOUT}'`)
const dungeon = content.dungeons.get(layout.dungeonId) as DungeonDef
const fd = dungeon.floors.find((f) => f.floor === layout.floor)!
const fdNext = dungeon.floors.find((f) => f.floor === layout.floor + 1)
const bandTop = fdNext ? Math.max(fd.monsterLevel, fdNext.monsterLevel) : fd.monsterLevel + content.tuning.exploration.walk.bandWidth
const w = content.tuning.exploration.walk

interface Row {
  seed: number
  outcome: string
  seconds: number
  commands: number
  rooms: number
  randomFights: number
  placedFights: number
  fights: number
  level: number
  battleXp: number
  hpPercent: number
  gold: number
  lightEnd: number
  bandEnd: string
  chests: number
  downs: number
  hunter: boolean
}

function centre(r: FloorRoom): [number, number] {
  let x = 0
  let y = 0
  for (const c of r.cells) {
    x += c.x
    y += c.y
  }
  return [(x / r.cells.length) * CELL + CELL / 2, (y / r.cells.length) * CELL + CELL / 2]
}
function metres(graph: FloorGraph, a: string, b: string): number {
  const ra = graph.rooms.find((r) => r.id === a)!
  const rb = graph.rooms.find((r) => r.id === b)!
  const [ax, ay] = centre(ra)
  const [bx, by] = centre(rb)
  return Math.hypot(ax - bx, ay - by)
}

/** The rooms from `from` to the nearest room the predicate wants, over doors the party can pass now. */
function barred(state: DelveState, roomId: string, to: string): number | null {
  const rs = state.floor.rooms[roomId]
  if (!rs) return null
  const i = rs.traps.findIndex((tr) => tr.blocksDoorTo === to && tr.revealed && !tr.disarmed && !tr.triggered)
  return i < 0 ? null : i
}

function pathTo(state: DelveState, from: string, want: (id: string) => boolean, canSetOff = false): string[] | null {
  const g = state.floor.graph
  const prev = new Map<string, string | null>([[from, null]])
  const queue = [from]
  while (queue.length) {
    const id = queue.shift()!
    if (id !== from && want(id)) {
      const out: string[] = []
      for (let cur: string | null = id; cur !== null && cur !== from; cur = prev.get(cur) ?? null) out.unshift(cur)
      return out
    }
    const room = g.rooms.find((r) => r.id === id)!
    for (const d of room.doors) {
      if (prev.has(d.to)) continue
      if (d.locked && !state.floor.hasKey) continue
      if (d.secret && !state.floor.rooms[id]?.secretRevealed && !state.floor.rooms[d.to]?.secretRevealed) continue
      if (!canSetOff && barred(state, id, d.to) !== null) continue
      prev.set(d.to, id)
      queue.push(d.to)
    }
  }
  return null
}

function play(seed: number): Row {
  const options: DelveOptions = { dungeonId: dungeon.id, floor: layout!.floor, lastFloor: layout!.floor, floorLayoutId: LAYOUT, seed, difficulty: 'normal', pactIds: [], auto: false, policy: 'textbook', light: LIGHT }
  const party = createParty(content, seed, PARTY).map((h) => (LEVEL > 1 ? { ...h, level: LEVEL } : h))
  const s = createDelve(content, options, party)
  let seconds = 0
  let placed = 0
  const step = (c: Parameters<typeof stepDelve>[2]) => stepDelve(content, s, c)
  const settle = (): void => {
    for (let i = 0; i < 800 && s.phase.kind !== 'room' && s.phase.kind !== 'over'; i++) step({ kind: 'auto' })
  }
  // The careful player's chores: chests, gold, the rest; a spotted trap disarmed only with a fair hand (>= DISARM_AT %),
  // set off on purpose only when it bars a door, else left where it lies.
  const DISARM_AT = 60
  const chores = (): void => {
    const left = new Set<number>()
    for (let i = 0; i < 12 && s.phase.kind === 'room'; i++) {
      const acts = legalDelveActions(content, s).filter((a) => a.enabled)
      const easy = acts.find((a) => a.command.kind === 'openChest' || a.command.kind === 'takeGold' || a.command.kind === 'rest')
      if (easy) { step(easy.command); settle(); continue }
      const hero = s.heroes[0]!
      const potion = hero.hpPercent < 45 ? acts.find((a) => a.command.kind === 'useItem' && /potion/i.test(a.label) && (a.command as { heroIndex: number }).heroIndex === 0) : undefined
      if (potion) { step(potion.command); settle(); continue }
      let picked: (typeof acts)[number] | null = null
      for (const a of acts) {
        if (a.command.kind !== 'disarm' || left.has(a.command.trapIndex)) continue
        const chance = Number(/(\d+)%\)\s*$/.exec(a.label)?.[1] ?? 0)
        if (chance >= DISARM_AT) { picked = a; break }
        left.add(a.command.trapIndex)
      }
      if (!picked) return
      step(picked.command)
      settle()
    }
  }
  /** One door: a spotted trap barring it is set off first; the rules' own refusal (a trap it knows and the tour missed) is answered the same way, once. */
  const moveTo = (to: string): boolean => {
    // A gauntlet can bar one door with several traps (Floor 1's r21: three cage drops): each is set off in turn.
    for (let attempt = 0; attempt < 6; attempt++) {
      if (s.phase.kind !== 'room') return false
      const bar = barred(s, s.floor.currentRoomId, to)
      if (bar !== null) { step({ kind: 'walkAround', trapIndex: bar }); settle(); if (s.phase.kind !== 'room') return false }
      try {
        step({ kind: 'move', toRoomId: to })
        settle()
        return s.floor.currentRoomId === to
      } catch (e) {
        if (attempt === 5 || !/trap blocks/.test((e as Error).message)) throw e
      }
    }
    return false
  }
  const walk = (sec: number): void => {
    if (sec <= 0) return
    step({ kind: 'walk', seconds: sec })
    seconds += sec
    settle()
  }
  const visited = new Set<string>([s.floor.currentRoomId])
  while (s.phase.kind !== 'over' && s.commandLog.length < CAP) {
    settle()
    if ((s.phase.kind as string) === 'over') break
    const here = s.floor.currentRoomId
    visited.add(here)
    const rs = s.floor.rooms[here]!
    // The monsters waiting here: fight them (the tour clears everything, as a careful player would).
    if (!rs.cleared && rs.encounterId) {
      walk(Math.round(3 / WALK_MPS))
      if (s.phase.kind !== 'room') continue
      if (!s.floor.rooms[here]!.cleared) {
        placed++
        step({ kind: 'engage' })
        settle()
        continue
      }
    }
    chores()
    if (s.phase.kind !== 'room') continue
    // A curio waits to be looked at.
    if (rs.curioId && !rs.curioUsed) {
      step({ kind: 'examine' })
      settle()
      continue
    }
    // Secret doors here: found (the tour has sharp eyes).
    const g = s.floor.graph.rooms.find((r) => r.id === here)!
    for (const d of g.doors) if (d.secret && !rs.secretRevealed && !s.floor.rooms[d.to]?.secretRevealed) step({ kind: 'reveal', toRoomId: d.to })
    // Spent (the textbook player's rule): under 25% with no potion, the nearest way out.
    const hero = s.heroes[0]!
    const hasPotion = legalDelveActions(content, s).some((a) => a.enabled && a.command.kind === 'useItem' && /potion/i.test(a.label))
    const exits = new Set<string>([s.floor.graph.entryId, ...(s.floor.exitRooms ?? [])])
    if (hero.hpPercent < 25 && !hasPotion) {
      if (exits.has(here)) { step({ kind: 'retreat' }); break }
      const home = pathTo(s, here, (id) => exits.has(id), true)
      if (home) {
        let at = here
        for (const to of home) {
          walk(Math.max(1, Math.round(metres(s.floor.graph, at, to) / WALK_MPS)))
          if (s.phase.kind !== 'room') break
          if (!moveTo(to)) break
          at = to
          if (s.phase.kind !== 'room') break
        }
        if (s.phase.kind === 'room' && exits.has(s.floor.currentRoomId)) { step({ kind: 'retreat' }); break }
        continue
      }
    }
    // Next: the nearest room not yet visited (through a barred door only when hale); none left, the stair.
    const hale = hero.hpPercent >= 60
    const next = pathTo(s, here, (id) => !visited.has(id), hale) ?? (here === s.floor.graph.exitId ? null : pathTo(s, here, (id) => id === s.floor.graph.exitId, true))
    if (!next) {
      if (here === s.floor.graph.exitId) {
        step({ kind: 'descend' })
        settle()
        break
      }
      step({ kind: 'retreat' })
      break
    }
    let cur = here
    for (const to of next) {
      walk(Math.max(1, Math.round(metres(s.floor.graph, cur, to) / WALK_MPS)))
      if (s.phase.kind !== 'room') break
      if (!moveTo(to)) break
      cur = to
      visited.add(to)
      if (s.phase.kind !== 'room') break
      const nrs = s.floor.rooms[to]!
      if (!nrs.cleared && nrs.encounterId) break
    }
  }
  if (process.env['WALK_DEBUG'] === String(seed)) for (const e of s.log) console.log(`  [${e.roomId}] ${e.kind}: ${e.text}`)
  const hero = s.heroes[0]!
  return {
    seed,
    outcome: s.phase.kind === 'over' ? s.phase.outcome : 'capped',
    seconds,
    commands: s.commandLog.length,
    rooms: visited.size,
    randomFights: s.floor.walk?.randomFights ?? 0,
    placedFights: placed,
    fights: s.stats.fights,
    level: hero.record.level,
    battleXp: hero.record.battleXp,
    hpPercent: hero.hpPercent,
    gold: s.gold,
    lightEnd: s.light,
    bandEnd: lightBand(content.tuning, s.light).id,
    chests: s.stats.chestsOpened ?? 0,
    downs: s.stats.downs,
    hunter: s.stats.hunterArrived > 0,
  }
}

const rows: Row[] = []
const t0 = Date.now()
for (let seed = 1; seed <= SEEDS; seed++) {
  try {
    rows.push(play(seed))
  } catch (e) {
    console.error(`seed ${seed}: ${(e as Error).message}`)
  }
}
const ms = Date.now() - t0
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const f1 = (n: number) => n.toFixed(1)
const minutes = rows.map((r) => r.seconds / 60)
const per10 = rows.map((r) => (r.seconds > 0 ? (10 * r.randomFights) / (r.seconds / 60) : 0))
const placedSpots = layout.spots.filter((x) => x.kind === 'encounter').length
const cleared = rows.filter((r) => r.outcome === 'cleared').length
const wipes = rows.filter((r) => r.outcome === 'wiped' || r.outcome === 'chosenDied').length
const judge: string[] = []
const fightsPer10 = mean(per10)
judge.push(`${fightsPer10 >= 2 && fightsPer10 <= 8 ? 'ok ' : fightsPer10 < 2 ? 'LOW' : 'HI '} random fights per 10 min walked ${f1(fightsPer10)} (target 2–8 at the tour's pace, which walks 3–4× faster than a player exploring; a floor at a player's pace lands 6–13 fights per 10 min with the placed ones) · placed fights ${f1(mean(rows.map((r) => r.placedFights)))} of ${placedSpots} spots · ${f1(mean(rows.map((r) => r.fights)))} fights over ${f1(mean(minutes))} min`)
const lvl = mean(rows.map((r) => r.level))
judge.push(`${Math.abs(lvl - bandTop) <= 1 ? 'ok ' : lvl < bandTop - 1 ? 'LOW' : 'HI '} level at the end ${f1(lvl)} (the band's top is ${bandTop}; from level ${LEVEL})`)
judge.push(`${wipes === 0 ? 'ok ' : 'HI '} wipes ${wipes} of ${rows.length} on Normal (target 0) · cleared ${cleared} · retreated ${rows.filter((r) => r.outcome === 'retreated').length} · capped ${rows.filter((r) => r.outcome === 'capped').length}`)
const roomsSeen = mean(rows.map((r) => r.rooms))
judge.push(`${roomsSeen >= layout.rooms.length * 0.8 ? 'ok ' : 'LOW'} rooms visited ${f1(roomsSeen)} of ${layout.rooms.length}`)
const lightEnd = mean(rows.map((r) => r.lightEnd))
judge.push(`${lightEnd >= 26 ? 'ok ' : 'LOW'} light at the end ${f1(lightEnd)} (${rows.filter((r) => r.bandEnd === 'dark' || r.bandEnd === 'pitch').length} tours end in the dark) · hunter came ${rows.filter((r) => r.hunter).length}×`)
judge.push(`    gold ${f1(mean(rows.map((r) => r.gold)))} · HP at the end ${f1(mean(rows.map((r) => r.hpPercent)))}% · downs ${f1(mean(rows.map((r) => r.downs)))} · XP/min ${f1(mean(rows.map((r) => (r.seconds > 0 ? r.battleXp / (r.seconds / 60) : 0))))}`)

const date = new Date().toISOString().slice(0, 10)
const lines: string[] = []
lines.push(`# Balance — the walked floor (${date}, ${TAG})`)
lines.push('')
lines.push(`${LAYOUT} · party ${PARTY.map((p) => p.classId).join(' + ')} at level ${LEVEL} · light ${LIGHT} at the gate · ${rows.length} seeds · walk ${w.secondsMin}–${w.secondsMax} s, grace ${w.graceSeconds} s, band scale ${Object.entries(w.bandScale).map(([k, v]) => `${k} ${v}`).join(', ')} · ${ms} ms`)
lines.push('')
lines.push('## Judgement')
lines.push('')
lines.push('```')
lines.push(...judge)
lines.push('```')
lines.push('')
lines.push('## Tours')
lines.push('')
lines.push('| seed | outcome | min walked | rooms | fights (random + placed) | per 10 min | level | XP | HP % | gold | light at end | chests | downs | hunter |')
lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for (const r of rows) lines.push(`| ${r.seed} | ${r.outcome} | ${f1(r.seconds / 60)} | ${r.rooms} | ${r.fights} (${r.randomFights} + ${r.placedFights}) | ${f1(r.seconds > 0 ? (10 * r.fights) / (r.seconds / 60) : 0)} | ${r.level} | ${r.battleXp} | ${r.hpPercent.toFixed(0)} | ${r.gold} | ${r.lightEnd} (${r.bandEnd}) | ${r.chests} | ${r.downs} | ${r.hunter ? 'yes' : ''} |`)
lines.push('')
lines.push('The tour: every room once, nearest first, the monsters at their spots fought, chests and gold taken, spotted traps disarmed, curios answered by the textbook player, secret panels found, the stair last. Walking at 2.4 m/s between room centres; the fight itself on auto.')
const out = path.join('docs', 'balance', `${date}-${TAG}.md`)
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, lines.join('\n') + '\n')
console.log(judge.join('\n'))
console.log(`→ ${out}`)
