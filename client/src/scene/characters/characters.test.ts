import { describe, expect, it } from 'vitest'
import { bakeMorphs, boneGroup, compactPart, keepTrack, keepTriangles, localBoneScales, mergeParts, morphWeights, parseRegions, remapJoints, resolveBone, rigidPart, rootScale, scaleHipsTrack, tierForGrade, type PartData } from './geometry.ts'
import { parseClipsJson, parseManifest } from './manifest.ts'
import { bestGrade, GRADE_TRIM, mixHex, paletteHexes, paletteUniform, readableCloth, regionOf, slotOf, SLOT, srgbToLinear, wrapPick } from './palette.ts'

/** A part of `n` vertices on a line, one triangle per three vertices, every vertex in `region`. */
function part(n: number, opts: { region?: number[]; bones?: string[]; slot?: number } = {}): PartData {
  const positions = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) positions[i * 3] = i
  const index = new Uint32Array(Math.floor(n / 3) * 3).map((_, i) => i)
  const weights = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) weights[i * 4] = 1
  return {
    name: 'p',
    positions,
    normals: new Float32Array(n * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)),
    slots: new Uint8Array(n).fill(opts.slot ?? 0),
    regions: new Uint8Array(opts.region ?? new Array(n).fill(0)),
    joints: new Uint16Array(n * 4),
    weights,
    boneNames: opts.bones ?? ['Hips'],
    index,
  }
}

