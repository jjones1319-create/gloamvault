import { describe, expect, it } from 'vitest'
import { canonicalJson, hashState } from '../src/hash.ts'

describe('state hashing (03 §10.1)', () => {
  it('ignores key order and undefined, keeps arrays ordered', () => {
    expect(canonicalJson({ b: 1, a: [1, 2, { z: null, y: 'x' }] })).toBe('{"a":[1,2,{"y":"x","z":null}],"b":1}')
    expect(hashState({ b: 1, a: 2 })).toBe(hashState({ a: 2, b: 1 }))
    expect(hashState({ a: 2, b: undefined })).toBe(hashState({ a: 2 }))
    expect(hashState([1, 2])).not.toBe(hashState([2, 1]))
    expect(hashState({ a: 1 })).not.toBe(hashState({ a: 2 }))
    expect(hashState({ hp: 10 })).toMatch(/^[0-9a-f]{8}$/)
  })

  it('refuses non-finite numbers (they would never replay)', () => {
    expect(() => hashState({ x: Number.NaN })).toThrow()
    expect(() => hashState({ x: Infinity })).toThrow()
  })
})
