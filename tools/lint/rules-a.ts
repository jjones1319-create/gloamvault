/**
 * Cross-file rules 35–37 (Phase 7, pass A): Skill Tomes, the D-099 Tier IV–V limits, and the monster-only skills
 * (content/README.md "What the linter checks that the schema cannot", rules 35–37). Same contract as rules.ts: each
 * returns `{ file, rule, message }[]`; a rule skips what rule 2 already reports.
 */
import { at, num, obj, objs, str, strs, walk, type JsonObject } from './json.ts'
import type { Ctx, Failure, Rec } from './rules.ts'

function fail(file: string, rule: number, message: string): Failure {
  return { file, rule, message }
}

function tuningOf(ctx: Ctx): JsonObject | undefined {
  return obj(ctx.corpus.byKind.get('tuning')?.[0]?.json)
}

function tuningFile(ctx: Ctx): string {
  return ctx.corpus.byKind.get('tuning')?.[0]?.path ?? 'content/tuning.json'
}

const LITERAL_CLASSES: ReadonlySet<string> = new Set(['field', 'pet', 'monster'])

/** A tuning leaf written plainly or as a { value, note } leaf. */
function leaf(v: unknown): number | undefined {
  return num(v) ?? num(at(v, 'value'))
}

/** The highest tier a hero can come by (skills.obtainableTierMax; Tier V locked until Segment 3, D-099). */
function obtainableTierMax(ctx: Ctx): number {
  return leaf(at(tuningOf(ctx), 'skills', 'obtainableTierMax')) ?? 4
}

