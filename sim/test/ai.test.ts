import { describe, expect, it } from 'vitest'
import { DEFAULT_ACTION, decide, parseBehavior, parseRule, ruleReferences, type Condition } from '../src/ai.ts'

describe('the gambit language (03 §3.6)', () => {
  it("parses the Warden's default rule", () => {
    const r = parseRule('IF ally HP < 40% THEN provoke; ELSE shield slam front enemy')
    expect(r.errors).toEqual([])
    expect(r.clauses).toHaveLength(2)
    expect(r.clauses[0]).toEqual({ conditions: [{ subject: 'ally', metric: 'hp', cmp: '<', value: 40, percent: true }], action: { verb: 'named', ref: 'provoke' } })
    expect(r.clauses[1]).toEqual({ conditions: [], action: { verb: 'named', ref: 'shield slam', target: 'front enemy' } })
    expect(ruleReferences(r)).toEqual(['provoke', 'shield slam'])
  })

  it('parses the rulebook example with skill slots and targets', () => {
    const r = parseRule('IF ally HP < 40% THEN skill 2 on lowest ally; ELSE basic attack nearest')
    expect(r.errors).toEqual([])
    expect(r.clauses[0]?.action).toEqual({ verb: 'skill', ref: '2', target: 'lowest ally' })
    expect(r.clauses[1]?.action).toEqual({ verb: 'basic', target: 'nearest' })
  })

  it('parses monster behavior lines and keeps always as the default', () => {
    const r = parseBehavior([
      { if: 'self HP < 15%', then: 'flee' },
      { if: 'ally count < 2 AND self HP < 50%', then: 'guard' },
      { if: 'always', then: 'bite' },
    ])
    expect(r.errors).toEqual([])
    expect(r.clauses).toHaveLength(3)
    expect(r.clauses[0]?.action).toEqual({ verb: 'flee' })
    expect(r.clauses[1]?.conditions).toHaveLength(2)
    expect(r.clauses[2]).toEqual({ conditions: [], action: { verb: 'named', ref: 'bite' } })
  })

  it('status, light and round conditions; items, stances, swap row, free ally, ultimate', () => {
    const r = parseRule('IF self status bleed THEN item bandage on self; IF light < 25 THEN use torch; IF round > 10 THEN ultimate; IF enemy has grab THEN free ally; IF pet HP < 30% THEN stance guard; ELSE swap row')
    expect(r.errors).toEqual([])
    expect(r.clauses.map((c) => c.action.verb)).toEqual(['item', 'item', 'ultimate', 'freeAlly', 'stance', 'swapRow'])
    expect(r.clauses[0]?.conditions[0]).toEqual({ subject: 'self', metric: 'status', statusId: 'bleed', cmp: '!=', value: 0, percent: false })
    expect(r.clauses[1]?.conditions[0]).toEqual({ subject: 'light', metric: 'value', cmp: '<', value: 25, percent: false })
    expect(r.clauses[4]?.action).toEqual({ verb: 'stance', ref: 'guard' })
  })

  it('never throws: bad clauses are reported and a default is appended', () => {
    const r = parseRule('IF the moon is full THEN dance; ELSE')
    expect(r.errors).toHaveLength(2)
    expect(r.clauses).toEqual([{ conditions: [], action: DEFAULT_ACTION }])
    const empty = parseRule('')
    expect(empty.clauses).toEqual([{ conditions: [], action: DEFAULT_ACTION }])
    const noElse = parseRule('IF self HP < 20% THEN guard')
    expect(noElse.clauses).toHaveLength(2)
    expect(noElse.clauses[1]?.action).toEqual(DEFAULT_ACTION)
  })

  it('decide picks the first clause whose conditions hold', () => {
    const r = parseRule('IF ally HP < 40% THEN skill 2 on lowest ally; IF self pool < 10 THEN basic attack; ELSE skill 1 front enemy')
    const ctx = (values: Partial<Record<string, number | null>>) => ({
      value: (c: Condition) => {
        const key = `${c.subject} ${c.metric}`
        return key in values ? (values[key] ?? null) : null
      },
    })
    expect(decide(r, ctx({ 'ally hp': 35, 'self pool': 50 }))).toEqual({ verb: 'skill', ref: '2', target: 'lowest ally' })
    expect(decide(r, ctx({ 'ally hp': 80, 'self pool': 5 }))).toEqual({ verb: 'basic', target: 'nearest' })
    expect(decide(r, ctx({ 'ally hp': 80, 'self pool': 50 }))).toEqual({ verb: 'skill', ref: '1', target: 'front enemy' })
    expect(decide(r, ctx({ 'ally hp': null, 'self pool': 50 }))).toEqual({ verb: 'skill', ref: '1', target: 'front enemy' })
  })
})
