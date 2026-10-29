/**
 * `node tools/balance/summary.ts <tools/balance/out/…json> [more.json …]` — one line per recipe cell of a runner JSON:
 * cleared %, against its clear target, boss fights won % and their rounds, ordinary and elite fight rounds, gold per
 * cleared delve against R, deaths per delve and the mean party level at the end. For the what-if sweeps of the balance
 * pass (`npm run balance -- --set …`), where the full report is more than a glance needs.
 */
import { readFileSync } from 'node:fs'

interface Cell {
  key: string
  R?: number
  recipe: { id: string; name: string; clearTarget: [number, number] | null; classes: string[] }
  bossFights: { boss: string; outcome: string; rounds: number }[]
}
interface Delve {
  cell: string
  outcome: string
  falls: number
  partyLevelEnd: number
  gold?: number
  rounds?: Record<string, number[]>
}

const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const f1 = (x: number): string => (Number.isFinite(x) ? x.toFixed(1) : '-')

for (const file of process.argv.slice(2)) {
  const j = JSON.parse(readFileSync(file, 'utf8')) as { args: string[]; cells: Cell[]; delves: Delve[] }
  const set = j.args.includes('--set') ? j.args[j.args.indexOf('--set') + 1] : '(content as is)'
  console.log(`== ${file.replace(/^.*[\/]/, '')} ${set}`)
  for (const c of j.cells) {
    const ds = j.delves.filter((d) => d.cell === c.key)
    const cleared = (100 * ds.filter((d) => d.outcome === 'cleared').length) / Math.max(1, ds.length)
    const t = c.recipe.clearTarget
    const verdict = t === null ? '   ' : cleared < t[0] ? 'LOW' : cleared > t[1] ? 'HI ' : 'ok '
    const won = c.bossFights.filter((b) => b.outcome === 'victory')
    const rounds = mean(won.map((b) => b.rounds))
    const falls = mean(ds.map((d) => d.falls))
    const lvl = mean(ds.map((d) => d.partyLevelEnd))
    const by = (k: string) => ds.flatMap((d) => d.rounds?.[k] ?? [])
    const goldR = c.R ? mean(ds.filter((d) => d.outcome === 'cleared').map((d) => (d.gold ?? 0) / c.R!)) : NaN
    const key = c.key.split('|').slice(1).filter((k) => k !== 'normal' && k !== 'textbook').join(' ')
    console.log(
      `${verdict} ${`${c.recipe.id}${key ? ` ${key}` : ''}`.padEnd(30)} clear ${cleared.toFixed(0).padStart(3)}%${t ? ` (${t[0]}–${t[1]})`.padEnd(10) : ''.padEnd(10)} boss won ${c.bossFights.length ? ((100 * won.length) / c.bossFights.length).toFixed(0).padStart(3) : '  -'}% of ${String(c.bossFights.length).padStart(3)} in ${f1(rounds).padStart(4)} rd (all ${f1(mean(by('boss')))}) · fight ${f1(mean(by('fight')))} · elite ${f1(mean(by('elite')))} · gold ${f1(goldR)} R · deaths ${falls.toFixed(2)} · L${lvl.toFixed(1)}`,
    )
  }
}
