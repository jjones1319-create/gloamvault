import type { Content } from './content.ts'
import type { Actor } from './fight-types.ts'
import { installHook } from './hooks.ts'
import { monsterBaseline } from './monsters.ts'
import { ALL_TENS, roundHalfUp, type DerivedStats } from './stats.ts'
import type { Tuning } from './tuning.ts'
import type { Effect, PetDef, PetInstance } from './types/content.ts'
import { gradeIndex, type DerivedStat, type Grade } from './types/enums.ts'

/**
 * Pets (03-GAME-DESIGN §9, D-013): one per player, a timeline actor with its own Speed and HP, driven by its stance.
 * Stats (D-063): the monster baseline at the pet's level × the species' `baseStats` multipliers × 1.35 per grade
 * step × (1 + 2% per level) × (1 + 5% per bond star). Actives unlock at levels 5 and 15 and by grade (F–C 1,
 * B–A 2, S+ 3); their stamina refills between fights.
 *
 * The trait grows by use (03 §9, Phase 7): the species' `trait.growsBy` tag names what counts — tuning
 * `pets.traitGrowth.sources` maps it to the pet's finds (a Perception trait: traps revealed, secret doors found,
 * monsters caught unawares), its hits landed, the hits it took or its turns — weighted by `weights`; `traitXp` holds
 * the total and `usesForRank` turns it into the rank (1–5). Each rank above 1 adds `effectPercentPerRank` to the
 * trait's numbers, wherever they are read: the delve's party bonuses, the fight's hooks and stat lines.
 */
export function petGradeMultiplier(t: Tuning, grade: Grade): number {
  return Math.pow(t.pets.gradeStep, gradeIndex(grade))
}

export function petActiveCount(t: Tuning, grade: Grade): number {
  return t.pets.activesByGrade[grade]
}

export function petActiveIds(t: Tuning, def: PetDef, inst: PetInstance): string[] {
  const allowed = petActiveCount(t, inst.grade)
  return def.actives
    .filter((a, i) => i < allowed && inst.level >= a.unlockLevel)
    .map((a) => a.skillId)
}

/* ---------- the trait's rank (03 §9: grows by use) ---------- */

/** The highest rank `usesForRank` allows. */
export function petTraitMaxRank(t: Tuning): number {
  return t.pets.traitGrowth.usesForRank.length
}

/** The rank a trait's weighted uses reach (1 … max). */
export function petTraitRankFor(t: Tuning, traitXp: number): number {
  const table = t.pets.traitGrowth.usesForRank
  let rank = 1
  for (let r = 1; r < table.length; r++) if (traitXp >= (table[r] ?? Infinity)) rank = r + 1
  return rank
}

/** A pet's trait rank: its stored rank, never below what its uses have earned (a save from before Phase 7 reads 1). */
export function petTraitRank(t: Tuning, inst: PetInstance): number {
  return Math.max(1, Math.min(petTraitMaxRank(t), Math.max(inst.traitRank ?? 1, petTraitRankFor(t, inst.traitXp ?? 0))))
}

/** Progress toward the next rank, for the Stables and the pet card: uses so far, the next rank's mark (null at max). */
export function petTraitProgress(t: Tuning, inst: PetInstance): { rank: number; xp: number; next: number | null; from: number } {
  const rank = petTraitRank(t, inst)
  const table = t.pets.traitGrowth.usesForRank
  return { rank, xp: inst.traitXp ?? 0, from: table[rank - 1] ?? 0, next: rank < table.length ? (table[rank] ?? null) : null }
}

/** Percent of the species' numbers the trait gives at its rank (100 at rank 1). */
export function petTraitScalePercent(t: Tuning, rank: number): number {
  return 100 + t.pets.traitGrowth.effectPercentPerRank * (Math.max(1, rank) - 1)
}

/** One number of a trait line at the pet's rank, rounded half away from zero (+5 Detection at rank 3 → +6; −15 → −18). */
export function petTraitLineAmount(t: Tuning, inst: PetInstance, base: number): number {
  const v = (Math.abs(base) * petTraitScalePercent(t, petTraitRank(t, inst))) / 100
  return Math.sign(base) * roundHalfUp(v)
}

/** A trait line with its numbers at the pet's rank. Band shifts (a light band brighter) do not grow. */
export function scaledTraitLine(t: Tuning, inst: PetInstance, line: Effect): Effect {
  if (line.kind === 'custom' && line.customId === 'pet-light-band-shift') return line
  return {
    ...line,
    ...(line.amount !== undefined ? { amount: petTraitLineAmount(t, inst, line.amount) } : {}),
    ...(line.percent !== undefined ? { percent: petTraitLineAmount(t, inst, line.percent) } : {}),
  }
}

/** The pet's trait lines at its rank. */
export function petTraitLines(t: Tuning, def: PetDef, inst: PetInstance): Effect[] {
  return def.trait.effects.map((l) => scaledTraitLine(t, inst, l))
}

