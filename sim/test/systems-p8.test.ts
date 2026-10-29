import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentDir } from '../../tools/sim/loadContent.ts'
import { parseRule } from '../src/ai.ts'
import { autoEquipBest, setBonusScore } from '../src/armory.ts'
import { createDelve, partyDetection, runDelveAuto } from '../src/delve.ts'
import type { DelveOptions } from '../src/delve-types.ts'
import { applyFightCommand, createFight, runFight } from '../src/fight.ts'
import type { Actor, FightState } from '../src/fight-types.ts'
import { buildHeroActor, createHero, heroCardStats, heroDetection, heroStats } from '../src/hero.ts'
import { createItemInstance } from '../src/items.ts'
import { buildMonsterActor } from '../src/monsters.ts'
import { gainFieldSkillXp, trainCartography } from '../src/progress.ts'
import { Rng } from '../src/rng.ts'
import { addHero, heroOf, newProfile, type Profile } from '../src/town.ts'
import type { HeroRecord, ItemInstance } from '../src/types/content.ts'
import { skillRankThreshold } from '../src/xp.ts'

/**
 * Phase 8, pass D — systems polish: field skills grow by use (Cartography maps, the XP reaches rank), the hero card's
 * Detection counts the loadout passives as the delve does, auto-equip weighs set bonuses, and each class's default AI
 * rule names the relics that suit it.
 */
const content = loadContentDir(path.resolve('content'))
const t = content.tuning

const options = (over: Partial<DelveOptions> = {}): DelveOptions => ({ dungeonId: 'gravehollow-keep', floor: 1, lastFloor: 1, seed: 17, difficulty: 'normal', pactIds: [], auto: true, policy: 'textbook', deathRule: 'sheltered', ...over })

function record(id: string, classId: string, passives: string[] = []): HeroRecord {
  const r = createHero(content, t, Rng.fromSeed(5), { id, name: id, speciesId: 'human', classId, eggPetId: null })
  const extra = passives.filter((s) => !r.skills.some((k) => k.skillId === s))
  return { ...r, skills: [...r.skills, ...extra.map((skillId) => ({ skillId, rank: 1, xp: 0 }))], loadout: { ...r.loadout, passives: [...passives, null, null].slice(0, 2) as never } }
}

