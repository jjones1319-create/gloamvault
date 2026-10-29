/**
 * The gambit language (03-GAME-DESIGN §3.6, §10.2; monster behavior lines in 06): one line per hero, a few per
 * monster, in plain words: `IF ally HP < 40% THEN provoke; ELSE shield slam front enemy`. This module only parses;
 * the fight resolves verbs against the actor's loadout and attacks. Parsing never throws: a bad clause is dropped
 * and reported, and a rule always ends with a usable default.
 */
/** `phase` and `tide` read a boss arena (07 §2.8): the boss's phase (1-based) and the water's step; outside an arena 1 and 0. */
export const CONDITION_SUBJECTS = ['self', 'ally', 'allies', 'lowest ally', 'enemy', 'enemies', 'party', 'pet', 'light', 'round', 'fight', 'phase', 'tide'] as const
export type ConditionSubject = (typeof CONDITION_SUBJECTS)[number]

export const CONDITION_METRICS = ['hp', 'pool', 'stamina', 'mana', 'momentum', 'count', 'level', 'value', 'status'] as const
export type ConditionMetric = (typeof CONDITION_METRICS)[number]

export type Comparator = '<' | '<=' | '>' | '>=' | '=' | '!='

export interface Condition {
  subject: ConditionSubject
  metric: ConditionMetric
  /** For `status`: the status id ("ally status bleed"). */
  statusId?: string
  cmp: Comparator
  value: number
  /** True when the value was written with a % (of max). */
  percent: boolean
}

export const TARGET_SELECTORS = [
  'nearest',
  'self',
  'lowest ally',
  'lowest hp ally',
  'weakest ally',
  'random ally',
  'front enemy',
  'back enemy',
  'random enemy',
  'weakest enemy',
  'strongest enemy',
  'lowest enemy',
  'fastest enemy',
  'marked enemy',
  'taunter',
  'pet',
  'all',
] as const
export type TargetSelector = (typeof TARGET_SELECTORS)[number]

export type ActionVerb = 'basic' | 'skill' | 'ultimate' | 'guard' | 'item' | 'swapRow' | 'flee' | 'freeAlly' | 'stance' | 'named'

export interface Action {
  verb: ActionVerb
  /** `skill`: the loadout slot 1–4; `item`/`named`/`stance`: the id or name as written. */
  ref?: string
  target?: TargetSelector
}

export interface Clause {
  conditions: Condition[]
  action: Action
}

export interface Rule {
  clauses: Clause[]
  /** Clauses the parser could not read, with the reason. */
  errors: { text: string; reason: string }[]
  source: string
}

export const DEFAULT_ACTION: Action = { verb: 'basic', target: 'nearest' }

const COMPARATORS: Comparator[] = ['<=', '>=', '!=', '<', '>', '=']

function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

function parseCondition(text: string): Condition | null {
  const t = normalise(text)
  if (t === 'always' || t === '') return null
  // status form: "<subject> status <id>" / "<subject> not status <id>" / "<subject> has <id>"
  const status = /^(self|ally|allies|lowest ally|enemy|enemies|party|pet) (not )?(?:status|has) ([a-z][a-z0-9-]*)$/.exec(t)
  if (status) {
    return { subject: status[1] as ConditionSubject, metric: 'status', statusId: status[3], cmp: status[2] ? '=' : '!=', value: 0, percent: false }
  }
  for (const cmp of COMPARATORS) {
    const at = t.indexOf(` ${cmp} `)
    if (at < 0) continue
    const left = t.slice(0, at).trim()
    const right = t.slice(at + cmp.length + 2).trim()
    const m = /^(-?\d+)(%?)$/.exec(right)
    if (!m) return null
    const value = Number(m[1])
    const percent = m[2] === '%'
    // left is "<subject> <metric>" or a bare subject with an implied metric (light, round).
    const parts = left.split(' ')
    const metricWord = parts[parts.length - 1] ?? ''
    const metric = metricWord === 'hp' ? 'hp' : (CONDITION_METRICS as readonly string[]).includes(metricWord) ? (metricWord as ConditionMetric) : null
    let subject: string
    if (metric) subject = parts.slice(0, -1).join(' ')
    else subject = left
    const resolvedMetric: ConditionMetric | null = metric ?? (subject === 'light' || subject === 'round' || subject === 'phase' || subject === 'tide' ? 'value' : null)
    if (!resolvedMetric) return null
    if (!(CONDITION_SUBJECTS as readonly string[]).includes(subject)) return null
    return { subject: subject as ConditionSubject, metric: resolvedMetric, cmp, value, percent }
  }
  return null
}

function parseTarget(words: string[]): { target?: TargetSelector; rest: string[] } {
  // Longest selector first, allowing an "on" before it.
  const text = words.join(' ')
  const candidates = [...TARGET_SELECTORS].sort((a, b) => b.length - a.length)
  for (const sel of candidates) {
    for (const prefix of [' on ', ' at ', ' ']) {
      const suffix = `${prefix}${sel}`
      if (text.endsWith(suffix) && text.length > suffix.length) {
        return { target: sel, rest: text.slice(0, -suffix.length).trim().split(' ') }
      }
    }
    if (text === sel) return { target: sel, rest: [] }
  }
  return { rest: words }
}

