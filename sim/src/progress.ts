import type { Content } from './content.ts'
import type { DelveHero, DelveState } from './delve-types.ts'
import type { Actor, FightState } from './fight-types.ts'
import { heroLevelFromSkills, speciesRules } from './hero.ts'
import { insightChanceBp, rollInsight } from './insight.ts'
import { gainItemXp, wearArmorPiece, wearShield, wearWeapon } from './items.ts'
import { monsterXp } from './monsters.ts'
import type { Rng } from './rng.ts'
import { roundHalfUp } from './stats.ts'
import type { Tuning } from './tuning.ts'
import type { Equipment, HeroRecord, ItemInstance, KnownSkill, SkillDef } from './types/content.ts'
import { TRAINABLE_ATTRIBUTES, type Attribute, type TrainableAttribute } from './types/enums.ts'
import { attributeGainAboveCap, attributePointCost, attributeSoftCap, difficultyMultiplier, isGated, skillRankFor, useBudgetPercent, useXp } from './xp.ts'

/**
 * What grows after a fight (03-GAME-DESIGN §5, §7.5): skill ranks, attributes (XP kept in hundredths so a 1 × D
 * tag stays an integer, D-065), item levels, Insights, hero level, pet XP; and what wears (§6.4). The fight only
 * recorded events; this module applies them to the hero records with the gate, the D curve and the use budget.
 */

function heroExtraPercent(content: Content, t: Tuning, hero: HeroRecord, knobXpPercent: number, pactXpPercent: number): number {
  const species = content.species.get(hero.speciesId)
  const mult = species ? (speciesRules(species).xpMultiplier ?? 1) : 1
  const wis = 1 + (t.xp.wisdomPercentPerPoint * (hero.attributes.wisdom - 10)) / 100
  return roundHalfUp((mult * Math.max(0.5, wis) * (knobXpPercent / 100) * (1 + pactXpPercent / 100) - 1) * 100)
}

function withSkill(hero: HeroRecord, skillId: string, update: (k: KnownSkill) => KnownSkill): HeroRecord {
  return { ...hero, skills: hero.skills.map((k) => (k.skillId === skillId ? update(k) : k)) }
}

function equipmentSlotInstance(eq: Equipment, slot: string): ItemInstance | null {
  if (slot === 'ring') return eq.ring[0]
  const v = (eq as unknown as Record<string, ItemInstance | null>)[slot]
  return v ?? null
}

function withEquipmentSlot(eq: Equipment, slot: string, inst: ItemInstance | null): Equipment {
  if (slot === 'ring') return { ...eq, ring: [inst, eq.ring[1]] }
  return { ...eq, [slot]: inst } as Equipment
}

export interface FightProgressReport {
  heroIndex: number
  skillRanks: Record<string, number>
  attributes: Record<string, number>
  itemLevels: Record<string, number>
  insights: string[]
  levelsGained: number
  petXp: number
}

