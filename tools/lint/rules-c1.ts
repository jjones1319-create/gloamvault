/**
 * Cross-file rules 45–49 (Phase 7, pass C1): Gravehollow's floors, zones and Waystones; the merchant and the band
 * table as data; encounters inside their monsters' zones; monster behaviour that leaves its weights alive; and the
 * placement, conditions and fights of curios and traps (07 §1.1, §2.3–§2.10; 06 §3, §8.2; 08's R table;
 * content/README.md "What the linter checks"). Same contract as rules.ts: each returns `{ file, rule, message }[]`;
 * ids rule 2 already reports are skipped here.
 */
import { parseBehavior } from '../../sim/src/ai.ts'
import { at, bool, num, obj, objs, str, strs, tnum, type JsonObject } from './json.ts'
import type { Ctx, Failure, Rec } from './rules.ts'

function fail(file: string, rule: number, message: string): Failure {
  return { file, rule, message }
}

function floorsOf(d: Rec): { f: JsonObject; n: number }[] {
  return objs(d.json.floors)
    .map((f) => ({ f, n: num(f.floor) }))
    .filter((x): x is { f: JsonObject; n: number } => x.n !== undefined)
    .sort((a, b) => a.n - b.n)
}

function zoneRange(z: JsonObject): { from: number; to: number } | undefined {
  const from = num(at(z, 'floors', 'from'))
  const to = num(at(z, 'floors', 'to'))
  return from !== undefined && to !== undefined ? { from, to } : undefined
}

/** The zone of a dungeon that holds a floor. */
function zoneAt(d: Rec, floor: number): JsonObject | undefined {
  return objs(d.json.zones).find((z) => {
    const r = zoneRange(z)
    return r !== undefined && floor >= r.from && floor <= r.to
  })
}

