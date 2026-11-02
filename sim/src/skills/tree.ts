/**
 * Skill trees (Phase 18, D-153): every class's schools are the branches of its tree; a skill keeps its tier, opens at
 * that tier's level and needs its prerequisite in the branch. Skill points — 3 at creation (spent on the starter
 * picks), +1 per level-up — buy skills at I 1 · II 1 · III 2 · IV 2 · V 3; rank still grows by use. The other roads
 * (Insight, Tomes, the Hall, techniques by witnessing) cost no point. The Hall resets a tree for gold: every class
 * skill forgotten, every point of the hero's level back. Pure: records in, records out; the numbers in
 * `tuning.skills.points`.
 */
import type { Content } from '../content.ts'
import type { Tuning } from '../tuning.ts'
import type { ClassDef, HeroRecord, KnownSkill, Loadout, SkillDef } from '../types/content.ts'
import { tierOpenAt } from '../xp.ts'

export interface TreeBranch {
  readonly school: string
  readonly name: string
  readonly philosophy: string
  /** Five tiers, each the branch's skills of that tier in a stable order (the sheet's), the Ultimate aside. */
  readonly tiers: readonly (readonly SkillDef[])[]
}

export interface SkillStanding {
  readonly skillId: string
  readonly known: boolean
  readonly rank: number
  /** The point cost of its tier. */
  readonly cost: number
  /** Can be bought now with points. */
  readonly open: boolean
  /** Why not, when not: the tier's level, the missing prerequisite, the points short, the Tier V lock, the kind. */
  readonly reason: string | null
  readonly equipped: 'active' | 'passive' | null
}

/** The point cost of a tier (I 1 · II 1 · III 2 · IV 2 · V 3). */
export function pointCost(t: Tuning, tier: number): number {
  const c = t.skills.points.costByTier as Readonly<Record<string, number>>
  return c[String(tier)] ?? 1
}

/** The points a hero of this level has been given in all: the creation points plus one per level-up. */
export function pointsEarned(t: Tuning, level: number): number {
  return t.skills.points.atCreation + t.skills.points.perLevel * Math.max(0, level - 1)
}

/** The unspent points on a record; a record from before Phase 18 (no field) is read as all its level's points spent on what it knows, the rest unspent. */
export function pointsOf(content: Content, t: Tuning, hero: HeroRecord): number {
  if (typeof hero.skillPoints === 'number') return Math.max(0, hero.skillPoints)
  const spent = hero.skills.reduce((n, k) => n + (treeSkill(content, hero.classId, k.skillId)?.tier ? pointCost(t, treeSkill(content, hero.classId, k.skillId)!.tier) : 0), 0)
  return Math.max(0, pointsEarned(t, hero.level) - spent)
}

/** A class skill that sits in the tree (not a field, pet or monster skill, not the Ultimate). */
function treeSkill(content: Content, classId: string, skillId: string): SkillDef | null {
  const s = content.skills.get(skillId)
  if (!s || s.classId !== classId || s.isUltimate) return null
  return s
}

/** The class's tree: a branch per school, five tiers each, in the content's order. */
export function treeOf(content: Content, classId: string): TreeBranch[] {
  const cls = content.classes.get(classId)
  if (!cls) throw new Error(`no class ${classId}`)
  return cls.schools.map((school) => {
    const tiers: SkillDef[][] = [[], [], [], [], []]
    for (const s of content.skills.values()) {
      if (s.classId !== classId || s.school !== school.id || s.isUltimate) continue
      const row = tiers[s.tier - 1]
      if (row) row.push(s)
    }
    for (const row of tiers) row.sort((a, b) => (a.type === b.type ? a.id.localeCompare(b.id) : a.type === 'passive' ? 1 : -1))
    return { school: school.id, name: school.name, philosophy: school.philosophy, tiers }
  })
}

