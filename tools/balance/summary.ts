/**
 * `node tools/balance/summary.ts <tools/balance/out/…json> [more.json …]` — one line per recipe cell of a runner JSON:
 * cleared %, against its clear target, boss fights won %, deaths per delve and the mean party level at the end. For the
 * what-if sweeps of the balance pass (`npm run balance -- --set …`), where the full report is more than a glance needs.
 */
import { readFileSync } from 'node:fs'

interface Cell {
  key: string
  recipe: { id: string; name: string; clearTarget: [number, number] | null; classes: string[] }
  bossFights: { boss: string; outcome: string; rounds: number }[]
}
interface Delve {
  cell: string
  outcome: string
  falls: number
  partyLevelEnd: number
}

for (const file of process.argv.slice(2)) {
  const j = JSON.parse(readFileSync(file, 'utf8')) as { args: string[]; cells: Cell[]; delves: Delve[] }
  const set = j.args.includes('--set') ? j.args[j.args.indexOf('--set') + 1] : '(content as is)'
  console.log(`== ${file.replace(/^.*[\\/]/, '')} ${set}`)
  for (const c of j.cells) {
    const ds = j.delves.filter((d) => d.cell === c.key)
    const cleared = (100 * ds.filter((d) => d.outcome === 'cleared').length) / Math.max(1, ds.length)
    const t = c.recipe.clearTarget
    const verdict = t === null ? '   ' : cleared < t[0] ? 'LOW' : cleared > t[1] ? 'HI ' : 'ok '
    const won = c.bossFights.filter((b) => b.outcome === 'victory')
    const rounds = won.length ? won.reduce((s, b) => s + b.rounds, 0) / won.length : NaN
    const falls = ds.reduce((s, d) => s + d.falls, 0) / Math.max(1, ds.length)
    const lvl = ds.reduce((s, d) => s + d.partyLevelEnd, 0) / Math.max(1, ds.length)
    console.log(`${verdict} ${c.recipe.id.padEnd(20)} clear ${cleared.toFixed(0).padStart(3)}%${t ? ` (${t[0]}–${t[1]})`.padEnd(10) : ''.padEnd(10)} boss won ${c.bossFights.length ? ((100 * won.length) / c.bossFights.length).toFixed(0).padStart(3) : '  -'}% of ${String(c.bossFights.length).padStart(3)} in ${Number.isFinite(rounds) ? rounds.toFixed(1) : '-'} rd · deaths ${falls.toFixed(2)} · L${lvl.toFixed(1)}`)
  }
}
