/**
 * `node tools/balance/debug-seed.ts [--seed 101] [--floor 1 | --zone 1] [--last 3] [--party warden:dwarf,blade:orc]
 *   [--level 4] [--death mortal] [--policy textbook] [--difficulty normal] [--pacts a,b] [--cap 5000] [--watch 2:r3]
 *   [--trail 40]`
 * Replays one delve with a scripted player the way the client builds an ephemeral party (`startDeepDelve`: a new
 * profile, `addHero` per class, `heroAtLevel`), step by step, and prints the outcome. With `--watch <floor>:<room>` it
 * prints the steps and the legal actions around the first time the party enters that room; a delve that ran to the
 * command cap loops somewhere, and the last `--trail` steps show where.
 */
import { createDelve, legalDelveActions, runDelveAuto } from '../../sim/src/delve.ts'
import type { DelveOptions, DelveState } from '../../sim/src/delve-types.ts'
import { heroAtLevel } from '../../sim/src/hero.ts'
import type { PolicyName } from '../../sim/src/policies.ts'
import { addHero, newProfile } from '../../sim/src/town.ts'
import type { DeathRule, Difficulty } from '../../sim/src/types/enums.ts'
import { loadContentDir } from '../sim/loadContent.ts'

const args = process.argv.slice(2)
const flag = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] !== undefined && !args[i + 1]!.startsWith('--') ? args[i + 1]! : fallback
}
const content = loadContentDir('content')
const seed = Number(flag('seed', '101'))
const level = Number(flag('level', '4'))
const death = flag('death', 'mortal') as DeathRule
const policy = flag('policy', 'textbook') as PolicyName
const cap = Number(flag('cap', '5000'))
const watch = flag('watch', '')
const trailLen = Number(flag('trail', '40'))
const dungeon = [...content.dungeons.values()][0]!

let profile = newProfile(seed, death)
const egg = [...content.pets.values()].find((p) => p.creationChoice)
for (const spec of flag('party', 'warden:dwarf,blade:orc,mender:elf,arcanist:draconid').split(',').filter(Boolean)) {
  const [classId = 'warden', speciesId = 'human'] = spec.split(':')
  profile = addHero(content, profile, { name: classId[0]!.toUpperCase() + classId.slice(1), speciesId, classId, eggPetId: egg?.id ?? null }).profile
}
const heroes = level > 1 ? profile.heroes.map((h) => heroAtLevel(content, content.tuning, h, level)) : profile.heroes
const options: DelveOptions = {
  dungeonId: dungeon.id,
  ...(args.includes('--zone') ? { zone: Number(flag('zone', '1')) } : { floor: Number(flag('floor', '1')) }),
  ...(args.includes('--last') ? { lastFloor: Number(flag('last', '3')) } : {}),
  seed,
  difficulty: flag('difficulty', 'normal') as Difficulty,
  pactIds: flag('pacts', '').split(',').filter(Boolean),
  auto: true,
  policy,
  deathRule: death,
  ...(death === 'nightmare' ? { leaderId: heroes[0]!.id } : {}),
}

const trail: string[] = []
let shown = false
const describe = (s: DelveState): string => `F${s.floor.number}/${s.floor.currentRoomId} ${s.phase.kind}${s.phase.kind === 'over' ? `:${s.phase.outcome}` : ''} light=${s.light} hp=${s.heroes.map((h) => (h.fallen ? 'X' : h.hpPercent)).join('/')}`
const state = runDelveAuto(content, createDelve(content, options, heroes), cap, (s, command) => {
  trail.push(`${String(s.commandLog.length).padStart(5)} ${JSON.stringify(command).slice(0, 90).padEnd(90)} → ${describe(s)}`)
  if (trail.length > trailLen) trail.shift()
  if (watch && !shown && `${s.floor.number}:${s.floor.currentRoomId}` === watch) {
    shown = true
    console.log(`-- entering ${watch} --\n${trail.join('\n')}`)
    console.log('legal:', legalDelveActions(content, s).map((a) => `${a.label}${a.enabled ? '' : ` (off: ${a.reason})`}`).join(' | '))
  }
})
console.log(`-- last ${trail.length} steps --\n${trail.join('\n')}`)
if (state.phase.kind === 'over') console.log(`outcome ${state.phase.outcome}: ${state.phase.summary}`)
console.log(`fights ${state.stats.fights} · rooms ${state.stats.rooms} · commands ${state.commandLog.length} · deepest ${state.stats.deepestFloorCompleted}`)
const rs = state.floor.rooms[state.floor.currentRoomId]
if (rs) console.log('room', state.floor.currentRoomId, JSON.stringify({ kind: rs.kind, traps: rs.traps, cleared: rs.cleared }))
