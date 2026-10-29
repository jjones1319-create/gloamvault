/**
 * Shared builder for the class generators (`node tools/content/gen-class-<class>.ts`).
 *
 * Each generator holds one class sheet (`docs/classes/<class>.md` §2–§5, §7) as data — the §4 tables row by row —
 * and this module turns the rows into `content/classes/<id>.json` and `content/skills/<class>/<id>.json`
 * (`content/schemas/class.schema.json`, `skill.schema.json`). A sheet change is a re-run; a re-run on an unchanged
 * sheet writes byte-identical files and removes nothing it did not write (it only deletes stale `<class>-*.json`
 * records in the class's own skill folder).
 *
 * Phase 3 wrote Tiers I–III plus the Ultimate (content/README.md rule 4 as amended by D-070); Phase 7 adds Tiers IV–V
 * (Tier V designed but unobtainable until Segment 3, D-099) and links the monster techniques. TECHNIQUES below is the
 * one table of which monster teaches which sheet skill (06 §8.8 owns it) and which of its moves count as witnessing;
 * every class generator — the three built on this module and the three that write their own records (Arcanist,
 * Mender, Shade) — takes a skill's technique fields and the class's monsterTechniqueIds from it. LINK_MONSTER_TECHNIQUES
 * waits for the Crypts' and the Vault's monster files (a link to a missing monster fails rule 2) and for the witness
 * roll (sim/src/progress.ts), so a linked technique can always be learned.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** True once the Crypts and Vault monsters exist and the witness roll works; it fills monsterTechniqueOf and monsterTechniqueIds. */
export const LINK_MONSTER_TECHNIQUES = true

/** One technique: the monster (06's id) whose move teaches the skill and the moves (its attack ids) that count. */
export interface TechniqueLink {
  monsterId: string
  /** The attack ids of the monster that are "the move"; omitted: any of its attacks counts (06 names no matching move). */
  moveIds?: string[]
  /** The monster's dungeon is not in the content yet (written as monsterTechniqueLater; the skill cannot be learned). */
  later?: boolean
}

/**
 * 06 §8.8 and §3's "Technique:" lines, read against the monsters' attacks (Phase 7, pass A): exactly two techniques per
 * class (the Beast Tamer's come with its class in Phase 11). The move ids are 06's attack names in kebab case.
 */
export const TECHNIQUES: Readonly<Record<string, TechniqueLink>> = {
  'warden-bone-knights-stand': { monsterId: 'bone-knight', moveIds: ['grave-guard'] },
  'warden-sentinels-sweep': { monsterId: 'vault-sentinel', moveIds: ['halberd'] },
  'blade-ghouls-grasp': { monsterId: 'ghoul', moveIds: ['ghouls-grasp'] },
  'blade-bone-knights-cleave': { monsterId: 'bone-knight', moveIds: ['cleave'] },
  'ranger-deep-tentacles-drag': { monsterId: 'deep-tentacle', moveIds: ['drag-under'] },
  'ranger-grave-bats-screech': { monsterId: 'grave-bat', moveIds: ['shriek'] },
  'shade-wraith-step': { monsterId: 'wraith', moveIds: ['drift'] },
  'shade-hags-hex': { monsterId: 'brine-hag', moveIds: ['salt-curse', 'salt-hex'] },
  'arcanist-hags-cauldron': { monsterId: 'brine-hag' },
  'arcanist-sentinel-pulse': { monsterId: 'vault-sentinel', moveIds: ['core-pulse'] },
  'mender-wraiths-lament': { monsterId: 'wraith', moveIds: ['wail'] },
  'mender-trolls-regrowth': { monsterId: 'warren-troll', later: true },
}

/** A skill record's technique fields, in record order: monsterTechniqueOf, then the move ids or the "later" mark. */
export function techniqueFields(skillId: string): Record<string, unknown> {
  const link = TECHNIQUES[skillId]
  if (!link) return { monsterTechniqueOf: null }
  if (link.later) return { monsterTechniqueOf: null, monsterTechniqueLater: link.monsterId }
  if (!LINK_MONSTER_TECHNIQUES) return { monsterTechniqueOf: null }
  return { monsterTechniqueOf: link.monsterId, ...(link.moveIds ? { monsterTechniqueMoveIds: link.moveIds } : {}) }
}

