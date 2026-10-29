import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { addHero, newProfile, type Profile } from '../../../../../sim/src/town.ts'
import { loadContentDir } from '../../../../../tools/sim/loadContent.ts'
import { codexMaterials, codexMonsters, codexTotals, materialSources, metMonsters, words } from './codexView.ts'

const c = loadContentDir(path.resolve('content'))

function fresh(): Profile {
  return addHero(c, newProfile(2), { name: 'Orrin', speciesId: 'dwarf', classId: 'warden', eggPetId: null }).profile
}

describe('the codex pages', () => {
  it('start empty: the first zone shows with nothing met', () => {
    const zones = codexMonsters(c, fresh())
    expect(zones).toHaveLength(1)
    expect(zones[0]!.name).toBe('The Cellars')
    expect(zones[0]!.seen).toEqual([])
    expect(zones[0]!.total).toBeGreaterThan(5)
    expect(codexMaterials(c, fresh())).toEqual([])
    expect(codexTotals(c, fresh()).monstersMet).toBe(0)
  })

  it('show a met monster with the attacks and tells seen and its parts', () => {
    const rat = c.monsters.get('giant-rat')!
    const p: Profile = { ...fresh(), codex: { monsters: { 'giant-rat': { seen: 7, killed: 6, attacks: ['bite'], tells: [] } }, materials: { rawhide: 3 } } }
    const cellars = codexMonsters(c, p)[0]!
    const view = cellars.seen.find((m) => m.id === 'giant-rat')!
    expect(view).toMatchObject({ name: rat.name, family: 'Cellar Vermin', zone: 'The Cellars', seen: 7, killed: 6, speed: rat.speed })
    expect(view.attacks.map((a) => a.name)).toEqual(['Bite'])
    expect(view.unseenAttacks, 'Scurry-nip is still unseen; the death trigger is no attack').toBe(1)
    expect(view.parts).toEqual([
      { id: 'rawhide', name: c.items.get('rawhide')!.name, rare: false, found: true },
      { id: 'rat-tail-charm', name: c.items.get('rat-tail-charm')?.name ?? words('rat-tail-charm'), rare: true, found: false },
    ])
  })

  it('count the bosses a save beat before the codex existed', () => {
    const p: Profile = { ...fresh(), progress: { ...fresh().progress, bossKills: { 'captain-vexa-marrow': 2 } } }
    expect(metMonsters(p).get('captain-vexa-marrow')).toEqual({ seen: 2, killed: 2, attacks: [], tells: [] })
    const vexa = codexMonsters(c, p)[0]!.seen.find((m) => m.id === 'captain-vexa-marrow')!
    expect(vexa.boss).toBe(true)
  })

  it('list materials found or held, with where they come from', () => {
    const p: Profile = { ...fresh(), materials: { copper: 2 }, codex: { monsters: { 'giant-rat': { seen: 1, killed: 1, attacks: [], tells: [] } }, materials: { rawhide: 4 } } }
    const mats = codexMaterials(c, p)
    expect(mats.map((m) => m.id).sort()).toEqual(['copper', 'rawhide'])
    const rawhide = mats.find((m) => m.id === 'rawhide')!
    expect(rawhide.found).toBe(4)
    expect(rawhide.held).toBe(0)
    const sources = materialSources(c, p, 'rawhide')
    expect(sources[0]).toMatch(/^Dropped by Giant Rat/)
    expect(sources[0]).toMatch(/you have not met/)
    expect(sources.some((s) => s.startsWith('Disarming') && s.includes('Tripwire Bell'))).toBe(true)
    expect(mats.find((m) => m.id === 'copper')!.held).toBe(2)
  })
})
