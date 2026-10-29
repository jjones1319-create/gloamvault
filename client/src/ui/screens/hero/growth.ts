import type { Content } from '../../../../../sim/src/content.ts'
import { speciesRules } from '../../../../../sim/src/hero.ts'
import { roundHalfUp } from '../../../../../sim/src/stats.ts'
import type { Tuning } from '../../../../../sim/src/tuning.ts'
import type { HeroRecord, SkillDef } from '../../../../../sim/src/types/content.ts'
import { FIELD_SKILLS, TRAINABLE_ATTRIBUTES, type Attribute, type FieldSkill, type TrainableAttribute } from '../../../../../sim/src/types/enums.ts'
import { attributePointCost, attributeSoftCap, skillRankThreshold, useXp } from '../../../../../sim/src/xp.ts'
import { ATTRIBUTE_NAME, FIELD_SKILL_NAME } from './labels.ts'

/**
 * The status screen's growth lines (03 §5; 12 Phase 8, pass B): how each attribute, loadout skill and field skill grows
 * by use, and how close its next point or rank is — "Strength 12 → 13: about 14 more melee hits or uses of Shield
 * Slam". Counted at an even fight with the hero's own XP bonus (Wisdom, the Human bonus) and a full per-delve budget;
 * every number reads the counters the sim keeps (attributeXp in hundredths, skill and field-skill XP) and the curves in
 * tuning (xp.ts). Pure, tested in node.
 */

export interface GrowthLine {
  key: string
  name: string
  /** "12 → 13", "rank 2 → 3", "rank 10". */
  step: string
  /** 0–100 toward the next point or rank; null when it never grows by use or is at the top. */
  percent: number | null
  /** The plain line: "about 14 more melee hits or uses of Shield Slam". */
  text: string
}

/** What trains each attribute as the fight records it (sim/src/fight.ts; 03 §2.1's "How it trains"). */
const ATTRIBUTE_USE: Readonly<Record<TrainableAttribute, string>> = {
  strength: 'melee hits',
  agility: 'hits landed',
  vitality: 'heavy blows taken (each a tenth of your HP)',
  endurance: 'hits taken',
  wisdom: 'spells or heals',
  perception: 'ranged hits',
  willpower: 'statuses shrugged off',
}

/** What counts as a use of each field skill (03 §5.2: lockpick, disarm, forage, repair, haggle, first aid, cook, map). */
const FIELD_USE: Readonly<Record<FieldSkill, string>> = {
  lockpicking: 'lock picked',
  trapDisarm: 'trap disarmed',
  foraging: 'find foraged',
  fieldRepair: 'repair in the field',
  firstAid: 'wound patched',
  haggling: 'deal haggled',
  cooking: 'meal cooked',
  cartography: 'floor mapped',
}

/** The extra XP percent on every use in town terms (sim/src/progress.ts heroExtraPercent with no preset or Pact). */
export function heroXpBonusPercent(content: Content, t: Tuning, hero: HeroRecord): number {
  const species = content.species.get(hero.speciesId)
  const mult = species ? (speciesRules(species).xpMultiplier ?? 1) : 1
  const wis = 1 + (t.xp.wisdomPercentPerPoint * (hero.attributes.wisdom - 10)) / 100
  return roundHalfUp((mult * Math.max(0.5, wis) - 1) * 100)
}

function pct(into: number, need: number): number {
  return need > 0 ? Math.max(0, Math.min(100, Math.floor((into * 100) / need))) : 0
}

/** "Shield Slam", "Shield Slam or Provoke": the loadout actives that train an attribute (their xpTags). */
function trainingSkills(content: Content, hero: HeroRecord, attr: Attribute): string {
  const names = hero.loadout.actives
    .map((id) => (id ? content.skills.get(id) : undefined))
    .filter((s): s is SkillDef => s !== undefined && (s.xpTags as readonly string[]).includes(attr))
    .map((s) => s.name)
  return names.slice(0, 2).join(' or ')
}