/** Adds weighted uses to a trait; the rank follows (never down). */
export function addTraitUses(t: Tuning, inst: PetInstance, uses: number): PetInstance {
  if (uses <= 0) return inst
  const traitXp = Math.max(0, Math.floor((inst.traitXp ?? 0) + uses))
  return { ...inst, traitXp, traitRank: Math.max(inst.traitRank ?? 1, petTraitRankFor(t, traitXp)) }
}

type GrowthSource = 'finds' | 'hitsTaken' | 'hitsLanded' | 'actions'

function growthSource(t: Tuning, def: PetDef): GrowthSource | null {
  const map = t.pets.traitGrowth.sources as Readonly<Record<string, string>>
  const s = map[def.trait.growsBy]
  return s === 'finds' || s === 'hitsTaken' || s === 'hitsLanded' || s === 'actions' ? s : null
}

function weightOf(t: Tuning, source: GrowthSource): number {
  return (t.pets.traitGrowth.weights as Readonly<Record<string, number>>)[source] ?? 1
}

/** After a fight: the pet's own tally feeds a fight-grown trait (Strength by hits landed, Endurance by hits taken …). */
export function growPetTraitFromFight(content: Content, t: Tuning, inst: PetInstance, pet: Actor): PetInstance {
  const def = content.pets.get(inst.petId)
  const source = def ? growthSource(t, def) : null
  if (!source || source === 'finds') return inst
  const n = source === 'hitsTaken' ? pet.tally.hitsTaken : source === 'hitsLanded' ? pet.tally.hitsLanded : pet.tally.actions
  return addTraitUses(t, inst, n * weightOf(t, source))
}

/** After a delve: what the party found feeds a Perception trait (a foraging pet's count doubles; 03 §9). */
export function growPetTraitFromFinds(content: Content, t: Tuning, inst: PetInstance, finds: number): PetInstance {
  const def = content.pets.get(inst.petId)
  if (!def || growthSource(t, def) !== 'finds' || finds <= 0) return inst
  const forage = inst.stance === 'forage' ? t.pets.traitGrowth.forageFindsMultiplier : 1
  return addTraitUses(t, inst, finds * weightOf(t, 'finds') * forage)
}

/* ---------- the pet in a fight ---------- */

export function petStats(t: Tuning, def: PetDef, inst: PetInstance): DerivedStats {
  const base = monsterBaseline(t, Math.max(1, inst.level))
  const grade = petGradeMultiplier(t, inst.grade)
  const level = 1 + (t.pets.statsPerLevelPercent * (inst.level - 1)) / 100
  const bond = 1 + (t.economy.dupes.bondStarPercent * inst.bondStars) / 100
  const scale = grade * level * bond
  const mult = (stat: DerivedStat, fallback: number) => def.baseStats[stat] ?? fallback
  return {
    hp: Math.max(1, roundHalfUp(base.hp * mult('hp', 1) * scale)),
    attackPhys: roundHalfUp(base.attack * mult('attackPhys', 1) * scale),
    attackSpell: roundHalfUp(base.attack * mult('attackSpell', 1) * scale),
    defense: roundHalfUp(base.defense * mult('defense', 1) * scale),
    speed: roundHalfUp(t.derived.speed.base * mult('speed', 1)),
    stamina: def.stamina,
    mana: 0,
    momentumGain: 0,
    critRate: t.dungeon.monsterBaseline.critRate,
    critDamage: t.dungeon.monsterBaseline.critDamage,
    accuracy: t.dungeon.monsterBaseline.accuracy,
    dodge: 0,
    resistance: 0,
    detection: roundHalfUp(10 * mult('detection', 1)),
    variance: t.derived.variance.floorBasePercent,
    fortune: 0,
    carry: 0,
    block: 0,
  }
}

export interface BuildPetOptions {
  id: string
  ownerId: string
  /** The owner's level caps the pet's (03 §9). */
  ownerLevel: number
  row?: 'front' | 'back'
  /** Coming back from a down at 50% (§9). */
  hpPercent?: number
}