describe('the palette codes (tools/blender/palette.json)', () => {
  it('decodes COLOR_0: slot = round(R × 15), region = round(G × 15), clamped', () => {
    for (let s = 0; s < 16; s++) expect(slotOf(s / 15)).toBe(s)
    expect(slotOf(9 / 15 + 0.02)).toBe(9)
    expect(slotOf(1.4)).toBe(15)
    expect(slotOf(-0.2)).toBe(0)
    expect(slotOf(Number.NaN)).toBe(0)
    expect(regionOf(6 / 15)).toBe(6)
  })

  it('builds 16 colours: skin, hair, class cloth, metal, the trim by grade, lifted near-black cloth', () => {
    const hexes = paletteHexes({ skin: '#d9a98c', hair: '#3d2416', iris: '#4a2e1a', cloth1: '#15151c', cloth2: '#5b3b8a', cloth3: '#8a8a8f', leather: '#5e3d26', metal: '#b87333', trim: GRADE_TRIM.S, glow: '#ff8a3d' })
    expect(hexes).toHaveLength(16)
    expect(hexes[SLOT.skin]).toBe('#d9a98c')
    expect(hexes[SLOT.hair]).toBe('#3d2416')
    expect(hexes[SLOT.metal]).toBe('#b87333')
    expect(hexes[SLOT.trim]).toBe('#ffd84d')
    expect(hexes[SLOT.gem]).toBe('#ff8a3d')
    expect(hexes[SLOT.cloth1]).not.toBe('#15151c')
    expect(readableCloth('#6b7280')).toBe('#6b7280')
    for (const h of hexes) expect(h).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('writes the uniform in linear colour (the three.js sRGB curve)', () => {
    const u = paletteUniform(new Array(16).fill('#ffffff').map((h, i) => (i === 3 ? '#808080' : h)))
    expect(u).toHaveLength(48)
    expect(u[0]).toBeCloseTo(1, 5)
    expect(u[9]).toBeCloseTo(srgbToLinear(128 / 255), 6)
    expect(srgbToLinear(128 / 255)).toBeCloseTo(0.2158605, 5)
  })

  it('picks the best grade, wraps palette indexes and mixes colours', () => {
    expect(bestGrade(['F', 'C', null, 'E'])).toBe('C')
    expect(bestGrade([])).toBe('F')
    expect(wrapPick(['a', 'b', 'c'], 4, 'z')).toBe('b')
    expect(wrapPick(['a', 'b', 'c'], -1, 'z')).toBe('c')
    expect(wrapPick([], 0, 'z')).toBe('z')
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
  })
})

describe('the assembler arithmetic', () => {
  it('bakes morph targets: base + Σ weight × delta', () => {
    const base = new Float32Array([0, 0, 0, 1, 1, 1])
    const out = bakeMorphs(base, [new Float32Array([1, 0, 0, 1, 0, 0]), new Float32Array([0, 2, 0, 0, 2, 0]), null], [1, 0.5, 1])
    expect([...out]).toEqual([1, 1, 0, 2, 2, 1])
    expect([...base]).toEqual([0, 0, 0, 1, 1, 1])
    expect(morphWeights({ spc_dwarf_broad: 2, face_jaw_wide: 0 }, { spc_dwarf_broad: 1, face_jaw_wide: 0.4, face_missing: 1 }, 3)).toEqual([0.4, 0, 1])
  })

  it('reads `hides` as names or ids, in a list or a string', () => {
    expect([...parseRegions(['chest', 'belly'])].sort()).toEqual([2, 3])
    expect([...parseRegions('chest, upperArms forearms')].sort()).toEqual([2, 4, 5])
    expect([...parseRegions([7, '8', 'FEET', 'tail', 42])].sort()).toEqual([7, 8, 9])
    expect(parseRegions(undefined).size).toBe(0)
  })

  it('drops a triangle only when all three vertices are hidden, then compacts the vertices', () => {
    // Triangles: (0,1,2) all chest · (3,4,5) chest/chest/neck · (6,7,8) all head.
    const p = part(9, { region: [2, 2, 2, 2, 2, 1, 0, 0, 0] })
    const kept = keepTriangles(p.index, p.regions, new Set([2]))
    expect([...kept]).toEqual([3, 4, 5, 6, 7, 8])
    expect(keepTriangles(p.index, p.regions, new Set())).toBe(p.index)
    const c = compactPart(p, kept)
    expect(c.positions.length / 3).toBe(6)
    expect([...c.index]).toEqual([0, 1, 2, 3, 4, 5])
    expect(c.positions[0]).toBe(3)
    expect([...c.regions]).toEqual([2, 2, 1, 0, 0, 0])
  })

  it('remaps joints by bone name, through the loader’s _1 suffixes, to the Hips when unknown', () => {
    const dst = new Map([
      ['Hips', 0],
      ['Spine', 1],
      ['Tail_01', 2],
    ])
    expect(resolveBone('Spine_1', dst)).toBe(1)
    expect(resolveBone('Tail_01', dst)).toBe(2)
    expect(resolveBone('Wing', dst)).toBeUndefined()
    expect([...remapJoints(new Uint16Array([0, 1, 2, 3]), ['Spine', 'Hips_2', 'Wing', 'Tail_01'], dst, 0)]).toEqual([1, 0, 0, 2])
  })

  it('places a rigid part on a bone and merges parts into one mesh', () => {
    const translate = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.5, 2, 0, 1]
    const r = rigidPart('wpn', new Float32Array([0, 0, 0, 0, 1, 0, 1, 0, 0]), new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), new Uint8Array([9, 9, 10]), new Uint32Array([0, 1, 2]), translate, 7)
    expect([...r.positions]).toEqual([0.5, 2, 0, 0.5, 3, 0, 1.5, 2, 0])
    expect([...r.joints.slice(0, 4)]).toEqual([7, 0, 0, 0])
    const body = part(6)
    body.weights[4] = 3 // an unnormalised vertex
    const m = mergeParts([body, r], 65)
    expect(m.vertexCount).toBe(9)
    expect(m.triangleCount).toBe(3)
    expect(m.index).toBeInstanceOf(Uint16Array)
    expect(m.joints).toBeInstanceOf(Uint8Array)
    expect([...m.index.slice(6)]).toEqual([6, 7, 8])
    expect(m.weights[4]).toBe(1)
    expect(m.joints[6 * 4]).toBe(7)
    expect([...m.slots.slice(6)]).toEqual([9, 9, 10])
  })

  it('wears tier F meshes for grades F–C and tier S from B up', () => {
    expect(['F', 'E', 'D', 'C'].map(tierForGrade)).toEqual(['F', 'F', 'F', 'F'])
    expect(['B', 'A', 'S', 'SS', 'God'].map(tierForGrade)).toEqual(['S', 'S', 'S', 'S', 'S'])
  })
})

