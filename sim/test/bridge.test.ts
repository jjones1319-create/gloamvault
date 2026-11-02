import { beforeAll, describe, expect, it } from 'vitest'
import { readContentFiles } from '../../tools/sim/loadContent.ts'
import * as bridge from '../src/bridge.ts'
import { buildContent } from '../src/content.ts'
import { createDelve, hashDelve, runDelveAuto } from '../src/delve.ts'

/** The bridge the Unity app calls (D-139, Phase 10): strings in and out, the state kept behind handles. */
describe('the bridge', () => {
  const files = readContentFiles('content')
  const contentJson = JSON.stringify(files)
  const request = { dungeonId: 'gravehollow-keep', zone: 1, seed: 17, auto: true, party: [{ classId: 'warden' }, { classId: 'mender' }] }

  beforeAll(() => {
    bridge.init(contentJson)
  })

  it('init indexes the raw files and reports the counts', () => {
    const info = JSON.parse(bridge.init(contentJson)) as Record<string, number>
    expect(info['bridge']).toBe(bridge.BRIDGE_VERSION)
    expect(info['files']).toBe(files.length)
    expect(info['class']).toBeGreaterThanOrEqual(6)
    expect(info['dungeon']).toBeGreaterThanOrEqual(1)
  })

  it('plays a delve to the same hash as the sim called directly (the CLI\'s heroes)', () => {
    const h = bridge.createDelve(JSON.stringify(request))
    let r = { over: false, commands: 0 }
    for (let i = 0; i < 500 && !r.over; i++) r = JSON.parse(bridge.step(h, '{"kind":"auto"}')) as typeof r
    expect(r.over).toBe(true)

    const content = buildContent(files)
    const state = createDelve(content, { dungeonId: 'gravehollow-keep', zone: 1, seed: 17, difficulty: 'normal', pactIds: [], auto: true, policy: 'textbook' }, bridge.createParty(content, 17, request.party))
    runDelveAuto(content, state)
    expect(bridge.hash(h)).toBe(hashDelve(state))
    expect(JSON.parse(bridge.summary(h))).toMatchObject({ commands: state.commandLog.length })
    bridge.dispose(h)
  })

  it('plays a laid-out floor (Phase 17): the flat snapshot, the room report and the actions the walked floor reads', () => {
    const h = bridge.createDelve(JSON.stringify({ dungeonId: 'gravehollow-keep', floor: 1, lastFloor: 1, floorLayoutId: 'floor-1', seed: 11, party: [{ classId: 'warden', speciesId: 'dwarf' }] }))
    const snap = () => JSON.parse(bridge.snapshot(h)) as Record<string, unknown>
    let s = snap()
    expect(s['phase']).toBe('room')
    expect(s['roomId']).toBe('r0')
    expect(s['walkBudget']).toBeGreaterThanOrEqual(25)
    // Never a null: JsonUtility would choke on one.
    expect(JSON.stringify(s)).not.toContain('null')
    const gate = JSON.parse(bridge.room(h, 'r0')) as Record<string, unknown>
    expect(gate['kind']).toBe('entry')
    const r2 = JSON.parse(bridge.room(h, 'r2')) as Record<string, unknown>
    expect(r2['encounterId']).toBeTruthy()
    expect(r2['monsterId']).toBeTruthy()
    expect(JSON.stringify(r2)).not.toContain('null')
    // Entering the monsters' room starts nothing; reaching them does.
    bridge.step(h, JSON.stringify({ kind: 'move', toRoomId: 'r1' }))
    bridge.step(h, JSON.stringify({ kind: 'move', toRoomId: 'r2' }))
    expect(snap()['phase']).toBe('room')
    bridge.step(h, JSON.stringify({ kind: 'engage' }))
    s = snap()
    expect(s['phase']).toBe('fight')
    expect((s['enemies'] as unknown[]).length).toBeGreaterThan(0)
    for (let i = 0; i < 600 && snap()['phase'] === 'fight'; i++) bridge.step(h, '{"kind":"auto"}')
    s = snap()
    expect(['result', 'over']).toContain(s['phase'])
    const acts = JSON.parse(bridge.actions(h)) as { items: { kind: string; label: string; enabled: boolean; command: string }[] }
    expect(acts.items.length).toBeGreaterThan(0)
    expect(() => JSON.parse(acts.items[0]!.command)).not.toThrow()
    expect(JSON.stringify(s)).not.toContain('null')
    bridge.dispose(h)
  })

  it('keeps delves apart by handle, and a disposed handle is gone', () => {
    const a = bridge.createDelve(JSON.stringify(request))
    const b = bridge.createDelve(JSON.stringify({ ...request, seed: 18 }))
    expect(a).not.toBe(b)
    expect(bridge.hash(a)).not.toBe(bridge.hash(b))
    bridge.step(a, '{"kind":"auto"}')
    expect(JSON.parse(bridge.logSince(a, 0)).length).toBeGreaterThan(0)
    expect(JSON.parse(bridge.phase(b))).toHaveProperty('kind')
    bridge.dispose(a)
    expect(() => bridge.hash(a)).toThrow(/no delve with handle/)
    bridge.dispose(b)
  })

  it('offers the legal commands as JSON', () => {
    const h = bridge.createDelve(JSON.stringify(request))
    const actions = JSON.parse(bridge.legal(h)) as { command: { kind: string }; enabled: boolean }[]
    expect(actions.some((a) => a.enabled)).toBe(true)
    bridge.dispose(h)
  })

  it('says what is wrong with bad input', () => {
    expect(() => bridge.createDelve('{')).toThrow(/delve request: invalid JSON/)
    expect(() => bridge.createDelve(JSON.stringify({ ...request, dungeonId: 'nowhere' }))).toThrow(/no dungeon "nowhere"/)
    expect(() => bridge.createDelve(JSON.stringify({ ...request, party: [{ classId: 'jester' }] }))).toThrow(/no class "jester"/)
    const h = bridge.createDelve(JSON.stringify(request))
    expect(() => bridge.step(h, '{"kind":"move","toRoomId":"nowhere"}')).toThrow()
    bridge.dispose(h)
  })
})
