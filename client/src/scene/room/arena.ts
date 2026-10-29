import * as THREE from 'three'
import type { Content } from '../../../../sim/src/content.ts'
import type { Actor, FightState } from '../../../../sim/src/fight-types.ts'
import { ENV_ALPHA, ENV_ATTRIBUTE } from '../env/envMaterial.ts'
import { KitRoomBuilder, type KitBuild } from '../env/kitRoom.ts'
import { resolveMonsterVariant } from '../monsters/manifest.ts'
import { monsterLibrary, type PropModel } from '../monsters/model.ts'
import type { FlamePoint, MotePoint } from '../vfx/layer.ts'
import { trs } from './builder.ts'
import type { DoorPanel, LightPoint, StaticRoom, TemplateLike } from './dress.ts'
import { propYaw, rotatePoint, type Mark } from './layout.ts'

/**
 * The boss arenas in 3D (Phase 7, pass C2; 07 §2.8, 06 §3): what the room shows of the fight's `arena` state.
 *
 * - **Marks.** A boss stands on its arena's mark while its phase holds it there (07 §2.2: Vexa on the dais before her
 *   chair, Naesa at the Tide Altar, the Hollow King on his throne raised 2 m), then joins the fight's lines; the Crypts
 *   chapel's elite stands on the altar step (EB2, raised 0.6 m). The rest of the fight is laid out without them.
 * - **The candle ring** of the Warden's Vigil shows `candles.lit` of `of`, going out counter-clockwise seen from above,
 *   from the candle farthest from the camera.
 * - **The tide** (the drowned chapel; the throne from phase 3): the knee-deep water rises from its 0.45 m with
 *   `tide.level / max` to the throne's fourth step (1.0 m) and creeps over the dry step toward the door — one sheet of
 *   the zone's water material in place of the template's water tiles, eased (at once with Reduce motion).
 * - **The braziers** of the throne: lit when a Torch relit them this phase (`props[].done`), else smouldering — a small
 *   ember, a thread of smoke, a dimmer light.
 * - **The throne.** The kit's empty iron seat is hidden while the King's own throne is drawn: under him in phase 1, and
 *   risen on its column on the dais from phase 2 (monsters/model.ts `buildProps`) while he fights below.
 * - **The tap room's dais and the Captain's chair** (07 §2.2's furniture, kit pieces the template does not place yet).
 *
 * Draw cost: one water sheet, the dais and the chair (2 calls), the risen throne (2 calls); nothing per frame but the
 * tide's easing. The arena keeps the last state it saw for the room it is in (the candles stay out after the fight).
 */

/** Who an arena mark holds. */
export type MarkRole = 'boss' | 'elite'

export interface ArenaMarkSpec {
  role: MarkRole
  /** The boss's phases it holds for (1-based); every phase when absent. */
  phases?: readonly number[]
  /** Template space (metres): x, the height it stands at, z. */
  at: readonly [number, number, number]
  /** Facing in template space (degrees, three.js rotation.y: 0 faces +z, the template camera's side). */
  yaw: number
  /** The boss it is for (the room viewer stands him there; it hides `skipParts` while he does). */
  monster?: string
  skipParts?: Readonly<Record<string, readonly string[]>>
}

/** The dais's top (cel_dais: 0.2 m of timber under 0.05 m boards). */
const DAIS_TOP = 0.25
/** Where the tap room's dais and the Captain's chair stand (template space; the dais's back runs into the N wall). */
const DAIS = { at: [0, 0, -7.0] as const, chair: [0, DAIS_TOP, -7.55] as const }

export const ARENA_MARKS: Readonly<Record<string, readonly ArenaMarkSpec[]>> = {
  // 07 §2.2 / §2.8: Vexa on EB2 on the dais, before her chair and behind the long table; in phase 2 she steps down.
  'cel-t-tap-room': [{ role: 'boss', phases: [1], at: [0, DAIS_TOP, -6.75], yaw: 0, monster: 'captain-vexa-marrow' }],
  // Naesa on EB2 at the Tide Altar, on its upper step (vlt_altar_tide: two 0.3 m steps); in phase 2 she walks into the water.
  'vlt-t-drowned-chapel': [{ role: 'boss', phases: [1], at: [0, 0.6, -4.92], yaw: 0, monster: 'sister-naesa' }],
  // The King on his throne (EB2, raised 2 m) until phase 2, then EF2; the kit's empty seat goes while his own is drawn.
  'vlt-t-throne': [{ role: 'boss', phases: [1], at: [0, 2.0, -5.0], yaw: 0, monster: 'hollow-king', skipParts: { vlt_throne_hollow: ['seat'] } }],
  // The Crypts' chapel: an elite on the altar step (EB2, raised 0.6 m), before the candle ring.
  'cry-t-chapel': [{ role: 'elite', at: [0, 0.6, -3.0], yaw: 0 }],
}

