import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { partyPetTraitBonus } from '../src/pets.ts'
import type { PetInstance } from '../src/types/content.ts'

// The shipped content: sixteen pets whose traits the delve reads outside fights (06 §9).
const content = loadContentDir(path.resolve('content'))

function pet(petId: string): PetInstance {
  return { instanceId: `i-${petId}`, petId, name: petId, grade: 'F', level: 1, xp: 0, bondStars: 0, stance: 'guard', hpPercent: 100 } as unknown as PetInstance
}

describe('pet trait bonuses outside the fight (06 §9, D-069)', () => {
  it('reads the best single bonus of each kind, never the sum', () => {
    const party = [pet('spiderling'), pet('wisp'), pet('cave-owl'), null]
    expect(partyPetTraitBonus(content, party, 'detection')).toBe(5)
    expect(partyPetTraitBonus(content, party, 'scouting')).toBe(15)
    expect(partyPetTraitBonus(content, party, 'scoutBandShift')).toBe(-1)
    expect(partyPetTraitBonus(content, party, 'goldPercent')).toBe(0)
  })

  it('reads gold and lockpicking from the Vault Imp and nothing from a hound', () => {
    expect(partyPetTraitBonus(content, [pet('vault-imp'), pet('rat-prince')], 'goldPercent')).toBe(10)
    expect(partyPetTraitBonus(content, [pet('vault-imp')], 'lockpicking')).toBe(2)
    expect(partyPetTraitBonus(content, [pet('cellar-hound')], 'detection')).toBe(0)
    expect(partyPetTraitBonus(content, [], 'scouting')).toBe(0)
  })
})
