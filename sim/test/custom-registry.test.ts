import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CUSTOM_HANDLERS, HANDLER_GROUPS } from '../src/skills/custom/index.ts'

const DIR = 'sim/src/skills/custom'
const NOT_HANDLERS = new Set(['index.ts', 'types.ts'])

describe('the custom hook registry', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.ts') && !NOT_HANDLERS.has(f) && !f.startsWith('_group-'))
  const ids = files.map((f) => f.slice(0, -3))

  it('registers every handler file under its own file name', () => {
    const missing = ids.filter((id) => !CUSTOM_HANDLERS.has(id))
    expect(missing).toEqual([])
  })

  it('registers nothing without a file and nothing twice', () => {
    const all = Object.values(HANDLER_GROUPS).flat().map(([id]) => id)
    const dupes = all.filter((id, i) => all.indexOf(id) !== i)
    expect(dupes).toEqual([])
    const orphans = all.filter((id) => !ids.includes(id))
    expect(orphans).toEqual([])
  })

  it('uses kebab-case ids that the content id pattern accepts', () => {
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })
})
