/**
 * Phase 18 (D-153, D-154): skill trees — points at creation and per level, what a point buys and why not, the Hall's
 * reset, the loadout slots, the Arcanist's four branches with their six summons, and the bridge's tree and hero calls.
 */
import { describe, expect, it } from 'vitest'
import { loadContentDir, readContentFiles } from '../../tools/sim/loadContent.ts'
import * as bridge from '../src/bridge.ts'
import { applyBattleXpLevel, createHero, heroAtLevel } from '../src/hero.ts'
import { Rng } from '../src/rng.ts'
import { equip, pointCost, pointsEarned, pointsOf, resetTree, spendPoints, standing, treeOf } from '../src/skills/tree.ts'
import { battleXpForLevel } from '../src/xp.ts'

const content = loadContentDir('content')
const t = content.tuning
const fresh = (classId = 'arcanist') => createHero(content, t, Rng.fromSeed(3), { id: 'h', name: 'H', speciesId: 'human', classId, freePoints: { wisdom: 2, vitality: 2, endurance: 2 } })

describe('skill points (D-153)', () => {
  it('a new hero spent its three creation points on the three starter picks; a level-up gives one', () => {
    const h = fresh()
    expect(pointsEarned(t, 1)).toBe(3)
    expect(h.skillPoints).toBe(0)
    expect(pointsOf(content, t, h)).toBe(0)
    const up = applyBattleXpLevel(content, t, { ...h, battleXp: battleXpForLevel(t, 4) })
    expect(up.level).toBe(4)
    expect(up.skillPoints).toBe(3)
    expect(pointsOf(content, t, heroAtLevel(content, t, h, 10))).toBe(9)
  })

  it('a record from before Phase 18 reads its points as its level less what it knows', () => {
    const h = fresh()
    const { skillPoints: _drop, ...old } = h
    expect(pointsOf(content, t, { ...old, level: 5 })).toBe(7 - 3)
  })

  it('costs I 1 · II 1 · III 2 · IV 2 · V 3', () => {
    expect([1, 2, 3, 4, 5].map((n) => pointCost(t, n))).toEqual([1, 1, 2, 2, 3])
  })

  it('a point buys a Tier I skill; the tier, the prerequisite, the points and the Tier V lock say no', () => {
    const h = { ...fresh(), skillPoints: 2 }
    // Cinder Snap: Tier I Fire, no prerequisite.
    expect(standing(content, t, h, 'arcanist-cinder-snap').open).toBe(true)
    const bought = spendPoints(content, t, h, 'arcanist-cinder-snap')
    expect(bought.skills.some((k) => k.skillId === 'arcanist-cinder-snap' && k.rank === 1)).toBe(true)
    expect(bought.skillPoints).toBe(1)
    expect(standing(content, t, bought, 'arcanist-cinder-snap').reason).toBeNull()
    expect(standing(content, t, bought, 'arcanist-cinder-snap').known).toBe(true)
    // Firewave: Tier II opens at level 5.
    expect(standing(content, t, bought, 'arcanist-firewave').reason).toMatch(/Tier 2 opens at level 5/)
    const l5 = { ...heroAtLevel(content, t, bought, 5), skillPoints: 5 }
    expect(standing(content, t, l5, 'arcanist-firewave').open).toBe(true)
    // Flame Ward needs Cinder Snap (known) — open; Glacier Spike needs Frostbolt (a starter) — open; Arc Chain needs Spark — not known.
    expect(standing(content, t, l5, 'arcanist-flame-ward').open).toBe(true)
    expect(standing(content, t, l5, 'arcanist-arc-chain').reason).toMatch(/needs Spark/)
    // Points short.
    expect(standing(content, t, { ...l5, skillPoints: 0 }, 'arcanist-firewave').reason).toMatch(/needs 1 point/)
    // Tier V is locked; a technique is witnessed; another class says no.
    const l40 = { ...heroAtLevel(content, t, bought, 40), skillPoints: 40 }
    expect(standing(content, t, l40, 'arcanist-sunflare').reason).toMatch(/Tier V/)
    expect(standing(content, t, l40, 'arcanist-hags-cauldron').reason).toMatch(/technique/)
    expect(standing(content, t, l40, 'warden-aegis-of-the-keep').reason).toBe('another class')
    expect(() => spendPoints(content, t, h, 'arcanist-firewave')).toThrow()
  })

  it("the Hall's reset forgets the tree and gives the level's points back; the loadout drops what it forgot", () => {
    const h = { ...heroAtLevel(content, t, fresh(), 6), skillPoints: 5 }
    const grown = spendPoints(content, t, spendPoints(content, t, h, 'arcanist-cinder-snap'), 'arcanist-firewave')
    const reset = resetTree(content, t, grown)
    expect(reset.skills.filter((k) => content.skills.get(k.skillId)?.classId === 'arcanist').length).toBe(0)
    expect(reset.skillPoints).toBe(pointsEarned(t, 6))
    expect(reset.loadout.actives.every((a) => a === null)).toBe(true)
  })

  it('equips a known active or passive in its kind of slot, one slot per skill', () => {
    const h = spendPoints(content, t, { ...fresh(), skillPoints: 1 }, 'arcanist-kindling')
    const e = equip(content, h, 4, 'arcanist-kindling')
    expect(e.loadout.passives[0]).toBe('arcanist-kindling')
    expect(() => equip(content, h, 0, 'arcanist-kindling')).toThrow(/passive/)
    expect(() => equip(content, h, 1, 'arcanist-firewave')).toThrow(/not known/)
    const moved = equip(content, e, 3, 'arcanist-ember-lance')
    expect(moved.loadout.actives[3]).toBe('arcanist-ember-lance')
    expect(moved.loadout.actives.filter((a) => a === 'arcanist-ember-lance').length).toBe(1)
    expect(equip(content, moved, 3, null).loadout.actives[3]).toBeNull()
  })
})