/** A template-space mark in the room (turned with it). */
export function markAt(at: readonly [number, number, number], yawDeg: number, rotation: number): Mark {
  const p = rotatePoint(at[0], at[2], rotation)
  return { x: p.x, y: at[1], z: p.z, yaw: propYaw(yawDeg, rotation) }
}

/**
 * The room viewer's boss on his arena's phase-1 mark when it shows him (or, dressed for an Elite fight, its first
 * monster on the elite's mark): who, where, and the kit parts left out meanwhile.
 */
export function viewMark(templateId: string, monsters: readonly string[], kind: string | null = null): { monster: string; at: [number, number, number]; skipParts: Readonly<Record<string, readonly string[]>> } | null {
  const specs = ARENA_MARKS[templateId] ?? []
  const s = specs.find((m) => m.role === 'boss' && m.monster && monsters.includes(m.monster) && (!m.phases || m.phases.includes(1)))
  if (s?.monster) return { monster: s.monster, at: [s.at[0], s.at[1], s.at[2]], skipParts: s.skipParts ?? {} }
  const elite = kind === 'elite' && monsters[0] ? specs.find((m) => m.role === 'elite') : undefined
  return elite && monsters[0] ? { monster: monsters[0], at: [elite.at[0], elite.at[1], elite.at[2]], skipParts: {} } : null
}

/** The actors the arena stands on its marks now (the boss in the phases that hold him; the room's elite), by actor id. */
export function arenaPins(templateId: string, rotation: number, fight: Pick<FightState, 'actors' | 'arena'> | null): Map<string, Mark> {
  const out = new Map<string, Mark>()
  const specs = ARENA_MARKS[templateId]
  if (!specs || !fight) return out
  const arena = fight.arena ?? null
  for (const s of specs) {
    let actor: Actor | undefined
    if (s.role === 'boss') {
      if (!arena || (s.phases && !s.phases.includes(arena.phase))) continue
      actor = fight.actors.find((a) => a.id === arena.bossActorId)
    } else actor = fight.actors.find((a) => a.side === 'enemy' && a.kind === 'monster' && a.monster?.champion != null)
    if (!actor || actor.fled || out.has(actor.id)) continue
    out.set(actor.id, markAt(s.at, s.yaw, rotation))
  }
  return out
}

/* ---------- the candle ring ---------- */

/**
 * The ring's candles in the order they go out: counter-clockwise seen from above (east → north → west on the floor
 * plan), starting from the one farthest from the camera.
 */
export function candleOrder(points: readonly { x: number; z: number }[], centre: { x: number; z: number }, camDir: { x: number; z: number }): number[] {
  // The floor plan's angle grows counter-clockwise from +x toward −z (north); the far side is −camDir.
  const start = Math.atan2(camDir.z, -camDir.x)
  const turn = (p: { x: number; z: number }) => {
    let a = Math.atan2(-(p.z - centre.z), p.x - centre.x) - start
    a %= Math.PI * 2
    if (a < -1e-6) a += Math.PI * 2
    return a
  }
  return points
    .map((p, i) => ({ i, a: turn(p) }))
    .sort((a, b) => a.a - b.a || a.i - b.i)
    .map((e) => e.i)
}

/** How many of a ring of `count` drawn candles are out when the sim says `lit` of `of`. */
export function candlesOut(count: number, lit: number, of: number): number {
  if (count <= 0 || of <= 0) return 0
  const left = Math.round((Math.max(0, Math.min(of, lit)) * count) / of)
  return Math.max(0, Math.min(count, count - left))
}

/* ---------- the tide ---------- */