describe('field skills grow by use (03 §5.2: "each successful use … the same rank curve")', () => {
  it('XP reaches rank on the skill curve; a starting rank keeps its head start; rank 10 is the top', () => {
    const h = record('w', 'warden')
    const at = (rank: number, xp: number): HeroRecord => ({ ...h, fieldSkills: { ...h.fieldSkills, cartography: { rank, xp } } })
    // Rank 1 → 2 at 150 XP (100 × 1.5).
    expect(gainFieldSkillXp(t, at(1, 0), 'cartography', 149).hero.fieldSkills.cartography).toEqual({ rank: 1, xp: 149 })
    expect(gainFieldSkillXp(t, at(1, 140), 'cartography', 10)).toMatchObject({ ranks: 1, hero: { fieldSkills: { cartography: { rank: 2, xp: 150 } } } })
    // An Arcanist's starting 3 has no XP behind it: the gain counts from rank 3's threshold (225), so rank 4 (338) is 113 away.
    const start = gainFieldSkillXp(t, at(3, 0), 'cartography', 10).hero.fieldSkills.cartography
    expect(start).toEqual({ rank: 3, xp: skillRankThreshold(t, 3) + 10 })
    expect(gainFieldSkillXp(t, at(3, start.xp), 'cartography', skillRankThreshold(t, 4) - start.xp).hero.fieldSkills.cartography.rank).toBe(4)
    expect(gainFieldSkillXp(t, at(10, 5000), 'cartography', 500).hero.fieldSkills.cartography.rank).toBe(10)
    expect(gainFieldSkillXp(t, at(2, 150), 'trapDisarm', 0).ranks).toBe(0)
  })

  it('Cartography: every room entered for the first time pays the best cartographer xpPerUse × D (fix: it never trained)', () => {
    const party = [record('w', 'warden'), record('a', 'arcanist')]
    expect(party[1]!.fieldSkills.cartography.rank).toBe(3)
    const end = runDelveAuto(content, createDelve(content, options(), party), 3000)
    const rooms = end.stats.rooms
    expect(rooms).toBeGreaterThan(2)
    // Level 1 on a level-1 floor: D = 1.0, 10 XP a room (a level gained on the way lowers D a little).
    const gained = end.heroes[1]!.record.fieldSkills.cartography.xp - skillRankThreshold(t, 3)
    expect(gained).toBeGreaterThan(t.xp.skill.xpPerUse * (rooms - 2))
    expect(gained).toBeLessThanOrEqual(t.xp.skill.xpPerUse * rooms)
    // The Warden draws no map while the Arcanist's is better.
    expect(end.heroes[0]!.record.fieldSkills.cartography).toEqual(party[0]!.fieldSkills.cartography)
  })

  it('trainCartography: the best rank maps (the first on a tie), xpPerUse × D within the gate and the use budget', () => {
    const s = createDelve(content, { ...options(), auto: false }, [record('w', 'warden'), record('a', 'arcanist'), record('r', 'ranger')])
    const xp = (i: number) => s.heroes[i]!.record.fieldSkills.cartography.xp
    // The entry room was mapped already: the Arcanist's starting 3 counts from rank 3's threshold.
    expect(xp(1)).toBe(skillRankThreshold(t, 3) + 10)
    let was = xp(1)
    // Ranks as the delve reads them: the Arcanist's 3 beats the Ranger's 2.
    expect(trainCartography(t, s, [1, 3, 2], 1)).toBe(1)
    expect(xp(1) - was).toBe(10)
    // A tie goes to the first in the party; after 20 uses the use budget halves the pay.
    expect(trainCartography(t, s, [2, 2, 2], 1)).toBe(0)
    s.heroes[1]!.skillUses['field:cartography'] = 20
    was = xp(1)
    expect(trainCartography(t, s, [1, 3, 2], 1)).toBe(1)
    expect(xp(1) - was).toBe(5)
    // D: a floor two levels above the hero pays more than 10; one far below the hero (under the gate) pays nothing.
    was = Math.max(xp(2), skillRankThreshold(t, 2))
    expect(trainCartography(t, s, [0, 0, 5], 3)).toBe(2)
    expect(xp(2) - was).toBeGreaterThan(10)
    s.heroes[0]!.record = { ...s.heroes[0]!.record, level: 20 }
    expect(trainCartography(t, s, [9, 0, 0], 1)).toBe(-1)
  })

  it('a long walk raises the rank; Blind Map (no Cartography) trains nothing', () => {
    const solo = [record('w', 'warden')]
    const end = runDelveAuto(content, createDelve(content, options({ lastFloor: 3 }), solo), 3000)
    const c = end.heroes[0]!.record.fieldSkills.cartography
    expect(c.xp).toBeGreaterThan(0)
    if (end.stats.rooms >= 15) expect(c.rank).toBeGreaterThan(1)
    const blind = runDelveAuto(content, createDelve(content, options({ pactIds: ['blind-map'] }), solo), 3000)
    expect(blind.heroes[0]!.record.fieldSkills.cartography).toEqual(solo[0]!.fieldSkills.cartography)
  })
})

