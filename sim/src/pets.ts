import type { Content } from './content.ts'
import type { Actor } from './fight-types.ts'
import { monsterBaseline } from './monsters.ts'
import { ALL_TENS, roundHalfUp, type DerivedStats } from './stats.ts'
import type { Tuning } from './tuning.ts'
import type { PetDef, PetInstance } from './types/content.ts'
import { gradeIndex, type DerivedStat, type Grade } from './types/enums.ts'

/**
 * Pets (03-GAME-DESIGN §9, D-013): one per player, a timeline actor with its own Speed and HP, driven by its stance.
 * Stats (D-063): the monster baseline at the pet's level × the species' `baseStats` multipliers × 1.35 per grade
 * step × (1 + 2% per level) × (1 + 5% per bond star). Actives unlock at levels 5 and 15 and by grade (F–C 1,
 * B–A 2, S+ 3); their stamina refills between fights.
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
  return {
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
      traitEffects: [...def.trait.effects],
    },
  }
}

/** Pet XP after a fight (03 §9): half the owner's fight XP by participation, capped at the owner's level. */
export function petXpShare(t: Tuning, ownerFightXp: number, treat: boolean): number {
  const share = roundHalfUp((ownerFightXp * t.pets.xpSharePercent) / 100)
  return treat ? roundHalfUp(share * (1 + t.pets.treat.xpPercent / 100)) : share
}
