/**
 * Cross-file rules 80–81 (Phase 8, pass D): the AI rules the content ships (each class's default, a wayfarer's own) and
 * the champion-HP-by-zone table (content/README.md rules 80–81). Same contract as rules.ts: each rule returns
 * `{ file, rule, message }[]` and skips what the schema already reports. Rules 82–84 are kept for this pass.
 */
import { parseRule } from '../../sim/src/ai.ts'
import { at, isObj, num, obj, objs, str, type JsonObject } from './json.ts'
import type { Ctx, Failure, Rec } from './rules.ts'

function fail(file: string, rule: number, message: string): Failure {
  return { file, rule, message }
}

/** The fight's name match (fight.ts matchesName): the id, the name as a slug, or an id ending in "-<slug>". */
function matches(id: string, name: string, ref: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const r = norm(ref)
  return id === r || norm(name) === r || id.endsWith(`-${r}`)
}

/** An item an AI rule's `item <ref>` can use in a fight: a consumable usable in combat, or a relic with a fight active. */
function fightItem(rec: Rec): boolean {
  if (isObj(rec.json.consumable) && rec.json.consumable.inCombat === true) return true
  const active = obj(rec.json.active)
  return str(rec.json.kind) === 'relic' && active !== undefined && str(active.timing) !== 'afterFight'
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 80: an AI rule the content ships — a class's `aiRuleDefault`, a wayfarer's own `aiRule` — parses with no clause
// dropped (sim/src/ai.ts parseRule), every `item <ref>` names an item a hero can use in a fight (a consumable usable in
// combat, or a relic with a fight active: Phase 8's relic lines), and every named skill is one of the hero's class.

function checkRule(ctx: Ctx, file: string, where: string, text: string, classId: string | undefined): Failure[] {
  const out: Failure[] = []
  const rule = parseRule(text)
  for (const e of rule.errors) out.push(fail(file, 80, `${where}: the clause "${e.text}" is dropped (${e.reason})`))
  const items = [...ctx.items.values()]
  const skills = [...ctx.skills.values()].filter((s) => classId === undefined || str(s.json.classId) === classId)
  for (const c of rule.clauses) {
    const ref = c.action.ref
    if (!ref) continue
    if (c.action.verb === 'item' && !items.some((i) => fightItem(i) && matches(i.id, str(i.json.name) ?? '', ref))) out.push(fail(file, 80, `${where}: "item ${ref}" names no consumable usable in a fight and no relic with a fight active`))
    if (c.action.verb === 'named' && classId !== undefined && !skills.some((s) => matches(s.id, str(s.json.name) ?? '', ref))) out.push(fail(file, 80, `${where}: "${ref}" is no ${classId} skill`))
  }
  return out
}

export function rule80(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const c of ctx.classes.values()) {
    const text = str(c.json.aiRuleDefault)
    if (text !== undefined) out.push(...checkRule(ctx, c.file, 'aiRuleDefault', text, c.id))
  }
  for (const w of ctx.wayfarers.values()) {
    const text = str(w.json.aiRule)
    if (text !== undefined) out.push(...checkRule(ctx, w.file, 'aiRule', text, str(w.json.classId)))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 81: tuning.json → dungeon.championHpPercentByZone (Phase 8): every key but `note` is a dungeon and each number is a
// percent in 25–400 (a champion stays a champion); a number for a zone the dungeon does not have yet warns (the sim reads
// 100% past its zones, as the runner skips a recipe for a zone still to come — rule 63).

export function rule81(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  const file = ctx.corpus.byKind.get('tuning')?.[0]
  const table = obj(at(file?.json, 'dungeon', 'championHpPercentByZone'))
  if (!file || !table) return out
  for (const [id, v] of Object.entries(table)) {
    if (id === 'note') continue
    const dungeon = ctx.dungeons.get(id)
    if (ctx.dungeons.size > 0 && !dungeon) out.push(fail(file.path, 81, `dungeon.championHpPercentByZone names '${id}', which is not a dungeon`))
    if (!Array.isArray(v)) {
      out.push(fail(file.path, 81, `dungeon.championHpPercentByZone.${id} must be a list of percents, one per zone`))
      continue
    }
    const zones = dungeon ? objs((dungeon.json as JsonObject).zones).length : v.length
    if (v.length > zones) ctx.warnings.push(fail(file.path, 81, `dungeon.championHpPercentByZone.${id} has ${v.length} numbers; the dungeon has ${zones} zone${zones === 1 ? '' : 's'} yet (the rest wait for theirs)`))
    v.forEach((p, i) => {
      const n = num(p)
      if (n === undefined || n < 25 || n > 400) out.push(fail(file.path, 81, `dungeon.championHpPercentByZone.${id}[${i}] is ${String(p)}; a percent in 25–400`))
    })
  }
  return out
}

export const RULES_P8D: ReadonlyArray<{ n: number; run: (ctx: Ctx) => Failure[] }> = [
  { n: 80, run: rule80 },
  { n: 81, run: rule81 },
]
