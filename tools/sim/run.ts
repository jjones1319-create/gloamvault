/**
 * `npm run sim -- --delve gravehollow --zone 1 --seed 17 --party warden,mender --auto`
 * One delve in the terminal (10-TECH-PLAN §7, CLAUDE.md). Options:
 *   --delve <dungeon id or prefix>   --zone <n> | --floor <n>   --seed <n>   --party <class[:species[:name]],…>
 *   --auto (play it with the scripted policy; default when not a TTY)   --policy textbook|cautious|greedy|random
 *   --difficulty normal|hard|dread   --pacts a,b   --fixture (use the Phase 2 fixture content; the default
 *   while content/ has no dungeons)   --ascii (print each floor's map)   --quiet (summary only)
 */
import { rmSync } from 'node:fs'
import path from 'node:path'
import { createDelve, delveSummary, hashDelve, runDelveAuto } from '../../sim/src/delve.ts'
import type { DelveOptions } from '../../sim/src/delve-types.ts'
import { renderFloorAscii } from '../../sim/src/generator-ascii.ts'
import { createParty } from '../../sim/src/bridge.ts'
import { assembleFixtureCorpus } from '../../sim/test/fixtures/assemble.ts'
import { loadContentDir } from './loadContent.ts'

const args = process.argv.slice(2)
const flag = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1]!.startsWith('--') ? args[i + 1]! : fallback
}
const has = (name: string) => args.includes(`--${name}`)

let root: string | null = null
let content = loadContentDir('content')
if (has('fixture') || content.dungeons.size === 0) {
  root = assembleFixtureCorpus()
  content = loadContentDir(path.join(root, 'content'))
  if (!has('quiet')) console.log(`(using the Phase 2 fixture content: ${content.dungeons.size} dungeon(s), ${content.monsters.size} monsters)`)
}
try {
  const delveArg = flag('delve', 'gravehollow')
  const dungeon = [...content.dungeons.values()].find((d) => d.id === delveArg || d.id.startsWith(delveArg))
  if (!dungeon) throw new Error(`no dungeon matching "${delveArg}" (have: ${[...content.dungeons.keys()].join(', ')})`)
  const seed = Number(flag('seed', '17'))
  const partySpec = flag('party', 'warden').split(',').filter(Boolean)
  const party = createParty(content, seed, partySpec.map((spec) => {
    const [classId = '', speciesId = 'human', name] = spec.split(':')
    return name === undefined ? { classId, speciesId } : { classId, speciesId, name }
  }))
  const options: DelveOptions = {
    dungeonId: dungeon.id,
    zone: has('floor') ? undefined : Number(flag('zone', '1')),
    floor: has('floor') ? Number(flag('floor', '1')) : undefined,
    seed,
    difficulty: flag('difficulty', 'normal') as DelveOptions['difficulty'],
    pactIds: flag('pacts', '').split(',').filter(Boolean),
    auto: true,
    policy: flag('policy', 'textbook') as DelveOptions['policy'],
  }
  const state = createDelve(content, options, party)
  const quiet = has('quiet')
  let lastFloor = 0
  const printFloor = () => {
    if (state.floor.number !== lastFloor) {
      lastFloor = state.floor.number
      if (has('ascii')) console.log(renderFloorAscii(state.floor.graph))
    }
  }
  printFloor()
  runDelveAuto(content, state)
  if (!quiet) {
    let floor = 0
    for (const e of state.log) {
      if (e.floor !== floor) {
        floor = e.floor
        console.log(`\n== Floor ${floor} ==`)
        if (has('ascii') && state.floor.number === floor) console.log(renderFloorAscii(state.floor.graph))
      }
      console.log(`${String(e.kind).padEnd(12)} ${e.text}`)
    }
  }
  const s = delveSummary(state)
  console.log('\n' + Object.entries(s).map(([k, v]) => `${k}: ${v}`).join(' · '))
  console.log(`hash ${hashDelve(state)} · commands ${state.commandLog.length}`)
  for (const h of state.heroes) {
    const g = h.growth
    console.log(`${h.record.name}: L${h.record.level} HP ${h.hpPercent}% · ranks ${JSON.stringify(g.skills)} · attrs ${JSON.stringify(g.attributes)} · items ${JSON.stringify(g.items)} · insights ${g.insights.join(',') || '-'}`)
  }
} finally {
  if (root) rmSync(root, { recursive: true, force: true })
}