/** The template's knee-deep water stands this high (vault.json `water.knee`). */
export const KNEE_WATER_M = 0.45
/** The tide's top: the throne's fourth 0.25 m step (06 §3.4 "the water reaches the fourth step"); the chapel's step 4 too. */
export const TIDE_TOP_M = 1.0
/** How far the water's edge fades out (the kit's soft shore is 1 m). */
const SHORE_FADE_M = 1.0
/** The knee-deep water's opacity (vault.json `water.kneeOpacity`), and how much more the tide's top step has. */
const WATER_OPACITY = 0.62
const DEEP_OPACITY = 0.16
/**
 * The boss lamp's strength (a brazier's is 1) by how dark the boss is: the King's barnacle-black plate takes it all to
 * show his crown and visor, Naesa's pearl-white shroud a third of it (else she burns out).
 */
export function bossLampStrength(body: number | undefined): number {
  if (body === undefined) return 1.1
  const r = ((body >> 16) & 255) / 255
  const g = ((body >> 8) & 255) / 255
  const b = (body & 255) / 255
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return Math.max(0.4, Math.min(1.2, 1.35 - 1.6 * lum))
}

/** The water's height at a tide step (`level` of `max`; a fraction while it eases). */
export function tideHeight(level: number, max: number): number {
  const k = max > 0 ? Math.max(0, Math.min(1, level / max)) : 0
  return KNEE_WATER_M + (TIDE_TOP_M - KNEE_WATER_M) * k
}

/** Where the water's edge runs (template z): from the template's own shore toward the wall behind the party. */
export function tideShore(level: number, max: number, shore0: number, wall: number): number {
  const k = max > 0 ? Math.max(0, Math.min(1, level / max)) : 0
  return shore0 + Math.max(0, wall - shore0) * k
}

/* ---------- the braziers ---------- */

/** The throne's braziers in the arena's order (brazier-1 …): the nearest the camera first, left to right (template space). */
export function brazierOrder(points: readonly { x: number; z: number }[]): number[] {
  return points
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.z - a.p.z || a.p.x - b.p.x)
    .map((e) => e.i)
}

/** Which braziers burn (by the arena's order): those a Torch relit this phase. */
export function braziersLit(props: readonly { kind: string; done: boolean }[]): boolean[] {
  return props.filter((p) => p.kind === 'brazier').map((p) => p.done)
}

/* ---------- the dressing ---------- */

const key3 = (x: number, y: number, z: number) => `${x.toFixed(2)}|${y.toFixed(2)}|${z.toFixed(2)}`
const key2 = (x: number, z: number) => `${x.toFixed(2)}|${z.toFixed(2)}`

/** What the arena remembers of the fight in this room (it stays after the fight ends). */
interface Memory {
  candles: { lit: number; of: number } | null
  tide: { level: number; max: number } | null
  braziers: boolean[] | null
  /** The boss's monster id and phase (the King's throne follows it). */
  boss: { id: string; phase: number } | null
  /** Phase 8: the Vigil's secret doors stand open (the sim's `doorsOpen`: the Warden's phase 2, or the candles). */
  doors: boolean
}

const EMPTY_MEMORY: Memory = { candles: null, tide: null, braziers: null, boss: null, doors: false }

const UP_AXIS = new THREE.Vector3(0, 1, 0)
const sPanelTurn = new THREE.Quaternion()

/** What changed for the room scene: the flames (and lights and motes) to re-send, the marks to re-frame on. */
export interface ArenaChange {
  flames: boolean
  marks: boolean
}

interface Placed {
  meshId: string
  /** Template space. */
  tx: number
  tz: number
  matrix: THREE.Matrix4
}

export class ArenaDressing {
  readonly group = new THREE.Group()
  private readonly content: Content
  private reduceMotion: boolean
  private room: StaticRoom | null = null
  private templateId = ''
  private rotation = 0
  private place = ''
  private memory: Memory = EMPTY_MEMORY
  private memoryKey = ''
  private pinKey = ''
  /** The ring's candle flames (keys) in the order they go out, and their light points (x|z keys). */
  private candles: { flame: string; light: string }[] = []
  /** The braziers' flames in the arena's order. */
  private braziers: { flame: string; light: string; at: FlamePoint }[] = []
  /** The template's own floor water (hidden while the tide's sheet stands in for it). */
  private kitWater: THREE.Object3D[] = []
  private water: { mesh: THREE.Mesh; geometry: THREE.BufferGeometry; north: number; shore0: number; wall: number } | null = null
  private tideShown = 0
  /** Phase 8: the room's swinging door panels and how far open they stand (0 shut, 1 open). */
  private panels: DoorPanel[] = []
  private doorShown = 0
  private seat: THREE.Object3D | null = null
  private extra: KitBuild | null = null
  private throne: { model: PropModel | null } | null = null
  private disposed = false

