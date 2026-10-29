import { describe, expect, it } from 'vitest'
import { groupActions, reasonWords, splitOwner } from './actions.ts'
import { mapView, mapWindow, type MapStateLike } from './mapLayout.ts'
import { clockWords, deathLines, overWords, requirementWords, resultLines, roomLine, stairsThreat, templateName } from './words.ts'

function state(over: Partial<MapStateLike['floor']> = {}): MapStateLike {
  const rooms = [
    { id: 'r0', kind: 'entry', hasKey: false, cells: [{ x: 2, y: 0 }], doors: [{ to: 'r1', side: 'south' as const, offset: 0, locked: false, secret: false }] },
    {
      id: 'r1',
      kind: 'fight',
      hasKey: false,
      cells: [{ x: 2, y: 1 }],
      doors: [
        { to: 'r0', side: 'north' as const, offset: 0, locked: false, secret: false },
        { to: 'r2', side: 'south' as const, offset: 0, locked: true, secret: false },
        { to: 'r3', side: 'east' as const, offset: 0, locked: false, secret: true },
      ],
    },
    { id: 'r2', kind: 'stairs', hasKey: false, cells: [{ x: 2, y: 2 }, { x: 3, y: 2 }], doors: [{ to: 'r1', side: 'north' as const, offset: 0, locked: true, secret: false }] },
    { id: 'r3', kind: 'secret', hasKey: true, cells: [{ x: 3, y: 1 }], doors: [{ to: 'r1', side: 'west' as const, offset: 0, locked: false, secret: true }] },
  ]
  return {
    floor: {
      currentRoomId: 'r1',
      hasKey: false,
      graph: { grid: { w: 8, h: 6 }, entryId: 'r0', exitId: 'r2', rooms },
      rooms: {
        r0: { visited: true, scouted: true, cleared: true, secretRevealed: false },
        r1: { visited: true, scouted: true, cleared: true, secretRevealed: false },
        r2: { visited: false, scouted: false, cleared: false, secretRevealed: false },
        r3: { visited: false, scouted: false, cleared: false, secretRevealed: false },
      },
      hunter: null,
      ...over,
    },
  }
}

describe('the floor map', () => {
  it('shows visited rooms, glimpses the room behind a known door, and hides an unfound secret', () => {
    const v = mapView(state(), [])
    const byId = new Map(v.rooms.map((r) => [r.id, r]))
    expect(byId.get('r1')!.status).toBe('current')
    expect(byId.get('r0')!.status).toBe('visited')
    expect(byId.get('r2')!.status).toBe('glimpsed')
    expect(byId.get('r2')!.kind).toBeNull()
    expect(byId.has('r3')).toBe(false)
    expect(byId.get('r2')).toMatchObject({ x: 2, y: 2, w: 2, h: 1 })
    expect(v.centre).toEqual({ x: 2.5, y: 1.5 })
  })

  it('a found secret door shows the secret room; a scouted room shows its kind', () => {
    const s = state()
    s.floor.rooms.r1!.secretRevealed = true
    s.floor.rooms.r2!.scouted = true
    const v = mapView(s, [])
    const byId = new Map(v.rooms.map((r) => [r.id, r]))
    expect(byId.get('r3')!.status).toBe('glimpsed')
    expect(byId.get('r2')!.kind).toBe('stairs')
    expect(byId.get('r2')!.exit).toBe(true)
  })

  it('doors sit on the shared edges, locked ones marked until the key is found', () => {
    const v = mapView(state(), [])
    const locked = v.doors.find((d) => d.locked)
    expect(locked).toMatchObject({ x: 2.5, y: 2, vertical: false })
    expect(v.doors.filter((d) => d.x === 2.5 && d.y === 1)).toHaveLength(1)
    expect(mapView(state({ hasKey: true }), []).doors.some((d) => d.locked)).toBe(false)
  })

  it('legal moves make neighbours tappable, with the reason when blocked', () => {
    const v = mapView(state(), [
      { command: { kind: 'move', toRoomId: 'r0' }, enabled: true },
      { command: { kind: 'move', toRoomId: 'r2' }, enabled: false, reason: 'locked: find the key' },
    ])
    const byId = new Map(v.rooms.map((r) => [r.id, r]))
    expect(byId.get('r0')!.move).toEqual({ enabled: true, reason: undefined })
    expect(byId.get('r2')!.move).toEqual({ enabled: false, reason: 'locked: find the key' })
    expect(byId.get('r1')!.move).toBeNull()
  })

  it('puts the icon of a big room in the cell nearest the party', () => {
    const v = mapView(state(), [])
    const r2 = v.rooms.find((r) => r.id === 'r2')!
    expect(r2.icon).toEqual({ x: 2.5, y: 2.5 })
    expect(v.rooms.find((r) => r.id === 'r1')!.icon).toEqual({ x: 2.5, y: 1.5 })
  })

  it('shows the hunter where it is once it has entered', () => {
    const v = mapView(state({ hunter: { entered: true, killed: false, roomId: 'r2' } }), [])
    expect(v.rooms.find((r) => r.id === 'r2')!.hunter).toBe(true)
  })

  it('the compact window centres on the party and stays on the grid', () => {
    expect(mapWindow({ grid: { w: 8, h: 6 }, centre: { x: 2.5, y: 1.5 } }, 5, 3)).toEqual({ x0: 0, y0: 0 })
    expect(mapWindow({ grid: { w: 8, h: 6 }, centre: { x: 7.5, y: 5.5 } }, 5, 3)).toEqual({ x0: 3, y0: 3 })
    expect(mapWindow({ grid: { w: 8, h: 6 }, centre: { x: 4.5, y: 3.5 } }, 5, 3)).toEqual({ x0: 2, y0: 2 })
  })
})

