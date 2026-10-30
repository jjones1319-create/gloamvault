/**
 * `npm run unity:bundle` (Phase 10, D-139): what the Unity app needs to run the rules, written to
 * unity/Assets/Gloamvault/Resources/Sim/ (generated, git-ignored; unity:test, unity:shots and unity:build run this first):
 *
 * - `sim.js.txt` — sim/src/bridge.ts and everything it imports as one script (`var GV = …`), built by Vite in library
 *   mode. Jint runs it inside the app (unity/…/Runtime/Sim/JintSim.cs).
 * - `content.json` — the content corpus as raw files (`readContentFiles`), which the bridge's `init` indexes.
 * - `golden.json` — the rules check's cases played here by the built bundle itself, in a bare `node:vm` context (so the
 *   script is proven to need nothing from its host): the state hash every `EVERY` steps, the last hash, the outcome,
 *   and Node's step times. The app plays the same cases and must reach the same hashes (RulesCheck.cs).
 *
 * The same cases are also played through sim/src/bridge.ts directly, and the two must agree: the bundling changes nothing.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { build } from 'vite'
import * as direct from '../../sim/src/bridge.ts'
import { readContentFiles } from '../sim/loadContent.ts'

/** A hash every EVERY steps; at most CAP steps a case. RulesCheck.cs reads both from golden.json. */
const EVERY = 20
const CAP = 3000

/** The rules check's cases (D-157). Hand mode steps one hero turn at a time — the unit a player waits on. */
const CASES = [
  { id: 'A', title: 'The Cellars, seed 17 · Warden and Mender', request: { dungeonId: 'gravehollow-keep', zone: 1, seed: 17, party: [{ classId: 'warden' }, { classId: 'mender' }] } },
  { id: 'B', title: 'The Cellars, seed 42 · a party of four', request: { dungeonId: 'gravehollow-keep', zone: 1, seed: 42, party: [{ classId: 'warden' }, { classId: 'blade' }, { classId: 'mender' }, { classId: 'arcanist' }] } },
  { id: 'C', title: 'The Cellars, seed 7 · a Shade alone', request: { dungeonId: 'gravehollow-keep', zone: 1, seed: 7, party: [{ classId: 'shade' }] } },
  { id: 'D', title: 'The Crypts, seed 99 · Warden, Blade and Mender', request: { dungeonId: 'gravehollow-keep', floor: 4, seed: 99, party: [{ classId: 'warden' }, { classId: 'blade' }, { classId: 'mender' }] } },
  { id: 'E', title: 'The Cellars, seed 17 · four, whole fights a step', request: { dungeonId: 'gravehollow-keep', zone: 1, seed: 17, auto: true, party: [{ classId: 'warden' }, { classId: 'blade' }, { classId: 'mender' }, { classId: 'arcanist' }] } },
] as const

interface Bridge {
  init(contentJson: string): string
  createDelve(requestJson: string): number
  step(handle: number, commandJson: string): string
  legal(handle: number): string
  hash(handle: number): string
  summary(handle: number): string
  dispose(handle: number): void
}

const OUT = path.resolve('unity/Assets/Gloamvault/Resources/Sim')
const now = () => performance.now()
const percentile = (xs: number[], p: number) => {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]!
}
const ms = (x: number) => Math.round(x * 100) / 100

/**
 * One case, exactly as RulesCheck.cs plays it: ask for the legal commands, step `auto`, and stop when the delve is
 * over, when a step changes nothing (the scripted player found no way on) or at the cap.
 */
function play(gv: Bridge, request: object) {
  const h = gv.createDelve(JSON.stringify(request))
  const checkpoints: string[] = []
  const stepMs: number[] = []
  const legalMs: number[] = []
  let steps = 0
  let commands = 0
  let phase = ''
  while (steps < CAP) {
    let t = now()
    gv.legal(h)
    legalMs.push(now() - t)
    t = now()
    const r = JSON.parse(gv.step(h, '{"kind":"auto"}')) as { phase: string; commands: number; over: boolean }
    stepMs.push(now() - t)
    steps++
    const moved = r.commands !== commands
    commands = r.commands
    phase = r.phase
    if (steps % EVERY === 0) checkpoints.push(gv.hash(h))
    if (r.over || !moved) break
  }
  const result = { steps, commands, phase, checkpoints, final: gv.hash(h), summary: JSON.parse(gv.summary(h)) as Record<string, unknown> }
  gv.dispose(h)
  return { result, timing: { stepP50: ms(percentile(stepMs, 50)), stepP95: ms(percentile(stepMs, 95)), stepMax: ms(Math.max(...stepMs)), legalP95: ms(percentile(legalMs, 95)) } }
}

// 1. The script: Vite in library mode, one IIFE, not minified (an interpreter gains nothing from it; errors read better).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-bundle-'))
await build({
  configFile: false,
  logLevel: 'warn',
  publicDir: false,
  build: {
    lib: { entry: path.resolve('sim/src/bridge.ts'), formats: ['iife'], name: 'GV', fileName: () => 'sim.js' },
    outDir: tmp,
    emptyOutDir: true,
    target: 'es2020',
    minify: false,
    sourcemap: false,
    reportCompressedSize: false,
  },
})
const code = fs.readFileSync(path.join(tmp, 'sim.js'), 'utf8')
fs.rmSync(tmp, { recursive: true, force: true })

// 2. The content, as the raw files in sorted path order.
const contentJson = JSON.stringify(readContentFiles('content'))

// 3. The golden cases, played by the bundle in a bare context and by the TypeScript bridge; both must agree.
const context = vm.createContext({})
let t = now()
vm.runInContext(code, context, { filename: 'sim.js' })
const runMs = now() - t
const gv = vm.runInContext('GV', context) as Bridge
t = now()
const info = JSON.parse(gv.init(contentJson)) as Record<string, number>
const initMs = now() - t
direct.init(contentJson)

const cases = CASES.map((c) => {
  const { result, timing } = play(gv, c.request)
  const check = play(direct, c.request).result
  if (check.final !== result.final || check.steps !== result.steps) throw new Error(`case ${c.id}: the bundle (${result.final}, ${result.steps} steps) and the TypeScript bridge (${check.final}, ${check.steps}) disagree`)
  console.log(`  ${c.id} ${c.title}: ${result.steps} steps → ${result.phase}, hash ${result.final} · Node step p50 ${timing.stepP50} ms, p95 ${timing.stepP95}, max ${timing.stepMax}; legal p95 ${timing.legalP95}`)
  // The request and the summary as JSON strings: Unity reads golden.json with JsonUtility, which has no free-form objects.
  const { summary, ...rest } = result
  return { id: c.id, title: c.title, requestJson: JSON.stringify(c.request), ...rest, summaryJson: JSON.stringify(summary), node: timing }
})

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'sim.js.txt'), code)
fs.writeFileSync(path.join(OUT, 'content.json'), contentJson)
fs.writeFileSync(path.join(OUT, 'golden.json'), JSON.stringify({ bridge: direct.BRIDGE_VERSION, every: EVERY, cap: CAP, node: { runMs: ms(runMs), initMs: ms(initMs) }, cases }, null, 1))
const kb = (s: string) => `${(Buffer.byteLength(s) / 1024).toFixed(0)} KB`
console.log(`unity:bundle → ${path.relative(process.cwd(), OUT)}: sim.js.txt ${kb(code)} · content.json ${kb(contentJson)} (${info['files']} files) · golden.json ${cases.length} cases · Node start-up ${ms(runMs)} + ${ms(initMs)} ms`)
