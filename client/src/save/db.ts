import { createStore, del, get, keys, set, type UseStore } from 'idb-keyval'

/**
 * Storage (10-TECH-PLAN §6). IndexedDB through idb-keyval in a database of our own; every key is prefixed
 * `gloamvault/` because all GitHub Pages sites of one account share one origin (CLAUDE.md). Everything is written
 * against a tiny store interface so the rules can be tested on an in-memory store, and nothing here ever throws:
 * a broken database reads as "nothing there" and a failed write returns false.
 */
export interface KeyValueStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  del(key: string): Promise<void>
  keys(): Promise<string[]>
}

export const KEY_PREFIX = 'gloamvault/'

export const KEYS = {
  settings: `${KEY_PREFIX}settings`,
  profile: `${KEY_PREFIX}profile`,
  delve: `${KEY_PREFIX}delve`,
  /** Set by Erase (the save is gone on purpose: never fall back to a backup); cleared by the next save. */
  erased: `${KEY_PREFIX}profile-erased`,
} as const

/** The real thing: one IndexedDB database of our own, so other sites on the origin cannot collide with it. */
export function idbStore(): KeyValueStore {
  let store: UseStore | null = null
  const use = () => (store ??= createStore('gloamvault', 'kv'))
  return {
    get: (key) => get(key, use()),
    set: (key, value) => set(key, value, use()),
    del: (key) => del(key, use()),
    keys: async () => (await keys(use())).filter((k): k is string => typeof k === 'string'),
  }
}

/** For tests and for pages where IndexedDB is unavailable. */
export function memoryStore(): KeyValueStore {
  const map = new Map<string, unknown>()
  return {
    get: async (key) => structuredClone(map.get(key)),
    set: async (key, value) => void map.set(key, structuredClone(value)),
    del: async (key) => void map.delete(key),
    keys: async () => [...map.keys()],
  }
}

export async function safeGet(store: KeyValueStore, key: string): Promise<unknown> {
  try {
    return await store.get(key)
  } catch {
    return undefined
  }
}

export async function safeSet(store: KeyValueStore, key: string, value: unknown): Promise<boolean> {
  try {
    await store.set(key, value)
    return true
  } catch {
    return false
  }
}

export async function safeDel(store: KeyValueStore, key: string): Promise<boolean> {
  try {
    await store.del(key)
    return true
  } catch {
    return false
  }
}
