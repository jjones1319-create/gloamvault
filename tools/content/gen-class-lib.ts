/**
 * Shared builder for the class generators (`node tools/content/gen-class-<class>.ts`).
 *
 * Each generator holds one class sheet (`docs/classes/<class>.md` §2–§5, §7) as data — the §4 tables row by row —
 * and this module turns the rows into `content/classes/<id>.json` and `content/skills/<class>/<id>.json`
 * (`content/schemas/class.schema.json`, `skill.schema.json`). A sheet change is a re-run; a re-run on an unchanged
 * sheet writes byte-identical files and removes nothing it did not write (it only deletes stale `<class>-*.json`
 * records in the class's own skill folder).
 *
 * Phase 3 writes Tiers I–III plus the Ultimate (content/README.md rule 4 as amended by D-070); Tiers IV–V follow in
 * Phase 7 together with the monsters that teach the techniques, which is why LINK_MONSTER_TECHNIQUES is off: until
 * `content/monsters/bone-knight.json` and friends exist, a `monsterTechniqueOf` would be a dangling reference
 * (rule 2) and the class's `monsterTechniqueIds` would fail rule 7.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Flip to true in Phase 7, when the Crypts and Vault monsters exist; it fills monsterTechniqueOf and monsterTechniqueIds. */
export const LINK_MONSTER_TECHNIQUES = false

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** True when `moduleUrl` is the script Node was started with (so a generator imported by another file stays quiet). */
export function isMain(moduleUrl: string): boolean {
  const entry = process.argv[1]
  return entry !== undefined && path.resolve(entry) === path.resolve(fileURLToPath(moduleUrl))
}

export type Target =
  | 'self'
  | 'ally'
  | 'allyLowest'
  | 'allAllies'
  | 'allyRow'
  | 'partyFront'
  | 'partyBack'
  | 'enemy'
  | 'enemyFront'
  | 'enemyBack'
  | 'enemyRandom'
  | 'allEnemies'
  | 'enemyRow'
  | 'enemyRowBack'
  | 'pet'
  | 'summon'
  | 'downedAlly'
  | 'allDowned'
  | 'fallenAlly'
  | 'room'

export type DamageType = 'slash' | 'pierce' | 'blunt' | 'fire' | 'frost' | 'lightning' | 'poison' | 'holy' | 'shadow'

export type Status =
  | 'bleed'
  | 'poison'
  | 'burn'
  | 'chill'
  | 'freeze'
  | 'shock'
  | 'stun'
  | 'daze'
  | 'blind'
  | 'silence'
  | 'taunt'
  | 'shield'
  | 'regen'
  | 'haste'
  | 'slow'
  | 'weaken'
  | 'fortify'
  | 'mark'
  | 'fear'
  | 'grab'
  | 'root'
  | 'web'
  | 'curse'
  | 'petrify'
  | 'smite'
  | 'wither'
  | 'veil'

export type DerivedStat =
  | 'hp'
  | 'attackPhys'
  | 'attackSpell'
  | 'defense'
  | 'speed'
  | 'stamina'
  | 'mana'
  | 'momentumGain'
  | 'critRate'
  | 'critDamage'
  | 'accuracy'
  | 'dodge'
  | 'resistance'
  | 'detection'
  | 'variance'
  | 'fortune'
  | 'carry'
  | 'block'

export type Attribute = 'strength' | 'agility' | 'vitality' | 'endurance' | 'wisdom' | 'perception' | 'willpower' | 'luck'
export type TrainableAttribute = Exclude<Attribute, 'luck'>

export type Tag =
  | 'aoe'
  | 'singleTarget'
  | 'control'
  | 'mobility'
  | 'momentum'
  | 'light'
  | 'scouting'
  | 'heal'
  | 'cleanse'
  | 'buff'
  | 'debuff'
  | 'dot'
  | 'shield'
  | 'taunt'
  | 'reach'
  | 'summon'
  | 'revive'
  | 'utility'
  | 'field'

export type AiRole = 'attack' | 'heal' | 'buff' | 'debuff' | 'control' | 'defend' | 'utility'

export type WeaponType =
  | 'sword'
  | 'greatsword'
  | 'axe'
  | 'greataxe'
  | 'mace'
  | 'maul'
  | 'spear'
  | 'shortSpear'
  | 'dagger'
  | 'bow'
  | 'longbow'
  | 'shortbow'
  | 'crossbow'
  | 'staff'
  | 'wand'
  | 'censer'
  | 'whip'
  | 'throwingKnife'
  | 'shieldBuckler'
  | 'shieldKite'
  | 'shieldTower'
  | 'focus'
  | 'lantern'
  | 'horn'

