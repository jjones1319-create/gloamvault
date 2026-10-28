import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Actor, FightEvent, FightState } from '../../../sim/src/fight-types.ts'
import { buildHeroActor } from '../../../sim/src/hero.ts'
import { addHero, newProfile } from '../../../sim/src/town.ts'
import { loadContentDir } from '../../../tools/sim/loadContent.ts'
import { beatAnims } from './fightAnims.ts'
import { beatsOf } from './fightView.ts'

const content = loadContentDir(path.resolve('content'))

function hero(classId: string, id: string): Actor {
  const rec = addHero(content, newProfile(7), { name: classId[0]!.toUpperCase() + classId.slice(1), speciesId: 'human', classId }).hero
  return buildHeroActor(content, content.tuning, rec, { id, row: 'front' })
}

const party = [hero('warden', 'hero-0'), hero('blade', 'hero-1'), hero('arcanist', 'hero-2'), hero('ranger', 'hero-3')]
const fight = { actors: party } as unknown as FightState

function ev(kind: string, actorId: string | undefined, text: string, data?: FightEvent['data']): FightEvent {
  return { tick: 0, round: 1, kind, ...(actorId ? { actorId } : {}), text, ...(data ? { data } : {}) }
}

function clipOf(e: FightEvent): string | undefined {
  const beat = beatsOf([e], 0)[0]!
  return beatAnims(beat, fight, content).find((c) => c.actorId === e.actorId)?.clip
}

describe('a hero’s clip for each beat (Phase 5)', () => {
  it('weapon skills swing light or heavy by their weight; shield skills too', () => {
    expect(clipOf(ev('action', 'hero-0', 'Warden uses Shield Slam on Giant Rat 1'))).toBe('Attack_Light')
    expect(clipOf(ev('action', 'hero-1', 'Blade uses Cleaving Blow on Giant Rat 1'))).toBe('Attack_Heavy')
    expect(clipOf(ev('action', 'hero-1', 'Blade uses Twin Cut on Giant Rat 2'))).toBe('Attack_Dual')
  })

  it('casters cast, bows shoot, buffs guard, items are handled', () => {
    expect(clipOf(ev('action', 'hero-2', 'Arcanist uses Ember Lance on Giant Rat 1'))).toBe('Cast')
    expect(clipOf(ev('action', 'hero-3', 'Ranger uses Aimed Shot on Giant Rat 1'))).toBe('Shoot')
    expect(clipOf(ev('action', 'hero-0', 'Warden uses Brace'))).toBe('Guard')
    expect(clipOf(ev('action', 'hero-0', 'Warden uses Small HP Potion'))).toBe('Interact')
  })

  it('basic attacks follow the weapon: the Ranger shoots, the Blade strikes with both, the Arcanist’s wand casts', () => {
    expect(clipOf(ev('action', 'hero-3', 'Ranger attacks Giant Rat 1'))).toBe('Shoot')
    expect(clipOf(ev('action', 'hero-1', 'Blade attacks Giant Rat 1'))).toBe('Attack_Dual')
    expect(clipOf(ev('action', 'hero-2', 'Arcanist attacks Giant Rat 1'))).toBe('Cast')
    expect(clipOf(ev('action', 'hero-0', 'Warden attacks Giant Rat 1'))).toBe('Attack_Light')
  })

  it('guarding, charging a cast, and the end of the fight', () => {
    expect(clipOf(ev('guard', 'hero-0', 'Warden guards'))).toBe('Guard')
    expect(clipOf(ev('charge', 'hero-2', 'Arcanist begins to cast Frost Floor'))).toBe('Cast')
    const end = beatsOf([ev('end', undefined, 'victory: all foes down', { outcome: 'victory' })], 0)[0]!
    const cues = beatAnims(end, fight, content)
    expect(cues.map((c) => c.clip)).toEqual(['Victory', 'Victory', 'Victory', 'Victory'])
    expect(cues.map((c) => c.actorId)).toEqual(['hero-0', 'hero-1', 'hero-2', 'hero-3'])
  })

  it('Phase 6: a monster swings Attack1 or Attack2 by its move’s weight, asking for the move’s own clip first; a pet its Attack1', () => {
    const def = content.monsters.get('giant-rat')!
    const rat = { id: 'giant-rat-1', name: 'Giant Rat 1', kind: 'monster', side: 'enemy', monster: { monsterId: 'giant-rat', attacks: def.attacks } } as unknown as Actor
    const pet = { id: 'pet-0', name: 'Pip', kind: 'pet', side: 'party', pet: { petId: 'cellar-hound', ownerId: 'hero-0' } } as unknown as Actor
    const f = { actors: [...party, rat, pet] } as unknown as FightState
    const bite = beatAnims(beatsOf([ev('action', 'giant-rat-1', 'Giant Rat 1 uses Bite on Warden')], 0)[0]!, f, content, 2)
    expect(bite).toEqual([{ kind: 'anim', actorId: 'giant-rat-1', clip: 'Attack1', alt: ['Bite'], speed: 2 }])
    const heavy = def.attacks.find((a) => a.weight > content.tuning.combat.weights.normal && a.multiplier > 0)
    if (heavy) expect(beatAnims(beatsOf([ev('action', 'giant-rat-1', `Giant Rat 1 uses ${heavy.name} on Warden`)], 0)[0]!, f, content)[0]!.clip).toBe('Attack2')
    expect(beatAnims(beatsOf([ev('action', 'pet-0', 'Pip uses Bite on Giant Rat 1')], 0)[0]!, f, content)[0]).toMatchObject({ actorId: 'pet-0', clip: 'Attack1' })
  })
})