/** Applies a finished fight's XP and wear events to the delve's heroes. */
export function applyFightProgress(content: Content, t: Tuning, rng: Rng, state: DelveState, fight: FightState, heroActorIds: string[]): FightProgressReport[] {
  const reports: FightProgressReport[] = []
  const knobXp = state.knobs.xpPercent ?? 100
  const mainFamily = fight.actors.find((a) => a.monster)?.monster?.familyId ?? null
  // Participation shares for pet XP (03 §5.3, §9).
  const partyWork = fight.actors.filter((a) => a.kind === 'hero').reduce((s, a) => s + a.tally.damageDealt + a.tally.healingDone, 0)
  const totalMonsterXp = fight.actors.filter((a) => a.monster && a.gone && !a.fled).reduce((s, a) => s + monsterXp(t, a), 0)

  heroActorIds.forEach((actorId, heroIndex) => {
    const dh = state.heroes[heroIndex]
    const actor = fight.actors.find((a) => a.id === actorId)
    if (!dh || !actor) return
    let hero = dh.record
    const report: FightProgressReport = { heroIndex, skillRanks: {}, attributes: {}, itemLevels: {}, insights: [], levelsGained: 0, petXp: 0 }
    const extra = heroExtraPercent(content, t, hero, knobXp, state.pactReward.xpPercent)
    const levelBefore = hero.level

    for (const ev of fight.xp) {
      if (ev.actorId !== actorId) continue
      if (ev.kind === 'skill') {
        const skill = content.skills.get(ev.id)
        const known = hero.skills.find((k) => k.skillId === ev.id)
        if (!skill || !known) continue
        const uses = dh.skillUses[ev.id] ?? 0
        const gain = useXp(t, t.xp.skill.xpPerUse, ev.enemyLevel, hero.level, uses, extra)
        dh.skillUses[ev.id] = uses + 1
        if (gain <= 0) continue
        const xp = known.xp + gain
        const rank = Math.min(t.xp.skill.maxRank, Math.max(known.rank, skillRankFor(t, xp)))
        if (rank > known.rank) report.skillRanks[ev.id] = (report.skillRanks[ev.id] ?? 0) + (rank - known.rank)
        hero = withSkill(hero, ev.id, (k) => ({ ...k, xp, rank }))
        // Insight (§7.5): one roll per meaningful use, toward one unknown tier-adjacent skill of the school.
        const learned = rollInsightFor(content, t, rng, hero, dh, skill, ev.enemyLevel)
        if (learned) {
          hero = { ...hero, skills: [...hero.skills, { skillId: learned.id, rank: 1, xp: 0 }] }
          report.insights.push(learned.id)
          state.stats.insights += 1
        }
      } else if (ev.kind === 'attribute') {
        const attr = ev.id as Attribute
        if (!(TRAINABLE_ATTRIBUTES as readonly string[]).includes(attr)) continue
        if (!isGated(t, ev.enemyLevel, hero.level)) continue
        const d = difficultyMultiplier(t, ev.enemyLevel, hero.level)
        const budget = useBudgetPercent(t, dh.skillUses[`attr:${attr}`] ?? 0)
        dh.skillUses[`attr:${attr}`] = (dh.skillUses[`attr:${attr}`] ?? 0) + 1
        let centi = roundHalfUp((t.xp.attribute.xpPerTag * d * budget * (100 + extra)) / 10_000)
        const cap = attributeSoftCap(t, hero.creationValues[attr], hero.level)
        if (hero.attributes[attr] >= cap) centi = attributeGainAboveCap(t, centi)
        if (centi <= 0) continue
        hero = gainAttributeCenti(t, hero, attr as TrainableAttribute, centi, report)
      } else if (ev.kind === 'item') {
        const inst = equipmentSlotInstance(hero.equipment, ev.id)
        if (!inst) continue
        const gain = useXp(t, t.xp.item.xpPerHit, ev.enemyLevel, hero.level, 0)
        if (gain <= 0) continue
        const r = gainItemXp(t, inst, gain, mainFamily)
        if (r.levelsGained) report.itemLevels[ev.id] = (report.itemLevels[ev.id] ?? 0) + r.levelsGained
        hero = { ...hero, equipment: withEquipmentSlot(hero.equipment, ev.id, r.inst) }
      }
    }

    // The kill trickle (03 §5 open question 2, D-055): +0.2 to the class's two affinity attributes per gated kill.
    const cls = content.classes.get(hero.classId)
    if (cls && actor.tally.kills > 0) {
      const top = Object.entries(cls.attributeMods)
        .filter(([a, v]) => (v ?? 0) > 0 && a !== 'luck')
        .sort((x, y) => (y[1] ?? 0) - (x[1] ?? 0))
        .slice(0, 2)
        .map(([a]) => a as TrainableAttribute)
      const trickle = roundHalfUp(t.xp.attribute.killTrickle.value * 100)
      for (let k = 0; k < actor.tally.kills; k++) for (const a of top) hero = gainAttributeCenti(t, hero, a, trickle, report)
    }

    // Wear (§6.4): events aggregated per slot so sub-percent wear carries properly.
    const counts = new Map<string, { n: number; double: number; kind: 'weapon' | 'armor' | 'shield' }>()
    for (const w of fight.wear) {
      if (w.actorId !== actorId) continue
      const key = w.slot
      const c = counts.get(key) ?? { n: 0, double: 0, kind: w.kind }
      c.n += 1
      if (w.double) c.double += 1
      counts.set(key, c)
    }
    for (const [slot, c] of counts) {
      const inst = equipmentSlotInstance(hero.equipment, slot)
      const def = inst ? content.items.get(inst.itemId) : undefined
      if (!inst || !def) continue
      const carry = dh.wearCarry[slot] ?? 0
      const events = c.n + c.double
      const r = c.kind === 'weapon' ? wearWeapon(t, def, inst, { events, carryBp: carry }) : c.kind === 'shield' ? wearShield(t, def, inst, { events, carryBp: carry }) : wearArmorPiece(t, def, inst, { events, carryBp: carry })
      dh.wearCarry[slot] = r.carryBp
      hero = { ...hero, equipment: withEquipmentSlot(hero.equipment, slot, r.destroyed ? null : r.inst) }
      if (r.destroyed) state.log.push({ floor: state.floor.number, roomId: state.floor.currentRoomId, kind: 'destroyed', text: `${hero.name}'s ${def.name} falls apart` })
    }

    // Level (§2.2).
    const level = heroLevelFromSkills(t, hero)
    if (level !== hero.level) hero = { ...hero, level }
    report.levelsGained = level - levelBefore

    // Pet XP (§9): half the owner's fight XP by participation.
    if (hero.petInstance && partyWork > 0 && totalMonsterXp > 0) {
      const share = (actor.tally.damageDealt + actor.tally.healingDone) / partyWork
      const d = difficultyMultiplier(t, fight.options.floorLevel, hero.level)
      const ownerXp = roundHalfUp((totalMonsterXp * share * d) / 100)
      let petXp = roundHalfUp((ownerXp * t.pets.xpSharePercent) / 100)
      if (dh.treatUsed) petXp = roundHalfUp(petXp * (1 + t.pets.treat.xpPercent / 100))
      const pet = { ...hero.petInstance, xp: hero.petInstance.xp + petXp }
      let lvl = pet.level
      let xpLeft = pet.xp
      while (lvl < hero.level && xpLeft >= petLevelCost(lvl + 1)) {
        xpLeft -= petLevelCost(lvl + 1)
        lvl++
      }
      hero = { ...hero, petInstance: { ...pet, level: lvl, xp: xpLeft } }
      report.petXp = petXp
    }

    hero = { ...hero, stats: { ...hero.stats, kills: hero.stats.kills + actor.tally.kills } }
    dh.record = hero
    for (const [k, v] of Object.entries(report.skillRanks)) dh.growth.skills[k] = (dh.growth.skills[k] ?? 0) + v
    for (const [k, v] of Object.entries(report.attributes)) dh.growth.attributes[k] = (dh.growth.attributes[k] ?? 0) + v
    for (const [k, v] of Object.entries(report.itemLevels)) dh.growth.items[k] = (dh.growth.items[k] ?? 0) + v
    dh.growth.insights.push(...report.insights)
    dh.growth.levelsGained += report.levelsGained
    reports.push(report)
  })
  return reports
}

