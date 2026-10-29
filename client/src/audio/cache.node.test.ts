import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Phase 8 (pass A): no audio file is precached. The samples and the manifest are runtime-cached (fetched per place on
 * first use), so the service-worker precache stays under its 8 MB budget (10 §7): vite.config.ts ignores the audio
 * folder in the precache glob and caches it at run time with RegExp rules (a function would be copied into sw.js as
 * text, where its closure does not exist). When a build is present, its sw.js lists no audio file.
 */
const config = readFileSync('vite.config.ts', 'utf8')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p.replace(/\\/g, '/'))
  }
  return out
}

describe('the audio is runtime-cached, never precached', () => {
  it('the precache glob ignores the audio folder', () => {
    const ignores = /globIgnores:\s*\[([^\]]*)\]/.exec(config)?.[1] ?? ''
    expect(ignores).toContain("'**/audio/**'")
  })

  it('the audio has runtime rules: the manifest stale-while-revalidate, the samples cache-first, both as RegExps', () => {
    expect(config).toMatch(/urlPattern: new RegExp\(`\$\{BASE\}audio\/manifest\\\\\.json`\),\s*handler: 'StaleWhileRevalidate'/)
    expect(config).toMatch(/urlPattern: new RegExp\(`\$\{BASE\}audio\/\.\+\\\\\.ogg`\),\s*handler: 'CacheFirst'/)
    // The RegExps match the deployed URLs (the content hash rides in the query).
    const manifest = new RegExp('/gloamvault/audio/manifest\\.json')
    const ogg = new RegExp('/gloamvault/audio/.+\\.ogg')
    expect(manifest.test('https://example.github.io/gloamvault/audio/manifest.json')).toBe(true)
    expect(ogg.test('https://example.github.io/gloamvault/audio/harp/pluck_60.ogg?v=1a2b3c4d')).toBe(true)
    expect(ogg.test('https://example.github.io/gloamvault/assets/index-abc.js')).toBe(false)
  })

  it('every audio file sits under client/public/audio, which the ignore covers', () => {
    const files = walk('client/public/audio')
    expect(files.length).toBeGreaterThan(100)
    for (const f of files) expect(f).toMatch(/\/audio\//)
    // A precache glob would only pick up these extensions; .ogg is not among them, and json is ignored by folder.
    const glob = /globPatterns:\s*\[([^\]]*)\]/.exec(config)?.[1] ?? ''
    expect(glob).not.toContain('ogg')
  })

  it('a built sw.js, when there is one, precaches no audio file', () => {
    const sw = join('dist', 'sw.js')
    if (!existsSync(sw)) return
    const urls = [...readFileSync(sw, 'utf8').matchAll(/["']?url["']?\s*:\s*"([^"]+)"/g)].map((m) => m[1]!)
    expect(urls.filter((u) => /(^|\/)audio\//.test(u))).toEqual([])
  })
})