describe('room actions', () => {
  const legal = [
    { command: { kind: 'move', toRoomId: 'r2' }, label: 'Door → ? r2', enabled: true },
    { command: { kind: 'disarm', trapIndex: 0, heroIndex: 0 }, label: 'Disarm Tripwire Bell (Warden, 62%)', enabled: true },
    { command: { kind: 'disarm', trapIndex: 0, heroIndex: 1 }, label: 'Disarm Tripwire Bell (Mender, 50%)', enabled: true },
    { command: { kind: 'openChest', chestIndex: 0, useKey: false, heroIndex: 0 }, label: 'Open small chest (locked)', enabled: false, reason: 'locked' },
    { command: { kind: 'useItem', heroIndex: 0, instanceId: 'a' }, label: 'Use Torch ×2 (Warden)', enabled: true },
    { command: { kind: 'stance', heroIndex: 0, stance: 'guard' }, label: 'Cellar Hound: guard stance', enabled: true },
    { command: { kind: 'descend' }, label: 'Take the stairs', enabled: true },
    { command: { kind: 'retreat' }, label: 'Teleport out to town', enabled: true },
    { command: { kind: 'auto' }, label: 'Auto', enabled: true },
  ]

  it('sorts actions into groups with their test ids', () => {
    const g = groupActions(legal)
    expect(g.moves.get('r2')!.testid).toBe('dv-move-r2')
    expect(g.traps.map((i) => i.testid)).toEqual(['dv-action-disarm', 'dv-action-disarm-2'])
    expect(g.loot[0]).toMatchObject({ testid: 'dv-action-openChest', reason: 'Locked, and nobody can pick it' })
    expect(g.items).toHaveLength(1)
    expect(g.pets).toHaveLength(1)
    expect(g.leave.map((i) => i.testid)).toEqual(['dv-action-descend', 'dv-action-retreat'])
    expect(g.auto).toMatchObject({ testid: 'dv-action-auto', label: 'Auto-step' })
  })

  it('curio choices and Continue get their own ids', () => {
    const g = groupActions([
      { command: { kind: 'curio', choice: 0 }, label: 'Open', enabled: true },
      { command: { kind: 'curio', choice: 2 }, label: 'Leave (leave)', enabled: true },
      { command: { kind: 'continue' }, label: 'Continue', enabled: true },
    ])
    expect(g.curio.map((i) => i.testid)).toEqual(['dv-curio-0', 'dv-curio-2'])
    expect(g.next!.testid).toBe('dv-continue')
  })

  it('fight commands are not the room panel’s', () => {
    expect(groupActions([{ command: { kind: 'fight' }, label: 'Attack', enabled: true }]).other).toHaveLength(0)
  })

  it('words for reasons and owners', () => {
    expect(reasonWords('a trap blocks this door')).toBe('A trap blocks this door')
    expect(reasonWords('something new')).toBe('Something new')
    expect(splitOwner('Use Torch ×2 (Warden)')).toEqual({ text: 'Torch ×2', owner: 'Warden' })
    expect(splitOwner('Rest')).toEqual({ text: 'Rest', owner: null })
  })
})

