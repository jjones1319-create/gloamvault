import { describe, expect, it } from 'vitest'
import { onItsOwnFrame, takeTurn } from './turns.ts'

describe('one heavy job a frame (Phase 8)', () => {
  it('jobs run one after another, never two in one task, in the order asked', async () => {
    const order: string[] = []
    let running = 0
    const job = (name: string) =>
      onItsOwnFrame(() => {
        running++
        expect(running).toBe(1)
        order.push(name)
        running--
        return name
      })
    const results = await Promise.all([job('a'), job('b'), job('c')])
    expect(results).toEqual(['a', 'b', 'c'])
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('a turn is held until it is released, and a failing job releases it', async () => {
    const release = await takeTurn()
    let second = false
    const next = onItsOwnFrame(() => {
      second = true
    })
    await new Promise((r) => setTimeout(r, 20))
    expect(second).toBe(false)
    release()
    await next
    expect(second).toBe(true)
    await expect(
      onItsOwnFrame(() => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    await onItsOwnFrame(() => undefined)
  })
})