/** The class record's monsterTechniqueIds: its linked techniques (a "later" one joins when its monster exists). */
export function classTechniqueIds(classId: string): string[] {
  if (!LINK_MONSTER_TECHNIQUES) return []
  return Object.entries(TECHNIQUES)
    .filter(([id, link]) => id.startsWith(`${classId}-`) && !link.later)
    .map(([id]) => id)
    .sort()
}

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
  tier: 1 | 2 | 3 | 4 | 5
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
  /** What New hero calls the default kit when the class offers others (D-099). */
  starterKitName?: string
  /** Other starter kits New hero offers (D-099: the Warden's spear kit, the Blade's greatsword kit; 08 §12). Picks by name. */
  starterKitOptions?: { id: string; name: string; description: string; starterKit: string[]; starterSkills: string[] }[]
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
    ...techniqueFields(id),
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
  const techniques = classTechniqueIds(sheet.id)
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
    ...(sheet.starterKitName ? { starterKitName: sheet.starterKitName } : {}),
    ...(sheet.starterKitOptions
      ? { starterKitOptions: sheet.starterKitOptions.map((k) => ({ id: k.id, name: k.name, description: k.description, starterKit: k.starterKit, starterSkillIds: k.starterSkills.map((n) => skillId(sheet.id, n)) })) }
      : {}),
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
  for (const n of [...sheet.starterSkills, ...(sheet.starterKitOptions ?? []).flatMap((k) => k.starterSkills)]) {
    const s = byName.get(n)
    if (!s) problems.push(`starter skill "${n}" is not a skill row`)
    else if (s.tier !== 1) problems.push(`starter skill "${n}" is Tier ${s.tier}, expected I`)
  }
  for (const s of sheet.skills) {
    const link = TECHNIQUES[skillId(sheet.id, s.name)]
    if (s.technique && !link) problems.push(`"${s.name}" is marked a technique but TECHNIQUES has no row for it`)
    if (link && !s.technique) problems.push(`TECHNIQUES lists "${s.name}" but its row has no technique mark`)
    if (link && s.technique && link.monsterId !== s.technique.monsterId) problems.push(`"${s.name}": technique monster ${s.technique.monsterId} differs from TECHNIQUES ${link.monsterId}`)
    if (s.technique && s.tier !== 3 && s.tier !== 4) problems.push(`technique "${s.name}" is Tier ${s.tier}, expected III or IV`)
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
  // Rule 4 (D-070; Phase 7 adds IV–V): Tiers I–III always, IV–V once written; per tier each school has exactly 3 non-Ultimate skills.
  const tiersPresent = [1, 2, 3, ...[4, 5].filter((tier) => sheet.skills.some((s) => s.tier === tier))]
  for (const school of schoolIds) {
    for (const tier of tiersPresent) {
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

/**
 * For the generators that build their own records (Arcanist, Mender, Shade): writes the class record and the skill
 * records under `<repoRoot>/content/`, puts each skill's technique fields (TECHNIQUES) in place of the
 * `monsterTechniqueOf` the record carries and the class's `monsterTechniqueIds` in place of its own, and removes
 * `<class>-*.json` files in the class's skill folder that this run did not write. Records keep their key order.
 */
export function writeClassRecords(classId: string, classRecord: Record<string, unknown>, skills: Record<string, unknown>[], repoRoot: string = REPO_ROOT): { written: number; unchanged: number; removed: string[] } {
  let written = 0
  let unchanged = 0
  const withTechniques = (rec: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(rec)) {
      if (k === 'monsterTechniqueMoveIds' || k === 'monsterTechniqueLater') continue
      if (k === 'monsterTechniqueOf') Object.assign(out, techniqueFields(String(rec.id)))
      else out[k] = v
    }
    return out
  }
  const cls = { ...classRecord, monsterTechniqueIds: classTechniqueIds(classId) }
  if (writeJson(path.join(repoRoot, 'content', 'classes', `${classId}.json`), cls) === 'written') written++
  else unchanged++
  const skillDir = path.join(repoRoot, 'content', 'skills', classId)
  const keep = new Set<string>()
  for (const rec of skills) {
    const id = String(rec.id)
    if (!id.startsWith(`${classId}-`)) throw new Error(`skill id ${id} is not prefixed with ${classId}-`)
    if (keep.has(`${id}.json`)) throw new Error(`duplicate skill id ${id}`)
    keep.add(`${id}.json`)
    if (writeJson(path.join(skillDir, `${id}.json`), withTechniques(rec)) === 'written') written++
    else unchanged++
  }
  const removed: string[] = []
  for (const f of fs.readdirSync(skillDir)) {
    if (f.endsWith('.json') && f.startsWith(`${classId}-`) && !keep.has(f)) {
      fs.unlinkSync(path.join(skillDir, f))
      removed.push(f)
    }
  }
  return { written, unchanged, removed }
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
