import { describe, expect, it } from 'vitest'
import { TIP_GUTTER, TIP_MAX_WIDTH, bubblePlacement } from './tipPlace.ts'

const PHONE = { width: 892, height: 412 }

describe('where a stat’s bubble goes', () => {
  it('sits under a stat in the top part of the screen, centred on it', () => {
    const p = bubblePlacement({ left: 400, top: 100, right: 500, bottom: 144 }, PHONE)
    expect(p.side).toBe('below')
    expect(p.top).toBe(150)
    expect(p.width).toBe(TIP_MAX_WIDTH)
    expect(p.left).toBe(450 - TIP_MAX_WIDTH / 2)
  })

  it('sits over a stat low on the screen', () => {
    const p = bubblePlacement({ left: 400, top: 300, right: 500, bottom: 344 }, PHONE)
    expect(p.side).toBe('above')
    expect(p.bottom).toBe(412 - 300 + 6)
  })

  it('stays inside the gutters at both edges and on a narrow screen', () => {
    expect(bubblePlacement({ left: 0, top: 10, right: 40, bottom: 54 }, PHONE).left).toBe(TIP_GUTTER)
    const right = bubblePlacement({ left: 850, top: 10, right: 892, bottom: 54 }, PHONE)
    expect(right.left + right.width).toBe(892 - TIP_GUTTER)
    const narrow = bubblePlacement({ left: 100, top: 10, right: 200, bottom: 54 }, { width: 300, height: 600 })
    expect(narrow.width).toBe(300 - 2 * TIP_GUTTER)
    expect(narrow.left).toBe(TIP_GUTTER)
  })
})
