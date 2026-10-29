import { describe, expect, it } from 'vitest'
import { blindView, isBlind } from './blindMap.ts'
import type { MapRoomView, MapView } from './mapLayout.ts'

function room(id: string, status: MapRoomView['status'], x: number, move: boolean): MapRoomView {
  return { id, kind: status === 'glimpsed' ? null : 'fight', status, x, y: 0, w: 1, h: 1, icon: { x: x + 0.5, y: 0.5 }, move: move ? { enabled: true } : null, hunter: false, key: false, cleared: false, exit: false, entry: false, threat: null }
}

describe('the Blind Map Pact on the map (07 §6.2)', () => {
  it('keeps the room the party stands in, its neighbours and its doors; forgets the rest', () => {
    const view: MapView = {
      rooms: [room('r0', 'visited', 0, false), room('r1', 'current', 1, false), room('r2', 'glimpsed', 2, true), room('r3', 'scouted', 3, false)],
      doors: [
        { x: 1, y: 0.5, vertical: true, locked: false, secret: false },
        { x: 2, y: 0.5, vertical: true, locked: false, secret: false },
        { x: 3, y: 0.5, vertical: true, locked: false, secret: false },
      ],
      grid: { w: 8, h: 6 },
      centre: { x: 1.5, y: 0.5 },
    }
    const blind = blindView(view)
    expect(blind.rooms.map((r) => r.id)).toEqual(['r1', 'r2'])
    expect(blind.doors.map((d) => d.x)).toEqual([1, 2])
    expect(isBlind(['no-minimap', 'no-scouting'])).toBe(true)
    expect(isBlind(['loud-boots'])).toBe(false)
  })
})