  constructor(content: Content, opts: { reduceMotion: boolean }) {
    this.content = content
    this.reduceMotion = opts.reduceMotion
    this.group.name = 'arena'
  }

  setReduceMotion(on: boolean): void {
    this.reduceMotion = on
    if (on) {
      this.applyTide(this.tideTarget())
      this.applyDoors(this.doorTarget())
    }
  }

  /**
   * A room was built: find its arena pieces (the candle ring, the braziers, the floor water, the throne's seat) and add
   * the furniture the template lacks. `place` names where the party is: the same place keeps what the arena remembers.
   */
  setRoom(room: StaticRoom, info: { templateId: string; template: TemplateLike | null; rotation: number; place: string }): void {
    this.clear(room)
    if (info.place !== this.place) {
      this.memory = EMPTY_MEMORY
      this.memoryKey = ''
    }
    this.room = room
    this.templateId = info.templateId
    this.rotation = info.rotation
    this.place = info.place
    this.pinKey = ''
    const placed: Placed[] = (info.template?.props ?? []).map((p) => {
      const at = rotatePoint(p.position[0] ?? 0, p.position[2] ?? 0, info.rotation)
      const y = p.position[1] ?? 0
      return { meshId: p.meshId, tx: p.position[0] ?? 0, tz: p.position[2] ?? 0, matrix: trs(at.x, y, at.z, propYaw(p.rotationY, info.rotation)) }
    })
    const env = room.env
    // The Warden's ring: its candles' flames, in the order they go out.
    const ring = placed.find((p) => p.meshId === 'cry_candle_ring')
    const ringPiece = ring && env ? env.set.piece('cry_candle_ring') : null
    if (ring && ringPiece && this.templateId === 'cry-t-wardens-vigil') {
      const pts = ringPiece.lights.map((l) => l.position.clone().applyMatrix4(ring.matrix))
      const centre = new THREE.Vector3().setFromMatrixPosition(ring.matrix)
      this.candles = candleOrder(pts, centre, room.camDir).map((i) => ({ flame: key3(pts[i]!.x, pts[i]!.y, pts[i]!.z), light: key2(pts[i]!.x, pts[i]!.z) }))
      // The fight keeps off the ring (and the bier inside it), so the candles going out are seen.
      const reach = Math.max(...pts.map((p) => Math.hypot(p.x - centre.x, p.z - centre.z)))
      room.obstacles.push({ x: centre.x, z: centre.z, r: reach + 0.35 })
    }
    // The throne's braziers, in the arena's order.
    const braziers = placed.filter((p) => p.meshId === 'vlt_brazier')
    const brazierPiece = braziers.length && env ? env.set.piece('vlt_brazier') : null
    if (brazierPiece?.lights[0]) {
      const flames = braziers.map((b) => brazierPiece.lights[0]!.position.clone().applyMatrix4(b.matrix))
      const size = room.flames.find((f) => key3(f.x, f.y, f.z) === key3(flames[0]!.x, flames[0]!.y, flames[0]!.z))?.size ?? 0.85
      this.braziers = brazierOrder(braziers.map((b) => ({ x: b.tx, z: b.tz }))).map((i) => {
        const f = flames[i]!
        return { flame: key3(f.x, f.y, f.z), light: key2(f.x, f.z), at: { x: f.x, y: f.y, z: f.z, color: 0xffb060, size } }
      })
    }
    // The floor's knee-deep water, and where its shore runs (template z).
    this.kitWater = []
    room.kit?.group.traverse((o) => {
      if (/^vlt_floor_water_(knee|edge)~water$/.test(o.name)) this.kitWater.push(o)
    })
    const waterTiles = placed.filter((p) => /^vlt_floor_water_(knee|edge)$/.test(p.meshId))
    if (this.kitWater.length && waterTiles.length && env?.materials.water) {
      const odd = Math.abs(Math.round(info.rotation / 90)) % 2 === 1
      const halfW = (odd ? room.frame.depth : room.frame.width) / 2
      const halfD = (odd ? room.frame.width : room.frame.depth) / 2
      const shore0 = Math.max(...waterTiles.map((t) => t.tz + 1))
      this.water = this.buildWater(env.materials.water, halfW, -halfD, shore0, halfD)
    }
    this.seat = room.kit?.group.getObjectByName('vlt_throne_hollow.seat') ?? null
    this.panels = room.doorPanels ?? []
    // The tap room's dais and the Captain's chair (07 §2.2), while the template does not place them itself.
    if (this.templateId === 'cel-t-tap-room' && env && !placed.some((p) => p.meshId === 'cel_dais')) {
      const kb = new KitRoomBuilder(env.set, env.materials)
      const yaw = propYaw(0, info.rotation)
      const d = rotatePoint(DAIS.at[0], DAIS.at[2], info.rotation)
      const c = rotatePoint(DAIS.chair[0], DAIS.chair[2], info.rotation)
      const dais = kb.add('cel_dais', trs(d.x, 0, d.z, yaw))
      kb.add('cel_chair_captain', trs(c.x, DAIS.chair[1], c.z, yaw))
      if (dais) {
        this.extra = kb.build()
        this.group.add(this.extra.group)
        // The party and the dressing keep off it: three circles along its 4 m front.
        const across = rotatePoint(1, 0, info.rotation)
        for (const o of [-1.3, 0, 1.3]) room.obstacles.push({ x: d.x + across.x * o, z: d.z + across.z * o, r: 1.2 })
        room.taken.push({ x: d.x, z: d.z })
      }
    }
    this.apply(true)
  }

