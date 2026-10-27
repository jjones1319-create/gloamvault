import { signal } from '@preact/signals'
import * as THREE from 'three'
import type { Content } from '../../../sim/src/content.ts'
import type { DelveState, LegalDelveAction } from '../../../sim/src/delve-types.ts'
import type { Actor, FightState } from '../../../sim/src/fight-types.ts'
import type { SceneCue } from './sceneBus.ts'
import type { Stage } from './stage.ts'
import { isMortal } from '../../../sim/src/delve.ts'
import { ActorLayer, type ActorInput, type ActorLook, type ActorShape, type ActorState } from './room/actors.ts'
import { buildDynamic, buildStaticRoom, type DoorState, type DynamicDressing, type StaticRoom } from './room/dress.ts'
import { fitView, lerpFit, NO_INSETS, type Fit, type Insets } from './room/fit.ts'
import { createKit, PALETTE, type Kit } from './room/kit.ts'
import { approachFor, doorway, fightFormation, nudgeFormation, previousRoomId, roomFormation, roomFrame, type Approach, type FormationActor, type Mark } from './room/layout.ts'
import { lightLook, type LightLook } from './room/look.ts'

/**
 * The delve's 3D room (Phase 4, placeholder art): the current room's template as a grey box in the Cellars palette
 * with the party standing inside the door it came through, the fight laid out across the room, the light meter as
 * the room's light and fog, and the fight HUD's cues shown on the actors. One persistent scene for the whole delve
 * screen: the room is rebuilt only when the party changes rooms; materials, textures and lights are kept.
 */

/** Where each actor stands on screen (CSS px): for UI that wants to point at one. */
export const roomAnchors = signal<Record<string, { x: number; y: number; top: number }>>({})

const SIZE_M: Readonly<Record<string, number>> = { small: 0.6, medium: 1.0, large: 1.6, huge: 2.4 }
/** How far a formation may slide to stay clear of the furniture (metres along / across its approach). */
const ROOM_STEPS = { along: [0, 0.6, 1.2, -0.4], across: [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4] } as const
const FIGHT_STEPS = { along: [0, 1, -1, 2, -2], across: [0, 1.5, -1.5, 3, -3, 4.5, -4.5] } as const
const SPECIES_RADIUS: Readonly<Record<string, number>> = { dwarf: 0.34, orc: 0.33, draconid: 0.31, human: 0.28, elf: 0.25, halfling: 0.24 }

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