export function buildPetActor(content: Content, t: Tuning, inst: PetInstance, opts: BuildPetOptions): Actor {
  const def = content.pets.get(inst.petId)
  if (!def) throw new Error(`unknown pet ${inst.petId}`)
  const capped: PetInstance = { ...inst, level: Math.min(inst.level, Math.max(1, opts.ownerLevel)) }
  const base = petStats(t, def, capped)
  const maxHp = base.hp
  const hp = Math.max(1, roundHalfUp((maxHp * (opts.hpPercent ?? 100)) / 100))
  const traitLines = petTraitLines(t, def, inst)
  const actor: Actor = {
    id: opts.id,
    name: inst.name || def.name,
    side: 'party',
    kind: 'pet',
    row: opts.row ?? (def.roleLean === 'guard' || def.roleLean === 'fierce' ? 'front' : 'back'),
    level: capped.level,
    hp,
    maxHp,
    pool: def.stamina,
    poolMax: def.stamina,
    poolKind: null,
    momentum: 0,
    attributes: { ...ALL_TENS },
    base,
    energy: 0,
    charging: null,
    statuses: [],
    modifiers: [],
    hooks: [],
    guarding: false,
    downed: false,
    downedTurnsLeft: 0,
    fallen: false,
    fled: false,
    gone: false,
    grabbedBy: null,
    grabDamage: 0,
    actedThisRound: false,
    lastTargetId: null,
    tally: { actions: 0, hitsLanded: 0, hitsTaken: 0, blocks: 0, damageDealt: 0, damageTaken: 0, healingDone: 0, kills: 0, skillUses: {} },
    pet: {
      petId: def.id,
      ownerId: opts.ownerId,
      stance: inst.stance,
      stamina: def.stamina,
      staminaMax: def.stamina,
      actives: petActiveIds(t, def, capped),
      traitEffects: traitLines,
    },
  }
  // The trait's custom lines (06 §9: Guard Dog's intercept, a hound's nose) ride on the pet as hooks, at its rank; its
  // own stat lines (a Brine Crab's Block) sit on it for the fight. Lines for the whole party are `applyPetTraitAuras`.
  for (const line of traitLines) {
    if (line.kind === 'custom' && line.customId) installHook(actor, line, actor.id)
    else if ((line.kind === 'buffStat' || line.kind === 'debuffStat') && line.stat && (line.target ?? 'self') === 'self') actor.modifiers.push({ stat: line.stat, amount: line.amount ?? 0, percent: line.percent ?? 0, turnsLeft: 9999, sourceId: def.trait.id })
  }
  return actor
}

/**
 * A trait's stat lines for the whole party (06 §9: a Bone Pup's party Resistance +5%, a Drakeling's +5% Attack, a
 * Frost Kit's +3% Crit) sit on every hero and pet of the party for the fight. The best single pet counts per stat,
 * never the sum (D-069). Called by the delve as it builds a fight.
 */
export function applyPetTraitAuras(content: Content, t: Tuning, party: readonly Actor[], pets: readonly { inst: PetInstance }[]): void {
  const best = new Map<string, { stat: DerivedStat; amount: number; percent: number; sourceId: string }>()
  for (const { inst } of pets) {
    const def = content.pets.get(inst.petId)
    if (!def) continue
    for (const line of petTraitLines(t, def, inst)) {
      // Detection is the delve's (the party's best Detection, `partyPetTraitBonus`), not a fight stat.
      if (line.kind !== 'buffStat' || !line.stat || line.target !== 'allAllies' || line.stat === 'detection') continue
      const key = `${line.stat}|${line.amount !== undefined ? 'a' : 'p'}`
      const value = line.amount ?? line.percent ?? 0
      const prev = best.get(key)
      if (!prev || value > (prev.amount || prev.percent)) best.set(key, { stat: line.stat, amount: line.amount ?? 0, percent: line.percent ?? 0, sourceId: def.trait.id })
    }
  }
  for (const a of party) for (const m of best.values()) a.modifiers.push({ stat: m.stat, amount: m.amount, percent: m.percent, turnsLeft: 9999, sourceId: m.sourceId })
}

/** The party-wide bonuses a pet's trait grants outside the fight (06 §9), read by the delve. */
export type PetTraitBonusKind = 'detection' | 'goldPercent' | 'scouting' | 'lockpicking' | 'scoutBandShift'

/**
 * The best single pet-trait bonus of a kind across the party's pets — never the sum (D-069: three hounds are not
 * three times as alert). Reads the trait lines the content writes, at each pet's rank: `buffStat detection`
 * (+5 Detection), `loot percent` (+10% gold found), `pet-scouting-bonus` (pp), `pet-lockpicking-bonus` (ranks) and
 * `pet-light-band-shift` (the party's scouting roll reads a band brighter; the most negative shift wins).
 */
export function partyPetTraitBonus(content: Content, pets: readonly (PetInstance | null | undefined)[], kind: PetTraitBonusKind): number {
  const t = content.tuning
  let best = 0
  for (const inst of pets) {
    const def = inst ? content.pets.get(inst.petId) : undefined
    if (!inst || !def) continue
    for (const line of petTraitLines(t, def, inst)) {
      let v: number | null = null
      if (kind === 'detection' && line.kind === 'buffStat' && line.stat === 'detection') v = line.amount ?? 0
      else if (kind === 'goldPercent' && line.kind === 'loot') v = line.percent ?? 0
      else if (line.kind === 'custom') {
        if (kind === 'scouting' && line.customId === 'pet-scouting-bonus') v = line.amount ?? 0
        else if (kind === 'lockpicking' && line.customId === 'pet-lockpicking-bonus') v = line.amount ?? 0
        else if (kind === 'scoutBandShift' && line.customId === 'pet-light-band-shift' && line.target === 'allAllies') v = line.amount ?? 0
      }
      if (v === null) continue
      best = kind === 'scoutBandShift' ? Math.min(best, v) : Math.max(best, v)
    }
  }
  return best
}

/** Pet XP after a fight (03 §9): half the owner's fight XP by participation, capped at the owner's level. */
export function petXpShare(t: Tuning, ownerFightXp: number, treat: boolean): number {
  const share = roundHalfUp((ownerFightXp * t.pets.xpSharePercent) / 100)
  return treat ? roundHalfUp(share * (1 + t.pets.treat.xpPercent / 100)) : share
}
