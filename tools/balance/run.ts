/**
 * `npm run balance [-- --seeds 100 --tag first-pass --fixture --death mortal|sheltered|nightmare]`
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
import { createHero, heroAtLevel } from '../../sim/src/hero.ts'
import { createItemInstance, repairAllCost } from '../../sim/src/items.ts'
import { Rng } from '../../sim/src/rng.ts'
import type { HeroRecord, ItemInstance } from '../../sim/src/types/content.ts'
import type { Grade, Stance } from '../../sim/src/types/enums.ts'
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
/** D-088, D-095: the save's death rule. Sheltered (the Phase 3 rules) by default, so D-084's clear-rate targets keep their meaning; Mortal is the game James asked for; Nightmare ends the run when the recipe's first hero (the chosen hero) dies. */
const DEATH_FLAG = flag('death', 'sheltered')
const DEATH: 'mortal' | 'sheltered' | 'nightmare' = DEATH_FLAG === 'mortal' || DEATH_FLAG === 'nightmare' ? DEATH_FLAG : 'sheltered'
const DEATH_NAME = DEATH === 'nightmare' ? 'Nightmare' : DEATH === 'mortal' ? 'Mortal' : 'Sheltered'

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
  /** 04 §4: "Warden with a Mend-stance pet is the safest first solo"; the glass cannons put every pet in Guard. */
  petStance?: Stance
  /** A party that has ground: its heroes (and pets) start at this level with gear of this grade (D-082, D-084). */
  level?: number
  gearGrade?: Grade
  /** The clear rate the recipe should land in (D-084, from James's brief of 2026-10-27). */
  clearTarget?: [number, number]
}

const classIds = [...content.classes.keys()]
const RECIPES: Recipe[] = []
const pick = (wanted: string[]) => wanted.filter((c) => classIds.includes(c))
const solo = pick(['warden'])[0] ?? classIds[0]!
const party = (name: string, classes: string[], policy: DelveOptions['policy'], petStance?: Stance, clearTarget?: [number, number], level?: number, gearGrade?: Grade): void => {
  const have = pick(classes)
  if (have.length === classes.length) RECIPES.push({ name, party: have.map((c) => ({ classId: c, speciesId: 'human' })), policy, ...(petStance ? { petStance } : {}), ...(clearTarget ? { clearTarget } : {}), ...(level ? { level } : {}), ...(gearGrade ? { gearGrade } : {}) })
}
// D-084 (James, 2026-10-27): "very difficult and definitely not something you can solo through your first time
// without level and gear … you can but will take a lot of grinding. It is best to get party members." Fresh = level 1
// with the starter kit; ground = levelled with better gear. 04 §4's recipes and the safest solo, both ways.
RECIPES.push({ name: `solo ${solo}, fresh`, party: [{ classId: solo, speciesId: 'human' }], policy: 'textbook', petStance: 'mend', clearTarget: [0, 10] })
RECIPES.push({ name: `solo ${solo}, ground (L12, D gear)`, party: [{ classId: solo, speciesId: 'human' }], policy: 'textbook', petStance: 'mend', level: 12, gearGrade: 'D', clearTarget: [40, 85] })
party('classic four, fresh: warden, blade, mender, arcanist', ['warden', 'blade', 'mender', 'arcanist'], 'textbook', undefined, [40, 75])
party('crypt-breakers, fresh: mender, warden, ranger', ['mender', 'warden', 'ranger'], 'textbook', undefined, [15, 55])
party('glass cannons, fresh: arcanist, shade, ranger', ['arcanist', 'shade', 'ranger'], 'textbook', 'guard', [0, 40])
party('the pair, fresh: blade, mender', ['blade', 'mender'], 'textbook', undefined, [5, 40])
party('crypt-breakers, levelled (L5, E gear)', ['mender', 'warden', 'ranger'], 'textbook', undefined, [70, 100], 5, 'E')
party('the pair, levelled (L5, E gear)', ['blade', 'mender'], 'textbook', undefined, [55, 95], 5, 'E')
if (RECIPES.length < 3) {
  // A fixture with one class: three of it, textbook and greedy.
  RECIPES.push({ name: `three ${solo}s (textbook)`, party: [1, 2, 3].map(() => ({ classId: solo, speciesId: 'human' })), policy: 'textbook' })
  RECIPES.push({ name: `three ${solo}s (greedy)`, party: [1, 2, 3].map(() => ({ classId: solo, speciesId: 'human' })), policy: 'greedy' })
}

const dungeon = [...content.dungeons.values()][0]
if (!dungeon) throw new Error('no dungeon in the content')
const zone = dungeon.zones[0]!
const t = content.tuning

