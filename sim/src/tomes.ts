import type { Content } from './content.ts'
import { createItemInstance, newInstanceId } from './items.ts'
import type { Rng } from './rng.ts'
import { roundHalfUp } from './stats.ts'
import type { Tuning } from './tuning.ts'
import type { HeroRecord, ItemInstance, SkillDef } from './types/content.ts'
import { skillRankFor, skillRankThreshold } from './xp.ts'

/**
 * Skill Tomes as items (03 §7.5, §8.3; 08 §4, §10.2; Phase 7). One item def — content/items/tome/skill-tome.json — and
 * the skill on the instance (`ItemInstance.skillId`). An Insight teaches the hero and drops a Tome of the skill into the
 * party's loot; bosses' first kills, curios and Skill Tome chests give a Tome drawn from the class's bag for the tier;
 * a hero of the skill's class reads it in town: an unknown skill is learned at rank 1, a known one gains a rank's worth
 * of XP (a duplicate is never dead loot). Tomes are banked, carried and sold like any item (value by tier, 08 §4).
 *
 * What a Tome can never carry: Tier V (designed, locked until Segment 3's endgame, D-099), a monster technique (learned
 * only by witnessing its monster, 09 §4) and the field, pet and monster skills.
 */

const LITERAL_CLASSES: ReadonlySet<string> = new Set(['field', 'pet', 'monster'])

/** A class skill a hero can come by now (03 §7.2, D-099): not Tier V, not a technique whose monster is not in the game. */
export function isObtainable(t: Tuning, skill: SkillDef): boolean {
  return !LITERAL_CLASSES.has(skill.classId) && skill.tier <= t.skills.obtainableTierMax.value && skill.monsterTechniqueLater === undefined
}

/** A monster technique: learned only by witnessing its monster's move — never sold, never in a Tome (09 §4). */
export function isTechnique(skill: SkillDef): boolean {
  return skill.monsterTechniqueOf !== null || skill.monsterTechniqueLater !== undefined
}

/** A skill a Skill Tome may carry: an obtainable class skill that is not a technique (the Ultimate included — "the first zone-boss Tome"). */
export function isTomeSkill(t: Tuning, skill: SkillDef): boolean {
  return isObtainable(t, skill) && !isTechnique(skill)
}

/** The skills of the class at `tier` a Tome may teach that the hero does not know, in id order (08 §10.2's bag, fresh). */
export function tomeCandidates(content: Content, classId: string, tier: number, known: ReadonlySet<string>): string[] {
  const t = content.tuning
  // skillsByClass is sorted by tier, then id (content.ts), so the bag's order is the content's.
  return (content.skillsByClass.get(classId) ?? []).filter((s) => s.tier === tier && isTomeSkill(t, s) && !known.has(s.id)).map((s) => s.id)
}

/** Every skill of the class at `tier` a Tome may teach (known or not), in id order. */
export function tomeSkillsAtTier(content: Content, classId: string, tier: number): string[] {
  return tomeCandidates(content, classId, tier, new Set())
}

/** True when the instance is a Skill Tome (its def's kind is 'tome'). */
export function isTomeItem(content: Content, inst: ItemInstance): boolean {
  return content.items.get(inst.itemId)?.kind === 'tome'
}

/**
 * A Skill Tome of `skillId`. A content set without the Tome item (a test's hand-made slice) still gets a well-formed
 * instance under the tuning's item id, so a chest or a boss never fails on it.
 */
export function createTome(content: Content, rng: Rng, skillId: string): ItemInstance {
  const itemId = content.tuning.skills.tomes.itemId
  if (content.items.has(itemId)) return { ...createItemInstance(content, rng, itemId), skillId }
  return { instanceId: newInstanceId(rng), itemId, quantity: 1, affixes: [], plusN: 0, itemLevel: 1, itemXp: 0, affinities: [], durability: 100, maxDurability: 100, skillId }
}

/** The skill a Tome teaches; null when the instance is not a Tome or names a skill the content no longer has. */
export function tomeSkill(content: Content, inst: ItemInstance): SkillDef | null {
  if (!isTomeItem(content, inst) || inst.skillId === undefined) return null
  return content.skills.get(inst.skillId) ?? null
}