/** Why a skill id cannot be a Tome's, or null when it can. */
function tomeProblem(ctx: Ctx, skillId: string): string | null {
  const s = ctx.skills.get(skillId)
  if (!s) return null // rule 2
  const classId = str(s.json.classId) ?? ''
  if (LITERAL_CLASSES.has(classId)) return `is a '${classId}' skill; a Tome teaches a class skill`
  if (s.json.monsterTechniqueOf !== null && s.json.monsterTechniqueOf !== undefined) return 'is a monster technique (learned only by witnessing, 09 §4)'
  if (str(s.json.monsterTechniqueLater) !== undefined) return 'is a technique whose monster is not in the game yet'
  const tier = num(s.json.tier) ?? 0
  if (tier > obtainableTierMax(ctx)) return `is Tier ${tier}, above skills.obtainableTierMax ${obtainableTierMax(ctx)} (Tier V is locked, D-099)`
  return null
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 35: Skill Tomes (03 §7.5, 08 §4, §10.2; Phase 7) — the Tome item the tuning names is a 'tome' item that cannot be
// worn or used in a fight; a Tome reward line names a class skill a Tome may carry (not a pet, field or monster skill,
// not a technique, not Tier V) or a tier within 1 … obtainableTierMax; the Skill Tome chests' tier ranges stay inside
// that too; a Tome in a hero save record names such a skill.

export function rule35(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const R = 35
  const t = tuningOf(ctx)
  const max = obtainableTierMax(ctx)
  const itemId = str(at(t, 'skills', 'tomes', 'itemId'))
  if (itemId === undefined) out.push(fail(tuningFile(ctx), R, 'skills.tomes.itemId names no Skill Tome item'))
  else {
    const item = ctx.items.get(itemId)
    if (!item) out.push(fail(tuningFile(ctx), R, `skills.tomes.itemId '${itemId}' is not an item`))
    else if (str(item.json.kind) !== 'tome') out.push(fail(item.file, R, `the Skill Tome item has kind '${str(item.json.kind) ?? '?'}', expected 'tome'`))
  }
  for (const it of ctx.items.values()) {
    if (str(it.json.kind) !== 'tome') continue
    if (it.json.slot !== null) out.push(fail(it.file, R, `a Tome has slot '${String(it.json.slot)}'; it is read, never worn`))
    if (it.json.consumable !== null) out.push(fail(it.file, R, 'a Tome carries a consumable block; it is read in town, never used in a fight'))
    if (strs(it.json.classLock).length > 0) out.push(fail(it.file, R, 'a Tome carries a classLock; the skill on the instance names its class'))
  }
  // Reward lines anywhere (bosses' first and every kill, secrets, curios): kind 'tome'.
  for (const r of ctx.records) {
    walk(r.json, (o, where) => {
      if (str(o.kind) !== 'tome' || r.file.includes('/items/')) return
      if (!('tier' in o) && !('id' in o)) return
      const id = str(o.id)
      if (id !== undefined) {
        const p = tomeProblem(ctx, id)
        if (p) out.push(fail(r.file, R, `${where} tome '${id}' ${p}`))
      }
      const tier = num(o.tier)
      if (tier !== undefined && (tier < 1 || tier > max)) out.push(fail(r.file, R, `${where} tome tier ${tier} is outside 1–${max} (Tier V is locked, D-099)`))
    })
  }
  // Skill Tome chests: the tier range (the chest's own, else tuning economy.chests.tomeTiers by the chest's tier).
  for (const c of ctx.chests.values()) {
    if (str(c.json.kind) !== 'skillTome') continue
    const range = obj(c.json.tomeTiers) ?? obj(at(t, 'economy', 'chests', 'tomeTiers', str(c.json.tier) ?? ''))
    const lo = num(range?.min)
    const hi = num(range?.max)
    if (lo === undefined || hi === undefined) continue
    if (lo < 1 || hi > max || lo > hi) out.push(fail(c.file, R, `the Tome tiers ${lo}–${hi} must sit inside 1–${max} (Tier V is locked, D-099)`))
  }
  // Hero save records (with --saves): a Tome instance names a skill a Tome may carry.
  for (const h of ctx.heroes) {
    for (const inst of objs(h.json.bag)) {
      const sid = str(inst.skillId)
      if (sid === undefined) continue
      const item = ctx.items.get(str(inst.itemId) ?? '')
      if (item && str(item.json.kind) !== 'tome') out.push(fail(h.file, R, `bag item '${str(inst.itemId) ?? '?'}' carries a skillId but is not a Tome`))
      if (!ctx.skills.has(sid)) out.push(fail(h.file, R, `a Tome teaches '${sid}', which is not a skill`))
      else {
        const p = tomeProblem(ctx, sid)
        if (p) out.push(fail(h.file, R, `a Tome teaches '${sid}', which ${p}`))
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 36: the D-099 Tier IV–V limits (skills.limits in tuning): no execute multiplier above executeMaxMultiplier; a
// per-floor or per-cast skill's counted lines carry exactly the limit (a Mastery never raises it); an ambush cut never
// goes past its cap. The skills the limits name must exist.

const EXECUTE_HOOKS: ReadonlySet<string> = new Set(['execute-multiplier', 'execute-multiplier-below-hp'])

function linesOf(s: Rec): { where: string; line: JsonObject }[] {
  return [...objs(s.json.effects).map((line, i) => ({ where: `effects[${i}]`, line })), ...objs(at(s.json, 'mastery', 'effects')).map((line, i) => ({ where: `mastery.effects[${i}]`, line }))]
}

export function rule36(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const R = 36
  const limits = obj(at(tuningOf(ctx), 'skills', 'limits'))
  if (!limits) return out
  const execMax = num(limits.executeMaxMultiplier)
  if (execMax !== undefined) {
    for (const s of ctx.skills.values()) {
      for (const { where, line } of linesOf(s)) {
        if (str(line.kind) !== 'custom' || !EXECUTE_HOOKS.has(str(line.customId) ?? '')) continue
        const m = num(line.multiplier)
        if (m !== undefined && m > execMax) out.push(fail(s.file, R, `${where}: an execute at ${m}× is above skills.limits.executeMaxMultiplier ${execMax}× (D-099)`))
      }
    }
  }
  const counted = (table: unknown, what: string): void => {
    for (const [skillId, limit] of Object.entries(obj(table) ?? {})) {
      const n = num(limit)
      const s = ctx.skills.get(skillId)
      if (!s) {
        out.push(fail(tuningFile(ctx), R, `skills.limits.${what} names '${skillId}', which is not a skill`))
        continue
      }
      const lines = linesOf(s).filter(({ line }) => str(line.kind) === 'custom' && num(line.amount) !== undefined)
      if (lines.length === 0) out.push(fail(s.file, R, `D-099 limits it to ${String(n)} ${what === 'perFloor' ? 'per floor' : 'per cast'}, but no custom line carries the count (amount)`))
      for (const { where, line } of lines) if (num(line.amount) !== n) out.push(fail(s.file, R, `${where}: amount ${String(num(line.amount))} differs from skills.limits.${what} ${String(n)} (D-099)`))
    }
  }
  counted(limits.perFloor, 'perFloor')
  counted(limits.perCast, 'perCast')
  for (const [skillId, cap] of Object.entries(obj(limits.ambushCutMaxPercent) ?? {})) {
    const c = num(cap)
    const s = ctx.skills.get(skillId)
    if (!s || c === undefined) {
      if (!s) out.push(fail(tuningFile(ctx), R, `skills.limits.ambushCutMaxPercent names '${skillId}', which is not a skill`))
      continue
    }
    const cuts = linesOf(s).filter(({ line }) => str(line.customId) === 'party-ambush-modifier')
    if (cuts.length === 0) out.push(fail(s.file, R, `D-099 caps its ambush cut at ${c}%, but it carries no party-ambush-modifier line`))
    for (const { where, line } of cuts) {
      const a = num(line.amount) ?? num(line.percent) ?? 0
      if (a < -c) out.push(fail(s.file, R, `${where}: an ambush cut of ${a} goes past the −${c} cap (D-099)`))
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 37: a monster-only skill (classId 'monster') is used by some monster: its id appears in a monster record.

export function rule37(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const used = new Set<string>()
  for (const m of ctx.monsters.values()) {
    walk(m.json, (o) => {
      for (const v of Object.values(o)) {
        if (typeof v === 'string') used.add(v)
        else if (Array.isArray(v)) for (const x of v) if (typeof x === 'string') used.add(x)
      }
    })
  }
  for (const s of ctx.skills.values()) {
    if (str(s.json.classId) !== 'monster') continue
    if (!used.has(s.id)) out.push(fail(s.file, 37, `a monster skill no monster uses (no monster record names '${s.id}')`))
  }
  return out
}

export const RULES_A: ReadonlyArray<{ n: number; run: (ctx: Ctx) => Failure[] }> = [
  { n: 35, run: rule35 },
  { n: 36, run: rule36 },
  { n: 37, run: rule37 },
]

