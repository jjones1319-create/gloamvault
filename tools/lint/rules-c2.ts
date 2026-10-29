/**
 * Cross-file rules 50–54 (Phase 7, pass C2): the boss arenas and the telegraphed attacks (07 §2.8, 06 §3, 06 §8.10;
 * content/README.md "Boss arenas"). Same contract as rules.ts: each returns `{ file, rule, message }[]`; ids rule 2
 * already reports are skipped here. The arena's rule kinds are the sim's own closed list (sim/src/arena.ts reads each).
 */
import { at, bool, defined, num, obj, objs, str, strs, type JsonObject } from './json.ts'
import type { Ctx, Failure, Rec } from './rules.ts'

function fail(file: string, rule: number, message: string): Failure {
  return { file, rule, message }
}

/** The arena rule kinds sim/src/arena.ts implements, and the fields each reads (others are a typo or a silent no-op). */
const RULE_FIELDS: Readonly<Record<string, readonly string[]>> = {
  lightsOut: ['every', 'amount', 'tell', 'params'],
  flank: ['bands', 'monsters', 'params'],
  barricade: ['count', 'hits', 'status', 'duration', 'params'],
  reenter: ['every', 'afterRounds', 'tell', 'params'],
  frenzy: ['attacks', 'params'],
  oath: ['status', 'duration', 'params'],
  candles: ['count', 'tell', 'adds', 'params'],
  piles: ['count', 'hits', 'damageTypes'],
  call: ['attack', 'adds', 'params'],
  heel: ['monsters', 'params'],
  tide: ['max', 'every', 'fastEvery', 'fastBelowHpPercent', 'tell', 'status', 'duration', 'attribute', 'min', 'adds', 'params'],
  outOfReach: [],
  braziers: ['count', 'amount'],
  lightBand: ['bands', 'attacks', 'params'],
  pull: ['every', 'fastEvery', 'fastFromPhase', 'tell', 'params'],
  pulse: ['every', 'tell', 'status', 'duration'],
  addAt: ['atHpPercent', 'adds', 'params'],
  hunters: ['rounds', 'monsters', 'tell'],
}
const COMMON_FIELDS = new Set(['kind', 'phases', 'note'])
/** Rule kinds on a clock whose tell needs a round before the blow. */
const CLOCKED = new Set(['lightsOut', 'reenter', 'pull', 'pulse'])

function bosses(ctx: Ctx): Rec[] {
  return [...ctx.monsters.values()].filter((m) => obj(m.json.boss) !== undefined)
}

function attackIdsOf(m: Rec): Set<string> {
  return new Set(objs(m.json.attacks).map((a) => str(a.id)).filter(defined))
}