/** "Skill Tome: Shield Slam" (the bag and the bank show the skill, never a bare "Skill Tome"). */
export function tomeName(content: Content, inst: ItemInstance): string {
  const skill = tomeSkill(content, inst)
  return skill ? `Skill Tome: ${skill.name}` : (content.items.get(inst.itemId)?.name ?? inst.itemId)
}

/** A Tome's value in gold at the band's R (08 §4: the Skill Hall's prices by tier — I 0.1 · II 0.3 · III 1.0 R; IV at 3 R, the Grand Skill Tome chest's price). */
export function tomeValue(t: Tuning, tier: number, r: number): number {
  const table = t.skills.tomes.valueR as Readonly<Record<string, number>>
  const valueR = table[String(tier)] ?? table['1'] ?? 0
  return Math.max(1, roundHalfUp(valueR * r))
}

/** The gold value of any item instance for selling: a Tome by its skill's tier (08 §4), anything else its def's value. */
export function itemValue(content: Content, inst: ItemInstance, r: number): number {
  const skill = tomeSkill(content, inst)
  if (skill) return tomeValue(content.tuning, skill.tier, r)
  return content.items.get(inst.itemId)?.value ?? 0
}

export type TomeReadOutcome = { kind: 'learned'; skillId: string } | { kind: 'rankXp'; skillId: string; xp: number; ranksGained: number }

/** Rank XP a duplicate Tome gives: `skills.tomes.duplicateRanks` full ranks at the skill's current rank (03 §7.5; as the Tome of Practice, 08 §10.2). */
export function duplicateTomeXp(t: Tuning, rank: number): number {
  const ranks = Math.max(1, Math.round(t.skills.tomes.duplicateRanks.value))
  const top = Math.min(t.xp.skill.maxRank, rank + ranks)
  return Math.max(0, skillRankThreshold(t, top) - skillRankThreshold(t, rank))
}

/**
 * A hero reads a Tome of `skill` (03 §7.5): an unknown skill is learned at rank 1; a known one gains a duplicate's rank
 * XP. The caller checks the class and that the skill is not mastered (rank 10 gains nothing).
 */
export function readTomeOnHero(t: Tuning, hero: HeroRecord, skill: SkillDef): { hero: HeroRecord; outcome: TomeReadOutcome } {
  const known = hero.skills.find((k) => k.skillId === skill.id)
  if (!known) {
    const { [skill.id]: _seen, ...witness } = hero.techniqueWitness ?? {}
    void _seen
    return {
      hero: { ...hero, skills: [...hero.skills, { skillId: skill.id, rank: 1, xp: 0 }], ...(hero.techniqueWitness ? { techniqueWitness: witness } : {}) },
      outcome: { kind: 'learned', skillId: skill.id },
    }
  }
  const gain = duplicateTomeXp(t, known.rank)
  const xp = known.xp + gain
  const rank = Math.min(t.xp.skill.maxRank, Math.max(known.rank, skillRankFor(t, xp)))
  return {
    hero: { ...hero, skills: hero.skills.map((k) => (k.skillId === skill.id ? { ...k, xp, rank } : k)) },
    outcome: { kind: 'rankXp', skillId: skill.id, xp: gain, ranksGained: rank - known.rank },
  }
}

/** Why `hero` cannot read the Tome now, or null when they can (the town's Read button shows the reason). */
export function tomeReadBlocker(content: Content, hero: HeroRecord, inst: ItemInstance): string | null {
  const skill = tomeSkill(content, inst)
  if (!skill) return 'This Tome teaches nothing the game knows.'
  if (skill.classId !== hero.classId) return `Only a ${content.classes.get(skill.classId)?.name ?? skill.classId} can read it.`
  const known = hero.skills.find((k) => k.skillId === skill.id)
  if (known && known.rank >= content.tuning.xp.skill.maxRank) return `${hero.name} has mastered ${skill.name}.`
  return null
}
