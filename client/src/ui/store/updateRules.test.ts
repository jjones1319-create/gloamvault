import { describe, expect, it } from 'vitest'
import { updateQuiet } from './updateRules.ts'

describe('the update toast’s rules (never mid-fight; only in town and on the title)', () => {
  it('shows on the title and in town while no delve is in progress', () => {
    for (const screen of ['title', 'town', 'hero', 'codex']) expect(updateQuiet(screen, false), screen).toBe(true)
  })

  it('never shows in a delve, a fight, Settings or the viewers', () => {
    for (const screen of ['delve', 'autoplay', 'settings', 'phone', 'viewer', 'room', 'new-hero']) expect(updateQuiet(screen, false), screen).toBe(false)
  })

  it('waits while a delve is in progress, even on the title or in town', () => {
    for (const screen of ['title', 'town', 'hero', 'codex']) expect(updateQuiet(screen, true), screen).toBe(false)
  })
})
