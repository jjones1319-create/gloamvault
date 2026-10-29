import { describe, expect, it } from 'vitest'
import { bossLayers, decide, endStingers, isRareGrade, zoneMusic, type DelveScene, type FightScene, type Scene, type SongRequest } from './director.ts'

const scene = (s: Partial<Scene>): Scene => ({ screen: 'title', townPlace: null, hasProfile: true, delve: null, ...s })
const delve = (d: Partial<DelveScene>): DelveScene => ({ zoneId: 'the-cellars', phase: 'room', outcome: null, roomKind: 'fight', spiders: false, fight: null, ...d })
const fight = (f: Partial<FightScene>): FightScene => ({ kind: 'fight', bossId: null, phase: 1, hunters: [], danger: false, ...f })
const songOf = (s: Scene): SongRequest => {
  const r = decide(s).song
  if (!r || r === 'keep') throw new Error(`no song for ${JSON.stringify(s)}`)
  return r
}

describe('the director: the place picks the piece (07 §2.2)', () => {
  it('the title and New hero play Emberfall\'s title arrangement; settings and the hero sheet keep what plays', () => {
    expect(songOf(scene({ screen: 'title' }))).toMatchObject({ id: 'emberfall', arrangement: 'title' })
    expect(songOf(scene({ screen: 'new-hero' }))).toMatchObject({ id: 'emberfall', arrangement: 'title' })
    for (const screen of ['settings', 'hero', 'viewer', 'room', 'phone']) expect(decide(scene({ screen }))).toEqual({ song: 'keep', bed: 'keep', reverb: 'keep' })
  })

  it('the town plays Emberfall with each place\'s stem and bed, and a town without a save shows the title', () => {
    expect(decide(scene({ screen: 'town' }))).toMatchObject({ song: { id: 'emberfall', stem: 'square' }, bed: { id: 'town' }, reverb: 'outdoor' })
    expect(decide(scene({ screen: 'town', townPlace: 'blacksmith' }))).toMatchObject({ song: { stem: 'forge' }, bed: { id: 'town-forge' }, reverb: 'room' })
    expect(decide(scene({ screen: 'town', townPlace: 'inn' }))).toMatchObject({ song: { stem: 'inn' }, bed: { id: 'town-inn' } })
    expect(decide(scene({ screen: 'town', townPlace: 'shrine' }))).toMatchObject({ song: { stem: 'shrine' }, bed: { id: 'town-shrine' } })
    expect(songOf(scene({ screen: 'town', townPlace: 'curio' })).stem).toBe('stall')
    expect(songOf(scene({ screen: 'town', hasProfile: false }))).toMatchObject({ id: 'emberfall', arrangement: 'title' })
  })

  it('each zone has its exploring piece, bed and reverb; a rest room plays the rest layer by the campfire', () => {
    expect(decide(scene({ screen: 'delve', delve: delve({}) }))).toMatchObject({ song: { id: 'cellars', layers: ['main'] }, bed: { id: 'cellars', campfire: false }, reverb: 'room' })
    expect(decide(scene({ screen: 'delve', delve: delve({ zoneId: 'the-crypts' }) }))).toMatchObject({ song: { id: 'crypts' }, bed: { id: 'crypts' }, reverb: 'cave' })
    expect(decide(scene({ screen: 'delve', delve: delve({ zoneId: 'the-drowned-vault' }) }))).toMatchObject({ song: { id: 'vault' }, bed: { id: 'vault' }, reverb: 'underwater' })
    expect(decide(scene({ screen: 'delve', delve: delve({ roomKind: 'rest' }) }))).toMatchObject({ song: { id: 'cellars', layers: ['rest'] }, bed: { campfire: true } })
    expect(songOf(scene({ screen: 'delve', delve: delve({ zoneId: 'the-crypts', spiders: true }) })).layers).toEqual(['main', 'spider'])
    // A zone the tables do not know (a later dungeon) still plays something.
    expect(songOf(scene({ screen: 'delve', delve: delve({ zoneId: 'somewhere-new' }) })).id).toBe(zoneMusic(null).explore)
    expect(decide(scene({ screen: 'delve', delve: null }))).toEqual({ song: 'keep', bed: 'keep', reverb: 'keep' })
  })

  it('a fight plays the zone\'s fight piece, with tension when the party is in trouble', () => {
    expect(songOf(scene({ screen: 'delve', delve: delve({ fight: fight({}) }) }))).toMatchObject({ id: 'cellars-fight', layers: ['base', 'drive'] })
    expect(songOf(scene({ screen: 'delve', delve: delve({ fight: fight({ danger: true }) }) })).layers).toEqual(['base', 'drive', 'tension'])
    expect(songOf(scene({ screen: 'delve', delve: delve({ zoneId: 'the-crypts', fight: fight({}) }) })).id).toBe('crypts-fight')
    expect(songOf(scene({ screen: 'delve', delve: delve({ zoneId: 'the-drowned-vault', fight: fight({}) }) })).id).toBe('vault-fight')
  })

  it('each boss has its piece, a layer per phase shown, and on the throne a layer per hunter that answered', () => {
    expect(songOf(scene({ screen: 'delve', delve: delve({ fight: fight({ kind: 'boss', bossId: 'captain-vexa-marrow' }) }) }))).toMatchObject({ id: 'vexa', layers: ['base'] })
    expect(songOf(scene({ screen: 'delve', delve: delve({ fight: fight({ kind: 'boss', bossId: 'barrow-warden', phase: 2 }) }) }))).toMatchObject({ id: 'warden', layers: ['base', 'phase2'] })
    expect(songOf(scene({ screen: 'delve', delve: delve({ fight: fight({ kind: 'boss', bossId: 'sister-naesa' }) }) })).id).toBe('naesa')
    const king = songOf(scene({ screen: 'delve', delve: delve({ zoneId: 'the-drowned-vault', fight: fight({ kind: 'boss', bossId: 'hollow-king', phase: 3, hunters: ['old-gnaw', 'vault-leech'] }) }) }))
    expect(king).toMatchObject({ id: 'throne', layers: ['base', 'phase2', 'phase3', 'company', 'cult'] })
    expect(bossLayers(3, ['wardens-hound', 'wardens-hound', 'nobody'])).toEqual(['base', 'phase2', 'phase3', 'vigil'])
  })

  it('the end of a delve: a wipe falls silent over the bed, a cleared zone rests, a walk-out keeps exploring', () => {
    expect(decide(scene({ screen: 'delve', delve: delve({ phase: 'over', outcome: 'wiped' }) }))).toMatchObject({ song: null, bed: { id: 'cellars' } })
    expect(decide(scene({ screen: 'delve', delve: delve({ phase: 'over', outcome: 'chosenDied' }) })).song).toBeNull()
    expect(songOf(scene({ screen: 'delve', delve: delve({ phase: 'over', outcome: 'cleared' }) })).layers).toEqual(['rest'])
    expect(songOf(scene({ screen: 'delve', delve: delve({ phase: 'over', outcome: 'retreated' }) })).layers).toEqual(['main'])
  })
})