  /** Follows the fight's arena (null outside a fight: the room keeps what it last showed). */
  sync(fight: FightState | null): ArenaChange {
    const arena = fight?.arena ?? null
    if (arena) {
      const boss = fight!.actors.find((a) => a.id === arena.bossActorId)
      this.memory = {
        candles: arena.candles ? { ...arena.candles } : null,
        tide: arena.tide ? { level: arena.tide.level, max: arena.tide.max } : null,
        braziers: arena.props.some((p) => p.kind === 'brazier') ? braziersLit(arena.props) : null,
        boss: { id: arena.bossId, phase: (boss?.monster?.phaseIndex ?? arena.phase - 1) + 1 },
        doors: arena.doorsOpen === true,
      }
    }
    const memoryKey = JSON.stringify(this.memory)
    const flames = memoryKey !== this.memoryKey
    this.memoryKey = memoryKey
    const pins = this.room ? arenaPins(this.templateId, this.rotation, fight) : new Map<string, Mark>()
    const pinKey = JSON.stringify([...pins.entries()])
    const marks = pinKey !== this.pinKey
    this.pinKey = pinKey
    if (flames) this.apply(false)
    // Every time: the monster table the throne needs may have landed since.
    else this.syncThrone()
    return { flames, marks }
  }

  /** The actors the arena holds on its marks (room.ts lays the rest of the fight out without them). */
  pins(fight: FightState | null): Map<string, Mark> {
    return this.room ? arenaPins(this.templateId, this.rotation, fight) : new Map()
  }

  /** The room's flames as the arena shows them: the candles out gone, the smouldering braziers embers. */
  flames(all: readonly FlamePoint[]): FlamePoint[] {
    const out = this.outCandles()
    const smoulder = this.smouldering()
    if (out.size === 0 && smoulder.size === 0) return [...all]
    const res: FlamePoint[] = []
    for (const f of all) {
      const k = key3(f.x, f.y, f.z)
      if (out.has(k)) continue
      if (smoulder.has(k)) res.push({ x: f.x, y: f.y - 0.1, z: f.z, color: 0xd0461a, size: Math.max(0.16, f.size * 0.26) })
      else res.push(f)
    }
    return res
  }

  /** The room's fires for the point lights: the candles out give none, a smouldering brazier a third of its light. */
  lights(all: readonly LightPoint[]): LightPoint[] {
    const out = new Set(this.outCandleLights())
    const smoulder = new Set(this.braziers.filter((_, i) => this.memory.braziers?.[i] === false).map((b) => b.light))
    if (out.size === 0 && smoulder.size === 0) return [...all]
    const res: LightPoint[] = []
    for (const l of all) {
      const k = key2(l.x, l.z)
      if (out.has(k)) continue
      res.push(smoulder.has(k) ? { ...l, color: 0xff6a2a, strength: l.strength * 0.33 } : l)
    }
    return res
  }

