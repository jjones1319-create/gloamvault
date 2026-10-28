import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { addHero, newProfile } from '../../../../sim/src/town.ts'
import type { HeroLook } from '../../../../sim/src/types/content.ts'
import type { BodyFrame } from '../../../../sim/src/types/enums.ts'
import { loadContentDir } from '../../../../tools/sim/loadContent.ts'
import { ClipLibrary } from './animator.ts'
import { parseManifest } from './manifest.ts'
import { assembleCharacter, type CharacterModel } from './assembler.ts'
import { characterSpec, EMPTY_OUTFIT, paletteFor, specKey, starterOutfit, starterSpec, type CharacterSpec, type Outfit } from './outfit.ts'
import { SLOT } from './palette.ts'
import { frameTemplate, type FrameTemplate } from './template.ts'

/**
 * The assembler on the real hero files (client/public/models/hero/), parsed in node: one merged mesh on a cloned
 * 65-bone skeleton, the body regions worn gear covers dropped, species bone scales with the soles on the floor,
 * weapons at world size in the fist, the Hips track scaled by leg length. Skipped while the hero files are missing.
 */
const content = loadContentDir(path.resolve('content'))
const MODELS = path.resolve('client/public/models/hero')
const haveModels = existsSync(path.join(MODELS, 'hero_broad.glb')) && existsSync(path.join(MODELS, 'hero_slight.glb'))

function parseGlb(file: string): Promise<GLTF> {
  const buf = readFileSync(file)
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
  return new Promise((resolve, reject) => new GLTFLoader().parse(ab, '', resolve, reject))
}

const templates = new Map<BodyFrame, FrameTemplate>()
const LOOK: HeroLook = { frame: 'broad', skin: 0, face: 0, hair: 0 }

function spec(speciesId: string, frame: BodyFrame, outfit: Outfit = EMPTY_OUTFIT, classId = 'warden'): CharacterSpec {
  return { frame, speciesId, classId, look: { ...LOOK, frame }, outfit, gear: true }
}

function build(s: CharacterSpec, extra: Partial<Parameters<typeof assembleCharacter>[2]> = {}): CharacterModel {
  return assembleCharacter(content, s, { template: templates.get(s.frame)!, gear: new Map(), weapons: null, manifest: null, clips: null, ...extra })
}

/** World positions of the skinned vertices (the CPU path three uses for raycasts). */
function skinned(model: CharacterModel, from = 0, to = model.mesh.geometry.getAttribute('position').count): THREE.Vector3[] {
  model.root.updateMatrixWorld(true)
  const pos = model.mesh.geometry.getAttribute('position')
  const out: THREE.Vector3[] = []
  for (let i = from; i < to; i++) out.push(model.mesh.applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(pos, i)).applyMatrix4(model.mesh.matrixWorld))
  return out
}

function minY(points: THREE.Vector3[]): number {
  return points.reduce((m, p) => Math.min(m, p.y), Infinity)
}