export type FieldSkill = 'lockpicking' | 'trapDisarm' | 'foraging' | 'fieldRepair' | 'firstAid' | 'haggling' | 'cooking' | 'cartography'

export type EffectKind =
  | 'damage'
  | 'heal'
  | 'shield'
  | 'applyStatus'
  | 'removeStatus'
  | 'buffStat'
  | 'debuffStat'
  | 'momentum'
  | 'pool'
  | 'timeline'
  | 'rowSwap'
  | 'summon'
  | 'revive'
  | 'light'
  | 'loot'
  | 'taunt'
  | 'dispel'
  | 'custom'

/** One line of the effect DSL (common.schema.json#/$defs/effect). Key order here is the order written to disk. */
export interface Effect {
  kind: EffectKind
  customId?: string
  multiplier?: number
  damageType?: DamageType
  status?: Status
  chance?: number
  duration?: number
  stat?: DerivedStat
  amount?: number
  percent?: number
  energy?: number
  summonId?: string
  target?: Target
  scalesWith?: Attribute
  note?: string
}

export interface Requirements {
  shield?: boolean
  weaponTypes?: WeaponType[]
  dualWield?: boolean
  twoHanded?: boolean
}

export interface SkillRow {
  name: string
  /** The school id (ClassSheet.schools[].id). */
  school: string
  tier: 1 | 2 | 3
  type: 'active' | 'passive'
  /** Pool cost at rank 1 (0 for passives and the Ultimate). */
  cost: number
  weight: 800 | 1000 | 1400 | null
  target: Target
  /** The card text at rank 1. */
  description: string
  effects: Effect[]
  /** The Prerequisite column: the Tier N−1 skill's name as the sheet spells it, or null at Tier I. */
  prerequisite: string | null
  mastery: { text: string; effects: Effect[] }
  tags: Tag[]
  xpTags: TrainableAttribute[]
  ai: { role: AiRole; priority: number }
  requirements?: Requirements
  isUltimate?: boolean
  /** A monster technique: the monster's id in docs/06-MONSTERS.md and its display name. */
  technique?: { monsterId: string; monsterName: string }
}

export interface School {
  id: string
  name: string
  philosophy: string
}

export interface ClassSheet {
  id: string
  name: string
  role: string
  description: string
  attributeMods: Partial<Record<Attribute, number>>
  pool: 'stamina' | 'mana'
  armorFamily: 'plate' | 'mail' | 'leather' | 'robes'
  weaponTypes: WeaponType[]
  schools: School[]
  /** The Ultimate's name as the sheet spells it. */
  ultimate: string
  starterKit: string[]
  /** The three recommended Tier I picks, by name. */
  starterSkills: string[]
  fieldSkillAffinities: { fieldSkill: FieldSkill; rankBonus: number }[]
  aiRuleDefault: string
  visual: { gearSetId: string; palette: string[]; notes?: string }
  pros: string[]
  cons: string[]
  skills: SkillRow[]
}

// ---------------------------------------------------------------------------------------------------------------
// Line helpers: keep the sheet data short and the field order fixed.

export function dmg(multiplier: number, damageType: DamageType, extra: Partial<Effect> = {}): Effect {
  return { kind: 'damage', multiplier, damageType, scalesWith: 'strength', ...extra }
}
export function status(id: Status, extra: Partial<Effect> = {}): Effect {
  return { kind: 'applyStatus', status: id, ...extra }
}
export function cleanse(id: Status, extra: Partial<Effect> = {}): Effect {
  return { kind: 'removeStatus', status: id, ...extra }
}
export function buff(stat: DerivedStat, extra: Partial<Effect>): Effect {
  return { kind: 'buffStat', stat, ...extra }
}
export function debuff(stat: DerivedStat, extra: Partial<Effect>): Effect {
  return { kind: 'debuffStat', stat, ...extra }
}
export function momentum(amount: number, extra: Partial<Effect> = {}): Effect {
  return { kind: 'momentum', amount, ...extra }
}
export function heal(extra: Partial<Effect>): Effect {
  return { kind: 'heal', ...extra }
}
export function shield(extra: Partial<Effect>): Effect {
  return { kind: 'shield', ...extra }
}
export function light(amount: number, extra: Partial<Effect> = {}): Effect {
  return { kind: 'light', amount, ...extra }
}
export function timeline(energy: number, extra: Partial<Effect> = {}): Effect {
  return { kind: 'timeline', energy, ...extra }
}
export function rowSwap(note: string): Effect {
  return { kind: 'rowSwap', note }
}
export function custom(customId: string, extra: Partial<Effect> = {}): Effect {
  return { kind: 'custom', customId, ...extra }
}
/** `n` arrows or bolts leave the quiver (docs/classes/ranger.md §2 Ammo; `08` §4). */
export function ammo(n: number): Effect {
  return custom('consume-ammo', { amount: n, target: 'self', note: `${n} arrow${n === 1 ? '' : 's'} (or bolt${n === 1 ? '' : 's'})` })
}