describe('species bone scales (05 §5): each bone’s world scale is its own group’s factor', () => {
  const chain = [
    { name: 'Hips', parent: null },
    { name: 'Spine', parent: 'Hips' },
    { name: 'Chest', parent: 'Spine' },
    { name: 'UpperChest', parent: 'Chest' },
    { name: 'RightShoulder', parent: 'UpperChest' },
    { name: 'RightUpperArm', parent: 'RightShoulder' },
    { name: 'RightLowerArm', parent: 'RightUpperArm' },
    { name: 'RightHand', parent: 'RightLowerArm' },
    { name: 'RightIndexProximal', parent: 'RightHand' },
    { name: 'RightIndexIntermediate', parent: 'RightIndexProximal' },
    { name: 'RightUpperLeg', parent: 'Hips' },
    { name: 'RightLowerLeg', parent: 'RightUpperLeg' },
    { name: 'RightFoot', parent: 'RightLowerLeg' },
    { name: 'RightToes', parent: 'RightFoot' },
    { name: 'Neck', parent: 'UpperChest' },
    { name: 'Head', parent: 'Neck' },
    { name: 'LeftEye', parent: 'Head' },
    { name: 'Tail_01', parent: 'Hips' },
  ]
  const world = (local: Map<string, number>, name: string): number => {
    let s = 1
    for (let b: string | null | undefined = name; b; b = chain.find((c) => c.name === b)?.parent) s *= local.get(b) ?? 1
    return s
  }

  it('the Dwarf: legs at 0.85 without compounding, big palms (the fingers have no factor), the head carries the eyes', () => {
    const dwarf = { root: 0.84, upperLeg: 0.85, lowerLeg: 0.85, shoulder: 1.15, chest: 1.1, upperChest: 1.1, hand: 1.15, head: 1.12, neck: 0.85 }
    const local = localBoneScales(chain, dwarf)
    expect(world(local, 'RightUpperLeg')).toBeCloseTo(0.85)
    expect(world(local, 'RightLowerLeg')).toBeCloseTo(0.85)
    expect(world(local, 'RightFoot')).toBeCloseTo(1)
    expect(world(local, 'RightToes')).toBeCloseTo(1)
    expect(world(local, 'RightUpperArm')).toBeCloseTo(1)
    expect(world(local, 'RightHand')).toBeCloseTo(1.15)
    expect(world(local, 'RightIndexIntermediate')).toBeCloseTo(1)
    expect(world(local, 'Head')).toBeCloseTo(1.12)
    expect(world(local, 'LeftEye')).toBeCloseTo(1.12)
    expect(world(local, 'Tail_01')).toBeCloseTo(1)
    expect(rootScale(dwarf)).toBe(0.84)
  })

  it('the Elf: fingers of their own on an ordinary hand; the Halfling: toes like its feet', () => {
    const elf = localBoneScales(chain, { fingers: 1.1 })
    expect(world(elf, 'RightHand')).toBeCloseTo(1)
    expect(world(elf, 'RightIndexProximal')).toBeCloseTo(1.1)
    expect(world(elf, 'RightIndexIntermediate')).toBeCloseTo(1.1)
    const halfling = localBoneScales(chain, { foot: 1.15, toes: 1.15 })
    expect(world(halfling, 'RightToes')).toBeCloseTo(1.15)
    expect(boneGroup('LeftThumbDistal')).toEqual({ group: 'fingers', inherit: false })
    expect(boneGroup('LeftLowerArm')).toEqual({ group: 'lowerArm', inherit: false })
    expect(boneGroup('Beard_02')).toEqual({ group: null, inherit: true })
    expect(boneGroup('Spine')).toEqual({ group: null, inherit: false })
    // An Orc's hands: 1.12 × 1.15 = 1.29 in the world (05 §3), the root on the character.
    const orc = localBoneScales(chain, { root: 1.12, hand: 1.15, lowerArm: 1.12, upperArm: 1.1, shoulder: 1.15 })
    expect(world(orc, 'RightHand') * rootScale({ root: 1.12 })).toBeCloseTo(1.288, 3)
    expect(rootScale({})).toBe(1)
  })
})

