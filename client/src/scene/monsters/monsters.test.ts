import { describe, expect, it } from 'vitest'
import { labelName, lineupEntries, lineupSpots, lineupZone, titleOf, zoneOfMonster } from './lineup.ts'
import {
  HERO_CLIP_FOR,
  monsterAttackClip,
  monsterClipCandidates,
  monsterPaletteHexes,
  parseMonsterClips,
  parseMonsterManifest,
  partShown,
  readInstances,
  resolveMonsterVariant,
  resolvePetVariant,
  specialClipNames,
  variantKey,
  variantPalette,
} from './manifest.ts'

/** The shape the monster passes write (models/monsters/manifest.json). */
const MANIFEST = {
  'vault-leech': { base: 'leech', scale: 1, parts: [], shapes: {}, palette: ['#5b3f6e', '#d9788c', '#c9d98f'], slots: { '11': '#c8f08a' }, clipSpeed: 1, tris: 3750 },
  'deep-maw': {
    base: 'tentacle',
    scale: 1,
    parts: ['tentacle_maw'],
    shapes: {},
    palette: ['#4b6e52', '#e3a3ad', '#16181b'],
    clipSpeed: 0.85,
    instances: [
      { mesh: 'tentacle_body', position: [-0.8347, 0, 1.1488], rotation: [0.05236, 0.20956, 0.05843, 0.97464], scale: 1, clipOffset: 0 },
      { mesh: 'tentacle_body', position: [0.8347, 0, 1.1488], rotation: [0.05236, -0.20956, -0.05843, 0.97464], scale: 1, clipOffset: 0.45 },
    ],
  },
  'naesa-arm': { base: 'tentacle', scale: 0.6, parts: [], shapes: { var_arm: 1 }, palette: ['#4f7258', '#efe8dc', '#2e4a6b'], clipSpeed: 1.15 },
  'skeleton-footman': { base: 'skeleton', scale: 1, parts: ['skeleton_shield'], palette: ['#d8ccb0', '#5a4a3a', '#6fe3a8'] },
  wisp: { base: 'wisp', scale: 0.65, parts: ['wisp_glow', 'wisp_motes'], palette: ['#f0d890', '#b89650', '#fffbe8'], pet: true },
  'pet:rat-prince': { base: 'rat', scale: 0.6, palette: ['#5a4a3a', '#d9d2c5', '#b0b0b0'] },
  version: 3,
}

const all = () => true

