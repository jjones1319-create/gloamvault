/**
 * Cross-file rules 60–64 (Phase 7, pass F): the content kinds whose files had no rule beyond their schema and a
 * reference check — statuses, species, elite affixes — and the two tuning sections the balance runner and the threat
 * read (content/README.md "What the linter checks that the schema cannot", rules 60–64). Same contract as rules.ts:
 * each returns `{ file, rule, message }[]`; warnings go on `ctx.warnings`; a rule skips what rule 2 already reports.
 */
import { POLICY_NAMES } from '../../sim/src/policies.ts'
import { DEATH_RULES, THREAT_BANDS } from '../../sim/src/types/enums.ts'
import { at, defined, isObj, num, obj, objs, str, strs, walk, type Json } from './json.ts'
import type { Ctx, Failure, Rec } from './rules.ts'

function fail(file: string, rule: number, message: string): Failure {
  return { file, rule, message }
}

/** A closed enum of common.schema.json ($defs/<name>/enum). */
function commonEnum(ctx: Ctx, name: string): string[] {
  const common = ctx.corpus.schemas.find((s) => s.name === 'common')?.json
  return strs(at(common, '$defs', name, 'enum'))
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 60: statuses (03 §3.4–§3.5) — one status per element as its mark (an upgrade shares it); upgradesTo and
// bossBecomes never point at themselves, never cycle, never into a status bosses shrug off; a lasting status can be
// removed (a debuff by a cleanse, a buff by a strip); only control statuses push the timeline or skip turns; a stacking
// status stacks; every status has its own icon.

const HELPFUL_KINDS: ReadonlySet<string> = new Set(['buff', 'hot', 'state'])

export function rule60(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const all = [...ctx.statuses.values()]
  const upgradeTargets = new Set(all.map((s) => str(s.json.upgradesTo)).filter(defined))
  const byElement = new Map<string, string>()
  const icons = new Map<string, string>()
  for (const s of all) {
    const kind = str(s.json.kind)
    const element = str(s.json.element)
    if (element !== undefined && !upgradeTargets.has(s.id)) {
      const first = byElement.get(element)
      if (first !== undefined) out.push(fail(s.file, 60, `element '${element}' already marks with '${first}'; 03 §3.4 gives each element one status (an upgrade such as Chill → Freeze shares its element)`))
      else byElement.set(element, s.id)
    }
    const up = str(s.json.upgradesTo)
    if (up !== undefined) {
      const target = ctx.statuses.get(up)
      if (up === s.id) out.push(fail(s.file, 60, 'upgradesTo names the status itself'))
      else if (target && str(target.json.upgradesTo) === s.id) out.push(fail(s.file, 60, `upgradesTo '${up}' upgrades back to '${s.id}': an upgrade never cycles`))
      const te = str(target?.json.element)
      if (target && element !== undefined && te !== undefined && te !== element) out.push(fail(s.file, 60, `upgrades to '${up}' of element '${te}'; an upgrade keeps the element ('${element}')`))
    }
    const immune = strs(s.json.immunityRoles)
    const becomes = str(s.json.bossBecomes)
    if (becomes !== undefined) {
      const target = ctx.statuses.get(becomes)
      if (becomes === s.id) out.push(fail(s.file, 60, 'bossBecomes names the status itself'))
      if (immune.includes('boss')) out.push(fail(s.file, 60, `bosses are immune to it (immunityRoles), so bossBecomes '${becomes}' never applies; set it to null`))
      if (target && strs(target.json.immunityRoles).includes('boss')) out.push(fail(s.file, 60, `bossBecomes '${becomes}', a status bosses are immune to (06 §7)`))
    }
    // An instant (Daze: durationDefault null, endsWhen "instant: …") only moves the accumulator; nothing stays to cleanse.
    const endsWhen = str(s.json.endsWhen)
    const lasting = (s.json.durationDefault !== null && s.json.durationDefault !== undefined) || (endsWhen !== undefined && !/^instant\b/i.test(endsWhen))
    const tags = strs(s.json.cleansedBy)
    if (lasting && kind !== undefined) {
      if (tags.length === 0) out.push(fail(s.file, 60, 'a lasting status lists no cleansedBy tag; 03 §3.5: every debuff has a cleanse and every buff a strip'))
      else if (HELPFUL_KINDS.has(kind) && !tags.includes('strip')) out.push(fail(s.file, 60, `a ${kind} must list 'strip' in cleansedBy (03 §3.5: every buff has a strip)`))
      else if (!HELPFUL_KINDS.has(kind) && tags.every((x) => x === 'strip')) out.push(fail(s.file, 60, `a ${kind} must list a cleanse in cleansedBy, not only 'strip' (03 §3.5)`))
    }
    if ((num(s.json.appliesEnergyDelta) ?? 0) < 0 && kind !== 'control') out.push(fail(s.file, 60, `appliesEnergyDelta ${String(s.json.appliesEnergyDelta)} on a ${kind ?? '?'} status; only control statuses push the timeline (03 §3.5)`))
    if ((num(s.json.skipsActionChance) ?? 0) > 0 && kind !== 'control') out.push(fail(s.file, 60, `skipsActionChance ${String(s.json.skipsActionChance)} on a ${kind ?? '?'} status; only control statuses skip turns (03 §3.5)`))
    if (str(s.json.stacking) === 'stack' && (num(s.json.maxStacks) ?? 1) < 2) out.push(fail(s.file, 60, `stacking 'stack' with maxStacks ${String(s.json.maxStacks)}; a stacking status holds 2 or more`))
    const icon = str(at(s.json, 'visual', 'icon'))
    if (icon !== undefined) {
      const first = icons.get(icon)
      if (first !== undefined) out.push(fail(s.file, 60, `visual.icon '${icon}' is also '${first}''s`))
      else icons.set(icon, s.id)
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 61: species (05) — trait ids unique across the species; three skin tones and three face presets each (05 §5,
// D-105); and every species can wear every piece of every class's starter kit (05: "gear the species cannot use
// regardless of class" — createHero hands the kit over as it is, so a restricted piece would be dead weight).

const SHIELD_TYPES: Readonly<Record<string, string>> = { shieldBuckler: 'buckler', shieldKite: 'kite', shieldTower: 'tower' }

/** The kits a class starts with: `starterKit`, and any other `…starterKit…` field (one list, or a list of kits). */
function classKits(c: Rec): { name: string; itemIds: string[] }[] {
  const kits: { name: string; itemIds: string[] }[] = []
  for (const [key, value] of Object.entries(c.json)) {
    if (!/starterkit/i.test(key) || !Array.isArray(value)) continue
    if (value.every((x) => typeof x === 'string')) kits.push({ name: key, itemIds: value as string[] })
    else
      value.forEach((kit, i) => {
        const ids: string[] = []
        const collect = (v: Json): void => {
          if (typeof v === 'string') ids.push(v)
          else if (Array.isArray(v)) v.forEach(collect)
          else if (isObj(v)) Object.values(v).forEach(collect)
        }
        collect(kit as Json)
        kits.push({ name: `${key}[${i}]`, itemIds: ids })
      })
  }
  return kits
}

/** Why a species cannot wear an item (sim/src/armory.ts wearBlocker's species half), or null. */
function speciesBlocker(sp: Rec, item: Rec): string | null {
  for (const r of objs(sp.json.restrictions)) {
    const kind = str(r.kind)
    const blocked =
      (kind === 'weaponType' && str(r.weaponType) !== undefined && str(item.json.weaponType) === str(r.weaponType)) ||
      (kind === 'slot' && str(r.slot) !== undefined && str(item.json.slot) === str(r.slot)) ||
      (kind === 'shieldType' && str(item.json.kind) === 'shield' && (str(r.shieldType) === 'all' || SHIELD_TYPES[str(item.json.weaponType) ?? ''] === str(r.shieldType)))
    if (blocked) return str(r.reason) ?? `a ${kind ?? '?'} restriction`
  }
  return null
}

export function rule61(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const traitIds = new Map<string, string>()
  for (const sp of ctx.species.values()) {
    for (const tr of objs(sp.json.traits)) {
      const id = str(tr.id)
      if (id === undefined) continue
      const first = traitIds.get(id)
      if (first !== undefined) out.push(fail(sp.file, 61, `trait id '${id}' is also used by ${first}`))
      else traitIds.set(id, sp.file)
    }
    const tones = Array.isArray(at(sp.json, 'body', 'skinTones')) ? (at(sp.json, 'body', 'skinTones') as Json[]).length : 0
    const faces = num(at(sp.json, 'body', 'facePresets')) ?? 0
    if (obj(sp.json.body) && tones < 3) out.push(fail(sp.file, 61, `body.skinTones has ${tones}; every species offers three (05 §5)`))
    if (obj(sp.json.body) && faces < 3) out.push(fail(sp.file, 61, `body.facePresets is ${faces}; every species offers three (05 §5)`))
    for (const c of ctx.classes.values()) {
      for (const kit of classKits(c)) {
        for (const id of kit.itemIds) {
          const item = ctx.items.get(id)
          if (!item) continue // rule 2, or a non-item string in a kit object
          const slot = str(item.json.slot)
          if (slot === undefined || slot === 'pet') continue
          const why = speciesBlocker(sp, item)
          if (why !== null) out.push(fail(sp.file, 61, `cannot wear '${id}' from class '${c.id}' ${kit.name} (${why}); a ${str(sp.json.name) ?? sp.id} ${str(c.json.name) ?? c.id} would start without it`))
        }
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 62: elite affixes (06 §2) — one champion rule: every affix carries the same hpMultiplier, goldMultiplier and
// xpClassBonus (monsters.ts takes the highest of a champion's affixes, so a stray value would change every champion
// that rolls it); the pool holds all three affix classes; each affix is in some monster's elitePool (else a warning:
// nothing rolls it); a tell is short (06 §8.10's discipline).

export function rule62(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const affixes = [...ctx.eliteAffixes.values()]
  if (affixes.length === 0) return out
  for (const key of ['hpMultiplier', 'goldMultiplier', 'xpClassBonus'] as const) {
    const counts = new Map<number, number>()
    for (const a of affixes) {
      const v = num(a.json[key])
      if (v !== undefined) counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    if (counts.size <= 1) continue
    const common = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0]
    for (const a of affixes) {
      const v = num(a.json[key])
      if (v !== undefined && v !== common) out.push(fail(a.file, 62, `${key} ${v} differs from the pool's ${common}; a champion's bonuses are one rule (06 §2, D-081, D-084)`))
    }
  }
  const classes = new Set(affixes.map((a) => str(a.json.affixClass)).filter(defined))
  for (const c of ['offensive', 'defensive', 'control']) if (!classes.has(c)) out.push(fail('content/elite-affixes', 62, `no elite affix of class '${c}'; 06 §2's pool has all three`))
  const pooled = new Set<string>()
  for (const m of ctx.monsters.values()) for (const id of strs(m.json.elitePool)) pooled.add(id)
  for (const a of affixes) {
    if (ctx.monsters.size > 0 && !pooled.has(a.id)) ctx.warnings.push(fail(a.file, 62, `no monster's elitePool lists '${a.id}': no champion rolls it yet`))
    const tell = str(a.json.tell)
    if (tell !== undefined && tell.length > 60) out.push(fail(a.file, 62, `tell is ${tell.length} characters; a tell is a short cue (06 §8.10), 60 at most`))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 63: tuning.json → runner (the balance runner's data, tools/balance/run.ts): every [low, high] band is ordered;
// the scripted player and the careful player's band are real; the per-floor gold targets match the expected floor
// count of a dungeon that exists, and no dungeon holds more floors than expected; every recipe's classes and species
// exist, its grade and pet stance are real, its clear target sits in 0–100 (a zone the dungeon lacks yet warns).

function band(v: unknown): [number, number] | null {
  return Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number' ? [v[0], v[1]] : null
}

export function rule63(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const file = ctx.corpus.byKind.get('tuning')?.[0]
  const runner = obj(at(file?.json, 'runner'))
  if (!file || !runner) return out
  const F = file.path
  const R = 63
  if ((num(runner.seeds) ?? 0) < 1) out.push(fail(F, R, `runner.seeds is ${String(runner.seeds)}; at least 1`))
  if ((num(runner.commandCap) ?? 0) < 100) out.push(fail(F, R, `runner.commandCap is ${String(runner.commandCap)}; at least 100 (a delve takes ~20–100 commands)`))
  const policy = str(runner.policy)
  if (policy !== undefined && !(POLICY_NAMES as readonly string[]).includes(policy)) out.push(fail(F, R, `runner.policy '${policy}' is not a scripted player (${POLICY_NAMES.join(', ')})`))
  const turnBack = str(at(runner, 'careful', 'turnBackFrom'))
  if (turnBack !== undefined && !(THREAT_BANDS as readonly string[]).includes(turnBack)) out.push(fail(F, R, `runner.careful.turnBackFrom '${turnBack}' is not a threat band (${THREAT_BANDS.join(', ')})`))
  const targets = obj(runner.targets)
  walk(targets, (o, where) => {
    for (const [k, v] of Object.entries(o)) {
      const b = band(v)
      if (b && b[0] > b[1]) out.push(fail(F, R, `runner.targets.${where ? `${where}.` : ''}${k} is [${b[0]}, ${b[1]}]; a band is [low, high]`))
    }
  })
  const spread = num(targets?.classDamageSpreadMax)
  if (spread !== undefined && spread < 1) out.push(fail(F, R, `runner.targets.classDamageSpreadMax ${spread} is below 1 (a ratio of the best class to the worst)`))
  const expected = obj(runner.expectedFloors) ?? {}
  for (const [d, v] of Object.entries(expected)) {
    if (d === 'note') continue
    const n = num(v)
    const dungeon = ctx.dungeons.get(d)
    if (ctx.dungeons.size > 0 && !dungeon) out.push(fail(F, R, `runner.expectedFloors names '${d}', which is not a dungeon`))
    const present = dungeon ? objs(dungeon.json.floors).length : 0
    if (dungeon && n !== undefined && present > n) out.push(fail(F, R, `runner.expectedFloors.${d} is ${n} but the dungeon has ${present} floors`))
  }
  for (const [d, v] of Object.entries(obj(targets?.goldPerFloor) ?? {})) {
    if (d === 'note' || !Array.isArray(v)) continue
    const n = num(expected[d])
    if (n !== undefined && v.length !== n) out.push(fail(F, R, `runner.targets.goldPerFloor.${d} has ${v.length} floors; runner.expectedFloors.${d} is ${n}`))
  }
  const grades = ctx.t.grades
  const stances = commonEnum(ctx, 'stance')
  const firstDungeon = [...ctx.dungeons.values()].find((d) => d.json.unlockedBy === null) ?? [...ctx.dungeons.values()][0]
  const zones = firstDungeon ? objs(firstDungeon.json.zones).length : 0
  const ids = new Set<string>()
  const waiting = new Map<number, string[]>()
  objs(runner.recipes).forEach((r, i) => {
    const where = `runner.recipes[${i}] '${str(r.id) ?? '?'}'`
    const id = str(r.id)
    if (id !== undefined) {
      if (ids.has(id)) out.push(fail(F, R, `${where}: id used twice`))
      ids.add(id)
    }
    const classes = strs(r.classes)
    if (classes.length < 1 || classes.length > 4) out.push(fail(F, R, `${where}: a party of ${classes.length}; parties hold 1–4 heroes`))
    if (ctx.classes.size > 0) for (const c of classes) if (!ctx.classes.has(c)) out.push(fail(F, R, `${where}: class '${c}' does not exist`))
    if (ctx.species.size > 0) for (const s of strs(r.species)) if (!ctx.species.has(s)) out.push(fail(F, R, `${where}: species '${s}' does not exist`))
    const gear = r.gear
    if (gear !== null && gear !== undefined && !grades.includes(String(gear))) out.push(fail(F, R, `${where}: gear '${String(gear)}' is not a grade`))
    const stance = r.petStance
    if (stance !== null && stance !== undefined && stances.length > 0 && !stances.includes(String(stance))) out.push(fail(F, R, `${where}: petStance '${String(stance)}' is not a stance`))
    const level = num(r.level)
    if (level !== undefined && (level < 1 || level > ctx.t.heroLevelCap)) out.push(fail(F, R, `${where}: level ${level} is outside 1–${ctx.t.heroLevelCap}`))
    if (r.clearTarget !== null && r.clearTarget !== undefined) {
      const b = band(r.clearTarget)
      if (!b || b[0] < 0 || b[1] > 100 || b[0] > b[1]) out.push(fail(F, R, `${where}: clearTarget ${JSON.stringify(r.clearTarget)} must be [low, high] in 0–100`))
    }
    const zone = num(r.zone)
    if (zone !== undefined && zone < 1) out.push(fail(F, R, `${where}: zone ${zone}; zones count from 1`))
    if (zone !== undefined && firstDungeon && zone > zones) waiting.set(zone, [...(waiting.get(zone) ?? []), id ?? `#${i}`])
    // D-083: a recipe may play part of its zone (the Vault as F7, and a start on F8); a delve is one zone (D-098).
    if (r.floors !== null && r.floors !== undefined) {
      const f = band(r.floors)
      const z = zone !== undefined && firstDungeon ? obj(objs(firstDungeon.json.zones)[zone - 1]?.floors) : undefined
      const from = num(z?.from)
      const to = num(z?.to)
      if (!f || f[0] > f[1]) out.push(fail(F, R, `${where}: floors ${JSON.stringify(r.floors)} must be [from, to]`))
      else if (from !== undefined && to !== undefined && (f[0] < from || f[1] > to)) out.push(fail(F, R, `${where}: floors ${f[0]}–${f[1]} lie outside zone ${zone}'s floors ${from}–${to} (a delve is one zone, D-098)`))
    }
  })
  for (const [zone, recipes] of [...waiting.entries()].sort((a, b) => a[0] - b[0])) {
    ctx.warnings.push(fail(F, R, `runner recipes for zone ${zone} (${recipes.join(', ')}) wait: '${firstDungeon?.id ?? '?'}' has ${zones} zone${zones === 1 ? '' : 's'}; the runner skips them until it lands`))
  }
  const kills = str(runner.bossKills)
  if (kills !== undefined && kills !== 'first' && kills !== 'repeat') out.push(fail(F, R, `runner.bossKills '${kills}' is neither 'first' nor 'repeat'`))
  // Plans (`npm run balance -- --plan <name>`): each part names recipe sets that exist and real rules, presets and players.
  const sets = new Set(objs(runner.recipes).map((r) => str(r.set) ?? 'main'))
  const deathRules: readonly string[] = DEATH_RULES
  const difficulties = commonEnum(ctx, 'difficulty')
  for (const [plan, parts] of Object.entries(obj(runner.plans) ?? {})) {
    if (plan === 'note' || !Array.isArray(parts)) continue
    objs(parts).forEach((p, i) => {
      const where = `runner.plans.${plan}[${i}] '${str(p.name) ?? '?'}'`
      for (const s of strs(p.sets)) if (!sets.has(s)) out.push(fail(F, R, `${where}: no recipe is in set '${s}'`))
      for (const d of strs(p.death)) if (!deathRules.includes(d)) out.push(fail(F, R, `${where}: '${d}' is not a death rule`))
      if (difficulties.length) for (const d of strs(p.difficulty)) if (!difficulties.includes(d)) out.push(fail(F, R, `${where}: '${d}' is not a preset`))
      for (const x of strs(p.policy)) if (!(POLICY_NAMES as readonly string[]).includes(x)) out.push(fail(F, R, `${where}: '${x}' is not a scripted player`))
      const seeds = num(p.seeds)
      if (seeds !== undefined && seeds < 1) out.push(fail(F, R, `${where}: seeds ${seeds}; at least 1`))
    })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 64: danger you can read (D-092; tuning.json → dungeon.threat and each dungeon's floors) — the bands are
// ordered with Even holding a fight at the party's own level; the bonuses are not negative; a dungeon's monster levels
// never fall from one floor to the next; and going too far is deadly by construction: a party at a zone's first level
// reads the next zone's first floor as Deadly; and the party-size rows (dungeon.partyScaling, D-128's boss row too)
// hold one positive number for each party size 1–4.

export function rule64(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const file = ctx.corpus.byKind.get('tuning')?.[0]
  const threat = obj(at(file?.json, 'dungeon', 'threat'))
  if (!file || !threat) return out
  const F = file.path
  const easy = num(threat.easyAtOrBelow)
  const dangerous = num(threat.dangerousFrom)
  const deadly = num(threat.deadlyFrom)
  if (easy !== undefined && easy >= 0) out.push(fail(F, 64, `dungeon.threat.easyAtOrBelow is ${easy}; a fight at the party's own level must read Even, so it is below 0`))
  if (dangerous !== undefined && dangerous <= 0) out.push(fail(F, 64, `dungeon.threat.dangerousFrom is ${dangerous}; a fight at the party's own level must read Even, so it is above 0`))
  if (dangerous !== undefined && deadly !== undefined && deadly < dangerous) out.push(fail(F, 64, `dungeon.threat.deadlyFrom ${deadly} is below dangerousFrom ${dangerous}`))
  for (const k of ['perChampionAffix', 'bossBonus', 'hunterBonus']) {
    const v = num(threat[k])
    if (v !== undefined && v < 0) out.push(fail(F, 64, `dungeon.threat.${k} is ${v}; a champion, boss or hunter never reads easier`))
  }
  // The party-size rows (03 §11.2; D-128's boss row): one positive number for each party size 1–4.
  const scaling = obj(at(file.json, 'dungeon', 'partyScaling'))
  const rows: [string, unknown][] = [['count', scaling?.count], ['hp', scaling?.hp], ['damage', scaling?.damage], ['boss.hp', at(scaling, 'boss', 'hp')], ['boss.damage', at(scaling, 'boss', 'damage')]]
  for (const [k, v] of rows) {
    if (v === undefined) continue
    if (!Array.isArray(v) || v.length !== 4 || !v.every((x) => typeof x === 'number' && x > 0)) out.push(fail(F, 64, `dungeon.partyScaling.${k} must hold four positive numbers, one for each party size 1–4`))
  }
  for (const d of ctx.dungeons.values()) {
    const floors = objs(d.json.floors)
      .map((f) => ({ n: num(f.floor), level: num(f.monsterLevel), zone: str(f.zoneId) }))
      .filter((x): x is { n: number; level: number; zone: string | undefined } => x.n !== undefined && x.level !== undefined)
      .sort((a, b) => a.n - b.n)
    floors.forEach((f, i) => {
      const prev = floors[i - 1]
      if (prev && f.level < prev.level) out.push(fail(d.file, 64, `floor ${f.n} monsterLevel ${f.level} is below floor ${prev.n}'s ${prev.level}; levels climb with depth (D-092)`))
    })
    if (deadly === undefined) continue
    const zoneFirsts = objs(d.json.zones)
      .map((z) => ({ id: str(z.id) ?? '?', from: num(at(z, 'floors', 'from')) }))
      .map((z) => ({ ...z, level: floors.find((f) => f.n === z.from)?.level }))
      .filter((z): z is { id: string; from: number; level: number } => z.from !== undefined && z.level !== undefined)
      .sort((a, b) => a.from - b.from)
    zoneFirsts.forEach((z, i) => {
      const prev = zoneFirsts[i - 1]
      if (prev && z.level - prev.level < deadly) out.push(fail(d.file, 64, `zone '${z.id}' starts at level ${z.level}, only ${z.level - prev.level} above zone '${prev.id}''s first floor (${prev.level}); D-092: a party that dives a zone early should read it Deadly (${deadly}+)`))
    })
  }
  return out
}

export const RULES_F: ReadonlyArray<{ n: number; run: (ctx: Ctx) => Failure[] }> = [
  { n: 60, run: rule60 },
  { n: 61, run: rule61 },
  { n: 62, run: rule62 },
  { n: 63, run: rule63 },
  { n: 64, run: rule64 },
]