/** Where a hero stands with one skill: known, open to buy, or why not. */
export function standing(content: Content, t: Tuning, hero: HeroRecord, skillId: string): SkillStanding {
  const s = content.skills.get(skillId)
  if (!s) throw new Error(`no skill ${skillId}`)
  const known = hero.skills.find((k) => k.skillId === skillId)
  const cost = pointCost(t, s.tier)
  const equipped = hero.loadout.actives.includes(skillId) ? 'active' : hero.loadout.passives.includes(skillId) ? 'passive' : null
  const base = { skillId, known: !!known, rank: known?.rank ?? 0, cost, equipped } as const
  if (known) return { ...base, open: false, reason: null }
  if (s.classId !== hero.classId) return { ...base, open: false, reason: 'another class' }
  if (s.isUltimate) return { ...base, open: false, reason: 'the Ultimate comes with its tier' }
  if (s.monsterTechniqueOf) return { ...base, open: false, reason: 'a technique: learned by witnessing it' }
  if (s.tier > t.skills.obtainableTierMax.value) return { ...base, open: false, reason: 'Tier V opens with the endgame' }
  const open = tierOpenAt(t, hero.level)
  if (s.tier > open) return { ...base, open: false, reason: `Tier ${s.tier} opens at level ${(t.skills.tierOpensAtLevel as Readonly<Record<string, number>>)[String(s.tier)]}` }
  if (s.prerequisiteId && !hero.skills.some((k) => k.skillId === s.prerequisiteId)) return { ...base, open: false, reason: `needs ${content.skills.get(s.prerequisiteId)?.name ?? s.prerequisiteId}` }
  const points = pointsOf(content, t, hero)
  if (points < cost) return { ...base, open: false, reason: `needs ${cost} point${cost === 1 ? '' : 's'} (${points} left)` }
  return { ...base, open: true, reason: null }
}

/** Spends points on a skill: learned at rank 1, the cost taken. Throws with the standing's reason when it cannot be bought. */
export function spendPoints(content: Content, t: Tuning, hero: HeroRecord, skillId: string): HeroRecord {
  const st = standing(content, t, hero, skillId)
  if (!st.open) throw new Error(st.reason ?? 'cannot be bought')
  const known: KnownSkill = { skillId, rank: 1, xp: 0 }
  return { ...hero, skills: [...hero.skills, known], skillPoints: pointsOf(content, t, hero) - st.cost }
}

/** A level-up's points: +perLevel for each level gained (hero.ts applies it with the level). */
export function pointsForLevels(t: Tuning, levelsGained: number): number {
  return t.skills.points.perLevel * Math.max(0, levelsGained)
}

/**
 * The Hall's reset (D-153): every tree skill of the class forgotten — techniques (witnessed), the innate species skill
 * and field skills stay — the loadout cleared of them, and every point of the hero's level back.
 */
export function resetTree(content: Content, t: Tuning, hero: HeroRecord): HeroRecord {
  const keep = hero.skills.filter((k) => { const s = content.skills.get(k.skillId); return !s || s.classId !== hero.classId || s.isUltimate || !!s.monsterTechniqueOf })
  const forgotten = new Set(hero.skills.filter((k) => !keep.includes(k)).map((k) => k.skillId))
  const strip = (id: string | null) => (id && forgotten.has(id) ? null : id)
  const loadout: Loadout = { actives: [strip(hero.loadout.actives[0]), strip(hero.loadout.actives[1]), strip(hero.loadout.actives[2]), strip(hero.loadout.actives[3])], passives: [strip(hero.loadout.passives[0]), strip(hero.loadout.passives[1])], stance: hero.loadout.stance }
  return { ...hero, skills: keep, loadout, skillPoints: pointsEarned(t, hero.level) }
}

/** Puts a known skill in a loadout slot (an active in 0–3, a passive in 4–5), or clears the slot with null. */
export function equip(content: Content, hero: HeroRecord, slot: number, skillId: string | null): HeroRecord {
  if (skillId !== null) {
    const s = content.skills.get(skillId)
    if (!s) throw new Error(`no skill ${skillId}`)
    if (!hero.skills.some((k) => k.skillId === skillId)) throw new Error('not known')
    if (s.isUltimate) throw new Error('the Ultimate has its own button')
    if (slot < 4 && s.type === 'passive') throw new Error('a passive goes in a passive slot')
    if (slot >= 4 && s.type !== 'passive') throw new Error('an active goes in an active slot')
  }
  const actives = [...hero.loadout.actives] as [string | null, string | null, string | null, string | null]
  const passives = [...hero.loadout.passives] as [string | null, string | null]
  // One slot per skill: the same skill elsewhere is cleared.
  for (let i = 0; i < 4; i++) if (skillId !== null && actives[i] === skillId) actives[i] = null
  for (let i = 0; i < 2; i++) if (skillId !== null && passives[i] === skillId) passives[i] = null
  if (slot >= 0 && slot < 4) actives[slot] = skillId
  else if (slot >= 4 && slot < 6) passives[slot - 4] = skillId
  else throw new Error('no such slot')
  return { ...hero, loadout: { ...hero.loadout, actives, passives } }
}

/** The class record, for callers that show the tree's head. */
export function classOf(content: Content, classId: string): ClassDef {
  const cls = content.classes.get(classId)
  if (!cls) throw new Error(`no class ${classId}`)
  return cls
}