describe.skipIf(!haveModels)('the hero assembler on the real files', () => {
  beforeAll(async () => {
    for (const frame of ['broad', 'slight'] as const) {
      const t = frameTemplate(frame, await parseGlb(path.join(MODELS, `hero_${frame}.glb`)))
      if (t) templates.set(frame, t)
    }
  })

  it('reads each frame: the body, 65 joints, the sockets and their bones', () => {
    for (const frame of ['broad', 'slight'] as const) {
      const t = templates.get(frame)!
      expect(t.boneNames).toHaveLength(65)
      expect(t.boneNames[0]).toBe('Hips')
      expect(t.socketBone.get('Socket_HandR')).toBe('RightHand')
      expect(t.rest.has('Socket_HandL')).toBe(true)
      expect(t.ankleRestY).toBeGreaterThan(0.03)
    }
  })

  it('a bare human is one skinned mesh and its outline on one cloned skeleton: the whole body, its palette slots', () => {
    const m = build(spec('human', 'broad'))
    const tpl = templates.get('broad')!
    expect(m.triangles).toBe((tpl.body.geometry.index?.count ?? 0) / 3)
    expect(m.skeleton.bones).toHaveLength(65)
    expect(m.mesh.geometry).toBe(m.outline.geometry)
    expect(m.mesh.skeleton).toBe(m.outline.skeleton)
    expect(m.skeleton.bones[0]).not.toBe(tpl.hips)
    expect(m.mesh.geometry.morphAttributes.position).toBeUndefined()
    const slots = new Set(m.mesh.geometry.getAttribute('gvSlot').array as Uint8Array)
    expect([...slots].every((s) => [SLOT.skin, SLOT.iris, SLOT.sclera, SLOT.ink].includes(s as 0))).toBe(true)
    let meshes = 0
    m.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes++
    })
    expect(meshes).toBe(2)
    m.dispose()
  })

  it('every species stands with its soles on the floor, on both frames; the Dwarf and Halfling are shorter', () => {
    const heights: Record<string, number> = {}
    for (const frame of ['broad', 'slight'] as const) {
      for (const id of ['human', 'dwarf', 'elf', 'orc', 'halfling', 'draconid']) {
        const m = build(spec(id, frame))
        const pts = skinned(m)
        expect(Math.abs(minY(pts)), `${id} ${frame} sole`).toBeLessThan(0.025)
        if (frame === 'broad') heights[id] = pts.reduce((mx, p) => Math.max(mx, p.y), 0)
        m.dispose()
      }
    }
    expect(heights.dwarf!).toBeLessThan(heights.human! - 0.2)
    expect(heights.halfling!).toBeLessThan(heights.dwarf!)
    expect(heights.orc!).toBeGreaterThan(heights.human!)
  })

  it('gear that covers the chest and belly takes those body triangles away and brings its own', () => {
    const tpl = templates.get('broad')!
    const piece = new THREE.SkinnedMesh(tpl.body.geometry, new THREE.MeshBasicMaterial())
    piece.name = 'gear_warden_chest_F'
    piece.userData.hides = ['chest', 'belly']
    piece.bind(tpl.body.skeleton, new THREE.Matrix4())
    const outfit: Outfit = { ...EMPTY_OUTFIT, pieces: [{ slot: 'chest', setClass: 'warden', fallbacks: [], tier: 'F', grade: 'F', itemId: 'copper-breastplate' }] }
    const m = build(spec('human', 'broad', outfit), { gear: new Map([['warden', new Map([[piece.name, piece as THREE.Mesh]])]]) })
    const col = tpl.body.geometry.getAttribute('color')
    const idx = tpl.body.geometry.index!
    let covered = 0
    for (let t = 0; t < idx.count; t += 3) {
      const r = [0, 1, 2].map((k) => Math.round(col.getY(idx.getX(t + k)) * 15))
      if (r.every((x) => x === 2 || x === 3)) covered++
    }
    expect(covered).toBeGreaterThan(100)
    expect(m.triangles).toBe(2 * (idx.count / 3) - covered)
    // Without the gear toggle the body is whole again.
    const bare = build({ ...spec('human', 'broad', outfit), gear: false }, { gear: new Map([['warden', new Map([[piece.name, piece as THREE.Mesh]])]]) })
    expect(bare.triangles).toBe(idx.count / 3)
    m.dispose()
    bare.dispose()
  })

  it('hair goes under a hood that covers the crown, not under a circlet; a helmet whose mesh is missing hides nothing', () => {
    const manifest = parseManifest(JSON.parse(readFileSync(path.join(MODELS, 'manifest.json'), 'utf8')))
    const tpl = templates.get('broad')!
    const human = manifest.species.get('human')
    const hair = human?.presets[0]?.parts.find((p) => p.startsWith('hair_'))
    if (!hair || !tpl.parts.get(hair)) return
    const hairTris = (tpl.parts.get(hair)!.geometry.index?.count ?? 0) / 3
    // A hood: the body's own surface (its top is the top of the head). A circlet: a small band at the brow.
    const hood = new THREE.SkinnedMesh(tpl.body.geometry, new THREE.MeshBasicMaterial())
    hood.name = 'gear_warden_helmet_F'
    hood.bind(tpl.body.skeleton, new THREE.Matrix4())
    const band = new THREE.BoxGeometry(0.2, 0.02, 0.2).translate(0, 1.62, 0)
    const n = band.getAttribute('position').count
    const head = tpl.boneNames.indexOf('Head')
    band.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 === 0 ? head : 0)), 4))
    band.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4))
    const circlet = new THREE.SkinnedMesh(band, new THREE.MeshBasicMaterial())
    circlet.name = 'gear_warden_helmet_F'
    circlet.bind(tpl.body.skeleton, new THREE.Matrix4())
    const outfit: Outfit = { ...EMPTY_OUTFIT, pieces: [{ slot: 'helmet', setClass: 'warden', fallbacks: [], tier: 'F', grade: 'F', itemId: 'copper-helm' }] }
    const s = spec('human', 'broad', outfit)
    const bare = build({ ...s, gear: false }, { manifest })
    const hooded = build(s, { manifest, gear: new Map([['warden', new Map([[hood.name, hood as THREE.Mesh]])]]) })
    const ringed = build(s, { manifest, gear: new Map([['warden', new Map([[circlet.name, circlet as THREE.Mesh]])]]) })
    const missing = build(s, { manifest })
    const bodyTris = (tpl.body.geometry.index?.count ?? 0) / 3
    expect(hooded.triangles).toBe(bare.triangles - hairTris + bodyTris)
    expect(ringed.triangles).toBe(bare.triangles + 12)
    expect(missing.triangles).toBe(bare.triangles)
    for (const m of [bare, hooded, ringed, missing]) m.dispose()
  })

  it('a weapon sits in the right fist at world size, even in a Halfling’s hand', () => {
    const blade = new THREE.BoxGeometry(0.04, 0.8, 0.02).translate(0, 0.4, 0).toNonIndexed()
    const n = blade.getAttribute('position').count
    blade.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 9 / 15 : i % 4 === 3 ? 1 : 0)), 4))
    const sword = new THREE.Mesh(blade, new THREE.MeshBasicMaterial())
    sword.name = 'wpn_sword_F'
    sword.userData.socket = 'Socket_HandR'
    const outfit: Outfit = { ...EMPTY_OUTFIT, weapons: [{ hand: 'main', kind: 'weapon', weaponType: 'sword', tier: 'F', grade: 'F', itemId: 'copper-shortsword' }] }
    for (const id of ['human', 'halfling', 'orc']) {
      const m = build(spec(id, 'broad', outfit), { weapons: new Map([['wpn_sword_F', sword]]) })
      const total = m.mesh.geometry.getAttribute('position').count
      const pts = skinned(m, total - n, total)
      const ys = pts.map((p) => p.clone())
      let len = 0
      for (const a of ys) for (const b of ys) len = Math.max(len, a.distanceTo(b))
      expect(len, `${id} blade length`).toBeGreaterThan(0.79)
      expect(len, `${id} blade length`).toBeLessThan(0.82)
      const hand = new THREE.Vector3().setFromMatrixPosition(m.bones.get('RightHand')!.matrixWorld)
      expect(Math.min(...pts.map((p) => p.distanceTo(hand))), `${id} grip near the hand`).toBeLessThan(0.15)
      expect([...(m.mesh.geometry.getAttribute('gvSlot').array as Uint8Array).slice(total - n)].every((s) => s === SLOT.metal)).toBe(true)
      m.dispose()
    }
  })

  it('clips play by bone name; the Hips track is scaled by leg length so a Dwarf’s feet stay down', () => {
    const tpl = templates.get('broad')!
    const hips = tpl.hipsRest
    const idle = new THREE.AnimationClip('Idle', 1, [
      new THREE.QuaternionKeyframeTrack('Spine.quaternion', [0, 1], [0, 0, 0, 1, 0.1, 0, 0, 0.995]),
      // A held 10 cm crouch (the same at every time, so the test does not depend on the idle's random phase).
      new THREE.VectorKeyframeTrack('Hips.position', [0, 1], [hips.x, hips.y - 0.1, hips.z, hips.x, hips.y - 0.1, hips.z]),
      new THREE.VectorKeyframeTrack('Spine.scale', [0, 1], [1, 1, 1, 2, 2, 2]),
    ])
    const lib = new ClipLibrary([idle], new Map(), hips.clone(), new Set(tpl.boneNames))
    expect(lib.base.get('Idle')?.tracks.map((t) => t.name)).toEqual(['Spine.quaternion', 'Hips.position'])
    const dwarf = build(spec('dwarf', 'broad'), { clips: lib })
    expect(dwarf.animator.hasClips()).toBe(true)
    const rest = dwarf.bones.get('Hips')!.position.clone()
    expect(rest.y).toBeLessThan(hips.y - 0.05)
    dwarf.animator.update(0.5)
    const after = dwarf.bones.get('Hips')!.position.y
    // The 10 cm crouch scaled by the Dwarf's leg ratio (rest.y / authoring rest.y).
    expect(rest.y - after).toBeCloseTo((0.1 * rest.y) / hips.y, 4)
    expect(rest.y - after).toBeLessThan(0.095)
    expect(dwarf.bones.get('Spine')!.scale.x).toBeCloseTo(1)
    dwarf.dispose()
  })

  it('a hero record builds the same character every time, and the breathing idle moves without clips', () => {
    const hero = addHero(content, newProfile(5), { name: 'Orrin', speciesId: 'dwarf', classId: 'warden' }).hero
    const s = characterSpec(content, hero)
    expect(specKey(characterSpec(content, hero))).toBe(specKey(s))
    expect(s.outfit.pieces.map((p) => p.slot).sort()).toEqual(['boots', 'chest', 'gloves', 'helmet', 'legs'])
    const m = build(s)
    const spine = m.bones.get('Spine')!
    const q0 = spine.quaternion.clone()
    m.update(400)
    expect(spine.quaternion.angleTo(q0)).toBeGreaterThan(0)
    m.dispose()
  })
})

