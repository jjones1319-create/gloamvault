/**
 * The item rules of content/README.md, numbered 40–44 (pass B's block, Phase 7): eggs and their pets, keys,
 * consumables and ammo, sets and named uniques, relics and item tags. They run with the rest from rules.ts (RULES)
 * and read the same context; rule 2 still owns existence, so a dangling id is reported there, not here.
 */
import { at, num, obj, objs, str, strs, type JsonObject } from './json.ts'
import type { Ctx, Failure, Rec } from './rules.ts'

/** rules.ts's `fail`, kept local so this file imports only types from rules.ts (no import cycle at load). */
function fail(file: string, rule: number, message: string): Failure {
  return { file, rule, message }
}

const CHEST_TIERS = ['standard', 'grand'] as const
const STACKABLE_DROP_KINDS: ReadonlySet<string> = new Set(['consumable', 'ammo', 'treat'])

function tagsOf(it: Rec): string[] {
  return strs(it.json.tags)
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 40: an egg item is `<pet>-egg` of a pet species, and every species a chest or a monster hatches has its egg.

function rule40(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const eggs = [...ctx.items.values()].filter((it) => str(it.json.kind) === 'egg')
  const eggOf = new Set<string>()
  for (const egg of eggs) {
    const petId = egg.id.endsWith('-egg') ? egg.id.slice(0, -4) : null
    if (petId === null) out.push(fail(egg.file, 40, `an egg's id is '<pet id>-egg'; '${egg.id}' does not end in -egg`))
    else if (!ctx.pets.has(petId)) out.push(fail(egg.file, 40, `egg '${egg.id}' names pet '${petId}', which has no content/pets/ file`))
    else eggOf.add(petId)
    if (str(egg.json.slot) !== undefined && egg.json.slot !== null) out.push(fail(egg.file, 40, `an egg is carried, not worn: slot must be null`))
  }
  if (eggs.length === 0) return out
  for (const pet of ctx.pets.values()) if (!eggOf.has(pet.id)) out.push(fail(pet.file, 40, `pet '${pet.id}' has no egg item (content/items/egg/${pet.id}-egg.json)`))
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 41: keys say what they open — `skeleton-key` (a locked chest or door, 07 §2.7) or `chest-key:<tier>` (one
// Curio Merchant chest of that tier free, 07 §7); one chest key per tier; every key tier a contract pays has its key.
// Gated (D-049): it applies once some key carries such a tag — a corpus from before Phase 7 (the test fixture) has none.

function rule41(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const keyByTier = new Map<string, string>()
  const tiersSold = new Set(strs([...ctx.chests.values()].map((c) => c.json.tier)))
  const keys = [...ctx.items.values()].filter((it) => str(it.json.kind) === 'key')
  if (!keys.some((it) => tagsOf(it).some((t) => t === 'skeleton-key' || t.startsWith('chest-key:')))) return out
  for (const it of ctx.items.values()) {
    if (str(it.json.kind) !== 'key') continue
    const opens = tagsOf(it).filter((t) => t === 'skeleton-key' || t.startsWith('chest-key:'))
    if (opens.length !== 1) out.push(fail(it.file, 41, `a key carries exactly one of the tags 'skeleton-key' or 'chest-key:<tier>' (has ${opens.length})`))
    for (const t of opens) {
      if (!t.startsWith('chest-key:')) continue
      const tier = t.slice('chest-key:'.length)
      if (!(CHEST_TIERS as readonly string[]).includes(tier)) out.push(fail(it.file, 41, `tag '${t}' names tier '${tier}'; chests are ${CHEST_TIERS.join(' or ')}`))
      else if (tiersSold.size > 0 && !tiersSold.has(tier)) out.push(fail(it.file, 41, `tag '${t}': no chest of tier '${tier}' exists for it to open`))
      const first = keyByTier.get(tier)
      if (first !== undefined) out.push(fail(it.file, 41, `a second ${tier} chest key (with '${first}'); one key item per tier`))
      else keyByTier.set(tier, it.id)
    }
    for (const field of ['consumable', 'active', 'ammo'] as const) if (it.json[field] !== null && it.json[field] !== undefined) out.push(fail(it.file, 41, `a key has no ${field} block`))
  }
  for (const c of ctx.contracts.values()) {
    for (const k of objs(at(c.json, 'reward', 'keys'))) {
      const tier = str(k.kind)
      if (tier !== undefined && !keyByTier.has(tier)) out.push(fail(c.file, 41, `pays a ${tier} key, but no key item carries 'chest-key:${tier}'`))
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 42: consumables and ammo — the kind and its block agree; a consumable usable in a fight does something; a
// loot table's consumable drops are consumables, ammo or treats; a starter kit's stack fits; a merchant safe item
// ('safe-item') is a consumable tagged with exactly one zone of a dungeon (07 §2.7 stocks "the zone's safe items").

function rule42(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const it of ctx.items.values()) {
    const kind = str(it.json.kind)
    const cons = obj(it.json.consumable)
    if (kind === 'consumable' && !cons) out.push(fail(it.file, 42, 'a consumable needs its consumable block'))
    if (kind === 'ammo' && !obj(it.json.ammo)) out.push(fail(it.file, 42, 'ammo needs its ammo block (stack size)'))
    if (kind !== 'ammo' && obj(it.json.ammo)) out.push(fail(it.file, 42, `only ammo carries an ammo block (kind '${kind ?? '?'}')`))
    if (cons && cons.inCombat === true && objs(cons.effects).length === 0) out.push(fail(it.file, 42, 'usable in a fight but its consumable.effects is empty: the Item action would do nothing'))
    const tags = tagsOf(it)
    const zones = tags.filter((t) => t.startsWith('zone:')).map((t) => t.slice('zone:'.length))
    for (const z of zones) if (ctx.allZoneIds.size > 0 && !ctx.allZoneIds.has(z)) out.push(fail(it.file, 42, `tag 'zone:${z}' is not a zone of any dungeon`))
    if (tags.includes('safe-item')) {
      if (kind !== 'consumable') out.push(fail(it.file, 42, `a 'safe-item' is a consumable (kind '${kind ?? '?'}')`))
      if (zones.length !== 1) out.push(fail(it.file, 42, `a 'safe-item' names exactly one zone with a 'zone:<id>' tag (has ${zones.length})`))
    }
  }
  for (const lt of ctx.lootTables.values()) {
    for (const id of strs(at(lt.json, 'consumableDrop', 'itemIds'))) {
      const it = ctx.items.get(id)
      if (it && !STACKABLE_DROP_KINDS.has(str(it.json.kind) ?? '')) out.push(fail(lt.file, 42, `consumableDrop names '${id}', a ${str(it.json.kind) ?? '?'}; it drops consumables, ammo or treats`))
    }
  }
  const kitQty = obj(at(ctx.corpus.byKind.get('tuning')?.[0]?.json, 'equipment', 'starterKitQuantities')) ?? {}
  for (const [id, q] of Object.entries(kitQty)) {
    const it = ctx.items.get(id)
    const stack = num(at(it?.json, 'consumable', 'stackMax')) ?? num(at(it?.json, 'ammo', 'stack'))
    const qty = num(q)
    if (it && stack !== undefined && qty !== undefined && qty > stack && str(it.json.kind) !== 'ammo') out.push(fail(it.file, 42, `the starter kit gives ${qty} but the stack holds ${stack}`))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 43: sets and named uniques — a set has a piece of every armor slot at each grade it drops at, and every piece
// below the top grade written has a next-grade piece in the same set and slot (08 §6: "A set keeps its membership
// through promotion"); a named unique (not God) is B or above with a signature (08 §7: "named uniques exist from B up").

function rule43(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const grades = ctx.t.grades
  const gi = (g: unknown): number => grades.indexOf(str(g) ?? '')
  const god = grades[grades.length - 1] ?? 'God'
  for (const s of ctx.sets.values()) {
    const family = str(s.json.family)
    if (family === undefined || family === 'ringPair') continue
    const pieces = [...ctx.items.values()].filter((it) => str(it.json.setId) === s.id)
    const top = Math.max(-1, ...pieces.map((it) => gi(it.json.grade)))
    const at2 = new Map<string, Rec>()
    for (const it of pieces) at2.set(`${str(it.json.slot) ?? '?'}@${gi(it.json.grade)}`, it)
    const lo = gi(s.json.gradeMin)
    const hi = s.json.gradeMax === null ? top : gi(s.json.gradeMax)
    for (let g = lo; g >= 0 && g <= hi; g++) {
      for (const slot of ['helmet', 'chest', 'legs', 'boots', 'gloves']) if (!at2.has(`${slot}@${g}`)) out.push(fail(s.file, 43, `drops at grade ${grades[g] ?? g} but has no ${slot} piece of that grade`))
    }
    for (const it of pieces) {
      const g = gi(it.json.grade)
      if (g < top && !at2.has(`${str(it.json.slot) ?? '?'}@${g + 1}`)) out.push(fail(it.file, 43, `set piece at ${str(it.json.grade) ?? '?'} has no ${grades[g + 1] ?? '?'} piece of '${s.id}' to promote into, so promotion would drop the set`))
    }
  }
  for (const it of ctx.items.values()) {
    if (it.json.unique !== true || str(it.json.grade) === god) continue
    if (gi(it.json.grade) < gi('B')) out.push(fail(it.file, 43, `a named unique is B or above (08 §7); this one is ${str(it.json.grade) ?? '?'}`))
    if (!obj(it.json.uniquePower)) out.push(fail(it.file, 43, 'a named unique carries its signature line (uniquePower)'))
    if (it.json.setId !== null && it.json.setId !== undefined) out.push(fail(it.file, 43, 'a named unique is not a set piece'))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 44: relics and item tags — an instant or after-fight relic has no action weight, any other one an Item
// action's (tuning combat.weights.item); a 'boss-only' item is something a boss gives (a reward line names it;
// a warning until the boss is written); a 'regional' material sits on a ladder rung that also has its first name.

function rule44(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const itemWeight = num(at(ctx.corpus.byKind.get('tuning')?.[0]?.json, 'combat', 'weights', 'item')) ?? 600
  const bossRewards = new Set<string>()
  for (const m of ctx.monsters.values()) {
    for (const list of ['everyKill', 'firstKill'] as const) for (const r of objs(at(m.json, 'boss', list))) if (str(r.id)) bossRewards.add(str(r.id) as string)
  }
  const rungs = new Map<string, Rec[]>()
  for (const it of ctx.items.values()) {
    const tags = tagsOf(it)
    if (str(it.json.kind) === 'relic') {
      const active = obj(it.json.active) as JsonObject | undefined
      const free = active?.instant === true || str(active?.timing) === 'afterFight'
      const w = it.json.weight
      if (free && w !== null) out.push(fail(it.file, 44, `an ${active?.instant === true ? 'instant' : 'after-fight'} relic takes no Item action: weight must be null`))
      if (!free && active && num(w) !== itemWeight) out.push(fail(it.file, 44, `activating this relic is an Item action: weight ${itemWeight} (has ${String(w)})`))
    }
    if (tags.includes('boss-only') && !bossRewards.has(it.id)) ctx.warnings.push(fail(it.file, 44, `'boss-only' but no boss reward line gives '${it.id}' yet`))
    if (str(it.json.kind) === 'material' && typeof it.json.materialLadder === 'string') {
      const key = `${it.json.materialLadder}@${String(it.json.materialRung)}`
      rungs.set(key, [...(rungs.get(key) ?? []), it])
    }
    if (tags.includes('regional') && (str(it.json.kind) !== 'material' || typeof it.json.materialLadder !== 'string')) out.push(fail(it.file, 44, "'regional' marks a material on a ladder"))
  }
  for (const [key, mats] of rungs) {
    if (mats.every((m) => tagsOf(m).includes('regional'))) for (const m of mats) out.push(fail(m.file, 44, `rung ${key} has only regional names; it needs its first name too (crates and salvage pay that)`))
  }
  return out
}

export const ITEM_RULES: ReadonlyArray<{ n: number; run: (ctx: Ctx) => Failure[] }> = [
  { n: 40, run: rule40 },
  { n: 41, run: rule41 },
  { n: 42, run: rule42 },
  { n: 43, run: rule43 },
  { n: 44, run: rule44 },
]
