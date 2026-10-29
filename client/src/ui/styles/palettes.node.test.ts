import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The colour-blind palettes (Phase 8, a11y.css) checked the way they were chosen: each colour that carries meaning is
 * put through a simulation of the colour vision it serves (Machado, Oliveira & Fernandes 2009, severity 1) and every
 * pair that must read apart stays at least 20 CIE76 units apart — for that vision and for normal vision.
 */

const ROOT = path.resolve('client/src/ui')
const css = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')

/** `--name: #hex` declarations inside the first block whose selector is `selector`. */
function tokens(text: string, selector: string): Record<string, string> {
  const at = text.indexOf(`${selector} {`)
  if (at < 0) return {}
  const body = text.slice(at, text.indexOf('}', at))
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)) out[m[1]!] = m[2]!.toLowerCase()
  return out
}

const standard = { ...tokens(css('styles/base.css'), ':root'), ...tokens(css('kit/kit.css'), ':root'), ...tokens(css('screens/delve/fight.css'), '.fx-hud'), ...tokens(css('screens/delve.css'), ':root') }
const a11y = css('styles/a11y.css')
const palette = (name: string) => ({ ...standard, ...tokens(a11y, `html[data-palette='${name}']`), ...tokens(a11y, `html[data-palette='${name}'] .fx-hud`) })

const MATRICES: Record<string, number[][] | null> = {
  normal: null,
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
}

function lab(hex: string, vision: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  let rgb = [lin(((n >> 16) & 255) / 255), lin(((n >> 8) & 255) / 255), lin((n & 255) / 255)]
  const m = MATRICES[vision]
  if (m) rgb = m.map((row) => Math.min(1, Math.max(0, row[0]! * rgb[0]! + row[1]! * rgb[1]! + row[2]! * rgb[2]!)))
  const [r, g, b] = rgb as [number, number, number]
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047)
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b)
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

function distance(a: string, b: string, vision: string): number {
  const p = lab(a, vision)
  const q = lab(b, vision)
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

/** The pairs that must read apart: good and bad, friend and foe, the pools, the threat, the grades. */
const PAIRS: [string, string][] = [
  ['--good', '--bad'],
  ['--fx-hero', '--fx-foe'],
  ['--hp', '--pool-stamina'],
  ['--hp', '--pool-mana'],
  ['--pool-stamina', '--pool-mana'],
  ['--dv-easy', '--dv-dangerous'],
  ['--dv-easy', '--dv-deadly'],
  ['--dv-dangerous', '--dv-deadly'],
  ['--grade-e', '--grade-s'],
  ['--grade-e', '--grade-b'],
  ['--grade-d', '--grade-c'],
  ['--grade-b', '--grade-a'],
  ['--grade-a', '--grade-ss'],
  ['--grade-c', '--grade-ss'],
  ['--grade-b', '--grade-s'],
  ['--grade-f', '--grade-e'],
  ['--grade-e', '--grade-d'],
]

describe('the colour-blind palettes (a11y.css)', () => {
  it('reads every colour it checks from the stylesheets', () => {
    for (const name of ['redGreen', 'blueYellow']) {
      const p = palette(name)
      for (const [a, b] of PAIRS) {
        expect(p[a], `${name} ${a}`).toMatch(/^#[0-9a-f]{6}$/)
        expect(p[b], `${name} ${b}`).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  for (const [name, visions] of [
    ['redGreen', ['normal', 'protan', 'deutan']],
    ['blueYellow', ['normal', 'tritan']],
  ] as const) {
    it(`${name}: every pair stays at least 20 apart for ${visions.join(', ')} vision`, () => {
      const p = palette(name)
      for (const [a, b] of PAIRS) for (const v of visions) expect(distance(p[a]!, p[b]!, v), `${name} ${a} / ${b} (${v})`).toBeGreaterThanOrEqual(20)
    })
  }

  it('the standard palette is what the check improves on: green and red good and bad read alike to deuteranopia', () => {
    expect(distance(standard['--good']!, standard['--bad']!, 'deutan')).toBeLessThan(20)
  })
})