// ---------------------------------------------------------------------------------------------------------------

/** "Hunter's Mark" → "hunters-mark"; "Flint & Tinder" → "flint-tinder"; "Wind-up" → "wind-up". */
export function kebab(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function skillId(classId: string, name: string): string {
  return `${classId}-${kebab(name)}`
}

const EFFECT_KEY_ORDER: (keyof Effect)[] = [
  'kind',
  'customId',
  'multiplier',
  'damageType',
  'status',
  'chance',
  'duration',
  'stat',
  'amount',
  'percent',
  'energy',
  'summonId',
  'target',
  'scalesWith',
  'note',
]

function orderEffect(e: Effect): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of EFFECT_KEY_ORDER) if (e[k] !== undefined) out[k] = e[k]
  return out
}

function describeTechnique(row: SkillRow): string {
  if (!row.technique) return row.description
  const tag = `Monster technique: learned only while a ${row.technique.monsterName} uses the move.`
  return row.description.includes(tag) ? row.description : `${row.description} ${tag}`
}

export function buildSkillRecord(sheet: ClassSheet, row: SkillRow): Record<string, unknown> {
  const id = skillId(sheet.id, row.name)
  const prerequisiteId = row.prerequisite === null ? null : skillId(sheet.id, row.prerequisite)
  const record: Record<string, unknown> = {
    id,
    classId: sheet.id,
    school: row.school,
    tier: row.tier,
    name: row.name,
    description: describeTechnique(row),
    type: row.type,
    cost: row.cost,
    weight: row.weight,
    target: row.target,
    effects: row.effects.map(orderEffect),
    prerequisiteId,
    isUltimate: row.isUltimate === true,
    monsterTechniqueOf: row.technique && LINK_MONSTER_TECHNIQUES ? row.technique.monsterId : null,
  }
  if (row.requirements) record.requirements = row.requirements
  record.rankScaling = { effectPerRank: 4, costPerRank: -2 }
  record.mastery = { text: row.mastery.text, effects: row.mastery.effects.map(orderEffect) }
  record.tags = row.tags
  record.xpTags = row.xpTags
  record.aiHints = row.ai
  return record
}