export class RoomScene {
  private readonly kit: Kit
  private readonly layer: ActorLayer
  private readonly hemi: THREE.HemisphereLight
  private readonly fireLight: THREE.PointLight
  private readonly torchLight: THREE.PointLight
  private readonly fog: THREE.FogExp2
  private readonly root = new THREE.Group()
  private readonly removeUpdater: () => void
  private readonly resizeObserver: ResizeObserver | null
  private room: StaticRoom | null = null
  private roomKey = ''
  private dynamic: DynamicDressing | null = null
  private dynamicKey = ''
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
  private fireBase = 0
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
    // A fixed light rig (no shader recompiles between rooms): the cellar's ambient, the room's fire, the party's torch.
    this.hemi = new THREE.HemisphereLight(PALETTE.sky, PALETTE.ground, 1)
    this.fireLight = new THREE.PointLight(PALETTE.fireLight, 20, 0, 1.6)
    this.torchLight = new THREE.PointLight(PALETTE.torchLight, 20, 14, 1.5)
    scene.add(this.hemi, this.fireLight, this.torchLight, this.root)
    this.layer = new ActorLayer(this.kit, camera)
    this.layer.setReduceMotion(this.reduceMotion)
    this.layer.onChange = () => this.publishAnchors()
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
  }

  private measure(): void {
    const el = this.stage.renderer.domElement.parentElement ?? this.stage.renderer.domElement
    this.size = { w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) }
  }

  setReduceMotion(on: boolean): void {
    this.reduceMotion = on
    this.layer.setReduceMotion(on)
    if (on) {
      this.look = this.lookTarget
      this.applyLook()
      this.fitT = 1
      this.fit = this.fitTo
      this.applyFit(this.fit)
    }
  }

  setInsets(insets: Insets): void {
    const same = insets.top === this.insets.top && insets.right === this.insets.right && insets.bottom === this.insets.bottom && insets.left === this.insets.left
    this.insets = { ...insets }
    if (!same && this.room) this.refit(false)
  }

  /** Follows the delve: called after every command (and when the fight's finale ends). */
  sync(state: DelveState, legal: readonly LegalDelveAction[], fightOverride: FightState | null = null): void {
    if (this.disposed) return
    const floor = state.floor
    const g = floor.graph.rooms.find((r) => r.id === floor.currentRoomId)
    const rs = floor.rooms[floor.currentRoomId]
    if (!g || !rs) return
    const dungeon = this.content.dungeons.get(state.options.dungeonId)
    const template = dungeon?.templates.find((t) => t.id === g.templateId) ?? null

    // The static room: rebuilt when the party is somewhere new (or a secret door opened).
    const frameProbe = { doorways: g.doors.map((d) => doorway(roomFrame(g), d)) }
    const known = (d: { secret: boolean; to: string }) => !d.secret || rs.secretRevealed || floor.rooms[d.to]?.visited === true
    const openDoors = frameProbe.doorways.filter(known)
    const key = `${floor.graph.hash}:${floor.number}:${g.id}:${openDoors.map((d) => d.to).join(',')}`
    let rebuilt = false
    if (key !== this.roomKey || !this.room) {
      this.dynamic?.dispose()
      this.dynamic = null
      this.dynamicKey = ''
      if (this.room) {
        this.root.remove(this.room.group)
        this.room.dispose()
      }
      this.room = buildStaticRoom(this.kit, { room: g, kind: g.kind, template, openDoors, isEntry: g.kind === 'entry', variation: g.variation })
      this.root.add(this.room.group)
      this.roomKey = key
      rebuilt = true
      this.placeCamera()
    }
    const room = this.room

    // Who stands where.
    const from = previousRoomId(state.log, floor.number, g.id)
    this.approach = approachFor(room.frame, openDoors, from, room.arrival, room.camDir)
    const fight = state.fight ?? fightOverride
    const wasMode = this.mode
    this.mode = fight ? 'fight' : 'room'
    const inputs = fight ? this.fightInputs(state, fight, room) : this.roomInputs(state, room)
    this.layer.set(inputs, {
      instant: rebuilt,
      stateNow: rebuilt || wasMode !== this.mode || !fight,
      showBars: fight !== null,
      turnId: fight?.pendingActorId ?? null,
    })

    // The dynamic dressing, rebuilt when the room's state says so.
    const moveTo = new Map<string, boolean>()
    for (const a of legal) if (a.command.kind === 'move') moveTo.set(a.command.toRoomId, a.enabled)
    const doors: DoorState[] = frameProbe.doorways.map((d) => ({ doorway: d, shown: known(d), move: state.phase.kind === 'room' ? (moveTo.get(d.to) ?? null) : null }))
    const curio = g.kind === 'curio' && rs.curioId ? { id: rs.curioId, used: rs.curioUsed } : null
    const partySpots = inputs.filter((i) => i.look.side === 'party').map((i) => ({ x: Math.round(i.mark.x * 2) / 2, z: Math.round(i.mark.z * 2) / 2 }))
    const dyn = {
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
    }
    const dynKey = JSON.stringify({ ...dyn, doors: doors.map((d) => [d.doorway.to, d.shown, d.move]) })
    if (dynKey !== this.dynamicKey) {
      if (this.dynamic) {
        this.root.remove(this.dynamic.group)
        this.dynamic.dispose()
      }
      this.dynamic = buildDynamic(this.kit, room, dyn)
      this.root.add(this.dynamic.group)
      this.dynamicKey = dynKey
    }

    // Light and fog follow the party's light (03 §4.2).
    this.lookTarget = lightLook(state.light)
    if (rebuilt || this.reduceMotion) this.look = this.lookTarget
    this.placeLights(room)
    this.applyLook()

    // Re-frame on a new room or when a fight starts or ends; not every turn (a camera that zooms as foes fall is noise).
    if (rebuilt || wasMode !== this.mode) this.refit(rebuilt)
    else this.publishAnchors()
    if (rebuilt) this.onRoomBuilt?.()
  }

  cue(c: SceneCue): void {
    if (this.disposed) return
    this.layer.cue(c)
  }

  /* ---------- actors ---------- */

  private heroLook(state: DelveState, index: number, id: string, side: 'party' | 'enemy'): ActorLook {
    const h = state.heroes[index]
    const rec = h?.record
    const species = rec ? this.content.species.get(rec.speciesId) : undefined
    const cls = rec ? this.content.classes.get(rec.classId) : undefined
    const pal = cls?.visual.palette ?? []
    const height = species?.body.heightM ?? 1.8
    return {
      id,
      side,
      kind: 'hero',
      height,
      radius: SPECIES_RADIUS[rec?.speciesId ?? ''] ?? 0.28,
      shape: 'biped',
      body: readable(hex(pal[0], 0x8a8a92)),
      trim: hex(pal[1], 0xb45309),
      face: hex(species?.body.skinTones[0], 0xe8c4a8),
      eyes: 0x1a1414,
    }
  }

  private petLook(state: DelveState, index: number, id: string, side: 'party' | 'enemy'): ActorLook {
    const pet = state.heroes[index]?.record.petInstance
    const def = pet ? this.content.pets.get(pet.petId) : undefined
    const pal = def?.visual.palette ?? []
    const shape = shapeOf(def?.visual.baseMesh)
    return {
      id,
      side,
      kind: 'pet',
      height: 0.6,
      radius: shape === 'biped' ? 0.2 : 0.2,
      shape: shape === 'biped' ? 'hound' : shape,
      body: readable(hex(pal[0], 0x8a6a4a)),
      trim: hex(pal[1], 0xd9c3a0),
      face: hex(pal[1], 0xd9c3a0),
      eyes: hex(pal[2], 0xffe07a),
    }
  }

  private monsterLook(a: Actor): ActorLook {
    const def = a.monster ? this.content.monsters.get(a.monster.monsterId) : undefined
    const pal = def?.visual.palette ?? []
    const shape = shapeOf(def?.visual.baseMesh)
    const size = SIZE_M[a.monster?.size ?? def?.size ?? 'medium'] ?? 1
    // The prompt's sizes are a beast's height; a humanoid of any size is at least a person (06 §3 scales).
    const height = shape === 'biped' ? Math.max(size, 1.75 * (def?.visual.scale ?? 1)) : size
    const radius = shape === 'biped' ? Math.max(0.26, Math.min(0.55, height * 0.17)) : height * 0.36
    const family = a.monster?.familyId ?? def?.familyId ?? ''
    let fam = 0
    for (let i = 0; i < family.length; i++) fam = (fam * 31 + family.charCodeAt(i)) >>> 0
    const familyColour = new THREE.Color().setHSL((fam % 360) / 360, 0.35, 0.38).getHex()
    return {
      id: a.id,
      side: a.side,
      kind: a.kind === 'summon' ? 'summon' : 'monster',
      height,
      radius,
      shape,
      body: readable(hex(pal[0], familyColour)),
      trim: hex(pal[2] ?? pal[1], 0x3a2a1e),
      face: hex(pal[1], 0xf1ece4),
      eyes: hex(pal[2] ?? pal[1], 0xffd040),
    }
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
    const entries: { look: ActorLook; line: FormationActor['line']; state: ActorState }[] = []
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
      entries.push({ look, line, state: { hp: a.hp, maxHp: a.maxHp, down: a.downed || a.fallen, gone: a.gone || a.fled } })
    }
    // Heroes who fell before this fight are not in it: the party keeps their bodies behind its lines (D-088).
    const mortal = isMortal(state)
    state.heroes.forEach((h, i) => {
      if (!h.fallen || fight.actors.some((a) => a.id === `hero-${i}`)) return
      entries.push({ look: this.heroLook(state, i, `hero-${i}`, 'party'), line: 'pet', state: { hp: 0, maxHp: 1, down: true, gone: false, dead: mortal, body: true } })
    })
    const formation = entries.map((e) => this.formationOf(e.look, e.line))
    const marks = this.clearOfFurniture(fightFormation(room.frame, this.approach!, formation), formation, room, FIGHT_STEPS)
    return entries.map(({ look, state: s }) => ({
      look,
      state: s,
      mark: marks.get(look.id) ?? ({ x: 0, z: 0, yaw: 0 } satisfies Mark),
    }))
  }

  /** Slides a formation off the tables and crates (the props' footprints), staying in the room. */
  private clearOfFurniture(marks: Map<string, Mark>, formation: readonly FormationActor[], room: StaticRoom, steps: { along: readonly number[]; across: readonly number[] }): Map<string, Mark> {
    const girth = new Map(formation.map((f) => [f.id, f.girth]))
    return nudgeFormation(marks, girth, room.obstacles, room.frame, { x: this.approach!.nx, z: this.approach!.nz }, steps)
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

  private placeLights(room: StaticRoom): void {
    let fire = room.fire?.clone() ?? null
    if (!fire && room.sconces.length) {
      fire = new THREE.Vector3()
      for (const s of room.sconces) fire.add(s)
      fire.divideScalar(room.sconces.length)
      fire.multiplyScalar(0.55)
      fire.y = 2.6
    }
    this.fireBase = room.fire ? 1 : room.sconces.length ? 0.85 : 0.35
    this.fireLight.position.copy(fire ?? new THREE.Vector3(0, 3.2, 0))
    const party = this.layer.partyCentre() ?? new THREE.Vector3()
    this.torchLight.position.set(party.x * 0.8, 2.6, party.z * 0.8)
  }

  private applyLook(flicker = 0): void {
    const l = this.look
    this.hemi.intensity = l.hemi
    this.torchLight.intensity = l.torch
    this.torchLight.distance = l.torchRange
    this.fireLight.intensity = l.fire * this.fireBase * (1 + flicker * 0.08)
    this.fog.density = l.fogK / Math.max(4, this.camDist)
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
    const pts = this.mode === 'fight' ? this.layer.points() : [...room.framePoints, ...this.layer.points()]
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
    const target = Number.isFinite(b.x0) ? fitView(b, w, h, this.insets, this.mode === 'fight' ? { margin: 0.06, minZoom: 0.45, maxZoom: 1.7 } : { margin: 0.03, minZoom: 0.5, maxZoom: 1.25 }) : { zoom: 1, offsetX: 0, offsetY: 0 }
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
      const tp = this.torchLight.position
      tp.x += (party.x * 0.8 - tp.x) * k
      tp.z += (party.z * 0.8 - tp.z) * k
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
    this.removeUpdater()
    this.resizeObserver?.disconnect()
    this.dynamic?.dispose()
    this.room?.dispose()
    this.layer.dispose()
    this.kit.dispose()
    this.root.clear()
    this.stage.scene.fog = null
    roomAnchors.value = {}
  }
}