describe("the hero card's Detection counts the loadout passives, as the delve does (fix: heroStats left them out)", () => {
  it('Keen Eyes: the card shows +3, and the party Detection is the card plus the light (radiant +4)', () => {
    const plain = record('r', 'ranger')
    const keen = record('r', 'ranger', ['ranger-keen-eyes'])
    expect(heroCardStats(content, t, plain).detection).toBe(heroStats(content, t, plain).detection)
    expect(heroCardStats(content, t, keen).detection).toBe(heroStats(content, t, keen).detection + 3)
    expect(heroDetection(content, t, keen)).toBe(heroCardStats(content, t, keen).detection)
    for (const r of [plain, keen]) {
      const s = createDelve(content, { ...options({ light: 100 }), auto: false }, [r])
      expect(partyDetection(content, t, s)).toBe(heroCardStats(content, t, r).detection + 4)
    }
  })
})

describe('auto-equip weighs set bonuses (08 §6)', () => {
  function warden(): Profile {
    return addHero(content, newProfile(7), { name: 'W', speciesId: 'human', classId: 'warden', eggPetId: 'cellar-hound' }).profile
  }
  function give(p: Profile, itemId: string, instanceId: string): Profile {
    const inst: ItemInstance = createItemInstance(content, Rng.fromSeed(1), itemId, { instanceId })
    return { ...p, armory: [...p.armory, inst] }
  }
  const id = (p: Profile) => p.heroes[0]!.id

  it("the Vigil's two pieces beat their plain twins: the 2-piece bonus tips equal scores", () => {
    let p = warden()
    p = give(p, 'iron-helm', 'plain-helm')
    p = give(p, 'iron-breastplate', 'plain-chest')
    p = give(p, 'barrow-wardens-helm', 'set-helm')
    p = give(p, 'barrow-wardens-breastplate', 'set-chest')
    const after = heroOf(autoEquipBest(content, p, id(p)), id(p))
    expect(after.equipment.helmet?.instanceId).toBe('set-helm')
    expect(after.equipment.chest?.instanceId).toBe('set-chest')
    expect(setBonusScore(content, after, 'barrow-wardens-vigil', '2')).toBe(4 * 5 + 2 * t.equipment.sets.autoEquipLineScore.value)
  })

  it('one set piece alone switches nothing on, so the plain best stays; much better gear outweighs the bonus', () => {
    let p = warden()
    p = give(p, 'iron-helm', 'plain-helm')
    p = give(p, 'barrow-wardens-breastplate', 'set-chest')
    p = give(p, 'iron-breastplate', 'plain-chest')
    const one = heroOf(autoEquipBest(content, p, id(p)), id(p))
    // Equal scores, no bonus within reach: the first of the armory wins as before (set-chest was given first).
    expect(one.equipment.helmet?.instanceId).toBe('plain-helm')
    expect(one.equipment.chest?.instanceId).toBe('set-chest')
    let q = warden()
    q = give(q, 'blacksteel-helm', 'b-helm')
    q = give(q, 'blacksteel-breastplate', 'b-chest')
    q = give(q, 'barrow-wardens-helm', 'set-helm')
    q = give(q, 'barrow-wardens-breastplate', 'set-chest')
    const b = heroOf(autoEquipBest(content, q, id(q)), id(q))
    expect(b.equipment.helmet?.instanceId).toBe('b-helm')
    expect(b.equipment.chest?.instanceId).toBe('b-chest')
  })

  it('auto-equip twice changes nothing the second time', () => {
    let p = warden()
    for (const [item, inst] of [['barrow-wardens-helm', 's1'], ['barrow-wardens-greaves', 's2'], ['barrow-wardens-sabatons', 's3'], ['barrow-wardens-gauntlets', 's4'], ['steel-breastplate', 'c1']] as const) p = give(p, item, inst)
    const once = autoEquipBest(content, p, id(p))
    expect(autoEquipBest(content, once, id(once))).toBe(once)
    // Four Vigil pieces switch both bonuses on; the C breastplate takes the chest.
    const h = heroOf(once, id(once))
    expect([h.equipment.helmet, h.equipment.legs, h.equipment.boots, h.equipment.gloves].map((i) => i?.instanceId)).toEqual(['s1', 's2', 's3', 's4'])
    expect(h.equipment.chest?.instanceId).toBe('c1')
  })
})