describe('words', () => {
  it('names templates', () => {
    expect(templateName('cel-t-wine-vault')).toBe('Wine vault')
    expect(templateName('cel-t-stairwell')).toBe('Stairwell')
  })

  it('the floor clock warns as the hunter nears and says when it is in', () => {
    expect(clockWords(3, null, null, 'Old Gnaw')).toEqual({ text: 'Clock 3', tone: 'plain' })
    expect(clockWords(3, 40, { entered: false, killed: false }, 'Old Gnaw').tone).toBe('plain')
    expect(clockWords(34, 40, { entered: false, killed: false }, 'Old Gnaw')).toEqual({ text: 'Old Gnaw is coming (6)', tone: 'warn' })
    expect(clockWords(41, 40, { entered: true, killed: false }, 'Old Gnaw')).toEqual({ text: 'Old Gnaw is on this floor', tone: 'bad' })
  })

  it('says how a delve ended in plain words', () => {
    expect(overWords('wiped', false, 2, 'The Cellars').line).toBe('The party fell. Unbanked gold is lost; everything else is kept.')
    expect(overWords('retreated', true, 2, 'The Cellars').title).toBe('Teleported out')
    expect(overWords('retreated', false, 1, 'The Cellars').title).toBe('Walked out')
    expect(overWords('cleared', true, 3, 'The Cellars').title).toBe('The Cellars cleared')
  })

  it('finds level-ups in the result lines (D-082)', () => {
    const lines = resultLines(['+34 gold', '2 item(s)', 'Warden: slash +1 rank, +1 strength, level 3', 'Mender: +1 wisdom', '−5 gold stolen'])
    expect(lines[0]).toMatchObject({ levelUp: false, tone: 'good' })
    expect(lines[2]).toMatchObject({ levelUp: true, hero: 'Warden', level: 3, rest: 'slash +1 rank, +1 strength' })
    expect(lines[3]!.levelUp).toBe(false)
    expect(lines[4]!.tone).toBe('bad')
  })

  it('describes what a curio choice needs', () => {
    const name = (id: string) => (id === 'torch' ? 'Torch' : id)
    expect(requirementWords({ kind: 'item', id: 'torch', amount: 1 }, name)).toBe('needs a Torch')
    expect(requirementWords({ kind: 'fieldSkillRank', id: 'foraging', min: 3 }, name)).toBe('needs Foraging rank 3')
    expect(requirementWords({ kind: 'detection', min: 14 }, name)).toBe('needs Detection 14')
    // Phase 7 (C1): the Vault's safe items read as English.
    const named = (id: string) => ({ 'oilskin-cloak': 'Oilskin Cloak', 'wax-plugs': 'Wax Plugs', 'flint-and-oil': 'Flint & Oil', 'loaded-dice': 'Loaded Dice', 'grave-salt': 'Grave Salt' })[id] ?? id
    expect(requirementWords({ kind: 'item', id: 'oilskin-cloak', amount: 1 }, named)).toBe('needs an Oilskin Cloak')
    expect(requirementWords({ kind: 'item', id: 'wax-plugs', amount: 1 }, named)).toBe('needs Wax Plugs')
    expect(requirementWords({ kind: 'item', id: 'flint-and-oil', amount: 1 }, named)).toBe('needs Flint & Oil')
    expect(requirementWords({ kind: 'item', id: 'loaded-dice', amount: 1 }, named)).toBe('needs Loaded Dice')
    expect(requirementWords({ kind: 'item', id: 'grave-salt', amount: 1 }, named)).toBe('needs Grave Salt')
    expect(requirementWords({ kind: 'attribute', id: 'strength', min: 14 }, named)).toBe('needs Strength 14')
  })

  it('describes a room in a line', () => {
    expect(roomLine('rest', { cleared: true, restUsed: true, curioUsed: false, visited: true }, false, false)).toContain('rested')
    expect(roomLine('stairs', { cleared: true, restUsed: false, curioUsed: false, visited: true }, true, false)).toContain('teleport out')
  })
})

