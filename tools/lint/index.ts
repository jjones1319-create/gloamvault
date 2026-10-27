/**
 * `npm run lint` → `node tools/lint/index.ts [--saves [path]]`
 * Validates content/ against content/schemas/ and runs the cross-file rules of content/README.md.
 * Exit code 0 only when every file passed and no rule failed. Nothing is written.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatResult, lintCorpus } from './lint.ts'

const argv = process.argv.slice(2)
let saves: string | boolean | undefined
const savesAt = argv.indexOf('--saves')
if (savesAt !== -1) {
  const next = argv[savesAt + 1]
  saves = next !== undefined && !next.startsWith('--') ? next : true
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const result = lintCorpus(rootDir, saves === undefined ? {} : { saves })
process.stdout.write(`${formatResult(result)}\n`)
process.exitCode = result.ok ? 0 : 1
