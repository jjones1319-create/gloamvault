import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildContent, type Content, type RawContentFile } from '../src/content.ts'
import type { Actor, FightRow, HeroActorData } from '../src/fight-types.ts'
import { ALL_TENS, EMPTY_KIT, deriveStats, type ArmorPieceLoad, type AttributeValues } from '../src/stats.ts'
import type { Tuning } from '../src/tuning.ts'
import type { DamageType, Pool, WeaponType } from '../src/types/enums.ts'

/** The real statuses and tuning as raw files, so tests can add hand-made records beside them. */
export function realRaw(): RawContentFile[] {
  const out: RawContentFile[] = []
  for (const f of readdirSync('content/statuses')) {
    if (!f.endsWith('.json')) continue
    out.push({ kind: 'status', path: `content/statuses/${f}`, json: JSON.parse(readFileSync(join('content/statuses', f), 'utf8')) })
  }
  out.push({ kind: 'tuning', path: 'content/tuning.json', json: JSON.parse(readFileSync('content/tuning.json', 'utf8')) })
  return out
}

export function loadTuning(): Tuning {
  return JSON.parse(readFileSync('content/tuning.json', 'utf8')) as Tuning
}

export function makeContent(extra: RawContentFile[] = []): Content {
  return buildContent([...realRaw(), ...extra])
}

export function example(kind: RawContentFile['kind'], name: string): RawContentFile {
  const json = JSON.parse(readFileSync(`content/examples/${name}.example.json`, 'utf8')) as { id: string }
  return { kind, path: `content/examples/${name}.example.json`, json }
}

export interface HeroSpec {
  id: string
  name?: string
  attributes?: Partial<AttributeValues>
  level?: number
  pool?: Pool
  row?: FightRow
  weapon?: { attack: number; type: WeaponType; damageType: DamageType; weight: number; strengthRequirement: number; dual?: boolean; reach?: boolean; ranged?: boolean }
  armorDefense?: number
  armorPieces?: ArmorPieceLoad[]
  armorFamily?: string | null
  shieldBlock?: number
  flatHp?: number
  flat?: Partial<Record<string, number>>
  actives?: (string | null)[]
  ultimateId?: string | null
  ranks?: Record<string, number>
  aiRule?: string
}

/** A hero actor built from numbers (the fight does not care where the gear came from). */
export function makeHeroActor(t: Tuning, spec: HeroSpec): Actor {
  const attributes: AttributeValues = { ...ALL_TENS, ...(spec.attributes ?? {}) }
  const pool = spec.pool ?? 'stamina'
  const weapon = spec.weapon ?? { attack: 10, type: 'sword', damageType: 'slash', weight: 1000, strengthRequirement: 8 }
  const base = deriveStats(t, {
    ...EMPTY_KIT,
    attributes,
    level: spec.level ?? 1,
    pool,
    offenseAttribute: pool === 'mana' ? 'wisdom' : 'strength',
    weapon: { attack: weapon.attack, focusPower: pool === 'mana' ? weapon.attack : 0, speedPenalty: 0, strengthRequirement: weapon.strengthRequirement, wisdomRequirement: 0, heavy: weapon.weight === 1400 },
    armor: { defense: spec.armorDefense ?? 0, pieces: spec.armorPieces ?? [] },
    shieldBlock: spec.shieldBlock ?? 0,
    flat: { hp: spec.flatHp ?? 0, ...((spec.flat ?? {}) as Record<string, number>) },
  })
  const actives = spec.actives ?? [null, null, null, null]
  const hero: HeroActorData = {
    heroId: spec.id,
    classId: 'warden',
    speciesId: 'human',
    pool,
    actives: [...actives, null, null, null, null].slice(0, 4),
    passives: [null, null],
    ultimateId: spec.ultimateId ?? null,
    ranks: spec.ranks ?? {},
    weapon: { type: weapon.type, damageType: weapon.damageType, weight: weapon.weight, hands: 1, dual: weapon.dual ?? false, offHandAttackPercent: 0, heavy: weapon.weight === 1400, ranged: weapon.ranged ?? false, reach: weapon.reach ?? false, onHit: [] },
    armorFamily: spec.armorFamily ?? 'plate',
    shieldBlock: spec.shieldBlock ?? 0,
    equipment: { ring: [null, null] },
    bag: [],
    aiRule: spec.aiRule ?? 'ELSE basic attack nearest',
    relicUsesLeft: 0,
    stanceChangeUsed: false,
    species: { darkAccuracyImmune: false, lightBandShift: 0, immunities: [], statusResist: {}, statusDurationDelta: {}, appliedDurationMultiplier: {}, resist: {}, weak: {}, forcedRowMoveImmune: false, damageMultiplierBelowHpPercent: null, enemyAccuracyBySize: {} },
  }
  return {
    id: spec.id,
    name: spec.name ?? spec.id,
    side: 'party',
    kind: 'hero',
    row: spec.row ?? 'front',
    level: spec.level ?? 1,
    hp: base.hp,
    maxHp: base.hp,
    pool: pool === 'stamina' ? base.stamina : base.mana,
    poolMax: pool === 'stamina' ? base.stamina : base.mana,
    poolKind: pool,
    momentum: 0,
    attributes,
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
    hero,
  }
}

/** Tuning with no variance and no jitter, for exact numbers. */
export function exactTuning(t: Tuning): Tuning {
  return {
    ...t,
    combat: { ...t.combat, jitterPercent: 0 },
    derived: { ...t.derived, variance: { ...t.derived.variance, floorBasePercent: 100, floorCapPercent: 100, ceilingPercent: 100 } },
  }
}