describe('death and danger (D-088, D-089, D-092)', () => {
  it('the stairs name the next floor and its boss, and warn under Mortal when it is dangerous', () => {
    expect(stairsThreat(2, 'even', null, true)).toEqual({ text: 'Floor 2 below: Even', band: 'even', warn: null })
    const boss = stairsThreat(3, 'dangerous', 'deadly', true)
    expect(boss.text).toBe('Floor 3 below: Dangerous · its boss: Deadly')
    expect(boss.band).toBe('deadly')
    expect(boss.warn).toBe('Heroes who die there stay dead.')
    expect(stairsThreat(3, 'dangerous', 'deadly', false).warn).toBeNull()
  })

  it('the end of a delve says who lies at the Shrine, or who is lost for good after a wipe', () => {
    const party = [
      { name: 'Varra', fallen: true, hasPet: true },
      { name: 'Orrin', fallen: false, hasPet: false },
    ]
    expect(deathLines(party, 'retreated', true)).toEqual({ died: ['Varra lies at the Ember Shrine in Emberfall'], lost: [] })
    expect(deathLines(party, 'wiped', true).lost).toEqual([
      "Varra is lost for good; their gear and pet come home with the Lantern Inn's bearers",
      "Orrin is lost for good; their gear comes home with the Lantern Inn's bearers",
    ])
    expect(deathLines(party, 'wiped', false)).toEqual({ died: [], lost: [] })
    expect(overWords('wiped', false, 2, 'The Cellars', true).title).toBe('The party is lost')
    expect(overWords('wiped', false, 2, 'The Cellars', false).title).toBe('The party fell')
  })

  it('a death in the result lines stands out', () => {
    const [line] = resultLines(['Varra has died. The party carries the body.'])
    expect(line).toMatchObject({ death: true, levelUp: false, tone: 'bad' })
  })

  it('the raise action has its own group and test id', () => {
    const g = groupActions([
      { command: { kind: 'raise', heroIndex: 1, targetIndex: 0 }, label: 'Raise Varra (Mender; Varra loses 1 level)', enabled: true },
      { command: { kind: 'raise', heroIndex: 2, targetIndex: 0 }, label: 'Raise Varra (Sister; Varra loses 1 level)', enabled: false, reason: 'Sister needs 50% of their pool' },
    ])
    expect(g.raise.map((i) => i.testid)).toEqual(['dv-action-raise', 'dv-action-raise-2'])
    expect(g.raise[1]!.reason).toBe('Sister needs 50% of their pool')
    expect(g.camp).toHaveLength(0)
  })

  it('known fight rooms carry their threat; a move read wins; cleared rooms have none', () => {
    const s = state()
    s.floor.rooms.r2!.scouted = true
    const v = mapView(s, [{ command: { kind: 'move', toRoomId: 'r2' }, enabled: true, threat: { band: 'deadly' } }], new Map([['r2', 'even'], ['r0', 'easy']]))
    const byId = new Map(v.rooms.map((r) => [r.id, r]))
    expect(byId.get('r2')!.threat).toBe('deadly')
    // r0 is visited and cleared: no chip.
    expect(byId.get('r0')!.threat).toBeNull()
    // A glimpsed room shows no threat (its fight is not known).
    expect(mapView(state(), [], new Map([['r2', 'deadly']])).rooms.find((r) => r.id === 'r2')!.threat).toBeNull()
  })
})