  /** Smoke from the smouldering braziers (added to the room's own `fx_*` points). */
  motes(): MotePoint[] {
    return this.braziers.filter((_, i) => this.memory.braziers?.[i] === false).map((b) => ({ x: b.at.x, y: b.at.y + 0.05, z: b.at.z, kind: 'smoke' }))
  }

  /**
   * A lamp on a boss (one of the room's two point lights in a boss fight, 10 §4): in front of him toward the camera and
   * above his head, so his face and crown read at the phone's size even as the Keep's light fails.
   */
  bossLamp(boss: { x: number; y: number; z: number; height: number; body?: number } | null): LightPoint | null {
    const room = this.room
    if (!room || !boss) return null
    const out = 1.2 + boss.height * 0.2
    return { x: boss.x + room.camDir.x * out, y: boss.y + boss.height * 0.8 + 0.2, z: boss.z + room.camDir.z * out, color: 0xffe6cc, strength: bossLampStrength(boss.body) }
  }

  /** Eases the tide (an animation frame; never called with Reduce motion). */
  frame(dt: number): void {
    // The Vigil's secret doors grind open over a second.
    const doors = this.doorTarget()
    if (this.panels.length && Math.abs(doors - this.doorShown) > 0.002) this.applyDoors(Math.abs(doors - this.doorShown) < 0.01 ? doors : this.doorShown + (doors - this.doorShown) * (1 - Math.exp(-dt / 300)))
    const target = this.tideTarget()
    if (Math.abs(target - this.tideShown) < 0.002) {
      if (this.tideShown !== target) this.applyTide(target)
      return
    }
    this.applyTide(this.tideShown + (target - this.tideShown) * (1 - Math.exp(-dt / 650)))
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.clear()
    this.room = null
    this.group.removeFromParent()
  }

  /* ---------- inside ---------- */

  private outCandles(): Set<string> {
    const c = this.memory.candles
    if (!c || this.candles.length === 0) return new Set()
    return new Set(this.candles.slice(0, candlesOut(this.candles.length, c.lit, c.of)).map((x) => x.flame))
  }

  private outCandleLights(): string[] {
    const c = this.memory.candles
    if (!c || this.candles.length === 0) return []
    return this.candles.slice(0, candlesOut(this.candles.length, c.lit, c.of)).map((x) => x.light)
  }

  private smouldering(): Set<string> {
    const lit = this.memory.braziers
    if (!lit) return new Set()
    return new Set(this.braziers.filter((_, i) => lit[i] === false).map((b) => b.flame))
  }

  /** The tide step to show (0 without water in the fight). */
  private tideTarget(): number {
    const t = this.memory.tide
    return t && t.max > 0 ? Math.max(0, Math.min(t.max, t.level)) / t.max : 0
  }

  /** Shows what the arena remembers: the seat, the tide, the King's risen throne. */
  private apply(instant: boolean): void {
    const boss = this.memory.boss
    // The empty iron seat goes while the King's own throne is drawn (under him, or risen on the dais).
    if (this.seat) this.seat.visible = !(boss && this.templateId === 'vlt-t-throne')
    if (instant || this.reduceMotion) {
      this.applyTide(this.tideTarget())
      this.applyDoors(this.doorTarget())
    }
    this.syncThrone()
  }

  private doorTarget(): number {
    return this.memory.doors ? 1 : 0
  }

  /** The secret doors' panels turned about their jambs, `k` of the way open. */
  private applyDoors(k: number): void {
    this.doorShown = k
    for (const p of this.panels) p.object.quaternion.copy(p.rest).multiply(sPanelTurn.setFromAxisAngle(UP_AXIS, p.open * k))
  }