describe("each class's default AI rule names the relics that suit it (08 §3)", () => {
  it('every default parses cleanly, and every item it names is a consumable or a relic in the content', () => {
    for (const cls of content.classes.values()) {
      const rule = parseRule(cls.aiRuleDefault)
      expect(rule.errors, cls.id).toEqual([])
      const items = rule.clauses.filter((c) => c.action.verb === 'item').map((c) => c.action.ref!)
      const relics = items.filter((ref) => content.items.get(ref.replace(/\s+/g, '-'))?.kind === 'relic')
      expect(relics.length, cls.id).toBeGreaterThan(0)
      for (const ref of items) expect(content.items.has(ref.replace(/\s+/g, '-')), `${cls.id}: ${ref}`).toBe(true)
    }
  })

  /** A fight against three rats; the heroes under a human until `who` is up. */
  function fightUntil(records: HeroRecord[], who: number, hurt: (a: Actor[]) => void): { fight: FightState; me: Actor } {
    const heroes = records.map((r, i) => buildHeroActor(content, t, r, { id: `hero-${i}`, row: i === 0 ? 'front' : 'back' }))
    const rat = content.monsters.get('giant-rat')!
    const monsters = ['a', 'b', 'c'].map((s, i) => buildMonsterActor(content, t, rat, { id: `rat-${s}`, level: 1, row: i === 0 ? 'front' : 'back', hpPercent: 100 }))
    const fight = createFight(content, t, { heroes, pets: [], monsters, surprised: 'enemy', light: 100, options: { dungeonId: 'gravehollow-keep', floor: 1, floorLevel: 1 }, rng: Rng.fromSeed(11) })
    runFight(content, t, fight)
    hurt(heroes)
    for (let guard = 0; guard < 10 && fight.pendingActorId !== heroes[who]!.id && !fight.over; guard++) {
      applyFightCommand(content, t, fight, { kind: 'guard' })
      runFight(content, t, fight)
    }
    return { fight, me: heroes[who]! }
  }
  const wearing = (r: HeroRecord, relicId: string | null): HeroRecord => ({ ...r, equipment: { ...r.equipment, relic: relicId ? createItemInstance(content, Rng.fromSeed(1), relicId, { instanceId: `r-${relicId}` }) : null } })

  it("the Warden rings the Barrow Bell when an ally is hurt; without it the rule goes on to the Warden's skills", () => {
    const hurt = (a: Actor[]) => {
      a[1]!.hp = Math.floor(a[1]!.maxHp / 3)
    }
    const { fight, me } = fightUntil([wearing(record('w', 'warden'), 'the-barrow-bell'), record('b', 'blade')], 0, hurt)
    expect(fight.pendingActorId).toBe(me.id)
    applyFightCommand(content, t, fight, { kind: 'auto' })
    expect(me.hero!.relicUsesLeft).toBe(0)
    const plain = fightUntil([wearing(record('w', 'warden'), null), record('b', 'blade')], 0, hurt)
    expect(plain.fight.pendingActorId).toBe(plain.me.id)
    applyFightCommand(content, t, plain.fight, { kind: 'auto' })
    expect(plain.fight.log.some((e) => e.actorId === plain.me.id && e.kind === 'action')).toBe(true)
  })

  it("the Mender lights the Candle of the Crypt when the party's HP falls under 75%", () => {
    const { fight, me } = fightUntil([record('w', 'warden'), wearing(record('m', 'mender'), 'candle-of-the-crypt')], 1, (a) => {
      for (const h of a) h.hp = Math.floor((h.maxHp * 70) / 100)
    })
    expect(fight.pendingActorId).toBe(me.id)
    applyFightCommand(content, t, fight, { kind: 'auto' })
    expect(me.hero!.relicUsesLeft).toBe(0)
  })
})