describe('the stinger rules', () => {
  it('a won fight ends on victory, then a level up, then a rare find; a boss on its own victory; a defeat on defeat', () => {
    expect(endStingers({ outcome: 'victory', boss: false, levelUps: 0, rare: false })).toEqual(['victory'])
    expect(endStingers({ outcome: 'victory', boss: false, levelUps: 2, rare: true })).toEqual(['victory', 'levelUp', 'rareDrop'])
    expect(endStingers({ outcome: 'victory', boss: true, levelUps: 1, rare: false })).toEqual(['bossVictory', 'levelUp'])
    expect(endStingers({ outcome: 'defeat', boss: true, levelUps: 1, rare: true })).toEqual(['defeat'])
    expect(endStingers({ outcome: 'fled', boss: false, levelUps: 0, rare: false })).toEqual([])
    expect(endStingers({ outcome: 'cap', boss: false, levelUps: 0, rare: false })).toEqual([])
  })

  it('a rare find is an A-grade or better', () => {
    const rare = ['A', 'S', 'SS', 'God']
    expect(isRareGrade('A', rare)).toBe(true)
    expect(isRareGrade('God', rare)).toBe(true)
    expect(isRareGrade('B', rare)).toBe(false)
    expect(isRareGrade(undefined, rare)).toBe(false)
  })
})