describe('the variant table (models/monsters/manifest.json)', () => {
  const m = parseMonsterManifest(MANIFEST)

  it('reads monsters and pets: base, scale, parts, baked shapes, palette, slot colours, clip speed', () => {
    expect([...m.monsters.keys()].sort()).toEqual(['deep-maw', 'naesa-arm', 'skeleton-footman', 'vault-leech'])
    expect([...m.pets.keys()].sort()).toEqual(['rat-prince', 'wisp'])
    const leech = m.monsters.get('vault-leech')!
    expect(leech).toMatchObject({ base: 'leech', scale: 1, parts: [], palette: ['#5b3f6e', '#d9788c', '#c9d98f'], slots: { 11: '#c8f08a' }, clipSpeed: 1, heroClips: false, pet: false })
    expect(m.monsters.get('naesa-arm')!.shapes).toEqual({ var_arm: 1 })
    expect(m.monsters.get('skeleton-footman')!.heroClips).toBe(true)
    expect(m.pets.get('rat-prince')!.parts).toBeNull()
  })

  it('reads the Deep Maw’s ring: positions, quaternions, clip offsets and the mesh each copy shows', () => {
    const maw = m.monsters.get('deep-maw')!
    expect(maw.instances!.spots).toHaveLength(2)
    expect(maw.instances!.spots[0]).toMatchObject({ x: -0.8347, y: 0, z: 1.1488, quaternion: [0.05236, 0.20956, 0.05843, 0.97464], clipOffset: 0, mesh: 'tentacle_body' })
    expect(maw.instances!.spots[1]!.clipOffset).toBe(0.45)
    expect(readInstances(5)!.spots).toHaveLength(5)
    expect(readInstances({ count: 3, radius: 2 })!.spots.map((s) => Math.round(Math.hypot(s.x, s.z) * 100) / 100)).toEqual([2, 2, 2])
    expect(readInstances('lots')).toBeNull()
  })

  it('accepts `{ monsters, pets }` (objects or lists) and never throws on rubbish', () => {
    const n = parseMonsterManifest({ monsters: [{ id: 'giant-rat', base: 'rat' }], pets: { spiderling: { base: 'spider', scale: 0.3 } } })
    expect(n.monsters.get('giant-rat')?.base).toBe('rat')
    expect(n.pets.get('spiderling')?.scale).toBe(0.3)
    expect(parseMonsterManifest(null).monsters.size).toBe(0)
    expect(parseMonsterManifest({ x: { scale: 2 } }).monsters.size).toBe(0)
  })

  it('a monster’s variant: the manifest’s, else the content’s look on its base’s body; none without a base file', () => {
    const leech = resolveMonsterVariant('vault-leech', m, { palette: ['#000000'] }, all)!
    expect(leech.palette).toEqual(['#5b3f6e', '#d9788c', '#c9d98f'])
    const rat = resolveMonsterVariant('giant-rat', m, { baseMesh: 'rat', scale: 1, palette: ['#5a4634', '#e8a0a0', '#e6d8a0'] }, all)!
    expect(rat).toMatchObject({ base: 'rat', scale: 1, parts: [], palette: ['#5a4634', '#e8a0a0', '#e6d8a0'], heroClips: false })
    const bruiser = resolveMonsterVariant('grinning-bruiser', m, { baseMesh: 'humanoid', scale: 1.25, palette: ['#8a4b2a'] }, all)!
    expect(bruiser.heroClips).toBe(true)
    expect(bruiser.palette).toEqual(['#8a4b2a', '#8a4b2a', '#8a4b2a'])
    expect(resolveMonsterVariant('giant-rat', m, { baseMesh: 'rat' }, (b) => b !== 'rat')).toBeNull()
    expect(resolveMonsterVariant('nobody', m, undefined, all)).toBeNull()
  })

  it('a pet’s variant: the manifest’s pet entry, else its species’ base at 06 §9’s baby scale', () => {
    expect(resolvePetVariant('wisp', m, { baseMesh: 'wisp' }, all)).toMatchObject({ base: 'wisp', scale: 0.65, pet: true })
    expect(resolvePetVariant('cellar-hound', m, { baseMesh: 'hound', palette: ['#4b3b2f', '#c2b280', '#1c1c1c'] }, all)).toMatchObject({ base: 'hound', scale: 0.7, pet: true })
    expect(resolvePetVariant('spiderling', m, { baseMesh: 'spider' }, all)!.scale).toBe(0.3)
    expect(resolvePetVariant('brine-crab', m, { baseMesh: 'crab' }, (b) => b !== 'crab')).toBeNull()
  })

  it('variants that share geometry share a key; parts show by full or short name, the body always', () => {
    const a = resolveMonsterVariant('giant-rat', m, { baseMesh: 'rat' }, all)!
    const b = resolveMonsterVariant('plague-rat', m, { baseMesh: 'rat', scale: 1.1 }, all)!
    expect(variantKey(a)).toBe(variantKey(b))
    expect(variantKey(m.monsters.get('naesa-arm')!)).not.toBe(variantKey(m.monsters.get('deep-maw')!))
    expect(partShown('tentacle_body', 'tentacle', [])).toBe(true)
    expect(partShown('tentacle_maw', 'tentacle', [])).toBe(false)
    expect(partShown('tentacle_maw', 'tentacle', ['tentacle_maw'])).toBe(true)
    expect(partShown('wisp_cage', 'wisp', ['cage'])).toBe(true)
    expect(partShown('wisp_cage_1', 'wisp', null)).toBe(true)
    // A hero-rig base shows exactly its list: one costume's body, not every costume's.
    expect(partShown('humanoid_cutpurse_body', 'humanoid', ['humanoid_cutpurse_body'], true)).toBe(true)
    expect(partShown('humanoid_vexa_body', 'humanoid', ['humanoid_cutpurse_body'], true)).toBe(false)
  })

  it('a boss shows its first phase by default (the Hollow King seated, his throne rigid), with full palettes and clip maps', () => {
    const k = parseMonsterManifest({
      'hollow-king': {
        base: 'hollow-king',
        scale: 2,
        parts: ['hollow-king_king_chest'],
        palette: ['#1f2226', '#e0703a', '#5fc8ff'],
        colors: Array.from({ length: 16 }, (_, i) => `#0000${(i + 16).toString(16)}`),
        clips: 'hero',
        clipMap: { Move: 'Run', Attack1: 'Attack_Heavy' },
        props: { throne: { parts: ['hollow-king_throne_seat'], column: 'hollow-king_throne_column' } },
        phases: { '1': { poseHold: { LeftUpperLeg: [0.69, 0, 0, 0.72] }, hipsOffset: [0, -0.38, -0.11] }, '2': { scale: 2.2 } },
        boneScales: { upperArm: 1.16 },
        ghost: false,
      },
    }).monsters.get('hollow-king')!
    expect(k.hipsOffset).toEqual([0, -0.38, -0.11])
    expect(k.poseHold).toEqual({ LeftUpperLeg: [0.69, 0, 0, 0.72] })
    expect(k.scale).toBe(2)
    expect(k.rigidProps).toEqual(['hollow-king_throne_seat', 'hollow-king_throne_column'])
    expect(k.clipMap).toEqual({ Move: 'Run', Attack1: 'Attack_Heavy' })
    expect(k.boneScales).toEqual({ upperArm: 1.16 })
    expect(k.colors).toHaveLength(16)
    expect(k.heroClips).toBe(true)
    expect(variantPalette(k)[0]).toBe('#000010')
    expect(k.throne).toEqual({ column: 'hollow-king_throne_column', columnHeight: 1, raised: false })
    expect(k.phase).toBe(1)
  })

  it('a later phase wears its own look: the King stands and his throne rises, the Warden’s lantern turns blue', () => {
    const m = parseMonsterManifest({
      'hollow-king': { base: 'hollow-king', scale: 2, parts: ['a'], props: { throne: { parts: ['seat'], column: 'col', columnHeight: 1 } }, phases: { '1': { poseHold: { Hips: [0, 0, 0, 1] }, hipsOffset: [0, -0.4, 0] }, '2': { pose: 'standing' }, '3': { clipSpeed: 1.2 } } },
      'barrow-warden': { base: 'skeleton', scale: 1.75, palette: ['#2e2f35', '#d8ccb2', '#7dffb0'], phases: { '2': { colors: { '2': '#6fa8ff', '11': '#6fa8ff' } } } },
      'sister-naesa': { base: 'humanoid', parts: ['robe'], phases: { '2': { parts: ['robe2', 'tentacle_L'], scale: 1.28 } } },
    })
    const king2 = resolveMonsterVariant('hollow-king', m, undefined, all, 2)!
    expect(king2.poseHold).toBeNull()
    expect(king2.hipsOffset).toBeNull()
    expect(king2.throne?.raised).toBe(true)
    expect(king2.phase).toBe(2)
    expect(variantKey(king2)).not.toBe(variantKey(resolveMonsterVariant('hollow-king', m, undefined, all, 1)!))
    expect(resolveMonsterVariant('hollow-king', m, undefined, all, 3)!.clipSpeed).toBe(1.2)
    const warden = resolveMonsterVariant('barrow-warden', m, undefined, all, 2)!
    expect(warden.slots[2]).toBe('#6fa8ff')
    expect(variantPalette(warden)[11]).toBe('#6fa8ff')
    expect(resolveMonsterVariant('barrow-warden', m, undefined, all, 1)!.slots[2]).toBeUndefined()
    const naesa = resolveMonsterVariant('sister-naesa', m, undefined, all, 2)!
    expect(naesa.parts).toEqual(['robe2', 'tentacle_L'])
    expect(naesa.scale).toBe(1.28)
  })

  it('three colours into slots 0–2, the contract’s fixed slots, the entry’s own slot colours over them', () => {
    const p = monsterPaletteHexes(['#111111', '#222222', '#333333'], { 11: '#c8f08a' })
    expect(p).toHaveLength(16)
    expect(p.slice(0, 3)).toEqual(['#111111', '#222222', '#333333'])
    expect(p[11]).toBe('#c8f08a')
    expect(p[13]).toBe('#e8dcc0')
    expect(monsterPaletteHexes(['#abcdef'])[2]).toBe('#abcdef')
  })
})

