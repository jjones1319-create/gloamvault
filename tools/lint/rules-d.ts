/**
 * Cross-file rules 55–57 (Phase 7, pass D): the Pacts and presets, the Quest Board's contracts, and the pets' trait
 * growth (content/README.md "What the linter checks that the schema cannot", rules 55–57). Same contract as rules.ts:
 * each returns `{ file, rule, message }[]`; a rule skips what rule 2 already reports. The names the sim implements
 * (Pact rule flags, contract conditions) are read from the sim itself, so a typo in the content is a lint failure,
 * never a silent no-op.
 */
import { CONTRACT_CONDITIONS } from '../../sim/src/contracts.ts'
import { PACT_RULE_FLAGS } from '../../sim/src/pacts.ts'
import { at, defined, num, obj, objs, str, strs, tnum, type JsonObject } from './json.ts'
import type { Ctx, Failure } from './rules.ts'

function fail(file: string, rule: number, message: string): Failure {
  return { file, rule, message }
}

function tuningOf(ctx: Ctx): JsonObject | undefined {
  return obj(ctx.corpus.byKind.get('tuning')?.[0]?.json)
}

function tuningFile(ctx: Ctx): string {
  return ctx.corpus.byKind.get('tuning')?.[0]?.path ?? 'content/tuning.json'
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 55: Pacts (07 §6.2) — every rule flag is one the sim implements (sim/src/pacts.ts PACT_RULE_FLAGS); a Pact that
// moves the hunter (a hunterClock knob or the twin-hunter flag) says needsHunter, and one that says it moves the
// hunter ("No hunter, no hunter Pact": the menu greys it out where no floor of the zone runs a hunter clock); Thin
// Line's kind of change is a delta (revivesPerFloorDelta), never a fixed revivesPerFloor that would ignore the preset;
// the Oath's tiers in tuning (pacts.oathTiers) climb.

const KNOWN_FLAGS: ReadonlySet<string> = new Set(PACT_RULE_FLAGS)

export function rule55(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const d of ctx.dungeons.values()) {
    for (const p of objs(d.json.pacts)) {
      const id = str(p.id) ?? '?'
      for (const f of strs(p.ruleFlags)) if (!KNOWN_FLAGS.has(f)) out.push(fail(d.file, 55, `pact '${id}' carries rule flag '${f}', which the sim does not implement (sim/src/pacts.ts PACT_RULE_FLAGS: ${[...KNOWN_FLAGS].join(', ')})`))
      const movesHunter = num(at(p, 'knobs', 'hunterClock')) !== undefined || strs(p.ruleFlags).includes('twin-hunter')
      const says = p.needsHunter === true
      if (movesHunter && !says) out.push(fail(d.file, 55, `pact '${id}' moves the hunter but does not say needsHunter: true (07 §6.2 "No hunter, no hunter Pact")`))
      if (says && !movesHunter) out.push(fail(d.file, 55, `pact '${id}' says needsHunter but neither sets knobs.hunterClock nor carries 'twin-hunter'`))
      if (num(at(p, 'knobs', 'revivesPerFloor')) !== undefined) out.push(fail(d.file, 55, `pact '${id}' sets knobs.revivesPerFloor, which would ignore the preset; a Pact takes revives away with revivesPerFloorDelta`))
    }
    // A dungeon whose every zone lacks a hunter clock should not list hunter Pacts at all: they would never be offered.
    const floors = objs(d.json.floors)
    const anyClock = floors.some((f) => num(f.hunterClock) !== undefined)
    if (!anyClock) for (const p of objs(d.json.pacts)) if (p.needsHunter === true) ctx.warnings.push(fail(d.file, 55, `pact '${str(p.id) ?? '?'}' needs a hunter, and no floor of this dungeon runs a hunter clock`))
  }
  const tiers = objs(at(tuningOf(ctx), 'pacts', 'oathTiers'))
  let last = 0
  for (const tier of tiers) {
    const atOath = num(tier.at)
    if (atOath === undefined || atOath <= last) out.push(fail(tuningFile(ctx), 55, `pacts.oathTiers must climb: tier at ${String(tier.at)} after ${last}`))
    else last = atOath
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 56: contracts (07 §7) — the condition's fields match its kind (kill and noWipe count something: a family, a
// monster, monsters or a hunter/arena condition; clear names where; light a light threshold; collect a count or gold);
// a condition is one the sim checks (sim/src/contracts.ts CONTRACT_CONDITIONS) with the fields it reads; monsterIds and
// the curioId resolve (a curio of the target dungeon); a weekly is written for a band; every contract pays something,
// and no contract pays more keys of a kind than the week's cap (tuning contracts.keyCapPerWeek); the board can be
// filled — at least `contracts.dailies` dailies and one weekly once any contract exists.

const CONDITION_KIND: Readonly<Record<string, readonly string[]>> = {
  'zone-hunter': ['kill', 'noWipe'],
  'tide-below-step-4': ['kill'],
  'at-stairs': ['light'],
  'chests-opened-one-floor': ['light'],
  'parts-sold-one-delve': ['collect'],
  'no-curio-opened': ['clear'],
}
const KNOWN_CONDITIONS: ReadonlySet<string> = new Set(CONTRACT_CONDITIONS)

export function rule56(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const t = tuningOf(ctx)
  const cap = { standard: tnum(at(t, 'contracts', 'keyCapPerWeek', 'standard')) ?? 3, grand: tnum(at(t, 'contracts', 'keyCapPerWeek', 'grand')) ?? 1 }
  let dailies = 0
  let weeklies = 0
  for (const c of ctx.contracts.values()) {
    const kind = str(c.json.kind) ?? ''
    const target = obj(c.json.target) ?? {}
    const has = (k: string) => target[k] !== undefined
    const condition = str(target.condition)
    if (str(c.json.cadence) === 'daily') dailies++
    if (str(c.json.cadence) === 'weekly') weeklies++
    if (condition !== undefined) {
      if (!KNOWN_CONDITIONS.has(condition)) out.push(fail(c.file, 56, `target.condition '${condition}' is not one the sim checks (sim/src/contracts.ts: ${[...KNOWN_CONDITIONS].join(', ')})`))
      else if (!(CONDITION_KIND[condition] ?? []).includes(kind)) out.push(fail(c.file, 56, `condition '${condition}' is for a ${(CONDITION_KIND[condition] ?? []).join('/')} contract, not '${kind}'`))
    }
    switch (kind) {
      case 'kill':
      case 'noWipe':
        if (!has('count')) out.push(fail(c.file, 56, `a ${kind} contract needs target.count`))
        if (!has('familyId') && !has('monsterId') && !has('monsterIds') && condition !== 'zone-hunter') out.push(fail(c.file, 56, `a ${kind} contract counts a familyId, a monsterId, monsterIds or the 'zone-hunter' condition`))
        break
      case 'clear':
        if (!has('zoneId') && !has('floor') && !has('dungeonId')) out.push(fail(c.file, 56, 'a clear contract names a zoneId, a floor or a dungeonId'))
        break
      case 'light':
        if (!has('lightMin') && !has('lightMax')) out.push(fail(c.file, 56, 'a light contract needs target.lightMin or lightMax'))
        if (condition === undefined) out.push(fail(c.file, 56, "a light contract says where the light is read: condition 'at-stairs' or 'chests-opened-one-floor'"))
        break
      case 'collect':
        if (!has('count') && !has('goldR')) out.push(fail(c.file, 56, 'a collect contract needs target.count or goldR'))
        if (has('count') && condition !== 'parts-sold-one-delve') out.push(fail(c.file, 56, "a collect contract that counts names what: condition 'parts-sold-one-delve'"))
        break
      default:
        break
    }
    if (condition === 'chests-opened-one-floor' && !has('count')) out.push(fail(c.file, 56, "'chests-opened-one-floor' needs target.count (chests on one floor)"))
    if (condition === 'tide-below-step-4' && !has('monsterId')) out.push(fail(c.file, 56, "'tide-below-step-4' needs target.monsterId (the boss of the tide)"))
    if (condition === 'no-curio-opened' && !has('curioId')) out.push(fail(c.file, 56, "'no-curio-opened' needs target.curioId"))
    for (const id of strs(target.monsterIds)) if (!ctx.monsters.has(id)) out.push(fail(c.file, 56, `target.monsterIds: no monster '${id}'`))
    const curio = str(target.curioId)
    if (curio !== undefined) {
      const did = str(target.dungeonId)
      const dungeons = did !== undefined ? [ctx.dungeons.get(did)].filter(defined) : [...ctx.dungeons.values()]
      if (!dungeons.some((d) => objs(d.json.curios).some((x) => str(x.id) === curio))) out.push(fail(c.file, 56, `target.curioId '${curio}' is not a curio of ${did ?? 'any dungeon'}`))
    }
    if (str(c.json.cadence) === 'weekly' && num(c.json.band) === undefined) out.push(fail(c.file, 56, 'a weekly is written for a band (07 §7: a boss of one dungeon); band is null'))
    const reward = obj(c.json.reward) ?? {}
    const keys = objs(reward.keys)
    const pays = (num(reward.goldR) ?? 0) > 0 || keys.length > 0 || objs(reward.items).length > 0 || str(reward.chestId) !== undefined
    if (!pays) out.push(fail(c.file, 56, 'the contract pays nothing'))
    for (const tier of ['standard', 'grand'] as const) {
      const n = keys.filter((k) => str(k.kind) === tier).reduce((s, k) => s + (num(k.amount) ?? 0), 0)
      if (n > cap[tier]) out.push(fail(c.file, 56, `pays ${n} ${tier} keys; the week's cap is ${cap[tier]} (07 §7)`))
    }
  }
  if (ctx.contracts.size > 0) {
    const need = tnum(at(t, 'contracts', 'dailies')) ?? 3
    if (dailies < need) out.push(fail('content/contracts', 56, `${dailies} daily contracts; the board posts ${need} a day`))
    if (weeklies < 1) out.push(fail('content/contracts', 56, 'no weekly contract; the board posts one a week'))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 57: pet traits grow by use (03 §9) — every species' trait.growsBy names a tag tuning's pets.traitGrowth.sources
// maps to a source the sim counts (finds, hitsTaken, hitsLanded, actions) with a weight; usesForRank starts at 0 and
// climbs; the rank's step is not negative.

const GROWTH_SOURCES: ReadonlySet<string> = new Set(['finds', 'hitsTaken', 'hitsLanded', 'actions'])

export function rule57(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const growth = obj(at(tuningOf(ctx), 'pets', 'traitGrowth'))
  if (!growth) return ctx.pets.size > 0 ? [fail(tuningFile(ctx), 57, 'pets.traitGrowth is missing: the pets\' traits cannot grow (03 §9)')] : []
  const sources = obj(growth.sources) ?? {}
  const weights = obj(growth.weights) ?? {}
  for (const [tag, src] of Object.entries(sources)) {
    const s = str(src)
    if (s === undefined || !GROWTH_SOURCES.has(s)) out.push(fail(tuningFile(ctx), 57, `pets.traitGrowth.sources.${tag} is '${String(src)}', not one the sim counts (${[...GROWTH_SOURCES].join(', ')})`))
    else if (num(weights[s]) === undefined) out.push(fail(tuningFile(ctx), 57, `pets.traitGrowth.weights has no weight for '${s}'`))
  }
  const ranks = (Array.isArray(growth.usesForRank) ? growth.usesForRank : []).map((v) => num(v))
  if (ranks.length < 2 || ranks[0] !== 0) out.push(fail(tuningFile(ctx), 57, 'pets.traitGrowth.usesForRank starts at 0 and lists at least two ranks'))
  for (let i = 1; i < ranks.length; i++) if (ranks[i] === undefined || ranks[i]! <= ranks[i - 1]!) out.push(fail(tuningFile(ctx), 57, `pets.traitGrowth.usesForRank must climb (rank ${i + 1})`))
  if ((num(growth.effectPercentPerRank) ?? -1) < 0) out.push(fail(tuningFile(ctx), 57, 'pets.traitGrowth.effectPercentPerRank is a number ≥ 0'))
  for (const p of ctx.pets.values()) {
    const tag = str(at(p.json, 'trait', 'growsBy'))
    if (tag !== undefined && sources[tag] === undefined) out.push(fail(p.file, 57, `trait.growsBy '${tag}' has no source in tuning pets.traitGrowth.sources: the trait would never grow`))
  }
  return out
}

export const RULES_D: ReadonlyArray<{ n: number; run: (ctx: Ctx) => Failure[] }> = [
  { n: 55, run: rule55 },
  { n: 56, run: rule56 },
  { n: 57, run: rule57 },
]