  /** The water sheet at a tide step (a fraction of the way to the top): hidden at 0, where the template's own shows. */
  private applyTide(k: number): void {
    this.tideShown = k
    const w = this.water
    if (!w) return
    const on = k > 0.004
    w.mesh.visible = on
    for (const o of this.kitWater) o.visible = !on
    if (!on) return
    w.mesh.position.y = tideHeight(k, 1)
    const shore = tideShore(k, 1, w.shore0, w.wall)
    const pos = w.geometry.getAttribute('position') as THREE.BufferAttribute
    const fadeAt = Math.max(w.north, shore - SHORE_FADE_M)
    for (const i of [2, 3]) pos.setZ(i, fadeAt)
    for (const i of [4, 5]) pos.setZ(i, shore)
    pos.needsUpdate = true
    // Deeper water hides more of what stands in it.
    const alpha = w.geometry.getAttribute(ENV_ALPHA) as THREE.BufferAttribute
    for (let i = 0; i < 4; i++) alpha.setX(i, WATER_OPACITY + DEEP_OPACITY * k)
    alpha.needsUpdate = true
    w.geometry.computeBoundingSphere()
  }

  /** One sheet of water over the room (template space, turned with it): opaque to its fade, clear at its shore. */
  private buildWater(material: THREE.Material, halfW: number, north: number, shore0: number, wall: number): ArenaDressing['water'] {
    const g = new THREE.BufferGeometry()
    const rows = [north, shore0 - SHORE_FADE_M, shore0]
    const pos: number[] = []
    const alpha: number[] = []
    const gv: number[] = []
    rows.forEach((z, r) => {
      for (const x of [-halfW, halfW]) {
        pos.push(x, 0, z)
        alpha.push(r < 2 ? WATER_OPACITY : 0)
        gv.push(15, 0.5, 1)
      }
    })
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3))
    g.setAttribute(ENV_ATTRIBUTE, new THREE.Float32BufferAttribute(gv, 3))
    g.setAttribute(ENV_ALPHA, new THREE.Float32BufferAttribute(alpha, 1))
    // Facing up: (x, z) rows run north → south.
    g.setIndex([0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5])
    g.computeBoundingSphere()
    const mesh = new THREE.Mesh(g, material)
    mesh.name = 'arena-tide'
    mesh.rotation.y = propYaw(0, this.rotation)
    mesh.renderOrder = 3
    mesh.visible = false
    this.group.add(mesh)
    return { mesh, geometry: g, north, shore0, wall }
  }

  /** The Hollow King's throne risen on its column on the dais (phase 2 on), while he fights below without it. */
  private syncThrone(): void {
    const boss = this.memory.boss
    const want = this.templateId === 'vlt-t-throne' && boss !== null && boss.phase >= 2 ? boss : null
    // Risen once, it stands for the rest of the fight (phase 3 changes only his speed).
    if (this.throne && !want) {
      this.throne.model?.dispose()
      this.throne = null
    }
    if (!want || this.throne) return
    const manifest = monsterLibrary.peekManifest()
    const def = this.content.monsters.get(want.id)
    const v = manifest ? resolveMonsterVariant(want.id, manifest, def?.visual, (b) => monsterLibrary.available(b), want.phase) : null
    const spec = ARENA_MARKS[this.templateId]?.find((s) => s.role === 'boss')
    if (!v?.throne?.raised || !spec) return
    const slot: { model: PropModel | null } = { model: null }
    this.throne = slot
    const mark = markAt(spec.at, spec.yaw, this.rotation)
    void monsterLibrary.buildProps(v).then((model) => {
      if (!model) return
      if (this.disposed || this.throne !== slot) {
        model.dispose()
        return
      }
      model.root.position.set(mark.x, mark.y ?? 0, mark.z)
      model.root.rotation.y = mark.yaw
      slot.model = model
      this.group.add(model.root)
    })
  }

  /** Lets go of this room's dressing (the room it belonged to is gone or being rebuilt as `next`). */
  private clear(next: StaticRoom | null = null): void {
    if (this.extra) {
      const keep = next?.kit?.geometries
      this.extra.dispose()
      // The kit's pieces are cached; their GPU copies go unless the next room draws them too.
      for (const g of this.extra.geometries) if (!keep?.has(g)) g.dispose()
      this.extra = null
    }
    if (this.water) {
      this.water.geometry.dispose()
      this.water.mesh.removeFromParent()
      this.water = null
    }
    this.throne?.model?.dispose()
    this.throne = null
    this.candles = []
    this.braziers = []
    this.kitWater = []
    this.seat = null
    this.tideShown = 0
    this.panels = []
    this.doorShown = 0
    this.group.clear()
  }
}