describe('clips', () => {
  it('reads clips.json by base (`{ bases: { leech: { clips: […] } } }`, flat lists, `base/clip` keys)', () => {
    const c = parseMonsterClips({ fps: 30, bases: { leech: { animation: 'skeletal', clips: [{ name: 'Attack1', seconds: 1.2, loop: false, events: { hit: 0.55 } }, { name: 'Idle', seconds: 2.8, loop: true, events: {} }] } } })
    expect(c.get('leech')?.get('Attack1')).toMatchObject({ seconds: 1.2, events: { hit: 0.55 } })
    expect(c.get('leech')?.get('Idle')?.loop).toBe(true)
    expect(parseMonsterClips([{ base: 'rat', name: 'Move', seconds: 1 }]).get('rat')?.get('Move')?.seconds).toBe(1)
    expect(parseMonsterClips({ 'wisp/Hit': { seconds: 0.4 } }).get('wisp')?.get('Hit')?.seconds).toBe(0.4)
    expect(parseMonsterClips(undefined).size).toBe(0)
  })

  it('answers to the heroes’ clip names and its own: Move for a walk, Death for a fall, the hero clips on the hero rig', () => {
    expect(monsterClipCandidates('Walk', false)).toEqual(['Move', 'Walk'])
    expect(monsterClipCandidates('Attack_Heavy', false)[0]).toBe('Attack2')
    expect(monsterClipCandidates('Downed', false)[0]).toBe('Death')
    expect(monsterClipCandidates('Flee', false)).toEqual(['Flee', 'Run', 'Move'])
    expect(monsterClipCandidates('Web', false)).toEqual(['Web'])
    expect(monsterClipCandidates('Move', true)).toEqual(['Walk'])
    expect(monsterClipCandidates('Death', true)).toEqual(['Defeat'])
    expect(HERO_CLIP_FOR.Attack2).toBe('Attack_Heavy')
  })

  it('Attack1 or Attack2 by the move’s weight; a move that hits nothing asks for its own clip first', () => {
    expect(monsterAttackClip({ id: 'bite', weight: 800, multiplier: 0.9 }, 1000)).toEqual({ clip: 'Attack1', alt: ['Bite'] })
    expect(monsterAttackClip({ id: 'crushing-blow', weight: 1400, multiplier: 1.6 }, 1000)).toEqual({ clip: 'Attack2', alt: ['CrushingBlow', 'Crushing'] })
    expect(monsterAttackClip({ id: 'web-shot', weight: 1000, multiplier: 0 }, 1000).clip).toBe('Attack2')
    expect(specialClipNames('howl')).toEqual(['Howl'])
    expect(specialClipNames('')).toEqual([])
  })
})

