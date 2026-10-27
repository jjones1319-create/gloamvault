/**
 * JSON helpers for the linter: a Json type and defensive accessors that never throw.
 * The cross-file rules run over files that may have failed schema validation, so every read is guarded.
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type JsonObject = { [key: string]: Json }

export function isObj(v: unknown): v is JsonObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function obj(v: unknown): JsonObject | undefined {
  return isObj(v) ? v : undefined
}

export function arr(v: unknown): Json[] | undefined {
  return Array.isArray(v) ? (v as Json[]) : undefined
}

export function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

export function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

export function bool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined
}

/** The string members of an array (anything else is dropped). */
export function strs(v: unknown): string[] {
  return (arr(v) ?? []).filter((x): x is string => typeof x === 'string')
}

/** The object members of an array (anything else is dropped). */
export function objs(v: unknown): JsonObject[] {
  return (arr(v) ?? []).filter(isObj)
}

/** Walks a key path; undefined when any step is missing or not an object. */
export function at(v: unknown, ...keys: string[]): Json | undefined {
  let cur: unknown = v
  for (const k of keys) {
    if (!isObj(cur)) return undefined
    cur = cur[k]
  }
  return cur as Json | undefined
}

/** A `tuningNumber` leaf (common.schema.json): a bare number or `{ value, note }`. */
export function tnum(v: unknown): number | undefined {
  return num(v) ?? num(at(v, 'value'))
}

/** Sum of the numeric members of an iterable; non-numbers count 0. */
export function sum(values: Iterable<unknown>): number {
  let s = 0
  for (const v of values) s += num(v) ?? 0
  return s
}

/** Visits every object in a JSON tree, depth first, with a dotted path for messages. */
export function walk(v: unknown, visit: (o: JsonObject, where: string) => void, where = ''): void {
  if (Array.isArray(v)) {
    v.forEach((x, i) => walk(x, visit, `${where}[${i}]`))
    return
  }
  if (isObj(v)) {
    visit(v, where)
    for (const [k, x] of Object.entries(v)) walk(x, visit, where ? `${where}.${k}` : k)
  }
}

export function defined<T>(v: T | undefined | null): v is T {
  return v !== undefined && v !== null
}