/** Pet level N costs 40 × N XP (a Phase 2 placeholder; 03 §9 gives +2% per level but no curve — D-065). */
export function petLevelCost(level: number): number {
  return 40 * level
}

function gainAttributeCenti(t: Tuning, hero: HeroRecord, attr: TrainableAttribute, centi: number, report: FightProgressReport): HeroRecord {
  let xp = (hero.attributeXp[attr] ?? 0) + centi
  let value = hero.attributes[attr]
  let gained = 0
  let cost = attributePointCost(t, value + 1) * 100
  while (xp >= cost) {
    xp -= cost
    value += 1
    gained += 1
    cost = attributePointCost(t, value + 1) * 100
  }
  if (gained) report.attributes[attr] = (report.attributes[attr] ?? 0) + gained
  return { ...hero, attributes: { ...hero.attributes, [attr]: value }, attributeXp: { ...hero.attributeXp, [attr]: xp } }
}

/** One Insight roll after a meaningful use: a random unknown tier-adjacent skill of the school whose prerequisite is known. */
export function rollInsightFor(content: Content, t: Tuning, rng: Rng, hero: HeroRecord, dh: DelveHero, used: SkillDef, enemyLevel: number): SkillDef | null {
  const known = new Set(hero.skills.map((k) => k.skillId))
  const candidates = (content.skillsByClass.get(used.classId) ?? []).filter((s) => {
    if (known.has(s.id) || s.school !== used.school || s.isUltimate) return false
    if (Math.abs(s.tier - used.tier) > 1) return false
    if (s.tier >= 5 || s.monsterTechniqueOf) return false
    return s.prerequisiteId === null || known.has(s.prerequisiteId)
  })
  if (candidates.length === 0) {
    // No candidate: the use still counts toward pity only when something could be learned.
    return null
  }
  const target = rng.pick(candidates)
  const chance = insightChanceBp(t, enemyLevel, target.tier, hero.attributes.wisdom)
  return rollInsight(t, rng, dh.insight, chance) ? target : null
}

/** The post-fight state of a hero actor folded back into the delve hero (HP, pool, downed/fallen). */
export function carryHeroState(dh: DelveHero, actor: Actor): void {
  dh.hpPercent = actor.maxHp > 0 ? Math.max(0, Math.floor((actor.hp * 100) / actor.maxHp)) : 0
  dh.poolPercent = actor.poolMax > 0 ? Math.max(0, Math.floor((actor.pool * 100) / actor.poolMax)) : 100
  dh.downed = actor.downed
  dh.fallen = actor.fallen
  dh.record = { ...dh.record, bag: [...(actor.hero?.bag ?? dh.record.bag)] }
}
