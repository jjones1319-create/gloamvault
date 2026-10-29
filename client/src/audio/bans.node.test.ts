import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Phase 8 (pass A), the ported engine's rules (Wildsong Ranch's SOUND_UPGRADE §14.1): only engine/nodes.ts creates
 * oscillators, PeriodicWaves and compressors; no WaveShaper and no square or sawtooth wave anywhere; the audio's
 * randomness is its own seeded generator, never Math.random; and nothing in the sim imports the audio.
 */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p.replace(/\\/g, '/'))
  }
  return out
}

const AUDIO = 'client/src/audio'
const files = walk(AUDIO)

describe('audio bans', () => {
  it('only nodes.ts creates oscillators, PeriodicWaves or compressors', () => {
    const offenders: string[] = []
    for (const f of files) {
      if (f.endsWith('/engine/nodes.ts') || f.endsWith('/engine/fakeAudio.ts')) continue
      const text = readFileSync(f, 'utf8')
      for (const needle of ['createOscillator', 'new OscillatorNode', 'createPeriodicWave', 'new PeriodicWave', 'createDynamicsCompressor', 'new DynamicsCompressorNode', 'createWaveShaper', 'new WaveShaperNode']) {
        if (text.includes(needle)) offenders.push(`${f}: ${needle}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('no WaveShaper, no square or sawtooth wave, no Math.random', () => {
    const offenders: string[] = []
    for (const f of files) {
      // Code only: a comment may say what the code never does.
      const text = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
      if (text.includes('createWaveShaper')) offenders.push(`${f}: WaveShaper`)
      if (/type\s*=\s*['"](square|sawtooth)['"]/.test(text) || /makeOscillator\([^)]*['"](square|sawtooth)['"]/.test(text)) offenders.push(`${f}: a harsh wave`)
      if (text.includes('Math.random')) offenders.push(`${f}: Math.random`)
    }
    expect(offenders).toEqual([])
  })

  it('the sim never imports the audio', () => {
    const sim = walk('sim/src')
    expect(sim.filter((f) => /from\s+['"][^'"]*audio/.test(readFileSync(f, 'utf8')))).toEqual([])
  })
})
