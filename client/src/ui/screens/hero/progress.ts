import type { Action, Clause, Condition, Rule } from '../../../../../sim/src/ai.ts'
import type { Content } from '../../../../../sim/src/content.ts'
import { levelUpGains } from '../../../../../sim/src/hero.ts'
import type { Tuning } from '../../../../../sim/src/tuning.ts'
import type { HeroRecord, PetDef, PetInstance, SkillDef } from '../../../../../sim/src/types/content.ts'
import { GRADES, TRAINABLE_ATTRIBUTES, type Attribute, type Grade } from '../../../../../sim/src/types/enums.ts'
import { attributePointCost, battleXpForLevel, heroLevelXpCost, tierOpenAt } from '../../../../../sim/src/xp.ts'

/** The numbers the hero screen reads off a hero record (03 §2.2, §5, §7, §9; D-082). Pure. */

export interface LevelProgress {
  level: number
  /** Battle XP earned inside this level. */
  into: number
  /** Battle XP this level costs to finish (0 at the cap). */
  need: number
  atCap: boolean
  /** "Lv 4 · 37 / 98 XP to Lv 5" (Final Fantasy's status-screen line). */
  label: string
}

export function levelProgress(t: Tuning, hero: HeroRecord): LevelProgress {
  const level = hero.level
  const atCap = level >= t.xp.heroLevel.cap
  const need = atCap ? 0 : heroLevelXpCost(t, level + 1)
  const into = Math.max(0, hero.battleXp - battleXpForLevel(t, level))
  const shown = atCap ? into : Math.min(into, need)
  return { level, into: shown, need, atCap, label: atCap ? `Lv ${level} · the top level` : `Lv ${level} · ${shown} / ${need} XP to Lv ${level + 1}` }
}

export interface AttributeGrowth {
  now: number
  /** The value the hero was made with (03 §2.3). */
  start: number
  /** Points from level-ups (D-082). */
  fromLevels: number
  /** Points from use (03 §5.2). */
  fromUse: number
  /** Progress to the next point by use, 0–100 (Luck never trains). */
  nextPercent: number | null
}

/** An attribute now, at creation, and what grew it: level-ups raise both the value and the creation value (D-082). */
export function attributeGrowth(content: Content, t: Tuning, hero: HeroRecord, attr: Attribute): AttributeGrowth {
  const fromLevels = levelUpGains(content, t, hero.classId, 1, hero.level)[attr] ?? 0
  const now = hero.attributes[attr]
  const fromUse = now - hero.creationValues[attr]
  const start = hero.creationValues[attr] - fromLevels
  const trainable = (TRAINABLE_ATTRIBUTES as readonly string[]).includes(attr)
  let nextPercent: number | null = null
  if (trainable) {
    const centi = hero.attributeXp[attr as keyof HeroRecord['attributeXp']] ?? 0
    const cost = attributePointCost(t, now + 1) * 100
    nextPercent = cost > 0 ? Math.max(0, Math.min(100, Math.floor((centi * 100) / cost))) : 0
  }
  return { now, start, fromLevels, fromUse, nextPercent }
}

/* ---------- skills ---------- */

export type SkillState = { known: true; rank: number; mastery: boolean } | { known: false; where: string; open: boolean }

/** Known (rank, Mastery at 10) or where to get it (03 §7.2, §7.4, §7.5). */
export function skillState(content: Content, t: Tuning, hero: HeroRecord, skill: SkillDef): SkillState {
  const known = hero.skills.find((s) => s.skillId === skill.id)
  if (known) return { known: true, rank: known.rank, mastery: known.rank >= t.xp.skill.maxRank }
  const open = skill.tier <= tierOpenAt(t, hero.level)
  const opensAt = (t.skills.tierOpensAtLevel as Record<string, number>)[String(skill.tier)]
  if (!open) return { known: false, open, where: `Opens at Lv ${opensAt ?? '?'}` }
  if (skill.monsterTechniqueOf) {
    return { known: false, open, where: `Insight: watch ${content.monsters.get(skill.monsterTechniqueOf)?.name ?? 'its monster'}` }
  }
  if (skill.isUltimate || skill.tier > t.skills.skillHall.highestTierSold) return { known: false, open, where: 'Insight in the dungeon' }
  const prereq = skill.prerequisiteId && !hero.skills.some((s) => s.skillId === skill.prerequisiteId) ? content.skills.get(skill.prerequisiteId)?.name : null
  return { known: false, open, where: prereq ? `Skill Hall, after ${prereq}` : 'Skill Hall' }
}

/* ---------- the AI rule in plain words ---------- */