export function buildClassRecord(sheet: ClassSheet): Record<string, unknown> {
  const techniques = LINK_MONSTER_TECHNIQUES ? sheet.skills.filter((s) => s.technique).map((s) => skillId(sheet.id, s.name)) : []
  return {
    id: sheet.id,
    name: sheet.name,
    role: sheet.role,
    description: sheet.description,
    attributeMods: sheet.attributeMods,
    pool: sheet.pool,
    armorFamily: sheet.armorFamily,
    weaponTypes: sheet.weaponTypes,
    schools: sheet.schools,
    ultimateSkillId: skillId(sheet.id, sheet.ultimate),
    starterKit: sheet.starterKit,
    starterSkillIds: sheet.starterSkills.map((n) => skillId(sheet.id, n)),
    fieldSkillAffinities: sheet.fieldSkillAffinities,
    monsterTechniqueIds: techniques,
    aiRuleDefault: sheet.aiRuleDefault,
    visual: sheet.visual,
    pros: sheet.pros,
    cons: sheet.cons,
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Sheet-level checks the schema and linter would catch later, caught here with the sheet's own words.

export function checkSheet(sheet: ClassSheet): string[] {
  const problems: string[] = []
  const byName = new Map<string, SkillRow>()
  for (const s of sheet.skills) {
    if (byName.has(s.name)) problems.push(`duplicate skill name "${s.name}"`)
    byName.set(s.name, s)
  }
  const schoolIds = new Set(sheet.schools.map((s) => s.id))
  const mods = Object.values(sheet.attributeMods).reduce((a, b) => a + b, 0)
  if (mods !== 4) problems.push(`attributeMods sum to ${mods}, expected +4`)
  if (!byName.has(sheet.ultimate)) problems.push(`ultimate "${sheet.ultimate}" is not a skill row`)
  for (const n of sheet.starterSkills) {
    const s = byName.get(n)
    if (!s) problems.push(`starter skill "${n}" is not a skill row`)
    else if (s.tier !== 1) problems.push(`starter skill "${n}" is Tier ${s.tier}, expected I`)
  }
  for (const s of sheet.skills) {
    if (!schoolIds.has(s.school)) problems.push(`"${s.name}" names unknown school "${s.school}"`)
    if (s.type === 'passive' && (s.cost !== 0 || s.weight !== null)) problems.push(`passive "${s.name}" must have cost 0 and weight null`)
    if (s.type === 'active' && (s.weight === null || s.effects.length === 0)) problems.push(`active "${s.name}" needs a weight and at least one effect`)
    if (s.isUltimate && (s.tier !== 3 || s.cost !== 0 || s.type !== 'active')) problems.push(`ultimate "${s.name}" must be an active Tier III skill with cost 0`)
    if (s.tier === 1 && s.prerequisite !== null) problems.push(`Tier I "${s.name}" has a prerequisite`)
    if (s.tier > 1) {
      const p = s.prerequisite === null ? undefined : byName.get(s.prerequisite)
      if (!p) problems.push(`"${s.name}" prerequisite "${String(s.prerequisite)}" is not a skill row`)
      else if (p.tier !== s.tier - 1 || p.school !== s.school) problems.push(`"${s.name}" prerequisite "${p.name}" is Tier ${p.tier} of ${p.school}, expected Tier ${s.tier - 1} of ${s.school}`)
    }
    for (const e of [...s.effects, ...s.mastery.effects]) {
      if (e.kind === 'damage' && (e.multiplier === undefined || e.damageType === undefined)) problems.push(`"${s.name}": a damage line needs multiplier and damageType`)
      if (e.kind === 'custom' && e.customId === undefined) problems.push(`"${s.name}": a custom line needs a customId`)
      if ((e.kind === 'applyStatus' || e.kind === 'removeStatus') && e.status === undefined) problems.push(`"${s.name}": a status line needs a status`)
      if ((e.kind === 'buffStat' || e.kind === 'debuffStat') && (e.stat === undefined || (e.amount === undefined && e.percent === undefined)))
        problems.push(`"${s.name}": a stat line needs stat and amount or percent`)
    }
  }
  // Rule 4 as amended (D-070): per present tier each school has exactly 3 non-Ultimate skills.
  for (const school of schoolIds) {
    for (const tier of [1, 2, 3]) {
      const n = sheet.skills.filter((s) => s.school === school && s.tier === tier && !s.isUltimate).length
      if (n !== 3) problems.push(`school ${school} Tier ${tier} has ${n} skills, expected 3`)
    }
  }
  const ultimates = sheet.skills.filter((s) => s.isUltimate)
  if (ultimates.length !== 1 || ultimates[0]?.name !== sheet.ultimate) problems.push(`expected exactly one Ultimate row named "${sheet.ultimate}"`)
  return problems
}

// ---------------------------------------------------------------------------------------------------------------

function writeJson(file: string, record: unknown): 'written' | 'unchanged' {
  const text = `${JSON.stringify(record, null, 2)}\n`
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return 'unchanged'
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text, 'utf8')
  return 'written'
}

/** Writes the class and its skills under `<repoRoot>/content/`; returns the customIds used, for the hook list. */
export function generateClass(sheet: ClassSheet, repoRoot: string = REPO_ROOT): { written: number; unchanged: number; removed: string[]; customIds: string[] } {
  const problems = checkSheet(sheet)
  if (problems.length > 0) {
    for (const p of problems) console.error(`${sheet.id}: ${p}`)
    throw new Error(`${sheet.id}: ${problems.length} problem(s) in the sheet data; nothing written`)
  }
  let written = 0
  let unchanged = 0
  const keep = new Set<string>()
  const customIds = new Set<string>()

  const classFile = path.join(repoRoot, 'content', 'classes', `${sheet.id}.json`)
  if (writeJson(classFile, buildClassRecord(sheet)) === 'written') written++
  else unchanged++

  const skillDir = path.join(repoRoot, 'content', 'skills', sheet.id)
  for (const row of sheet.skills) {
    const record = buildSkillRecord(sheet, row)
    const file = path.join(skillDir, `${String(record.id)}.json`)
    keep.add(path.basename(file))
    if (writeJson(file, record) === 'written') written++
    else unchanged++
    for (const e of [...row.effects, ...row.mastery.effects]) if (e.kind === 'custom' && e.customId) customIds.add(e.customId)
  }
  const removed: string[] = []
  for (const f of fs.readdirSync(skillDir)) {
    if (f.endsWith('.json') && f.startsWith(`${sheet.id}-`) && !keep.has(f)) {
      fs.unlinkSync(path.join(skillDir, f))
      removed.push(f)
    }
  }
  console.log(
    `${sheet.id}: ${sheet.skills.length} skills (${sheet.skills.filter((s) => s.isUltimate).length} Ultimate) + class record — ${written} written, ${unchanged} unchanged${removed.length ? `, removed ${removed.join(', ')}` : ''}; custom hooks: ${[...customIds].sort().join(', ') || 'none'}`,
  )
  return { written, unchanged, removed, customIds: [...customIds].sort() }
}