describe('the lineup', () => {
  const m = parseMonsterManifest(MANIFEST)
  it('files each monster under its zone (the manifest’s, the content’s, else 06’s lists) and pets apart', () => {
    expect(zoneOfMonster('giant-rat', null, 'the-cellars')).toBe('cellars')
    expect(zoneOfMonster('skeleton-footman', null, undefined)).toBe('crypts')
    expect(zoneOfMonster('the-barrow-warden', null, undefined)).toBe('crypts')
    expect(zoneOfMonster('deep-maw', null, undefined)).toBe('vault')
    expect(zoneOfMonster('wisp', m.pets.get('wisp')!, undefined)).toBe('pets')
    expect(lineupZone('vault')).toBe('vault')
    expect(lineupZone('mars')).toBe('all')
    expect(titleOf('wardens-hound')).toBe('Wardens Hound')
    expect(labelName('Captain Vexa Marrow, the Grinning Captain')).toBe('Captain Vexa Marrow')
    expect(labelName('Old Gnaw')).toBe('Old Gnaw')
  })

  it('lists a zone’s monsters smallest first, with the content’s names', () => {
    const vault = lineupEntries(m, 'vault', (id) => (id === 'vault-leech' ? { name: 'The Vault Leech', size: 2.4 } : undefined))
    expect(vault.map((e) => e.id)).toEqual(['naesa-arm', 'deep-maw', 'vault-leech'])
    expect(vault[2]!.name).toBe('The Vault Leech')
    expect(lineupEntries(m, 'pets', () => undefined).map((e) => e.id).sort()).toEqual(['rat-prince', 'wisp'])
    expect(lineupEntries(m, 'all', () => undefined)).toHaveLength(6)
  })

  it('spaces a line by widths, centred, in even rows behind each other', () => {
    expect(lineupSpots([1, 1, 2], 0.5)).toEqual([
      { x: -2, z: 0, row: 0, col: 0 },
      { x: -0.5, z: 0, row: 0, col: 1 },
      { x: 1.5, z: 0, row: 0, col: 2 },
    ])
    const rows = lineupSpots(Array.from({ length: 10 }, () => 1), 0, 8, 4)
    expect(rows.filter((s) => s.row === 0)).toHaveLength(5)
    expect(rows.filter((s) => s.row === 1).every((s) => s.z === -4)).toBe(true)
  })
})
