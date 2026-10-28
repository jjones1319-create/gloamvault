import { signal } from '@preact/signals'
import * as THREE from 'three'
import type { Content } from '../../../sim/src/content.ts'
import type { DelveState, LegalDelveAction } from '../../../sim/src/delve-types.ts'
import type { Actor, FightState } from '../../../sim/src/fight-types.ts'
import type { SceneCue } from './sceneBus.ts'
import type { Stage } from './stage.ts'
import { isMortal } from '../../../sim/src/delve.ts'
import { hpBehind, resumeIndex, shownHp } from '../game/fightView.ts'
import { hasModel } from './characters/assets.ts'
import { buildCharacter } from './characters/factory.ts'
import { characterSpec, specKey, starterSpec, type CharacterSpec } from './characters/outfit.ts'
import { kitZoneOf, LIGHT_TINT, ZONE_LOOK, type KitZone } from './env/envData.ts'
import { envLibrary, type EnvSet } from './env/envKit.ts'
import { createEnvMaterial, type EnvMaterial } from './env/envMaterial.ts'
import { resolveMonsterVariant, resolvePetVariant, variantKey, type VisualLike } from './monsters/manifest.ts'
import { monsterLibrary } from './monsters/model.ts'
import { ActorLayer, type ActorInput, type ActorLook, type ActorShape, type ActorState } from './room/actors.ts'
import { buildDynamic, buildStaticRoom, type ChestLid, type DoorState, type DynamicDressing, type DynamicInput, type LightPoint, type RoomEnv, type StaticRoom, type TemplateLike } from './room/dress.ts'
import { fitView, lerpFit, NO_INSETS, type Fit, type Insets } from './room/fit.ts'
import { createKit, PALETTE, type Kit } from './room/kit.ts'
import { approachFor, cameraRight, doorway, fightSideFormation, nudgeFormation, previousRoomId, roomFormation, roomFrame, type Approach, type DoorLike, type FormationActor, type Mark, type RoomLike, type Side } from './room/layout.ts'
import { lightLook, type LightLook } from './room/look.ts'
import { VfxLayer } from './vfx/layer.ts'

/**
 * The delve's 3D room: the current room's template built from its zone's kit (Phase 6; the Phase 4 grey box for
 * whatever the kit lacks), with the party standing inside the door it came through — heroes, pets and monsters as their
 * 3D models, capsules standing in while they load — the fight laid out across the room, the light meter as the room's
 * light and fog, and the fight HUD's cues shown on the actors with their effects. One persistent scene for the whole
 * delve screen: the room is rebuilt only when the party changes rooms (or its kit arrives).
 *
 * Light (10 §4): the hemisphere and TWO point lights — at the two fires nearest the party (a room with fewer lends the
 * party's torch the other); every other flame is a sprite. Fog and the hemisphere's colours follow the zone.
 */

/** Where each actor stands on screen (CSS px): for UI that wants to point at one. */
export const roomAnchors = signal<Record<string, { x: number; y: number; top: number }>>({})

/** What the scene says about the room it shows (the room viewer's caption and the overlay). */
export const roomInfo = signal<{ zone: KitZone; kit: 'kit' | 'mixed' | 'grey'; template: string; triangles: number; drawCalls: number } | null>(null)

const SIZE_M: Readonly<Record<string, number>> = { small: 0.6, medium: 1.0, large: 1.6, huge: 2.4 }
/** How far a formation may slide to stay clear of the furniture (metres along / across its approach). */
const ROOM_STEPS = { along: [0, 0.6, 1.2, -0.4], across: [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4] } as const
const FIGHT_STEPS = { along: [0, 0.5, -0.5, 1, -1], across: [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4] } as const
/**
 * Phase 5 framing: a hero stands about this share of the screen's height — the fight close enough that both sides
 * read on the phone, the room near enough to see who is who (the view never zooms in further than this).
 */
const FIGHT_HERO_SHARE = 0.27
const ROOM_HERO_SHARE = 0.24
/** How much floor around the party the room view keeps in frame (metres). */
const ROOM_CONTEXT_M = 2.6
const SPECIES_RADIUS: Readonly<Record<string, number>> = { dwarf: 0.34, orc: 0.33, draconid: 0.31, human: 0.28, elf: 0.25, halfling: 0.24 }
/** A chest's lid stands open at this angle (radians about its hinge; its front edge up). */
const LID_OPEN = -1.9
/** The room viewer's party, in order (`&heroes=N`). */
const VIEW_PARTY = ['warden', 'mender', 'ranger', 'arcanist']
/**
 * Boss marks the room viewer honours ahead of Phase 7's arenas (the kit passes' notes): the Hollow King on his throne
 * platform, raised 2 m, facing the party; the kit's empty iron seat hidden while his own throne is drawn.
 */
const VIEW_MARKS: Readonly<Record<string, { monster: string; at: [number, number, number]; skipParts: Record<string, string[]> }>> = {
  'vlt-t-throne': { monster: 'hollow-king', at: [0, 2.0, -5.0], skipParts: { vlt_throne_hollow: ['seat'] } },
}

/** Floor points round a centre: the room view keeps this much of the room in frame round the party. */
function ringAround(c: THREE.Vector3, r: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    out.push(new THREE.Vector3(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r))
  }
  return out
}

