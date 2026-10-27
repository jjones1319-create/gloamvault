/**
 * `npm run balance [-- --seeds 100 --tag first-pass --fixture]`
 * The batch runner (12 Phase 2; 10-TECH-PLAN §7): seeds × party recipes × the zone, played by the scripted policies,
 * written as JSON to tools/balance/out/<date>-<tag>.json and as a dated report with judgement lines to
 * docs/balance/<date>-<tag>.md. Targets: 03 §3.6 and 06 §8.9 (fight rounds), 03 §8.1 (gold ≈ R, repair ≤ 30% of R),
 * 08 §9.4 (delves to broken), 03 §4.4 (ambush rates), 03 §7.5 (Insight rate).
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Content } from '../../sim/src/content.ts'
import { createDelve, runDelveAuto } from '../../sim/src/delve.ts'
import type { DelveOptions, DelveState } from '../../sim/src/delve-types.ts'
import { createHero } from '../../sim/src/hero.ts'
import { repairAllCost } from '../../sim/src/items.ts'
import { Rng } from '../../sim/src/rng.ts'
import type { HeroRecord, ItemInstance } from '../../sim/src/types/content.ts'
import { assembleFixtureCorpus } from '../../sim/test/fixtures/assemble.ts'
import { loadContentDir } from '../sim/loadContent.ts'

const args = process.argv.slice(2)
const flag = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1]!.startsWith('--') ? args[i + 1]! : fallback
}
const SEEDS = Number(flag('seeds', '100'))
const TAG = flag('tag', 'first-pass')
const DATE = flag('date', new Date().toISOString().slice(0, 10))
const useFixture = args.includes('--fixture')

let root: string | null = null
let content: Content = loadContentDir('content')
let contentNote = 'content/'
if (useFixture || content.dungeons.size === 0) {
  root = assembleFixtureCorpus()
  content = loadContentDir(path.join(root, 'content'))
  contentNote = 'the Phase 2 fixture set (sim/test/fixtures/content): one class, two species, seven monsters, one zone'
}

interface Recipe {
  name: string
  party: { classId: string; speciesId: string }[]
  policy: DelveOptions['policy']
}

const classIds = [...content.classes.keys()]
const RECIPES: Recipe[] = []
const pick = (wanted: string[]) => wanted.filter((c) => classIds.includes(c))
const solo = pick(['warden'])[0] ?? classIds[0]!
RECIPES.push({ name: `solo ${solo}`, party: [{ classId: solo, speciesId: 'human' }], policy: 'textbook' })
RECIPES.push({ name: `solo ${solo} (cautious)`, party: [{ classId: solo, speciesId: 'human' }], policy: 'cautious' })
const classic = pick(['warden', 'blade', 'mender', 'arcanist'])
if (classic.length >= 2) RECIPES.push({ name: `party of ${classic.length}: ${classic.join(', ')}`, party: classic.map((c) => ({ classId: c, speciesId: 'human' })), policy: 'textbook' })
else RECIPES.push({ name: `three ${solo}s (textbook)`, party: [1, 2, 3].map(() => ({ classId: solo, speciesId: 'human' })), policy: 'textbook' })
RECIPES.push({ name: `three ${solo}s (greedy)`, party: [1, 2, 3].map(() => ({ classId: solo, speciesId: 'human' })), policy: 'greedy' })

const dungeon = [...content.dungeons.values()][0]
if (!dungeon) throw new Error('no dungeon in the content')
const zone = dungeon.zones[0]!
const t = content.tuning

interface RunRow {
  seed: number
  recipe: string
  outcome: string
  floorReached: number
  rooms: number
  fights: number
  rounds: Record<string, number[]>
  gold: number
  goldFound: number
  repairGold: number
  wearPct: Record<string, number>
  downs: number
  wipes: number
  ambushedParty: number
  ambushedMonsters: number
  hunter: number
  insights: number
  traps: [number, number, number]
  curios: number
  chests: number
  torches: number
  light: number[]
  ticks: number[]
  commands: number
}

function heroFor(recipe: Recipe['party'][number], i: number, seed: number): HeroRecord {
  const egg = [...content.pets.values()].find((p) => p.creationChoice)
  return createHero(content, t, Rng.fromSeed(seed * 31 + i), { id: `h${i}`, name: `${recipe.classId}-${i + 1}`, speciesId: recipe.speciesId, classId: recipe.classId, freePoints: { endurance: 2, vitality: 2, strength: 2 }, eggPetId: egg?.id ?? null })
}

function equippedAll(h: HeroRecord): ItemInstance[] {
  const e = h.equipment
  return [e.mainHand, e.offHand, e.helmet, e.chest, e.legs, e.boots, e.gloves, e.ring[0], e.ring[1], e.talisman, e.relic].filter((x): x is ItemInstance => x !== null)
}

function row(seed: number, recipe: Recipe, state: DelveState): RunRow {
  const s = state.stats
  const repairGold = state.heroes.reduce((sum, h) => sum + repairAllCost(content, t, equippedAll(h.record)).gold, 0)
  const wearPct: Record<string, number> = {}
  for (const h of state.heroes) {
    const e = h.record.equipment
    for (const [slot, inst] of Object.entries({ mainHand: e.mainHand, offHand: e.offHand, chest: e.chest, helmet: e.helmet, legs: e.legs }) as [string, ItemInstance | null][]) {
      if (inst) wearPct[slot] = (wearPct[slot] ?? 0) + (100 - inst.durability) / state.heroes.length
    }
  }
  return {
    seed,
    recipe: recipe.name,
    outcome: state.phase.kind === 'over' ? state.phase.outcome : 'running',
    floorReached: state.floor.number,
    rooms: s.rooms,
    fights: s.fights,
    rounds: s.roundsByKind,
    gold: state.gold,
    goldFound: s.goldFound,
    repairGold,
    wearPct,
    downs: s.downs,
    wipes: s.wipes,
    ambushedParty: s.ambushedParty,
    ambushedMonsters: s.ambushedMonsters,
    hunter: s.hunterArrived,
    insights: s.insights,
    traps: [s.trapsRevealed, s.trapsTriggered, s.trapsDisarmed],
    curios: s.curiosUsed,
    chests: s.chestsOpened,
    torches: s.torchesUsed,
    light: s.lightAtStairs,
    ticks: s.ticksToStairs,
    commands: state.commandLog.length,
  }
}

const started = Date.now()
const rows: RunRow[] = []
for (const recipe of RECIPES) {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const party = recipe.party.map((p, i) => heroFor(p, i, seed))
    const options: DelveOptions = { dungeonId: dungeon.id, zone: 1, seed, difficulty: 'normal', pactIds: [], auto: true, policy: recipe.policy }
    let state: DelveState
    try {
      state = runDelveAuto(content, createDelve(content, options, party), 3000)
    } catch (e) {
      console.error(`seed ${seed} ${recipe.name}: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }
    rows.push(row(seed, recipe, state))
  }
  process.stderr.write(`${recipe.name}: ${SEEDS} delves\n`)
}
const elapsed = Math.round((Date.now() - started) / 1000)

/* ---------- aggregate ---------- */

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const pct = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!
}
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '-')
const f0 = (x: number) => (Number.isFinite(x) ? x.toFixed(0) : '-')

