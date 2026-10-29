import { quiverAfterFight } from './ammo.ts'
import type { Content } from './content.ts'
import type { DelveHero, DelveState } from './delve-types.ts'
import type { Actor, FightState } from './fight-types.ts'
import { applyBattleXpLevel, speciesRules } from './hero.ts'
import { insightChanceBp, rollInsight, rollTechnique } from './insight.ts'
import { gainItemXp, wearArmorPiece, wearShield, wearWeapon } from './items.ts'
import { monsterXp } from './monsters.ts'
import type { Rng } from './rng.ts'
import { roundHalfUp } from './stats.ts'
import { monsterThreatLevel, partyLevelOf, threatMonsterOf } from './threat.ts'
import { createTome, isObtainable, isTechnique } from './tomes.ts'
import type { Tuning } from './tuning.ts'
import type { Equipment, HeroRecord, ItemInstance, KnownSkill, MonsterDef, SkillDef } from './types/content.ts'
import { TRAINABLE_ATTRIBUTES, type Attribute, type FieldSkill, type TrainableAttribute } from './types/enums.ts'
import { attributeGainAboveCap, attributePointCost, attributeSoftCap, difficultyMultiplier, isGated, levelGapMultiplier, skillRankFor, skillRankThreshold, useBudgetPercent, useXp } from './xp.ts'

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
  /** Battle XP this fight gave (D-082). */
  battleXp: number
  petXp: number
}

/**
 * A won fight's battle-XP pool (D-096, James): each defeated monster's XP × the level gap between that monster (read
 * as the threat chip reads it: +1 per champion affix, +3 for a boss or the hunter) and the party's level — the average
 * of the heroes who fought, rounded down. The heroes standing split it (applyFightProgress).
 */
export function fightXpPool(t: Tuning, fight: FightState): number {
  const partyLevel = partyLevelOf(fight.actors.filter((a) => a.kind === 'hero' && a.side === 'party').map((a) => a.level))
  return fight.actors
    .filter((a) => a.monster && a.gone && !a.fled)
    .reduce((s, a) => s + roundHalfUp((monsterXp(t, a) * levelGapMultiplier(t, monsterThreatLevel(t, threatMonsterOf(a)) - partyLevel)) / 100), 0)
}