interface RunRow {
  seed: number
  recipe: string
  outcome: string
  /** Heroes still fallen when a fight ended (under Mortal each one died, D-088). */
  falls: number
  /** Dead heroes a healer raised in the dungeon (D-089). */
  raises: number
  /** Under Mortal: heroes carried home dead (to the Shrine) and heroes lost for good in a wipe. */
  carriedHome: number
  lostForGood: number
  /** Under Nightmare (D-095): the chosen hero (the recipe's first hero) died, so the save would end. */
  ended: boolean
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
  hookStubs: Record<string, number>
  chests: number
  torches: number
  light: number[]
  ticks: number[]
  commands: number
}

/** The six free points (03 §2.3) go where the class's sheet points: casters to Wisdom and Willpower, skirmishers to Agility and Perception, the rest to the Warden's trio. */
function freePointsFor(classId: string): Record<string, number> {
  const cls = content.classes.get(classId)
  if (cls?.pool === 'mana') return { wisdom: 2, willpower: 2, vitality: 2 }
  if (classId === 'shade' || classId === 'ranger') return { agility: 2, perception: 2, vitality: 2 }
  return { endurance: 2, vitality: 2, strength: 2 }
}

function heroFor(recipe: Recipe['party'][number], i: number, seed: number): HeroRecord {
  const egg = [...content.pets.values()].find((p) => p.creationChoice)
  return createHero(content, t, Rng.fromSeed(seed * 31 + i), { id: `h${i}`, name: `${recipe.classId}-${i + 1}`, speciesId: recipe.speciesId, classId: recipe.classId, freePoints: freePointsFor(recipe.classId), eggPetId: egg?.id ?? null })
}

