import type { Content } from './content.ts'
import type { Actor, FightRow } from './fight-types.ts'
import { ALL_TENS, roundHalfUp, type DerivedStats } from './stats.ts'
import type { Tuning } from './tuning.ts'
import type { MonsterDef } from './types/content.ts'

/**
 * Monster actors (03-GAME-DESIGN §11.2, D-024; 06 §3): everything derives from the level and the template. The
 * per-level baseline is tuning's `dungeon.monsterBaseline` (D-061); the template's multipliers scale it; party
 * size scales HP; champions (06 §2) take their affixes' multipliers and effect lines at spawn.
 */
export interface MonsterBaseline {
  hp: number
  attack: number
  defense: number
  gold: number
  xpUnit: number
}

export function monsterBaseline(t: Tuning, level: number): MonsterBaseline {
  const b = t.dungeon.monsterBaseline
  return {
    hp: roundHalfUp(b.hp.base + b.hp.perLevel * level),
    attack: roundHalfUp(b.attack.base + b.attack.perLevel * level),
    defense: roundHalfUp(b.defense.base + b.defense.perLevel * level),
    gold: roundHalfUp(b.gold.base + b.gold.perLevel * level),
    xpUnit: roundHalfUp(b.xpUnit.base + b.xpUnit.perLevel * level),
  }
}

export interface BuildMonsterOptions {
  id: string
  level: number
  row: FightRow
  /** Party-size HP scale in percent (03 §11.2: 70 / 85 / 100 / 115). */
  hpPercent: number
  /** Difficulty knob (percent of normal). */
  enemyHpPercent?: number
  champion?: { affixIds: string[] } | null
  summonedBy?: string | null
  /** A hunter's level offset is applied by the caller through `level`. */
  nameSuffix?: string
}

export function buildMonsterActor(content: Content, t: Tuning, def: MonsterDef, opts: BuildMonsterOptions): Actor {
  const base = monsterBaseline(t, opts.level)
  const b = t.dungeon.monsterBaseline
  let hpMult = def.multipliers.hp
  let goldMult = def.goldMultiplier
  let xpClass: number = def.xpClass
  const affixIds = opts.champion?.affixIds ?? []
  // 06 §2: a champion "gains HP ×2.5, gold ×3, XP class +2" once, however many affixes it carries (each affix record
  // repeats the champion's numbers; the largest of each counts — D-081).
  let champHp = 1
  let champGold = 1
  let champXp = 0
  for (const id of affixIds) {
    const affix = content.eliteAffixes.get(id)
    if (!affix) continue
    champHp = Math.max(champHp, affix.hpMultiplier)
    champGold = Math.max(champGold, affix.goldMultiplier)
    champXp = Math.max(champXp, affix.xpClassBonus)
  }
  hpMult *= champHp
  goldMult *= champGold
  xpClass += champXp
  const maxHp = Math.max(1, roundHalfUp((base.hp * hpMult * opts.hpPercent * (opts.enemyHpPercent ?? 100)) / 10_000))
  const isBoss = def.boss !== null
  const isHunter = def.hunter !== null
  const stats: DerivedStats = {
    hp: maxHp,
    attackPhys: roundHalfUp(base.attack * def.multipliers.attack),
    attackSpell: roundHalfUp(base.attack * def.multipliers.attack),
    defense: roundHalfUp(base.defense * def.multipliers.defense),
    speed: def.speed,
    stamina: 0,
    mana: 0,
    momentumGain: 100,
    critRate: b.critRate,
    critDamage: b.critDamage,
    accuracy: b.accuracy,
    dodge: 0,
    resistance: isBoss || isHunter ? b.bossResistance : 0,
    detection: 10,
    variance: t.derived.variance.floorBasePercent,
    fortune: 0,
    carry: 0,
    block: 0,
  }
  const phase0 = def.boss?.phases[0]
  const actor: Actor = {
    id: opts.id,
    name: `${def.name}${opts.nameSuffix ?? ''}`,
    side: 'enemy',
    kind: opts.summonedBy ? 'summon' : 'monster',
    row: opts.row,
    level: opts.level,
    hp: maxHp,
    maxHp,
    pool: 0,
    poolMax: 0,
    poolKind: null,
    momentum: 0,
    attributes: { ...ALL_TENS },
    base: stats,
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
    monster: {
      monsterId: def.id,
      familyId: def.familyId,
      role: def.role,
      size: def.size,
      attacks: [...def.attacks],
      attackIds: phase0 ? [...phase0.attacks] : def.attacks.map((a) => a.id),
      behavior: [...def.behavior.rules],
      fleesAtPercent: def.behavior.fleesAtPercent,
      resist: [...def.resist],
      weak: [...def.weak],
      immune: [...def.immune],
      statusImmune: [...def.statusImmune, ...(def.boss?.immunities ?? [])],
      champion: affixIds.length ? { affixIds: [...affixIds] } : null,
      phaseIndex: 0,
      isBoss,
      isHunter,
      cannotFlee: def.boss?.cannotFlee ?? def.hunter?.cannotFlee ?? false,
      partBroken: false,
      goldMultiplier: goldMult,
      xpClass,
      summonedBy: opts.summonedBy ?? null,
    },
  }
  return actor
}

/** Gold a monster is worth before the fight-level multipliers (06 §8.5): baseline gold × its multiplier. */
export function monsterGold(t: Tuning, actor: Actor): number {
  const m = actor.monster
  if (!m) return 0
  return roundHalfUp(monsterBaseline(t, actor.level).gold * m.goldMultiplier)
}

/** XP a monster is worth before the D curve (06 §8.6): XP class × the level's XP unit. */
export function monsterXp(t: Tuning, actor: Actor): number {
  const m = actor.monster
  if (!m) return 0
  return m.xpClass * monsterBaseline(t, actor.level).xpUnit
}

/** The level of a monster on a floor: the floor band level, plus the hunter's offset. */
export function monsterLevelOnFloor(def: MonsterDef, floorLevel: number): number {
  return def.hunter ? floorLevel + def.hunter.levelOffset : floorLevel
}

/** Party-size scaling (03 §11.2, 06 §8.1): count ×0.6/0.8/1.0/1.2 (min 1, specials and monsters never removed) and HP ×0.7/0.85/1.0/1.15. */
export function partyScale(t: Tuning, partySize: number, boss = false): { countPercent: number; hpPercent: number; damagePercent: number } {
  const i = Math.max(0, Math.min(3, partySize - 1))
  // 03 §11.2 scales count and HP; the damage line is D-080's (a solo hero takes every blow the scaled pack deals).
  const damage = (t.dungeon.partyScaling as { damage?: number[] }).damage
  // D-128 (Proposed): a boss fight — the boss and every add of its arena — reads HP and damage from its own row,
  // `partyScaling.boss`; the count rule stays the fights' (06 §8.1). No boss row: the fights' rows.
  const row = boss ? (t.dungeon.partyScaling as { boss?: { hp?: number[]; damage?: number[] } }).boss : undefined
  return {
    countPercent: roundHalfUp((t.dungeon.partyScaling.count[i] ?? 1) * 100),
    hpPercent: roundHalfUp(((row?.hp ?? t.dungeon.partyScaling.hp)[i] ?? 1) * 100),
    damagePercent: roundHalfUp(((row?.damage ?? damage)?.[i] ?? 1) * 100),
  }
}

export function scaledCount(count: number, countPercent: number, role: string): number {
  if (role === 'special' || role === 'monster' || role === 'boss' || role === 'hunter') return count
  return Math.max(1, roundHalfUp((count * countPercent) / 100))
}
