import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Actor, FightEvent, FightState } from '../../../sim/src/fight-types.ts'
import { buildHeroActor } from '../../../sim/src/hero.ts'
import { addHero, newProfile } from '../../../sim/src/town.ts'
import { loadContentDir } from '../../../tools/sim/loadContent.ts'
import { CLASS_FX_COLOUR, SCHOOL_SHAPE } from '../scene/vfx/recipes.ts'
import { beatFx } from './fightFx.ts'
import { beatsOf } from './fightView.ts'

/** Phase 6: the effects each beat of the fight log shows (sparks by damage type, element marks, heals, rings, Ultimates). */
const content = loadContentDir(path.resolve('content'))

function hero(classId: string, id: string): Actor {
  const rec = addHero(content, newProfile(7), { name: classId[0]!.toUpperCase() + classId.slice(1), speciesId: 'human', classId }).hero
  return buildHeroActor(content, content.tuning, rec, { id, row: 'front' })
}

const warden = hero('warden', 'hero-0')
const arcanist = hero('arcanist', 'hero-1')
const ratDef = content.monsters.get('giant-rat')!
const rat = { id: 'giant-rat-1', name: 'Giant Rat 1', kind: 'monster', side: 'enemy', monster: { monsterId: 'giant-rat', attacks: ratDef.attacks } } as unknown as Actor
const fight = { actors: [warden, arcanist, rat] } as unknown as FightState

function ev(kind: string, actorId: string | undefined, text: string, extra: Partial<FightEvent> = {}): FightEvent {
  return { tick: 0, round: 1, kind, ...(actorId ? { actorId } : {}), text, ...extra }
}

function fxOf(events: FightEvent[]): { actorId: string; fx?: string; color?: number; shape?: string; crit?: boolean }[] {
  const beat = beatsOf(events, 0)[0]!
  return beatFx(beat, fight, content).map((c) => ({ actorId: c.actorId, ...(c.fx ? { fx: c.fx } : {}), ...(c.color !== undefined ? { color: c.color } : {}), ...(c.shape ? { shape: c.shape } : {}), ...(c.crit ? { crit: true } : {}) }))
}

describe('the effects a beat shows', () => {
  it('a basic attack sparks by the weapon’s damage type; a crit says so', () => {
    const type = warden.hero!.weapon.damageType
    const cues = fxOf([ev('action', 'hero-0', 'Warden attacks Giant Rat 1', { targetId: 'giant-rat-1' }), ev('damage', 'hero-0', 'hit', { targetId: 'giant-rat-1', amount: 9, data: { crit: true } })])
    expect(cues).toEqual([{ actorId: 'giant-rat-1', fx: ['slash', 'pierce', 'blunt'].includes(type) ? type : expect.any(String), crit: true }])
  })

  it('a monster’s bite is its attack’s damage type (pierce)', () => {
    const bite = ratDef.attacks.find((a) => a.name === 'Bite')!
    const cues = fxOf([ev('action', 'giant-rat-1', 'Giant Rat 1 uses Bite on Warden', { targetId: 'hero-0' }), ev('damage', 'giant-rat-1', 'hit', { targetId: 'hero-0', amount: 4 })])
    expect(cues).toEqual([{ actorId: 'hero-0', fx: bite.damageType }])
  })

  it('a caster’s skill marks its element; heals glow; statuses ring the floor in their colour', () => {
    const skill = (content.skillsByClass.get('arcanist') ?? []).find((s) => s.effects.some((e) => e.kind === 'damage' && e.damageType === 'fire'))
    if (skill) {
      const cues = fxOf([ev('action', 'hero-1', `Arcanist uses ${skill.name} on Giant Rat 1`, { targetId: 'giant-rat-1' }), ev('damage', 'hero-1', 'hit', { targetId: 'giant-rat-1', amount: 12 }), ev('status', 'hero-1', 'burn', { targetId: 'giant-rat-1', data: { status: 'burn' } })])
      expect(cues[0]).toEqual({ actorId: 'giant-rat-1', fx: 'fire' })
      expect(cues[1]).toMatchObject({ actorId: 'giant-rat-1', fx: 'debuff' })
    }
    const heal = fxOf([ev('action', 'hero-1', 'Arcanist uses Small HP Potion'), ev('heal', 'hero-1', 'heal', { targetId: 'hero-0', amount: 20 }), ev('status', 'hero-1', 'haste', { targetId: 'hero-0', data: { status: 'haste' } })])
    expect(heal[0]).toEqual({ actorId: 'hero-0', fx: 'heal' })
    expect(heal[1]).toMatchObject({ actorId: 'hero-0', fx: 'buff' })
    expect(fxOf([ev('heal', 'hero-1', 'heal', { targetId: 'hero-0', amount: 0 })])).toEqual([])
  })

  it('damage over time shows its element (a Burn tick is fire, Poison green)', () => {
    expect(fxOf([ev('dot', 'giant-rat-1', 'burn', { amount: 3, data: { status: 'burn' } })])).toEqual([{ actorId: 'giant-rat-1', fx: 'fire', color: 0xff7a2a }])
    expect(fxOf([ev('dot', 'giant-rat-1', 'poison', { amount: 3, data: { status: 'poison' } })])[0]!.fx).toBe('poison')
  })

  it('an Ultimate opens with its class’s flourish: the class colour and its school’s shape', () => {
    const ult = (content.skillsByClass.get('warden') ?? []).find((s) => s.isUltimate)!
    const cues = fxOf([ev('action', 'hero-0', `Warden uses ${ult.name}`), ev('damage', 'hero-0', 'hit', { targetId: 'giant-rat-1', amount: 5 })])
    expect(cues[0]).toEqual({ actorId: 'hero-0', fx: 'ultimate', color: CLASS_FX_COLOUR.warden, shape: SCHOOL_SHAPE[ult.school] })
    expect(cues).toHaveLength(2)
  })

  it('a quiet beat shows nothing', () => {
    expect(fxOf([ev('guard', 'hero-0', 'Warden guards')])).toEqual([])
  })
})
