import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActorLayer, type ActorInput, type ActorLook, type ActorModel, type ActorState } from './actors.ts'
import type { Kit } from './kit.ts'

/**
 * The actor layer in node (no renderer): the bars over a fight follow the HUD's cues first and the sim's word after,
 * and an actor whose look is replaced mid-fight (its monster table or model arrived, a boss changed phase) keeps the
 * bar it showed instead of taking the sim's HP at once — else the beats still to play would count their hits twice.
 */
function testKit(): Kit {
  const ramp = new THREE.DataTexture(new Uint8Array([60, 160, 255]), 3, 1, THREE.RedFormat)
  const geo = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 12, 1),
    cyl5: new THREE.CylinderGeometry(1, 1, 1, 6, 1),
    bowl: new THREE.CylinderGeometry(1, 0.6, 1, 12, 1),
    cone: new THREE.ConeGeometry(1, 1, 10, 1),
    ball: new THREE.IcosahedronGeometry(1, 1),
    rock: new THREE.DodecahedronGeometry(1, 0),
    plane: new THREE.PlaneGeometry(1, 1),
    disc: new THREE.CircleGeometry(1, 18),
    ring: new THREE.TorusGeometry(1, 0.08, 6, 20),
    floorRing: new THREE.RingGeometry(0.78, 1, 32),
  }
  const toon = () => new THREE.MeshToonMaterial({ gradientMap: ramp })
  return {
    geo,
    mat: { wall: toon(), floor: toon(), prop: toon(), banner: toon(), glow: new THREE.MeshBasicMaterial(), flame: new THREE.MeshBasicMaterial() },
    tex: { blob: new THREE.Texture(), ramp },
    dispose() {},
  }
}

function look(key: string): ActorLook {
  return { id: 'spider-1', side: 'enemy', kind: 'monster', height: 0.8, radius: 0.4, shape: 'spider', body: 0x6b5040, trim: 0x2a2020, face: 0, eyes: 0xff4040, model: { key, build: () => Promise.resolve(null) } }
}

const input = (key: string, hp: number): ActorInput => ({ look: look(key), state: { hp, maxHp: 31, down: false, gone: false } satisfies ActorState, mark: { x: 2, z: 0, yaw: -Math.PI / 2 } })
const bar = (layer: ActorLayer) => (layer as unknown as { views: Map<string, { hpTarget: number }> }).views.get('spider-1')!.hpTarget
const fightSet = { instant: false, stateNow: false, showBars: true, turnId: null }

describe('the actor layer in a fight', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('plays the hits as cues and takes the sim’s HP once they go quiet', () => {
    vi.useFakeTimers()
    const layer = new ActorLayer(testKit(), new THREE.PerspectiveCamera())
    layer.set([input('spider|a', 31)], { ...fightSet, instant: true, stateNow: true })
    expect(bar(layer)).toBeCloseTo(1)
    // The sim has stepped (31 → 14); the HUD plays the two hits.
    layer.set([input('spider|a', 14)], fightSet)
    layer.cue({ kind: 'hit', actorId: 'spider-1', amount: 9 })
    expect(bar(layer)).toBeCloseTo(22 / 31)
    layer.cue({ kind: 'hit', actorId: 'spider-1', amount: 8 })
    expect(bar(layer)).toBeCloseTo(14 / 31)
    vi.advanceTimersByTime(1000)
    expect(bar(layer)).toBeCloseTo(14 / 31)
    layer.dispose()
  })

  it('keeps the bar it showed when its look is replaced mid-fight (no hit counted twice)', () => {
    vi.useFakeTimers()
    const layer = new ActorLayer(testKit(), new THREE.PerspectiveCamera())
    layer.set([input('capsule', 31)], { ...fightSet, instant: true, stateNow: true })
    layer.set([input('capsule', 14)], fightSet)
    layer.cue({ kind: 'hit', actorId: 'spider-1', amount: 9 })
    // The monster table lands between the beats: the stand-in becomes the spider model.
    layer.set([input('spider|a', 14)], fightSet)
    expect(bar(layer)).toBeCloseTo(22 / 31)
    layer.cue({ kind: 'hit', actorId: 'spider-1', amount: 8 })
    expect(bar(layer)).toBeCloseTo(14 / 31)
    vi.advanceTimersByTime(1000)
    expect(bar(layer)).toBeCloseTo(14 / 31)
    layer.dispose()
  })

  it('starts a fight’s bars where the HUD’s meters are and lets each beat set them (the opening blows counted once)', () => {
    vi.useFakeTimers()
    const layer = new ActorLayer(testKit(), new THREE.PerspectiveCamera())
    // The fight opened with two blows on the spider: the sim says 14, the HUD has yet to play them (it shows 31).
    layer.set([{ ...input('spider|a', 14), shownHp: 31 }], { ...fightSet, instant: true, stateNow: true })
    expect(bar(layer)).toBeCloseTo(1)
    layer.cue({ kind: 'hit', actorId: 'spider-1', amount: 9, hp: 22, maxHp: 31 })
    expect(bar(layer)).toBeCloseTo(22 / 31)
    layer.cue({ kind: 'hit', actorId: 'spider-1', amount: 8, hp: 14, maxHp: 31 })
    expect(bar(layer)).toBeCloseTo(14 / 31)
    // A cue that says where the beat leaves the bar is never counted twice, whatever the bar showed before it.
    layer.cue({ kind: 'hit', actorId: 'spider-1', amount: 8, hp: 14, maxHp: 31 })
    expect(bar(layer)).toBeCloseTo(14 / 31)
    vi.advanceTimersByTime(1000)
    expect(bar(layer)).toBeCloseTo(14 / 31)
    layer.dispose()
  })
})