/** The dungeon's hunters: each zone's hunterId and every monster of the dungeon with role hunter. */
function huntersOf(ctx: Ctx, dungeonId: string): Set<string> {
  const out = new Set<string>()
  for (const z of ctx.zones.get(dungeonId)?.values() ?? []) {
    const h = str(z.hunterId)
    if (h) out.add(h)
  }
  for (const m of ctx.monsters.values()) if (str(m.json.dungeonId) === dungeonId && str(m.json.role) === 'hunter') out.add(m.id)
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 50: a boss's phase fields — the opener is one of the phase's attacks; a light step stays inside 0–100 as the
// phases run (starting from the floor's lightAtArena); the water a phase sets fits the arena's tide; the phase hooks are
// custom lines; the phase names are unique.

export function rule50(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const m of bosses(ctx)) {
    const boss = obj(m.json.boss)!
    const phases = objs(boss.phases)
    const tideRule = objs(at(boss, 'arena', 'rules')).find((r) => str(r.kind) === 'tide')
    const tideMax = num(tideRule?.max) ?? 8
    const placed = [...ctx.dungeons.values()].flatMap((d) => objs(d.json.floors).filter((f) => str(f.bossId) === m.id))
    let light = num(placed[0]?.lightAtArena) ?? 100
    const names = new Set<string>()
    phases.forEach((p, i) => {
      const attacks = new Set(strs(p.attacks))
      const opener = str(p.opener)
      if (opener !== undefined && !attacks.has(opener)) out.push(fail(m.file, 50, `boss.phases[${i}].opener '${opener}' is not one of the phase's attacks`))
      const set = num(at(p, 'light', 'set'))
      const add = num(at(p, 'light', 'add'))
      if (set !== undefined) light = set
      if (add !== undefined) light += add
      if (light < 0 || light > 100) out.push(fail(m.file, 50, `boss.phases[${i}].light leaves the arena at ${light}, outside 0–100`))
      const tide = num(p.tide)
      if (tide !== undefined && tide > tideMax) out.push(fail(m.file, 50, `boss.phases[${i}].tide ${tide} is above the arena's top step ${tideMax}`))
      for (const [j, line] of objs(p.hooks).entries()) if (str(line.kind) !== 'custom') out.push(fail(m.file, 50, `boss.phases[${i}].hooks[${j}] is a '${str(line.kind) ?? '?'}' line; phase hooks are custom lines`))
      const name = str(p.name)
      if (name !== undefined) {
        if (names.has(name)) out.push(fail(m.file, 50, `boss.phases[${i}].name '${name}' repeats`))
        names.add(name)
      }
    })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 51: the arena's rules — every kind is the sim's and carries only its own fields; a rule's phases exist; its tell
// is one of the arena's tells and a clocked rule's clock leaves a round for it; its attacks are the boss's; its adds and
// monsters resolve; the heel and the returning hunters are the dungeon's hunters; the light, counts and steps stay in
// range; the tide's steps (wade, chain, deep) lie inside its top step; a flank names monsters the boss brings.

export function rule51(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const m of bosses(ctx)) {
    const boss = obj(m.json.boss)!
    const arena = obj(boss.arena)
    if (!arena) continue
    const phases = objs(boss.phases).length
    const attacks = attackIdsOf(m)
    const tellIds = objs(arena.tells).map((t) => str(t.id)).filter(defined)
    const seenTells = new Set<string>()
    for (const id of tellIds) {
      if (seenTells.has(id)) out.push(fail(m.file, 51, `boss.arena.tells repeats '${id}'`))
      seenTells.add(id)
    }
    const used = new Set<string>()
    const hunters = huntersOf(ctx, str(m.json.dungeonId) ?? '')
    const brought = new Set<string>()
    for (const p of objs(boss.phases)) for (const a of objs(p.adds)) brought.add(str(a.monsterId) ?? '')
    objs(arena.rules).forEach((r, i) => {
      const where = `boss.arena.rules[${i}]`
      const kind = str(r.kind) ?? '?'
      const allowed = RULE_FIELDS[kind]
      if (!allowed) {
        out.push(fail(m.file, 51, `${where}.kind '${kind}' is not a rule sim/src/arena.ts runs`))
        return
      }
      for (const key of Object.keys(r)) if (!COMMON_FIELDS.has(key) && !allowed.includes(key)) out.push(fail(m.file, 51, `${where} (${kind}) carries '${key}', which a ${kind} rule does not read`))
      for (const ph of Array.isArray(r.phases) ? r.phases : []) {
        const n = num(ph)
        if (n === undefined || n < 1 || n > phases) out.push(fail(m.file, 51, `${where}.phases names phase ${String(ph)}; the boss has ${phases}`))
      }
      const tell = str(r.tell)
      if (tell !== undefined) {
        used.add(tell)
        if (!tellIds.includes(tell)) out.push(fail(m.file, 51, `${where}.tell '${tell}' is not one of boss.arena.tells`))
        const every = num(r.every)
        if (CLOCKED.has(kind) && every !== undefined && every < 2 && num(r.afterRounds) === undefined) out.push(fail(m.file, 51, `${where} fires every ${every} round with a tell; the tell needs the round before (every ≥ 2)`))
      }
      const atk = str(r.attack)
      if (atk !== undefined && !attacks.has(atk)) out.push(fail(m.file, 51, `${where}.attack '${atk}' is not one of the boss's attacks`))
      for (const a of strs(r.attacks)) if (!attacks.has(a)) out.push(fail(m.file, 51, `${where}.attacks '${a}' is not one of the boss's attacks`))
      for (const add of objs(r.adds)) {
        const id = str(add.monsterId)
        if (id !== undefined && !ctx.monsters.has(id)) out.push(fail(m.file, 51, `${where}.adds monsterId '${id}' does not exist`))
      }
      for (const id of strs(r.monsters)) {
        if (!ctx.monsters.has(id)) out.push(fail(m.file, 51, `${where}.monsters '${id}' does not exist`))
        else if ((kind === 'heel' || kind === 'hunters') && !hunters.has(id)) out.push(fail(m.file, 51, `${where}.monsters '${id}' is not a hunter of dungeon '${str(m.json.dungeonId) ?? '?'}'`))
        else if (kind === 'flank' && !brought.has(id)) out.push(fail(m.file, 51, `${where}.monsters '${id}' is not one of the adds the boss brings`))
      }
      if (kind === 'hunters' && strs(r.monsters).length !== (Array.isArray(r.rounds) ? r.rounds.length : 0)) out.push(fail(m.file, 51, `${where}: one round per returning hunter (${strs(r.monsters).length} hunters, ${Array.isArray(r.rounds) ? r.rounds.length : 0} rounds)`))
      const amount = num(r.amount)
      if (amount !== undefined && Math.abs(amount) > 100) out.push(fail(m.file, 51, `${where}.amount ${amount} is outside the light's 0–100`))
      if (kind === 'braziers' && ((num(r.count) ?? 0) < 1 || (num(r.count) ?? 0) > 8)) out.push(fail(m.file, 51, `${where}: a throne lights 1–8 braziers`))
      if (kind === 'tide') {
        const max = num(r.max) ?? 4
        for (const step of ['wadeAt', 'chainAt', 'deepAt']) {
          const s = num(at(r, 'params', step))
          if (s !== undefined && (s < 1 || s > max)) out.push(fail(m.file, 51, `${where}.params.${step} ${s} lies outside the tide's steps 1–${max}`))
        }
        if (r.attribute !== undefined && num(r.min) === undefined) out.push(fail(m.file, 51, `${where}: a sluice wheel (attribute) names its minimum (min)`))
      }
      if (kind === 'addAt' && num(r.atHpPercent) === undefined) out.push(fail(m.file, 51, `${where}: an addAt rule names its atHpPercent`))
      if (kind === 'reenter' && num(r.every) === undefined && num(r.afterRounds) === undefined) out.push(fail(m.file, 51, `${where}: a reenter rule runs on a clock (every) or after a fall (afterRounds)`))
      if (kind === 'call' && atk === undefined) out.push(fail(m.file, 51, `${where}: a call rule names the attack that calls`))
    })
    for (const id of tellIds) if (!used.has(id)) ctx.warnings.push(fail(m.file, 51, `boss.arena.tells '${id}' is never shown: no rule names it`))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 52: a boss's parts (06 §3 part-breaks) — unique ids, a phase that exists, effects that name the boss's attacks
// and statuses those attacks apply, and a part that changes something.

export function rule52(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const m of bosses(ctx)) {
    const boss = obj(m.json.boss)!
    const phases = objs(boss.phases).length
    const attacks = new Map(objs(m.json.attacks).map((a) => [str(a.id) ?? '', a] as const))
    const ids = new Set<string>()
    objs(boss.parts).forEach((p, i) => {
      const where = `boss.parts[${i}]`
      const id = str(p.id) ?? '?'
      if (ids.has(id)) out.push(fail(m.file, 52, `${where}.id '${id}' repeats`))
      ids.add(id)
      const from = num(p.fromPhase)
      if (from !== undefined && from > phases) out.push(fail(m.file, 52, `${where}.fromPhase ${from}: the boss has ${phases} phases`))
      const e = obj(p.effect) ?? {}
      for (const a of strs(e.removeAttacks)) if (!attacks.has(a)) out.push(fail(m.file, 52, `${where}.effect.removeAttacks '${a}' is not one of the boss's attacks`))
      for (const a of Object.keys(obj(e.attackMultiplier) ?? {})) if (!attacks.has(a)) out.push(fail(m.file, 52, `${where}.effect.attackMultiplier '${a}' is not one of the boss's attacks`))
      for (const [a, statuses] of Object.entries(obj(e.removeStatuses) ?? {})) {
        const atk = attacks.get(a)
        if (!atk) {
          out.push(fail(m.file, 52, `${where}.effect.removeStatuses '${a}' is not one of the boss's attacks`))
          continue
        }
        const applied = new Set(objs(atk.effects).filter((l) => str(l.kind) === 'applyStatus').map((l) => str(l.status)))
        for (const s of strs(statuses)) if (!applied.has(s)) out.push(fail(m.file, 52, `${where}.effect.removeStatuses: '${a}' applies no '${s}'`))
      }
      if (bool(e.stopTide) && !objs(at(boss, 'arena', 'rules')).some((r) => str(r.kind) === 'tide' || str(r.kind) === 'pull')) out.push(fail(m.file, 52, `${where}.effect.stopTide: the arena has no tide or pull to stop`))
    })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 53: telegraphed attacks (06 §8.10; D-099) — a boss's telegraphed attack carries its two-word hint (any other
// monster's only warns); a hint is two words; an aim is for a single-target attack; a boss's phase rolls at least one
// attack with a weight (a phase of triggers alone never acts).

const SINGLE = new Set(['enemy', 'enemyFront', 'enemyBack', 'enemyRandom'])

export function rule53(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const m of ctx.monsters.values()) {
    const isBoss = obj(m.json.boss) !== undefined
    objs(m.json.attacks).forEach((a, i) => {
      const where = `attacks[${i}] '${str(a.id) ?? '?'}'`
      const hint = str(a.hint)
      if (str(a.tell) !== undefined && hint === undefined) {
        if (isBoss) out.push(fail(m.file, 53, `${where} is telegraphed (a tell) but has no two-word hint (06 §8.10, D-099)`))
        else ctx.warnings.push(fail(m.file, 53, `${where} is telegraphed but has no hint; the HUD shows the attack's name`))
      }
      if (hint !== undefined && hint.trim().split(/\s+/).length !== 2) ctx.warnings.push(fail(m.file, 53, `${where}.hint '${hint}' is not two words (D-099)`))
      if (str(a.aim) !== undefined && !SINGLE.has(str(a.target) ?? '')) out.push(fail(m.file, 53, `${where}.aim '${str(a.aim)}' needs a single-target attack (target ${str(a.target) ?? '?'})`))
    })
    if (!isBoss) continue
    const byId = new Map(objs(m.json.attacks).map((a) => [str(a.id) ?? '', a] as const))
    objs(at(m.json, 'boss', 'phases')).forEach((p, i) => {
      const weighted = strs(p.attacks).filter((id) => (num(byId.get(id)?.aiWeight) ?? 0) > 0)
      if (strs(p.attacks).length > 0 && weighted.length === 0) out.push(fail(m.file, 53, `boss.phases[${i}] has no attack with an aiWeight above 0: the boss would never act`))
    })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Rule 54: the arena's room — a boss arena names a template of its dungeon that hosts a boss, and the boss sits on a
// floor with an arena light (07 §2.3 "arena sets").

export function rule54(ctx: Ctx): Failure[] {
  const out: Failure[] = []
  for (const m of bosses(ctx)) {
    const room = str(at(m.json, 'boss', 'arena', 'room'))
    if (room === undefined) continue
    const dungeonId = str(m.json.dungeonId) ?? ''
    const d = ctx.dungeons.get(dungeonId)
    const folder = d ? (d.file.split('/')[2] ?? '') : ''
    const tpl = ctx.templateFiles.find((x) => x.dungeonFolder === folder && str(x.json.id) === room) as { json: JsonObject } | undefined
    if (!tpl) {
      // The Crypts' and the Vault's templates ship as .json.later until their floors are switched on (Phase 6 → 7).
      ctx.warnings.push(fail(m.file, 54, `boss.arena.room '${room}' is not a live template of '${dungeonId}' yet`))
    } else if (!strs(tpl.json.kinds).includes('boss')) out.push(fail(m.file, 54, `boss.arena.room '${room}' does not host a boss (its kinds: ${strs(tpl.json.kinds).join(', ')})`))
    const placed = d ? objs(d.json.floors).filter((f) => str(f.bossId) === m.id) : []
    for (const f of placed) if (num(f.lightAtArena) === undefined) out.push(fail(m.file, 54, `floor ${num(f.floor) ?? '?'} holds this boss but sets no lightAtArena (07 §2.3)`))
  }
  return out
}

export const RULES_C2: ReadonlyArray<{ n: number; run: (ctx: Ctx) => Failure[] }> = [
  { n: 50, run: rule50 },
  { n: 51, run: rule51 },
  { n: 52, run: rule52 },
  { n: 53, run: rule53 },
  { n: 54, run: rule54 },
]