describe('outfits and palettes (Phase 5)', () => {
  it('the Warden’s starter kit: five tier-F pieces, sword in the main hand, buckler in the off hand; tier S trims gold', () => {
    const f = starterOutfit(content, 'warden', 'F')
    expect(f.pieces.map((p) => `${p.slot}:${p.tier}`).sort()).toEqual(['boots:F', 'chest:F', 'gloves:F', 'helmet:F', 'legs:F'])
    expect(f.weapons.map((w) => `${w.hand}:${w.kind}:${w.weaponType}`)).toEqual(['main:weapon:sword', 'off:shield:shieldBuckler'])
    expect(f.trimGrade).toBe('F')
    const s = starterOutfit(content, 'warden', 'S')
    expect(s.pieces.every((p) => p.tier === 'S' && p.grade === 'S')).toBe(true)
    expect(s.trimGrade).toBe('S')
  })

  it('the Blade holds two weapons, the Arcanist a wand and an orb whose fire glows', () => {
    expect(starterOutfit(content, 'blade').weapons.map((w) => `${w.hand}:${w.weaponType}`)).toEqual(['main:sword', 'off:dagger'])
    const arc = starterOutfit(content, 'arcanist')
    expect(arc.weapons.map((w) => `${w.hand}:${w.kind}`)).toEqual(['main:weapon', 'off:focus'])
    expect(arc.element).toBe('fire')
  })

  it('the palette: the species’ skin tone by the look, the class’s cloth, the trim by grade', () => {
    const dwarf = content.species.get('dwarf')!
    const warden = content.classes.get('warden')!
    const sp = starterSpec(content, { speciesId: 'dwarf', classId: 'warden', look: { frame: 'slight', skin: 2, face: 1, hair: 3 }, tier: 'S' })
    const hexes = paletteFor(sp, dwarf, warden, null)
    expect(hexes[SLOT.skin]).toBe(dwarf.body.skinTones[2])
    expect(hexes[SLOT.cloth1]).toBe(warden.visual.palette[0])
    expect(hexes[SLOT.trim]).toBe('#ffd84d')
    expect(sp.frame).toBe('slight')
    // Gear off: the trim falls back to F grey.
    expect(paletteFor({ ...sp, gear: false }, dwarf, warden, null)[SLOT.trim]).toBe('#9b9488')
  })
})