function parseAction(text: string): Action | null {
  const t = normalise(text)
  if (!t) return null
  const words = t.split(' ')
  const { target, rest } = parseTarget(words)
  const head = rest.join(' ')
  const withTarget = (a: Action): Action => (target ? { ...a, target } : a)
  if (head === 'basic attack' || head === 'attack' || head === 'basic') return withTarget({ verb: 'basic', target: 'nearest' })
  if (head === 'guard' || head === 'defend') return { verb: 'guard' }
  if (head === 'flee' || head === 'retreat') return { verb: 'flee' }
  if (head === 'swap row' || head === 'swap rows' || head === 'swap') return { verb: 'swapRow' }
  if (head === 'free ally' || head === 'free') return withTarget({ verb: 'freeAlly' })
  if (head === 'ultimate') return withTarget({ verb: 'ultimate' })
  const skill = /^skill (\d)$/.exec(head)
  if (skill) return withTarget({ verb: 'skill', ref: skill[1] })
  const item = /^(?:item|use) (.+)$/.exec(head)
  if (item) return withTarget({ verb: 'item', ref: item[1] })
  const stance = /^stance (fierce|guard|mend|forage)$/.exec(head)
  if (stance) return { verb: 'stance', ref: stance[1] }
  if (head === '' && target) return { verb: 'basic', target }
  if (head === '') return null
  // Anything else names a skill or an attack: "provoke", "shield slam", "evil-eye".
  return withTarget({ verb: 'named', ref: head })
}

/** Parses one rule line. The clauses are tried in order; the first whose conditions all hold wins. */
export function parseRule(source: string): Rule {
  const clauses: Clause[] = []
  const errors: Rule['errors'] = []
  const pieces = source
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
  for (const piece of pieces) {
    const lower = piece.toLowerCase()
    let condText = ''
    let actionText = piece
    if (lower.startsWith('if ')) {
      const thenAt = lower.indexOf(' then ')
      if (thenAt < 0) {
        errors.push({ text: piece, reason: 'IF without THEN' })
        continue
      }
      condText = piece.slice(3, thenAt)
      actionText = piece.slice(thenAt + 6)
    } else if (lower.startsWith('else ')) {
      actionText = piece.slice(5)
    } else if (lower === 'else') {
      errors.push({ text: piece, reason: 'ELSE without an action' })
      continue
    }
    const conditions: Condition[] = []
    let bad = false
    if (condText.trim()) {
      for (const c of condText.split(/\s+and\s+/i)) {
        const parsed = parseCondition(c)
        if (parsed) conditions.push(parsed)
        else if (normalise(c) !== 'always') {
          errors.push({ text: piece, reason: `cannot read the condition "${c.trim()}"` })
          bad = true
          break
        }
      }
    }
    if (bad) continue
    const action = parseAction(actionText)
    if (!action) {
      errors.push({ text: piece, reason: `cannot read the action "${actionText.trim()}"` })
      continue
    }
    clauses.push({ conditions, action })
  }
  if (clauses.length === 0 || clauses[clauses.length - 1]!.conditions.length > 0) clauses.push({ conditions: [], action: DEFAULT_ACTION })
  return { clauses, errors, source }
}

/** Parses a monster's behavior lines (06: `{ if, then }` pairs) into one rule, `always` as the default. */
export function parseBehavior(lines: readonly { if: string; then: string }[]): Rule {
  return parseRule(lines.map((l) => (normalise(l.if) === 'always' ? `ELSE ${l.then}` : `IF ${l.if} THEN ${l.then}`)).join('; '))
}

/** What the fight gives the evaluator to answer a condition. */
export interface ConditionContext {
  /** value(subject, metric, statusId) → a number or null when the subject does not exist (then the condition fails). */
  value(c: Condition): number | null
}

export function compare(cmp: Comparator, left: number, right: number): boolean {
  switch (cmp) {
    case '<':
      return left < right
    case '<=':
      return left <= right
    case '>':
      return left > right
    case '>=':
      return left >= right
    case '=':
      return left === right
    case '!=':
      return left !== right
  }
}

/** Picks the first clause whose conditions all hold. */
export function decide(rule: Rule, ctx: ConditionContext): Action {
  for (const clause of rule.clauses) {
    let ok = true
    for (const c of clause.conditions) {
      const v = ctx.value(c)
      if (v === null || !compare(c.cmp, v, c.value)) {
        ok = false
        break
      }
    }
    if (ok) return clause.action
  }
  return DEFAULT_ACTION
}

/** Every matching clause's action in rule order, then the default: the caller takes the first it can carry out (D-079). */
export function decideAll(rule: Rule, ctx: ConditionContext): Action[] {
  const out: Action[] = []
  for (const clause of rule.clauses) {
    let ok = true
    for (const c of clause.conditions) {
      const v = ctx.value(c)
      if (v === null || !compare(c.cmp, v, c.value)) {
        ok = false
        break
      }
    }
    if (ok) out.push(clause.action)
  }
  out.push(DEFAULT_ACTION)
  return out
}

/** The skill or attack ids a rule refers to by name, for the linter and the loadout screen. */
export function ruleReferences(rule: Rule): string[] {
  const out: string[] = []
  for (const c of rule.clauses) if (c.action.verb === 'named' && c.action.ref) out.push(c.action.ref)
  return out
}
