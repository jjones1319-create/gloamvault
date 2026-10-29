import { describe, expect, it } from 'vitest'
import { FIGHT_INSETS, fightInsets, ROOM_INSETS, roomInsets } from './insets.ts'

describe('the delve’s insets (Phase 8)', () => {
  it('the room clears the header (it ends at 65 px) and the party’s cards (67 px from the bottom)', () => {
    expect(ROOM_INSETS.top).toBeGreaterThanOrEqual(65)
    expect(ROOM_INSETS.bottom).toBeGreaterThanOrEqual(67)
    expect(roomInsets('normal')).toEqual(ROOM_INSETS)
  })

  it('both grow with the text size, the fight’s at most by what the banner and the feed grow', () => {
    expect(roomInsets('largest').top).toBeGreaterThan(roomInsets('large').top)
    expect(roomInsets('large').top).toBeGreaterThan(roomInsets('normal').top)
    expect(fightInsets('normal')).toEqual(FIGHT_INSETS)
    expect(fightInsets('largest').top - FIGHT_INSETS.top).toBe(8)
    expect(fightInsets('largest').bottom - FIGHT_INSETS.bottom).toBeLessThanOrEqual(16)
    expect(fightInsets('largest').left).toBe(FIGHT_INSETS.left)
  })
})
