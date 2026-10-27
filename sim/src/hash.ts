import { hashString } from './rng.ts'

/**
 * State hashing (03-GAME-DESIGN §10.1, 10-TECH-PLAN §5): every phone hashes the sim state every N commands and
 * compares. The hash is FNV-1a over a canonical JSON (object keys sorted, no undefined, numbers as written), so
 * it is independent of insertion order and of the engine.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('canonicalJson: non-finite number')
      return Number.isInteger(value) ? String(value) : JSON.stringify(value)
    }
    if (value === undefined) return 'null'
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`
}

/** A 32-bit hash of any plain state object, as 8 hex characters. */
export function hashState(value: unknown): string {
  return hashString(canonicalJson(value)).toString(16).padStart(8, '0')
}