describe('clips', () => {
  it('keeps bone rotations and the Hips position only', () => {
    const bones = new Set(['Hips', 'Spine'])
    expect(keepTrack('Spine.quaternion', bones)).toBe(true)
    expect(keepTrack('Hips.position', bones)).toBe(true)
    expect(keepTrack('Spine.position', bones)).toBe(false)
    expect(keepTrack('Hips.scale', bones)).toBe(false)
    expect(keepTrack('Rig.quaternion', bones)).toBe(false)
  })

  it('scales the Hips track around the character’s rest by its leg ratio', () => {
    const out = scaleHipsTrack([0, 0.885, 0, 0.1, 0.785, 0.2], [0, 0.885, 0], [0, 0.6, 0], 0.5)
    expect([...out].map((v) => Math.round(v * 1000) / 1000)).toEqual([0, 0.6, 0, 0.05, 0.55, 0.1])
  })

  it('reads clips.json as a list, a keyed object or { clips: [...] }', () => {
    const a = parseClipsJson([{ name: 'Attack_Light', seconds: 0.9, loop: false, events: { hit: 0.42 } }])
    expect(a.get('Attack_Light')).toEqual({ name: 'Attack_Light', seconds: 0.9, loop: false, events: { hit: 0.42 } })
    const b = parseClipsJson({ clips: { Idle: { seconds: 2, loop: true, events: [{ name: 'step', t: 0.5 }] } } })
    expect(b.get('Idle')).toEqual({ name: 'Idle', seconds: 2, loop: true, events: { step: 0.5 } })
    expect(parseClipsJson('junk').size).toBe(0)
  })
})

describe('the hero manifest', () => {
  it('reads species presets, tones and hair whatever the exact spelling', () => {
    const m = parseManifest({
      species: {
        dwarf: { presets: [{ name: 'Forge', weights: { face_jaw_wide: 0.6 }, parts: ['spc_dwarf_beard', 'hair_crop'], tint: { skin: 1, eye: 2, hair: -1 } }, { face_brow_heavy: 1 }], skinTones: ['#D9A98C', 'nope'], hairColours: ['#3d2416'], eyeColors: ['#b27a22'] },
      },
    })
    const d = m.species.get('dwarf')!
    expect(d.presets[0]).toEqual({ name: 'Forge', face: { face_jaw_wide: 0.6 }, parts: ['spc_dwarf_beard', 'hair_crop'], tint: { skin: 1, eye: 2 } })
    expect(d.iris).toEqual(['#b27a22'])
    expect(d.presets[1]?.face).toEqual({ face_brow_heavy: 1 })
    expect(d.skinTones).toEqual(['#d9a98c'])
    expect(d.hair).toEqual(['#3d2416'])
    const list = parseManifest({ species: [{ id: 'elf', facePresets: [{ face: [['face_eye_big', 0.5]] }] }] })
    expect(list.species.get('elf')?.presets[0]?.face).toEqual({ face_eye_big: 0.5 })
    expect(parseManifest(null).species.size).toBe(0)
  })
})