/** A ground hero (D-084): levelled with its class growth (D-082), its pet at the same level, each worn piece swapped for its own type at `gearGrade` (same mesh, 08's ladder). */
function ground(h: HeroRecord, recipe: Recipe, seed: number): HeroRecord {
  let out = h
  if (recipe.level && recipe.level > 1) {
    out = heroAtLevel(content, t, out, recipe.level)
    if (out.petInstance) out = { ...out, petInstance: { ...out.petInstance, level: recipe.level } }
  }
  const grade = recipe.gearGrade
  if (grade) {
    const rng = Rng.fromSeed(seed)
    const up = (inst: ItemInstance | null): ItemInstance | null => {
      if (!inst) return inst
      const mesh = content.items.get(inst.itemId)?.visual.meshId
      const target = [...content.items.values()].find((d) => d.visual.meshId === mesh && d.grade === grade)
      return target ? createItemInstance(content, rng, target.id) : inst
    }
    const e = out.equipment
    out = { ...out, equipment: { ...e, mainHand: up(e.mainHand), offHand: up(e.offHand), helmet: up(e.helmet), chest: up(e.chest), legs: up(e.legs), boots: up(e.boots), gloves: up(e.gloves), ring: [up(e.ring[0]), up(e.ring[1])], talisman: up(e.talisman), relic: up(e.relic) } }
  }
  return out
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
  const outcome = state.phase.kind === 'over' ? state.phase.outcome : 'running'
  const deadAtEnd = state.heroes.filter((h) => h.fallen).length
  const mortal = state.options.deathRule === 'mortal' || state.options.deathRule === 'nightmare'
  const leader = state.heroes.find((h) => h.record.id === state.options.leaderId)
  return {
    seed,
    recipe: recipe.name,
    outcome,
    falls: s.falls,
    raises: s.raises,
    carriedHome: mortal && outcome !== 'wiped' ? deadAtEnd : 0,
    lostForGood: mortal && outcome === 'wiped' ? state.heroes.length : 0,
    ended: state.options.deathRule === 'nightmare' && leader !== undefined && leader.fallen,
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
    hookStubs: s.hookStubs,
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
    const party = recipe.party
      .map((p, i) => heroFor(p, i, seed))
      .map((h) => (recipe.petStance && h.petInstance ? { ...h, petInstance: { ...h.petInstance, stance: recipe.petStance }, loadout: { ...h.loadout, stance: recipe.petStance } } : h))
      .map((h, i) => ground(h, recipe, seed * 131 + i))
    const options: DelveOptions = { dungeonId: dungeon.id, zone: 1, seed, difficulty: 'normal', pactIds: [], auto: true, policy: recipe.policy, deathRule: DEATH, ...(DEATH === 'nightmare' ? { leaderId: party[0]!.id } : {}) }
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

lines.push(`# Balance report — ${DATE} — ${TAG}`, '', `*Written by \`npm run balance\` on ${contentNote}; ${SEEDS} seeds × ${RECIPES.length} recipes, zone **${zone.name}** of **${dungeon.name}** (floors ${zone.floors.from}–${zone.floors.to}), Normal, no Pacts, death rule **${DEATH_NAME}** (D-088, D-095); ${elapsed} s.*`, '')
lines.push('## 1. Outcomes per recipe', '', '| Recipe | Cleared | Retreated | Wiped | Chosen hero died (Nightmare) | Capped | Floors reached (mean) | Rooms | Fights | Downs/delve | Commands |', '|---|---|---|---|---|---|---|---|---|---|---|')
for (const recipe of RECIPES) {
  const rs = rows.filter((r) => r.recipe === recipe.name)
  const count = (o: string) => rs.filter((r) => r.outcome === o).length
  if (recipe.clearTarget) judge(`${recipe.name}: Cellars cleared, % of delves`, (100 * count('cleared')) / rs.length, recipe.clearTarget[0], recipe.clearTarget[1], '%')
  lines.push(`| ${recipe.name} | ${f0((100 * count('cleared')) / rs.length)}% | ${f0((100 * count('retreated')) / rs.length)}% | ${f0((100 * count('wiped')) / rs.length)}% | ${f0((100 * count('chosenDied')) / rs.length)}% | ${f0((100 * count('capped')) / rs.length)}% | ${f1(mean(rs.map((r) => r.floorReached)))} | ${f1(mean(rs.map((r) => r.rooms)))} | ${f1(mean(rs.map((r) => r.fights)))} | ${f1(mean(rs.map((r) => r.downs)))} | ${f0(mean(rs.map((r) => r.commands)))} |`)
}
// D-088–D-092: how often heroes die, and how often a party is lost for good (reported, not judged, until James sets targets).
lines.push('', '## 1b. Deaths (D-088, D-095)', '', '| Recipe | Falls / delve | Delves with a fall | Raised in the dungeon / delve | Carried home dead / delve | Lost for good / delve | Delves losing a hero for good | Nightmare: the save ends |', '|---|---|---|---|---|---|---|---|')
for (const recipe of RECIPES) {
  const rs = rows.filter((r) => r.recipe === recipe.name)
  const endedPct = DEATH === 'nightmare' ? `${f0((100 * rs.filter((r) => r.ended).length) / Math.max(1, rs.length))}%` : '-'
  lines.push(`| ${recipe.name} | ${f1(mean(rs.map((r) => r.falls)))} | ${f0((100 * rs.filter((r) => r.falls > 0).length) / Math.max(1, rs.length))}% | ${f1(mean(rs.map((r) => r.raises)))} | ${f1(mean(rs.map((r) => r.carriedHome)))} | ${f1(mean(rs.map((r) => r.lostForGood)))} | ${f0((100 * rs.filter((r) => r.lostForGood > 0).length) / Math.max(1, rs.length))}% | ${endedPct} |`)
}
if (DEATH === 'sheltered') lines.push('', '*Under Sheltered nobody is lost: the falls column is what Mortal would turn into deaths. Run `--death mortal` for the game James asked for.*')
lines.push('', '## 2. Fight length (rounds) by fight kind', '', '| Recipe | fight | elite | boss | hunter | trap/curio |', '|---|---|---|---|---|---|')
// 03 §3.6 owns the targets: ordinary 3–6, elites 6–8, bosses 10–15; hunters 6–8 (07 §2.9).
const roundTargets: Record<string, [number, number]> = { fight: [3, 6], elite: [6, 8], boss: [10, 15], hunter: [6, 8] }
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
// Hooks that ran as documented stubs (sim/src/skills/custom/README.md): what the numbers above do not yet include.
{
  const stubTotals: Record<string, number> = {}
  for (const r of rows) for (const [k, v] of Object.entries(r.hookStubs ?? {})) stubTotals[k] = (stubTotals[k] ?? 0) + v
  const entries = Object.entries(stubTotals).sort((a, b) => b[1] - a[1])
  lines.push('', '## 4b. Stub hooks that fired', '', entries.length ? entries.map(([k, v]) => `- ` + "`" + k + "`" + `: ${v} fight(s)`).join('\n') : '- none')
}
lines.push('', '## 5. Judgement lines', '', ...judgements, '', '## 6. Reading the report', '', '- A **fight** is 3–6 rounds for ordinary packs (03 §3.6; 06 §8.9 narrows fodder packs to 3–4), elites 6–8, bosses 10–15, hunters 6–8.', '- Gold per delve should land near **R = 300** at the Cellars band (03 §8.1), with the full repair bill between 15% and 35% of it (08 §9.3 holds the Warden at ~27%).', '- A fully used F weapon should lose 25–35% per delve (03 §6.4; 08 §9.4 says 30%, 3.3 delves to broken).', '- The party should be surprised in roughly 10–30% of fights at full light with a Perception-10 party; Dim adds 5 pp, the Cellars family 15 pp (03 §4.2–§4.4).', '- Phase 3 caveat: Tiers IV–V, the Crypts and the Vault, Dungeons 2–4 and the Beast Tamer are not in the content yet; a hook the sim has no joint for logs `hookStub` (sim/src/skills/custom/README.md) and §4b lists the ones that fired.', '')

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