/** A model that records its tell (the Bursting Corpse's swell, monsters/wear.ts). */
function tellModel(): { model: ActorModel; tells: number[] } {
  const tells: number[] = []
  const animator = { has: () => false, hasClips: () => false, setBase() {}, play: () => false, update() {}, release() {}, eventTime: () => null, durationOf: () => 0, speedOf: () => null, baseClip: () => 'Idle', setBaseTimeScale() {}, loopClip: () => false }
  const model = {
    root: new THREE.Group(),
    animator: animator as unknown as ActorModel['animator'],
    height: 1.8,
    stride: 1,
    hasShield: false,
    update() {},
    setTint() {},
    setFlash() {},
    setOpacity() {},
    setTell: (k: number) => tells.push(k),
    dispose() {},
  } satisfies ActorModel
  return { model, tells }
}

describe('the actor layer and the arena', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const corpse = (model: ActorModel | null, tell: boolean): ActorInput => ({
    look: { id: 'bursting-corpse-1', side: 'enemy', kind: 'monster', height: 1.8, radius: 0.3, shape: 'biped', body: 0x6e4f6b, trim: 0, face: 0, eyes: 0, model: { key: 'zombie|bursting', build: () => Promise.resolve(model) } },
    state: { hp: 20, maxHp: 40, down: false, gone: false, tell },
    mark: { x: 2, z: 0, yaw: -Math.PI / 2 },
  })

  it('a wound-up tell swells the model over the wind-up and lets it go with the blow', async () => {
    vi.useFakeTimers()
    const { model, tells } = tellModel()
    const layer = new ActorLayer(testKit(), new THREE.PerspectiveCamera())
    layer.set([corpse(model, false)], { ...fightSet, instant: true, stateNow: true })
    await layer.modelsSettled()
    expect(tells.at(-1)).toBe(0)
    layer.set([corpse(model, true)], { ...fightSet, stateNow: true })
    layer.update(450, 0)
    expect(tells.at(-1)).toBeCloseTo(0.5)
    for (let i = 0; i < 10; i++) layer.update(100, i * 100)
    expect(tells.at(-1)!).toBeGreaterThan(0.93)
    layer.set([corpse(model, false)], { ...fightSet, stateNow: true })
    layer.update(150, 0)
    expect(tells.at(-1)).toBeCloseTo(0.5)
    layer.update(400, 0)
    expect(tells.at(-1)).toBe(0)
    layer.dispose()
  })

  it('with Reduce motion the tell shows at once', async () => {
    vi.useFakeTimers()
    const { model, tells } = tellModel()
    const layer = new ActorLayer(testKit(), new THREE.PerspectiveCamera())
    layer.setReduceMotion(true)
    layer.set([corpse(model, false)], { ...fightSet, instant: true, stateNow: true })
    await layer.modelsSettled()
    layer.set([corpse(model, true)], { ...fightSet, stateNow: true })
    expect(tells.at(-1)).toBe(1)
    layer.dispose()
  })

  it('a monster joining the fight walks in to its mark, but a boss on his arena mark is there already', () => {
    const layer = new ActorLayer(testKit(), new THREE.PerspectiveCamera())
    const views = (layer as unknown as { views: Map<string, { pos: THREE.Vector3 }> }).views
    layer.set([{ ...input('capsule', 31), mark: { x: 2, z: 0, yaw: -Math.PI / 2 } }], fightSet)
    expect(views.get('spider-1')!.pos.x).toBeGreaterThan(2.5)
    const king: ActorInput = { look: { ...look('capsule'), id: 'hollow-king' }, state: { hp: 1, maxHp: 1, down: false, gone: false }, mark: { x: 0, y: 2, z: -5, yaw: 0 }, stand: true }
    layer.set([king], fightSet)
    expect(views.get('hollow-king')!.pos.toArray()).toEqual([0, 2, -5])
    layer.dispose()
  })
})
