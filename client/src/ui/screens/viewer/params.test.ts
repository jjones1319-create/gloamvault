import { describe, expect, it } from 'vitest'
import { parseViewerParams } from './params.ts'

const SPECIES = ['draconid', 'dwarf', 'elf', 'halfling', 'human', 'orc']
const CLASSES = ['arcanist', 'blade', 'mender', 'ranger', 'shade', 'warden']

describe('the viewer deep link (#viewer=dwarf,warden,S)', () => {
  it('reads species, class and tier, with the optional frame, preset, clip, zoom and yaw', () => {
    const s = parseViewerParams({ viewer: 'dwarf,warden,S', frame: 'slight', preset: '2', skin: '3', hair: '1', clip: 'Run', zoom: 'min', yaw: '-30', gear: '0' }, SPECIES, CLASSES)
    expect(s).toEqual({ speciesId: 'dwarf', classId: 'warden', tier: 'S', frame: 'slight', face: 1, skin: 2, hair: 0, clip: 'Run', gear: false, zoom: 'min', yaw: -30 })
  })

  it('falls back to a Human in the first class, tier F, broad, the first face; a grade B and up wears the S meshes', () => {
    const s = parseViewerParams({ viewer: '1' }, SPECIES, CLASSES)
    expect([s.speciesId, s.classId, s.tier, s.frame, s.face, s.gear, s.zoom, s.yaw, s.clip]).toEqual(['human', 'arcanist', 'F', 'broad', 0, true, null, null, null])
    expect(parseViewerParams({ viewer: 'elf,ranger,B' }, SPECIES, CLASSES).tier).toBe('S')
    expect(parseViewerParams({ viewer: 'gnome,bard,C', preset: '0', zoom: '2.5', clip: '<script>' }, SPECIES, CLASSES)).toMatchObject({ speciesId: 'human', classId: 'arcanist', tier: 'F', face: 0, zoom: 2.5, clip: null })
  })
})

describe('the acceptance matrix link (#viewer=matrix&clip=Idle&tier=F)', () => {
  it('reads the clip, tier, frame and the instant to freeze on', async () => {
    const { matrixOptions } = await import('./params.ts')
    expect(matrixOptions({ viewer: 'matrix', clip: 'Attack_Heavy', tier: 's', at: 'hit' })).toEqual({ clip: 'Attack_Heavy', tier: 'S', frame: 'broad', t: null, at: 'hit' })
    expect(matrixOptions({ viewer: 'matrix', frame: 'slight', t: '1.7' })).toEqual({ clip: 'Idle', tier: 'F', frame: 'slight', t: 1, at: null })
    expect(matrixOptions({ viewer: 'matrix', clip: '<x>', t: '0.4', at: 'hit' })).toMatchObject({ clip: 'Idle', t: 0.4, at: null })
  })
})