function hex(s: string | undefined, fallback: number): number {
  if (!s || !/^#[0-9a-f]{6}$/i.test(s)) return fallback
  return Number.parseInt(s.slice(1), 16)
}

/** Very dark palettes vanish in a dim room and very pale ones burn out in the firelight: pull both toward the middle. */
function readable(h: number): number {
  const c = new THREE.Color(h)
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
  if (lum < 0.09) c.lerp(new THREE.Color(0x6a6878), 0.45)
  else if (lum > 0.6) c.multiplyScalar(0.6 / lum)
  return c.getHex()
}

function shapeOf(baseMesh: string | undefined): ActorShape {
  const m = (baseMesh ?? '').toLowerCase()
  if (/spider/.test(m)) return 'spider'
  if (/rat/.test(m)) return 'rat'
  if (/hound|dog|wolf|cat|beast|lizard|drake/.test(m)) return 'hound'
  return 'biped'
}

/** A template as the room viewer shows it (a content template or a `.later` one). */
export interface ViewTemplate extends TemplateLike {
  readonly id: string
  readonly zoneId: string
  readonly footprint: { readonly w: number; readonly h: number }
  readonly doors: readonly { readonly side: string; readonly offset: number }[]
  readonly kinds: readonly string[]
}

export interface ViewOptions {
  monsters: readonly string[]
  heroes: number
  light: number
  kind: string | null
}

interface RoomBuildInput {
  room: RoomLike
  kind: string
  template: TemplateLike | null
  templateId: string
  zone: KitZone
  openDoors: ReturnType<typeof doorway>[]
  isEntry: boolean
  variation: number
  skipParts?: Readonly<Record<string, readonly string[]>>
}

export class RoomScene {
  private readonly kit: Kit
  private readonly layer: ActorLayer
  private readonly vfx: VfxLayer
  private readonly hemi: THREE.HemisphereLight
  /** The two point lights (10 §4): the fires nearest the party, or the party's torch. */
  private readonly lamps: [THREE.PointLight, THREE.PointLight]
  private lampBase: [number, number] = [0, 0]
  private lampTorch: [boolean, boolean] = [false, false]
  private readonly fog: THREE.FogExp2
  private readonly root = new THREE.Group()
  private readonly removeUpdater: () => void
  private readonly resizeObserver: ResizeObserver | null
  private room: StaticRoom | null = null
  private roomKey = ''
  /** Which room the party is in (the room key less its doors and kit): lids and actors follow the place, not its dressing. */
  private placeKey = ''
  private dynamic: DynamicDressing | null = null
  private dynamicKey = ''
  private lidAngles = new Map<string, number>()
  private approach: Approach | null = null
  private mode: 'room' | 'fight' = 'room'
  private insets: Insets = NO_INSETS
  private fit: Fit = { zoom: 1, offsetX: 0, offsetY: 0 }
  private fitFrom: Fit = this.fit
  private fitTo: Fit = this.fit
  private fitT = 1
  private look: LightLook = lightLook(100)
  private lookTarget: LightLook = this.look
  private camDist = 12
  private zone: KitZone = 'cellars'
  /** The zone's materials: solid, see-through by opacity (mist, webs), water. */
  private readonly materials = new Map<KitZone, { opaque: EnvMaterial; translucent: Map<number, EnvMaterial>; water: EnvMaterial }>()
  /** Loads in flight (kits, the monster manifest): the screen's ready flag waits for them. */
  private readonly waits = new Set<Promise<unknown>>()
  private lastSync: (() => void) | null = null
  private viewing = false
  private refitTimer: ReturnType<typeof setTimeout> | null = null
  private veilTimer: ReturnType<typeof setTimeout> | null = null
  private reduceMotion: boolean
  private size = { w: 1, h: 1 }
  private disposed = false
  /** Called after the room was rebuilt (the screen fades the new room in). */
  onRoomBuilt: (() => void) | null = null

  private readonly stage: Stage
  private readonly content: Content

  constructor(stage: Stage, content: Content, opts: { reduceMotion: boolean }) {
    this.stage = stage
    this.content = content
    this.reduceMotion = opts.reduceMotion
    this.kit = createKit()
    const { scene, camera } = stage
    scene.background = new THREE.Color(PALETTE.fog)
    this.fog = new THREE.FogExp2(PALETTE.fog, 0.03)
    scene.fog = this.fog
    // A fixed light rig (no shader recompiles between rooms): the zone's ambient and two point lights.
    this.hemi = new THREE.HemisphereLight(PALETTE.sky, PALETTE.ground, 1)
    this.lamps = [new THREE.PointLight(PALETTE.fireLight, 20, 0, 1.6), new THREE.PointLight(PALETTE.torchLight, 20, 14, 1.5)]
    this.vfx = new VfxLayer()
    this.vfx.setReduceMotion(this.reduceMotion)
    scene.add(this.hemi, ...this.lamps, this.root, this.vfx.mesh)
    this.layer = new ActorLayer(this.kit, camera, this.vfx)
    this.layer.setReduceMotion(this.reduceMotion)
    this.layer.onChange = () => this.publishAnchors()
    // A tall monster's model (a Charnel Hulk) arriving after the framing: re-frame once the arrivals settle.
    this.layer.onModel = () => {
      if (this.refitTimer !== null) clearTimeout(this.refitTimer)
      this.refitTimer = setTimeout(() => {
        this.refitTimer = null
        if (!this.disposed && this.room) this.refit(false)
      }, 160)
    }
    scene.add(this.layer.group)
    this.removeUpdater = stage.addUpdater((t, dt) => this.frame(t, dt))
    const host = stage.renderer.domElement.parentElement ?? stage.renderer.domElement
    this.measure()
    this.resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            this.measure()
            this.refit(true)
          })
        : null
    this.resizeObserver?.observe(host)
    stage.own(() => this.dispose())
    // The monsters' variant table: asked for at once, the actors re-dressed when it lands.
    if (monsterLibrary.any() && !monsterLibrary.peekManifest()) this.track(monsterLibrary.manifest().then(() => this.resync()))
  }

  private track(p: Promise<unknown>): void {
    const q = p.catch(() => undefined).finally(() => this.waits.delete(q))
    this.waits.add(q)
  }

  private resync(): void {
    if (!this.disposed) this.lastSync?.()
  }

  private measure(): void {
    const el = this.stage.renderer.domElement.parentElement ?? this.stage.renderer.domElement
    this.size = { w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) }
  }

  setReduceMotion(on: boolean): void {
    this.reduceMotion = on
    this.layer.setReduceMotion(on)
    this.vfx.setReduceMotion(on)
    if (on) {
      this.look = this.lookTarget
      this.applyLook()
      this.fitT = 1
      this.fit = this.fitTo
      this.applyFit(this.fit)
      this.settleLids()
    }
  }

  setInsets(insets: Insets): void {
    const same = insets.top === this.insets.top && insets.right === this.insets.right && insets.bottom === this.insets.bottom && insets.left === this.insets.left
    this.insets = { ...insets }
    if (!same && this.room) this.refit(false)
  }

  /* ---------- kits ---------- */

  /** The zone's kit and material if it has loaded; else null (the grey box), and the load is started. */
  private envFor(zone: KitZone): RoomEnv | null {
    const set = envLibrary.peek(zone)
    if (set === undefined) {
      if (envLibrary.available(zone)) this.track(envLibrary.load(zone).then(() => this.resync()))
      return null
    }
    if (!set) return null
    const m = this.materialsFor(zone, set)
    const translucent = (opacity: number): THREE.Material => {
      const k = Math.round(opacity * 100) / 100
      let t = m.translucent.get(k)
      if (!t) {
        t = createEnvMaterial(set.info.palette, { translucent: true })
        t.material.opacity = k
        m.translucent.set(k, t)
      }
      return t.material
    }
    return { set, materials: { solid: m.opaque.material, translucent, water: m.water.material } }
  }

  private materialsFor(zone: KitZone, set: EnvSet): { opaque: EnvMaterial; translucent: Map<number, EnvMaterial>; water: EnvMaterial } {
    let m = this.materials.get(zone)
    if (!m) {
      m = { opaque: createEnvMaterial(set.info.palette), translucent: new Map(), water: createEnvMaterial(set.info.palette, { water: true }) }
      this.materials.set(zone, m)
    }
    // Another zone's materials are let go (the Phase 6 rule: a room's materials leave with it).
    for (const [z, other] of this.materials) {
      if (z === zone) continue
      this.disposeMaterials(other)
      this.materials.delete(z)
    }
    return m
  }

  private disposeMaterials(m: { opaque: EnvMaterial; translucent: Map<number, EnvMaterial>; water: EnvMaterial }): void {
    m.opaque.dispose()
    m.water.dispose()
    for (const t of m.translucent.values()) t.dispose()
  }

  /** Builds a room (and frees the GPU copies of the last one's kit pieces the new one does not use). */
  private buildRoom(input: RoomBuildInput): StaticRoom {
    const env = this.envFor(input.zone)
    // A zone whose kit is still on its way: the room stays dark for a moment (at most 1.5 s) rather than flashing the
    // grey box before the kit replaces it.
    if (this.veilTimer !== null) clearTimeout(this.veilTimer)
    this.veilTimer = null
    const waiting = !env && envLibrary.available(input.zone) && envLibrary.peek(input.zone) === undefined
    this.root.visible = !waiting
    if (waiting)
      this.veilTimer = setTimeout(() => {
        this.veilTimer = null
        this.root.visible = true
      }, 1500)
    const next = buildStaticRoom(this.kit, { room: input.room, kind: input.kind, template: input.template, templateId: input.templateId, openDoors: input.openDoors, isEntry: input.isEntry, variation: input.variation, env, ...(input.skipParts ? { skipParts: input.skipParts } : {}) })
    const old = this.room
    this.dynamic?.dispose()
    if (this.dynamic) this.root.remove(this.dynamic.group)
    this.dynamic = null
    this.dynamicKey = ''
    if (old) {
      this.root.remove(old.group)
      const keep = next.kit?.geometries ?? new Set()
      for (const g of old.kit?.geometries ?? []) if (!keep.has(g)) g.dispose()
      old.dispose()
    }
    this.room = next
    this.root.add(next.group)
    this.zone = input.zone
    this.vfx.clear()
    this.vfx.setFlames(next.flames)
    this.vfx.setMotes(next.motes)
    roomInfo.value = { zone: input.zone, kit: next.kitShare, template: input.templateId, triangles: next.kit?.triangles ?? 0, drawCalls: next.kit?.drawCalls ?? 0 }
    this.placeCamera()
    return next
  }

  /* ---------- the delve ---------- */

  /** Follows the delve: called after every command (and when the fight's finale ends). */
  sync(state: DelveState, legal: readonly LegalDelveAction[], fightOverride: FightState | null = null): void {
    if (this.disposed) return
    this.viewing = false
    this.lastSync = () => this.sync(state, legal, fightOverride)
    const floor = state.floor
    const g = floor.graph.rooms.find((r) => r.id === floor.currentRoomId)
    const rs = floor.rooms[floor.currentRoomId]
    if (!g || !rs) return
    const dungeon = this.content.dungeons.get(state.options.dungeonId)
    const template = dungeon?.templates.find((t) => t.id === g.templateId) ?? null
    const zone = kitZoneOf(template?.zoneId, g.templateId)

    // The static room: rebuilt when the party is somewhere new (or a secret door opened, or the zone's kit arrived).
    const frameProbe = { doorways: g.doors.map((d) => doorway(roomFrame(g), d)) }
    const known = (d: { secret: boolean; to: string }) => !d.secret || rs.secretRevealed || floor.rooms[d.to]?.visited === true
    const openDoors = frameProbe.doorways.filter(known)
    const kitState = envLibrary.peek(zone) ? 'kit' : 'grey'
    const place = `${floor.graph.hash}:${floor.number}:${g.id}`
    const key = `${place}:${openDoors.map((d) => d.to).join(',')}:${kitState}`
    let rebuilt = false
    if (key !== this.roomKey || !this.room) {
      this.buildRoom({ room: g, kind: g.kind, template, templateId: g.templateId, zone, openDoors, isEntry: g.kind === 'entry', variation: g.variation })
      this.roomKey = key
      rebuilt = true
    }
    // Somewhere new, not the same room re-dressed (its kit arrived, a secret door opened): only then do the actors jump
    // to their marks and take the sim's word at once — mid-fight, the beats still to play carry the bars there.
    const moved = place !== this.placeKey
    this.placeKey = place
    const room = this.room!

    // Who stands where.
    const from = previousRoomId(state.log, floor.number, g.id)
    this.approach = approachFor(room.frame, openDoors, from, room.arrival, room.camDir)
    const fight = state.fight ?? fightOverride
    const wasMode = this.mode
    this.mode = fight ? 'fight' : 'room'
    const inputs = fight ? this.fightInputs(state, fight, room) : this.roomInputs(state, room)
    this.layer.set(inputs, {
      instant: moved,
      stateNow: moved || wasMode !== this.mode || !fight,
      showBars: fight !== null,
      turnId: fight?.pendingActorId ?? null,
    })

    // The dynamic dressing, rebuilt when the room's state says so.
    const moveTo = new Map<string, boolean>()
    for (const a of legal) if (a.command.kind === 'move') moveTo.set(a.command.toRoomId, a.enabled)
    const doors: DoorState[] = frameProbe.doorways.map((d) => ({ doorway: d, shown: known(d), move: state.phase.kind === 'room' ? (moveTo.get(d.to) ?? null) : null }))
    const curio = g.kind === 'curio' && rs.curioId ? { id: rs.curioId, used: rs.curioUsed } : null
    const partySpots = inputs.filter((i) => i.look.side === 'party').map((i) => ({ x: Math.round(i.mark.x * 2) / 2, z: Math.round(i.mark.z * 2) / 2 }))
    this.dress({
      kind: g.kind,
      doors,
      hasKey: floor.hasKey,
      chests: rs.chests.map((c) => ({ size: c.size, locked: c.locked, opened: c.opened })),
      goldPiles: rs.goldPiles,
      traps: rs.traps.map((t) => ({ revealed: t.revealed, disarmed: t.disarmed, triggered: t.triggered, blocksDoorTo: t.blocksDoorTo })),
      curio,
      merchant: g.kind === 'merchant',
      keyHere: g.hasKey && !floor.hasKey,
      partySpots: this.mode === 'room' ? partySpots : [],
      variation: g.variation,
    })

    // Light and fog follow the party's light (03 §4.2).
    this.lookTarget = lightLook(state.light)
    if (rebuilt || this.reduceMotion) this.look = this.lookTarget
    this.placeLights()
    this.applyLook()

    // Re-frame on a new room or when a fight starts or ends; not every turn (a camera that zooms as foes fall is noise).
    if (rebuilt || wasMode !== this.mode) this.refit(rebuilt)
    else this.publishAnchors()
    if (rebuilt) this.onRoomBuilt?.()
  }

  private dress(dyn: DynamicInput): void {
    const room = this.room
    if (!room) return
    const dynKey = JSON.stringify({ ...dyn, doors: dyn.doors.map((d) => [d.doorway.to, d.shown, d.move]) })
    if (dynKey === this.dynamicKey) return
    if (this.dynamic) {
      this.root.remove(this.dynamic.group)
      this.dynamic.dispose()
    }
    this.dynamic = buildDynamic(this.kit, room, dyn)
    this.root.add(this.dynamic.group)
    this.dynamicKey = dynKey
    // Lids start where they were (a chest opened just now swings open; one already open stands open).
    for (const lid of this.dynamic.lids) {
      const k = `${this.placeKey}:${lid.index}`
      const was = this.lidAngles.get(k)
      const angle = was ?? (lid.open ? LID_OPEN : 0)
      this.lidAngles.set(k, angle)
      this.poseLid(lid, this.reduceMotion ? (lid.open ? LID_OPEN : 0) : angle)
    }
    this.vfx.setFlames([...room.flames, ...this.dynamic.flames])
  }

  private poseLid(lid: ChestLid, angle: number): void {
    lid.object.quaternion.copy(lid.restQuaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle))
  }

  private settleLids(): void {
    for (const lid of this.dynamic?.lids ?? []) {
      const angle = lid.open ? LID_OPEN : 0
      this.lidAngles.set(`${this.placeKey}:${lid.index}`, angle)
      this.poseLid(lid, angle)
    }
  }

  /* ---------- the room viewer (#room=<template>) ---------- */

  /**
   * One template from its own camera with its kit (Phase 6, `#room=`): every door open, the chests and gold on their
   * sockets, `monsters` on the enemy marks and `heroes` of the starter party on the party's, as the fight lays them out.
   */
  showTemplate(t: ViewTemplate, opts: ViewOptions): void {
    if (this.disposed) return
    this.viewing = true
    this.lastSync = () => this.showTemplate(t, opts)
    const cells: { x: number; y: number }[] = []
    for (let x = 0; x < t.footprint.w; x++) for (let y = 0; y < t.footprint.h; y++) cells.push({ x, y })
    const doors: DoorLike[] = t.doors.map((d, i) => ({ to: `door-${i}`, side: d.side as Side, offset: d.offset, locked: false, secret: false }))
    const room: RoomLike = { id: t.id, cells, doors, rotation: 0 }
    const frame = roomFrame(room)
    const openDoors = doors.map((d) => doorway(frame, d))
    const zone = kitZoneOf(t.zoneId, t.id)
    // A fight's dressing unless asked otherwise (or the template hosts no fight: a rest room, a stairwell).
    const kind = opts.kind ?? (t.kinds.includes('fight') ? 'fight' : t.kinds[0]) ?? 'fight'
    const kitState = envLibrary.peek(zone) ? 'kit' : 'grey'
    const boss = VIEW_MARKS[t.id]
    const seated = boss && opts.monsters.includes(boss.monster) ? boss : null
    const key = `view:${t.id}:${kind}:${kitState}:${seated ? 'boss' : ''}`
    if (key !== this.roomKey || !this.room) {
      this.buildRoom({ room, kind, template: t, templateId: t.id, zone, openDoors, isEntry: kind === 'entry', variation: 1, ...(seated ? { skipParts: seated.skipParts } : {}) })
      this.roomKey = key
    }
    this.placeKey = `view:${t.id}`
    const built = this.room!
    // The actors: the fight's side-on layout.
    const looks: { look: ActorLook; line: FormationActor['line'] }[] = []
    for (let i = 0; i < Math.min(4, Math.max(0, opts.heroes)); i++) {
      const classId = VIEW_PARTY[i]!
      const spec = starterSpec(this.content, { speciesId: ['human', 'dwarf', 'elf', 'orc'][i]!, classId, look: { frame: i % 2 ? 'slight' : 'broad', skin: 1, face: i % 3, hair: 1 }, tier: 'F' })
      looks.push({ look: this.specLook(spec, `hero-${i}`, 'party'), line: classId === 'warden' || classId === 'blade' ? 'front' : 'back' })
    }
    opts.monsters.slice(0, 8).forEach((id, i) => {
      const def = this.content.monsters.get(id)
      const look = this.monsterLookFor(`${id}-${i + 1}`, id, 'enemy', def?.size ?? 'medium', def?.visual, def?.familyId ?? '', 'monster')
      looks.push({ look, line: def?.rows?.[0] === 'back' ? 'back' : 'front' })
    })
    const formation = looks.map((l) => this.formationOf(l.look, l.line))
    const marks = nudgeFormation(fightSideFormation(built.frame, built.camDir, formation), new Map(formation.map((f) => [f.id, f.girth])), built.obstacles, built.frame, cameraRight(built.camDir), FIGHT_STEPS)
    if (seated) {
      const look = looks.find((l) => l.look.id.startsWith(`${seated.monster}-`))
      if (look) marks.set(look.look.id, { x: seated.at[0], y: seated.at[1], z: seated.at[2], yaw: 0 })
    }
    const inputs: ActorInput[] = looks.map(({ look }) => ({ look, state: { hp: 1, maxHp: 1, down: false, gone: false }, mark: marks.get(look.id) ?? { x: 0, z: 0, yaw: 0 } }))
    this.mode = 'fight'
    this.layer.set(inputs, { instant: true, stateNow: true, showBars: false, turnId: null })
    const sockets = built.sockets
    this.dress({
      kind,
      doors: openDoors.map((d) => ({ doorway: d, shown: true, move: null })),
      hasKey: false,
      chests: [...sockets.chestSmall.map(() => ({ size: 'small', locked: false, opened: false })), ...sockets.chestLarge.map(() => ({ size: 'large', locked: true, opened: false }))],
      goldPiles: sockets.gold.map(() => 60),
      traps: [],
      curio: null,
      merchant: kind === 'merchant',
      keyHere: false,
      partySpots: [],
      variation: 1,
    })
    this.lookTarget = lightLook(opts.light)
    this.look = this.lookTarget
    this.placeLights()
    this.applyLook()
    this.refit(true)
  }

  cue(c: SceneCue): void {
    if (this.disposed) return
    this.layer.cue(c)
  }

  /** Resolves when the room's kit, the monster table and the 3D models asked for so far have arrived (or failed). */
  async actorsReady(): Promise<void> {
    while (this.waits.size > 0) await Promise.all([...this.waits])
    await this.layer.modelsSettled()
  }

  /* ---------- actors ---------- */

  private specLook(spec: CharacterSpec, id: string, side: 'party' | 'enemy'): ActorLook {
    const species = this.content.species.get(spec.speciesId)
    const cls = this.content.classes.get(spec.classId)
    const pal = cls?.visual.palette ?? []
    return {
      id,
      side,
      kind: 'hero',
      height: species?.body.heightM ?? 1.8,
      radius: SPECIES_RADIUS[spec.speciesId] ?? 0.28,
      shape: 'biped',
      body: readable(hex(pal[0], 0x8a8a92)),
      trim: hex(pal[1], 0xb45309),
      face: hex(species?.body.skinTones[spec.look.skin] ?? species?.body.skinTones[0], 0xe8c4a8),
      eyes: 0x1a1414,
      model: { key: specKey(spec), build: () => buildCharacter(this.content, spec) },
    }
  }

  private heroLook(state: DelveState, index: number, id: string, side: 'party' | 'enemy'): ActorLook {
    const h = state.heroes[index]
    const rec = h?.record
    const spec = rec ? characterSpec(this.content, rec) : null
    if (spec) return this.specLook(spec, id, side)
    return { id, side, kind: 'hero', height: 1.8, radius: 0.28, shape: 'biped', body: 0x8a8a92, trim: 0xb45309, face: 0xe8c4a8, eyes: 0x1a1414 }
  }

  /** A monster's or a pet's model, when its base has landed (the manifest's variant, else the content's look). */
  private creatureModel(kind: 'monster' | 'pet', id: string, visual: VisualLike | undefined, phase = 1): ActorLook['model'] {
    if (!monsterLibrary.any()) return undefined
    const manifest = monsterLibrary.peekManifest()
    // The variant table is on its way: the capsule stands until it lands (the scene re-dresses then).
    if (!manifest && hasModel('monsters/manifest.json')) return undefined
    const available = (base: string) => monsterLibrary.available(base)
    const v = kind === 'pet' ? resolvePetVariant(id, manifest, visual, available) : resolveMonsterVariant(id, manifest, visual, available, phase)
    if (!v) return undefined
    return { key: `${kind}:${variantKey(v)}:${v.scale}:${v.palette.join('')}`, build: () => monsterLibrary.build(v) }
  }

  private petLook(state: DelveState, index: number, id: string, side: 'party' | 'enemy'): ActorLook {
    const pet = state.heroes[index]?.record.petInstance
    const def = pet ? this.content.pets.get(pet.petId) : undefined
    const pal = def?.visual.palette ?? []
    const shape = shapeOf(def?.visual.baseMesh)
    const model = def ? this.creatureModel('pet', def.id, def.visual) : undefined
    return {
      id,
      side,
      kind: 'pet',
      height: 0.6,
      radius: 0.2,
      shape: shape === 'biped' ? 'hound' : shape,
      body: readable(hex(pal[0], 0x8a6a4a)),
      trim: hex(pal[1], 0xd9c3a0),
      face: hex(pal[1], 0xd9c3a0),
      eyes: hex(pal[2], 0xffe07a),
      ...(model ? { model } : {}),
    }
  }

  private monsterLookFor(actorId: string, monsterId: string, side: 'party' | 'enemy', size: string, visual: (VisualLike & { readonly palette?: readonly string[] }) | undefined, family: string, kind: 'monster' | 'summon', phase = 1): ActorLook {
    const pal = visual?.palette ?? []
    const shape = shapeOf(visual?.baseMesh)
    const sizeM = SIZE_M[size] ?? 1
    // The prompt's sizes are a beast's height; a humanoid of any size is at least a person (06 §3 scales).
    const height = shape === 'biped' ? Math.max(sizeM, 1.75 * (visual?.scale ?? 1)) : sizeM
    const radius = shape === 'biped' ? Math.max(0.26, Math.min(0.55, height * 0.17)) : height * 0.36
    let fam = 0
    for (let i = 0; i < family.length; i++) fam = (fam * 31 + family.charCodeAt(i)) >>> 0
    const familyColour = new THREE.Color().setHSL((fam % 360) / 360, 0.35, 0.38).getHex()
    // A boss past its first phase wears that phase's look (the Hollow King risen, Naesa ascended, the Warden's blue lantern).
    const model = this.creatureModel('monster', monsterId, visual, phase)
    return {
      id: actorId,
      side,
      kind,
      height,
      radius,
      shape,
      body: readable(hex(pal[0], familyColour)),
      trim: hex(pal[2] ?? pal[1], 0x3a2a1e),
      face: hex(pal[1], 0xf1ece4),
      eyes: hex(pal[2] ?? pal[1], 0xffd040),
      ...(model ? { model } : {}),
    }
  }

  private monsterLook(a: Actor): ActorLook {
    const def = a.monster ? this.content.monsters.get(a.monster.monsterId) : undefined
    return this.monsterLookFor(a.id, a.monster?.monsterId ?? '', a.side, a.monster?.size ?? def?.size ?? 'medium', def?.visual, a.monster?.familyId ?? def?.familyId ?? '', a.kind === 'summon' ? 'summon' : 'monster', (a.monster?.phaseIndex ?? 0) + 1)
  }

  private formationOf(look: ActorLook, line: FormationActor['line'], owner?: string): FormationActor {
    const girth = look.shape === 'biped' ? Math.max(0.6, look.radius * 2) : Math.max(look.radius * 2.4, look.height * 1.2)
    return owner ? { id: look.id, side: look.side, line, girth, owner } : { id: look.id, side: look.side, line, girth }
  }

  private roomInputs(state: DelveState, room: StaticRoom): ActorInput[] {
    const mortal = isMortal(state)
    const looks: { look: ActorLook; line: FormationActor['line']; hp: number; down: boolean; dead?: boolean; owner?: string }[] = []
    state.heroes.forEach((h, i) => {
      const front = ['warden', 'blade', 'shade', 'beast-tamer'].includes(h.record.classId)
      looks.push({ look: this.heroLook(state, i, `hero-${i}`, 'party'), line: front ? 'front' : 'back', hp: h.fallen ? 0 : h.hpPercent, down: h.fallen, dead: mortal && h.fallen })
      if (h.record.petInstance) looks.push({ look: this.petLook(state, i, `pet-${i}`, 'party'), line: 'pet', hp: h.petHpPercent, down: false, owner: `hero-${i}` })
    })
    const formation = looks.map((l) => this.formationOf(l.look, l.line, l.owner))
    const marks = this.clearOfFurniture(roomFormation(room.frame, this.approach!, formation), formation, room, ROOM_STEPS)
    return looks.map((l) => ({ look: l.look, state: { hp: l.hp, maxHp: 100, down: l.down, gone: false, dead: l.dead === true }, mark: marks.get(l.look.id) ?? { x: 0, z: 0, yaw: 0 } }))
  }

  private fightInputs(state: DelveState, fight: FightState, room: StaticRoom): ActorInput[] {
    const entries: { look: ActorLook; line: FormationActor['line']; state: ActorState; shownHp?: number }[] = []
    // The HUD plays the log from its last hero action on: until it has, its meters (and so the bars) show HP from there.
    const behind = hpBehind(fight.log, resumeIndex(fight))
    for (const a of fight.actors) {
      let look: ActorLook
      let line: FormationActor['line'] = a.row
      if (a.kind === 'hero') {
        const index = Number(a.id.split('-')[1] ?? 0)
        look = this.heroLook(state, Number.isFinite(index) ? index : 0, a.id, a.side)
      } else if (a.kind === 'pet') {
        const owner = a.pet?.ownerId ?? a.id.replace('pet-', 'hero-')
        const index = Number(owner.split('-')[1] ?? 0)
        look = this.petLook(state, Number.isFinite(index) ? index : 0, a.id, a.side)
        line = 'pet'
      } else {
        look = this.monsterLook(a)
        if (a.side === 'party') line = 'pet'
      }
      entries.push({ look, line, state: { hp: a.hp, maxHp: a.maxHp, down: a.downed || a.fallen, gone: a.gone || a.fled }, shownHp: shownHp(a, behind) })
    }
    // Heroes who fell before this fight are not in it: the party keeps their bodies behind its lines (D-088).
    const mortal = isMortal(state)
    state.heroes.forEach((h, i) => {
      if (!h.fallen || fight.actors.some((a) => a.id === `hero-${i}`)) return
      entries.push({ look: this.heroLook(state, i, `hero-${i}`, 'party'), line: 'pet', state: { hp: 0, maxHp: 1, down: true, gone: false, dead: mortal, body: true } })
    })
    const formation = entries.map((e) => this.formationOf(e.look, e.line))
    // Phase 5: seen from the side — the party on the camera's left, the enemies on its right (layout.ts).
    const marks = this.clearOfFurniture(fightSideFormation(room.frame, room.camDir, formation), formation, room, FIGHT_STEPS, cameraRight(room.camDir))
    return entries.map(({ look, state: s, shownHp: hp }) => ({
      look,
      state: s,
      mark: marks.get(look.id) ?? ({ x: 0, z: 0, yaw: 0 } satisfies Mark),
      ...(hp !== undefined ? { shownHp: hp } : {}),
    }))
  }

  /** Slides a formation off the tables and crates (the props' footprints), staying in the room. */
  private clearOfFurniture(marks: Map<string, Mark>, formation: readonly FormationActor[], room: StaticRoom, steps: { along: readonly number[]; across: readonly number[] }, axis?: { x: number; z: number }): Map<string, Mark> {
    const girth = new Map(formation.map((f) => [f.id, f.girth]))
    return nudgeFormation(marks, girth, room.obstacles, room.frame, axis ?? { x: this.approach!.nx, z: this.approach!.nz }, steps)
  }

  /* ---------- camera, light ---------- */

  private placeCamera(): void {
    const room = this.room
    if (!room) return
    const cam = this.stage.camera
    const [px, py, pz] = room.camera.position
    const [lx, ly, lz] = room.camera.lookAt
    cam.position.set(px, py, pz)
    cam.fov = room.camera.fov
    cam.near = 0.5
    cam.far = 120
    cam.lookAt(lx, ly, lz)
    cam.updateMatrixWorld(true)
    this.camDist = Math.hypot(px - lx, py - ly, pz - lz)
  }

  /** The two fires nearest the party carry the point lights; a room with fewer lends the party its torch. */
  private placeLights(): void {
    const room = this.room
    if (!room) return
    const party = this.layer.partyCentre() ?? new THREE.Vector3()
    const fires: LightPoint[] = [...room.lights, ...(this.dynamic?.lights ?? [])]
    fires.sort((a, b) => Math.hypot(a.x - party.x, a.z - party.z) - Math.hypot(b.x - party.x, b.z - party.z))
    this.lamps.forEach((lamp, i) => {
      const f = fires[i]
      if (f) {
        // A little out from the wall or pillar it burns on, so the light does not burn a white spot into its own stone.
        const out = Math.hypot(f.x, f.z) > 0.01 ? 0.7 / Math.hypot(f.x, f.z) : 0
        lamp.position.set(f.x - f.x * out, f.y + 0.35, f.z - f.z * out)
        lamp.color.setHex(0xfff2e6).lerp(new THREE.Color(f.color), LIGHT_TINT)
        lamp.distance = 0
        lamp.decay = 1.6
        this.lampBase[i] = f.strength
        this.lampTorch[i] = false
      } else {
        lamp.position.set(party.x * 0.8, 2.6, party.z * 0.8)
        lamp.color.setHex(PALETTE.torchLight)
        lamp.decay = 1.5
        this.lampBase[i] = 1
        this.lampTorch[i] = true
      }
    })
    // The zone's air: fog and ambient colours.
    const z = ZONE_LOOK[this.zone]
    this.fog.color.setHex(z.fog)
    ;(this.stage.scene.background as THREE.Color | null)?.setHex(z.fog)
    this.hemi.color.setHex(z.sky)
    this.hemi.groundColor.setHex(z.ground)
  }

  private applyLook(flicker = 0): void {
    const l = this.look
    this.hemi.intensity = l.hemi
    this.lamps.forEach((lamp, i) => {
      if (this.lampTorch[i]) {
        lamp.intensity = l.torch
        lamp.distance = l.torchRange
      } else lamp.intensity = l.fire * this.lampBase[i]! * (1 + flicker * (i === 0 ? 0.08 : -0.06))
    })
    this.fog.density = (l.fogK * ZONE_LOOK[this.zone].fogScale) / Math.max(4, this.camDist)
  }

  /** Re-frames the view for the current mode (the room, or the fight's actors). */
  private refit(instant: boolean): void {
    const room = this.room
    if (!room) return
    const cam = this.stage.camera
    const { w, h } = this.size
    cam.aspect = w / h
    cam.zoom = 1
    cam.clearViewOffset()
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld(true)
    // The room viewer shows the template's own camera, as its designer set it.
    if (this.viewing) {
      this.fit = this.fitFrom = this.fitTo = { zoom: 1, offsetX: 0, offsetY: 0 }
      this.fitT = 1
      this.applyFit(this.fit)
      this.publishAnchors()
      return
    }
    // Phase 5: frame the actors (the fight; the party with some floor round it in the room), never closer than a hero
    // at about a quarter of the screen's height. With no actors yet, the room.
    const actors = this.layer.points()
    let pts = actors
    if (this.mode === 'room') {
      const party = this.layer.partyCentre()
      pts = party ? [...actors, ...ringAround(party, ROOM_CONTEXT_M)] : [...room.framePoints, ...actors]
    }
    const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }
    const v = new THREE.Vector3()
    for (const p of pts) {
      v.copy(p).project(cam)
      if (v.z > 1) continue
      b.x0 = Math.min(b.x0, v.x)
      b.x1 = Math.max(b.x1, v.x)
      b.y0 = Math.min(b.y0, v.y)
      b.y1 = Math.max(b.y1, v.y)
    }
    const centre = this.layer.actorsCentre()
    const cap = centre ? this.heroZoom(centre, this.mode === 'fight' ? FIGHT_HERO_SHARE : ROOM_HERO_SHARE) : 1.7
    const target = Number.isFinite(b.x0) ? fitView(b, w, h, this.insets, this.mode === 'fight' ? { margin: 0.03, minZoom: 0.45, maxZoom: cap } : { margin: 0.04, minZoom: 0.5, maxZoom: cap }) : { zoom: 1, offsetX: 0, offsetY: 0 }
    if (instant || this.reduceMotion) {
      this.fit = target
      this.fitFrom = target
      this.fitTo = target
      this.fitT = 1
    } else {
      this.fitFrom = { ...this.fit }
      this.fitTo = target
      this.fitT = 0
    }
    this.applyFit(this.fit)
    this.publishAnchors()
  }

  /** The zoom at which a 1.8 m figure standing at `at` is `share` of the screen's height (camera at zoom 1). */
  private heroZoom(at: THREE.Vector3, share: number): number {
    const cam = this.stage.camera
    const a = new THREE.Vector3(at.x, 0, at.z).project(cam)
    const b = new THREE.Vector3(at.x, 1.8, at.z).project(cam)
    const span = Math.abs(b.y - a.y)
    return span > 1e-4 ? Math.max(0.6, Math.min(4, (2 * share) / span)) : 1.7
  }

  private applyFit(f: Fit): void {
    const cam = this.stage.camera
    const { w, h } = this.size
    cam.aspect = w / h
    cam.zoom = f.zoom
    cam.setViewOffset(w, h, f.offsetX, f.offsetY, w, h)
    cam.updateProjectionMatrix()
  }

  private publishAnchors(): void {
    if (this.disposed) return
    const saved = this.fit
    this.applyFit(this.fitTo)
    roomAnchors.value = this.layer.anchors(this.size.w, this.size.h)
    this.applyFit(saved)
  }

  private frame(t: number, dt: number): void {
    this.layer.update(dt, t)
    this.vfx.update(dt)
    // The water's slow shimmer.
    for (const m of this.materials.values()) m.water.setTime(t / 1000)
    // Light eases toward the party's light; the fire flickers.
    const k = 1 - Math.exp(-dt / 400)
    const a = this.look
    const b = this.lookTarget
    this.look = { hemi: a.hemi + (b.hemi - a.hemi) * k, torch: a.torch + (b.torch - a.torch) * k, torchRange: a.torchRange + (b.torchRange - a.torchRange) * k, fogK: a.fogK + (b.fogK - a.fogK) * k, fire: b.fire }
    const flicker = Math.sin(t * 0.011) * 0.6 + Math.sin(t * 0.037 + 1.3) * 0.4
    this.applyLook(flicker)
    this.kit.mat.flame.color.setScalar(0.88 + flicker * 0.12)
    const party = this.layer.partyCentre()
    if (party) {
      for (const [i, lamp] of this.lamps.entries()) {
        if (!this.lampTorch[i]) continue
        lamp.position.x += (party.x * 0.8 - lamp.position.x) * k
        lamp.position.z += (party.z * 0.8 - lamp.position.z) * k
      }
    }
    // Chests open on their hinges.
    for (const lid of this.dynamic?.lids ?? []) {
      const key = `${this.placeKey}:${lid.index}`
      const now = this.lidAngles.get(key) ?? 0
      const target = lid.open ? LID_OPEN : 0
      if (Math.abs(target - now) < 0.002) continue
      const next = now + (target - now) * (1 - Math.exp(-dt / 160))
      this.lidAngles.set(key, next)
      this.poseLid(lid, next)
    }
    if (this.fitT < 1) {
      this.fitT = Math.min(1, this.fitT + dt / 450)
      const e = this.fitT < 0.5 ? 2 * this.fitT * this.fitT : 1 - Math.pow(-2 * this.fitT + 2, 2) / 2
      this.fit = lerpFit(this.fitFrom, this.fitTo, e)
      this.applyFit(this.fit)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.lastSync = null
    if (this.refitTimer !== null) clearTimeout(this.refitTimer)
    if (this.veilTimer !== null) clearTimeout(this.veilTimer)
    this.removeUpdater()
    this.resizeObserver?.disconnect()
    this.dynamic?.dispose()
    for (const g of this.room?.kit?.geometries ?? []) g.dispose()
    this.room?.dispose()
    this.layer.dispose()
    this.vfx.dispose()
    this.kit.dispose()
    for (const m of this.materials.values()) this.disposeMaterials(m)
    this.materials.clear()
    this.root.clear()
    this.stage.scene.fog = null
    roomAnchors.value = {}
    roomInfo.value = null
  }
}