const R = 300
const lines: string[] = []
const judgements: string[] = []
const judge = (label: string, value: number, lo: number, hi: number, unit = '') => {
  const verdict = !Number.isFinite(value) ? 'n/a' : value < lo ? 'LOW' : value > hi ? 'HIGH' : 'OK'
  judgements.push(`- **${verdict}** ${label}: ${f1(value)}${unit} (target ${lo}–${hi}${unit})`)
  return verdict
}

lines.push(`# Balance report — ${DATE} — ${TAG}`, '', `*Written by \`npm run balance\` on ${contentNote}; ${SEEDS} seeds × ${RECIPES.length} recipes, zone **${zone.name}** of **${dungeon.name}** (floors ${zone.floors.from}–${zone.floors.to}), Normal, no Pacts; ${elapsed} s.*`, '')
lines.push('## 1. Outcomes per recipe', '', '| Recipe | Cleared | Retreated | Wiped | Capped | Floors reached (mean) | Rooms | Fights | Downs/delve | Commands |', '|---|---|---|---|---|---|---|---|---|---|')
for (const recipe of RECIPES) {
  const rs = rows.filter((r) => r.recipe === recipe.name)
  const count = (o: string) => rs.filter((r) => r.outcome === o).length
  lines.push(`| ${recipe.name} | ${f0((100 * count('cleared')) / rs.length)}% | ${f0((100 * count('retreated')) / rs.length)}% | ${f0((100 * count('wiped')) / rs.length)}% | ${f0((100 * count('capped')) / rs.length)}% | ${f1(mean(rs.map((r) => r.floorReached)))} | ${f1(mean(rs.map((r) => r.rooms)))} | ${f1(mean(rs.map((r) => r.fights)))} | ${f1(mean(rs.map((r) => r.downs)))} | ${f0(mean(rs.map((r) => r.commands)))} |`)
}
lines.push('', '## 2. Fight length (rounds) by fight kind', '', '| Recipe | fight | elite | boss | hunter | trap/curio |', '|---|---|---|---|---|---|')
const roundTargets: Record<string, [number, number]> = { fight: [3, 6], elite: [5, 7], boss: [10, 15], hunter: [6, 8] }
for (const recipe of RECIPES) {
  const rs = rows.filter((r) => r.recipe === recipe.name)
  const by = (k: string) => rs.flatMap((r) => r.rounds[k] ?? [])
  lines.push(`| ${recipe.name} | ${f1(mean(by('fight')))} (n=${by('fight').length}) | ${f1(mean(by('elite')))} (n=${by('elite').length}) | ${f1(mean(by('boss')))} (n=${by('boss').length}) | ${f1(mean(by('hunter')))} (n=${by('hunter').length}) | ${f1(mean([...by('trap'), ...by('curio')]))} |`)
  for (const [k, [lo, hi]] of Object.entries(roundTargets)) if (by(k).length) judge(`${recipe.name}: ${k} rounds`, mean(by(k)), lo, hi)
}
lines.push('', '## 3. Economy and wear', '', '| Recipe | Gold banked (mean) | p10 | p90 | Gold found | Repair bill (gold) | Repair % of R | Wear main hand % | Wear chest % | Chests | Torches | Light at stairs |', '|---|---|---|---|---|---|---|---|---|---|---|---|')
for (const recipe of RECIPES) {
  const rs = rows.filter((r) => r.recipe === recipe.name)
  const gold = rs.map((r) => r.gold)
  const repair = rs.map((r) => r.repairGold)
  lines.push(`| ${recipe.name} | ${f0(mean(gold))} | ${f0(quantile(gold, 0.1))} | ${f0(quantile(gold, 0.9))} | ${f0(mean(rs.map((r) => r.goldFound)))} | ${f0(mean(repair))} | ${f1((100 * mean(repair)) / R)}% | ${f1(mean(rs.map((r) => r.wearPct.mainHand ?? 0)))} | ${f1(mean(rs.map((r) => r.wearPct.chest ?? 0)))} | ${f1(mean(rs.map((r) => r.chests)))} | ${f1(mean(rs.map((r) => r.torches)))} | ${f0(mean(rs.flatMap((r) => r.light)))} |`)
  const cleared = rs.filter((r) => r.outcome === 'cleared')
  if (cleared.length) {
    judge(`${recipe.name}: gold per cleared delve vs R`, mean(cleared.map((r) => r.gold)), R * 0.7, R * 1.3, ' gold')
    judge(`${recipe.name}: repair bill as % of R`, (100 * mean(cleared.map((r) => r.repairGold))) / R, 15, 35, '%')
    judge(`${recipe.name}: main-hand wear per delve`, mean(cleared.map((r) => r.wearPct.mainHand ?? 0)), 25, 35, '%')
  }
}
lines.push('', '## 4. Exploration', '', '| Recipe | Ambushed (party) / delve | Ambushed (monsters) / delve | Hunter arrivals | Traps revealed / triggered / disarmed | Curios | Insights / delve | Ticks to stairs (mean) |', '|---|---|---|---|---|---|---|---|')
for (const recipe of RECIPES) {
  const rs = rows.filter((r) => r.recipe === recipe.name)
  const fights = rs.reduce((s, r) => s + r.fights, 0)
  lines.push(`| ${recipe.name} | ${f1(mean(rs.map((r) => r.ambushedParty)))} (${f0((100 * rs.reduce((s, r) => s + r.ambushedParty, 0)) / Math.max(1, fights))}% of fights) | ${f1(mean(rs.map((r) => r.ambushedMonsters)))} | ${f0((100 * rs.filter((r) => r.hunter > 0).length) / rs.length)}% of delves | ${f1(mean(rs.map((r) => r.traps[0])))} / ${f1(mean(rs.map((r) => r.traps[1])))} / ${f1(mean(rs.map((r) => r.traps[2])))} | ${f1(mean(rs.map((r) => r.curios)))} | ${f1(mean(rs.map((r) => r.insights)))} | ${f0(mean(rs.flatMap((r) => r.ticks)))} |`)
  if (fights) judge(`${recipe.name}: party ambushed, % of fights`, (100 * rs.reduce((s, r) => s + r.ambushedParty, 0)) / fights, 10, 30, '%')
}
lines.push('', '## 5. Judgement lines', '', ...judgements, '', '## 6. Reading the report', '', '- A **fight** is 3–6 rounds for ordinary packs (03 §3.6; 06 §8.9 narrows fodder packs to 3–4), elites 5–7, bosses 10–15, hunters 6–8.', '- Gold per delve should land near **R = 300** at the Cellars band (03 §8.1), with the full repair bill between 15% and 35% of it (08 §9.3 holds the Warden at ~27%).', '- A fully used F weapon should lose 25–35% per delve (03 §6.4; 08 §9.4 says 30%, 3.3 delves to broken).', '- The party should be surprised in roughly 10–30% of fights at full light with a Perception-10 party; Dim adds 5 pp, the Cellars family 15 pp (03 §4.2–§4.4).', '- Phase 2 caveat: the fixture set has one class (the Warden with 12 of 45 skills), five of twelve elite affixes, no Ranger/Shade scouting bonuses, and several skill hooks are not yet implemented (they resolve as no-ops); numbers tune in Phase 3 on the real content.', '')

mkdirSync('tools/balance/out', { recursive: true })
mkdirSync('docs/balance', { recursive: true })
const jsonPath = path.join('tools/balance/out', `${DATE}-${TAG}.json`)
const mdPath = path.join('docs/balance', `${DATE}-${TAG}.md`)
writeFileSync(jsonPath, JSON.stringify({ date: DATE, tag: TAG, seeds: SEEDS, content: contentNote, recipes: RECIPES, rows }, null, 2))
writeFileSync(mdPath, lines.join('\n'))
console.log(lines.slice(lines.indexOf('## 5. Judgement lines')).join('\n'))
console.log(`\nwrote ${mdPath} and ${jsonPath} (${rows.length} delves in ${elapsed} s)`)
if (root) rmSync(root, { recursive: true, force: true })
void pct