/** The dungeon's templates (its folder's template files plus any inline), with their ids, zones and kinds. */
function templatesOf(ctx: Ctx, d: Rec): JsonObject[] {
  const folder = d.file.split('/')[2] ?? ''
  return [...objs(d.json.templates), ...ctx.templateFiles.filter((t) => t.dungeonFolder === folder).map((t) => t.json)]
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 45: floors and zones (07 §1.1, §2.3, §2.10) — the first zone's Waystone is lit from the start; band levels
// climb and span levelRange; a dungeon's last boss floor is the fixed throne (4 rooms, no secret, no merchant); each
// zone's templates host every room kind its floors need, and wear its kit's prefix.

export function rule45(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const d of ctx.dungeons.values()) {
    const floors = floorsOf(d)
    const zones = objs(d.json.zones)
      .map((z) => ({ z, r: zoneRange(z) }))
      .filter((x): x is { z: JsonObject; r: { from: number; to: number } } => x.r !== undefined)
      .sort((a, b) => a.r.from - b.r.from)
    if (zones[0] && bool(zones[0].z.waystone) !== true) out.push(fail(d.file, 45, `the first zone '${str(zones[0].z.id) ?? '?'}' has waystone false; its Waystone is lit from the start (07 §1.1)`))
    // Band levels.
    const levels = floors.map((x) => ({ n: x.n, l: num(x.f.monsterLevel) })).filter((x): x is { n: number; l: number } => x.l !== undefined)
    levels.forEach((x, i) => {
      const prev = levels[i - 1]
      if (prev && x.l < prev.l) out.push(fail(d.file, 45, `floor ${x.n} monsterLevel ${x.l} is below floor ${prev.n}'s ${prev.l}; band levels climb (07 §2.3)`))
    })
    const lr = obj(d.json.levelRange)
    const lmin = num(lr?.min)
    const lmax = num(lr?.max)
    const first = levels[0]
    const last = levels[levels.length - 1]
    if (first && lmin !== undefined && first.l !== lmin) out.push(fail(d.file, 45, `levelRange.min ${lmin} is not floor ${first.n}'s monsterLevel ${first.l}`))
    if (last && lmax !== undefined && last.l !== lmax) out.push(fail(d.file, 45, `levelRange.max ${lmax} is not floor ${last.n}'s monsterLevel ${last.l}`))
    // The throne: the last floor, when it carries a boss and the dungeon has its three zones (07 §2.10 G3).
    const top = floors[floors.length - 1]
    if (top && str(top.f.bossId) !== undefined && zones.length >= 3) {
      const f = top.f
      if (num(f.roomsMin) !== 4 || num(f.roomsMax) !== 4) out.push(fail(d.file, 45, `the throne floor ${top.n} has rooms ${num(f.roomsMin) ?? '?'}–${num(f.roomsMax) ?? '?'}; G3 fixes it at 4 (Entry · Antechamber · Rest · Throne)`))
      if ((num(f.secretChance) ?? 0) !== 0) out.push(fail(d.file, 45, `the throne floor ${top.n} has a secret chance; G3 adds no rooms`))
      if (bool(f.merchant) === true) out.push(fail(d.file, 45, `the throne floor ${top.n} has a merchant; G3 has none`))
    }
    // Templates per zone: the kinds the generator needs, the kit prefix.
    const tpls = templatesOf(ctx, d)
    for (const { z, r } of zones) {
      const zid = str(z.id) ?? '?'
      const kit = str(z.biomeKitId)
      const own = tpls.filter((t) => str(t.zoneId) === zid)
      if (own.length === 0) continue
      if (kit !== undefined) for (const t of own) if (!(str(t.id) ?? '').startsWith(`${kit}-`)) out.push(fail(d.file, 45, `template '${str(t.id) ?? '?'}' of zone '${zid}' does not wear its kit's prefix '${kit}-'`))
      const zf = floors.filter((x) => x.n >= r.from && x.n <= r.to)
      const kinds = new Set(own.flatMap((t) => strs(t.kinds)))
      const need = new Set(['entry', 'fight', 'rest'])
      if (zf.some((x) => str(x.f.bossId) === undefined)) need.add('stairs')
      if (zf.some((x) => str(x.f.bossId) !== undefined)) need.add('boss')
      if (zf.some((x) => bool(x.f.merchant) === true)) need.add('merchant')
      if (zf.some((x) => (num(x.f.secretChance) ?? 0) > 0)) need.add('secret')
      for (const k of need) if (!kinds.has(k)) out.push(fail(d.file, 45, `zone '${zid}' has no template hosting '${k}', which its floors need`))
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 46: the merchant and the bands as data (tuning.json `merchant`, `bands`; 07 §2.7, 08's R table) — every stock
// line is an item; the before-final-boss line is a stock line; every zone with a merchant floor has safe items tagged
// for it; the bands tile the global floors from 1 with R climbing and their grades in ladder order.

export function rule46(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const tuning = obj(ctx.corpus.byKind.get('tuning')?.[0]?.json)
  const file = 'content/tuning.json'
  const merchant = obj(tuning?.merchant)
  if (merchant) {
    const stock = objs(merchant.stock)
    stock.forEach((s, i) => {
      const id = str(s.itemId)
      if (id === undefined || !ctx.items.has(id)) out.push(fail(file, 46, `merchant.stock[${i}].itemId '${id ?? '?'}' is not an item`))
      if ((tnum(s.quantity) ?? 0) < 1) out.push(fail(file, 46, `merchant.stock[${i}] stocks no units`))
    })
    const bfb = str(at(merchant, 'beforeFinalBoss', 'itemId'))
    if (bfb !== undefined && !stock.some((s) => str(s.itemId) === bfb)) out.push(fail(file, 46, `merchant.beforeFinalBoss.itemId '${bfb}' is not one of the stock lines`))
    const tag = str(at(merchant, 'safeItems', 'tag'))
    const prefix = str(at(merchant, 'safeItems', 'zoneTagPrefix'))
    if (tag !== undefined && prefix !== undefined) {
      for (const d of ctx.dungeons.values()) {
        for (const { f, n } of floorsOf(d)) {
          if (bool(f.merchant) !== true) continue
          const zid = str(f.zoneId) ?? ''
          const safe = [...ctx.items.values()].filter((it) => strs(it.json.tags).includes(tag) && strs(it.json.tags).includes(`${prefix}${zid}`))
          if (safe.length === 0) out.push(fail(d.file, 46, `floor ${n} has a merchant but no item is tagged '${tag}' and '${prefix}${zid}' (07 §2.7: the zone's safe items)`))
        }
      }
    }
  }
  const bands = objs(at(tuning, 'bands', 'floors'))
  let expectFrom = 1
  let prevR = 0
  let prevGrade = -1
  bands.forEach((b, i) => {
    const from = num(b.from)
    const to = num(b.to)
    const r = num(b.r)
    const g = ctx.t.grades.indexOf(str(b.grade) ?? '')
    if (from !== expectFrom) out.push(fail(file, 46, `bands.floors[${i}] starts at floor ${from ?? '?'}, expected ${expectFrom}: the bands tile the global floors`))
    if (to === undefined || from === undefined || to < from) out.push(fail(file, 46, `bands.floors[${i}] has floors ${from ?? '?'}–${to ?? '?'}`))
    if (r === undefined || r <= prevR) out.push(fail(file, 46, `bands.floors[${i}] R ${r ?? '?'} does not climb from ${prevR}`))
    if (g <= prevGrade) out.push(fail(file, 46, `bands.floors[${i}] grade '${str(b.grade) ?? '?'}' is out of ladder order`))
    expectFrom = (to ?? expectFrom) + 1
    prevR = r ?? prevR
    prevGrade = g
  })
  const cap = str(at(tuning, 'bands', 'chestBandCap', 'value'))
  if (cap !== undefined && !ctx.t.grades.includes(cap)) out.push(fail(file, 46, `bands.chestBandCap '${cap}' is not a grade`))
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 47: an encounter stays in its monsters' zone (06 §3: one family per zone) — its floorBand lies inside one zone
// of its dungeon, every monster of that dungeon in it belongs to that zone, and each monster's levelBand covers the
// band level of every floor it fights on (plus a hunter's offset).

export function rule47(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const e of ctx.encounters.values()) {
    const d = ctx.dungeons.get(str(e.json.dungeonId) ?? '')
    if (!d) continue
    const min = num(at(e.json, 'floorBand', 'min'))
    const max = num(at(e.json, 'floorBand', 'max'))
    if (min === undefined || max === undefined) continue
    const zLow = zoneAt(d, min)
    const zHigh = zoneAt(d, max)
    if (!zLow || zLow !== zHigh) {
      out.push(fail(e.file, 47, `floorBand ${min}–${max} does not lie inside one zone of '${d.id}'`))
      continue
    }
    const zid = str(zLow.id) ?? '?'
    const floors = floorsOf(d).filter((x) => x.n >= min && x.n <= max)
    objs(e.json.composition).forEach((c, i) => {
      const m = ctx.monsters.get(str(c.monsterId) ?? '')
      if (!m || str(m.json.dungeonId) !== d.id) return
      if (str(m.json.zoneId) !== zid) out.push(fail(e.file, 47, `composition[${i}] '${m.id}' belongs to zone '${str(m.json.zoneId) ?? '?'}', not '${zid}' where the encounter fights`))
      const lmin = num(at(m.json, 'levelBand', 'min'))
      const lmax = num(at(m.json, 'levelBand', 'max'))
      const offset = num(at(m.json, 'hunter', 'levelOffset')) ?? 0
      for (const { f, n } of floors) {
        const level = (num(f.monsterLevel) ?? 0) + offset
        if (lmin !== undefined && lmax !== undefined && (level < lmin || level > lmax)) out.push(fail(e.file, 47, `composition[${i}] '${m.id}' fights at L${level} on floor ${n}, outside its levelBand ${lmin}–${lmax}`))
      }
    })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 48: monster behaviour keeps its weights alive (C1's Phase 7 fix) — the gambit parser (sim/src/ai.ts) reads a
// behaviour's lines as gambits; an unconditional line that names one of the monster's moves wins every turn and its
// aiWeights never roll, which is an error for a monster with two or more weighted attacks. A line the grammar cannot
// read is dropped by the parser: a warning (a note for the designer, not a gambit).

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function rule48(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const m of ctx.monsters.values()) {
    const lines = objs(at(m.json, 'behavior', 'rules'))
      .map((r) => ({ if: str(r.if) ?? '', then: str(r.then) ?? '' }))
      .filter((r) => r.if.length > 0 && r.then.length > 0)
    if (lines.length === 0) continue
    const attacks = objs(m.json.attacks)
    const weighted = attacks.filter((a) => (num(a.aiWeight) ?? 0) > 0)
    const rule = parseBehavior(lines)
    for (const err of rule.errors) ctx.warnings.push(fail(m.file, 48, `behavior line "${err.text.slice(0, 80)}" is a note: the gambit parser drops it (${err.reason})`))
    if (weighted.length < 2 || obj(m.json.boss) !== undefined) continue
    const firstElse = rule.clauses.find((c) => c.conditions.length === 0)
    if (!firstElse) continue
    const a = firstElse.action
    const named = a.verb === 'named' && a.ref !== undefined ? attacks.find((x) => norm(str(x.id) ?? '') === norm(a.ref!) || norm(str(x.name) ?? '') === norm(a.ref!)) : undefined
    const kills = named !== undefined || a.verb === 'guard' || a.verb === 'flee' || a.verb === 'swapRow'
    if (kills) out.push(fail(m.file, 48, `behavior ends in an unconditional '${named ? str(named.id) : a.verb}': it wins every turn and the aiWeights of its ${weighted.length} weighted attacks never roll (drop the "always" line)`))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 49: curios and traps (07 §2.4–§2.5) — a trap's placement names templates of its zone that can host one of its
// room kinds; it can stand on some floor of its zone; its condition names real classes; a curio's or trap's fight or
// ambush (curio-fight, ambush-encounter, lantern-gutters, smash-urns) calls a monster of its zone; a zone's joiners are
// monsters of that zone that are neither bosses nor hunters.

const FIGHT_HOOKS: ReadonlySet<string> = new Set(['curio-fight', 'ambush-encounter', 'lantern-gutters', 'smash-urns'])

function fightLines(json: JsonObject): JsonObject[] {
  const found: JsonObject[] = []
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(visit)
    else if (v && typeof v === 'object') {
      const o = v as JsonObject
      if (o.kind === 'custom' && FIGHT_HOOKS.has(str(o.customId) ?? '')) found.push(o)
      for (const x of Object.values(o)) visit(x)
    }
  }
  visit(json)
  return found
}

export function rule49(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const d of ctx.dungeons.values()) {
    const tpls = templatesOf(ctx, d)
    const floors = floorsOf(d)
    for (const tr of objs(d.json.traps)) {
      const tid = str(tr.id) ?? '?'
      const zid = str(tr.zoneId)
      const p = obj(tr.placement)
      const kinds = strs(p?.roomKinds)
      for (const id of strs(p?.templateIds)) {
        const t = tpls.find((x) => str(x.id) === id)
        if (!t) out.push(fail(d.file, 49, `trap '${tid}' placement.templateIds '${id}' is not a template of '${d.id}'`))
        else {
          if (zid !== undefined && str(t.zoneId) !== zid) out.push(fail(d.file, 49, `trap '${tid}' of zone '${zid}' names template '${id}' of zone '${str(t.zoneId) ?? '?'}'`))
          if (kinds.length > 0 && !strs(t.kinds).some((k) => kinds.includes(k))) out.push(fail(d.file, 49, `trap '${tid}' template '${id}' hosts none of its room kinds ${kinds.join('/')}`))
        }
      }
      const difficulty = num(tr.difficulty)
      const zoneFloors = floors.filter((x) => zid === undefined || str(x.f.zoneId) === zid)
      if (difficulty !== undefined && zoneFloors.length > 0) {
        const own = tpls.filter((t) => zid === undefined || str(t.zoneId) === zid)
        const hosts = own.filter((t) => (strs(p?.templateIds).length === 0 || strs(p?.templateIds).includes(str(t.id) ?? '')) && (kinds.length === 0 || strs(t.kinds).some((k) => kinds.includes(k))))
        if (own.length > 0 && hosts.length === 0) out.push(fail(d.file, 49, `trap '${tid}' has no template of its zone it may stand in`))
      }
      for (const c of strs(at(tr, 'condition', 'partyClassIds'))) if (!ctx.classes.has(c)) out.push(fail(d.file, 49, `trap '${tid}' condition.partyClassIds '${c}' is not a class`))
    }
    const checkFight = (owner: string, zid: string | undefined, line: JsonObject): void => {
      const id = str(line.summonId)
      if (id === undefined) return
      const m = ctx.monsters.get(id)
      if (!m) {
        out.push(fail(d.file, 49, `${owner} calls '${id}', which is not a monster`))
        return
      }
      if (zid !== undefined && str(m.json.dungeonId) === d.id && str(m.json.zoneId) !== zid) out.push(fail(d.file, 49, `${owner} of zone '${zid}' calls '${id}' of zone '${str(m.json.zoneId) ?? '?'}'`))
      if (obj(m.json.boss) !== undefined) out.push(fail(d.file, 49, `${owner} calls the boss '${id}'`))
    }
    for (const c of objs(d.json.curios)) for (const line of fightLines(c)) checkFight(`curio '${str(c.id) ?? '?'}'`, str(c.zoneId), line)
    for (const tr of objs(d.json.traps)) for (const line of fightLines(tr)) checkFight(`trap '${str(tr.id) ?? '?'}'`, str(tr.zoneId), line)
    for (const z of objs(d.json.zones)) {
      const zid = str(z.id) ?? '?'
      for (const j of objs(z.joiners)) {
        const id = str(j.monsterId) ?? '?'
        const m = ctx.monsters.get(id)
        if (!m) out.push(fail(d.file, 49, `zone '${zid}' joiner '${id}' is not a monster`))
        else {
          if (str(m.json.zoneId) !== zid) out.push(fail(d.file, 49, `zone '${zid}' joiner '${id}' belongs to zone '${str(m.json.zoneId) ?? '?'}'`))
          if (obj(m.json.boss) !== undefined || obj(m.json.hunter) !== undefined) out.push(fail(d.file, 49, `zone '${zid}' joiner '${id}' is a ${obj(m.json.boss) ? 'boss' : 'hunter'}`))
        }
      }
    }
  }
  return out
}

export const RULES_C1: ReadonlyArray<{ n: number; run: (ctx: Ctx) => Failure[] }> = [
  { n: 45, run: rule45 },
  { n: 46, run: rule46 },
  { n: 47, run: rule47 },
  { n: 48, run: rule48 },
  { n: 49, run: rule49 },
]