describe("the Arcanist's four branches (D-154)", () => {
  it('Fire · Frost · Storm · Summoning, fifteen skills each, three a tier, every prerequisite one tier down in its branch', () => {
    const tree = treeOf(content, 'arcanist')
    expect(tree.map((b) => b.school)).toEqual(['fire', 'frost', 'storm', 'summoning'])
    for (const b of tree) {
      expect(b.tiers.map((row) => row.length)).toEqual([3, 3, 3, 3, 3])
      for (const row of b.tiers) for (const s of row) {
        if (s.tier === 1) expect(s.prerequisiteId).toBeNull()
        else {
          const p = content.skills.get(s.prerequisiteId!)!
          expect(p.school).toBe(b.school)
          expect(p.tier).toBe(s.tier - 1)
        }
      }
    }
    const summons = [...content.skills.values()].filter((s) => s.classId === 'arcanist' && s.summon)
    expect(summons.map((s) => s.summon!.creature).sort()).toEqual(['bog-serpent', 'dawn-warden', 'ember-imp', 'night-maw', 'rime-stag', 'storm-hawk'])
    for (const s of summons) expect(s.weight).toBe(1400)
    // The other classes keep three branches of fifteen.
    for (const id of ['warden', 'blade', 'mender', 'ranger', 'shade']) expect(treeOf(content, id).map((b) => b.tiers.flat().length)).toEqual([15, 15, 15])
  })
})

describe('the bridge (Phase 18)', () => {
  it('tells the tree and spends a test hero’s points', () => {
    bridge.init(JSON.stringify(readContentFiles('content')))
    const tree = JSON.parse(bridge.tree('arcanist')) as { branches: { school: string; tiers: { tier: number; skills: { id: string; summon: string }[] }[] }[] }
    expect(tree.branches.length).toBe(4)
    expect(tree.branches[3]!.tiers[0]!.skills.some((s) => s.summon === 'Ember Imp')).toBe(true)
    const h = bridge.heroMake(JSON.stringify({ classId: 'arcanist', speciesId: 'elf', level: 6 }))
    let v = JSON.parse(bridge.heroView(h)) as { level: number; points: number; standings: { skillId: string; open: boolean; known: boolean }[] }
    expect(v.level).toBe(6)
    expect(v.points).toBe(5)
    expect(v.standings.find((s) => s.skillId === 'arcanist-cinder-snap')?.open).toBe(true)
    v = JSON.parse(bridge.heroSpend(h, 'arcanist-cinder-snap'))
    expect(v.points).toBe(4)
    expect(v.standings.find((s) => s.skillId === 'arcanist-cinder-snap')?.known).toBe(true)
    expect(() => bridge.heroSpend(h, 'arcanist-sunflare')).toThrow()
    v = JSON.parse(bridge.heroReset(h))
    expect(v.points).toBe(8)
    v = JSON.parse(bridge.heroLevel(h, 12))
    expect(v.level).toBe(12)
    expect(JSON.stringify(v)).not.toContain(':null')
    bridge.heroDispose(h)
  })
})