const SUBJECT: Readonly<Record<string, string>> = {
  self: 'your',
  ally: "an ally's",
  allies: 'allies',
  'lowest ally': "the most hurt ally's",
  enemy: "an enemy's",
  enemies: 'enemies',
  party: "the party's",
  pet: "your pet's",
  light: 'the light',
  round: 'the round',
  fight: 'the fight',
}
const HOLDER: Readonly<Record<string, string>> = {
  self: 'you',
  ally: 'an ally',
  allies: 'allies',
  'lowest ally': 'the most hurt ally',
  enemy: 'an enemy',
  enemies: 'enemies',
  party: 'the party',
  pet: 'your pet',
}
const METRIC: Readonly<Record<string, string>> = { hp: 'HP', pool: 'pool', stamina: 'Stamina', mana: 'Mana', momentum: 'Momentum', count: 'count', level: 'level', value: '' }

const PLURAL_HOLDERS: ReadonlySet<string> = new Set(['self', 'allies', 'enemies'])

function conditionText(c: Condition): string {
  const cmp = `${c.cmp.replace('<=', '≤').replace('>=', '≥').replace('!=', '≠')} ${c.value}${c.percent ? '%' : ''}`
  if (c.metric === 'status') {
    // "you lack fortify", "an ally has bleed" (the parser reads "not status" as = 0).
    const plural = PLURAL_HOLDERS.has(c.subject)
    const verb = c.cmp === '=' ? (plural ? 'lack' : 'lacks') : plural ? 'have' : 'has'
    return `${HOLDER[c.subject] ?? c.subject} ${verb} ${c.statusId ?? 'a status'}`
  }
  if (c.metric === 'count') {
    const many = c.subject === 'ally' || c.subject === 'allies' || c.subject === 'party' ? 'allies' : c.subject === 'enemy' || c.subject === 'enemies' ? 'enemies' : c.subject
    return `the number of ${many} ${cmp}`
  }
  const metric = METRIC[c.metric] ?? c.metric
  return `${SUBJECT[c.subject] ?? c.subject}${metric ? ` ${metric}` : ''} ${cmp}`
}

function actionText(a: Action): string {
  const on = a.target && a.target !== 'nearest' ? ` on ${a.target === 'self' ? 'yourself' : `the ${a.target}`}` : ''
  switch (a.verb) {
    case 'basic':
      return `basic attack${on}`
    case 'skill':
      return `loadout skill ${a.ref ?? '1'}${on}`
    case 'ultimate':
      return `the Ultimate${on}`
    case 'guard':
      return 'guard'
    case 'item':
      return `use ${a.ref ?? 'an item'}${on}`
    case 'swapRow':
      return 'swap rows'
    case 'flee':
      return 'flee'
    case 'freeAlly':
      return `free an ally${on}`
    case 'stance':
      return `pet stance ${a.ref ?? ''}`
    case 'named':
      return `${a.ref ?? ''}${on}`
  }
}

/** One parsed clause as a line a player can read: "If your HP < 30% → use small hp potion on yourself". */
export function clauseText(clause: Clause): string {
  if (clause.conditions.length === 0) return `Otherwise → ${actionText(clause.action)}`
  return `If ${clause.conditions.map(conditionText).join(' and ')} → ${actionText(clause.action)}`
}

/** The fight's own name match (sim/src/fight.ts matchesName): the id, the name, or the id's tail, hyphenated. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Skill names a rule uses that are not in the hero's active loadout (the fight only looks there, so they would never fire). */
export function namesNotInLoadout(content: Content, hero: HeroRecord, rule: Rule): string[] {
  const actives = hero.loadout.actives.map((id) => (id ? content.skills.get(id) : undefined)).filter((s): s is SkillDef => s !== undefined)
  const out: string[] = []
  for (const clause of rule.clauses) {
    const a = clause.action
    if (a.verb !== 'named' || !a.ref) continue
    const r = norm(a.ref)
    if (!actives.some((s) => s.id === r || norm(s.name) === r || s.id.endsWith(`-${r}`)) && !out.includes(a.ref)) out.push(a.ref)
  }
  return out
}

/* ---------- pets ---------- */

/** The lowest grade that carries the (index+1)th active (03 §9: 1 / 2 / 3 actives at F–C / B–A / S+). */
export function gradeForActive(t: Tuning, index: number): Grade | null {
  return GRADES.find((g) => t.pets.activesByGrade[g] > index) ?? null
}

export interface PetActiveView {
  skillId: string
  name: string
  description: string
  state: 'ready' | 'level' | 'grade'
  note: string
}

/** The species' actives and whether this pet has each: by grade first, then by level (03 §9). */
export function petActives(content: Content, t: Tuning, def: PetDef, pet: PetInstance): PetActiveView[] {
  const allowed = t.pets.activesByGrade[pet.grade]
  return def.actives.map((a, i) => {
    const skill = content.skills.get(a.skillId)
    const base = { skillId: a.skillId, name: skill?.name ?? a.skillId, description: skill?.description ?? '' }
    if (i >= allowed) return { ...base, state: 'grade' as const, note: `Needs a grade ${gradeForActive(t, i) ?? 'S'} pet` }
    if (pet.level < a.unlockLevel) return { ...base, state: 'level' as const, note: `Opens at Lv ${a.unlockLevel}` }
    return { ...base, state: 'ready' as const, note: 'Ready' }
  })
}