/** Applies a finished fight's XP and wear events to the delve's heroes. */
export function applyFightProgress(content: Content, t: Tuning, rng: Rng, state: DelveState, fight: FightState, heroActorIds: string[]): FightProgressReport[] {
  const reports: FightProgressReport[] = []
  const knobXp = state.knobs.xpPercent ?? 100
  const mainFamily = fight.actors.find((a) => a.monster)?.monster?.familyId ?? null
  // Participation shares for pet XP (03 §5.3, §9).
  const partyWork = fight.actors.filter((a) => a.kind === 'hero').reduce((s, a) => s + a.tally.damageDealt + a.tally.healingDone, 0)
  const xpPool = fightXpPool(t, fight)
  const witnessed = witnessedTechniques(content, fight)

  heroActorIds.forEach((actorId, heroIndex) => {
    const dh = state.heroes[heroIndex]
    const actor = fight.actors.find((a) => a.id === actorId)
    if (!dh || !actor) return
    let hero = dh.record
    const report: FightProgressReport = { heroIndex, skillRanks: {}, attributes: {}, itemLevels: {}, insights: [], levelsGained: 0, battleXp: 0, petXp: 0 }
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
        // Insight (§7.5): one roll per meaningful use, toward one unknown tier-adjacent skill of the school. The pity
        // counter lives on the hero (insightPity) so 60 qualifying uses across delves bring one; the party gets a Tome.
        const counter = { usesSincePity: hero.insightPity ?? dh.insight.usesSincePity }
        const learned = rollInsightFor(content, t, rng, hero, counter, skill, ev.enemyLevel)
        dh.insight.usesSincePity = counter.usesSincePity
        hero = { ...hero, insightPity: counter.usesSincePity }
        if (learned) {
          hero = { ...hero, skills: [...hero.skills, { skillId: learned.id, rank: 1, xp: 0 }] }
          report.insights.push(learned.id)
          state.stats.insights += 1
          if (t.skills.tomes.insightDropsTome) {
            state.pile.push(createTome(content, rng, learned.id))
            state.stats.itemsFound += 1
          }
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

    // Monster techniques (09 §4, D-028, D-099): each witnessed use of a technique's move rolls; the Nth is certain.
    if (!actor.fallen) {
      for (const skillId of witnessed) {
        const r = rollTechniqueFor(content, t, rng, hero, skillId)
        hero = r.hero
        if (r.learned) {
          report.insights.push(skillId)
          state.stats.insights += 1
        }
      }
    }

    // Floor-limited passives (D-099: Undying Rage once per floor, Deathless twice): the fight logged each trigger.
    for (const e of fight.log) {
      if (e.kind !== 'floorLimit' || e.actorId !== actorId || typeof e.data?.skillId !== 'string') continue
      const key = floorUseKey(state.floor.number, e.data.skillId)
      dh.skillUses[key] = (dh.skillUses[key] ?? 0) + 1
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
      const share = (w.percent ?? 100) / 100
      c.n += share
      if (w.double) c.double += share
      counts.set(key, c)
    }
    for (const [slot, c] of counts) {
      const inst = equipmentSlotInstance(hero.equipment, slot)
      const def = inst ? content.items.get(inst.itemId) : undefined
      if (!inst || !def) continue
      const carry = dh.wearCarry[slot] ?? 0
      // Pact: Brittle — durability wears ×1.5 (the `wearPercent` knob, 07 §6.2).
      const events = ((c.n + c.double) * (state.knobs.wearPercent ?? 100)) / 100
      const r = c.kind === 'weapon' ? wearWeapon(t, def, inst, { events, carryBp: carry }) : c.kind === 'shield' ? wearShield(t, def, inst, { events, carryBp: carry }) : wearArmorPiece(t, def, inst, { events, carryBp: carry })
      dh.wearCarry[slot] = r.carryBp
      hero = { ...hero, equipment: withEquipmentSlot(hero.equipment, slot, r.destroyed ? null : r.inst) }
      if (r.destroyed) state.log.push({ floor: state.floor.number, roomId: state.floor.currentRoomId, kind: 'destroyed', text: `${hero.name}'s ${def.name} falls apart` })
    }

    // Battle XP and the level (D-082, D-096): the heroes standing at the end of a won fight split the pool, normalised to
    // the 3-hero table — each takes pool × 3 ÷ standing heroes — then their own XP bonuses. A solo hero levels faster
    // per fight; a weaker hero lowers the party's level, so everyone's pool grows, but takes only an equal share.
    if (fight.over?.outcome === 'victory' && !actor.fallen && xpPool > 0) {
      const standing = Math.max(1, fight.actors.filter((a) => a.kind === 'hero' && !a.fallen).length)
      const share = (xpPool * t.dungeon.partyScaling.tunedFor) / standing
      const gain = roundHalfUp((share * (100 + extra)) / 100)
      hero = applyBattleXpLevel(content, t, { ...hero, battleXp: hero.battleXp + Math.max(0, gain) })
      report.battleXp = Math.max(0, gain)
    }
    report.levelsGained = hero.level - levelBefore

    // Pet XP (§9): half the owner's share of the pool by participation.
    if (hero.petInstance && partyWork > 0 && xpPool > 0) {
      const share = (actor.tally.damageDealt + actor.tally.healingDone) / partyWork
      const ownerXp = roundHalfUp(xpPool * share)
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

/**
 * One Insight roll after a meaningful use: a random unknown tier-adjacent skill of the school whose prerequisite is
 * known. Never the Ultimate, a technique (09 §4: those come only by witnessing) or a tier the game keeps locked (Tier V,
 * D-099). `counter` is the pity (the hero's insightPity); the roll advances it.
 */
export function rollInsightFor(content: Content, t: Tuning, rng: Rng, hero: HeroRecord, counter: { usesSincePity: number }, used: SkillDef, enemyLevel: number): SkillDef | null {
  const known = new Set(hero.skills.map((k) => k.skillId))
  const candidates = (content.skillsByClass.get(used.classId) ?? []).filter((s) => {
    if (known.has(s.id) || s.school !== used.school || s.isUltimate) return false
    if (Math.abs(s.tier - used.tier) > 1) return false
    if (!isObtainable(t, s) || isTechnique(s)) return false
    return s.prerequisiteId === null || known.has(s.prerequisiteId)
  })
  if (candidates.length === 0) {
    // No candidate: the use still counts toward pity only when something could be learned.
    return null
  }
  const target = rng.pick(candidates)
  const chance = insightChanceBp(t, enemyLevel, target.tier, hero.attributes.wisdom)
  return rollInsight(t, rng, counter, chance) ? target : null
}

/* ---------- monster techniques (09 §4, 06 §8.8; D-028, D-099) ---------- */

/** The attack a monster's 'action' log entry names: `data.attackId` (fight.ts), else its name read from the text. */
function attackIdOf(def: MonsterDef, actorName: string, text: string, data: Readonly<Record<string, unknown>> | undefined): string | null {
  if (typeof data?.attackId === 'string') return data.attackId
  for (const a of def.attacks) if (text === `${actorName} uses ${a.name}` || text.startsWith(`${actorName} uses ${a.name} on `)) return a.id
  return null
}

/**
 * The technique skills a fight let its heroes witness, one entry per use of a technique's move: a monster that carries
 * the technique (monsterTechniqueSkillIds, linked back by the skill's monsterTechniqueOf) took one of the skill's
 * monsterTechniqueMoveIds (any of its attacks when the skill names none). A summoned copy teaches like any other.
 */
export function witnessedTechniques(content: Content, fight: FightState): string[] {
  const out: string[] = []
  for (const e of fight.log) {
    if (e.kind !== 'action' || !e.actorId) continue
    const actor = fight.actors.find((a) => a.id === e.actorId)
    const monsterId = actor?.monster?.monsterId
    if (!actor || !monsterId) continue
    const def = content.monsters.get(monsterId)
    if (!def || def.monsterTechniqueSkillIds.length === 0) continue
    const attackId = attackIdOf(def, actor.name, e.text, e.data)
    for (const skillId of def.monsterTechniqueSkillIds) {
      const skill = content.skills.get(skillId)
      if (!skill || skill.monsterTechniqueOf !== monsterId) continue
      const moves = skill.monsterTechniqueMoveIds
      if (moves && moves.length > 0 && (attackId === null || !moves.includes(attackId))) continue
      out.push(skillId)
    }
  }
  return out
}

/**
 * One witnessed use of a technique for one hero: a hero of the skill's class who does not know it and knows its
 * prerequisite (tuning techniques.needsPrerequisite; the Mender sheet's §8 example) rolls the flat chance; the count of
 * qualifying witnessed uses lives on the hero (techniqueWitness) and the Nth (techniques.guaranteedByUse) is certain.
 * A learned technique drops no Tome (it is learned only by witnessing).
 */
export function rollTechniqueFor(content: Content, t: Tuning, rng: Rng, hero: HeroRecord, skillId: string): { hero: HeroRecord; learned: boolean } {
  const skill = content.skills.get(skillId)
  if (!skill || skill.classId !== hero.classId || !isObtainable(t, skill)) return { hero, learned: false }
  const known = new Set(hero.skills.map((k) => k.skillId))
  if (known.has(skillId)) return { hero, learned: false }
  if (t.techniques.needsPrerequisite.value && skill.prerequisiteId !== null && !known.has(skill.prerequisiteId)) return { hero, learned: false }
  const seen = (hero.techniqueWitness?.[skillId] ?? 0) + 1
  if (rollTechnique(t, rng, seen)) {
    const { [skillId]: _done, ...rest } = hero.techniqueWitness ?? {}
    void _done
    return { hero: { ...hero, skills: [...hero.skills, { skillId, rank: 1, xp: 0 }], techniqueWitness: rest }, learned: true }
  }
  return { hero: { ...hero, techniqueWitness: { ...(hero.techniqueWitness ?? {}), [skillId]: seen } }, learned: false }
}

/* ---------- field skills (03 §5.2, §7.6; 09 §5) ---------- */

/**
 * A field skill's XP after a use, and the rank it reaches (03 §5.2: field skills grow "by each successful use" on "the
 * same rank curve" as skills — rank N at 100 × 1.5^(N−1) XP, rank 10 the top). A rank given at creation (a class's +2,
 * a species trait) or by a Tome has no XP behind it, so the gain counts from that rank's threshold: the head start
 * stays a head start. fix (Phase 8): the delve added field-skill XP but never turned it into rank, so no field skill
 * ever grew by use. Returns the record and the ranks gained.
 */
export function gainFieldSkillXp(t: Tuning, hero: HeroRecord, skill: FieldSkill, amount: number): { hero: HeroRecord; ranks: number } {
  const cur = hero.fieldSkills[skill]
  if (!cur || amount <= 0) return { hero, ranks: 0 }
  const xp = Math.max(cur.xp, skillRankThreshold(t, cur.rank)) + Math.floor(amount)
  const rank = Math.min(t.xp.skill.maxRank, Math.max(cur.rank, skillRankFor(t, xp)))
  return { hero: { ...hero, fieldSkills: { ...hero.fieldSkills, [skill]: { rank, xp } } }, ranks: rank - cur.rank }
}

/**
 * Cartography's use (09 §5; 03 §5.2 "map"): entering a room of the floor for the first time maps it, and the hero whose
 * Cartography draws the party's map — the best rank, `ranks` as the delve reads them (Wayfinder's +2 counts), the
 * first in the party on a tie — earns XP for it as a skill use does (03 §5.1–§5.2): `xp.skill.xpPerUse` × D(the floor's
 * monster level − the hero's level), within the gate and the per-delve use budget (its count under `field:cartography`
 * in the hero's `skillUses`). Returns the hero's index, or −1 when nobody maps (no standing hero, or nothing gated).
 */
export function trainCartography(t: Tuning, state: DelveState, ranks: readonly number[], floorLevel: number): number {
  let best = -1
  for (let i = 0; i < state.heroes.length; i++) {
    const h = state.heroes[i]
    // The heroes whose rank the map reads (delve.ts cartographyReveal: the living).
    if (!h || h.fallen) continue
    if (best < 0 || (ranks[i] ?? 0) > (ranks[best] ?? 0)) best = i
  }
  const dh = best >= 0 ? state.heroes[best] : undefined
  if (!dh) return -1
  const key = 'field:cartography'
  const uses = dh.skillUses[key] ?? 0
  const gain = useXp(t, t.xp.skill.xpPerUse, floorLevel, dh.record.level, uses)
  dh.skillUses[key] = uses + 1
  if (gain <= 0) return -1
  dh.record = gainFieldSkillXp(t, dh.record, 'cartography', gain).hero
  return best
}

/* ---------- floor-limited passives (D-099) ---------- */

function floorUseKey(floor: number, skillId: string): string {
  return `floor:${floor}:${skillId}`
}

/**
 * A delve hero's floor-limited passive triggers on `floor` so far (skill id → count), for buildHeroActor's floorUses: a
 * passive whose effect is limited per floor (Undying Rage once, Deathless twice) reads it as its hook's data.floorUsed,
 * logs a 'floorLimit' event (data.skillId) when it fires, and applyFightProgress adds the event to the count.
 */
export function floorUsesFor(dh: DelveHero, floor: number): Record<string, number> {
  const prefix = `floor:${floor}:`
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(dh.skillUses)) if (k.startsWith(prefix) && v > 0) out[k.slice(prefix.length)] = v
  return out
}

/** The post-fight state of a hero actor folded back into the delve hero (HP, pool, downed/fallen). */
export function carryHeroState(dh: DelveHero, actor: Actor): void {
  dh.hpPercent = actor.maxHp > 0 ? Math.max(0, Math.floor((actor.hp * 100) / actor.maxHp)) : 0
  dh.poolPercent = actor.poolMax > 0 ? Math.max(0, Math.floor((actor.pool * 100) / actor.poolMax)) : 100
  dh.downed = actor.downed
  dh.fallen = actor.fallen
  dh.record = { ...dh.record, bag: [...(actor.hero?.bag ?? dh.record.bag)] }
  // Arrows (08 §4, D-099): what the fight left in the quiver, plus Forager's Instinct's share (sim/src/ammo.ts).
  dh.record = quiverAfterFight(dh.record, actor)
}