/** One line per attribute: Luck never trains; the others count uses to the next point (03 §5.2, the soft cap). */
export function attributeGrowthLines(content: Content, t: Tuning, hero: HeroRecord): GrowthLine[] {
  const bonus = heroXpBonusPercent(content, t, hero)
  const perUse = roundHalfUp(t.xp.attribute.xpPerTag * (100 + bonus))
  const out: GrowthLine[] = []
  for (const attr of TRAINABLE_ATTRIBUTES) {
    const now = hero.attributes[attr]
    const into = hero.attributeXp[attr] ?? 0
    const need = attributePointCost(t, now + 1) * 100
    const cap = attributeSoftCap(t, hero.creationValues[attr], hero.level)
    const above = now >= cap
    const each = above ? Math.floor(perUse / t.xp.attribute.aboveCapDivisor) : perUse
    const uses = each > 0 ? Math.max(1, Math.ceil((need - into) / each)) : null
    const skills = trainingSkills(content, hero, attr)
    const what = `${ATTRIBUTE_USE[attr]}${skills ? ` or uses of ${skills}` : ''}`
    out.push({
      key: attr,
      name: ATTRIBUTE_NAME[attr],
      step: `${now} → ${now + 1}`,
      percent: pct(into, need),
      text: `${uses === null ? 'grows with' : `about ${uses} more`} ${what}${above ? ` (past its soft cap of ${cap} it grows a quarter as fast)` : ''}`,
    })
  }
  out.push({ key: 'luck', name: ATTRIBUTE_NAME.luck, step: `${hero.attributes.luck}`, percent: null, text: 'never grows by use: +1 for each dungeon’s final boss you first defeat' })
  return out
}

/** One line per known loadout active and the Ultimate: uses to the next rank (03 §5.2: 100 × 1.5^(N−1) XP), or mastered. */
export function skillGrowthLines(content: Content, t: Tuning, hero: HeroRecord): GrowthLine[] {
  const bonus = heroXpBonusPercent(content, t, hero)
  const perUse = useXp(t, t.xp.skill.xpPerUse, hero.level, hero.level, 0, bonus)
  const max = t.xp.skill.maxRank
  const ids = [...hero.loadout.actives.filter((id): id is string => id !== null)]
  const ult = hero.skills.find((k) => content.skills.get(k.skillId)?.isUltimate)
  if (ult) ids.push(ult.skillId)
  const out: GrowthLine[] = []
  for (const id of [...new Set(ids)]) {
    const known = hero.skills.find((k) => k.skillId === id)
    const def = content.skills.get(id)
    if (!known || !def) continue
    if (known.rank >= max) {
      out.push({ key: id, name: def.name, step: `rank ${known.rank}`, percent: null, text: 'mastered: its Mastery line is on' })
      continue
    }
    const from = skillRankThreshold(t, known.rank)
    const to = skillRankThreshold(t, known.rank + 1)
    const uses = perUse > 0 ? Math.max(1, Math.ceil((to - known.xp) / perUse)) : null
    out.push({ key: id, name: def.name, step: `rank ${known.rank} → ${known.rank + 1}`, percent: pct(known.xp - from, to - from), text: uses === null ? 'grows with use' : `about ${uses} more use${uses === 1 ? '' : 's'}` })
  }
  return out
}

/** One line per field skill: its XP toward the next rank on the same curve as skills (03 §5.2). */
export function fieldSkillGrowthLines(t: Tuning, hero: HeroRecord): GrowthLine[] {
  const max = t.xp.skill.maxRank
  return FIELD_SKILLS.map((f) => {
    const s = hero.fieldSkills[f] ?? { rank: 1, xp: 0 }
    if (s.rank >= max) return { key: f, name: FIELD_SKILL_NAME[f], step: `rank ${s.rank}`, percent: null, text: 'mastered' }
    const from = skillRankThreshold(t, s.rank)
    const to = skillRankThreshold(t, s.rank + 1)
    const left = Math.max(0, to - s.xp)
    return { key: f, name: FIELD_SKILL_NAME[f], step: `rank ${s.rank} → ${s.rank + 1}`, percent: pct(s.xp - from, to - from), text: `${left} XP to go · grows with each ${FIELD_USE[f]}` }
  })
}

/** The note under the lines: what "about N more" assumes, from tuning (03 §5.1's D curve and the per-delve budget). */
export function growthNote(t: Tuning): string {
  const curve = t.xp.difficultyCurve
  const at = (delta: number) => curve.find((p) => p.delta === delta)?.multiplier
  const plus5 = at(5)
  const top = curve[curve.length - 1]
  const low = curve[0]
  const bits = [`Counted at an even fight.`]
  if (plus5 !== undefined && top) bits.push(`Foes ${5} levels above you count ×${plus5} (up to ×${top.multiplier}),`)
  if (low) bits.push(`foes ${Math.abs(low.delta)} below count ×${low.multiplier}.`)
  bits.push(`Each delve, a skill’s first ${t.xp.useBudget.fullUses} uses count in full.`)
  return bits.join(' ')
}
